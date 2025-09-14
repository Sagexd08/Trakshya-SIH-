// Supabase Edge Function (Deno) — scenario-simulate
// Deploy with: supabase functions deploy scenario-simulate
// Invoke with: supabase functions invoke scenario-simulate --no-verify-jwt -e '{"type":"fog","impactLevel":"moderate"}'

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    const { type = "fog", impactLevel = "moderate" } = await req.json().catch(() => ({}));

    const summary = `Scenario: ${type}. Expected impact: ${impactLevel}. Recommended: add +2 min headway in affected sections, eco-mode for freight.`;
    const metrics = { eta_delta_mean_min: 2.5, energy_saving_pct: 5.2 };

    return new Response(JSON.stringify({ type, impactLevel, summary, metrics }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});

