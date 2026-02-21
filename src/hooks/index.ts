import { useCallback, useState } from 'react';
import { useAuthStore, useQueueStore } from '../store';
import type { ContextSignals, GeneratedQueue } from '../types';

// ── useSpotifyAuth ────────────────────────────────────────────────────────────

export function useSpotifyAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const setSpotifyToken = useAuthStore((s) => s.setSpotifyToken);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    try {
      // TODO: Implement Spotify OAuth via expo-auth-session
      // const result = await AuthSession.startAsync({ authUrl });
      // setSpotifyToken(result.params.access_token);
      console.warn('Spotify OAuth not yet implemented');
    } finally {
      setIsLoading(false);
    }
  }, [setSpotifyToken]);

  return { signIn, isLoading };
}

// ── useContextSignals ─────────────────────────────────────────────────────────

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export function useContextSignals() {
  const [signals, setSignals] = useState<ContextSignals | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async (): Promise<ContextSignals | null> => {
    setIsLoading(true);
    try {
      const ctx: ContextSignals = { timeOfDay: getTimeOfDay() };
      // TODO: Add weather (openweather) and calendar signals
      setSignals(ctx);
      return ctx;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { signals, isLoading, refresh };
}

// ── useQueueGeneration ────────────────────────────────────────────────────────

function makeStubQueue(title: string, source: string): GeneratedQueue {
  return {
    id: `${source}-${Date.now()}`,
    tracks: [],
    moodProfile: {
      valence: 0.5,
      energy: 0.5,
      tempo: 120,
      danceability: 0.5,
      source: source as GeneratedQueue['moodProfile']['source'],
    },
    createdAt: new Date().toISOString(),
    source,
    totalDurationMs: 0,
    title,
  };
}

export function useQueueGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const setCurrentQueue = useQueueStore((s) => s.setCurrentQueue);

  const generateFromContext = useCallback(
    async (ctx: ContextSignals): Promise<GeneratedQueue> => {
      setIsGenerating(true);
      try {
        // TODO: Call generateContextualQueue from queue-generator service
        const queue = makeStubQueue(`${ctx.timeOfDay} Queue`, 'app-prompted');
        setCurrentQueue(queue);
        return queue;
      } finally {
        setIsGenerating(false);
      }
    },
    [setCurrentQueue]
  );

  const generateFromChat = useCallback(
    async (prompt: string): Promise<GeneratedQueue> => {
      setIsGenerating(true);
      try {
        // TODO: Call generateChatQueue from queue-generator service
        const queue = makeStubQueue(prompt, 'user-chat');
        setCurrentQueue(queue);
        return queue;
      } finally {
        setIsGenerating(false);
      }
    },
    [setCurrentQueue]
  );

  const generateFromVideo = useCallback(
    async (_uri: string): Promise<GeneratedQueue> => {
      setIsGenerating(true);
      try {
        // TODO: Call generateVideoQueue from queue-generator service
        const queue = makeStubQueue('Video Queue', 'user-video');
        setCurrentQueue(queue);
        return queue;
      } finally {
        setIsGenerating(false);
      }
    },
    [setCurrentQueue]
  );

  return { generateFromContext, generateFromChat, generateFromVideo, isGenerating };
}
