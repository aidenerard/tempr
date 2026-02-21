import type { AudioFeatureTargets } from "./gemini";

const SPOTIFY_BASE = "https://api.spotify.com/v1";

async function spotifyFetch(endpoint: string, token: string) {
  const res = await fetch(`${SPOTIFY_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Spotify API error: ${res.status}`);
  }
  return res.json();
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
  timeRange = "medium_term"
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch(
    `/me/top/tracks?limit=${limit}&time_range=${timeRange}`,
    token
  );
  return data.items ?? [];
}

export async function getTopArtists(
  token: string,
  limit = 20,
  timeRange = "medium_term"
): Promise<SpotifyArtist[]> {
  const data = await spotifyFetch(
    `/me/top/artists?limit=${limit}&time_range=${timeRange}`,
    token
  );
  return data.items ?? [];
}

export async function searchTracks(
  token: string,
  query: string,
  limit = 5
): Promise<SpotifyTrack[]> {
  const encoded = encodeURIComponent(query);
  const data = await spotifyFetch(
    `/search?q=${encoded}&type=track&limit=${limit}`,
    token
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
  }
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
    params.set("target_instrumentalness", af.instrumentalness.toFixed(2));
    params.set("target_tempo", af.tempo.toFixed(0));
    params.set("target_liveness", af.liveness.toFixed(2));
  }

  params.set("limit", String(opts.limit ?? 30));

  const data = await spotifyFetch(
    `/recommendations?${params.toString()}`,
    token
  );
  return data.tracks ?? [];
}

export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function totalDurationMinutes(tracks: SpotifyTrack[]): number {
  const totalMs = tracks.reduce((sum, t) => sum + t.duration_ms, 0);
  return Math.round(totalMs / 60000);
}
