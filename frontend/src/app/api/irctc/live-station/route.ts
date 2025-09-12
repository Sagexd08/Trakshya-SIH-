import { NextRequest } from "next/server";

const IRCTC_BASE = "https://irctc1.p.rapidapi.com/api/v3/getLiveStation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const station = searchParams.get("station_code");
  const hours = searchParams.get("hours") ?? "2";

  if (!station) {
    return new Response(JSON.stringify({ error: "station_code required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const key = process.env.IRCTC_RAPIDAPI_KEY;
  if (!key) {
    return new Response(
      JSON.stringify({ error: "Server missing IRCTC_RAPIDAPI_KEY" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const url = `${IRCTC_BASE}?station_code=${encodeURIComponent(station)}&hours=${encodeURIComponent(hours)}`;
  try {
    const upstream = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "irctc1.p.rapidapi.com",
      },
      cache: "no-store",
    });

    const text = await upstream.text();
    let data: unknown = null;
    try { data = JSON.parse(text) as unknown; } catch { data = text; }

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: "Upstream error", status: upstream.status, data }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "Fetch failed", message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

