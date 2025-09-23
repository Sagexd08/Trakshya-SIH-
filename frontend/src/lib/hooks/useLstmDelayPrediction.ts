import { useEffect, useState } from 'react';

export type TrainSeries = { id: string; series: number[] };
export type LstmResult = { id: string; forecast: number[] };

export function useLstmDelayPrediction(trains: TrainSeries[] | null, horizon: number = 12) {
  const [results, setResults] = useState<LstmResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function enrichSeriesViaSupabase(input: TrainSeries[]): Promise<TrainSeries[]> {
      try {
        const needFetch = input.filter(t => !t.series || t.series.length < 5).map(t => t.id);
        if (needFetch.length === 0) return input;
        // Fetch histories in a few batches to avoid long query strings
        const batches: string[][] = [];
        const size = 20;
        for (let i = 0; i < needFetch.length; i += size) batches.push(needFetch.slice(i, i + size));
        const fetched: Record<string, number[]> = {};
        await Promise.all(batches.map(async (ids) => {
          const url = `/api/railway/delay-history?train_ids=${encodeURIComponent(ids.join(','))}&limit=15`;
          const r = await fetch(url);
          const j = await r.json().catch(() => ({ items: [] }));
          const items: Array<{ train_id: string; delay_minutes: number } & any> = j.items || [];
          for (const it of items) {
            const id = String(it.train_id);
            if (!fetched[id]) fetched[id] = [];
            fetched[id].push(Number(it.delay_minutes || 0));
          }
        }));
        return input.map(t => ({ id: t.id, series: (t.series && t.series.length ? t.series : (fetched[t.id] || [])).slice(-15) }));
      } catch {
        return input;
      }
    }

    async function run() {
      if (!trains || trains.length === 0) { setResults([]); return; }
      try {
        setLoading(true); setError(null);
        let enriched = await enrichSeriesViaSupabase(trains);
        const res = await fetch('/api/prediction/lstm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ trains: enriched, horizon })
        });
        const j = await res.json();
        if (!aborted) setResults(j.results || []);
      } catch (e) {
        if (!aborted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    run();
    return () => { aborted = true; };
  }, [JSON.stringify(trains), horizon]);

  return { results, loading, error };
}

