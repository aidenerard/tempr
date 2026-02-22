import { GoogleGenAI } from "@google/genai";
import type { SpotifyTrack, SpotifyArtist } from "./spotify";

const ai = new GoogleGenAI({
  apiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY!,
});

export type AudioFeatureTargets = {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  tempo: number;
};

export type QueueSuggestion = {
  audioFeatures: AudioFeatureTargets;
  familiar: string[];
  discoveries: string[];
  reasoning: string;
};

function extractJson(raw: string): string | null {
  // Try extracting from markdown code fences first
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  // Fall back to bracket matching, respecting strings
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0) return raw.slice(start, i + 1);
  }
  return null;
}

export async function generateQueueSuggestions(
  prompt: string,
  topTracks: SpotifyTrack[],
  topArtists: SpotifyArtist[]
): Promise<QueueSuggestion> {
  const trackContext = (topTracks ?? [])
    .slice(0, 50)
    .map((t) => `"${t.name}" by ${t.artists?.[0]?.name ?? "Unknown"}`)
    .join(", ");

  const artistContext = (topArtists ?? [])
    .slice(0, 30)
    .map((a) => `${a.name} (${(a.genres ?? []).slice(0, 3).join(", ")})`)
    .join(", ");

  const systemPrompt = `You are a music curator AI for an app called Tempr. Given a user's mood/vibe description and their listening history, generate a JSON response.

RESPOND WITH ONLY A JSON OBJECT. No markdown, no code fences, no explanation before or after. Just the raw JSON object.

JSON schema:
{
  "audioFeatures": {
    "energy": <number 0.0-1.0>,
    "valence": <number 0.0-1.0>,
    "danceability": <number 0.0-1.0>,
    "acousticness": <number 0.0-1.0>,
    "tempo": <number 60-200>
  },
  "familiar": ["song title - artist name", ...],
  "discoveries": [],
  "reasoning": "one sentence explaining the mood mapping and curation logic"
}

Audio feature guidelines:
- energy: 0=calm/ambient, 0.5=moderate, 1=intense/loud
- valence: 0=sad/dark, 0.5=neutral, 1=happy/euphoric
- danceability: 0=freeform, 0.5=moderate groove, 1=strong beat
- acousticness: 0=electronic/produced, 1=fully acoustic
- tempo: BPM (60=slow ballad, 100=mid-tempo, 120=upbeat, 150+=fast)

CRITICAL RULES:
- "familiar": Pick 10-12 songs FROM the user's top tracks that fit the mood. Use EXACT song titles and artist names from their history.
- "discoveries": Always return an empty array [].
- All songs must be REAL tracks on Spotify.
- Output ONLY the JSON object, nothing else.`;

  const userMessage = `Mood/vibe: "${prompt}"

User's top tracks: ${trackContext}
User's top artists: ${artistContext}

Generate a queue that matches this vibe. Reply with ONLY the JSON object.`;

  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 2048 },
        temperature: 0.85,
      },
    });

    const raw = (response.text ?? "").trim();

    if (!raw) continue;

    try {
      return JSON.parse(raw) as QueueSuggestion;
    } catch (e) {
      console.log("[Gemini] direct parse failed:", (e as Error).message);
    }

    const jsonStr = extractJson(raw);
    if (jsonStr) {
      try {
        const sanitized = jsonStr
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]");
        return JSON.parse(sanitized) as QueueSuggestion;
      } catch (e) {
        console.log("[Gemini] extracted parse failed:", (e as Error).message);
      }
    }

    console.log("[Gemini] retrying…");
  }

  throw new Error("Gemini failed to return valid JSON after retries");
}

export type QueueAdjustment = {
  audioFeatures: AudioFeatureTargets;
  remove: string[];
  additions: string[];
  reasoning: string;
};

