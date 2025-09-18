"use client";
import {
  Bell,
  RefreshCw,
  Bot,
  Settings2,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Activity,
  Zap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Users,
  Train,
  Clock,
  MapPin
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
// Disable Clerk components for now to prevent server action errors
const hasClerk = false; // Set to false to disable Clerk components
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SystemMetrics {
  load: number;
  throughput: number;
  activeTrains: number;
  conflicts: number;
  energyEfficiency: number;
  onlineUsers: number;
  lastUpdate: Date;
}

interface Notification {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export default function Navbar({ title }: { title: string }) {
  const [time, setTime] = useState<string>("");
  const [metrics, setMetrics] = useState<SystemMetrics>({
    load: 67,
    throughput: 85,
    activeTrains: 142,
    conflicts: 3,
    energyEfficiency: 92,
    onlineUsers: 12,
    lastUpdate: new Date()
  });
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      type: "critical",
      title: "Conflict Alert",
      message: "Potential collision detected on Delhi-Mumbai route",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      read: false
    },
    {
      id: "2",
      type: "warning",
      title: "Energy Spike",
      message: "Train T789 showing 15% above baseline consumption",
      timestamp: new Date(Date.now() - 12 * 60 * 1000),
      read: false
    },
    {
      id: "3",
      type: "info",
      title: "Route Optimized",
      message: "AI successfully optimized Howrah-Chennai corridor",
      timestamp: new Date(Date.now() - 25 * 60 * 1000),
      read: true
    }
  ]);
  const [isOnline, setIsOnline] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: 'Asia/Kolkata'
      }));
    };

    updateTime();
    const timeInterval = setInterval(updateTime, 1000);

    // Simulate real-time metrics updates
    const metricsInterval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        load: Math.max(20, Math.min(95, prev.load + (Math.random() - 0.5) * 8)),
        throughput: Math.max(60, Math.min(100, prev.throughput + (Math.random() - 0.5) * 5)),
        activeTrains: Math.max(100, Math.min(200, prev.activeTrains + Math.floor((Math.random() - 0.5) * 6))),
        conflicts: Math.max(0, Math.min(10, prev.conflicts + Math.floor((Math.random() - 0.5) * 2))),
        energyEfficiency: Math.max(75, Math.min(98, prev.energyEfficiency + (Math.random() - 0.5) * 3)),
        onlineUsers: Math.max(5, Math.min(50, prev.onlineUsers + Math.floor((Math.random() - 0.5) * 3))),
        lastUpdate: new Date()
      }));

      // Simulate connection status
      setIsOnline(Math.random() > 0.02); // 98% uptime
    }, 3000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(metricsInterval);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Simulate API refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success("Data refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh data");
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const applyMapStyle = (style: string) => {
    try {
      localStorage.setItem("mapStyle", style);
      window.dispatchEvent(new Event("storage"));
      toast.success("Map style updated");
    } catch {
      toast.error("Failed to update map style");
    }
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="h-16 border-b border-neutral-800 flex items-center justify-between px-4 bg-neutral-950/80 backdrop-blur-md">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-400 flex items-center justify-center">
            <Train size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <MapPin size={10} />
              <span>Indian Railways Control Center</span>
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
          isOnline ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        )}>
          {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
          <span>{isOnline ? "Online" : "Offline"}</span>
        </div>
      </div>

      {/* Center Section - Real-time Metrics */}
      <div className="hidden lg:flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-blue-400" />
          <span className="text-neutral-300">Load:</span>
          <span className={cn(
            "font-mono",
            metrics.load > 80 ? "text-red-400" : metrics.load > 60 ? "text-yellow-400" : "text-green-400"
          )}>
            {metrics.load.toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Train size={14} className="text-cyan-400" />
          <span className="text-neutral-300">Trains:</span>
          <span className="font-mono text-white">{metrics.activeTrains}</span>
        </div>

        <div className="flex items-center gap-2">
          <Zap size={14} className="text-yellow-400" />
          <span className="text-neutral-300">Efficiency:</span>
          <span className="font-mono text-green-400">{metrics.energyEfficiency.toFixed(0)}%</span>
        </div>

        {metrics.conflicts > 0 && (
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-neutral-300">Conflicts:</span>
            <Badge variant="destructive" className="text-xs">
              {metrics.conflicts}
            </Badge>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 text-sm">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-neutral-800/50 rounded-md">
          <Clock size={14} className="text-neutral-400" />
          <span className="font-mono text-white">{time}</span>
          <span className="text-xs text-neutral-400">IST</span>
        </div>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={18} />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 text-xs p-0 flex items-center justify-center"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 border-b border-neutral-800">
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-neutral-400">{unreadCount} unread</p>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 border-b border-neutral-800 cursor-pointer hover:bg-neutral-800/50",
                    !notification.read && "bg-neutral-800/20"
                  )}
                  onClick={() => markNotificationAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-1",
                      notification.type === "critical" ? "text-red-400" :
                      notification.type === "warning" ? "text-yellow-400" : "text-blue-400"
                    )}>
                      {notification.type === "critical" ? <AlertTriangle size={16} /> :
                       notification.type === "warning" ? <Activity size={16} /> : <Bell size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-xs text-neutral-400 mt-1">{notification.message}</p>
                      <p className="text-xs text-neutral-500 mt-2">
                        {notification.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Refresh Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className={cn(isRefreshing && "animate-spin")}
        >
          <RefreshCw size={18} />
        </Button>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
        </Button>

        {/* Settings Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="mr-2" size={16}/>
              Settings
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Map Settings</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => applyMapStyle("mapbox://styles/mapbox/dark-v11")}>
              <Moon className="mr-2" size={14} />
              Dark Map
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyMapStyle("mapbox://styles/mapbox/light-v11")}>
              <Sun className="mr-2" size={14} />
              Light Map
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => applyMapStyle("mapbox://styles/mapbox/satellite-streets-v12")}>
              <MapPin className="mr-2" size={14} />
              Satellite View
            </DropdownMenuItem>
            <DropdownMenuSeparator/>
            <DropdownMenuLabel>System Metrics</DropdownMenuLabel>
            <DropdownMenuItem className="flex-col items-start p-3">
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs">
                  <span>System Load</span>
                  <span>{metrics.load.toFixed(0)}%</span>
                </div>
                <Progress value={metrics.load} className="h-1" />
                <div className="flex justify-between text-xs">
                  <span>Throughput</span>
                  <span>{metrics.throughput.toFixed(0)}%</span>
                </div>
                <Progress value={metrics.throughput} className="h-1" />
                <div className="flex justify-between text-xs">
                  <span>Energy Efficiency</span>
                  <span>{metrics.energyEfficiency.toFixed(0)}%</span>
                </div>
                <Progress value={metrics.energyEfficiency} className="h-1" />
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator/>
            <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href="/ai" className="flex items-center">
                <Bot className="mr-2" size={14} />
                AI Assistant
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/reports" className="flex items-center">
                <TrendingUp className="mr-2" size={14} />
                Reports
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href="/scenarios" className="flex items-center">
                <Activity className="mr-2" size={14} />
                Scenarios
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Authentication - Demo Mode */}
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled>
            Sign in (Demo)
          </Button>
          <Button variant="outline" size="sm" disabled>
            Sign up (Demo)
          </Button>
        </div>

        {/* AI Assistant Quick Access */}
        <Button variant="ghost" size="icon" asChild>
          <a href="/ai" aria-label="AI Assistant">
            <Bot size={18} className="text-cyan-400" />
          </a>
        </Button>
      </div>
    </header>
  );
}

