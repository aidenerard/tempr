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
  searches: string[];
  reasoning: string;
};

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

  const systemPrompt = `You are a music curator AI for an app called Tempr. Given a user's mood/vibe description and their listening history, you must:

1. Map the mood to quantitative Spotify audio feature targets
2. Suggest 25-30 specific real songs that match both the mood AND the user's taste

Return ONLY valid JSON with this exact schema:
{
  "audioFeatures": {
    "energy": 0.0-1.0,
    "valence": 0.0-1.0,
    "danceability": 0.0-1.0,
    "acousticness": 0.0-1.0,
    "tempo": 60-200
  },
  "searches": ["song title artist name", "song title artist name", ...],
  "reasoning": "one sentence explaining the mood mapping and curation logic"
}

Audio feature guidelines:
- energy: 0=calm/ambient, 0.5=moderate, 1=intense/loud
- valence: 0=sad/dark, 0.5=neutral, 1=happy/euphoric
- danceability: 0=freeform, 0.5=moderate groove, 1=strong beat
- acousticness: 0=electronic/produced, 1=fully acoustic
- tempo: BPM (60=slow ballad, 100=mid-tempo, 120=upbeat, 150+=fast)

The "searches" array must contain 25-30 Spotify search queries formatted as "track name artist name". These must be REAL songs that exist on Spotify. Mix well-known tracks with deeper cuts that match the vibe. Heavily consider the user's taste when selecting songs — pick songs similar to what they already listen to but that fit the described mood.`;

  const userMessage = `Mood/vibe: "${prompt}"

User's top tracks: ${trackContext}
User's top artists: ${artistContext}

Generate a queue that matches this vibe.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userMessage,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.9,
    },
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse Gemini response");
  }

  return JSON.parse(jsonMatch[0]) as QueueSuggestion;
}
