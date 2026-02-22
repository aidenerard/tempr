import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const SPOTIFY_TOKEN_KEY = "tempr_spotify_token";
const SPOTIFY_REFRESH_KEY = "tempr_spotify_refresh_token";

type AuthContextType = {
  session: Session | null;
  spotifyToken: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSpotifyToken: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  spotifyToken: null,
  loading: true,
  signOut: async () => {},
  refreshSpotifyToken: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load session and spotify token together before clearing loading state
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);

      // Always read from AsyncStorage — never trust session.provider_token,
      // Supabase may return a stale cached copy from its server.
      if (session) {
        const cached = await AsyncStorage.getItem(SPOTIFY_TOKEN_KEY);
        if (cached) setSpotifyToken(cached);
      }

      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        // Always read from AsyncStorage — login.tsx writes the verified fresh token there.
        // Never trust session.provider_token here; Supabase may return a stale cached copy.
        const cached = await AsyncStorage.getItem(SPOTIFY_TOKEN_KEY);
        if (cached) setSpotifyToken(cached);
      } else {
        setSpotifyToken(null);
        await AsyncStorage.removeItem(SPOTIFY_TOKEN_KEY);
        await AsyncStorage.removeItem(SPOTIFY_REFRESH_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshSpotifyToken = async (): Promise<boolean> => {
    try {
      const refreshToken = await AsyncStorage.getItem(SPOTIFY_REFRESH_KEY);
      if (!refreshToken) {
        console.warn("[Auth] No Spotify refresh token stored — user must re-login");
        return false;
      }

      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? "",
        }).toString(),
      });

      if (!res.ok) {
        console.error("[Auth] Spotify token refresh failed:", res.status);
        return false;
      }

      const data = await res.json();
      const newToken: string = data.access_token;
      setSpotifyToken(newToken);
      await AsyncStorage.setItem(SPOTIFY_TOKEN_KEY, newToken);

      // Spotify may rotate the refresh token
      if (data.refresh_token) {
        await AsyncStorage.setItem(SPOTIFY_REFRESH_KEY, data.refresh_token);
      }

      console.log("[Auth] Spotify token refreshed successfully");
      return true;
    } catch (e: any) {
      console.error("[Auth] refreshSpotifyToken error:", e.message);
      return false;
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(SPOTIFY_TOKEN_KEY);
    await AsyncStorage.removeItem(SPOTIFY_REFRESH_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, spotifyToken, loading, signOut, refreshSpotifyToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