export async function adjustQueueSuggestions(
  currentSongs: string[],
  originalPrompt: string,
  adjustment: string,
  topTracks: SpotifyTrack[],
  topArtists: SpotifyArtist[],
): Promise<QueueAdjustment> {
  const trackContext = (topTracks ?? [])
    .slice(0, 50)
    .map((t) => `"${t.name}" by ${t.artists?.[0]?.name ?? "Unknown"}`)
    .join(", ");

  const artistContext = (topArtists ?? [])
    .slice(0, 30)
    .map((a) => `${a.name} (${(a.genres ?? []).slice(0, 3).join(", ")})`)
    .join(", ");

  const removeCount = Math.max(1, Math.ceil(currentSongs.length * 0.4));

  const systemPrompt = `You are a music curator AI for an app called Tempr. The user has an existing queue and wants to adjust its vibe.

RESPOND WITH ONLY A JSON OBJECT. No markdown, no code fences, no explanation.

JSON schema:
{
  "audioFeatures": {
    "energy": <number 0.0-1.0>,
    "valence": <number 0.0-1.0>,
    "danceability": <number 0.0-1.0>,
    "acousticness": <number 0.0-1.0>,
    "tempo": <number 60-200>
  },
  "remove": ["exact song name - artist from the current queue", ...],
  "additions": ["new song title - artist name", ...],
  "reasoning": "one sentence explaining what changed and why"
}

CRITICAL RULES:
- Evaluate every song in the current queue against the ADJUSTED vibe.
- "remove": Pick exactly ${removeCount} songs that LEAST fit the adjusted vibe. Use the EXACT names from the current queue.
- "additions": Generate ${removeCount} replacement songs that perfectly match the adjusted vibe. All must be REAL tracks on Spotify. Mix familiar picks from the user's history with discoveries.
- "audioFeatures": Reflect the ADJUSTED vibe (original + adjustment combined).
- Output ONLY the JSON object.`;

  const userMessage = `Original vibe: "${originalPrompt}"
Adjustment requested: "${adjustment}"

Current queue:
${currentSongs.map((s, i) => `${i + 1}. ${s}`).join("\n")}

User's top tracks: ${trackContext}
User's top artists: ${artistContext}

Evaluate the queue against the adjusted vibe, remove the ${removeCount} worst-fitting songs, and suggest ${removeCount} replacements. Reply with ONLY JSON.`;

  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.85,
      },
    });

    const raw = (response.text ?? "").trim();
    if (!raw) continue;

    try {
      return JSON.parse(raw) as QueueAdjustment;
    } catch {
      const jsonStr = extractJson(raw);
      if (jsonStr) {
        try {
          const sanitized = jsonStr
            .replace(/,\s*}/g, "}")
            .replace(/,\s*]/g, "]");
          return JSON.parse(sanitized) as QueueAdjustment;
        } catch { /* retry */ }
      }
    }
  }

  throw new Error("Failed to generate queue adjustment");
}

export async function generateReplacementSong(
  currentSongs: string[],
  prompt: string,
  topTrackNames: string[],
): Promise<string> {
  const systemPrompt = `You are a music curator AI. Given a queue of songs, the original vibe, and the user's listening history, suggest exactly ONE replacement song.

RESPOND WITH ONLY A JSON OBJECT:
{ "song": "song title - artist name" }

CRITICAL RULES:
- Pick ONLY from the user's top tracks listed below
- The song must NOT already be in the queue
- It should match the mood/vibe of the existing queue
- Use the EXACT song title and artist name from the user's history
- Output ONLY the JSON object`;

  const userMessage = `Original vibe: "${prompt}"
Current queue: ${currentSongs.join(", ")}

User's top tracks: ${topTrackNames.join(", ")}

Pick ONE song from the user's top tracks that fits this vibe and isn't in the queue. Reply with ONLY JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userMessage,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      maxOutputTokens: 256,
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0.95,
    },
  });

  const raw = (response.text ?? "").trim();
  if (!raw) throw new Error("Empty response from Gemini");

  try {
    return JSON.parse(raw).song;
  } catch {
    const jsonStr = extractJson(raw);
    if (jsonStr) return JSON.parse(jsonStr).song;
  }
  throw new Error("Failed to generate replacement song");
}
