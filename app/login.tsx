import { StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Text, View } from "@/components/Themed";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { FontAwesome } from "@expo/vector-icons";

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
            "user-read-email user-read-private streaming user-library-read user-top-read playlist-read-private",
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

          const errorCode = params.get("error");
          const errorDesc = params.get("error_description");
          if (errorCode) {
            Alert.alert("Auth Error", errorDesc || errorCode);
            return;
          }

          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const providerToken = params.get("provider_token");

          if (providerToken) {
            await AsyncStorage.setItem("tempr_spotify_token", providerToken);
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
      <View style={styles.header}>
        <FontAwesome name="music" size={64} color="#1DB954" />
        <Text style={styles.title}>Tempr</Text>
        <Text style={styles.subtitle}>Your AI-powered music queue</Text>
      </View>

      <View style={styles.buttonContainer}>
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
      </View>

      <Text style={styles.footer}>
        Sign in to start generating personalized queues
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 60,
  },
  title: {
    fontSize: 48,
    fontWeight: "800",
    marginTop: 16,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.6,
    marginTop: 8,
  },
  buttonContainer: {
    width: "100%",
    paddingHorizontal: 16,
  },
  spotifyButton: {
    backgroundColor: "#1DB954",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 50,
    width: "100%",
  },
  spotifyButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  footer: {
    marginTop: 32,
    fontSize: 14,
    opacity: 0.4,
    textAlign: "center",
  },
});
