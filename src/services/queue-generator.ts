/**
 * Queue generator - core orchestrator for contextual, video, and chat-based queue generation.
 * Combines context signals, mood profiles, and Spotify recommendations.
 */

import {
  MAX_QUEUE_DURATION_MS,
  MIN_QUEUE_DURATION_MS,
} from '@/constants';
import type {
  SpotifyTrack,
  MoodProfile,
  ContextSignals,
  GeneratedQueue,
  VideoAnalysis,
} from '@/types';
import { weatherToMoodSignal } from './openweather';
import { eventToMoodSignal } from './google-calendar';
import { getRecommendations, getRecentlyPlayed } from './spotify';
import { generateQueueFromPrompt } from './gemini';

/** Error thrown when queue generation fails */
export class QueueGeneratorError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'QueueGeneratorError';
  }
}

/**
 * Maps a mood profile to Spotify recommendation API parameters.
 * Pure function - no side effects.
 * @param mood - Mood profile with valence, energy, tempo, etc.
 * @returns Object suitable for Spotify getRecommendations target params
 */
export function moodToSpotifyParams(mood: MoodProfile): {
  targetValence?: number;
  targetEnergy?: number;
  targetTempo?: number;
  targetDanceability?: number;
  targetAcousticness?: number;
  seedGenres?: string[];
} {
  const params: Record<string, unknown> = {};
  if (mood.valence !== undefined) params.targetValence = mood.valence;
  if (mood.energy !== undefined) params.targetEnergy = mood.energy;
  if (mood.tempo !== undefined) params.targetTempo = mood.tempo;
  if (mood.danceability !== undefined) params.targetDanceability = mood.danceability;
  if (mood.acousticness !== undefined) params.targetAcousticness = mood.acousticness;
  if (mood.tags?.length) params.seedGenres = mood.tags.slice(0, 2);
  return params as {
    targetValence?: number;
    targetEnergy?: number;
    targetTempo?: number;
    targetDanceability?: number;
    targetAcousticness?: number;
    seedGenres?: string[];
  };
}

/**
 * Blends familiar and new tracks to target 30–40 min duration.
 * ~60% familiar, ~40% new.
 * Pure function - no side effects.
 * @param familiar - Tracks from listening history
 * @param newTracks - Newly recommended tracks
 * @param targetDurationMs - Target total duration (default: mid-range of MIN/MAX)
 * @returns Blended array of tracks
 */
export function blendFamiliarAndNew(
  familiar: SpotifyTrack[],
  newTracks: SpotifyTrack[],
  targetDurationMs: number = (MIN_QUEUE_DURATION_MS + MAX_QUEUE_DURATION_MS) / 2
): SpotifyTrack[] {
  const FAMILIAR_RATIO = 0.6;
  const result: SpotifyTrack[] = [];
  let durationMs = 0;

  const familiarShuffled = [...familiar].sort(() => Math.random() - 0.5);
  const newShuffled = [...newTracks].sort(() => Math.random() - 0.5);

  let fi = 0;
  let ni = 0;

  while (durationMs < targetDurationMs && (fi < familiarShuffled.length || ni < newShuffled.length)) {
    const useFamiliar =
      fi < familiarShuffled.length &&
      (ni >= newShuffled.length ||
        result.length === 0 ||
        (result.length + 1) * FAMILIAR_RATIO > result.filter((t) =>
          familiarShuffled.some((f) => f.id === t.id)
        ).length);

    const track = useFamiliar ? familiarShuffled[fi++] : newShuffled[ni++];
    if (!track || result.some((r) => r.id === track.id)) continue;

    result.push(track);
    durationMs += track.durationMs;
  }

  return result;
}

/**
 * Merges partial mood profiles into a single MoodProfile.
 * Averages numeric values, merges tags, uses first source.
 */
