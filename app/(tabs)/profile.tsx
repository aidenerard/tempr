import { StyleSheet, ScrollView, Pressable, Image } from "react-native";
import { Text, View } from "@/components/Themed";
import { useAuth } from "@/lib/AuthContext";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/Colors";

export default function ProfileScreen() {
  const { session, spotifyToken, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const user = session?.user;
  const meta = user?.user_metadata;
  const avatarUrl = meta?.avatar_url || meta?.picture;
  const displayName = meta?.full_name || meta?.name || user?.email || "User";
  const email = user?.email;

  const isSpotifyConnected = !!spotifyToken;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Profile</Text>

      <View style={styles.profileCard}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <FontAwesome name="user" size={28} color={theme.textMuted} />
          </View>
        )}
        <View style={styles.profileInfo}>
          <Text style={styles.displayName}>{displayName}</Text>
          {email && <Text style={styles.email}>{email}</Text>}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Connections</Text>

      <View style={styles.connectionCard}>
        <View style={styles.connectionRow}>
          <View style={styles.connectionIconWrap}>
            <FontAwesome name="spotify" size={20} color="#1DB954" />
          </View>
          <View style={styles.connectionInfo}>
            <Text style={styles.connectionName}>Spotify</Text>
            <Text style={styles.connectionStatus}>
              {isSpotifyConnected ? "Connected" : "Not connected"}
            </Text>
          </View>
          <View
            style={[
              styles.statusDot,
              isSpotifyConnected ? styles.statusDotGreen : styles.statusDotRed,
            ]}
          />
        </View>
      </View>

      <Text style={styles.sectionTitle}>App</Text>

      <View style={styles.menuCard}>
        <View style={styles.menuRow}>
          <FontAwesome name="info-circle" size={16} color={theme.textSecondary} />
          <Text style={styles.menuLabel}>Version</Text>
          <Text style={styles.menuValue}>1.0.0</Text>
        </View>
        <View style={styles.menuDivider} />
        <View style={styles.menuRow}>
          <FontAwesome name="fire" size={16} color={theme.primary} />
          <Text style={styles.menuLabel}>Powered by</Text>
          <Text style={styles.menuValue}>Gemini + Spotify</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutPressed,
        ]}
        onPress={signOut}
      >
        <FontAwesome name="sign-out" size={16} color={theme.danger} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
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
    paddingBottom: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 28,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
    backgroundColor: "transparent",
  },
  displayName: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.text,
  },
  email: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  connectionCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 28,
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  connectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(29, 185, 84, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  connectionInfo: {
    flex: 1,
    marginLeft: 14,
    backgroundColor: "transparent",
  },
  connectionName: {
    fontSize: 15,
    fontWeight: "600",
    color: theme.text,
  },
  connectionStatus: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotGreen: {
    backgroundColor: theme.success,
  },
  statusDotRed: {
    backgroundColor: theme.danger,
  },
  menuCard: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 28,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "transparent",
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    fontWeight: "500",
  },
  menuValue: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.surfaceBorder,
    marginVertical: 14,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
    borderRadius: 14,
    backgroundColor: theme.dangerMuted,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
    gap: 10,
  },
  signOutPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  signOutText: {
    color: theme.danger,
    fontSize: 15,
    fontWeight: "700",
  },
});
