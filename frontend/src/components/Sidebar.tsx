"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  AlertTriangle,
  LineChart,
  FileText,
  Bot,
  Languages,
  Moon,
  Sun,
  Activity,
  ChevronLeft,
  ChevronRight,
  Settings,
  Wifi,
  WifiOff,
  Users,
  Clock
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { strings, type Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const routes = [
  { href: "/", labelKey: "dashboard", icon: LayoutDashboard, badge: null },
  { href: "/conflicts", labelKey: "conflicts", icon: AlertTriangle, badge: "3" },
  { href: "/energy", labelKey: "energy", icon: Zap, badge: null },
  { href: "/scenarios", labelKey: "scenarios", icon: LineChart, badge: null },
  { href: "/traffic", labelKey: "traffic", icon: Activity, badge: "live" },
  { href: "/reports", labelKey: "reports", icon: FileText, badge: null },
  { href: "/ai", labelKey: "ai", icon: Bot, badge: "new" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [lang, setLang] = useState<Lang>("en");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [systemLoad, setSystemLoad] = useState(67);
  const [activeUsers, setActiveUsers] = useState(12);

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemLoad(prev => Math.max(20, Math.min(95, prev + (Math.random() - 0.5) * 10)));
      setActiveUsers(prev => Math.max(1, Math.min(50, prev + Math.floor((Math.random() - 0.5) * 3))));
      setIsOnline(Math.random() > 0.05); // 95% uptime simulation
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const sidebarWidth = isCollapsed ? "w-16" : "w-64";

  return (
    <TooltipProvider>
      <aside className={cn(
        "h-screen bg-neutral-900 text-neutral-100 flex flex-col border-r border-neutral-800 transition-all duration-300 ease-in-out",
        sidebarWidth
      )}>
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-neutral-800">
          {!isCollapsed && (
            <div className="text-xl font-semibold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Trakshya
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </Button>
        </div>

        {/* System Status */}
        {!isCollapsed && (
          <div className="p-3 border-b border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {isOnline ? <Wifi size={12} className="text-green-400" /> : <WifiOff size={12} className="text-red-400" />}
                <span className={isOnline ? "text-green-400" : "text-red-400"}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Users size={12} />
                <span>{activeUsers}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>System Load</span>
                <span>{systemLoad}%</span>
              </div>
              <Progress value={systemLoad} className="h-1" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          {routes.map((route) => {
            const active = pathname === route.href;
            const Icon = route.icon;

            const linkContent = (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md hover:bg-neutral-800 transition-colors relative group",
                  active ? "bg-neutral-800 text-cyan-400" : "text-neutral-300 hover:text-white",
                  isCollapsed ? "justify-center" : ""
                )}
              >
                <Icon size={18} />
                {!isCollapsed && (
                  <>
                    <span className="flex-1">{strings[lang][route.labelKey]}</span>
                    {route.badge && (
                      <span className={cn(
                        "px-1.5 py-0.5 text-xs rounded-full",
                        route.badge === "live" ? "bg-red-500 text-white animate-pulse" :
                        route.badge === "new" ? "bg-blue-500 text-white" :
                        "bg-orange-500 text-white"
                      )}>
                        {route.badge}
                      </span>
                    )}
                  </>
                )}
                {active && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-400 rounded-r" />
                )}
              </Link>
            );

            if (isCollapsed) {
              return (
                <Tooltip key={route.href}>
                  <TooltipTrigger asChild>
                    {linkContent}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>{strings[lang][route.labelKey]}</p>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return linkContent;
          })}
        </nav>

        {/* Settings & Controls */}
        <div className="border-t border-neutral-800">
          {!isCollapsed ? (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start p-3 h-auto">
                  <Settings size={16} />
                  <span className="ml-3">Settings</span>
                  <ChevronRight size={14} className="ml-auto group-data-[state=open]:rotate-90 transition-transform" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-3 pb-3 space-y-3">
                {/* Language Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Languages size={14} />
                    <span>{strings[lang].language}</span>
                  </div>
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as Lang)}
                    className="bg-neutral-800 text-xs rounded px-2 py-1 border border-neutral-700"
                  >
                    <option value="en">EN</option>
                    <option value="hi">हिं</option>
                  </select>
                </div>

                {/* Dark Mode Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
                    <span>{strings[lang].darkMode}</span>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                  />
                </div>

                {/* Real-time Clock */}
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <Clock size={12} />
                  <span>{new Date().toLocaleTimeString()}</span>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="p-2 space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                    {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{strings[lang].darkMode}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

