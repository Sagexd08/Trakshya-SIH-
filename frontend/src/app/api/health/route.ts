export async function GET() {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  const ok = missing.length === 0;
  return new Response(
    JSON.stringify({ ok, missing }),
    { status: ok ? 200 : 500, headers: { "content-type": "application/json" } }
  );
}

