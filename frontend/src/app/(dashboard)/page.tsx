"use client";
import { useState, useEffect } from "react";
import DigitalTwinMap from "@/components/DigitalTwinMap";
import ConflictHeatmap from "@/components/ConflictHeatmap";
import EnergyChart from "@/components/EnergyChart";
import DelayForecast from "@/components/DelayForecast";
import DecisionCard from "@/components/DecisionCard";
import ScenarioModal from "@/components/ScenarioModal";
import AIInsightsPanel from "@/components/AIInsightsPanel";
import AssistantPanel from "@/components/AssistantPanel";
import { SystemContext } from "@/lib/gemini";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Maximize2,
  Minimize2,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  AlertTriangle,
  Train,
  Clock,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface DashboardMetrics {
  totalTrains: number;
  activeConflicts: number;
  energyEfficiency: number;
  avgDelay: number;
  throughput: number;
  onlineControllers: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalTrains: 142,
    activeConflicts: 3,
    energyEfficiency: 92.4,
    avgDelay: 4.2,
    throughput: 87.6,
    onlineControllers: 12
  });
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // AI Context for components
  const aiContext: SystemContext = {
    activeTrains: metrics.totalTrains,
    conflicts: [
      {
        id: "conflict-1",
        trainA: "12432",
        trainB: "12001",
        severity: "high" as const,
        predictedTime: new Date(Date.now() + 15 * 60000).toISOString() // 15 minutes from now
      },
      {
        id: "conflict-2",
        trainA: "18005",
        trainB: "22691",
        severity: "medium" as const,
        predictedTime: new Date(Date.now() + 45 * 60000).toISOString() // 45 minutes from now
      }
    ],
    energyEfficiency: metrics.energyEfficiency,
    avgDelay: metrics.avgDelay,
    throughput: metrics.throughput,
    userRole: 'controller',
    currentView: 'dashboard'
  };

  // Simulate real-time metrics updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        totalTrains: Math.max(100, Math.min(200, prev.totalTrains + Math.floor((Math.random() - 0.5) * 6))),
        activeConflicts: Math.max(0, Math.min(10, prev.activeConflicts + Math.floor((Math.random() - 0.5) * 2))),
        energyEfficiency: Math.max(85, Math.min(98, prev.energyEfficiency + (Math.random() - 0.5) * 2)),
        avgDelay: Math.max(0, Math.min(15, prev.avgDelay + (Math.random() - 0.5) * 1)),
        throughput: Math.max(70, Math.min(100, prev.throughput + (Math.random() - 0.5) * 3)),
        onlineControllers: Math.max(5, Math.min(25, prev.onlineControllers + Math.floor((Math.random() - 0.5) * 2)))
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const metricCards = [
    {
      title: "Active Trains",
      value: metrics.totalTrains,
      icon: Train,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      trend: "+2.3%"
    },
    {
      title: "Conflicts",
      value: metrics.activeConflicts,
      icon: AlertTriangle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      trend: "-12%"
    },
    {
      title: "Energy Efficiency",
      value: `${metrics.energyEfficiency.toFixed(1)}%`,
      icon: Zap,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      trend: "+5.2%"
    },
    {
      title: "Avg Delay",
      value: `${metrics.avgDelay.toFixed(1)}m`,
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      trend: "-8.1%"
    },
    {
      title: "Throughput",
      value: `${metrics.throughput.toFixed(1)}%`,
      icon: Activity,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      trend: "+3.7%"
    },
    {
      title: "Controllers",
      value: metrics.onlineControllers,
      icon: Users,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      trend: "+1"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Control Center Dashboard</h1>
          <p className="text-neutral-400">Real-time monitoring and AI-powered optimization</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={cn(isRefreshing && "animate-spin")}
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download size={16} className="mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricCards.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="bg-neutral-900/50 border-neutral-800 hover:bg-neutral-900/80 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={cn("p-2 rounded-lg", metric.bgColor)}>
                    <metric.icon size={20} className={metric.color} />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{metric.value}</div>
                    <div className="text-xs text-neutral-400">{metric.title}</div>
                    <div className={cn(
                      "text-xs flex items-center gap-1 mt-1",
                      metric.trend.startsWith('+') ? "text-green-400" : "text-red-400"
                    )}>
                      {metric.trend.startsWith('+') ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {metric.trend}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Digital Twin Map */}
        <motion.div
          className={cn(
            "lg:col-span-2 transition-all duration-300",
            expandedCard === "map" ? "lg:col-span-3" : ""
          )}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-neutral-900/50 border-neutral-800 h-[500px]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Digital Twin Map
                  <Badge variant="secondary" className="ml-2">Live</Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleCardExpansion("map")}
                >
                  {expandedCard === "map" ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2 h-[420px]">
              <DigitalTwinMap />
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Panel */}
        {expandedCard !== "map" && (
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <ScenarioModal />
            <AssistantPanel
              context={aiContext}
              onRecommendationApply={(recommendation) => {
                console.log('Applied recommendation:', recommendation);
                // Handle recommendation application
              }}
            />
          </motion.div>
        )}
      </div>

      {/* Secondary Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conflict Heatmap */}
        <motion.div
          className={cn(
            "lg:col-span-2 transition-all duration-300",
            expandedCard === "conflicts" ? "lg:col-span-3" : ""
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-neutral-900/50 border-neutral-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle size={18} className="text-red-400" />
                  Conflict Heatmap
                  {metrics.activeConflicts > 0 && (
                    <Badge variant="destructive">{metrics.activeConflicts} active</Badge>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleCardExpansion("conflicts")}
                >
                  {expandedCard === "conflicts" ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <ConflictHeatmap />
            </CardContent>
          </Card>
        </motion.div>

        {/* Energy Chart */}
        {expandedCard !== "conflicts" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-neutral-900/50 border-neutral-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap size={18} className="text-yellow-400" />
                  Energy Efficiency
                  <Badge variant="secondary">{metrics.energyEfficiency.toFixed(1)}%</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <EnergyChart />
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Delay Forecast */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="bg-neutral-900/50 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock size={18} className="text-orange-400" />
                Delay Forecast
                <Badge variant="outline">Next 4 hours</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <DelayForecast />
            </CardContent>
          </Card>
        </motion.div>

        {/* Decision Cards */}
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="bg-neutral-900/50 border-neutral-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity size={18} className="text-cyan-400" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 space-y-3">
              <DecisionCard
                context={aiContext}
                onRecommendationApply={(recommendation) => {
                  console.log('Applied recommendation:', recommendation);
                  // Handle recommendation application
                }}
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Status Footer */}
      <motion.div
        className="flex items-center justify-between p-4 bg-neutral-900/30 rounded-lg border border-neutral-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <div className="flex items-center gap-4 text-sm text-neutral-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span>System Online</span>
          </div>
          <div>Last Updated: {new Date().toLocaleTimeString()}</div>
          <div>Data Sources: IRCTC Live, Supabase, AI Engine</div>
        </div>
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <span>Controllers Online: {metrics.onlineControllers}</span>
          <div className="w-1 h-1 bg-neutral-600 rounded-full" />
          <span>Response Time: 45ms</span>
        </div>
      </motion.div>
    </div>
  );
}

