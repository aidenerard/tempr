import { create } from 'zustand';
import { supabase } from '../services/supabase';
import type { GeneratedQueue, SpotifyTrack } from '../types';

// ── Auth Store ────────────────────────────────────────────────────────────────

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  isLoading: boolean;
  spotifyToken: string | null;
  setSpotifyToken: (token: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userId: null,
  isLoading: true,
  spotifyToken: null,
  setSpotifyToken: (token) => set({ spotifyToken: token }),
}));

// Subscribe to Supabase auth changes
supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.setState({
    isAuthenticated: !!session?.user,
    userId: session?.user?.id ?? null,
    isLoading: false,
  });
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({
    isAuthenticated: !!session?.user,
    userId: session?.user?.id ?? null,
    isLoading: false,
  });
});

// ── Queue Store ───────────────────────────────────────────────────────────────

interface QueueState {
  currentQueue: GeneratedQueue | null;
  queueHistory: GeneratedQueue[];
  setCurrentQueue: (queue: GeneratedQueue) => void;
  clearQueue: () => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  currentQueue: null,
  queueHistory: [],
  setCurrentQueue: (queue) =>
    set((state) => ({
      currentQueue: queue,
      queueHistory: state.currentQueue
        ? [state.currentQueue, ...state.queueHistory].slice(0, 20)
        : state.queueHistory,
    })),
  clearQueue: () => set({ currentQueue: null }),
}));

// ── Discover Store ────────────────────────────────────────────────────────────

type DiscoverMode = 'genre' | 'history' | 'random';

interface DiscoverState {
  mode: DiscoverMode | null;
  tracks: SpotifyTrack[];
  setMode: (mode: DiscoverMode) => void;
  setTracks: (tracks: SpotifyTrack[]) => void;
  reset: () => void;
}

export const useDiscoverStore = create<DiscoverState>((set) => ({
  mode: null,
  tracks: [],
  setMode: (mode) => set({ mode }),
  setTracks: (tracks) => set({ tracks }),
  reset: () => set({ mode: null, tracks: [] }),
}));
