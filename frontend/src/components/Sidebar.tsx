"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Zap, AlertTriangle, LineChart, FileText, Bot, Languages, Moon, Sun, Activity } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { strings, type Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

const routes = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/conflicts", labelKey: "conflicts", icon: AlertTriangle },
  { href: "/energy", labelKey: "energy", icon: Zap },
  { href: "/scenarios", labelKey: "scenarios", icon: LineChart },
  { href: "/traffic", labelKey: "traffic", icon: Activity },
  { href: "/reports", labelKey: "reports", icon: FileText },
  { href: "/ai", labelKey: "ai", icon: Bot },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useState<Lang>("en");

  return (
    <aside className="h-screen w-64 bg-neutral-900 text-neutral-100 flex flex-col border-r border-neutral-800">
      <div className="p-4 text-xl font-semibold">Trakshya</div>
      <nav className="flex-1 px-2 space-y-1">
        {routes.map((r) => {
          const active = pathname === r.href;
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href} className={`flex items-center gap-3 px-3 py-2 rounded-md hover:bg-neutral-800 ${active ? "bg-neutral-800" : ""}`}>
              <Icon size={18} />
              <span>{strings[lang][r.labelKey]}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 space-y-2 border-t border-neutral-800">
        <div className="flex items-center justify-between">
          <span className="text-sm opacity-80 flex items-center gap-2"><Languages size={16}/> {strings[lang].language}</span>
          <select value={lang} onChange={(e)=>setLang(e.target.value as Lang)} className="bg-neutral-800 text-sm rounded px-2 py-1">
            <option value="en">EN</option>
            <option value="hi">हिं</option>
          </select>
        </div>
        <Button variant="secondary" className="w-full" onClick={()=> setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>}
          <span className="ml-2">{strings[lang].darkMode}</span>
        </Button>
      </div>
    </aside>
  );
}

