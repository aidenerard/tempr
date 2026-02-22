import { Logo } from "@/components/Logo";
import { Text, View } from "@/components/Themed";
import { theme } from "@/constants/Colors";
import { useAuth } from "@/lib/AuthContext";
import {
  formatEventDate,
  formatEventTime,
  getCalendarPermissionStatus,
  getUpcomingEvents,
  type CalendarEvent,
} from "@/lib/calendar";
import { loadRecommendations } from "@/lib/calendarStorage";
import { FontAwesome } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getTimeUntilNextEvent(events: CalendarEvent[]): string | null {
  if (events.length === 0) return null;
  const now = Date.now();
  const next = events[0].startDate.getTime();
  if (next <= now) return null;
  const mins = Math.round((next - now) / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function getEventEmoji(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("meeting") || t.includes("call") || t.includes("sync")) return "📅";
  if (t.includes("workout") || t.includes("gym") || t.includes("run")) return "💪";
  if (t.includes("dinner") || t.includes("lunch") || t.includes("coffee")) return "☕";
  if (t.includes("birthday") || t.includes("party")) return "🎉";
  if (t.includes("flight") || t.includes("travel") || t.includes("trip")) return "✈️";
  if (t.includes("interview")) return "🎯";
  return "📌";
}

function getWeekDaysWithEvents(events: CalendarEvent[]): Set<number> {
  const days = new Set<number>();
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  for (const e of events) {
    const d = Math.floor((e.startDate.getTime() - startOfWeek.getTime()) / 86400000);
    if (d >= 0 && d < 7) days.add(d);
  }
  return days;
}

const QUICK_VIBES = [
  {
    label: "Chill",
    icon: "moon-o" as const,
    prompt: "late night chill vibes",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop",
  },
  {
    label: "Workout",
    icon: "bolt" as const,
    prompt: "high energy workout",
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop",
  },
  {
    label: "Focus",
    icon: "headphones" as const,
    prompt: "deep focus study session",
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop",
  },
  {
    label: "Drive",
    icon: "car" as const,
    prompt: "road trip with friends",
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=400&h=400&fit=crop",
  },
  {
    label: "Sad",
    icon: "cloud" as const,
    prompt: "melancholic rainy day",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=400&fit=crop",
  },
  {
    label: "Party",
    icon: "star" as const,
    prompt: "party mode hype songs",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=400&fit=crop",
  },
];

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [recCount, setRecCount] = useState(0);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setCalendarLoading(true);
        const hasPermission = await getCalendarPermissionStatus();
        setCalendarConnected(hasPermission);
        if (hasPermission) {
          const [events, recs] = await Promise.all([
            getUpcomingEvents(168),
            loadRecommendations(),
          ]);
          setCalendarEvents(events);
          setRecCount(recs.length);
        }
        setCalendarLoading(false);
      })();
    }, []),
  );

  const displayName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    "there";
  const firstName = displayName.split(" ")[0];

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 20 }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Logo size={44} />
          <Text style={styles.brandName}>Tempr</Text>
        </View>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.name}>{firstName}</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <Logo size={56} />
        <Text style={styles.heroTitle}>What's your vibe?</Text>
        <Text style={styles.heroSubtitle}>
          Tap Generate to create a personalized queue from your mood
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.heroButton,
            pressed && styles.heroButtonPressed,
          ]}
          onPress={() => router.push("/(tabs)/generate")}
        >
          <FontAwesome name="magic" size={18} color="#fff" />
          <Text style={styles.heroButtonText}>Generate a Queue</Text>
        </Pressable>
      </View>

      <View style={styles.vibesSection}>
        <View style={styles.vibesHeader}>
          <Text style={styles.sectionTitle}>Quick Vibes</Text>
          <Text style={styles.vibesTagline}>Set the mood in one tap</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.vibeScrollContent}
        >
          {QUICK_VIBES.map((vibe) => (
            <Pressable
              key={vibe.label}
              style={({ pressed }) => [
                styles.vibeCard,
                pressed && styles.vibeCardPressed,
              ]}
              onPress={() => router.push("/(tabs)/generate")}
            >
              <ImageBackground
                source={{ uri: vibe.image }}
                style={styles.vibeImage}
                imageStyle={styles.vibeImageStyle}
              >
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.85)"]}
                  locations={[0, 0.5, 1]}
                  style={styles.vibeGradient}
                />
                <View style={styles.vibeContent}>
                  <View style={styles.vibeIconWrap}>
                    <FontAwesome
                      name={vibe.icon}
                      size={22}
                      color={theme.primary}
                    />
                  </View>
                  <Text style={styles.vibeLabel}>{vibe.label}</Text>
                </View>
              </ImageBackground>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.calendarSectionHeader,
          pressed && styles.calendarSectionHeaderPressed,
        ]}
        onPress={() => router.push("/(tabs)/calendar")}
      >
        <View style={styles.calendarTitleRow}>
          <FontAwesome name="calendar" size={18} color={theme.primary} />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
            Calendar
          </Text>
          {calendarConnected && calendarEvents.length > 0 && (() => {
            const next = getTimeUntilNextEvent(calendarEvents);
            return (
              <View style={styles.calendarBadge}>
                <Text style={styles.calendarBadgeText}>
                  {next ? `Next in ${next}` : `${calendarEvents.length} events`}
                </Text>
              </View>
            );
          })()}
        </View>
        <View style={styles.calendarSeeAll}>
          <Text style={styles.calendarSeeAllText}>
            {calendarConnected ? "See all" : "Connect"}
          </Text>
          <FontAwesome
            name="chevron-right"
            size={12}
            color={theme.primary}
          />
        </View>
      </Pressable>

      {calendarConnected && calendarEvents.length > 0 && (
        <View style={styles.weekStrip}>
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => {
            const hasEvent = getWeekDaysWithEvents(calendarEvents).has(i);
            const isToday =
              new Date().getDay() === i;
            return (
              <View
                key={i}
                style={[
                  styles.weekDay,
                  hasEvent && styles.weekDayActive,
                  isToday && styles.weekDayToday,
                ]}
              >
                <Text
                  style={[
                    styles.weekDayText,
                    hasEvent && styles.weekDayTextActive,
                    isToday && styles.weekDayTextToday,
                  ]}
                >
                  {day}
                </Text>
                {hasEvent && <View style={styles.weekDayDot} />}
              </View>
            );
          })}
        </View>
      )}

      {calendarLoading ? (
        <View style={styles.calendarLoadingWrap}>
          <ActivityIndicator color={theme.primary} size="small" />
        </View>
      ) : !calendarConnected ? (
        <Pressable
          style={({ pressed }) => [
            styles.calendarConnectCard,
            pressed && styles.calendarConnectCardPressed,
          ]}
          onPress={() => router.push("/(tabs)/calendar")}
        >
          <View style={styles.calendarConnectGlow} />
          <View style={styles.calendarConnectIcon}>
            <FontAwesome
              name="calendar-plus-o"
              size={24}
              color={theme.primary}
            />
          </View>
          <View style={styles.calendarConnectContent}>
            <Text style={styles.calendarConnectTitle}>
              Connect your calendar
            </Text>
            <Text style={styles.calendarConnectSubtitle}>
              Get playlist recommendations before every event
            </Text>
            <View style={styles.calendarConnectFeatures}>
              <View style={styles.calendarFeaturePill}>
                <Text style={styles.calendarFeaturePillText}>10-min heads up</Text>
              </View>
              <View style={styles.calendarFeaturePill}>
                <Text style={styles.calendarFeaturePillText}>AI mood match</Text>
              </View>
            </View>
          </View>
        </Pressable>
      ) : calendarEvents.length === 0 ? (
        <Pressable
          style={({ pressed }) => [
            styles.calendarEmptyCard,
            pressed && styles.calendarEmptyCardPressed,
          ]}
          onPress={() => router.push("/(tabs)/calendar")}
        >
          <FontAwesome
            name="calendar-check-o"
            size={20}
            color={theme.textMuted}
          />
          <Text style={styles.calendarEmptyText}>
            No upcoming events{recCount > 0 ? ` · ${recCount} saved` : ""}
          </Text>
        </Pressable>
      ) : (
        <FlatList
          data={calendarEvents.slice(0, 8)}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.calendarList}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [
                styles.calendarCard,
                pressed && styles.calendarCardPressed,
              ]}
              onPress={() => router.push("/(tabs)/calendar")}
            >
              <View style={styles.calendarCardTop}>
                <View style={styles.calendarCardTimeBadge}>
                  <Text style={styles.calendarCardTime}>
                    {formatEventTime(item.startDate)}
                  </Text>
                </View>
                <Text style={styles.calendarCardEmoji}>
                  {getEventEmoji(item.title)}
                </Text>
              </View>
              <Text style={styles.calendarCardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.calendarCardDate}>
                {formatEventDate(item.startDate)}
              </Text>
              {item.location ? (
                <Text style={styles.calendarCardLocation} numberOfLines={1}>
                  {item.location}
                </Text>
              ) : null}
            </Pressable>
          )}
        />
      )}

      <View style={styles.tipCard}>
        <FontAwesome name="lightbulb-o" size={24} color={theme.primaryLight} />
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Pro tip</Text>
          <Text style={styles.tipText}>
            The more descriptive your prompt, the better. Try "late night coding
            session with lo-fi beats" instead of just "chill".
          </Text>
        </View>
      </View>
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
  },
  header: {
    marginBottom: 32,
    backgroundColor: "transparent",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  brandName: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
  },
  greeting: {
    fontSize: 17,
    color: theme.textSecondary,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  name: {
    fontSize: 34,
    fontWeight: "800",
    color: theme.text,
    marginTop: 4,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  heroCard: {
    backgroundColor: theme.surface,
    borderRadius: 24,
    padding: 28,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -48,
    right: -48,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: theme.primaryMuted,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: theme.text,
    marginTop: 18,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 15,
    color: theme.textSecondary,
    marginTop: 8,
    lineHeight: 22,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 22,
    gap: 10,
  },
  heroButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: theme.text,
    marginBottom: 18,
    letterSpacing: -0.2,
  },
  vibesSection: {
    marginBottom: 36,
    backgroundColor: "transparent",
  },
  vibesHeader: {
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  vibesTagline: {
    fontSize: 14,
    color: theme.textMuted,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  vibeScrollContent: {
    paddingRight: 24,
  },
  vibeCard: {
    width: 150,
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginRight: 14,
  },
  vibeCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
  vibeImage: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  vibeImageStyle: {
    borderRadius: 19,
  },
  vibeGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 19,
  },
  vibeContent: {
    zIndex: 1,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  vibeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  vibeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.4,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  calendarSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    paddingVertical: 4,
    backgroundColor: "transparent",
  },
  calendarSectionHeaderPressed: {
    opacity: 0.8,
  },
  calendarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    backgroundColor: "transparent",
  },
  calendarBadge: {
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  calendarBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.primary,
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  weekDay: {
    alignItems: "center",
    width: 36,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  weekDayActive: {
    backgroundColor: theme.primaryMuted,
  },
  weekDayToday: {
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "600",
    color: theme.textMuted,
  },
  weekDayTextActive: {
    color: theme.primary,
  },
  weekDayTextToday: {
    color: theme.text,
  },
  weekDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.primary,
    marginTop: 4,
  },
  calendarSeeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "transparent",
  },
  calendarSeeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.primary,
  },
  calendarLoadingWrap: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    backgroundColor: "transparent",
  },
  calendarConnectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    gap: 18,
    overflow: "hidden",
  },
  calendarConnectGlow: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primaryMuted,
    opacity: 0.6,
  },
  calendarConnectCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  calendarConnectIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarConnectContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  calendarConnectTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.1,
  },
  calendarConnectSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  calendarConnectFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  calendarFeaturePill: {
    backgroundColor: theme.primaryMuted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  calendarFeaturePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.primaryLight,
  },
  calendarEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    gap: 14,
  },
  calendarEmptyCardPressed: {
    opacity: 0.85,
  },
  calendarEmptyText: {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: "500",
  },
  calendarList: {
    paddingBottom: 32,
    gap: 12,
  },
  calendarCard: {
    width: 160,
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  calendarCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  calendarCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  calendarCardTimeBadge: {
    backgroundColor: theme.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  calendarCardEmoji: {
    fontSize: 18,
  },
  calendarCardTime: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.primary,
  },
  calendarCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
    lineHeight: 19,
    marginBottom: 6,
  },
  calendarCardDate: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  calendarCardLocation: {
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 3,
  },
  tipCard: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    gap: 18,
    alignItems: "flex-start",
  },
  tipContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.primaryLight,
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  tipText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 21,
  },
});
