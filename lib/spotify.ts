import type { AudioFeatureTargets } from "./gemini";

const SPOTIFY_BASE = "https://api.spotify.com/v1";

const DEFAULT_RETRY_AFTER_MS = 2000;
const MAX_429_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function spotifyRequest(
  url: string,
  token: string,
  init: RequestInit = {},
  retryCount = 0,
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init.headers },
  });

  if (res.status === 429 && retryCount < MAX_429_RETRIES) {
    const retryAfterSec = res.headers.get("Retry-After");
    const waitMs = retryAfterSec
      ? Math.min(Number(retryAfterSec) * 1000, 15000)
      : DEFAULT_RETRY_AFTER_MS;
    console.warn(
      `[Spotify] 429 rate limited, retrying after ${waitMs}ms (attempt ${retryCount + 1}/${MAX_429_RETRIES})`,
    );
    await sleep(waitMs);
    return spotifyRequest(url, token, init, retryCount + 1);
  }

  return res;
}

async function spotifyFetch(endpoint: string, token: string): Promise<any> {
  const url = `${SPOTIFY_BASE}${endpoint}`;
  const res = await spotifyRequest(url, token);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `Spotify API error: ${res.status}`;
    console.error(`[Spotify] ${res.status} on ${url} —`, msg);
    throw new Error(msg);
  }
  return res.json();
}

export async function batchedSearch(
  token: string,
  queries: string[],
  batchSize = 3,
): Promise<SpotifyTrack[][]> {
  const results: SpotifyTrack[][] = [];
  for (let i = 0; i < queries.length; i += batchSize) {
    if (i > 0) await sleep(350);
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((q) => searchTracks(token, q, 1).catch(() => [])),
    );
    results.push(...batchResults);
  }
  return results;
}

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  uri: string;
  preview_url: string | null;
  duration_ms: number;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  genres: string[];
};

export async function getTopTracks(
  token: string,
  limit = 20,
  timeRange = "medium_term",
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch(
    `/me/top/tracks?limit=${limit}&time_range=${timeRange}`,
    token,
  );
  return data.items ?? [];
}

export async function getTopArtists(
  token: string,
  limit = 20,
  timeRange = "medium_term",
): Promise<SpotifyArtist[]> {
  const data = await spotifyFetch(
    `/me/top/artists?limit=${limit}&time_range=${timeRange}`,
    token,
  );
  return data.items ?? [];
}

export async function searchTracks(
  token: string,
  query: string,
  limit = 1,
): Promise<SpotifyTrack[]> {
  const encoded = encodeURIComponent(query);
  const data = await spotifyFetch(
    `/search?q=${encoded}&type=track&limit=${limit}`,
    token,
  );
  return data.tracks?.items ?? [];
}

export async function getRecommendations(
  token: string,
  opts: {
    seedTracks?: string[];
    seedArtists?: string[];
    seedGenres?: string[];
    audioFeatures?: AudioFeatureTargets;
    limit?: number;
  },
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams();

  if (opts.seedTracks?.length)
    params.set("seed_tracks", opts.seedTracks.slice(0, 2).join(","));
  if (opts.seedArtists?.length)
    params.set("seed_artists", opts.seedArtists.slice(0, 2).join(","));
  if (opts.seedGenres?.length)
    params.set("seed_genres", opts.seedGenres.slice(0, 1).join(","));

  if (opts.audioFeatures) {
    const af = opts.audioFeatures;
    params.set("target_energy", af.energy.toFixed(2));
    params.set("target_valence", af.valence.toFixed(2));
    params.set("target_danceability", af.danceability.toFixed(2));
    params.set("target_acousticness", af.acousticness.toFixed(2));
    params.set("target_tempo", af.tempo.toFixed(0));
  }

  params.set("limit", String(opts.limit ?? 30));

  const data = await spotifyFetch(
    `/recommendations?${params.toString()}`,
    token,
  );
  return data.tracks ?? [];
}

export async function getArtistTopTracks(
  token: string,
  artistId: string,
  market = "US",
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch(
    `/artists/${artistId}/top-tracks?market=${market}`,
    token,
  );
  return data.tracks ?? [];
}

export async function getTrendingTracks(
  token: string,
  limit = 10,
): Promise<SpotifyTrack[]> {
  const [short, medium, long] = await Promise.all([
    getTopTracks(token, 50, "short_term"),
    getTopTracks(token, 50, "medium_term"),
    getTopTracks(token, 50, "long_term"),
  ]);

  const seen = new Set<string>();
  const pool: SpotifyTrack[] = [];
  for (const t of [...short, ...medium, ...long]) {
    if (!seen.has(t.id)) {
      seen.add(t.id);
      pool.push(t);
    }
  }

  return pool.sort(() => Math.random() - 0.5).slice(0, limit);
}

export type SpotifyDevice = {
  id: string;
  is_active: boolean;
  name: string;
  type: string;
};

export async function getAvailableDevices(
  token: string,
): Promise<SpotifyDevice[]> {
  const url = `${SPOTIFY_BASE}/me/player/devices`;
  const res = await spotifyRequest(url, token);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return [];
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error?.message || `Failed to get devices: ${res.status}`,
    );
  }
  const data = await res.json();
  return data.devices ?? [];
}

export async function addToQueue(
  token: string,
  trackUri: string,
  deviceId?: string,
): Promise<void> {
  const params = new URLSearchParams({ uri: trackUri });
  if (deviceId) params.set("device_id", deviceId);
  const url = `${SPOTIFY_BASE}/me/player/queue?${params.toString()}`;
  const res = await spotifyRequest(url, token, { method: "POST" });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `Failed to add to queue: ${res.status}`;
    throw new Error(msg);
  }
}

export async function getLikedTracks(
  token: string,
  limit = 2000,
): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = [];
  let offset = 0;
  const batchSize = Math.min(limit, 50);

  while (tracks.length < limit) {
    const data = await spotifyFetch(
      `/me/tracks?limit=${batchSize}&offset=${offset}`,
      token,
    );
    const items = data.items ?? [];
    if (items.length === 0) break;
    for (const item of items) {
      if (item.track) tracks.push(item.track);
    }
    offset += batchSize;
    if (items.length < batchSize) break;
  }

  return tracks.slice(0, limit);
}

export async function getAudioFeaturesForTracks(
  token: string,
  trackIds: string[],
): Promise<Map<string, SpotifyAudioFeatures>> {
  const map = new Map<string, SpotifyAudioFeatures>();
  const batches: string[][] = [];
  for (let i = 0; i < trackIds.length; i += 100) {
    batches.push(trackIds.slice(i, i + 100));
  }

  for (const batch of batches) {
    const data = await spotifyFetch(
      `/audio-features?ids=${batch.join(",")}`,
      token,
    );
    for (const af of data.audio_features ?? []) {
      if (af?.id) map.set(af.id, af);
    }
  }

  return map;
}

export type SpotifyAudioFeatures = {
  id: string;
  acousticness: number;
  danceability: number;
  energy: number;
  instrumentalness: number;
  key: number;
  liveness: number;
  loudness: number;
  mode: number;
  speechiness: number;
  tempo: number;
  time_signature: number;
  valence: number;
};

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function totalDurationMinutes(tracks: SpotifyTrack[]): number {
  const totalMs = tracks.reduce((sum, t) => sum + t.duration_ms, 0);
  return Math.round(totalMs / 60000);
}
