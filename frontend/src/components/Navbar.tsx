"use client";
import { Bell, RefreshCw, Bot } from "lucide-react";
import { useEffect, useState } from "react";

export default function Navbar({ title }: { title: string }) {
  const [time, setTime] = useState<string>("");
  const [load, setLoad] = useState<number>(0);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    const l = setInterval(() => setLoad(Math.floor(Math.random()*100)), 3000); // placeholder
    return () => { clearInterval(t); clearInterval(l); };
  }, []);

  return (
    <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-4 bg-neutral-950/50 backdrop-blur">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-4 text-sm">
        <span className="opacity-80">{time}</span>
        <span className="opacity-80">Load: {load}%</span>
        <button className="hover:text-white"><Bell size={18} /></button>
        <button className="hover:text-white"><RefreshCw size={18} /></button>
        <a href="/ai" className="hover:text-white"><Bot size={18} /></a>
      </div>
    </header>
  );
}

