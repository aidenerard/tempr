/**
 * Supabase Edge Function: OpenL3 audio mood analysis
 * Receives audio URI, runs OpenL3 inference (implement with Python or external API),
 * returns mood profile for queue generation.
 *
 * NOTE: OpenL3 inference requires a Python runtime or external service.
 * This is a stub - implement with your preferred OpenL3 deployment.
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
    const { audioUri } = await req.json();
    if (!audioUri) {
      return new Response(
        JSON.stringify({ error: "Missing audioUri" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // TODO: Implement OpenL3 inference - fetch audio, run model
    // For now return mock mood
    const mockResult = {
      valence: 0.5,
      energy: 0.5,
      tags: ["ambient", "chill"],
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
