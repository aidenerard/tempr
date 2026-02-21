import {
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Text, View } from "@/components/Themed";
import { useState, useRef, useCallback } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/AuthContext";
import { theme } from "@/constants/Colors";
import {
  getTopTracks,
  getTopArtists,
  searchTracks,
  formatDuration,
  totalDurationMinutes,
  type SpotifyTrack,
} from "@/lib/spotify";
import { generateQueueSuggestions } from "@/lib/gemini";

const TARGET_MAX_MINUTES = 45;

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tracks?: SpotifyTrack[];
  totalMinutes?: number;
};

const THINKING_MESSAGES: [
  (prompt: string) => string,
  () => string,
  () => string,
  () => string,
] = [
  (prompt: string) => `Creating a queue for "${prompt}"...`,
  () => "Analyzing your listening history...",
  () => "Mapping the mood to audio features...",
  () => "Picking the perfect tracks...",
];

export default function GenerateScreen() {
  const { spotifyToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const updateThinking = useCallback((id: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, text } : m))
    );
  }, []);

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
      text: THINKING_MESSAGES[0](prompt),
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setGenerating(true);

    try {
      updateThinking(thinkingId, THINKING_MESSAGES[1]());

      const [topTracks, topArtists] = await Promise.all([
        getTopTracks(spotifyToken, 20),
        getTopArtists(spotifyToken, 15),
      ]);

      updateThinking(thinkingId, THINKING_MESSAGES[2]());

      const suggestions = await generateQueueSuggestions(
        prompt,
        topTracks,
        topArtists
      );

      updateThinking(thinkingId, THINKING_MESSAGES[3]());

      const [familiarResults, discoveryResults] = await Promise.all([
        Promise.all(
          (suggestions.familiar ?? []).map((q) =>
            searchTracks(spotifyToken, q, 1).catch(() => [])
          )
        ),
        Promise.all(
          (suggestions.discoveries ?? []).map((q) =>
            searchTracks(spotifyToken, q, 1).catch(() => [])
          )
        ),
      ]);

      const familiarTracks = familiarResults.flat().filter(Boolean);
      const discoveryTracks = discoveryResults.flat().filter(Boolean);

      const seen = new Set<string>();
      const dedup = (tracks: SpotifyTrack[]) =>
        tracks.filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });

      const familiar = dedup(familiarTracks);
      const discoveries = dedup(discoveryTracks);

      const queue: SpotifyTrack[] = [];
      let fi = 0;
      let di = 0;
      let runningMs = 0;
      const targetMaxMs = TARGET_MAX_MINUTES * 60000;

      while (
        runningMs < targetMaxMs &&
        (fi < familiar.length || di < discoveries.length)
      ) {
        if (fi < familiar.length) {
          queue.push(familiar[fi++]);
          runningMs += queue[queue.length - 1].duration_ms;
          if (runningMs >= targetMaxMs) break;
        }
        for (let n = 0; n < 2 && di < discoveries.length; n++) {
          queue.push(discoveries[di++]);
          runningMs += queue[queue.length - 1].duration_ms;
          if (runningMs >= targetMaxMs) break;
        }
      }

      const minutes = totalDurationMinutes(queue);
      const af = suggestions.audioFeatures;
      const moodLine = formatMoodSummary(af);

      const assistantMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: "assistant",
        text: `${suggestions.reasoning}\n\n${moodLine}`,
        tracks: queue,
        totalMinutes: minutes,
      };

      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== thinkingId);
        return [...filtered, assistantMsg];
      });
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

  const renderTrack = (track: SpotifyTrack, index: number) => {
    const albumArt = track.album.images[track.album.images.length - 1]?.url;
    return (
      <View style={styles.trackRow} key={track.id}>
        <Text style={styles.trackIndex}>{index + 1}</Text>
        {albumArt ? (
          <Image source={{ uri: albumArt }} style={styles.albumArt} />
        ) : (
          <View style={styles.albumPlaceholder}>
            <FontAwesome name="music" size={14} color={theme.textMuted} />
          </View>
        )}
        <View style={styles.trackInfo}>
          <Text style={styles.trackName} numberOfLines={1}>
            {track.name}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {track.artists.map((a) => a.name).join(", ")}
          </Text>
        </View>
        <Text style={styles.trackDuration}>
          {formatDuration(track.duration_ms)}
        </Text>
      </View>
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

    const isThinking = generating && !item.tracks;

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
        {item.tracks && item.tracks.length > 0 && (
          <View style={styles.trackList}>
            {item.tracks.map((track, i) => renderTrack(track, i))}
            <View style={styles.queueFooter}>
              <View style={styles.queueStat}>
                <FontAwesome name="music" size={11} color={theme.primary} />
                <Text style={styles.queueStatText}>
                  {item.tracks.length} tracks
                </Text>
              </View>
              <View style={styles.queueStat}>
                <FontAwesome name="clock-o" size={11} color={theme.primary} />
                <Text style={styles.queueStatText}>
                  ~{item.totalMinutes} min
                </Text>
              </View>
            </View>
          </View>
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
          placeholder="Describe a vibe..."
          placeholderTextColor={theme.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleGenerate}
          returnKeyType="send"
          editable={!generating}
          multiline
        />
        <Pressable
          style={[
            styles.sendButton,
            (!input.trim() || generating) && styles.sendButtonDisabled,
          ]}
          onPress={handleGenerate}
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
  trackDuration: {
    fontSize: 12,
    color: theme.textMuted,
    marginLeft: 8,
    fontVariant: ["tabular-nums"],
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
});
