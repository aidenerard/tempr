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
    .slice(0, 15)
    .map((t) => `"${t.name}" by ${t.artists?.[0]?.name ?? "Unknown"}`)
    .join(", ");

  const artistContext = (topArtists ?? [])
    .slice(0, 10)
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
  "discoveries": ["song title - artist name", ...],
  "reasoning": "one sentence explaining the mood mapping and curation logic"
}

Audio feature guidelines:
- energy: 0=calm/ambient, 0.5=moderate, 1=intense/loud
- valence: 0=sad/dark, 0.5=neutral, 1=happy/euphoric
- danceability: 0=freeform, 0.5=moderate groove, 1=strong beat
- acousticness: 0=electronic/produced, 1=fully acoustic
- tempo: BPM (60=slow ballad, 100=mid-tempo, 120=upbeat, 150+=fast)

CRITICAL RULES:
- "familiar": Pick 5-6 songs FROM the user's top tracks that fit the mood. Use EXACT song titles and artist names from their history.
- "discoveries": Pick 6-8 songs the user has probably NEVER heard. Real songs on Spotify that match the mood. Artists the user does NOT already listen to. Include lesser-known tracks, indie gems, deep cuts. Do NOT repeat any artist from the user's top artists.
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
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.9,
      },
    });

    const raw = (response.text ?? "").trim();

    console.log(`[Gemini] attempt ${attempt + 1}, response length: ${raw.length}`);
    console.log("[Gemini] first 200 chars:", raw.substring(0, 200));

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
