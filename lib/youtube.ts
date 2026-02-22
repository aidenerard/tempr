import { supabase } from "@/lib/supabase";
import type { SpotifyTrack } from "@/lib/spotify";

const YT_KEY = process.env.EXPO_PUBLIC_YT_KEY;

export type YouTubeMatch = {
    videoId: string;
    title: string;
    channelTitle: string;
    ytSeconds: number;
    viewCount: number;
    score: number;
    startSeconds: number;
};

async function searchYouTube(track: SpotifyTrack): Promise<string | null> {
    if (!YT_KEY) {
        console.warn("[YT] EXPO_PUBLIC_YT_KEY not set");
        return null;
    }
    const artist = track.artists[0]?.name ?? "";
    const q = `${artist} ${track.name} official music video`;
    const url =
        "https://www.googleapis.com/youtube/v3/search" +
        `?part=id&type=video&maxResults=1` +
        `&videoCategoryId=10&videoEmbeddable=true&videoSyndicated=true` +
        `&q=${encodeURIComponent(q)}` +
        `&key=${encodeURIComponent(YT_KEY)}`;

    const res = await fetch(url);
    if (!res.ok) {
        console.warn("[YT] search failed:", res.status);
        return null;
    }
    const json = await res.json();
    return json.items?.[0]?.id?.videoId ?? null;
}

// Uses Spotify's audio analysis to find the loudest section after the intro —
// almost always the first chorus.
async function getChorusStart(spotifyToken: string, track: SpotifyTrack): Promise<number> {
    try {
        const res = await fetch(
            `https://api.spotify.com/v1/audio-analysis/${track.id}`,
            { headers: { Authorization: `Bearer ${spotifyToken}` } },
        );
        if (!res.ok) return 0;

        const { sections = [] } = await res.json();
        const durationSec = track.duration_ms / 1000;

        // Skip the first 10% of the song (intro), and don't start past 70%
        const skipBefore = Math.max(10, durationSec * 0.1);
        const candidates = sections.filter(
            (s: any) => s.start >= skipBefore && s.start < durationSec * 0.7,
        );
        if (!candidates.length) return 0;

        // Loudness is in dB (negative); closer to 0 = louder = chorus
        const best = candidates.reduce((a: any, b: any) =>
            b.loudness > a.loudness ? b : a,
        );
        return Math.round(best.start);
    } catch {
        return 0;
    }
}

export async function findMusicVideo(
    track: SpotifyTrack,
    spotifyToken: string,
): Promise<YouTubeMatch | null> {
    // 1. Check Supabase cache
    const { data, error } = await supabase
        .from("youtube_cache")
        .select("video_id, title, channel_title, yt_seconds, view_count, score, start_seconds")
        .eq("spotify_track_id", track.id)
        .maybeSingle();

    if (error) console.warn("[YT] cache read failed:", error.message);

    if (data?.video_id) {
        return {
            videoId: data.video_id,
            title: data.title ?? "",
            channelTitle: data.channel_title ?? "",
            ytSeconds: data.yt_seconds ?? 0,
            viewCount: Number(data.view_count ?? 0),
            score: data.score ?? 0,
            startSeconds: data.start_seconds ?? 0,
        };
    }

    // 2. Not cached — search YouTube and find chorus start in parallel
    const [videoId, startSeconds] = await Promise.all([
        searchYouTube(track),
        getChorusStart(spotifyToken, track),
    ]);
    if (!videoId) return null;

    // 3. Write to Supabase so subsequent lookups are free
    const { error: insertErr } = await supabase.from("youtube_cache").upsert(
        {
            spotify_track_id: track.id,
            video_id: videoId,
            title: "",
            channel_title: "",
            yt_seconds: 0,
            view_count: 0,
            score: 0,
            start_seconds: startSeconds,
        },
        { onConflict: "spotify_track_id" },
    );
    if (insertErr) console.warn("[YT] cache write failed:", insertErr.message);

    return {
        videoId,
        title: "",
        channelTitle: "",
        ytSeconds: 0,
        viewCount: 0,
        score: 0,
        startSeconds,
    };
}
