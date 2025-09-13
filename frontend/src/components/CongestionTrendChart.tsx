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

type Point = { t: string; congestion: number };

export default function CongestionTrendChart() {
  // Mock data; replace with API hydration from /api/irctc/* or /api/trains in the future
  const [data, setData] = useState<Point[]>(() =>
    Array.from({ length: 30 }, (_, i) => ({ t: `${i+1}`, congestion: 40 + Math.sin(i / 3) * 25 + (Math.random() * 10 - 5) }))
  );

  useEffect(() => {
    let mounted = true;
    const sample = async () => {
      try {
        const r = await fetch("/api/trains", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const count = Array.isArray(j?.trains) ? j.trains.length : Array.isArray(j) ? j.length : 50;
          const val = Math.max(0, Math.min(100, Math.round(30 + count * 0.7)));
          const label = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          if (!mounted) return;
          setData((prev) => {
            const next = prev.slice(-29);
            next.push({ t: label, congestion: val });
            return next;
          });
        }
      } catch {}
      finally {
        if (mounted) setTimeout(sample, 30000);
      }
    };
    sample();
    return () => { mounted = false; };
  }, []);

  const chartData = useMemo(() => ({
    labels: data.map((d) => d.t),
    datasets: [
      {
        label: "Congestion Index",
        data: data.map((d) => Math.max(0, Math.min(100, Math.round(d.congestion)))),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.15)",
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
      y: { beginAtZero: true, max: 100, grid: { color: "rgba(255,255,255,0.06)" } },
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

