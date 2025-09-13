import { NextRequest } from "next/server";

// Basic aggregation: query a small set of stations and derive a 24h synthetic series
// from current activity. This uses "live-station" IRCTC endpoint via RapidAPI key.
// It returns an object: { points: Array<{ h, base, opt }>, meta }

const DEFAULT_STATIONS = ["NDLS", "CSMT", "HWH", "MAS", "SBC", "BCT", "SC"]; // New Delhi, Mumbai CSMT, Howrah, Chennai, Bengaluru, Mumbai Central, Secunderabad

const IRCTC_BASE = "https://irctc1.p.rapidapi.com/api/v3/getLiveStation";

type StationAggregate = { station_code: string; ok: boolean; data: unknown };

type TrainLite = { delay_dep?: number; delay_arr?: number; delay?: number };

type EnergyPoint = { h: number; base: number; opt: number };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const codes = (searchParams.get("station_codes") || DEFAULT_STATIONS.join(",")).split(",").map(s => s.trim()).filter(Boolean);
  const hours = searchParams.get("hours") ?? "2";
  const key = process.env.IRCTC_RAPIDAPI_KEY;

  if (!key) {
    // Graceful mock fallback so frontend stays functional without secrets
    const shape = Array.from({ length: 24 }, (_, h) => {
      const peak1 = Math.exp(-Math.pow(h - 9, 2) / 18);
      const peak2 = Math.exp(-Math.pow(h - 18, 2) / 18);
      return 0.4 + 0.6 * (peak1 + peak2) / 2;
    });
    const points = shape.map((s, h) => {
      const base = s * 75 + 40;
      const opt = base * 0.9;
      return { h, base: Number(base.toFixed(2)), opt: Number(opt.toFixed(2)) };
    });
    return new Response(
      JSON.stringify({ points, meta: { mock: true, reason: "missing_IRCTC_RAPIDAPI_KEY" } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  }

  try {
    const results = await Promise.allSettled<StationAggregate>(
      codes.map(async (station_code) => {
        const url = `${IRCTC_BASE}?station_code=${encodeURIComponent(station_code)}&hours=${encodeURIComponent(hours)}`;
        const r = await fetch(url, { headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "irctc1.p.rapidapi.com" }, cache: "no-store" });
        const j = (await r.json()) as unknown;
        return { station_code, ok: r.ok, data: j } satisfies StationAggregate;
      })
    );

    // Aggregate basic metrics
    let totalTrains = 0;
    let weightedDelay = 0;
    const perStation: Array<{ station_code: string; count: number; avgDelay: number }> = [];

    for (const res of results) {
      if (res.status !== "fulfilled") continue;
      const { station_code, ok, data } = res.value;
      if (!ok || !data || typeof data !== "object") continue;
      const dObj = data as Record<string, unknown>;
      const dataField = dObj["data"];
      const trainsField = dObj["trains"];
      const inner = typeof dataField === "object" && dataField !== null ? (dataField as Record<string, unknown>) : undefined;
      const innerTrains = inner?.["trains"];
      const trains = Array.isArray(innerTrains)
        ? (innerTrains as TrainLite[])
        : Array.isArray(trainsField)
        ? (trainsField as TrainLite[])
        : [];
      const delays: number[] = (trains as TrainLite[])
        .map((t) => Number((t?.delay_dep ?? t?.delay_arr ?? t?.delay) || 0))
        .filter((n) => Number.isFinite(n));
      const count = trains.length;
      const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
      totalTrains += count;
      weightedDelay += avgDelay * Math.max(1, count);
      perStation.push({ station_code, count, avgDelay });
    }

    const avgNetworkDelay = totalTrains ? weightedDelay / totalTrains : 0;

    // Build a 24h series. Use a simple diurnal shape scaled by current load and delay.
    const shape = Array.from({ length: 24 }, (_, h) => {
      const peak1 = Math.exp(-Math.pow(h - 9, 2) / 18);
      const peak2 = Math.exp(-Math.pow(h - 18, 2) / 18);
      const baseCurve = 0.4 + 0.6 * (peak1 + peak2) / 2;
      return baseCurve;
    });

    const baseKwhPerTrainUnit = 50; // tuned constant for demo
    const loadFactor = totalTrains / Math.max(1, codes.length * 15);
    const delayPenalty = 1 + Math.min(0.5, Math.max(0, avgNetworkDelay / 60));

    const points: EnergyPoint[] = totalTrains === 0
      ? Array.from({ length: 24 }, (_, h) => {
          const peak1 = Math.exp(-Math.pow(h - 9, 2) / 18);
          const peak2 = Math.exp(-Math.pow(h - 18, 2) / 18);
          const s = 0.4 + 0.6 * (peak1 + peak2) / 2;
          const base = s * 75 + 40;
          const opt = base * 0.9;
          return { h, base: Number(base.toFixed(2)), opt: Number(opt.toFixed(2)) };
        })
      : shape.map((s, h) => {
          const base = s * loadFactor * delayPenalty * baseKwhPerTrainUnit + 40;
          const opt = base * (1 - Math.min(0.25, avgNetworkDelay / 240));
          return { h, base: Number(base.toFixed(2)), opt: Number(opt.toFixed(2)) };
        });

    return new Response(
      JSON.stringify({ points, meta: { totalTrains, avgNetworkDelay, perStation, mock: totalTrains === 0 } }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "Aggregation failed", message }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

