"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { getJSON } from "@/lib/api";
import { getSocket } from "@/lib/socket";

type Point = { h: number; base: number; opt: number };

enum Source {
  Mock = "mock",
  Local = "local",
  Backend = "backend",
}

export default function EnergyChart(){
  const [data, setData] = useState<Point[]>(Array.from({length: 24}, (_,i)=>({ h: i, base: 60+Math.random()*20, opt: 50+Math.random()*20 })));
  const [source, setSource] = useState<Source>(Source.Mock);

  useEffect(()=>{
    let mounted = true;

    async function hydrate() {
      // 1) Prefer local Next.js route that aggregates live RapidAPI data
      try {
        const r = await fetch("/api/energy/series", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const pts = Array.isArray(j?.points) ? j.points as Point[] : null;
          if (mounted && pts) { setData(pts); setSource(Source.Local); return; }
        }
      } catch {}

      // 2) Fallback to existing backend if configured
      try {
        const d = await getJSON<Point[]>("/metrics/energy");
        if (mounted && Array.isArray(d)) { setData(d); setSource(Source.Backend); return; }
      } catch {}

      // 3) Stay on mock if nothing else available
      if (mounted) setSource(Source.Mock);
    }

    void hydrate();

    // Subscribe to socket updates if available
    try {
      const s = getSocket();
      s.on("energy", (payload: Point[])=>{ if (mounted && Array.isArray(payload)) setData(payload); });
    } catch {}

    return ()=>{ mounted=false; };
  },[]);

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="h"/>
          <YAxis/>
          <Tooltip/>
          <Legend/>
          <Line type="monotone" dataKey="base" stroke="#8884d8" dot={false} />
          <Line type="monotone" dataKey="opt" stroke="#22c55e" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-[10px] opacity-60 mt-1">Data source: {source}</div>
    </div>
  );
}

