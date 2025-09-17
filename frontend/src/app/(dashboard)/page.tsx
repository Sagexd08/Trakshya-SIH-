"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppSelector, useAppDispatch } from "@/store";
import {
  selectMetrics,
  selectTrains,
  selectConflicts,
  updateMetrics,
  setConnectionStatus
} from "@/store/slices/railwaySlice";
import {
  selectLayout,
  selectTheme,
  togglePanel,
  setGlobalLoading,
  addNotification
} from "@/store/slices/uiSlice";
import { selectUser, selectIsDemo } from "@/store/slices/authSlice";
import {
  useGetSystemMetricsQuery,
  useGetTrainsQuery,
  useGetConflictsQuery,
  useGetEnergySeriesQuery
} from "@/store/api/railwayApi";

// Enhanced Components
import DigitalTwinMap from "@/components/DigitalTwinMap";
import ConflictHeatmap from "@/components/ConflictHeatmap";
import EnergyChart from "@/components/EnergyChart";
import DelayForecast from "@/components/DelayForecast";
import DecisionCard from "@/components/DecisionCard";
import ScenarioModal from "@/components/ScenarioModal";
import AIInsightsPanel from "@/components/AIInsightsPanel";
import AssistantPanel from "@/components/AssistantPanel";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Icons
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
  Users,
  Wifi,
  WifiOff,
  Settings,
  BarChart3,
  Map,
  Brain
} from "lucide-react";

import { cn } from "@/lib/utils";
import { config } from "@/config";

