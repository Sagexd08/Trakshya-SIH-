"use client";
import { useState, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ReferenceLine,
  Brush,
  CartesianGrid,

} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Slider } from "@/components/ui/slider";
import {
  Zap,
  TrendingUp,
  TrendingDown,
  Download,
  Settings,
  Play,
  Pause,
  BarChart3,
  LineChart as LineChartIcon,
  Activity
} from "lucide-react";

import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { toast } from "sonner";

interface EnergyDataPoint {
  id: string;
  timestamp: Date;
  hour: number;
  baseline_consumption: number;
  optimized_consumption: number;
  actual_consumption: number;
  efficiency_percentage: number;
  cost_savings: number;
  carbon_reduction: number;
  train_count: number;
  route_id?: string;
}

interface EnergyMetrics {
  totalSavings: number;
  avgEfficiency: number;
  peakHour: number;
  carbonReduced: number;
  costSaved: number;
}

interface ChartConfig {
  chartType: 'line' | 'area' | 'bar';
  showBaseline: boolean;
  showOptimized: boolean;
  showActual: boolean;
  timeRange: [number, number]; // hours
  thresholds: {
    efficiency: number;
    savings: number;
  };
  animationDuration: number;
}

export default function EnergyChart() {
  const chartRef = useRef<HTMLDivElement>(null);

  // Real-time energy data
  const {
    data: energyData,
    isConnected,
    error: dataError,
    refetch
  } = useRealtimeData<EnergyDataPoint>({
    table: 'energy_logs',
    initialFetch: true,
    cacheEnabled: true
  });

  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    chartType: 'line',
    showBaseline: true,
    showOptimized: true,
    showActual: true,
    timeRange: [0, 23],
    thresholds: {
      efficiency: 85,
      savings: 15
    },
    animationDuration: 1000
  });

  const [isPlaying, setIsPlaying] = useState(false);


  // Generate mock data if no real data available
  const generateMockData = useCallback((): EnergyDataPoint[] => {
    const mockData: EnergyDataPoint[] = [];
    const now = new Date();

    for (let hour = 0; hour < 24; hour++) {
      const timestamp = new Date(now);
      timestamp.setHours(hour, 0, 0, 0);

      const baseline = 60 + Math.random() * 40; // 60-100 kWh
      const optimized = baseline * (0.7 + Math.random() * 0.2); // 70-90% of baseline
      const actual = optimized * (0.9 + Math.random() * 0.2); // 90-110% of optimized

      mockData.push({
        id: `energy-${hour}`,
        timestamp,
        hour,
        baseline_consumption: baseline,
        optimized_consumption: optimized,
        actual_consumption: actual,
        efficiency_percentage: ((baseline - actual) / baseline) * 100,
        cost_savings: (baseline - actual) * 0.12, // $0.12 per kWh
        carbon_reduction: (baseline - actual) * 0.5, // 0.5 kg CO2 per kWh
        train_count: Math.floor(Math.random() * 20) + 5
      });
    }

    return mockData;
  }, []);

  const processedData = energyData.length > 0 ? energyData : generateMockData();

  // Calculate metrics
  const metrics: EnergyMetrics = {
    totalSavings: processedData.reduce((sum, d) => sum + d.cost_savings, 0),
    avgEfficiency: processedData.reduce((sum, d) => sum + d.efficiency_percentage, 0) / processedData.length,
    peakHour: processedData.reduce((max, d) => d.actual_consumption > processedData[max].actual_consumption ? d.hour : max, 0),
    carbonReduced: processedData.reduce((sum, d) => sum + d.carbon_reduction, 0),
    costSaved: processedData.reduce((sum, d) => sum + d.cost_savings, 0)
  };

  // Filter data based on time range
  const filteredData = processedData.filter(d =>
    d.hour >= chartConfig.timeRange[0] && d.hour <= chartConfig.timeRange[1]
  );

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{`Hour: ${label}:00`}</p>
          <div className="space-y-1 mt-2">
            {chartConfig.showBaseline && (
              <p className="text-red-400 text-sm">
                Baseline: {data.baseline_consumption.toFixed(1)} kWh
              </p>
            )}
            {chartConfig.showOptimized && (
              <p className="text-blue-400 text-sm">
                Optimized: {data.optimized_consumption.toFixed(1)} kWh
              </p>
            )}
            {chartConfig.showActual && (
              <p className="text-green-400 text-sm">
                Actual: {data.actual_consumption.toFixed(1)} kWh
              </p>
            )}
            <p className="text-cyan-400 text-sm">
              Efficiency: {data.efficiency_percentage.toFixed(1)}%
            </p>
            <p className="text-yellow-400 text-sm">
              Savings: ${data.cost_savings.toFixed(2)}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Export functionality
  const exportData = useCallback(async (format: 'csv' | 'pdf') => {
    try {
      if (format === 'csv') {
        const csvContent = [
          'Hour,Baseline (kWh),Optimized (kWh),Actual (kWh),Efficiency (%),Cost Savings ($),Carbon Reduction (kg)',
          ...filteredData.map(d =>
            `${d.hour},${d.baseline_consumption.toFixed(2)},${d.optimized_consumption.toFixed(2)},${d.actual_consumption.toFixed(2)},${d.efficiency_percentage.toFixed(2)},${d.cost_savings.toFixed(2)},${d.carbon_reduction.toFixed(2)}`
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `energy-efficiency-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success('CSV exported successfully');
      } else {
        // For PDF, we would typically use a library like jsPDF
        toast.info('PDF export feature coming soon');
      }
    } catch {
      toast.error('Export failed');
    }
  }, [filteredData]);

  // Render chart based on type
  const renderChart = () => {
    const commonProps = {
      data: filteredData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    const chartElements = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="hour"
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          tickFormatter={(value) => `${value}:00`}
        />
        <YAxis
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          tickFormatter={(value) => `${value} kWh`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ color: '#d1d5db' }}
          iconType="line"
        />

        {/* Threshold lines */}
        <ReferenceLine
          y={chartConfig.thresholds.efficiency}
          stroke="#fbbf24"
          strokeDasharray="5 5"
          label={{ value: "Efficiency Target", position: "top", fill: "#fbbf24" }}
        />

        {/* Brush for zooming */}
        <Brush
          dataKey="hour"
          height={30}
          stroke="#06b6d4"
          fill="#1f2937"
        />
      </>
    );

    switch (chartConfig.chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            {chartElements}
            {chartConfig.showBaseline && (
              <Area
                type="monotone"
                dataKey="baseline_consumption"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.3}
                name="Baseline"
                animationDuration={chartConfig.animationDuration}
              />
            )}
            {chartConfig.showOptimized && (
              <Area
                type="monotone"
                dataKey="optimized_consumption"
                stackId="2"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
                name="Optimized"
                animationDuration={chartConfig.animationDuration}
              />
            )}
            {chartConfig.showActual && (
              <Area
                type="monotone"
                dataKey="actual_consumption"
                stackId="3"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
                name="Actual"
                animationDuration={chartConfig.animationDuration}
              />
            )}
          </AreaChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {chartElements}
            {chartConfig.showBaseline && (
              <Bar
                dataKey="baseline_consumption"
                fill="#ef4444"
                name="Baseline"
                animationDuration={chartConfig.animationDuration}
              />
            )}
            {chartConfig.showOptimized && (
              <Bar
                dataKey="optimized_consumption"
                fill="#3b82f6"
                name="Optimized"
                animationDuration={chartConfig.animationDuration}
              />
            )}
            {chartConfig.showActual && (
              <Bar
                dataKey="actual_consumption"
                fill="#10b981"
                name="Actual"
                animationDuration={chartConfig.animationDuration}
              />
            )}
          </BarChart>
        );

      default: // line
        return (
          <LineChart {...commonProps}>
            {chartElements}
            {chartConfig.showBaseline && (
              <Line
                type="monotone"
                dataKey="baseline_consumption"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                name="Baseline"
                animationDuration={chartConfig.animationDuration}
              />
            )}
            {chartConfig.showOptimized && (
              <Line
                type="monotone"
                dataKey="optimized_consumption"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                name="Optimized"
                animationDuration={chartConfig.animationDuration}
              />
            )}
            {chartConfig.showActual && (
              <Line
                type="monotone"
                dataKey="actual_consumption"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                name="Actual"
                animationDuration={chartConfig.animationDuration}
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <Card className="w-full h-full bg-neutral-950 border-neutral-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Energy Efficiency Analytics
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
              {isConnected ? "Live" : "Offline"}
            </Badge>
            {dataError && (
              <Badge variant="destructive" className="text-xs">
                Error
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metrics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-900 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-neutral-400">Avg Efficiency</span>
            </div>
            <div className="text-lg font-semibold text-white">
              {metrics.avgEfficiency.toFixed(1)}%
            </div>
          </div>

          <div className="bg-neutral-900 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-neutral-400">Peak Hour</span>
            </div>
            <div className="text-lg font-semibold text-white">
              {metrics.peakHour}:00
            </div>
          </div>

          <div className="bg-neutral-900 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-xs text-neutral-400">Carbon Reduced</span>
            </div>
            <div className="text-lg font-semibold text-white">
              {metrics.carbonReduced.toFixed(1)} kg
            </div>
          </div>

          <div className="bg-neutral-900 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-neutral-400">Cost Saved</span>
            </div>
            <div className="text-lg font-semibold text-white">
              ${metrics.costSaved.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Chart Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Chart Type</label>
            <div className="flex gap-1">
              <Button
                variant={chartConfig.chartType === 'line' ? "default" : "outline"}
                size="sm"
                onClick={() => setChartConfig(prev => ({ ...prev, chartType: 'line' }))}
                className="flex-1"
              >
                <LineChartIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={chartConfig.chartType === 'area' ? "default" : "outline"}
                size="sm"
                onClick={() => setChartConfig(prev => ({ ...prev, chartType: 'area' }))}
                className="flex-1"
              >
                <Activity className="w-4 h-4" />
              </Button>
              <Button
                variant={chartConfig.chartType === 'bar' ? "default" : "outline"}
                size="sm"
                onClick={() => setChartConfig(prev => ({ ...prev, chartType: 'bar' }))}
                className="flex-1"
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Data Series Toggle */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Data Series</label>
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={chartConfig.showBaseline}
                  onChange={(e) => setChartConfig(prev => ({ ...prev, showBaseline: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-red-400">Baseline</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={chartConfig.showOptimized}
                  onChange={(e) => setChartConfig(prev => ({ ...prev, showOptimized: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-blue-400">Optimized</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={chartConfig.showActual}
                  onChange={(e) => setChartConfig(prev => ({ ...prev, showActual: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-green-400">Actual</span>
              </label>
            </div>
          </div>

          {/* Time Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Time Range</label>
            <Slider
              value={chartConfig.timeRange}
              onValueChange={(value) =>
                setChartConfig(prev => ({ ...prev, timeRange: value as [number, number] }))
              }
              max={23}
              min={0}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-neutral-400">
              <span>{chartConfig.timeRange[0]}:00</span>
              <span>{chartConfig.timeRange[1]}:00</span>
            </div>
          </div>

          {/* Export & Actions */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Actions</label>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportData('csv')}
                className="flex-1"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex-1"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPlaying(!isPlaying)}
                className="flex-1"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Chart */}
        <div className="h-[400px] bg-neutral-900 rounded-lg p-4" ref={chartRef}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>

        {/* Threshold Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">
              Efficiency Threshold: {chartConfig.thresholds.efficiency}%
            </label>
            <Slider
              value={[chartConfig.thresholds.efficiency]}
              onValueChange={(value) =>
                setChartConfig(prev => ({
                  ...prev,
                  thresholds: { ...prev.thresholds, efficiency: value[0] }
                }))
              }
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">
              Savings Threshold: {chartConfig.thresholds.savings}%
            </label>
            <Slider
              value={[chartConfig.thresholds.savings]}
              onValueChange={(value) =>
                setChartConfig(prev => ({
                  ...prev,
                  thresholds: { ...prev.thresholds, savings: value[0] }
                }))
              }
              max={50}
              min={0}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

