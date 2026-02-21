/**
 * Supabase Edge Function: CLIP visual mood analysis
 * Receives image, runs CLIP inference (implement with Python or external API),
 * returns mood profile for queue generation.
 *
 * NOTE: CLIP inference requires a Python runtime or external service.
 * This is a stub - implement with your preferred CLIP deployment.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(
        JSON.stringify({ error: "Missing image" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Implement CLIP inference - call Python service or external API
    // For now return mock mood
    const mockResult = {
      labels: ["cozy", "indoor", "warm"],
      scores: [0.8, 0.7, 0.6],
      valence: 0.6,
      energy: 0.4,
    };

    return new Response(JSON.stringify(mockResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
