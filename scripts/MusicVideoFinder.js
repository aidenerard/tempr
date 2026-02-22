// matchTrackToYouTube.js
// node matchTrackToYouTube.js "spotify:track:4cOdK2wGLETKBW3PvgPWqT"

import "dotenv/config";
import fetch from "node-fetch";

const SPOTIFY_BEARER_TOKEN = process.env.SPOTIFY_BEARER_TOKEN; // raw access token ONLY (no "Bearer ")
const YT_KEY = process.env.YT_KEY;

const MIN_VIEWS = parseInt(process.env.MIN_VIEWS || "50000", 10);
const MAX_RESULTS_PER_QUERY = parseInt(
    process.env.MAX_RESULTS_PER_QUERY || "10",
    10,
);
const TOP_K = parseInt(process.env.TOP_K || "3", 10);

function requireEnv(name, value) {
    if (!value || !String(value).trim()) {
        throw new Error(
            `Missing ${name}. Put it in .env or export it in your shell.`,
        );
    }
}

requireEnv("SPOTIFY_BEARER_TOKEN", SPOTIFY_BEARER_TOKEN);
requireEnv("YT_KEY", YT_KEY);

function norm(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/\(.*?\)/g, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function tokenSet(s) {
    return new Set(norm(s).split(/\s+/).filter(Boolean));
}

function jaccard(a, b) {
    const A = tokenSet(a),
        B = tokenSet(b);
    let inter = 0;
    for (const t of A) if (B.has(t)) inter++;
    const union = A.size + B.size - inter;
    return union ? inter / union : 0;
}

function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
}

/**
 * Views/subscribers should influence ranking heavily, but not dominate
 * a clearly-mismatched title. So we:
 * - Use log scaling (10k -> 100k is meaningful, 100M -> 101M is not)
 * - Gate: if match is weak AND views are low, drop/penalize hard.
 */
function scoreCandidate(
    {
        title,
        channelTitle,
        ytSeconds,
        viewCount = 0,
        channelSubscriberCount = null,
    },
    { artist, track, spSeconds },
) {
    const queryString = `${artist} ${track}`;
    const titleSim = jaccard(queryString, title); // 0..1

    // Base: similarity matters
    let score = titleSim * 12; // slightly stronger than before

    const t = norm(title);
    const c = norm(channelTitle);

    // Boosts: "official" signals
    const isOfficialish =
        t.includes("official music video") ||
        t.includes("official video") ||
        t.includes("provided to youtube") ||
        t.includes("topic");

    if (t.includes("official music video") || t.includes("official video"))
        score += 3.5;
    if (t.includes("provided to youtube") || t.includes("topic")) score += 1.25;

    // Artist in channel title (rough heuristic)
    if (c.includes(norm(artist))) score += 1.5;

    // Penalties: obvious non-canonical variants
    const bad = [
        "live",
        "cover",
        "remix",
        "sped up",
        "slowed",
        "karaoke",
        "8d",
        "instrumental",
    ];
    for (const w of bad) if (t.includes(w)) score -= 3;

    // Duration closeness (allow small offset)
    const diff = Math.abs(ytSeconds - spSeconds);
    score -= Math.min(diff / 10, 6); // cap penalty

    // Views: strong signal (log-scaled)
    // log10(views): 1k=3, 10k=4, 100k=5, 1M=6, 10M=7, 100M=8...
    const viewScore = clamp(Math.log10((viewCount || 0) + 1), 0, 9);
    score += viewScore * 1.4;

    // Subscribers: optional extra signal (also log-scaled, smaller weight)
    if (
        typeof channelSubscriberCount === "number" &&
        channelSubscriberCount > 0
    ) {
        const subScore = clamp(Math.log10(channelSubscriberCount + 1), 0, 9);
        score += subScore * 0.6;
    }

    // Gate/filter behavior:
    // If it's NOT official-ish, and similarity is weak, and views are low, tank it.
    // This avoids random 500-subscriber uploads.
    if (!isOfficialish && titleSim < 0.35 && viewCount < MIN_VIEWS) {
        score -= 10;
    }

    // If it *is* official-ish, we’re more forgiving on views (some Topic uploads have fewer views).
    if (isOfficialish && titleSim > 0.45) {
        score += 1.0;
    }

    return score;
}

function iso8601ToSeconds(dur) {
    // PT#H#M#S
    const m = String(dur || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || "0", 10);
    const min = parseInt(m[2] || "0", 10);
    const s = parseInt(m[3] || "0", 10);
    return h * 3600 + min * 60 + s;
}

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
        id: j.id,
        track: j.name,
        artist: j.artists?.[0]?.name ?? "",
        duration_ms: j.duration_ms,
        isrc: j.external_ids?.isrc ?? null,
    };
}

