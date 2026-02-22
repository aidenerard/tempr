import React, { createContext, useContext, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const SPOTIFY_TOKEN_KEY = "tempr_spotify_token";

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.provider_token) {
        setSpotifyToken(session.provider_token);
        AsyncStorage.setItem(SPOTIFY_TOKEN_KEY, session.provider_token);
      } else {
        AsyncStorage.getItem(SPOTIFY_TOKEN_KEY).then((token) => {
          if (token) setSpotifyToken(token);
        });
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.provider_token) {
        setSpotifyToken(session.provider_token);
        AsyncStorage.setItem(SPOTIFY_TOKEN_KEY, session.provider_token);
      } else if (session) {
        AsyncStorage.getItem(SPOTIFY_TOKEN_KEY).then((token) => {
          if (token) setSpotifyToken(token);
        });
      }
      if (!session) {
        setSpotifyToken(null);
        AsyncStorage.removeItem(SPOTIFY_TOKEN_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshSpotifyToken = async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return false;
    if (data.session.provider_token) {
      setSpotifyToken(data.session.provider_token);
      await AsyncStorage.setItem(SPOTIFY_TOKEN_KEY, data.session.provider_token);
      return true;
    }
    return false;
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(SPOTIFY_TOKEN_KEY);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, spotifyToken, loading, signOut, refreshSpotifyToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
