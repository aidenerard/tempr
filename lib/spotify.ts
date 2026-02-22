import type { AudioFeatureTargets } from "./gemini";

const SPOTIFY_BASE = "https://api.spotify.com/v1";

async function spotifyFetch(endpoint: string, token: string): Promise<any> {
    const res = await fetch(`${SPOTIFY_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Spotify API error: ${res.status}`);
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

// Well-known Spotify editorial playlists — public, no special permissions needed
const TRENDING_PLAYLIST_IDS = [
    "37i9dQZEVXbMDoHDwVN2tF", // Global Top 50
    "37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits
    "37i9dQZF1DX0kbJZpiYdZl", // Hot Hits USA
    "37i9dQZF1DX4JAvHpjipBk", // New Music Friday
    "37i9dQZEVXbLiRSasKsNU9", // Viral 50 Global
];

export async function getTrendingTracks(
    token: string,
    limit = 10,
): Promise<SpotifyTrack[]> {
    // Pick a random playlist and a random starting offset for variety each call
    const playlistId = TRENDING_PLAYLIST_IDS[Math.floor(Math.random() * TRENDING_PLAYLIST_IDS.length)];
    const offset = Math.floor(Math.random() * 40);

    const fields = "items(track(id,name,artists,album,uri,preview_url,duration_ms))";
    const data = await spotifyFetch(
        `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=${encodeURIComponent(fields)}`,
        token,
    );

    return (data.items ?? [])
        .map((item: any) => item.track)
        .filter((t: any) => t?.id);
}

export async function addToQueue(
    token: string,
    trackUri: string,
): Promise<void> {
    const res = await fetch(
        `${SPOTIFY_BASE}/me/player/queue?uri=${encodeURIComponent(trackUri)}`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
        },
    );

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Failed to add to queue: ${res.status}`);
    }
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