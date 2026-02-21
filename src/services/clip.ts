/**
 * CLIP (vision) integration for video mood analysis
 * Analyzes visual mood from user-uploaded video frames
 *
 * NOTE: CLIP typically runs server-side. This service calls a Supabase edge
 * function or external API that runs CLIP inference. The edge function would
 * receive image frames, run CLIP, and return semantic embeddings or mood labels.
 */

export interface ClipMoodResult {
  /** Semantic mood labels (e.g. "cozy", "outdoor", "night") */
  labels: string[];
  /** Normalized scores 0-1 per label */
  scores: number[];
  /** Combined valence-like score from visual mood */
  valence: number;
  /** Combined energy-like score from visual mood */
  energy: number;
}

/**
 * Analyze visual mood from video frame image URI/base64
 * Calls backend edge function - implement CLIP inference there
 */
export async function analyzeVisualMood(
  imageUriOrBase64: string,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<ClipMoodResult> {
  const res = await fetch(`${supabaseUrl}/functions/v1/analyze-clip`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image: imageUriOrBase64 }),
  });
  if (!res.ok) throw new Error(`CLIP analysis error: ${res.status}`);
  return res.json();
}
