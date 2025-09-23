"use client";
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HorizonStat { horizon_minutes: number; count: number; pct_within_2m: number|null; pct_within_5m: number|null; avg_accuracy: number|null }

export default function PredictionAccuracyPanel() {
  const [stats, setStats] = useState<HorizonStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aborted = false;
    async function fetchStats() {
      try {
        setLoading(true);
        const r = await fetch('/api/prediction/accuracy?window=7d', { cache: 'no-store' });
        const j = await r.json();
        if (!aborted) setStats(j.horizons || []);
      } catch {
        if (!aborted) setStats([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    fetchStats();
    const id = setInterval(fetchStats, 60_000);
    return () => { aborted = true; clearInterval(id); };
  }, []);

  const getTitle = (m: number) => `${m} min predictions`;
  const fmt = (v: number|null|undefined, suffix = '%') => v==null? '—' : `${v}${suffix}`;

  return (
    <Card className="bg-neutral-900 border-neutral-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-white">Prediction Accuracy (7d)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-xs text-neutral-400">Loading accuracy…</div>
        ) : stats.length === 0 ? (
          <div className="text-xs text-neutral-500">No accuracy data yet</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.horizon_minutes} className="rounded border border-neutral-800 p-3">
                <div className="text-xs text-neutral-400 mb-1">{getTitle(s.horizon_minutes)}</div>
                <div className="text-sm text-neutral-200">Within ±2m: <span className="text-cyan-400">{fmt(s.pct_within_2m)}</span></div>
                <div className="text-xs text-neutral-400">Within ±5m: {fmt(s.pct_within_5m)}</div>
                <div className="text-xs text-neutral-500">Samples: {s.count}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

