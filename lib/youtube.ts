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

export async function findMusicVideo(track: SpotifyTrack): Promise<YouTubeMatch | null> {
    // 1. Check Supabase cache
    const { data, error } = await supabase
        .from("youtube_cache")
        .select("video_id, title, channel_title, yt_seconds, view_count, score")
        .eq("spotify_track_id", track.id)
        .maybeSingle();

    if (error) {
        console.warn("[YT] cache read failed:", error.message);
    }

    if (data?.video_id) {
        return {
            videoId: data.video_id,
            title: data.title ?? "",
            channelTitle: data.channel_title ?? "",
            ytSeconds: data.yt_seconds ?? 0,
            viewCount: Number(data.view_count ?? 0),
            score: data.score ?? 0,
        };
    }

    // 2. Not in cache — search YouTube
    const videoId = await searchYouTube(track);
    if (!videoId) return null;

    // 3. Write to Supabase cache so subsequent lookups are free
    const { error: insertErr } = await supabase.from("youtube_cache").upsert(
        {
            spotify_track_id: track.id,
            video_id: videoId,
            title: "",
            channel_title: "",
            yt_seconds: 0,
            view_count: 0,
            score: 0,
        },
        { onConflict: "spotify_track_id" },
    );
    if (insertErr) console.warn("[YT] cache write failed:", insertErr.message);

    return { videoId, title: "", channelTitle: "", ytSeconds: 0, viewCount: 0, score: 0 };
}
