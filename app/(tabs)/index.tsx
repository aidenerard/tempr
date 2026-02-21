import { StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Text, View } from "@/components/Themed";
import { useAuth } from "@/lib/AuthContext";
import { FontAwesome } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/Colors";
import { useContextMonitor } from "@/lib/useContextMonitor";

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
  const { pendingQueue, isChecking } = useContextMonitor();

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

      {pendingQueue && (
        <Pressable
          style={({ pressed }) => [
            styles.promptedCard,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => router.push("/prompted-queue")}
        >
          <View style={styles.promptedGlow} />
          <View style={styles.promptedHeader}>
            <Text style={styles.promptedEmoji}>
              {pendingQueue.vibe.emoji}
            </Text>
            <View style={styles.promptedBadge}>
              <Text style={styles.promptedBadgeText}>For You</Text>
            </View>
          </View>
          <Text style={styles.promptedTitle}>{pendingQueue.vibe.label}</Text>
          <Text style={styles.promptedSubtitle}>
            {pendingQueue.vibe.description}
          </Text>
          <View style={styles.promptedMeta}>
            <Text style={styles.promptedMetaText}>
              {pendingQueue.tracks.length} tracks · ~
              {pendingQueue.totalDurationMin} min
            </Text>
            <FontAwesome name="chevron-right" size={12} color={theme.primary} />
          </View>
        </Pressable>
      )}

      {isChecking && !pendingQueue && (
        <View style={styles.checkingCard}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={styles.checkingText}>
            Checking your vibe...
          </Text>
        </View>
      )}

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
  promptedCard: {
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
    overflow: "hidden",
  },
  promptedGlow: {
    position: "absolute",
    top: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.primaryMuted,
  },
  promptedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    backgroundColor: "transparent",
  },
  promptedEmoji: {
    fontSize: 28,
  },
  promptedBadge: {
    backgroundColor: theme.primaryMuted,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  promptedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  promptedTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.3,
  },
  promptedSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 4,
    lineHeight: 19,
  },
  promptedMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    backgroundColor: "transparent",
  },
  promptedMetaText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "500",
  },
  checkingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  checkingText: {
    fontSize: 13,
    color: theme.textSecondary,
    fontWeight: "500",
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
