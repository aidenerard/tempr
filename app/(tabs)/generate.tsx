import {
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { Text, View } from "@/components/Themed";
import { useState, useRef, useCallback } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
  Easing,
} from "react-native-reanimated";
import { useAuth } from "@/lib/AuthContext";
import { theme } from "@/constants/Colors";
import {
  getTopTracks,
  getTopArtists,
  searchTracks,
  addToQueue,
  type SpotifyTrack,
  type SpotifyArtist,
} from "@/lib/spotify";
import {
  generateQueueSuggestions,
  generateReplacementSong,
  adjustQueueSuggestions,
} from "@/lib/gemini";
import { saveQueue } from "@/lib/queueStorage";

type SongEntry = {
  name: string;
  albumArt?: string;
  uri?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  songs?: SongEntry[];
  prompt?: string;
  moodLine?: string;
  saved?: boolean;
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = -SCREEN_WIDTH * 0.35;

function SwipeableTrackRow({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove: () => void;
}) {
  const translateX = useSharedValue(0);
  const rowHeight = useSharedValue(0);
  const removing = useSharedValue(false);
  const measured = useRef(false);

  const panGesture = Gesture.Pan()
    .activeOffsetX(-10)
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (removing.value) return;
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd(() => {
      if (removing.value) return;
      if (translateX.value < SWIPE_THRESHOLD) {
        removing.value = true;
        translateX.value = withTiming(
          -SCREEN_WIDTH,
          { duration: 250, easing: Easing.out(Easing.cubic) },
          (done) => {
            if (!done) return;
            rowHeight.value = withTiming(0, { duration: 300 }, (done2) => {
              if (done2) runOnJS(onRemove)();
            });
          },
        );
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const wrapperStyle = useAnimatedStyle(() => {
    if (!removing.value) return {};
    return { height: rowHeight.value, overflow: "hidden" as const };
  });

  const bgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, -80],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Animated.View
      style={wrapperStyle}
      onLayout={(e) => {
        if (!measured.current) {
          measured.current = true;
          rowHeight.value = e.nativeEvent.layout.height;
        }
      }}
    >
      <Animated.View style={[styles.deleteBackground, bgStyle]}>
        <FontAwesome name="trash" size={18} color="#fff" />
      </Animated.View>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[{ backgroundColor: theme.surface }, slideStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export default function GenerateScreen() {
  const { spotifyToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [queuedSongs, setQueuedSongs] = useState<
    Record<string, "queuing" | "queued" | "error">
  >({});

  const topTracksRef = useRef<SpotifyTrack[] | null>(null);
  const topArtistsRef = useRef<SpotifyArtist[] | null>(null);

  const hasQueue = messages.some((m) => m.songs && m.songs.length > 0);

  const updateThinking = useCallback((id: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text } : m)),
    );
  }, []);

  const ensureSpotifyData = async () => {
    if (!spotifyToken)
      return {
        topTracks: [] as SpotifyTrack[],
        topArtists: [] as SpotifyArtist[],
      };
    if (topTracksRef.current && topArtistsRef.current) {
      return {
        topTracks: topTracksRef.current,
        topArtists: topArtistsRef.current,
      };
    }
    const [topTracks, topArtists] = await Promise.all([
      getTopTracks(spotifyToken, 50),
      getTopArtists(spotifyToken, 30),
    ]);
    topTracksRef.current = topTracks;
    topArtistsRef.current = topArtists;
    return { topTracks, topArtists };
  };

  const fetchMissingArt = useCallback(
    async (msgId: string, songs: SongEntry[], token: string) => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      await wait(10000);

      for (let i = 0; i < songs.length; i++) {
        if (songs[i].albumArt) continue;
        try {
          const results = await searchTracks(token, songs[i].name, 1);
          const match = results[0];
          const art =
            match?.album.images[match.album.images.length - 1]?.url;
          if (match) {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== msgId || !m.songs) return m;
                const updated = [...m.songs];
                updated[i] = {
                  ...updated[i],
                  albumArt: art,
                  uri: match.uri,
                };
                return { ...m, songs: updated };
              }),
            );
          }
        } catch {
          await wait(10000);
          i--;
          continue;
        }
        await wait(3000);
      }
    },
    [],
  );

  const handleGenerate = async () => {
    const prompt = input.trim();
    if (!prompt || generating) return;

    if (!spotifyToken) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        text: "Spotify isn't connected. Head to Profile and reconnect.",
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: prompt,
    };
    const thinkingId = (Date.now() + 1).toString();
    const thinkingMsg: Message = {
      id: thinkingId,
      role: "assistant",
      text: `Creating a queue for "${prompt}"...`,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setGenerating(true);

    try {
      updateThinking(thinkingId, "Analyzing your listening history...");
      const { topTracks, topArtists } = await ensureSpotifyData();

      updateThinking(thinkingId, "Mapping the mood to audio features...");
      const suggestions = await generateQueueSuggestions(
        prompt,
        topTracks,
        topArtists,
      );

      updateThinking(thinkingId, "Picking the perfect tracks...");
      const artLookup = buildArtLookup(topTracks);
      const uriLookup = buildUriLookup(topTracks);

      const allSongNames = [
        ...(suggestions.familiar ?? []),
      ];
      const songs: SongEntry[] = allSongNames.map((n) => ({
        name: n,
        albumArt: matchAlbumArt(n, artLookup),
        uri: matchTrackUri(n, uriLookup),
      }));

      const af = suggestions.audioFeatures;
      const moodLine = formatMoodSummary(af);

      const msgId = (Date.now() + 2).toString();
      const assistantMsg: Message = {
        id: msgId,
        role: "assistant",
        text: `${suggestions.reasoning}\n\n${moodLine}`,
        songs,
        prompt,
        moodLine,
      };

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== thinkingId);
        return [...filtered, assistantMsg];
      });

      fetchMissingArt(msgId, songs, spotifyToken);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        text: `Something went wrong: ${err.message}`,
      };
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== thinkingId);
        return [...filtered, errorMsg];
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAdjust = async () => {
    const adjustment = input.trim();
    if (!adjustment || generating) return;

    const latestQueue = [...messages]
      .reverse()
      .find((m) => m.songs && m.songs.length > 0);
    if (!latestQueue?.songs || !latestQueue.prompt) return;

    if (!spotifyToken) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        text: "Spotify isn't connected. Head to Profile and reconnect.",
      };
      setMessages((prev) => [...prev, errorMsg]);
      return;
    }

    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: adjustment,
    };
    const thinkingId = (Date.now() + 1).toString();
    const thinkingMsg: Message = {
      id: thinkingId,
      role: "assistant",
      text: `Adjusting queue: "${adjustment}"...`,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setGenerating(true);

    try {
      updateThinking(thinkingId, "Re-evaluating song fit...");
      const { topTracks, topArtists } = await ensureSpotifyData();
      const currentSongNames = latestQueue.songs.map((s) => s.name);

      updateThinking(thinkingId, "Finding better matches...");
      const result = await adjustQueueSuggestions(
        currentSongNames,
        latestQueue.prompt,
        adjustment,
        topTracks,
        topArtists,
      );

      const removeSet = new Set(result.remove.map((r) => r.toLowerCase()));
      const keptSongs = latestQueue.songs.filter(
        (s) => !removeSet.has(s.name.toLowerCase()),
      );

      const artLookup = buildArtLookup(topTracks);
      const uriLookup = buildUriLookup(topTracks);
      const newSongs: SongEntry[] = result.additions.map((n) => ({
        name: n,
        albumArt: matchAlbumArt(n, artLookup),
        uri: matchTrackUri(n, uriLookup),
      }));

      const combinedSongs = [...keptSongs, ...newSongs];
      const updatedPrompt = `${latestQueue.prompt} → ${adjustment}`;
      const af = result.audioFeatures;
      const moodLine = formatMoodSummary(af);

      const msgId = (Date.now() + 2).toString();
      const assistantMsg: Message = {
        id: msgId,
        role: "assistant",
        text: `${result.reasoning}\n\n${moodLine}`,
        songs: combinedSongs,
        prompt: updatedPrompt,
        moodLine,
      };

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== thinkingId);
        return [...filtered, assistantMsg];
      });

      fetchMissingArt(msgId, newSongs, spotifyToken);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        text: `Adjustment failed: ${err.message}`,
      };
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== thinkingId);
        return [...filtered, errorMsg];
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = () => {
    if (hasQueue) {
      handleAdjust();
    } else {
      handleGenerate();
    }
  };

  const handleNew = () => {
    setMessages([]);
    setQueuedSongs({});
    setInput("");
    topTracksRef.current = null;
    topArtistsRef.current = null;
  };

  const handleAddToQueue = async (
    song: SongEntry,
    index: number,
    msgId: string,
  ) => {
    if (!spotifyToken || !song.uri) return;
    const key = `${msgId}-${index}`;
    if (queuedSongs[key]) return;

    setQueuedSongs((prev) => ({ ...prev, [key]: "queuing" }));
    try {
      await addToQueue(spotifyToken, song.uri);
      setQueuedSongs((prev) => ({ ...prev, [key]: "queued" }));
    } catch {
      setQueuedSongs((prev) => ({ ...prev, [key]: "error" }));
      setTimeout(() => {
        setQueuedSongs((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 2000);
    }
  };

  const handleAddAllToQueue = async (msg: Message) => {
    if (!spotifyToken || !msg.songs) return;
    const queuable = msg.songs
      .map((s, i) => ({ song: s, index: i }))
      .filter(({ song, index }) => song.uri && !queuedSongs[`${msg.id}-${index}`]);
    if (queuable.length === 0) return;

    const keys = queuable.map(({ index }) => `${msg.id}-${index}`);
    setQueuedSongs((prev) => {
      const next = { ...prev };
      keys.forEach((k) => (next[k] = "queuing"));
      return next;
    });

    for (const { song, index } of queuable) {
      const key = `${msg.id}-${index}`;
      try {
        await addToQueue(spotifyToken, song.uri!);
        setQueuedSongs((prev) => ({ ...prev, [key]: "queued" }));
      } catch {
        setQueuedSongs((prev) => ({ ...prev, [key]: "error" }));
        setTimeout(() => {
          setQueuedSongs((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        }, 2000);
      }
    }
  };

  const handleSave = async (msg: Message) => {
    if (!msg.songs || !msg.prompt || msg.saved) return;
    await saveQueue({
      id: msg.id,
      prompt: msg.prompt,
      moodLine: msg.moodLine ?? "",
      songs: msg.songs.map((s) => ({ name: s.name, albumArt: s.albumArt })),
      savedAt: Date.now(),
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, saved: true } : m)),
    );
  };

  const handleRemoveSong = useCallback(
    async (msgId: string, songName: string) => {
      let prompt = "";
      let remainingSongNames: string[] = [];

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId || !m.songs) return m;
          prompt = m.prompt ?? "";
          let removed = false;
          const updatedSongs = m.songs.filter((s) => {
            if (!removed && s.name === songName) {
              removed = true;
              return false;
            }
            return true;
          });
          remainingSongNames = updatedSongs.map((s) => s.name);
          return { ...m, songs: updatedSongs };
        }),
      );

      if (!prompt) return;

      try {
        const removedLower = songName.toLowerCase();
        const excludeSet = new Set([
          removedLower,
          ...remainingSongNames.map((n) => n.toLowerCase()),
        ]);
        const topTrackNames = (topTracksRef.current ?? [])
          .map((t) => `${t.name} - ${t.artists[0]?.name ?? "Unknown"}`)
          .filter((n) => !excludeSet.has(n.toLowerCase()));
        const newSongName = await generateReplacementSong(
          remainingSongNames,
          prompt,
          topTrackNames,
        );

        if (newSongName.toLowerCase() === removedLower) return;

        const cachedTracks = topTracksRef.current ?? [];
        const artLookup = buildArtLookup(cachedTracks);
        const uriLookup = buildUriLookup(cachedTracks);
        const albumArt = matchAlbumArt(newSongName, artLookup);
        const uri = matchTrackUri(newSongName, uriLookup);

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId || !m.songs) return m;
            return {
              ...m,
              songs: [...m.songs, { name: newSongName, albumArt, uri }],
            };
          }),
        );
      } catch {}
    },
    [spotifyToken],
  );

  const renderSong = (song: SongEntry, index: number, msgId: string) => {
    const parts = song.name.split(" - ");
    const title = parts[0]?.trim() ?? song.name;
    const artist = parts[1]?.trim();
    const key = `${msgId}-${index}`;
    const queueState = queuedSongs[key];

    return (
      <SwipeableTrackRow
        key={`${song.name}-${index}`}
        onRemove={() => handleRemoveSong(msgId, song.name)}
      >
        <View style={styles.trackRow}>
          <Text style={styles.trackIndex}>{index + 1}</Text>
          {song.albumArt ? (
            <Image
              source={{ uri: song.albumArt }}
              style={styles.albumArt}
            />
          ) : (
            <View style={styles.albumPlaceholder}>
              <FontAwesome
                name="music"
                size={14}
                color={theme.textMuted}
              />
            </View>
          )}
          <View style={styles.trackInfo}>
            <Text style={styles.trackName} numberOfLines={1}>
              {title}
            </Text>
            {artist && (
              <Text style={styles.trackArtist} numberOfLines={1}>
                {artist}
              </Text>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.queueButton,
              queueState === "queued" && styles.queueButtonDone,
              queueState === "error" && styles.queueButtonError,
              pressed && !queueState && styles.queueButtonPressed,
              !song.uri && styles.queueButtonDisabled,
            ]}
            onPress={() => handleAddToQueue(song, index, msgId)}
            disabled={!!queueState || !song.uri}
          >
            {queueState === "queuing" ? (
              <ActivityIndicator size={12} color={theme.primary} />
            ) : (
              <FontAwesome
                name={
                  queueState === "queued"
                    ? "check"
                    : queueState === "error"
                      ? "times"
                      : "plus"
                }
                size={12}
                color={
                  queueState === "queued"
                    ? theme.success
                    : queueState === "error"
                      ? theme.danger
                      : song.uri
                        ? theme.primary
                        : theme.textMuted
                }
              />
            )}
          </Pressable>
        </View>
      </SwipeableTrackRow>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    if (item.role === "user") {
      return (
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{item.text}</Text>
        </View>
      );
    }

    const isThinking = generating && !item.songs;

    return (
      <View style={styles.assistantSection}>
        <View style={styles.assistantBubble}>
          {isThinking && (
            <ActivityIndicator
              size="small"
              color={theme.primary}
              style={styles.thinkingSpinner}
            />
          )}
          <Text style={styles.assistantText}>{item.text}</Text>
        </View>
        {item.songs && item.songs.length > 0 && (
          <>
            <View style={styles.trackList}>
              {item.songs.map((song, i) => renderSong(song, i, item.id))}
              <View style={styles.queueFooter}>
                <View style={styles.queueStat}>
                  <FontAwesome
                    name="music"
                    size={11}
                    color={theme.primary}
                  />
                  <Text style={styles.queueStatText}>
                    {item.songs.length} tracks
                  </Text>
                </View>
              </View>
            </View>
            {(() => {
              const allKeys = item.songs!.map((_, i) => `${item.id}-${i}`);
              const queuableCount = item.songs!.filter(
                (s, i) => s.uri && !queuedSongs[allKeys[i]],
              ).length;
              const queuingCount = allKeys.filter(
                (k) => queuedSongs[k] === "queuing",
              ).length;
              const allQueued =
                queuableCount === 0 && queuingCount === 0 &&
                item.songs!.some((s, i) => s.uri && queuedSongs[allKeys[i]] === "queued");

              return (
                <View style={styles.actionRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      allQueued && styles.actionButtonDone,
                      pressed && !allQueued && queuingCount === 0 && styles.actionButtonPressed,
                      queuableCount === 0 && queuingCount === 0 && !allQueued && styles.actionButtonDisabled,
                    ]}
                    onPress={() => handleAddAllToQueue(item)}
                    disabled={queuableCount === 0 || queuingCount > 0}
                  >
                    {queuingCount > 0 ? (
                      <ActivityIndicator size={14} color={theme.primary} />
                    ) : (
                      <FontAwesome
                        name={allQueued ? "check" : "plus"}
                        size={14}
                        color={allQueued ? theme.success : theme.primary}
                      />
                    )}
                    <Text
                      style={[
                        styles.actionButtonText,
                        allQueued && styles.actionButtonTextDone,
                      ]}
                    >
                      {allQueued
                        ? "Added to Queue"
                        : queuingCount > 0
                          ? "Adding..."
                          : "Add All to Queue"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.actionButton,
                      item.saved && styles.actionButtonDone,
                      pressed && !item.saved && styles.actionButtonPressed,
                    ]}
                    onPress={() => handleSave(item)}
                    disabled={item.saved}
                  >
                    <FontAwesome
                      name={item.saved ? "check" : "bookmark-o"}
                      size={14}
                      color={item.saved ? theme.success : theme.primary}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        item.saved && styles.actionButtonTextDone,
                      ]}
                    >
                      {item.saved ? "Saved to Library" : "Save to Library"}
                    </Text>
                  </Pressable>
                </View>
              );
            })()}
          </>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Generate</Text>
        {messages.length > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.newButton,
              pressed && styles.newButtonPressed,
            ]}
            onPress={handleNew}
          >
            <FontAwesome name="plus" size={12} color={theme.primary} />
            <Text style={styles.newButtonText}>New</Text>
          </Pressable>
        )}
      </View>

      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <FontAwesome name="magic" size={32} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>Create Your Queue</Text>
          <Text style={styles.emptySubtitle}>
            Describe a mood, vibe, or scenario and Tempr will build a
            personalized 30–45 minute queue.
          </Text>
          <View style={styles.exampleChips}>
            {[
              "late night chill vibes",
              "high energy workout",
              "rainy sunday morning",
              "road trip with friends",
            ].map((example) => (
              <Pressable
                key={example}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && styles.chipPressed,
                ]}
                onPress={() => setInput(example)}
              >
                <Text style={styles.chipText}>{example}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={
            hasQueue ? "Adjust the vibe..." : "Describe a vibe..."
          }
          placeholderTextColor={theme.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          editable={!generating}
          multiline
        />
        <Pressable
          style={[
            styles.sendButton,
            (!input.trim() || generating) && styles.sendButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!input.trim() || generating}
        >
          {generating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <FontAwesome name="arrow-up" size={16} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function buildArtLookup(tracks: SpotifyTrack[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tracks) {
    const art = t.album.images[t.album.images.length - 1]?.url;
    if (!art) continue;
    const key = `${t.name} - ${t.artists[0]?.name}`.toLowerCase();
    map.set(key, art);
    map.set(t.name.toLowerCase(), art);
  }
  return map;
}

function matchAlbumArt(
  songName: string,
  lookup: Map<string, string>,
): string | undefined {
  const lower = songName.toLowerCase();
  const exact = lookup.get(lower);
  if (exact) return exact;

  let match: string | undefined;
  lookup.forEach((art, key) => {
    if (!match && (lower.includes(key) || key.includes(lower))) match = art;
  });
  if (match) return match;
  return undefined;
}

function buildUriLookup(tracks: SpotifyTrack[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tracks) {
    const key = `${t.name} - ${t.artists[0]?.name}`.toLowerCase();
    map.set(key, t.uri);
    map.set(t.name.toLowerCase(), t.uri);
  }
  return map;
}

function matchTrackUri(
  songName: string,
  lookup: Map<string, string>,
): string | undefined {
  const lower = songName.toLowerCase();
  const exact = lookup.get(lower);
  if (exact) return exact;

  let match: string | undefined;
  lookup.forEach((uri, key) => {
    if (!match && (lower.includes(key) || key.includes(lower))) match = uri;
  });
  return match;
}

function formatMoodSummary(af: {
  energy: number;
  valence: number;
  danceability: number;
  tempo: number;
}): string {
  const energyLabel =
    af.energy < 0.3
      ? "low energy"
      : af.energy < 0.7
        ? "moderate energy"
        : "high energy";
  const moodLabel =
    af.valence < 0.3
      ? "melancholic"
      : af.valence < 0.7
        ? "balanced"
        : "uplifting";
  const danceLabel =
    af.danceability < 0.3
      ? "freeform"
      : af.danceability < 0.7
        ? "groovy"
        : "danceable";

  return `${moodLabel} · ${energyLabel} · ${danceLabel} · ~${Math.round(af.tempo)} BPM`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  newButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  newButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.primary,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "transparent",
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  exampleChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 28,
    gap: 8,
    backgroundColor: "transparent",
  },
  chip: {
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  chipPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  chipText: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: "600",
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: theme.primary,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    maxWidth: "80%",
  },
  userText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  assistantSection: {
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  assistantBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 4,
    backgroundColor: "transparent",
  },
  thinkingSpinner: {
    marginRight: 8,
    marginTop: 2,
  },
  assistantText: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 1,
    lineHeight: 21,
  },
  trackList: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.surfaceBorder,
    backgroundColor: "transparent",
  },
  trackIndex: {
    width: 24,
    fontSize: 12,
    color: theme.textMuted,
    textAlign: "center",
    fontWeight: "500",
  },
  albumArt: {
    width: 42,
    height: 42,
    borderRadius: 6,
  },
  albumPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: theme.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: "transparent",
  },
  trackName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  trackArtist: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  queueFooter: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  queueStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
  },
  queueStatText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.surfaceBorder,
    gap: 8,
    backgroundColor: theme.bg,
  },
  input: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.3,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    backgroundColor: "transparent",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  actionButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  actionButtonDone: {
    backgroundColor: theme.successMuted,
    borderColor: "rgba(52, 199, 89, 0.25)",
  },
  actionButtonDisabled: {
    opacity: 0.3,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.primary,
  },
  actionButtonTextDone: {
    color: theme.success,
  },
  queueButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  queueButtonPressed: {
    opacity: 0.6,
    transform: [{ scale: 0.9 }],
  },
  queueButtonDone: {
    backgroundColor: theme.successMuted,
    borderColor: "rgba(52, 199, 89, 0.25)",
  },
  queueButtonError: {
    backgroundColor: theme.dangerMuted,
    borderColor: theme.dangerBorder,
  },
  queueButtonDisabled: {
    opacity: 0.3,
  },
  deleteBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.danger,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingRight: 24,
  },
});
