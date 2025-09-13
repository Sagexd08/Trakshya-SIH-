import { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

// Expected table in Supabase:
// create table if not exists public.train_positions (
//   id uuid primary key default gen_random_uuid(),
//   train_no text not null,
//   lat double precision not null,
//   lon double precision not null,
//   speed_kmph double precision,
//   ts timestamptz not null default now()
// );

export async function GET() {
  try {
    const sb = createSupabaseAdmin();
    const { data, error } = await sb
      .from("train_positions")
      .select("id,train_no,lat,lon,speed_kmph,ts")
      .order("ts", { ascending: false })
      .limit(500);
    if (error) throw error;
    return new Response(JSON.stringify({ positions: data ?? [] }), { status: 200, headers: { "content-type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const rows = items.map((x) => ({
      train_no: String(x.train_no),
      lat: Number(x.lat),
      lon: Number(x.lon),
      speed_kmph: x.speed_kmph != null ? Number(x.speed_kmph) : null,
      ts: x.ts ? new Date(x.ts).toISOString() : undefined,
    }));
    const sb = createSupabaseAdmin();
    const { data, error } = await sb.from("train_positions").insert(rows).select("id,train_no,lat,lon,speed_kmph,ts");
    if (error) throw error;
    try {
      const { broadcast } = await import("@/lib/wsHub");
      broadcast({ type: "train_positions_inserted", count: data?.length ?? 0, t: Date.now() });
    } catch {}
    return new Response(JSON.stringify({ inserted: data?.length ?? 0, rows: data }), { status: 201, headers: { "content-type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

