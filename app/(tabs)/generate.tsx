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
import { useAuth } from "@/lib/AuthContext";
import {
  getTopTracks,
  getTopArtists,
  searchTracks,
  formatDuration,
  totalDurationMinutes,
  type SpotifyTrack,
} from "@/lib/spotify";
import { generateQueueSuggestions } from "@/lib/gemini";

const TARGET_MIN_MINUTES = 30;
const TARGET_MAX_MINUTES = 45;

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tracks?: SpotifyTrack[];
  totalMinutes?: number;
};

const THINKING_MESSAGES = [
  (prompt: string) => `Creating a queue for "${prompt}"...`,
  () => "Analyzing your listening history...",
  () => "Mapping the mood to audio features...",
  () => "Picking the perfect tracks...",
];

export default function GenerateScreen() {
  const { spotifyToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const updateThinking = useCallback(
    (id: string, text: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, text } : m))
      );
    },
    []
  );

  const handleGenerate = async () => {
    const prompt = input.trim();
    if (!prompt || generating) return;

    if (!spotifyToken) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        text: "Spotify isn't connected. Please sign out and log back in to reconnect.",
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

      const searchResults = await Promise.all(
        suggestions.searches.map((q) =>
          searchTracks(spotifyToken, q, 1).catch(() => [])
        )
      );

      const allTracks = searchResults
        .flat()
        .filter(
          (track, idx, self) =>
            track && self.findIndex((t) => t.id === track.id) === idx
        );

      const queue: SpotifyTrack[] = [];
      let runningMs = 0;
      const targetMaxMs = TARGET_MAX_MINUTES * 60000;

      for (const track of allTracks) {
        if (runningMs >= targetMaxMs) break;
        queue.push(track);
        runningMs += track.duration_ms;
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
            <FontAwesome name="music" size={14} color="#666" />
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
              color="#1DB954"
              style={styles.thinkingSpinner}
            />
          )}
          <Text style={styles.assistantText}>{item.text}</Text>
        </View>
        {item.tracks && item.tracks.length > 0 && (
          <View style={styles.trackList}>
            {item.tracks.map((track, i) => renderTrack(track, i))}
            <View style={styles.queueFooter}>
              <Text style={styles.queueStat}>
                {item.tracks.length} tracks
              </Text>
              <Text style={styles.queueStat}>
                ~{item.totalMinutes} min
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome name="magic" size={48} color="#1DB954" />
          <Text style={styles.emptyTitle}>Generate a Queue</Text>
          <Text style={styles.emptySubtitle}>
            Describe a mood, vibe, or scenario and Tempr will create a
            personalized 30-45 minute queue from your taste.
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
                style={styles.chip}
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
          placeholderTextColor="#999"
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
            <FontAwesome name="arrow-up" size={18} color="#fff" />
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
    af.energy < 0.3 ? "low energy" : af.energy < 0.7 ? "moderate energy" : "high energy";
  const moodLabel =
    af.valence < 0.3 ? "melancholic" : af.valence < 0.7 ? "balanced" : "uplifting";
  const danceLabel =
    af.danceability < 0.3 ? "freeform" : af.danceability < 0.7 ? "groovy" : "danceable";

  return `Mood: ${moodLabel} / ${energyLabel} / ${danceLabel} / ~${Math.round(af.tempo)} BPM`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    opacity: 0.5,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  exampleChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 24,
    gap: 8,
  },
  chip: {
    backgroundColor: "rgba(29, 185, 84, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(29, 185, 84, 0.25)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    color: "#1DB954",
    fontWeight: "500",
  },
  messageList: {
    padding: 16,
    paddingBottom: 8,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#1DB954",
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
    fontWeight: "500",
  },
  assistantSection: {
    marginBottom: 16,
  },
  assistantBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  thinkingSpinner: {
    marginRight: 8,
    marginTop: 2,
  },
  assistantText: {
    fontSize: 14,
    opacity: 0.7,
    flex: 1,
    lineHeight: 20,
  },
  trackList: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  trackIndex: {
    width: 24,
    fontSize: 12,
    opacity: 0.3,
    textAlign: "center",
  },
  albumArt: {
    width: 40,
    height: 40,
    borderRadius: 4,
  },
  albumPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: "#2a2a2a",
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
  },
  trackArtist: {
    fontSize: 12,
    opacity: 0.5,
    marginTop: 2,
  },
  trackDuration: {
    fontSize: 12,
    opacity: 0.4,
    marginLeft: 8,
  },
  queueFooter: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingVertical: 10,
    backgroundColor: "transparent",
  },
  queueStat: {
    fontSize: 12,
    opacity: 0.4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    color: "#000",
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1DB954",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
