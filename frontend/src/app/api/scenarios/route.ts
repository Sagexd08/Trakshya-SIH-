import { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

// Expected table in Supabase:
// create table if not exists public.scenarios (
//   id uuid primary key default gen_random_uuid(),
//   name text not null,
//   payload jsonb not null default '{}',
//   created_at timestamptz not null default now()
// );

export async function GET() {
  try {
    const sb = createSupabaseAdmin();
    const { data, error } = await sb.from("scenarios").select("id,name,created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return new Response(JSON.stringify({ scenarios: data }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const name: string | undefined = body?.name;
    const payload: unknown = body?.payload ?? {};
    if (!name) {
      return new Response(JSON.stringify({ error: "name is required" }), { status: 400, headers: { "content-type": "application/json" } });
    }
    const sb = createSupabaseAdmin();
    const { data, error } = await sb.from("scenarios").insert({ name, payload }).select("id,name,created_at").single();
    if (error) throw error;
    return new Response(JSON.stringify({ scenario: data }), { status: 201, headers: { "content-type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

