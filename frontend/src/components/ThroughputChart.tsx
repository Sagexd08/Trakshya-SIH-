"use client";
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

type Point = { t: string; baseline: number; scenario: number };

export default function ThroughputChart() {
  // Mock data; replace with API hydration from /api/energy/* or a scenarios API in the future
  const [data, setData] = useState<Point[]>(() =>
    Array.from({ length: 24 }, (_, i) => ({
      t: `${i}:00`,
      baseline: 60 + Math.sin(i / 4) * 15 + Math.random() * 5,
      scenario: 68 + Math.sin((i + 2) / 4) * 15 + Math.random() * 5,
    }))
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch("/api/energy/series", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const pts = Array.isArray(j?.points) ? j.points as Array<{ h: number; base: number; opt: number }> : null;
          if (mounted && pts) {
            setData(pts.map(p => ({ t: `${p.h}:00`, baseline: p.base, scenario: p.opt })));
          }
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const chartData = useMemo(() => ({
    labels: data.map((d) => d.t),
    datasets: [
      {
        label: "Baseline",
        data: data.map((d) => Math.round(d.baseline)),
        borderColor: "#8884d8",
        backgroundColor: "rgba(136,132,216,0.18)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: "Scenario",
        data: data.map((d) => Math.round(d.scenario)),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.18)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  }), [data]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false as const,
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.06)" } },
      x: { grid: { display: false } },
    },
    plugins: {
      legend: { labels: { color: "#cbd5e1" } },
      tooltip: { mode: "index" as const, intersect: false },
    },
  }), []);

  return (
    <div className="w-full h-64">
      <Line data={chartData} options={options} />
    </div>
  );
}

