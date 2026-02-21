/**
 * Queue generation logic
 * Blends user's Spotify listening history with new recommendations
 * based on mood profile (from weather, calendar, chat, video, etc.)
 */

import type { SpotifyTrack, MoodProfile } from "./spotify";
import {
  getTopTracks,
  getAudioFeatures,
  getRecommendations,
} from "./spotify";

export interface QueueTrack extends SpotifyTrack {
  isFromHistory?: boolean;
}

const TARGET_QUEUE_DURATION_MS = 35 * 60 * 1000; // ~35 min
const AVG_TRACK_MS = 3.5 * 60 * 1000; // ~3.5 min avg
const TARGET_TRACK_COUNT = Math.ceil(TARGET_QUEUE_DURATION_MS / AVG_TRACK_MS);

/**
 * Generate a queue blending familiar tracks and new recommendations
 */
export async function generateQueue(
  accessToken: string,
  mood: Partial<MoodProfile>,
  options?: {
    historyRatio?: number; // 0-1, default 0.6 (60% from history)
    limit?: number;
  }
): Promise<QueueTrack[]> {
  const historyRatio = options?.historyRatio ?? 0.6;
  const limit = options?.limit ?? TARGET_TRACK_COUNT;
  const historyCount = Math.round(limit * historyRatio);
  const newCount = limit - historyCount;

  const topTracks = await getTopTracks(accessToken, 50, "medium_term");
  if (topTracks.length === 0) {
    return [];
  }

  const trackIds = topTracks.map((t) => t.id);
  const features = await getAudioFeatures(accessToken, trackIds);

  const scored = topTracks
    .map((t) => {
      const f = features.find((x) => x.id === t.id);
      if (!f) return { track: t, score: 0 };
      const score = moodMatchScore(f, mood);
      return { track: t, score };
    })
    .sort((a, b) => b.score - a.score);

  const fromHistory = scored
    .slice(0, historyCount)
    .map(({ track }) => ({ ...track, isFromHistory: true }));

  const seedIds = fromHistory.slice(0, 5).map((t) => t.id);
  const targetFeatures: Partial<MoodProfile> = {
    valence: mood.valence,
    energy: mood.energy,
    danceability: mood.danceability,
    tempo: mood.tempo,
  };

  const recommended = await getRecommendations(
    accessToken,
    seedIds,
    targetFeatures,
    newCount
  );

  const newTracks = recommended.map((t) => ({ ...t, isFromHistory: false }));

  const combined = [...fromHistory, ...newTracks];
  return shuffleArray(combined).slice(0, limit);
}

function moodMatchScore(
  f: { valence: number; energy: number; danceability?: number; tempo?: number },
  mood: Partial<MoodProfile>
): number {
  let score = 1;
  if (mood.valence != null)
    score *= 1 - Math.abs(f.valence - mood.valence);
  if (mood.energy != null) score *= 1 - Math.abs(f.energy - mood.energy);
  if (mood.danceability != null && f.danceability != null)
    score *= 1 - Math.abs(f.danceability - mood.danceability);
  if (mood.tempo != null && f.tempo != null) {
    const tempoDiff = Math.abs(f.tempo - mood.tempo) / 120;
    score *= Math.max(0, 1 - tempoDiff);
  }
  return score;
}

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
