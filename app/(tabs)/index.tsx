import {
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Text, View } from "@/components/Themed";
import { useAuth } from "@/lib/AuthContext";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useState, useCallback } from "react";
import { theme } from "@/constants/Colors";
import {
  getCalendarPermissionStatus,
  getUpcomingEvents,
  formatEventTime,
  formatEventDate,
  type CalendarEvent,
} from "@/lib/calendar";
import { loadRecommendations } from "@/lib/calendarStorage";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const QUICK_VIBES = [
  { label: "Chill", icon: "moon-o" as const, prompt: "late night chill vibes" },
  { label: "Workout", icon: "bolt" as const, prompt: "high energy workout" },
  { label: "Focus", icon: "headphones" as const, prompt: "deep focus study session" },
  { label: "Drive", icon: "car" as const, prompt: "road trip with friends" },
  { label: "Sad", icon: "cloud" as const, prompt: "melancholic rainy day" },
  { label: "Party", icon: "star" as const, prompt: "party mode hype songs" },
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
            getUpcomingEvents(24),
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
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.name}>{firstName}</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <FontAwesome name="fire" size={28} color={theme.primary} />
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
          <FontAwesome name="magic" size={16} color="#fff" />
          <Text style={styles.heroButtonText}>Generate a Queue</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Quick Vibes</Text>
      <View style={styles.vibeGrid}>
        {QUICK_VIBES.map((vibe) => (
          <Pressable
            key={vibe.label}
            style={({ pressed }) => [
              styles.vibeCard,
              pressed && styles.vibeCardPressed,
            ]}
            onPress={() => router.push("/(tabs)/generate")}
          >
            <View style={styles.vibeIconWrap}>
              <FontAwesome name={vibe.icon} size={18} color={theme.primary} />
            </View>
            <Text style={styles.vibeLabel}>{vibe.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.calendarSectionHeader,
          pressed && styles.calendarSectionHeaderPressed,
        ]}
        onPress={() => router.push("/(tabs)/calendar")}
      >
        <View style={styles.calendarTitleRow}>
          <FontAwesome name="calendar" size={16} color={theme.primary} />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
            Calendar
          </Text>
        </View>
        <View style={styles.calendarSeeAll}>
          <Text style={styles.calendarSeeAllText}>
            {calendarConnected ? "See all" : "Connect"}
          </Text>
          <FontAwesome
            name="chevron-right"
            size={10}
            color={theme.primary}
          />
        </View>
      </Pressable>

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
          <View style={styles.calendarConnectIcon}>
            <FontAwesome
              name="calendar-plus-o"
              size={20}
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
            size={18}
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
              <View style={styles.calendarCardTimeBadge}>
                <Text style={styles.calendarCardTime}>
                  {formatEventTime(item.startDate)}
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
        <FontAwesome name="lightbulb-o" size={20} color={theme.primaryLight} />
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 28,
    backgroundColor: "transparent",
  },
  greeting: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  name: {
    fontSize: 32,
    fontWeight: "800",
    color: theme.text,
    marginTop: 2,
    letterSpacing: -0.5,
  },
  heroCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.primaryMuted,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.text,
    marginTop: 14,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
  heroButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 18,
    gap: 8,
  },
  heroButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  heroButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
    marginBottom: 14,
  },
  vibeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 28,
    backgroundColor: "transparent",
  },
  vibeCard: {
    width: "31%",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  vibeCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  vibeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  vibeLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.text,
  },
  calendarSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "transparent",
  },
  calendarSectionHeaderPressed: {
    opacity: 0.7,
  },
  calendarTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "transparent",
  },
  calendarSeeAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "transparent",
  },
  calendarSeeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.primary,
  },
  calendarLoadingWrap: {
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    backgroundColor: "transparent",
  },
  calendarConnectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    gap: 14,
  },
  calendarConnectCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  calendarConnectIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarConnectContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  calendarConnectTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.text,
  },
  calendarConnectSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  calendarEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    gap: 10,
  },
  calendarEmptyCardPressed: {
    opacity: 0.7,
  },
  calendarEmptyText: {
    fontSize: 13,
    color: theme.textMuted,
    fontWeight: "500",
  },
  calendarList: {
    paddingBottom: 28,
    gap: 10,
  },
  calendarCard: {
    width: 150,
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  calendarCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  calendarCardTimeBadge: {
    alignSelf: "flex-start",
    backgroundColor: theme.primaryMuted,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 10,
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
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    gap: 14,
    alignItems: "flex-start",
  },
  tipContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.primaryLight,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
  },
});
