import {
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Text, View } from "@/components/Themed";
import { useState, useCallback, useRef } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { theme } from "@/constants/Colors";
import { useAuth } from "@/lib/AuthContext";
import {
  requestCalendarPermission,
  getCalendarPermissionStatus,
  getUpcomingEvents,
  formatEventTime,
  formatEventDate,
  type CalendarEvent,
} from "@/lib/calendar";
import {
  loadRecommendations,
  deleteRecommendation,
  type CalendarRecommendation,
} from "@/lib/calendarStorage";
import {
  requestNotificationPermission,
  scanAndScheduleUpcomingEvents,
} from "@/lib/calendarNotifications";
import { addToQueue, getLikedTracks } from "@/lib/spotify";

type ConnectionState = "unknown" | "disconnected" | "connected";

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { spotifyToken } = useAuth();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("unknown");
  const [recommendations, setRecommendations] = useState<
    CalendarRecommendation[]
  >([]);
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [queuingAll, setQueuingAll] = useState<string | null>(null);
  const [queuedSongs, setQueuedSongs] = useState<
    Record<string, "queuing" | "queued" | "error">
  >({});
  const scanInProgress = useRef(false);

  const loadData = useCallback(async () => {
    const hasPermission = await getCalendarPermissionStatus();
    setConnectionState(hasPermission ? "connected" : "disconnected");

    if (hasPermission) {
      const [recs, events] = await Promise.all([
        loadRecommendations(),
        getUpcomingEvents(24),
      ]);
      setRecommendations(recs);
      setUpcomingEvents(events);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleConnect = async () => {
    const granted = await requestCalendarPermission();
    if (!granted) {
      Alert.alert(
        "Permission Required",
        "Tempr needs calendar access to recommend playlists for your events. Please enable it in Settings.",
      );
      return;
    }

    await requestNotificationPermission();
    setConnectionState("connected");
    await loadData();
    handleScan();
  };

  const handleScan = async () => {
    if (scanInProgress.current || !spotifyToken) return;
    scanInProgress.current = true;
    setScanning(true);

    try {
      const count = await scanAndScheduleUpcomingEvents(spotifyToken);
      await loadData();
      if (count > 0) {
        Alert.alert(
          "Playlists Generated",
          `Created ${count} playlist${count > 1 ? "s" : ""} for your upcoming events.`,
        );
      }
    } catch (err) {
      console.error("[Calendar] Scan failed:", err);
    } finally {
      setScanning(false);
      scanInProgress.current = false;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (connectionState === "connected" && spotifyToken) {
      await handleScan();
    }
    setRefreshing(false);
  };

  const handleDelete = (rec: CalendarRecommendation) => {
    Alert.alert(
      "Remove Recommendation",
      `Delete playlist for "${rec.eventTitle}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteRecommendation(rec.id);
            setRecommendations((prev) =>
              prev.filter((r) => r.id !== rec.id),
            );
            if (expandedId === rec.id) setExpandedId(null);
          },
        },
      ],
    );
  };

  const handleAddAllToQueue = async (rec: CalendarRecommendation) => {
    if (!spotifyToken) return;
    setQueuingAll(rec.id);
    try {
      const likedTracks = await getLikedTracks(spotifyToken, 500);
      const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
      const queuable: { song: { name: string }; index: number; uri: string }[] = [];
      for (let i = 0; i < rec.songs.length; i++) {
        if (queuedSongs[`${rec.id}-${i}`]) continue;
        const song = rec.songs[i];
        const parts = song.name.split(" - ").map((p) => p.trim());
        const wantTitle = parts[0] ?? "";
        const wantArtist = parts[1] ?? "";
        const match = likedTracks.find((t) => {
          const trackTitle = normalize(t.name);
          const trackArtist = t.artists?.[0]?.name
            ? normalize(t.artists[0].name)
            : "";
          return (
            normalize(wantTitle) === trackTitle &&
            normalize(wantArtist) === trackArtist
          );
        });
        if (match?.uri) queuable.push({ song, index: i, uri: match.uri });
      }
      if (queuable.length === 0) {
        Alert.alert(
          "Queue",
          "No matching tracks in your liked songs or they're already in your queue. Open the Spotify app and start playing something, then try again.",
        );
        return;
      }

      const keys = queuable.map(({ index }) => `${rec.id}-${index}`);
      setQueuedSongs((prev) => {
        const next = { ...prev };
        keys.forEach((k) => (next[k] = "queuing"));
        return next;
      });

      let added = 0;
      let firstError: string | null = null;
      const addDelayMs = 600;
      for (let i = 0; i < queuable.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, addDelayMs));
        const { index, uri } = queuable[i];
        const key = `${rec.id}-${index}`;
        try {
          await addToQueue(spotifyToken, uri);
          setQueuedSongs((prev) => ({ ...prev, [key]: "queued" }));
          added++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (!firstError) firstError = msg;
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

      if (added > 0) {
        Alert.alert(
          "Queue",
          added === queuable.length
            ? `${added} tracks added to your Spotify queue.`
            : `${added} of ${queuable.length} tracks added.${firstError ? " Some failed — try again in a minute if Spotify rate-limited." : ""}`,
        );
      }
      if (firstError && added === 0) {
        const isRateLimit = /429|rate limit/i.test(firstError);
        const isNoDevice =
          /NO_ACTIVE_DEVICE|404|no active device|permission/i.test(firstError);
        Alert.alert(
          "Queue",
          isRateLimit
            ? "Spotify rate limit. Wait about a minute and try again."
            : isNoDevice
              ? "Open the Spotify app and start playing any song. Then try Add to Queue again."
              : firstError,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isRateLimit = /429|rate limit/i.test(msg);
      const isNoDevice = /NO_ACTIVE_DEVICE|404|no active device|permission/i.test(msg);
      Alert.alert(
        "Queue",
        isRateLimit
          ? "Spotify rate limit. Wait about a minute and try again."
          : isNoDevice
            ? "Open the Spotify app and start playing any song. Then try Add to Queue again."
            : msg || "Could not add tracks. Try again in a moment.",
      );
    } finally {
      setQueuingAll(null);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (connectionState === "unknown") {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  if (connectionState === "disconnected") {
    return (
      <ScrollView
        style={[styles.container, { paddingTop: insets.top + 16 }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.connectCard}>
          <View style={styles.connectIconWrap}>
            <FontAwesome name="calendar" size={32} color={theme.primary} />
          </View>
          <Text style={styles.connectTitle}>Connect Your Calendar</Text>
          <Text style={styles.connectSubtitle}>
            Tempr will read your upcoming events and recommend playlists
            10 minutes before each one, based on the event's vibe.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.connectButton,
              pressed && styles.connectButtonPressed,
            ]}
            onPress={handleConnect}
          >
            <FontAwesome name="calendar-plus-o" size={16} color="#fff" />
            <Text style={styles.connectButtonText}>
              Connect Apple Calendar
            </Text>
          </Pressable>
        </View>

        <View style={styles.featureList}>
          {[
            {
              icon: "clock-o" as const,
              title: "10-min heads up",
              desc: "Get a notification with your playlist before every event.",
            },
            {
              icon: "magic" as const,
              title: "AI mood detection",
              desc: "Event titles are analyzed to match the perfect vibe.",
            },
            {
              icon: "history" as const,
              title: "Recommendation history",
              desc: "All past playlists saved here for easy replay.",
            },
          ].map((f) => (
            <View style={styles.featureRow} key={f.title}>
              <View style={styles.featureIconWrap}>
                <FontAwesome
                  name={f.icon}
                  size={16}
                  color={theme.primary}
                />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <Text style={styles.subtitle}>
            {recommendations.length > 0
              ? `${recommendations.length} recommendation${recommendations.length > 1 ? "s" : ""}`
              : "Pull to refresh"}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.scanButton,
            pressed && styles.scanButtonPressed,
            scanning && styles.scanButtonDisabled,
          ]}
          onPress={handleScan}
          disabled={scanning}
        >
          {scanning ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <FontAwesome name="refresh" size={13} color="#fff" />
              <Text style={styles.scanButtonText}>Scan</Text>
            </>
          )}
        </Pressable>
      </View>

      {upcomingEvents.length > 0 && (
        <View style={styles.upcomingSection}>
          <Text style={styles.sectionTitle}>Upcoming Events</Text>
          {upcomingEvents.slice(0, 5).map((event) => {
            const hasRec = recommendations.some(
              (r) => r.eventId === event.id,
            );
            return (
              <View style={styles.eventRow} key={event.id}>
                <View style={styles.eventTimeBadge}>
                  <Text style={styles.eventTimeText}>
                    {formatEventTime(event.startDate)}
                  </Text>
                  <Text style={styles.eventDateText}>
                    {formatEventDate(event.startDate)}
                  </Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  {event.location ? (
                    <Text style={styles.eventLocation} numberOfLines={1}>
                      {event.location}
                    </Text>
                  ) : null}
                </View>
                {hasRec ? (
                  <View style={styles.recBadge}>
                    <FontAwesome
                      name="music"
                      size={10}
                      color={theme.primary}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {recommendations.length === 0 && !scanning ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <FontAwesome
              name="calendar-check-o"
              size={36}
              color={theme.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>No recommendations yet</Text>
          <Text style={styles.emptySubtitle}>
            {upcomingEvents.length > 0
              ? 'Tap "Scan" to generate playlists for your upcoming events.'
              : "Your upcoming events will appear here with curated playlists."}
          </Text>
        </View>
      ) : null}

      {recommendations.length > 0 && (
        <View style={styles.recSection}>
          <Text style={styles.sectionTitle}>Recommended Playlists</Text>
          {recommendations.map((rec) => {
            const isExpanded = expandedId === rec.id;
            const eventDate = new Date(rec.eventStartDate);
            const isPast = eventDate.getTime() < Date.now();

            return (
              <View style={styles.card} key={rec.id}>
                <Pressable
                  style={({ pressed }) => [
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => toggleExpand(rec.id)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardEventIndicator}>
                      <FontAwesome
                        name="calendar"
                        size={14}
                        color={isPast ? theme.textMuted : theme.primary}
                      />
                    </View>
                    <View style={styles.cardHeaderContent}>
                      <Text style={styles.cardEventTitle} numberOfLines={2}>
                        {rec.eventTitle}
                      </Text>
                      <View style={styles.cardMeta}>
                        <Text style={styles.cardMetaTime}>
                          {formatEventDate(eventDate)} ·{" "}
                          {formatEventTime(eventDate)}
                        </Text>
                        {isPast && (
                          <View style={styles.pastBadge}>
                            <Text style={styles.pastBadgeText}>Past</Text>
                          </View>
                        )}
                      </View>
                      {rec.eventLocation ? (
                        <Text
                          style={styles.cardLocation}
                          numberOfLines={1}
                        >
                          {rec.eventLocation}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleDelete(rec)}
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

                  <View style={styles.cardSongPreview}>
                    <FontAwesome
                      name="music"
                      size={10}
                      color={theme.textMuted}
                    />
                    <Text style={styles.cardSongCount}>
                      {rec.songs.length} tracks
                    </Text>
                    <Text style={styles.cardDot}>·</Text>
                    <Text
                      style={styles.cardReasoning}
                      numberOfLines={1}
                    >
                      {rec.reasoning}
                    </Text>
                  </View>

                  <FontAwesome
                    name={isExpanded ? "chevron-up" : "chevron-down"}
                    size={10}
                    color={theme.textMuted}
                    style={styles.chevron}
                  />
                </Pressable>

                {isExpanded && (
                  <View style={styles.expandedContent}>
                    <View style={styles.reasoningBox}>
                      <FontAwesome
                        name="lightbulb-o"
                        size={12}
                        color={theme.primaryLight}
                      />
                      <Text style={styles.reasoningText}>
                        {rec.reasoning}
                      </Text>
                    </View>

                    <View style={styles.trackList}>
                      {rec.songs.map((song, i) => {
                        const parts = song.name.split(" - ");
                        const title = parts[0]?.trim() ?? song.name;
                        const artist = parts[1]?.trim();
                        const queueState = queuedSongs[`${rec.id}-${i}`];
                        return (
                          <View
                            style={styles.trackRow}
                            key={`${song.name}-${i}`}
                          >
                            <Text style={styles.trackIndex}>
                              {i + 1}
                            </Text>
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
                              <Text
                                style={styles.trackName}
                                numberOfLines={1}
                              >
                                {title}
                              </Text>
                              {artist ? (
                                <Text
                                  style={styles.trackArtist}
                                  numberOfLines={1}
                                >
                                  {artist}
                                </Text>
                              ) : null}
                            </View>
                            {queueState ? (
                              queueState === "queuing" ? (
                                <ActivityIndicator
                                  size={12}
                                  color={theme.primary}
                                />
                              ) : (
                                <FontAwesome
                                  name={
                                    queueState === "queued" ? "check" : "times"
                                  }
                                  size={12}
                                  color={
                                    queueState === "queued"
                                      ? theme.success
                                      : theme.danger
                                  }
                                />
                              )
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    {(() => {
                      const allKeys = rec.songs.map((_, i) => `${rec.id}-${i}`);
                      const queuingCount = allKeys.filter(
                        (k) => queuedSongs[k] === "queuing",
                      ).length;
                      const isAdding =
                        queuingAll === rec.id || queuingCount > 0;
                      const allQueued =
                        !isAdding &&
                        rec.songs.some(
                          (_, i) => queuedSongs[`${rec.id}-${i}`] === "queued",
                        );
                      return (
                        <Pressable
                          style={({ pressed }) => [
                            styles.addAllButton,
                            pressed && styles.addAllButtonPressed,
                            isAdding && styles.addAllButtonDisabled,
                            allQueued && styles.addAllButtonDone,
                          ]}
                          onPress={() => handleAddAllToQueue(rec)}
                          disabled={isAdding}
                        >
                          {isAdding ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <FontAwesome
                              name={allQueued ? "check" : "play"}
                              size={13}
                              color="#fff"
                            />
                          )}
                          <Text style={styles.addAllButtonText}>
                            {allQueued
                              ? "Added to Queue"
                              : isAdding
                                ? "Adding..."
                                : "Add All to Queue"}
                          </Text>
                        </Pressable>
                      );
                    })()}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    backgroundColor: "transparent",
  },
  headerLeft: {
    flex: 1,
    backgroundColor: "transparent",
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
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    marginTop: 4,
  },
  scanButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.textSecondary,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  upcomingSection: {
    marginBottom: 28,
    backgroundColor: "transparent",
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    gap: 12,
  },
  eventTimeBadge: {
    backgroundColor: theme.primaryMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 60,
  },
  eventTimeText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.primary,
  },
  eventDateText: {
    fontSize: 10,
    color: theme.primaryLight,
    marginTop: 2,
    fontWeight: "500",
  },
  eventInfo: {
    flex: 1,
    backgroundColor: "transparent",
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
  },
  eventLocation: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 2,
  },
  recBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  recSection: {
    backgroundColor: "transparent",
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 16,
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardHeader: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 8,
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: "transparent",
  },
  cardEventIndicator: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  cardEventTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.2,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 8,
    backgroundColor: "transparent",
  },
  cardMetaTime: {
    fontSize: 13,
    color: theme.primary,
    fontWeight: "600",
  },
  pastBadge: {
    backgroundColor: theme.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pastBadgeText: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  cardLocation: {
    fontSize: 12,
    color: theme.textMuted,
    marginTop: 4,
  },
  cardSongPreview: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 6,
    backgroundColor: "transparent",
  },
  cardSongCount: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "500",
  },
  cardDot: {
    fontSize: 12,
    color: theme.textMuted,
  },
  cardReasoning: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "400",
    flex: 1,
  },
  chevron: {
    alignSelf: "center",
    paddingBottom: 12,
  },
  expandedContent: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.surfaceBorder,
    backgroundColor: "transparent",
  },
  reasoningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    backgroundColor: theme.primaryMuted,
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 10,
  },
  reasoningText: {
    fontSize: 13,
    color: theme.primaryLight,
    lineHeight: 19,
    flex: 1,
    fontWeight: "500",
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
    paddingTop: 8,
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
  addAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.primary,
    marginHorizontal: 12,
    marginVertical: 12,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addAllButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  addAllButtonDisabled: {
    opacity: 0.6,
  },
  addAllButtonDone: {
    backgroundColor: theme.success,
  },
  addAllButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  connectCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 28,
    marginTop: 8,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    alignItems: "center",
  },
  connectIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  connectTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  connectSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  connectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 22,
    gap: 10,
  },
  connectButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  connectButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  featureList: {
    gap: 12,
    backgroundColor: "transparent",
  },
  featureRow: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    gap: 14,
    alignItems: "flex-start",
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  featureContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.text,
  },
  featureDesc: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
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
});
