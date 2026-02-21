import { StyleSheet, Pressable, Image } from "react-native";
import { Text, View } from "@/components/Themed";
import { useAuth } from "@/lib/AuthContext";
import { FontAwesome } from "@expo/vector-icons";

export default function HomeScreen() {
  const { session, signOut } = useAuth();

  const user = session?.user;
  const spotifyData = user?.user_metadata;
  const avatarUrl = spotifyData?.avatar_url || spotifyData?.picture;
  const displayName = spotifyData?.full_name || spotifyData?.name || user?.email;

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <FontAwesome name="user" size={32} color="#999" />
          </View>
        )}
        <Text style={styles.greeting}>Hey, {displayName}</Text>
        <Text style={styles.subtitle}>Your Spotify account is connected</Text>
      </View>

      <View style={styles.card}>
        <FontAwesome name="check-circle" size={24} color="#1DB954" />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Spotify Connected</Text>
          <Text style={styles.cardDescription}>
            Ready to generate personalized queues
          </Text>
        </View>
      </View>

      <View style={styles.spacer} />

      <Pressable
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.signOutPressed,
        ]}
        onPress={signOut}
      >
        <FontAwesome name="sign-out" size={18} color="#ff4444" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.5,
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(29, 185, 84, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(29, 185, 84, 0.2)",
  },
  cardContent: {
    marginLeft: 16,
    backgroundColor: "transparent",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cardDescription: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  spacer: {
    flex: 1,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 68, 68, 0.3)",
    marginBottom: 32,
  },
  signOutPressed: {
    opacity: 0.7,
  },
  signOutText: {
    color: "#ff4444",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
});
