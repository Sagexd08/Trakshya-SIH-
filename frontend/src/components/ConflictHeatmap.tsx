"use client";
import * as d3 from "d3";
import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle, Play, Pause, RotateCcw } from "lucide-react";

import { useRealtimeData } from "@/lib/hooks/useRealtimeData";

interface ConflictData {
  id: string;
  timestamp: Date;
  location: [number, number];
  severity: 'low' | 'medium' | 'high';
  trainA: string;
  trainB: string;
  distance: number; // km from origin
  duration: number; // minutes
  resolved: boolean;
}

interface TimeDistanceCell {
  time: number; // hour of day (0-23)
  distance: number; // distance bucket (0-100km)
  conflicts: ConflictData[];
  intensity: number; // 0-1 normalized
}

interface HeatmapState {
  timeRange: [number, number]; // [start hour, end hour]
  distanceRange: [number, number]; // [start km, end km]
  selectedSeverity: 'all' | 'low' | 'medium' | 'high';
  isPlaying: boolean;
  playbackSpeed: number;
  zoomLevel: number;
  brushSelection: [[number, number], [number, number]] | null;
}

export default function ConflictHeatmap() {
  const svgRef = useRef<SVGSVGElement>(null);


  // Real-time conflict data
  const {
    data: conflictData,
    isConnected,
    error: dataError
  } = useRealtimeData<ConflictData>({
    table: 'conflicts',
    initialFetch: true,
    cacheEnabled: true
  });

  const [heatmapState, setHeatmapState] = useState<HeatmapState>({
    timeRange: [0, 23],
    distanceRange: [0, 500],
    selectedSeverity: 'all',
    isPlaying: false,
    playbackSpeed: 1,
    zoomLevel: 1,
    brushSelection: null
  });

  const [selectedCell, setSelectedCell] = useState<TimeDistanceCell | null>(null);


  // Process conflict data into time-distance grid
  const processConflictData = useCallback((conflicts: ConflictData[]): TimeDistanceCell[] => {
    const cells: Map<string, TimeDistanceCell> = new Map();

    // Create grid buckets
    for (let hour = 0; hour < 24; hour++) {
      for (let distanceBucket = 0; distanceBucket < 50; distanceBucket++) {
        const key = `${hour}-${distanceBucket}`;
        cells.set(key, {
          time: hour,
          distance: distanceBucket * 10, // 10km buckets
          conflicts: [],
          intensity: 0
        });
      }
    }

    // Populate with conflict data
    conflicts.forEach(conflict => {
      if (heatmapState.selectedSeverity !== 'all' && conflict.severity !== heatmapState.selectedSeverity) {
        return;
      }

      const hour = conflict.timestamp.getHours();
      const distanceBucket = Math.floor(conflict.distance / 10);
      const key = `${hour}-${distanceBucket}`;

      const cell = cells.get(key);
      if (cell) {
        cell.conflicts.push(conflict);
      }
    });

    // Calculate intensity
    const maxConflicts = Math.max(...Array.from(cells.values()).map(c => c.conflicts.length));
    cells.forEach(cell => {
      cell.intensity = maxConflicts > 0 ? cell.conflicts.length / maxConflicts : 0;
    });

    return Array.from(cells.values());
  }, [heatmapState.selectedSeverity]);

  // Generate mock data if no real data available
  const generateMockData = useCallback((): ConflictData[] => {
    const mockData: ConflictData[] = [];
    const now = new Date();

    for (let i = 0; i < 100; i++) {
      const timestamp = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
      mockData.push({
        id: `conflict-${i}`,
        timestamp,
        location: [77 + Math.random() * 10, 28 + Math.random() * 5],
        severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as 'low' | 'medium' | 'high',
        trainA: `T${Math.floor(Math.random() * 10000)}`,
        trainB: `T${Math.floor(Math.random() * 10000)}`,
        distance: Math.random() * 500,
        duration: Math.random() * 60,
        resolved: Math.random() > 0.3
      });
    }

    return mockData;
  }, []);

  const cellData = processConflictData(conflictData.length > 0 ? conflictData : generateMockData());

  // Main heatmap rendering
  useEffect(() => {
    if (!svgRef.current || cellData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 80, bottom: 60, left: 80 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.bottom - margin.top;

    svg.attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleBand()
      .domain(d3.range(heatmapState.timeRange[0], heatmapState.timeRange[1] + 1).map(String))
      .range([0, width])
      .padding(0.05);

    const yScale = d3.scaleBand()
      .domain(d3.range(0, 50).map((d: number) => String(d * 10)))
      .range([height, 0])
      .padding(0.05);

    const colorScale = d3.scaleSequential(d3.interpolateViridis)
      .domain([0, 1]);

    // Filter data based on current ranges
    const filteredData = cellData.filter(d =>
      d.time >= heatmapState.timeRange[0] &&
      d.time <= heatmapState.timeRange[1] &&
      d.distance >= heatmapState.distanceRange[0] &&
      d.distance <= heatmapState.distanceRange[1]
    );

    // Render heatmap cells
    g.selectAll(".cell")
      .data(filteredData)
      .enter().append("rect")
      .attr("class", "cell")
      .attr("x", (d: any) => xScale(String(d.time)) || 0)
      .attr("y", (d: any) => yScale(String(d.distance)) || 0)
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", (d: any) => colorScale(d.intensity))
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 0.5)
      .attr("rx", 2)
      .style("cursor", "pointer")
      .on("mouseover", function(this: any) {

        d3.select(this).attr("stroke", "#06b6d4").attr("stroke-width", 2);
      })
      .on("mouseout", function(this: any) {

        d3.select(this).attr("stroke", "#1f2937").attr("stroke-width", 0.5);
      })
      .on("click", function(event: any, d: any) {
        setSelectedCell(d);
      });

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "12px");

    g.append("g")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "12px");

    // Add axis labels
    g.append("text")
      .attr("transform", `translate(${width / 2}, ${height + 40})`)
      .style("text-anchor", "middle")
      .style("fill", "#d1d5db")
      .style("font-size", "14px")
      .text("Time of Day (Hours)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left + 20)
      .attr("x", 0 - (height / 2))
      .style("text-anchor", "middle")
      .style("fill", "#d1d5db")
      .style("font-size", "14px")
      .text("Distance from Origin (km)");

    // Add color legend
    const legendWidth = 200;
    const legendHeight = 10;

    const legend = svg.append("g")
      .attr("transform", `translate(${width + margin.left + 20}, ${margin.top + 20})`);

    const legendScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
      .ticks(5)
      .tickFormat(d3.format(".1f"));

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "legend-gradient");

    gradient.selectAll("stop")
      .data(d3.range(0, 1.1, 0.1))
      .enter().append("stop")
      .attr("offset", (d: number) => `${d * 100}%`)
      .attr("stop-color", (d: number) => colorScale(d));

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .style("fill", "url(#legend-gradient)");

    legend.append("g")
      .attr("transform", `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .selectAll("text")
      .style("fill", "#9ca3af")
      .style("font-size", "10px");

    legend.append("text")
      .attr("x", legendWidth / 2)
      .attr("y", -5)
      .style("text-anchor", "middle")
      .style("fill", "#d1d5db")
      .style("font-size", "12px")
      .text("Conflict Intensity");

  }, [cellData, heatmapState.timeRange, heatmapState.distanceRange]);

  return (
    <Card className="w-full h-full bg-neutral-950 border-neutral-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Conflict Analysis Dashboard
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
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Time Range Slider */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Time Range</label>
            <Slider
              value={heatmapState.timeRange}
              onValueChange={(value) =>
                setHeatmapState(prev => ({ ...prev, timeRange: value as [number, number] }))
              }
              max={23}
              min={0}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-neutral-400">
              <span>{heatmapState.timeRange[0]}:00</span>
              <span>{heatmapState.timeRange[1]}:00</span>
            </div>
          </div>

          {/* Severity Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Severity</label>
            <div className="flex gap-1">
              {(['all', 'low', 'medium', 'high'] as const).map((severity) => (
                <Button
                  key={severity}
                  variant={heatmapState.selectedSeverity === severity ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHeatmapState(prev => ({ ...prev, selectedSeverity: severity }))}
                  className="flex-1 text-xs"
                >
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-neutral-300">Playback</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHeatmapState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                className="flex-1"
              >
                {heatmapState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHeatmapState(prev => ({ ...prev, timeRange: [0, 23] }))}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Main Heatmap */}
        <div className="relative">
          <svg ref={svgRef} className="w-full h-[400px] bg-neutral-900 rounded-lg" />
        </div>

        {/* Selected Cell Details */}
        {selectedCell && (
          <Card className="bg-neutral-900 border-neutral-700">
            <CardContent className="p-4">
              <h4 className="font-medium text-white mb-2">
                Time: {selectedCell.time}:00 | Distance: {selectedCell.distance}km
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-neutral-400">Conflicts:</span>
                  <span className="text-white ml-2">{selectedCell.conflicts.length}</span>
                </div>
                <div>
                  <span className="text-neutral-400">Intensity:</span>
                  <span className="text-white ml-2">{(selectedCell.intensity * 100).toFixed(1)}%</span>
                </div>
              </div>
              {selectedCell.conflicts.length > 0 && (
                <div className="mt-3">
                  <h5 className="text-sm font-medium text-neutral-300 mb-2">Recent Conflicts:</h5>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedCell.conflicts.slice(0, 5).map((conflict) => (
                      <div key={conflict.id} className="flex items-center justify-between text-xs">
                        <span className="text-neutral-400">
                          {conflict.trainA} ↔ {conflict.trainB}
                        </span>
                        <Badge
                          variant={conflict.severity === 'high' ? 'destructive' :
                                  conflict.severity === 'medium' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {conflict.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}

