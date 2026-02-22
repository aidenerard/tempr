import { Text, View } from "@/components/Themed";
import { theme } from "@/constants/Colors";
import { useAuth } from "@/lib/AuthContext";
import {
  formatEventDate,
  formatEventTime,
  getCalendarPermissionStatus,
  getUpcomingEvents,
  requestCalendarPermission,
  type CalendarEvent,
} from "@/lib/calendar";
import {
  requestNotificationPermission,
  scanAndScheduleUpcomingEvents,
} from "@/lib/calendarNotifications";
import {
  deleteRecommendation,
  loadRecommendations,
  type CalendarRecommendation,
} from "@/lib/calendarStorage";
import { addToQueue, getAvailableDevices } from "@/lib/spotify";
import { FontAwesome } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ConnectionState = "unknown" | "disconnected" | "connected";

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { spotifyToken, signOut } = useAuth();
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
  const scanInProgress = useRef(false);

  const loadData = useCallback(async () => {
    const hasPermission = await getCalendarPermissionStatus();
    setConnectionState(hasPermission ? "connected" : "disconnected");

    if (hasPermission) {
      const [recs, events] = await Promise.all([
        loadRecommendations(),
        getUpcomingEvents(168),
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
    let added = 0;
    let noDeviceError = false;
    let permissionsError = false;
    try {
      try {
        const devices = await getAvailableDevices(spotifyToken);
        if (devices.length === 0) {
          setQueuingAll(null);
          Alert.alert(
            "No Spotify Device",
            "Open Spotify on your phone, computer, or speaker and start playing something, then try again.",
          );
          return;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("401") || msg.toLowerCase().includes("permissions")) {
          setQueuingAll(null);
          Alert.alert(
            "Permissions Needed",
            "Please sign out and sign back in to enable adding tracks to your Spotify queue.",
            [
              { text: "OK" },
              { text: "Sign Out", onPress: () => signOut() },
            ],
          );
          return;
        }
      }
      const { searchTracks } = await import("@/lib/spotify");
      for (const song of rec.songs) {
        try {
          const parts = song.name.split(" - ").map((p) => p.trim());
          const query =
            parts.length > 1 ? `${parts[0]} ${parts[1]}` : song.name;
          let results = await searchTracks(spotifyToken, query, 3);
          if (!results[0] && parts.length > 1) {
            results = await searchTracks(spotifyToken, `${parts[1]} ${parts[0]}`, 3);
          }
          if (results[0]) {
            await addToQueue(spotifyToken, results[0].uri);
            added++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("401") || msg.toLowerCase().includes("permissions")) {
            permissionsError = true;
            break;
          }
          if (
            msg.includes("NO_ACTIVE_DEVICE") ||
            msg.includes("404") ||
            msg.toLowerCase().includes("device")
          ) {
            noDeviceError = true;
            break;
          }
          if (msg.includes("403") || msg.toLowerCase().includes("premium")) {
            noDeviceError = true;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    } finally {
      setQueuingAll(null);
    }
    if (permissionsError) {
      Alert.alert(
        "Permissions Needed",
        "Please sign out and sign back in to enable adding tracks to your Spotify queue.",
        [
          { text: "OK" },
          { text: "Sign Out", onPress: () => signOut() },
        ],
      );
    } else if (noDeviceError || (added === 0 && rec.songs.length > 0)) {
      Alert.alert(
        "Couldn't Add to Queue",
        "Open Spotify and start playing on a device first. Add to queue also requires Spotify Premium.",
      );
    } else if (added > 0) {
      Alert.alert("Added to Queue", `${added} tracks added to your Spotify queue.`);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getEventEmoji = (title: string): string => {
    const t = title.toLowerCase();
    if (t.includes("meeting") || t.includes("call") || t.includes("sync")) return "📅";
    if (t.includes("workout") || t.includes("gym") || t.includes("run")) return "💪";
    if (t.includes("dinner") || t.includes("lunch") || t.includes("coffee")) return "☕";
    if (t.includes("birthday") || t.includes("party")) return "🎉";
    if (t.includes("flight") || t.includes("travel") || t.includes("trip")) return "✈️";
    if (t.includes("interview")) return "🎯";
    return "📌";
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
        style={[styles.container, { paddingTop: insets.top + 20 }]}
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
            <FontAwesome name="calendar-plus-o" size={18} color="#fff" />
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
                  size={18}
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
      style={[styles.container, { paddingTop: insets.top + 20 }]}
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
              <FontAwesome name="refresh" size={14} color="#fff" />
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
                <Text style={styles.eventEmoji}>{getEventEmoji(event.title)}</Text>
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
                      <Text style={styles.cardEventEmoji}>
                        {getEventEmoji(rec.eventTitle)}
                      </Text>
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
                          </View>
                        );
                      })}
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.addAllButton,
                        pressed && styles.addAllButtonPressed,
                        queuingAll === rec.id && styles.addAllButtonDisabled,
                      ]}
                      onPress={() => handleAddAllToQueue(rec)}
                      disabled={queuingAll === rec.id}
                    >
                      {queuingAll === rec.id ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <FontAwesome
                            name="play"
                            size={15}
                            color="#fff"
                          />
                          <Text style={styles.addAllButtonText}>
                            Add All to Queue
                          </Text>
                        </>
                      )}
                    </Pressable>
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
    paddingHorizontal: 24,
    paddingBottom: 48,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    backgroundColor: "transparent",
  },
  headerLeft: {
    flex: 1,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
    lineHeight: 36,
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
  eventEmoji: {
    fontSize: 20,
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
    padding: 20,
    paddingBottom: 12,
    gap: 14,
    alignItems: "flex-start",
    backgroundColor: "transparent",
  },
  cardEventIndicator: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  cardEventEmoji: {
    fontSize: 22,
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
    marginHorizontal: 16,
    marginVertical: 14,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  addAllButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  addAllButtonDisabled: {
    opacity: 0.6,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
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
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    gap: 16,
    alignItems: "flex-start",
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
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
