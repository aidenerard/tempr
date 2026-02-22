import { supabase } from "@/lib/supabase";

export type YouTubeMatch = {
    videoId: string;
    title: string;
    channelTitle: string;
    ytSeconds: number;
    viewCount: number;
    score: number;
};

export async function findMusicVideo(spotifyTrackId: string): Promise<YouTubeMatch | null> {
    const { data, error } = await supabase
        .from("youtube_cache")
        .select("video_id, title, channel_title, yt_seconds, view_count, score")
        .eq("spotify_track_id", spotifyTrackId)
        .maybeSingle();

    if (error) {
        console.warn("[YT] cache read failed:", error.message);
        return null;
    }
    if (!data?.video_id) return null;

    return {
        videoId: data.video_id,
        title: data.title ?? "",
        channelTitle: data.channel_title ?? "",
        ytSeconds: data.yt_seconds ?? 0,
        viewCount: Number(data.view_count ?? 0),
        score: data.score ?? 0,
    };
}