async function ytSearch(q) {
    const url =
        "https://www.googleapis.com/youtube/v3/search" +
        `?part=snippet&type=video&maxResults=${encodeURIComponent(String(MAX_RESULTS_PER_QUERY))}` +
        `&videoCategoryId=10&videoEmbeddable=true&videoSyndicated=true` +
        `&q=${encodeURIComponent(q)}` +
        `&key=${encodeURIComponent(YT_KEY)}`;

    const r = await fetch(url);
    if (!r.ok)
        throw new Error(`YouTube search error: ${r.status} ${await r.text()}`);
    const j = await r.json();
    return (j.items || []).map((it) => ({
        videoId: it.id.videoId,
        title: it.snippet.title,
        channelTitle: it.snippet.channelTitle,
        channelId: it.snippet.channelId,
    }));
}

async function ytDetails(videoIds) {
    if (!videoIds.length) return [];
    const url =
        "https://www.googleapis.com/youtube/v3/videos" +
        `?part=contentDetails,snippet,statistics&id=${videoIds.join(",")}` +
        `&key=${encodeURIComponent(YT_KEY)}`;

    const r = await fetch(url);
    if (!r.ok)
        throw new Error(`YouTube videos.list error: ${r.status} ${await r.text()}`);
    const j = await r.json();

    return (j.items || []).map((it) => ({
        videoId: it.id,
        title: it.snippet.title,
        channelTitle: it.snippet.channelTitle,
        channelId: it.snippet.channelId,
        publishedAt: it.snippet.publishedAt,
        ytSeconds: iso8601ToSeconds(it.contentDetails.duration),
        viewCount: parseInt(it.statistics?.viewCount || "0", 10),
        likeCount: it.statistics?.likeCount
            ? parseInt(it.statistics.likeCount, 10)
            : null,
    }));
}

async function ytChannelStats(channelIds) {
    const ids = Array.from(new Set(channelIds.filter(Boolean)));
    if (!ids.length) return new Map();

    // Note: subscriberCount can be hidden for some channels.
    // Also, channels.list has an ID limit per request; chunk to be safe.
    const out = new Map();
    const chunkSize = 50;

    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const url =
            "https://www.googleapis.com/youtube/v3/channels" +
            `?part=statistics&id=${chunk.join(",")}` +
            `&key=${encodeURIComponent(YT_KEY)}`;

        const r = await fetch(url);
        if (!r.ok)
            throw new Error(
                `YouTube channels.list error: ${r.status} ${await r.text()}`,
            );
        const j = await r.json();

        for (const it of j.items || []) {
            const subsRaw = it.statistics?.subscriberCount;
            out.set(it.id, subsRaw ? parseInt(subsRaw, 10) : null);
        }
    }

    return out;
}

async function match(track) {
    const spSeconds = Math.round(track.duration_ms / 1000);
    const queries = [
        `${track.artist} ${track.track} official music video`,
        `${track.artist} ${track.track} official video`,
        `${track.artist} - ${track.track}`,
        `${track.artist} ${track.track} topic`,
    ];

    // Gather candidates from multiple queries
    const seen = new Set();
    const candidates = [];
    for (const q of queries) {
        const hits = await ytSearch(q);
        for (const h of hits) {
            if (!seen.has(h.videoId)) {
                seen.add(h.videoId);
                candidates.push(h);
            }
        }
    }

    // Pull details
    const details = await ytDetails(candidates.map((c) => c.videoId));

    // Pull channel subscriber stats (optional but improves ranking)
    const channelSubs = await ytChannelStats(details.map((d) => d.channelId));

    // Score + (optional) hard filter by views:
    // Keep low-view results only if they look official/topic AND match decently.
    const spMeta = { artist: track.artist, track: track.track, spSeconds };

    const scored = details
        .map((d) => {
            const subs = channelSubs.get(d.channelId) ?? null;
            return {
                ...d,
                channelSubscriberCount: subs,
                score: scoreCandidate({ ...d, channelSubscriberCount: subs }, spMeta),
            };
        })
        .filter((d) => {
            const t = norm(d.title);
            const officialish =
                t.includes("official music video") ||
                t.includes("official video") ||
                t.includes("provided to youtube") ||
                t.includes("topic");
            const sim = jaccard(`${track.artist} ${track.track}`, d.title);

            if (d.viewCount >= MIN_VIEWS) return true;
            // Allow low views if it's "official-ish" and matches well
            return officialish && sim >= 0.45;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);

    return scored.map((s) => ({
        videoId: s.videoId,
        title: s.title,
        channelTitle: s.channelTitle,
        ytSeconds: s.ytSeconds,
        viewCount: s.viewCount,
        channelSubscriberCount: s.channelSubscriberCount,
        score: s.score,
        embedUrl: `https://www.youtube.com/embed/${s.videoId}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0`,
    }));
}

(async () => {
    const input = process.argv[2];
    if (!input) throw new Error("Pass a Spotify track URI or ID.");

    const track = await getSpotifyTrack(input);
    const matches = await match(track);

    console.log({
        track,
        tuning: { MIN_VIEWS, MAX_RESULTS_PER_QUERY, TOP_K },
        matches,
    });
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
