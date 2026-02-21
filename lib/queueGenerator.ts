import type { AudioFeatureTargets } from "./gemini";
import type { VibeProfile } from "./vibes";
import {
  getTopTracks,
  getTopArtists,
  getRecommendations,
  getAudioFeatures,
  searchTracks,
  type SpotifyTrack,
  type AudioFeatures,
} from "./spotify";
import { generateQueueSuggestions } from "./gemini";
import { getVibePromptDescription } from "./vibes";
import type { ContextPayload } from "./context/types";

export type GeneratedQueue = {
  tracks: SpotifyTrack[];
  vibe: VibeProfile;
  context: ContextPayload;
  reasoning: string;
  totalDurationMin: number;
  familiarCount: number;
  discoveryCount: number;
  generatedAt: number;
};

function audioFeatureDistance(
  track: AudioFeatures,
  target: AudioFeatureTargets
): number {
  const diffs = [
    (track.energy - target.energy) * 2,
    track.valence - target.valence,
    track.danceability - target.danceability,
    (track.acousticness - target.acousticness) * 0.8,
    (track.tempo - target.tempo) / 100,
  ];
  return Math.sqrt(diffs.reduce((s, d) => s + d * d, 0));
}

function dedup(tracks: SpotifyTrack[]): SpotifyTrack[] {
  const seen = new Set<string>();
  return tracks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

function enforceArtistDiversity(
  tracks: SpotifyTrack[],
  maxPerArtist = 2
): SpotifyTrack[] {
  const artistCounts = new Map<string, number>();
  return tracks.filter((t) => {
    const artistId = t.artists[0]?.id ?? t.artists[0]?.name;
    const count = artistCounts.get(artistId) ?? 0;
    if (count >= maxPerArtist) return false;
    artistCounts.set(artistId, count + 1);
    return true;
  });
}

function buildInterleavedQueue(
  familiar: SpotifyTrack[],
  discoveries: SpotifyTrack[],
  targetMs: number
): { tracks: SpotifyTrack[]; familiarCount: number; discoveryCount: number } {
  const queue: SpotifyTrack[] = [];
  let fi = 0;
  let di = 0;
  let runningMs = 0;
  let familiarCount = 0;
  let discoveryCount = 0;

  if (discoveries.length > 0) {
    queue.push(discoveries[di++]);
    runningMs += queue[0].duration_ms;
    discoveryCount++;
  } else if (familiar.length > 0) {
    queue.push(familiar[fi++]);
    runningMs += queue[0].duration_ms;
    familiarCount++;
  }

  while (runningMs < targetMs && (fi < familiar.length || di < discoveries.length)) {
    if (fi < familiar.length) {
      queue.push(familiar[fi++]);
      runningMs += queue[queue.length - 1].duration_ms;
      familiarCount++;
      if (runningMs >= targetMs) break;
    }
    for (let n = 0; n < 2 && di < discoveries.length; n++) {
      queue.push(discoveries[di++]);
      runningMs += queue[queue.length - 1].duration_ms;
      discoveryCount++;
      if (runningMs >= targetMs) break;
    }
  }

  return { tracks: queue, familiarCount, discoveryCount };
}

export async function generatePromptedQueue(
  spotifyToken: string,
  vibe: VibeProfile,
  context: ContextPayload
): Promise<GeneratedQueue> {
  const promptDescription = getVibePromptDescription(vibe, context);
  const targetMs = vibe.targetDurationMin * 60000;

  const [topTracks, topArtists] = await Promise.all([
    getTopTracks(spotifyToken, 30, "medium_term"),
    getTopArtists(spotifyToken, 20, "medium_term"),
  ]);

  const suggestions = await generateQueueSuggestions(
    promptDescription,
    topTracks,
    topArtists
  );

  const [familiarResults, discoveryResults] = await Promise.all([
    Promise.all(
      (suggestions.familiar ?? []).map((q) =>
        searchTracks(spotifyToken, q, 1).catch(() => [])
      )
    ),
    Promise.all(
      (suggestions.discoveries ?? []).map((q) =>
        searchTracks(spotifyToken, q, 1).catch(() => [])
      )
    ),
  ]);

  let familiarTracks = dedup(familiarResults.flat().filter(Boolean));
  let discoveryTracks = dedup(discoveryResults.flat().filter(Boolean));

  const existingIds = new Set(familiarTracks.map((t) => t.id));
  discoveryTracks = discoveryTracks.filter((t) => !existingIds.has(t.id));

  familiarTracks = enforceArtistDiversity(familiarTracks, 2);
  discoveryTracks = enforceArtistDiversity(discoveryTracks, 1);

  if (familiarTracks.length + discoveryTracks.length < 5) {
    const seedTrackIds = topTracks.slice(0, 2).map((t) => t.id);
    const seedArtistIds = topArtists.slice(0, 2).map((a) => a.id);

    const recs = await getRecommendations(spotifyToken, {
      seedTracks: seedTrackIds,
      seedArtists: seedArtistIds,
      audioFeatures: vibe.audioFeatures,
      limit: 30,
    });

    const recTracks = dedup(recs).filter(
      (t) => !existingIds.has(t.id) && !discoveryTracks.find((d) => d.id === t.id)
    );
    discoveryTracks.push(...enforceArtistDiversity(recTracks, 1));
  }

  const { tracks, familiarCount, discoveryCount } = buildInterleavedQueue(
    familiarTracks,
    discoveryTracks,
    targetMs
  );

  return {
    tracks,
    vibe,
    context,
    reasoning: suggestions.reasoning,
    totalDurationMin: Math.round(
      tracks.reduce((s, t) => s + t.duration_ms, 0) / 60000
    ),
    familiarCount,
    discoveryCount,
    generatedAt: Date.now(),
  };
}
