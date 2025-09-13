import { NextRequest } from "next/server";

const IRCTC_BASE = "https://irctc1.p.rapidapi.com/api/v3/getLiveStation";

// In-memory TTL cache (note: per-server instance; ephemeral on serverless)
const cache = new Map<string, { expiry: number; payload: unknown; status: number }>();
const CACHE_TTL_MS = 30_000; // 30s

// Simple per-IP rate limiter (sliding window)
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests/min/IP
const ipHits = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",").map(s => s.trim()).find(Boolean) || req.headers.get("x-real-ip") || "unknown";
  return ip as string;
}

function okStationCode(code: string): boolean {
  return /^[A-Z]{2,5}$/.test(code);
}

export async function GET(req: NextRequest) {
  const t0 = Date.now();
  const { searchParams } = new URL(req.url);
  const station = (searchParams.get("station_code") || "").toUpperCase();
  const hours = String(Number(searchParams.get("hours") ?? "2") || 2);
  const ip = getClientIp(req);

  // Basic validation
  if (!station) {
    return new Response(JSON.stringify({ error: "station_code required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  if (!okStationCode(station)) {
    return new Response(JSON.stringify({ error: "invalid station_code format" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  // Rate limiting (sliding window)
  const now = Date.now();
  const arr = ipHits.get(ip) || [];
  const recent = arr.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: "rate_limited", retry_after_ms: RATE_LIMIT_WINDOW_MS - (now - recent[0]) }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": Math.ceil((RATE_LIMIT_WINDOW_MS - (now - recent[0])) / 1000).toString() },
    });
  }
  recent.push(now);
  ipHits.set(ip, recent);

  const key = process.env.IRCTC_RAPIDAPI_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "Server missing IRCTC_RAPIDAPI_KEY" }), { status: 500, headers: { "content-type": "application/json" } });
  }

  const cacheKey = `${station}|${hours}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > now) {
    const dt = Date.now() - t0;
    console.log(`[irctc/live-station] ip=${ip} station=${station} hours=${hours} status=${cached.status} ms=${dt} cache=HIT`);
    return new Response(JSON.stringify(cached.payload), {
      status: cached.status,
      headers: { "content-type": "application/json", "x-cache": "HIT" },
    });
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

    const status = upstream.ok ? 200 : 502;
    const payload = upstream.ok ? data : { error: "Upstream error", status: upstream.status, data };

    // Cache only successful responses
    if (upstream.ok) {
      cache.set(cacheKey, { expiry: Date.now() + CACHE_TTL_MS, payload, status });
    }

    const dt = Date.now() - t0;
    console.log(`[irctc/live-station] ip=${ip} station=${station} hours=${hours} status=${status} ms=${dt} cache=${upstream.ok ? "MISS" : "BYPASS"}`);

    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json", "cache-control": "private, max-age=30", "x-cache": upstream.ok ? "MISS" : "BYPASS" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const dt = Date.now() - t0;
    console.error(`[irctc/live-station] ip=${ip} station=${station} hours=${hours} status=500 ms=${dt} error=${message}`);
    return new Response(JSON.stringify({ error: "fetch_failed", message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

