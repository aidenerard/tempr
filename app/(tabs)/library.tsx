import {
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Dimensions,
} from "react-native";
import { Text, View } from "@/components/Themed";
import { useState, useCallback } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { theme } from "@/constants/Colors";
import {
  loadQueues,
  loadLikes,
  deleteQueue,
  type SavedQueue,
} from "@/lib/queueStorage";

const SCREEN_WIDTH = Dimensions.get("window").width;

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const [queues, setQueues] = useState<SavedQueue[]>([]);
  const [likes, setLikes] = useState<SavedQueue | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadQueues().then(setQueues);
      loadLikes().then(setLikes);
    }, []),
  );

  const handleDelete = (queue: SavedQueue) => {
    Alert.alert(
      "Delete Memory",
      `Remove "${queue.title || queue.prompt}" from your memories?`,
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

  if (queues.length === 0 && !likes) {
    return (
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + 16 }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Memories</Text>
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <FontAwesome name="heart-o" size={36} color={theme.primary} />
          </View>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptySubtitle}>
            Generate a queue and save it, or swipe right on songs in Discover to like them.
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
      <Text style={styles.headerTitle}>Memories</Text>
      <Text style={styles.subtitle}>
        {queues.length} {queues.length === 1 ? "memory" : "memories"}
      </Text>

      {likes && (() => {
        const isExpanded = expandedId === likes.id;
        return (
          <View style={[styles.card, styles.likesCard]} key={likes.id}>
            <Pressable
              style={({ pressed }) => [pressed && styles.cardPressed]}
              onPress={() => toggleExpand(likes.id)}
            >
              <View style={styles.likesCardHeader}>
                <View style={styles.likesIconWrap}>
                  <FontAwesome name="heart" size={22} color="#4ade80" />
                </View>
                <View style={{ flex: 1, backgroundColor: "transparent" }}>
                  <Text style={styles.likesTitle}>Likes</Text>
                  <View style={styles.cardMeta}>
                    <FontAwesome name="music" size={10} color={theme.textMuted} />
                    <Text style={styles.cardMetaText}>
                      {likes.songs.length} {likes.songs.length === 1 ? "track" : "tracks"} liked from Discover
                    </Text>
                  </View>
                  <FontAwesome
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={10}
                    color={theme.textMuted}
                    style={styles.chevron}
                  />
                </View>
              </View>
            </Pressable>
            {isExpanded && (
              <View style={styles.trackList}>
                {likes.songs.map((song, i) => {
                  const parts = song.name.split(" - ");
                  const title = parts[0]?.trim() ?? song.name;
                  const artist = parts[1]?.trim();
                  return (
                    <View style={styles.trackRow} key={`${song.name}-${i}`}>
                      <Text style={styles.trackIndex}>{i + 1}</Text>
                      {song.albumArt ? (
                        <Image source={{ uri: song.albumArt }} style={styles.albumArt} />
                      ) : (
                        <View style={styles.albumPlaceholder}>
                          <FontAwesome name="music" size={12} color={theme.textMuted} />
                        </View>
                      )}
                      <View style={styles.trackInfo}>
                        <Text style={styles.trackName} numberOfLines={1}>{title}</Text>
                        {artist ? (
                          <Text style={styles.trackArtist} numberOfLines={1}>{artist}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })()}

      {queues.map((queue) => {
        const isExpanded = expandedId === queue.id;
        const displayTitle = queue.title || queue.prompt;
        return (
          <View style={styles.card} key={queue.id}>
            <Pressable
              style={({ pressed }) => [pressed && styles.cardPressed]}
              onPress={() => toggleExpand(queue.id)}
            >
              {queue.coverImage ? (
                <Image
                  source={{ uri: queue.coverImage }}
                  style={styles.cardCover}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.cardCoverPlaceholder}>
                  <FontAwesome
                    name="music"
                    size={28}
                    color={theme.primaryBorder}
                  />
                </View>
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {displayTitle}
                  </Text>
                  <Pressable
                    onPress={() => handleDelete(queue)}
                    hitSlop={12}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.deleteButtonPressed,
                    ]}
                  >
                    <FontAwesome
                      name="trash-o"
                      size={14}
                      color={theme.danger}
                    />
                  </Pressable>
                </View>
                <Text style={styles.cardDate}>
                  {formatDate(queue.savedAt)}
                </Text>
                <View style={styles.cardMeta}>
                  <FontAwesome
                    name="music"
                    size={10}
                    color={theme.textMuted}
                  />
                  <Text style={styles.cardMetaText}>
                    {queue.songs.length} tracks
                  </Text>
                  {queue.moodLine ? (
                    <>
                      <Text style={styles.cardMetaDot}>·</Text>
                      <Text
                        style={styles.cardMetaText}
                        numberOfLines={1}
                      >
                        {queue.moodLine}
                      </Text>
                    </>
                  ) : null}
                </View>
                <FontAwesome
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={10}
                  color={theme.textMuted}
                  style={styles.chevron}
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
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 16,
    overflow: "hidden",
  },
  likesCard: {
    borderColor: "rgba(74, 222, 128, 0.3)",
  },
  likesCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
    backgroundColor: "transparent",
  },
  likesIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  likesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardCover: {
    width: "100%",
    height: 160,
  },
  cardCoverPlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    padding: 16,
    backgroundColor: "transparent",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "transparent",
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.2,
    flex: 1,
  },
  cardDate: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
    backgroundColor: "transparent",
  },
  cardMetaText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "500",
    flexShrink: 1,
  },
  cardMetaDot: {
    fontSize: 12,
    color: theme.textMuted,
  },
  chevron: {
    alignSelf: "center",
    marginTop: 12,
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
