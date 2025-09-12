"use client";
import * as d3 from "d3";
import { useEffect, useRef, useState } from "react";
import { getJSON } from "@/lib/api";
import { getSocket } from "@/lib/socket";

type Cell = { t: number; d: number; v: number };

export default function ConflictHeatmap() {
  const ref = useRef<SVGSVGElement>(null);
  const [cells, setCells] = useState<Cell[] | null>(null);

  useEffect(() => {
    let mounted = true;
    // initial fetch
    getJSON<Cell[]>("/metrics/conflicts").then((d)=>{ if(mounted && Array.isArray(d)) setCells(d); }).catch(()=>{
      // fallback mock if API not ready
      const time: number[] = d3.range(0, 24) as number[];
      const distance: number[] = d3.range(0, 10) as number[];
      const mock: Cell[] = distance.flatMap((dd: number) => time.map((t: number) => ({ t, d: dd, v: Math.random() })));
      setCells(mock);
    });
    // socket
    try{
      const s = getSocket();
      s.on("conflicts", (payload: Cell[])=>{ if(mounted && Array.isArray(payload)) setCells(payload); });
    }catch{}
    return ()=>{ mounted=false; };
  }, []);

  useEffect(() => {
    if (!cells) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();
    const width = 600, height = 220;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const time = Array.from(new Set(cells.map(c=>c.t))).sort((a,b)=>a-b).map(String);
    const dist = Array.from(new Set(cells.map(c=>c.d))).sort((a,b)=>a-b).map(String);

    const x = d3.scaleBand().domain(time).range([50, width-10]).padding(0.05);
    const y = d3.scaleBand().domain(dist).range([10, height-30]).padding(0.05);
    const color = d3.scaleSequential(d3.interpolateInferno).domain([1,0]);

    svg.append("g").selectAll("rect").data(cells).enter().append("rect")
      .attr("x", (r: Cell)=> x(String(r.t))!)
      .attr("y", (r: Cell)=> y(String(r.d))!)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("rx", 2)
      .attr("fill", (r: Cell)=> color(r.v));

    svg.append("g").attr("transform", `translate(0,${height-25})`).call(d3.axisBottom(x)).selectAll("text").attr("font-size","8px");
    svg.append("g").attr("transform", `translate(50,0)`).call(d3.axisLeft(y)).selectAll("text").attr("font-size","10px");
  }, [cells]);

  return <svg ref={ref} className="w-full h-[240px]" />;
}

