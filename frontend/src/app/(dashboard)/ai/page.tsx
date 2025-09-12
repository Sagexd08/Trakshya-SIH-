"use client";
import { useState } from "react";

export default function AICopilot(){
  const [q, setQ] = useState("");
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">AI Copilot</h2>
      <div className="flex gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Ask: Show delays for Howrah–Delhi trains in next 2 hrs" className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-3 py-2"/>
        <button className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700">Run</button>
      </div>
      <div className="text-sm opacity-75">(This will filter maps/charts accordingly in a future step.)</div>
    </div>
  );
}

