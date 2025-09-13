"use client";
import { Bell, RefreshCw, Bot, Settings2, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";


export default function Navbar({ title }: { title: string }) {
  const [time, setTime] = useState<string>("");
  const [load, setLoad] = useState<number>(0);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    const l = setInterval(() => setLoad(Math.floor(Math.random()*100)), 3000); // placeholder
    return () => { clearInterval(t); clearInterval(l); };
  }, []);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const applyMapStyle = (style: string) => {
    try { localStorage.setItem("mapStyle", style); window.dispatchEvent(new Event("storage")); } catch {}
  };

  return (
    <header className="h-14 border-b border-neutral-800 flex items-center justify-between px-4 bg-neutral-950/50 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="size-6 rounded bg-gradient-to-br from-cyan-500 to-emerald-400" />
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="opacity-80 hidden md:inline">{time}</span>
        <span className="opacity-80 hidden md:inline">Load: {load}%</span>

        <Button variant="ghost" size="icon" aria-label="Notifications"><Bell size={18} /></Button>
        <Button variant="ghost" size="icon" aria-label="Refresh"><RefreshCw size={18} /></Button>

        <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm"><Settings2 className="mr-2" size={16}/> Settings</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Map Style</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => applyMapStyle("mapbox://styles/mapbox/dark-v11")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyMapStyle("mapbox://styles/mapbox/light-v11")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyMapStyle("mapbox://styles/mapbox/satellite-streets-v12")}>Satellite</DropdownMenuItem>
            <DropdownMenuSeparator/>
            <DropdownMenuLabel>Quick Links</DropdownMenuLabel>
            <DropdownMenuItem asChild><a href="/ai">AI Assistant</a></DropdownMenuItem>
            <DropdownMenuItem asChild><a href="/reports">Reports</a></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SignedOut>
          <SignInButton>
            <Button variant="secondary" size="sm">Sign in</Button>
          </SignInButton>
          <SignUpButton>
            <Button variant="outline" size="sm">Sign up</Button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>

        <a href="/ai" className="ml-1"><Bot size={18} /></a>
      </div>
    </header>
  );
}

