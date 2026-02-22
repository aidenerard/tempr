import { StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Text, View } from "@/components/Themed";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { FontAwesome } from "@expo/vector-icons";
import { Logo } from "@/components/Logo";
import { theme } from "@/constants/Colors";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = AuthSession.makeRedirectUri();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const handleSpotifyLogin = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "spotify",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          scopes:
            "user-read-email user-read-private streaming user-library-read user-library-modify user-top-read playlist-read-private playlist-modify-public playlist-modify-private user-read-playback-state user-modify-playback-state",
        },
      });

      if (error) throw error;

      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo
        );

        if (result.type === "success") {
          const url = new URL(result.url);
          const fragment = url.hash ? url.hash.substring(1) : "";
          const search = url.search ? url.search.substring(1) : "";
          const params = new URLSearchParams(fragment || search);
          console.log("[Login] redirect params:", Object.fromEntries(params));

          const errorCode = params.get("error");
          const errorDesc = params.get("error_description");
          if (errorCode) {
            Alert.alert("Auth Error", errorDesc || errorCode);
            return;
          }

          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const providerToken = params.get("provider_token");
          const providerRefreshToken = params.get("provider_refresh_token");

          if (providerToken) {
            await AsyncStorage.setItem("tempr_spotify_token", providerToken);
          }
          if (providerRefreshToken) {
            await AsyncStorage.setItem("tempr_spotify_refresh_token", providerRefreshToken);
          }

          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
    } catch (err: any) {
      Alert.alert("Login Error", err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgGlow} />

      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Logo size={120} />
        </View>
        <Text style={styles.title}>Tempr</Text>
        <Text style={styles.subtitle}>
          AI-powered music queues{"\n"}tailored to your vibe
        </Text>
      </View>

      <View style={styles.buttonCard}>
        <Pressable
          style={({ pressed }) => [
            styles.spotifyButton,
            pressed && styles.spotifyButtonPressed,
          ]}
          onPress={handleSpotifyLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <FontAwesome
                name="spotify"
                size={24}
                color="#fff"
                style={styles.buttonIcon}
              />
              <Text style={styles.buttonText}>Connect with Spotify</Text>
            </>
          )}
        </Pressable>

        <Text style={styles.disclaimer}>
          We only read your listening history to personalize your queues.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    backgroundColor: theme.bg,
  },
  bgGlow: {
    position: "absolute",
    top: "12%",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(204, 86, 35, 0.06)",
  },
  header: {
    alignItems: "center",
    marginBottom: 56,
    backgroundColor: "transparent",
  },
  logoWrap: {
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  title: {
    fontSize: 46,
    fontWeight: "900",
    color: theme.text,
    letterSpacing: -1.5,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 17,
    color: theme.textSecondary,
    marginTop: 12,
    textAlign: "center",
    lineHeight: 25,
  },
  buttonCard: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(204, 86, 35, 0.15)",
    alignItems: "center",
  },
  spotifyButton: {
    backgroundColor: "#1DB954",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 36,
    borderRadius: 18,
    width: "100%",
  },
  spotifyButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonIcon: {
    marginRight: 14,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  disclaimer: {
    marginTop: 24,
    fontSize: 13,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 24,
  },
});
