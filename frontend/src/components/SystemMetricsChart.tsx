"use client";
import { useMemo, useState } from "react";
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

type Point = { t: string; cpu: number; net: number };

export default function SystemMetricsChart() {
  const [data] = useState<Point[]>(() =>
    Array.from({ length: 24 }, (_, i) => ({
      t: `${i}:00`,
      cpu: 30 + Math.random() * 40,
      net: 20 + Math.random() * 50,
    }))
  );

  /* useEffect(() => {
    let mounted = true;
    // Placeholder for future hydration from an API endpoint
    // try { const r = await fetch("/api/metrics/system", { cache: "no-store" }); ... }
    return () => {
      mounted = false;
    };
  }, []); */

  const chartData = useMemo(() => ({
    labels: data.map((d) => d.t),
    datasets: [
      {
        label: "CPU %",
        data: data.map((d) => Math.round(d.cpu)),
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.15)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: "Network %",
        data: data.map((d) => Math.round(d.net)),
        borderColor: "#60a5fa",
        backgroundColor: "rgba(96,165,250,0.15)",
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