function mergeMoodProfiles(
  partials: Partial<MoodProfile>[],
  source: MoodProfile['source']
): MoodProfile {
  const numericKeys = ['valence', 'energy', 'tempo', 'danceability', 'acousticness'] as const;
  const merged: MoodProfile = {
    valence: 0.5,
    energy: 0.5,
    tempo: 120,
    danceability: 0.5,
    acousticness: 0.5,
    tags: [],
    source,
  };

  for (const key of numericKeys) {
    const values = partials
      .map((p) => (p as Record<string, unknown>)[key])
      .filter((v): v is number => typeof v === 'number');
    if (values.length) {
      (merged as unknown as Record<string, number>)[key] =
        values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  const allTags = new Set<string>();
  for (const p of partials) {
    if (p.tags) p.tags.forEach((t) => allTags.add(t));
  }
  merged.tags = Array.from(allTags);

  return merged;
}

/**
 * Generates a contextual queue from weather, calendar, time, and listening history.
 * @param userId - User ID (for auth context)
 * @param signals - Context signals (location, weather, calendar, time)
 * @param listeningHistory - User's recent listening history
 * @returns Generated queue with blended tracks
 * @throws QueueGeneratorError when generation fails
 */
export async function generateContextualQueue(
  userId: string,
  signals: ContextSignals,
  listeningHistory: SpotifyTrack[]
): Promise<GeneratedQueue> {
  const partials: Partial<MoodProfile>[] = [];

  if (signals.weather) {
    partials.push(weatherToMoodSignal(signals.weather));
  }
  if (signals.calendarEvents?.length) {
    for (const event of signals.calendarEvents.slice(0, 3)) {
      partials.push(eventToMoodSignal(event));
    }
  }

  const moodProfile = mergeMoodProfiles(partials, 'context');
  const spotifyParams = moodToSpotifyParams(moodProfile);

  const seedIds = listeningHistory.slice(0, 5).map((t) => t.id);
  const [recommendations, recent] = await Promise.all([
    getRecommendations({
      seedTracks: seedIds.length ? seedIds : undefined,
      ...spotifyParams,
      limit: 15,
    }),
    getRecentlyPlayed(20),
  ]);

  const familiar = recent.length ? recent : listeningHistory;
  const blended = blendFamiliarAndNew(familiar, recommendations);

  const totalDurationMs = blended.reduce((sum, t) => sum + t.durationMs, 0);
  const id = crypto.randomUUID?.() ?? `ctx-${Date.now()}`;

  return {
    id,
    tracks: blended,
    moodProfile,
    createdAt: new Date().toISOString(),
    source: 'app-prompted',
    context: signals,
    totalDurationMs,
    title: 'Contextual Queue',
    description: `Based on ${signals.weather ? 'weather' : ''} ${signals.calendarEvents?.length ? 'calendar' : ''} ${signals.timeOfDay}`.trim(),
  };
}

/**
 * Generates a queue from video analysis (CLIP + OpenL3).
 * @param userId - User ID (for auth context)
 * @param videoAnalysis - Video analysis with embeddings and mood tags
 * @param listeningHistory - User's recent listening history
 * @returns Generated queue
 * @throws QueueGeneratorError when generation fails
 */
export async function generateVideoQueue(
  userId: string,
  videoAnalysis: VideoAnalysis,
  listeningHistory: SpotifyTrack[]
): Promise<GeneratedQueue> {
  const moodProfile: MoodProfile = {
    valence: 0.5,
    energy: 0.5,
    tempo: 120,
    danceability: 0.5,
    acousticness: 0.5,
    tags: videoAnalysis.moodTags ?? [],
    source: 'video',
  };

  const seedIds = listeningHistory.slice(0, 5).map((t) => t.id);
  const [recommendations, recent] = await Promise.all([
    getRecommendations({
      seedTracks: seedIds.length ? seedIds : undefined,
      seedGenres: videoAnalysis.moodTags?.slice(0, 2),
      limit: 15,
    }),
    getRecentlyPlayed(20),
  ]);

  const familiar = recent.length ? recent : listeningHistory;
  const blended = blendFamiliarAndNew(familiar, recommendations);

  const totalDurationMs = blended.reduce((sum, t) => sum + t.durationMs, 0);
  const id = crypto.randomUUID?.() ?? `video-${Date.now()}`;

  return {
    id,
    tracks: blended,
    moodProfile,
    createdAt: new Date().toISOString(),
    source: 'user-video',
    totalDurationMs,
    title: `${videoAnalysis.dominantMood} Vibes`,
    description: `From your video: ${videoAnalysis.moodTags?.join(', ') ?? 'visual mood'}`,
  };
}

/**
 * Generates a queue from a chat prompt using Gemini.
 * Resolves track IDs via Spotify recommendations to obtain full track objects.
 * @param userId - User ID (for auth context)
 * @param prompt - User's natural language prompt
 * @param listeningHistory - User's recent listening history
 * @returns Generated queue with full track objects
 * @throws QueueGeneratorError when generation fails
 */
export async function generateChatQueue(
  userId: string,
  prompt: string,
  listeningHistory: SpotifyTrack[]
): Promise<GeneratedQueue> {
  const { tracks: trackIds, moodProfile, title, description } =
    await generateQueueFromPrompt(prompt, listeningHistory);

  const seedIds = trackIds.slice(0, 5).filter(Boolean);
  const spotifyParams = moodToSpotifyParams(moodProfile);

  const [recommendations, recent] = await Promise.all([
    getRecommendations({
      seedTracks: seedIds.length ? seedIds : listeningHistory.slice(0, 5).map((t) => t.id),
      ...spotifyParams,
      limit: 15,
    }),
    getRecentlyPlayed(20),
  ]);

  const familiar = recent.length ? recent : listeningHistory;
  const blended = blendFamiliarAndNew(familiar, recommendations);

  const totalDurationMs = blended.reduce((sum, t) => sum + t.durationMs, 0);
  const id = crypto.randomUUID?.() ?? `chat-${Date.now()}`;

  return {
    id,
    tracks: blended,
    moodProfile,
    createdAt: new Date().toISOString(),
    source: 'user-chat',
    totalDurationMs,
    title,
    description,
  };
}
