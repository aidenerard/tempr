// MusicVideoFinder.js
// node scripts/MusicVideoFinder.js "spotify:track:4cOdK2wGLETKBW3PvgPWqT"

import "dotenv/config";
import fetch from "node-fetch";

const SPOTIFY_BEARER_TOKEN = process.env.SPOTIFY_BEARER_TOKEN;
const YT_KEY = process.env.EXPO_PUBLIC_YT_KEY;

function requireEnv(name, value) {
    if (!value || !String(value).trim()) {
        throw new Error(`Missing ${name}. Put it in .env or export it in your shell.`);
    }
}

requireEnv("SPOTIFY_BEARER_TOKEN", SPOTIFY_BEARER_TOKEN);
requireEnv("EXPO_PUBLIC_YT_KEY", YT_KEY);

async function getSpotifyTrack(trackIdOrUri) {
    const id = trackIdOrUri.includes(":track:")
        ? trackIdOrUri.split(":track:")[1]
        : trackIdOrUri;

    const r = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
        headers: { Authorization: `Bearer ${SPOTIFY_BEARER_TOKEN}` },
    });
    if (!r.ok) throw new Error(`Spotify error: ${r.status} ${await r.text()}`);
    const j = await r.json();
    return {
        track: j.name,
        artist: j.artists?.[0]?.name ?? "",
    };
}

async function findVideoId(track) {
    const q = `${track.artist} ${track.track} official music video`;
    const url =
        "https://www.googleapis.com/youtube/v3/search" +
        `?part=id&type=video&maxResults=1` +
        `&videoCategoryId=10&videoEmbeddable=true&videoSyndicated=true` +
        `&q=${encodeURIComponent(q)}` +
        `&key=${encodeURIComponent(YT_KEY)}`;

    const r = await fetch(url);
    if (!r.ok) throw new Error(`YouTube search error: ${r.status} ${await r.text()}`);
    const j = await r.json();
    return j.items?.[0]?.id?.videoId ?? null;
}

(async () => {
    const input = process.argv[2];
    if (!input) throw new Error("Pass a Spotify track URI or ID.");

    const track = await getSpotifyTrack(input);
    const videoId = await findVideoId(track);

    console.log(videoId);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