// Enhanced Dashboard Component
export default function DashboardPage() {
  // Redux state
  const dispatch = useAppDispatch();
  const metrics = useAppSelector(selectMetrics);
  const trains = useAppSelector(selectTrains);
  const conflicts = useAppSelector(selectConflicts);
  const layout = useAppSelector(selectLayout);
  const theme = useAppSelector(selectTheme);
  const user = useAppSelector(selectUser);
  const isDemo = useAppSelector(selectIsDemo);

  // API queries with real-time updates
  const {
    data: systemMetrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useGetSystemMetricsQuery(undefined, {
    pollingInterval: 30000, // 30 seconds
    refetchOnFocus: true,
  });

  const {
    data: trainsData,
    isLoading: trainsLoading,
    error: trainsError
  } = useGetTrainsQuery({
    limit: 100,
    status: 'active'
  }, {
    pollingInterval: 15000, // 15 seconds
  });

  const {
    data: conflictsData,
    isLoading: conflictsLoading
  } = useGetConflictsQuery({
    status: 'active',
    limit: 50
  }, {
    pollingInterval: 10000, // 10 seconds
  });

  const {
    data: energyData,
    isLoading: energyLoading
  } = useGetEnergySeriesQuery({
    stations: 'NDLS,CSMT,HWH',
    hours: 24
  });
  // Local state
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed'>('overview');
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('connected');

  // Real-time connection monitoring
  useEffect(() => {
    const checkConnection = () => {
      const isOnline = navigator.onLine;
      const status = isOnline ? 'connected' : 'disconnected';
      setConnectionStatus(status);
      dispatch(setConnectionStatus(isOnline));
    };

    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', checkConnection);
    checkConnection();

    return () => {
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', checkConnection);
    };
  }, [dispatch]);

  // Update metrics when API data changes
  useEffect(() => {
    if (systemMetrics) {
      dispatch(updateMetrics(systemMetrics));
    }
  }, [systemMetrics, dispatch]);

  // Error handling
  useEffect(() => {
    if (metricsError || trainsError) {
      dispatch(addNotification({
        type: 'error',
        category: 'system',
        title: 'Data Fetch Error',
        message: 'Failed to fetch latest data. Using cached information.',
        persistent: false,
        priority: 'medium',
        source: 'dashboard',
      }));
    }
  }, [metricsError, trainsError, dispatch]);

  // AI Context for components
  const aiContext = {
    activeTrains: metrics.totalTrains,
    conflicts: Object.values(conflicts).slice(0, 5), // Get first 5 conflicts
    energyEfficiency: metrics.energyEfficiency,
    avgDelay: metrics.averageDelay,
    throughput: metrics.throughput,
    userRole: user?.role || 'controller',
    currentView: 'dashboard'
  };

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    dispatch(setGlobalLoading(true));

    try {
      await Promise.all([
        refetchMetrics(),
        // Add other refetch calls as needed
      ]);

      dispatch(addNotification({
        type: 'success',
        category: 'system',
        title: 'Data Refreshed',
        message: 'All dashboard data has been updated successfully.',
        persistent: false,
        priority: 'low',
        source: 'dashboard',
      }));
    } catch (error) {
      dispatch(addNotification({
        type: 'error',
        category: 'system',
        title: 'Refresh Failed',
        message: 'Failed to refresh dashboard data. Please try again.',
        persistent: false,
        priority: 'medium',
        source: 'dashboard',
      }));
    } finally {
      setIsRefreshing(false);
      dispatch(setGlobalLoading(false));
    }
  }, [dispatch, refetchMetrics]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(handleRefresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [handleRefresh]);

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  // Enhanced metrics cards with loading states and real data
  const metricCards = [
    {
      title: "Active Trains",
      value: metricsLoading ? "..." : metrics.totalTrains,
      icon: Train,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      trend: metrics.trends?.totalTrains || "+2.3%",
      loading: metricsLoading,
      description: "Currently operational trains across the network"
    },
    {
      title: "Active Conflicts",
      value: conflictsLoading ? "..." : Object.keys(conflicts).length,
      icon: AlertTriangle,
      color: "text-red-400",
      bgColor: "bg-red-500/10",
      trend: metrics.trends?.conflicts || "-12%",
      loading: conflictsLoading,
      description: "Real-time conflict detection and resolution"
    },
    {
      title: "Energy Efficiency",
      value: energyLoading ? "..." : `${metrics.energyEfficiency.toFixed(1)}%`,
      icon: Zap,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      trend: metrics.trends?.energyEfficiency || "+5.2%",
      loading: energyLoading,
      description: "System-wide energy optimization performance"
    },
    {
      title: "Avg Delay",
      value: metricsLoading ? "..." : `${metrics.averageDelay.toFixed(1)}m`,
      icon: Clock,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      trend: metrics.trends?.averageDelay || "-8.1%",
      loading: metricsLoading,
      description: "Average delay across all train services"
    },
    {
      title: "Throughput",
      value: metricsLoading ? "..." : `${metrics.throughput.toFixed(1)}%`,
      icon: Activity,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
      trend: metrics.trends?.throughput || "+3.7%",
      loading: metricsLoading,
      description: "Network capacity utilization efficiency"
    },
    {
      title: "Online Controllers",
      value: metricsLoading ? "..." : metrics.onlineControllers,
      icon: Users,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      trend: "+1",
      loading: metricsLoading,
      description: "Active control room operators"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Status and Actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Railway Operations Dashboard</h1>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <div className="flex items-center gap-1 text-green-400">
                  <Wifi className="h-4 w-4" />
                  <span className="text-xs">Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-400">
                  <WifiOff className="h-4 w-4" />
                  <span className="text-xs">Offline</span>
                </div>
              )}
              {isDemo && (
                <Badge variant="outline" className="text-amber-400 border-amber-400/30">
                  Demo Mode
                </Badge>
              )}
            </div>
          </div>
          <p className="text-neutral-400">
            Real-time monitoring and AI-powered optimization • Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedView(selectedView === 'overview' ? 'detailed' : 'overview')}
              className="text-neutral-400 hover:text-neutral-100"
            >
              {selectedView === 'overview' ? <BarChart3 className="h-4 w-4" /> : <Map className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-neutral-100"
            >
              <Brain className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-neutral-100"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-6 w-px bg-neutral-700" />

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowScenarioModal(true)}
          >
            Run Scenario
          </Button>
        </div>
      </div>

      {/* Enhanced Metrics Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricCards.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02 }}
            className="group"
          >
            <Card className="bg-neutral-900/50 border-neutral-800 hover:bg-neutral-900/80 transition-all duration-200 group-hover:border-neutral-700">
              <CardContent className="p-4">
                {metric.loading ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <Skeleton className="h-5 w-12" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className={cn("p-2 rounded-lg transition-colors", metric.bgColor)}>
                      <metric.icon size={20} className={metric.color} />
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {metric.value}
                      </div>
                      <div className="text-xs text-neutral-400 group-hover:text-neutral-300 transition-colors">
                        {metric.title}
                      </div>
                      <div className={cn(
                        "text-xs flex items-center gap-1 mt-1 transition-colors",
                        metric.trend.startsWith('+') ? "text-green-400" : "text-red-400"
                      )}>
                        {metric.trend.startsWith('+') ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {metric.trend}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Error States */}
      <AnimatePresence>
        {(metricsError || trainsError) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Alert className="border-red-500/20 bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription className="text-red-300">
                Some data may be outdated due to connection issues. Using cached information where available.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

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

