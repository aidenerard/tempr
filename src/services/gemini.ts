/**
 * Gemini API service for chat-based queue generation and editing
 * Uses natural language to derive mood profiles and adjust queues
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export interface MoodFromPrompt {
  valence: number;
  energy: number;
  danceability: number;
  tempo: number;
  keywords: string[];
  description: string;
}

/**
 * Parse user's natural language prompt into a structured mood profile
 * Used for User-Prompted queue generation (2B) and Chat Editing (4A)
 */
export async function parseMoodFromPrompt(
  userPrompt: string
): Promise<MoodFromPrompt> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
  if (!apiKey) throw new Error("Gemini API key not configured");

  const systemPrompt = `You are a music mood analyzer. Given a user's description of the vibe they want, output a JSON object with:
- valence (0-1): happiness/positivity
- energy (0-1): intensity/activity
- danceability (0-1): how danceable
- tempo (60-180): BPM range, use midpoint
- keywords: array of 3-5 search terms for music (genres, moods, artists)
- description: short summary of the vibe

Only output valid JSON, no markdown or extra text.`;

  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nUser prompt: "${userPrompt}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";
  const json = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(json) as MoodFromPrompt;
}

/**
 * Adjust existing mood profile based on user feedback (e.g. "make it more upbeat")
 */
export async function adjustMoodFromFeedback(
  currentMood: MoodFromPrompt,
  userFeedback: string
): Promise<MoodFromPrompt> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? "";
  if (!apiKey) throw new Error("Gemini API key not configured");

  const systemPrompt = `You adjust music mood profiles. Given the current profile and user feedback, output an updated JSON object with the same structure:
- valence, energy, danceability (0-1)
- tempo (60-180)
- keywords: updated array
- description: updated summary

Only output valid JSON.`;

  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${systemPrompt}\n\nCurrent: ${JSON.stringify(currentMood)}\nFeedback: "${userFeedback}"`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256,
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "{}";
  const json = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(json) as MoodFromPrompt;
}
