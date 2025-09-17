import { NextRequest } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUserRole, hasRole } from "@/lib/authz";

// Expected table in Supabase:
// create table if not exists public.train_positions (
//   id uuid primary key default gen_random_uuid(),
//   train_no text not null,
//   lat double precision not null,
//   lon double precision not null,
//   speed_kmph double precision,
//   ts timestamptz not null default now()
// );

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '500');
    const realtime = searchParams.get('realtime') === 'true';

    const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Enhanced mock data for when Supabase is not available or for demo purposes
    if (!hasSupabase || !realtime) {
      const mockTrains = [
        {
          id: "12301",
          train_no: "12301",
          name: "Rajdhani Express",
          from: "New Delhi",
          to: "Howrah",
          current_station: "Kanpur Central",
          next_station: "Allahabad",
          lat: 26.4499,
          lon: 80.3319,
          speed_kmph: 85,
          delay_minutes: 15,
          status: "running",
          region: "Northern Railway",
          ts: new Date().toISOString(),
          energy_efficiency: 92,
          passenger_load: 85
        },
        {
          id: "12002",
          train_no: "12002",
          name: "Shatabdi Express",
          from: "New Delhi",
          to: "Chandigarh",
          current_station: "Ambala Cantt",
          next_station: "Chandigarh",
          lat: 30.3398,
          lon: 76.7794,
          speed_kmph: 95,
          delay_minutes: 0,
          status: "on-time",
          region: "Northern Railway",
          ts: new Date().toISOString(),
          energy_efficiency: 88,
          passenger_load: 78
        },
        {
          id: "12626",
          train_no: "12626",
          name: "Kerala Express",
          from: "New Delhi",
          to: "Thiruvananthapuram",
          current_station: "Ernakulam",
          next_station: "Kottayam",
          lat: 9.9312,
          lon: 76.2673,
          speed_kmph: 65,
          delay_minutes: 45,
          status: "delayed",
          region: "Southern Railway",
          ts: new Date().toISOString(),
          energy_efficiency: 85,
          passenger_load: 92
        },
        {
          id: "12951",
          train_no: "12951",
          name: "Mumbai Rajdhani",
          from: "Mumbai Central",
          to: "New Delhi",
          current_station: "Vadodara",
          next_station: "Ratlam",
          lat: 22.3072,
          lon: 73.2081,
          speed_kmph: 110,
          delay_minutes: 8,
          status: "running",
          region: "Western Railway",
          ts: new Date().toISOString(),
          energy_efficiency: 94,
          passenger_load: 88
        },
        {
          id: "12840",
          train_no: "12840",
          name: "Chennai Mail",
          from: "Chennai Central",
          to: "Howrah",
          current_station: "Visakhapatnam",
          next_station: "Bhubaneswar",
          lat: 17.6868,
          lon: 83.2185,
          speed_kmph: 75,
          delay_minutes: 25,
          status: "delayed",
          region: "Eastern Railway",
          ts: new Date().toISOString(),
          energy_efficiency: 87,
          passenger_load: 95
        }
      ];

      // Add real-time variation to simulate live data
      const enhancedTrains = mockTrains.map(train => ({
        ...train,
        delay_minutes: Math.max(0, train.delay_minutes + Math.floor((Math.random() - 0.5) * 4)),
        speed_kmph: Math.max(20, train.speed_kmph + Math.floor((Math.random() - 0.5) * 10)),
        lat: train.lat + (Math.random() - 0.5) * 0.01,
        lon: train.lon + (Math.random() - 0.5) * 0.01,
        ts: new Date().toISOString()
      }));

      // Apply filters
      let filteredTrains = enhancedTrains;
      if (region) {
        filteredTrains = filteredTrains.filter(train =>
          train.region.toLowerCase().includes(region.toLowerCase())
        );
      }
      if (status) {
        filteredTrains = filteredTrains.filter(train => train.status === status);
      }
      filteredTrains = filteredTrains.slice(0, limit);

      return new Response(
        JSON.stringify({
          trains: filteredTrains,
          total: filteredTrains.length,
          timestamp: new Date().toISOString(),
          source: "enhanced_simulation",
          meta: { mock: true, reason: hasSupabase ? "demo_mode" : "missing_supabase_env" }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    // Real Supabase data
    const sb = createSupabaseAdmin();
    const { data, error } = await sb
      .from("train_positions")
      .select("id,train_no,lat,lon,speed_kmph,ts")
      .order("ts", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return new Response(JSON.stringify({
      positions: data ?? [],
      total: data?.length ?? 0,
      timestamp: new Date().toISOString(),
      source: "supabase_realtime"
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

export async function POST(req: NextRequest) {
  try {
    const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!hasSupabase) {
      return new Response(
        JSON.stringify({ inserted: 0, rows: [], meta: { mock: true, reason: "missing_supabase_env" } }),
        { status: 202, headers: { "content-type": "application/json" } }
      );
    }

    const role = await getCurrentUserRole();
    if (!hasRole(role, ["admin", "controller"])) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "content-type": "application/json" } });
    }

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

