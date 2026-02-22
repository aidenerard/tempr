import { StyleSheet, ScrollView, Pressable, Image, Alert } from "react-native";
import { Text, View } from "@/components/Themed";
import { useState, useCallback } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { theme } from "@/constants/Colors";
import { loadQueues, deleteQueue, type SavedQueue } from "@/lib/queueStorage";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [queues, setQueues] = useState<SavedQueue[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadQueues().then(setQueues);
    }, []),
  );

  const handleDelete = (queue: SavedQueue) => {
    Alert.alert(
      "Delete Queue",
      `Remove "${queue.prompt}" from your library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteQueue(queue.id);
            setQueues((prev) => prev.filter((q) => q.id !== queue.id));
            if (expandedId === queue.id) setExpandedId(null);
          },
        },
      ],
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (queues.length === 0) {
    return (
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + 16 }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Library</Text>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <FontAwesome name="bookmark-o" size={36} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>No saved queues yet</Text>
          <Text style={styles.emptySubtitle}>
            Generate a queue and tap "Save to Library" to keep it here.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Library</Text>
      <Text style={styles.subtitle}>
        {queues.length} saved queue{queues.length !== 1 ? "s" : ""}
      </Text>

      {queues.map((queue) => {
        const isExpanded = expandedId === queue.id;
        return (
          <View style={styles.card} key={queue.id}>
            <Pressable
              style={({ pressed }) => [
                styles.cardHeader,
                pressed && styles.cardHeaderPressed,
              ]}
              onPress={() => toggleExpand(queue.id)}
            >
              <View style={styles.cardHeaderLeft}>
                <Text style={styles.cardPrompt} numberOfLines={1}>
                  {queue.prompt}
                </Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardMetaText}>
                    {queue.songs.length} tracks
                  </Text>
                  <Text style={styles.cardMetaDot}>·</Text>
                  <Text style={styles.cardMetaText}>
                    {timeAgo(queue.savedAt)}
                  </Text>
                </View>
                {queue.moodLine ? (
                  <Text style={styles.cardMoodLine} numberOfLines={1}>
                    {queue.moodLine}
                  </Text>
                ) : null}
              </View>
              <View style={styles.cardActions}>
                <Pressable
                  onPress={() => handleDelete(queue)}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    pressed && styles.deleteButtonPressed,
                  ]}
                >
                  <FontAwesome name="trash-o" size={16} color={theme.danger} />
                </Pressable>
                <FontAwesome
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={12}
                  color={theme.textMuted}
                />
              </View>
            </Pressable>

            {isExpanded && (
              <View style={styles.trackList}>
                {queue.songs.map((song, i) => {
                  const parts = song.name.split(" - ");
                  const title = parts[0]?.trim() ?? song.name;
                  const artist = parts[1]?.trim();
                  return (
                    <View style={styles.trackRow} key={`${song.name}-${i}`}>
                      <Text style={styles.trackIndex}>{i + 1}</Text>
                      {song.albumArt ? (
                        <Image
                          source={{ uri: song.albumArt }}
                          style={styles.albumArt}
                        />
                      ) : (
                        <View style={styles.albumPlaceholder}>
                          <FontAwesome
                            name="music"
                            size={12}
                            color={theme.textMuted}
                          />
                        </View>
                      )}
                      <View style={styles.trackInfo}>
                        <Text style={styles.trackName} numberOfLines={1}>
                          {title}
                        </Text>
                        {artist ? (
                          <Text style={styles.trackArtist} numberOfLines={1}>
                            {artist}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    backgroundColor: "transparent",
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
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
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "transparent",
  },
  cardHeaderPressed: {
    opacity: 0.7,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 12,
    backgroundColor: "transparent",
  },
  cardPrompt: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.2,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
    backgroundColor: "transparent",
  },
  cardMetaText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "500",
  },
  cardMetaDot: {
    fontSize: 12,
    color: theme.textMuted,
  },
  cardMoodLine: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 6,
  },
  cardActions: {
    alignItems: "center",
    gap: 12,
    backgroundColor: "transparent",
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.dangerMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
  trackList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.surfaceBorder,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.surfaceBorder,
    backgroundColor: "transparent",
  },
  trackIndex: {
    width: 24,
    fontSize: 11,
    color: theme.textMuted,
    textAlign: "center",
    fontWeight: "500",
  },
  albumArt: {
    width: 36,
    height: 36,
    borderRadius: 5,
  },
  albumPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 5,
    backgroundColor: theme.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  trackInfo: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: "transparent",
  },
  trackName: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.text,
  },
  trackArtist: {
    fontSize: 11,
    color: theme.textSecondary,
    marginTop: 1,
  },
});
