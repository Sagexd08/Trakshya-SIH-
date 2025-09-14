// Supabase Edge Function (Deno) — conflict-predict
// Deploy with: supabase functions deploy conflict-predict
// Invoke with: supabase functions invoke conflict-predict --no-verify-jwt -e '{"section":"Delhi-Howrah","windowMin":45}'

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  try {
    const env = Deno.env.toObject();
    const { section = "Delhi-Howrah", windowMin = 45 } = await req.json().catch(() => ({}));

    // TODO: Fetch from Postgres (trains, sections) using service key (env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    // For prototype, return a synthetic set
    const now = new Date();
    const soon = new Date(now.getTime() + Number(windowMin) * 60_000);
    const conflicts = [
      { train_a: "T123", train_b: "T456", predicted_time: soon.toISOString(), severity: "medium" },
      { train_a: "T789", train_b: "T234", predicted_time: new Date(soon.getTime() + 12 * 60_000).toISOString(), severity: "low" },
    ];

    return new Response(JSON.stringify({ section, windowMin: Number(windowMin), conflicts }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});

