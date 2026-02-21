import {
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { Text, View } from "@/components/Themed";
import { useEffect, useState, useCallback } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { theme } from "@/constants/Colors";
import { getPendingQueue, clearPendingQueue } from "@/lib/promptEngine";
import { saveFeedback, type QueueFeedback } from "@/lib/settings";
import { recordTriggerDismissed } from "@/lib/trigger";
import { trackEvent } from "@/lib/analytics";
import { formatDuration, totalDurationMinutes, type SpotifyTrack } from "@/lib/spotify";
import type { GeneratedQueue } from "@/lib/queueGenerator";

type FeedbackState = "none" | "positive" | "negative" | "dismissed";

export default function PromptedQueueScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [queue, setQueue] = useState<GeneratedQueue | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>("none");

  useEffect(() => {
    const pending = getPendingQueue();
    if (pending) {
      setQueue(pending);
      trackEvent({
        name: "prompted_queue_notification_opened",
        properties: { vibeId: pending.vibe.id },
      });
    }
  }, []);

  const handlePlay = useCallback(() => {
    if (!queue) return;
    trackEvent({
      name: "prompted_queue_played",
      properties: {
        vibeId: queue.vibe.id,
        trackCount: queue.tracks.length,
        durationMin: queue.totalDurationMin,
      },
    });
    saveFeedback({
      queueId: String(queue.generatedAt),
      vibeId: queue.vibe.id,
      triggerSource: "",
      action: "played",
      timestamp: Date.now(),
    });
    clearPendingQueue();
  }, [queue]);

  const handleSave = useCallback(() => {
    if (!queue) return;
    trackEvent({
      name: "prompted_queue_saved",
      properties: { vibeId: queue.vibe.id },
    });
    saveFeedback({
      queueId: String(queue.generatedAt),
      vibeId: queue.vibe.id,
      triggerSource: "",
      action: "saved",
      timestamp: Date.now(),
    });
  }, [queue]);

  const handleDismiss = useCallback(() => {
    if (!queue) return;
    setFeedback("dismissed");
    recordTriggerDismissed(queue.vibe.id, "");
    trackEvent({
      name: "prompted_queue_dismissed",
      properties: { vibeId: queue.vibe.id, triggerSource: "" },
    });
    saveFeedback({
      queueId: String(queue.generatedAt),
      vibeId: queue.vibe.id,
      triggerSource: "",
      action: "dismissed",
      timestamp: Date.now(),
    });
    clearPendingQueue();
    router.back();
  }, [queue, router]);

  const handleFeedback = useCallback(
    (type: "positive" | "negative") => {
      if (!queue) return;
      setFeedback(type);
      trackEvent({
        name: "prompted_queue_feedback",
        properties: {
          vibeId: queue.vibe.id,
          action: type,
        },
      });
      saveFeedback({
        queueId: String(queue.generatedAt),
        vibeId: queue.vibe.id,
        triggerSource: "",
        action: type === "negative" ? "not_my_vibe" : "played",
        timestamp: Date.now(),
      });
    },
    [queue]
  );

  if (!queue) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyState}>
          <FontAwesome name="music" size={40} color={theme.textMuted} />
          <Text style={styles.emptyTitle}>No queue ready</Text>
          <Text style={styles.emptySubtitle}>
            Check back later — we'll build one when the moment's right.
          </Text>
          <Pressable
            style={styles.backButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.backButtonText}>Go Home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const vibe = queue.vibe;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <FontAwesome name="chevron-left" size={18} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>For You</Text>
        <View style={{ width: 18, backgroundColor: "transparent" }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.vibeHeader}>
          <View style={styles.vibeEmojiWrap}>
            <Text style={styles.vibeEmoji}>{vibe.emoji}</Text>
          </View>
          <Text style={styles.vibeLabel}>{vibe.label}</Text>
          <Text style={styles.vibeDescription}>{vibe.description}</Text>
          <Text style={styles.vibeSource}>
            Built from your favorites + new picks
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <FontAwesome name="music" size={12} color={theme.primary} />
            <Text style={styles.statText}>{queue.tracks.length} tracks</Text>
          </View>
          <View style={styles.stat}>
            <FontAwesome name="clock-o" size={12} color={theme.primary} />
            <Text style={styles.statText}>~{queue.totalDurationMin} min</Text>
          </View>
          <View style={styles.stat}>
            <FontAwesome name="heart" size={12} color={theme.primary} />
            <Text style={styles.statText}>{queue.familiarCount} favorites</Text>
          </View>
          <View style={styles.stat}>
            <FontAwesome name="compass" size={12} color={theme.primary} />
            <Text style={styles.statText}>{queue.discoveryCount} new</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.playButton,
              pressed && styles.playButtonPressed,
            ]}
            onPress={handlePlay}
          >
            <FontAwesome name="play" size={16} color="#fff" />
            <Text style={styles.playButtonText}>Play Now</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleSave}
          >
            <FontAwesome name="bookmark-o" size={16} color={theme.primary} />
            <Text style={styles.secondaryActionText}>Save</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleDismiss}
          >
            <FontAwesome name="times" size={16} color={theme.textMuted} />
            <Text style={[styles.secondaryActionText, { color: theme.textMuted }]}>
              Not now
            </Text>
          </Pressable>
        </View>

        <View style={styles.trackList}>
          {queue.tracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} />
          ))}
        </View>

        {feedback === "none" && (
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>How's this queue?</Text>
            <View style={styles.feedbackActions}>
              <Pressable
                style={styles.feedbackBtn}
                onPress={() => handleFeedback("positive")}
              >
                <FontAwesome name="thumbs-up" size={18} color={theme.success} />
                <Text style={[styles.feedbackBtnText, { color: theme.success }]}>
                  Love it
                </Text>
              </Pressable>
              <Pressable
                style={styles.feedbackBtn}
                onPress={() => handleFeedback("negative")}
              >
                <FontAwesome name="thumbs-down" size={18} color={theme.danger} />
                <Text style={[styles.feedbackBtnText, { color: theme.danger }]}>
                  Not my vibe
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        {feedback !== "none" && feedback !== "dismissed" && (
          <View style={styles.feedbackThanks}>
            <FontAwesome name="check-circle" size={16} color={theme.success} />
            <Text style={styles.feedbackThanksText}>
              Thanks! We'll use this to improve your future queues.
            </Text>
          </View>
        )}

        {queue.reasoning ? (
          <View style={styles.reasoningCard}>
            <FontAwesome name="lightbulb-o" size={14} color={theme.primaryLight} />
            <Text style={styles.reasoningText}>{queue.reasoning}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TrackRow({ track, index }: { track: SpotifyTrack; index: number }) {
  const albumArt = track.album.images[track.album.images.length - 1]?.url;

  return (
    <View style={styles.trackRow}>
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  vibeHeader: {
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "transparent",
  },
  vibeEmojiWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  vibeEmoji: {
    fontSize: 32,
  },
  vibeLabel: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
  },
  vibeDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
  },
  vibeSource: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 20,
    backgroundColor: "transparent",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "transparent",
  },
  statText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
    backgroundColor: "transparent",
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    gap: 10,
  },
  playButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  playButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    gap: 8,
  },
  secondaryActionText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  trackList: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 20,
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
  feedbackCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 16,
    alignItems: "center",
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 14,
  },
  feedbackActions: {
    flexDirection: "row",
    gap: 20,
    backgroundColor: "transparent",
  },
  feedbackBtn: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.surfaceLight,
  },
  feedbackBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  feedbackThanks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: theme.successMuted,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  feedbackThanksText: {
    fontSize: 13,
    color: theme.success,
    fontWeight: "500",
    flex: 1,
  },
  reasoningCard: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    alignItems: "flex-start",
  },
  reasoningText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: "transparent",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.primary,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
