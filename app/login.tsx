import { StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { Text, View } from "@/components/Themed";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { FontAwesome } from "@expo/vector-icons";
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
            "user-read-email user-read-private streaming user-library-read user-top-read playlist-read-private user-modify-playback-state user-read-playback-state",
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
          let accessToken = params.get("access_token");
          let refreshToken = params.get("refresh_token");
          let providerToken = params.get("provider_token");
          let providerRefreshToken = params.get("provider_refresh_token");
          let errorCode = params.get("error");
          let errorDesc = params.get("error_description");
          const raw = fragment || search;
          if (raw && (raw.startsWith("{") || raw.includes("{"))) {
            try {
              const parsed = (() => {
                try {
                  return JSON.parse(raw) as Record<string, string>;
                } catch {
                  return JSON.parse(
                    decodeURIComponent(raw),
                  ) as Record<string, string>;
                }
              })();
              accessToken = parsed.access_token ?? accessToken;
              refreshToken = parsed.refresh_token ?? refreshToken;
              providerToken = parsed.provider_token ?? providerToken;
              providerRefreshToken =
                parsed.provider_refresh_token ?? providerRefreshToken;
              errorCode = parsed.error ?? errorCode;
              errorDesc = parsed.error_description ?? errorDesc;
            } catch {
              /* keep URLSearchParams values */
            }
          }
          console.log("[Login] redirect params:", {
            hasAccessToken: !!accessToken,
            hasProviderToken: !!providerToken,
          });

          if (errorCode) {
            Alert.alert("Auth Error", errorDesc || errorCode);
            return;
          }

          if (providerToken) {
            await AsyncStorage.setItem("tempr_spotify_token", providerToken);
          }
          if (providerRefreshToken) {
            await AsyncStorage.setItem(
              "tempr_spotify_refresh_token",
              providerRefreshToken,
            );
          }
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
          if (!providerToken) {
            const { data } = await supabase.auth.getSession();
            const fromSession = data.session?.provider_token;
            if (fromSession) {
              await AsyncStorage.setItem("tempr_spotify_token", fromSession);
            }
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
        <View style={styles.iconWrap}>
          <FontAwesome name="fire" size={40} color={theme.primary} />
        </View>
        <Text style={styles.title}>Tempr</Text>
        <Text style={styles.subtitle}>
          AI-powered music queues{"\n"}tailored to your vibe
        </Text>
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
                size={22}
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
    padding: 28,
    backgroundColor: theme.bg,
  },
  bgGlow: {
    position: "absolute",
    top: "20%",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255, 107, 44, 0.06)",
  },
  header: {
    alignItems: "center",
    marginBottom: 64,
    backgroundColor: "transparent",
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 44,
    fontWeight: "900",
    color: theme.text,
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 10,
    textAlign: "center",
    lineHeight: 23,
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  spotifyButton: {
    backgroundColor: "#1DB954",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: "100%",
  },
  spotifyButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  disclaimer: {
    marginTop: 20,
    fontSize: 12,
    color: theme.textMuted,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
