"use client";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import type { FeatureCollection, Point } from "geojson";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Layers,
  Navigation,
  AlertTriangle,
  Settings,
  Zap,
  Activity,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import { usePathPrediction } from "@/lib/hooks/usePathPrediction";

// Dynamically import Three.js overlay to avoid SSR issues
const ThreeMapOverlay = dynamic(() => import('./ThreeMapOverlay'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
    <div className="text-white text-sm">Loading 3D visualization...</div>
  </div>
});

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
if (TOKEN) mapboxgl.accessToken = TOKEN;

const TRACKS_URL = process.env.NEXT_PUBLIC_TRACKS_GEOJSON_URL || "/tracks-sample.geojson";
const STATIONS_URL = process.env.NEXT_PUBLIC_STATIONS_GEOJSON_URL || "/stations-sample.geojson";

interface MapState {
  isPlaying: boolean;
  selectedTrain: string | null;
  followingTrain: string | null;
  showLayers: {
    tracks: boolean;
    stations: boolean;
    trains: boolean;
    conflicts: boolean;
    energy: boolean;
    threejs: boolean;
    heatmap: boolean;
  };
  mapStyle: string;
  viewMode: '2d' | '3d' | 'hybrid';
  performance: {
    fps: number;
    trainCount: number;
    lastUpdate: Date;
  };
}

interface ConflictZone {
  id: string;
  center: [number, number];
  radius: number;
  severity: 'low' | 'medium' | 'high';
  affectedTrains: string[];
}

interface TrainData {
  id: string;
  lng: number;
  lat: number;
  speedKmph: number;
  delayMin: number;
  bearing?: number;
  conflicts?: number;
  energyEfficiency?: number;
  nextStation?: string;
  eta?: number;
}

export default function DigitalTwinMap() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  
  // Real-time data hooks
  const {
    data: realtimeTrains,
    isConnected: trainsConnected,
    error: trainsError,
    addOptimisticUpdate: addOptimisticTrain,
    removeOptimisticUpdate: removeOptimisticTrain
  } = useRealtimeData<Train>({
    table: 'train_positions',
    initialFetch: true,
    cacheEnabled: true,
    optimisticUpdates: true
  });

  const {
    data: realtimeConflicts,
    isConnected: conflictsConnected,
    error: conflictsError
  } = useRealtimeData<Conflict>({
    table: 'conflicts',
    initialFetch: true,
    cacheEnabled: true
  });

  // Path prediction hook
  const {
    pathPredictions,
    conflicts: predictedConflicts,
    isLoading: predictionLoading,
    getTrainPrediction,
    getHighPriorityConflicts
  } = usePathPrediction(realtimeTrains, {
    predictionHours: 2,
    updateInterval: 30000,
    enableConflictDetection: true
  });

  const [mapState, setMapState] = useState<MapState>({
    isPlaying: true,
    selectedTrain: null,
    followingTrain: null,
    showLayers: {
      tracks: true,
      stations: true,
      trains: true,
      conflicts: true,
      energy: true,
      threejs: true,
      heatmap: false
    },
    mapStyle: "mapbox://styles/mapbox/dark-v11",
    viewMode: 'hybrid',
    performance: {
      fps: 60,
      trainCount: 0,
      lastUpdate: new Date()
    }
  });

  // Combine real-time and predicted conflicts
  const conflicts: ConflictZone[] = [
    ...realtimeConflicts.map(rc => ({
      id: rc.id,
      center: [rc.lng || 77.2090, rc.lat || 28.6139] as [number, number],
      radius: rc.severity === 'high' ? 2 : rc.severity === 'medium' ? 1.5 : 1,
      severity: rc.severity,
      affectedTrains: rc.affectedTrains || []
    })),
    ...predictedConflicts.map(pc => ({
      id: pc.id,
      center: pc.location,
      radius: pc.severity === 'high' ? 2 : pc.severity === 'medium' ? 1.5 : 1,
      severity: pc.severity,
      affectedTrains: [pc.trainA, pc.trainB]
    }))
  ];

  // Fallback conflicts if no real-time data
  if (conflicts.length === 0) {
    conflicts.push(
      {
        id: "conflict-1",
        center: [77.2090, 28.6139],
        radius: 2,
        severity: 'high',
        affectedTrains: ["T123", "T789"]
      },
      {
        id: "conflict-2",
        center: [72.8777, 19.0760],
        radius: 1.5,
        severity: 'medium',
        affectedTrains: ["T456"]
      }
    );
  }

  // Use real-time data or fallback to mock data
  const trains = realtimeTrains.length > 0 ? realtimeTrains : [
    {
      id: "T123",
      lng: 88.3639,
      lat: 22.5726,
      speedKmph: 60,
      delayMin: 4,
      bearing: 280,
      conflicts: 1,
      energyEfficiency: 92,
      nextStation: "Howrah Jn",
      eta: 15
    },
    {
      id: "T456",
      lng: 72.8777,
      lat: 19.0760,
      speedKmph: 70,
      delayMin: 0,
      bearing: 30,
      conflicts: 0,
      energyEfficiency: 95,
      nextStation: "Mumbai Central",
      eta: 8
    },
    {
      id: "T789",
      lng: 77.2090,
      lat: 28.6139,
      speedKmph: 85,
      delayMin: 2,
      bearing: 120,
      conflicts: 0,
      energyEfficiency: 88,
      nextStation: "New Delhi",
      eta: 12
    }
  ];

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enhanced control handlers
  const togglePlayPause = useCallback(() => {
    setMapState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    if (mapState.isPlaying) {
      toast.info("Animation paused");
    } else {
      toast.info("Animation resumed");
    }
  }, [mapState.isPlaying]);

  const resetView = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [79, 22],
        zoom: 5,
        pitch: 45,
        bearing: -17.6,
        duration: 2000
      });
      setMapState(prev => ({ 
        ...prev, 
        selectedTrain: null, 
        followingTrain: null 
      }));
      toast.success("View reset to default");
    }
  }, []);

  const toggleLayer = useCallback((layer: keyof MapState['showLayers']) => {
    setMapState(prev => ({
      ...prev,
      showLayers: {
        ...prev.showLayers,
        [layer]: !prev.showLayers[layer]
      }
    }));
  }, []);

  const selectTrain = useCallback((trainId: string) => {
    setMapState(prev => ({ ...prev, selectedTrain: trainId }));
    const train = trains.find(t => t.id === trainId);
    if (train && mapRef.current) {
      mapRef.current.flyTo({
        center: [train.lng, train.lat],
        zoom: 8,
        duration: 1500
      });
    }
  }, [trains]);

  const followTrain = useCallback((trainId: string | null) => {
    setMapState(prev => ({ ...prev, followingTrain: trainId }));
    if (trainId) {
      toast.info(`Following train ${trainId}`);
    } else {
      toast.info("Stopped following train");
    }
  }, []);

  const changeMapStyle = useCallback((style: string) => {
    if (mapRef.current) {
      mapRef.current.setStyle(style);
      setMapState(prev => ({ ...prev, mapStyle: style }));
      toast.success("Map style updated");
    }
  }, []);

  // Main map initialization effect
  useEffect(() => {
    if (!ref.current || !TOKEN) {
      setError("Mapbox token not configured");
      setIsLoading(false);
      return;
    }

    let animationTimer: ReturnType<typeof setInterval> | undefined;

    try {
      const map = new mapboxgl.Map({
        container: ref.current,
        style: mapState.mapStyle,
        center: [79, 22],
        zoom: 5,
        pitch: 45,
        bearing: -17.6,
        antialias: true
      });

      mapRef.current = map;

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setError('Map loading error occurred');
        toast.error('Map error: ' + (e.error?.message || 'Unknown error'));
      });

      map.on('load', async () => {
        setIsLoading(false);
        setError(null);
        toast.success('Digital Twin Map loaded successfully');

        // Load and add railway tracks
        try {
          const tracksResponse = await fetch(TRACKS_URL);
          if (tracksResponse.ok) {
            const tracksData = await tracksResponse.json();
            
            map.addSource('tracks', {
              type: 'geojson',
              data: tracksData
            });

            // Main railway tracks
            map.addLayer({
              id: 'tracks-line',
              type: 'line',
              source: 'tracks',
              paint: {
                'line-color': [
                  'case',
                  ['==', ['get', 'bottleneck'], true], '#ef4444',
                  ['match', ['get', 'track_type'],
                    'freight', '#fb923c',
                    'high-speed', '#22c55e',
                    'passenger', '#60a5fa',
                    '#94a3b8'
                  ]
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.5, 8, 2.5, 12, 4, 15, 8],
                'line-opacity': 0.9
              }
            });

            // Active corridor highlights
            map.addLayer({
              id: 'tracks-active',
              type: 'line',
              source: 'tracks',
              filter: ['==', ['get', 'active'], true],
              paint: {
                'line-color': '#22d3ee',
                'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2, 8, 3, 12, 5, 15, 9],
                'line-opacity': 1,
                'line-dasharray': [2, 2]
              }
            });
          }
        } catch (error) {
          console.warn('Failed to load tracks data:', error);
        }

        // Load and add stations
        try {
          const stationsResponse = await fetch(STATIONS_URL);
          if (stationsResponse.ok) {
            const stationsData = await stationsResponse.json();

            map.addSource('stations', {
              type: 'geojson',
              data: stationsData
            });

            map.addLayer({
              id: 'stations-circle',
              type: 'circle',
              source: 'stations',
              paint: {
                'circle-color': ['step', ['get', 'rank'], '#60a5fa', 2, '#34d399'],
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 4, 12, 6],
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
              }
            });

            map.addLayer({
              id: 'stations-label',
              type: 'symbol',
              source: 'stations',
              layout: {
                'text-field': ['get', 'name'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 12, 12],
                'text-offset': [0, 1.2],
                'text-anchor': 'top'
              },
              paint: {
                'text-color': '#cbd5e1',
                'text-halo-color': '#0b0f19',
                'text-halo-width': 1
              }
            });
          }
        } catch (error) {
          console.warn('Failed to load stations data:', error);
        }

        // Add trains visualization
        const createTrainsGeoJSON = (): FeatureCollection<Point, TrainData> => ({
          type: 'FeatureCollection',
          features: trains.map(train => ({
            type: 'Feature',
            properties: train,
            geometry: {
              type: 'Point',
              coordinates: [train.lng, train.lat]
            }
          }))
        });

        map.addSource('trains', {
          type: 'geojson',
          data: createTrainsGeoJSON()
        });

        // Train circles
        map.addLayer({
          id: 'trains-circle',
          type: 'circle',
          source: 'trains',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 6, 15, 10],
            'circle-color': [
              'case',
              ['>', ['get', 'delayMin'], 5], '#ef4444',
              ['>', ['get', 'delayMin'], 0], '#f59e0b',
              '#22c55e'
            ],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9
          }
        });

        // Train labels
        map.addLayer({
          id: 'trains-label',
          type: 'symbol',
          source: 'trains',
          layout: {
            'text-field': ['get', 'id'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 12, 14],
            'text-offset': [0, 2],
            'text-anchor': 'top'
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 1
          }
        });

        // Train click handlers
        map.on('click', 'trains-circle', (e) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0];
            const trainId = feature.properties?.id;
            if (trainId) {
              setMapState(prev => ({ ...prev, selectedTrain: trainId }));
            }
          }
        });

        // Train hover effects
        map.on('mouseenter', 'trains-circle', (e) => {
          map.getCanvas().style.cursor = 'pointer';

          if (e.features && e.features[0]) {
            const feature = e.features[0];
            const coords = (feature.geometry as Point).coordinates as [number, number];
            const props = feature.properties as TrainData;

            const popup = new mapboxgl.Popup({ closeButton: false })
              .setLngLat(coords)
              .setHTML(`
                <div class="p-2 text-sm">
                  <div class="font-semibold">Train ${props.id}</div>
                  <div>Speed: ${props.speedKmph} km/h</div>
                  <div>Delay: ${props.delayMin} min</div>
                  <div>Efficiency: ${props.energyEfficiency}%</div>
                  ${props.nextStation ? `<div>Next: ${props.nextStation}</div>` : ''}
                </div>
              `)
              .addTo(map);
          }
        });

        map.on('mouseleave', 'trains-circle', () => {
          map.getCanvas().style.cursor = '';
          // Remove any existing popups
          const popups = document.getElementsByClassName('mapboxgl-popup');
          if (popups.length) {
            popups[0].remove();
          }
        });

        // Animation loop for train movement
        animationTimer = setInterval(() => {
          if (!mapState.isPlaying) return;

          // Simulate train movement
          setTrains(prevTrains => {
            const updatedTrains = prevTrains.map(train => ({
              ...train,
              lng: train.lng + (Math.random() - 0.5) * 0.005,
              lat: train.lat + (Math.random() - 0.5) * 0.005,
              speedKmph: Math.max(40, Math.min(120, train.speedKmph + (Math.random() - 0.5) * 10)),
              delayMin: Math.max(0, Math.min(30, train.delayMin + (Math.random() - 0.5) * 2))
            }));

            // Update map source
            const source = map.getSource('trains') as mapboxgl.GeoJSONSource;
            if (source) {
              source.setData({
                type: 'FeatureCollection',
                features: updatedTrains.map(train => ({
                  type: 'Feature',
                  properties: train,
                  geometry: {
                    type: 'Point',
                    coordinates: [train.lng, train.lat]
                  }
                }))
              });
            }

            return updatedTrains;
          });

          // Update performance metrics
          setMapState(prev => ({
            ...prev,
            performance: {
              ...prev.performance,
              trainCount: trains.length,
              lastUpdate: new Date()
            }
          }));
        }, 3000);

        // Follow train logic
        if (mapState.followingTrain) {
          const followedTrain = trains.find(t => t.id === mapState.followingTrain);
          if (followedTrain) {
            map.easeTo({
              center: [followedTrain.lng, followedTrain.lat],
              duration: 1000
            });
          }
        }
      });

      return () => {
        if (animationTimer) clearInterval(animationTimer);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };

    } catch (error) {
      console.error("Map initialization failed:", error);
      setError("Failed to initialize map");
      setIsLoading(false);
    }
  }, [mapState.mapStyle, mapState.isPlaying, mapState.followingTrain]);

  // Handle train selection from Three.js overlay
  useEffect(() => {
    const handleTrainSelected = (event: CustomEvent) => {
      const { trainId } = event.detail;
      selectTrain(trainId);
    };

    window.addEventListener('trainSelected', handleTrainSelected as EventListener);
    return () => {
      window.removeEventListener('trainSelected', handleTrainSelected as EventListener);
    };
  }, []);

  if (!TOKEN) {
    return (
      <div className="w-full h-full grid place-items-center bg-neutral-950 text-neutral-400 border border-neutral-800 rounded">
        <div className="text-center text-sm">
          <AlertTriangle className="mx-auto mb-2" size={24} />
          Mapbox token not set.<br/>
          Set NEXT_PUBLIC_MAPBOX_TOKEN to view the 3D Digital Twin map.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full grid place-items-center bg-neutral-950 text-neutral-400 border border-neutral-800 rounded">
        <div className="text-center text-sm">
          <AlertTriangle className="mx-auto mb-2 text-red-400" size={24} />
          <div className="text-red-400 font-medium mb-1">Map Error</div>
          {error}
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-neutral-950 rounded-lg overflow-hidden">
      {/* Map Container */}
      <div ref={ref} className="w-full h-full" />

      {/* Three.js Overlay */}
      {mapRef.current && mapState.showLayers.threejs && (
        <Suspense fallback={
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-10">
            <div className="text-white text-sm">Loading 3D visualization...</div>
          </div>
        }>
          <ThreeMapOverlay
            map={mapRef.current}
            trains={trains}
            conflicts={conflicts}
            selectedTrain={mapState.selectedTrain}
            followingTrain={mapState.followingTrain}
            showConflicts={mapState.showLayers.conflicts}
            showTrainPaths={true}
          />
        </Suspense>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-3"></div>
            <div className="text-sm text-neutral-300">Loading Digital Twin Map...</div>
          </div>
        </div>
      )}

      {/* Map Controls */}
      <div className="absolute top-4 left-4 space-y-2 z-40">
        {/* Playback Controls */}
        <Card className="bg-neutral-900/90 backdrop-blur border-neutral-800">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlayPause}
                className="h-8 w-8"
              >
                {mapState.isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetView}
                className="h-8 w-8"
              >
                <RotateCcw size={16} />
              </Button>
              <div className="h-4 w-px bg-neutral-700 mx-1" />
              <div className="text-xs text-neutral-400">
                {mapState.isPlaying ? "Live" : "Paused"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Layer Controls */}
        <Card className="bg-neutral-900/90 backdrop-blur border-neutral-800">
          <CardContent className="p-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-300 mb-2">Visualization</div>

              {/* View Mode Toggle */}
              <div className="flex gap-1 mb-3">
                <Button
                  variant={mapState.viewMode === '2d' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMapState(prev => ({ ...prev, viewMode: '2d' }))}
                  className="flex-1 h-6 text-xs"
                >
                  2D
                </Button>
                <Button
                  variant={mapState.viewMode === '3d' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMapState(prev => ({ ...prev, viewMode: '3d' }))}
                  className="flex-1 h-6 text-xs"
                >
                  3D
                </Button>
                <Button
                  variant={mapState.viewMode === 'hybrid' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMapState(prev => ({ ...prev, viewMode: 'hybrid' }))}
                  className="flex-1 h-6 text-xs"
                >
                  Hybrid
                </Button>
              </div>

              {/* Layer Toggles */}
              {[
                { key: 'trains', label: 'Trains', icon: Activity },
                { key: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
                { key: 'energy', label: 'Energy', icon: Zap },
                { key: 'threejs', label: '3D Overlay', icon: Eye },
                { key: 'tracks', label: 'Tracks', icon: Layers },
                { key: 'stations', label: 'Stations', icon: Navigation }
              ].map(({ key, label, icon: Icon }) => {
                const visible = mapState.showLayers[key as keyof MapState['showLayers']];
                return (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon size={10} className={cn(
                        visible ? "text-cyan-400" : "text-neutral-600"
                      )} />
                      <span className="text-xs text-neutral-400">{label}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleLayer(key as keyof MapState['showLayers'])}
                      className={cn(
                        "h-6 w-6 p-0",
                        visible ? "text-cyan-400" : "text-neutral-600"
                      )}
                    >
                      {visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Monitor */}
      <div className="absolute top-4 right-4 z-40 space-y-2">
        {/* Connection Status */}
        <Card className="bg-neutral-900/90 backdrop-blur border-neutral-800">
          <CardContent className="p-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-300">Connection</div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Trains</span>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      trainsConnected ? "bg-green-400" : "bg-red-400"
                    )} />
                    <span className={cn(
                      trainsConnected ? "text-green-400" : "text-red-400"
                    )}>
                      {trainsConnected ? "Live" : "Offline"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Conflicts</span>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      conflictsConnected ? "bg-green-400" : "bg-red-400"
                    )} />
                    <span className={cn(
                      conflictsConnected ? "text-green-400" : "text-red-400"
                    )}>
                      {conflictsConnected ? "Live" : "Offline"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Predictions</span>
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      !predictionLoading ? "bg-green-400" : "bg-yellow-400"
                    )} />
                    <span className={cn(
                      !predictionLoading ? "text-green-400" : "text-yellow-400"
                    )}>
                      {!predictionLoading ? "Ready" : "Computing"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Monitor */}
        <Card className="bg-neutral-900/90 backdrop-blur border-neutral-800">
          <CardContent className="p-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-400">Trains:</span>
                <span className="font-mono text-cyan-400">{trains.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Conflicts:</span>
                <span className="font-mono text-cyan-400">{conflicts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Predictions:</span>
                <span className="font-mono text-cyan-400">{pathPredictions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Status:</span>
                <div className="flex items-center gap-1">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    mapState.isPlaying ? "bg-green-400 animate-pulse" : "bg-yellow-400"
                  )} />
                  <span className="text-neutral-300">
                    {mapState.isPlaying ? "Live" : "Paused"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Train Info */}
      {mapState.selectedTrain && (
        <div className="absolute bottom-4 left-4 z-40">
          <Card className="bg-neutral-900/90 backdrop-blur border-neutral-800">
            <CardContent className="p-4">
              {(() => {
                const train = trains.find(t => t.id === mapState.selectedTrain);
                if (!train) return null;

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white">Train {train.id}</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMapState(prev => ({ ...prev, selectedTrain: null }))}
                        className="h-6 w-6 p-0"
                      >
                        ×
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-neutral-400">Speed</div>
                        <div className="font-mono text-white">{train.speedKmph} km/h</div>
                      </div>
                      <div>
                        <div className="text-neutral-400">Delay</div>
                        <div className={cn(
                          "font-mono",
                          train.delayMin > 5 ? "text-red-400" :
                          train.delayMin > 0 ? "text-yellow-400" : "text-green-400"
                        )}>
                          {train.delayMin}m
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-400">Efficiency</div>
                        <div className="font-mono text-green-400">{train.energyEfficiency}%</div>
                      </div>
                      <div>
                        <div className="text-neutral-400">Conflicts</div>
                        <div className={cn(
                          "font-mono",
                          (train.conflicts || 0) > 0 ? "text-red-400" : "text-green-400"
                        )}>
                          {train.conflicts || 0}
                        </div>
                      </div>
                    </div>
                    {train.nextStation && (
                      <div className="pt-2 border-t border-neutral-700">
                        <div className="text-neutral-400 text-xs">Next Station</div>
                        <div className="text-white text-sm">{train.nextStation}</div>
                        {train.eta && (
                          <div className="text-neutral-400 text-xs">ETA: {train.eta}m</div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => followTrain(train.id)}
                        className="flex-1"
                      >
                        <Navigation size={12} className="mr-1" />
                        Follow
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectTrain(train.id)}
                        className="flex-1"
                      >
                        <Maximize2 size={12} className="mr-1" />
                        Center
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map Style Selector */}
      <div className="absolute bottom-4 right-4 z-40">
        <Card className="bg-neutral-900/90 backdrop-blur border-neutral-800">
          <CardContent className="p-3">
            <div className="flex gap-2">
              <Button
                variant={mapState.mapStyle.includes('dark') ? "default" : "outline"}
                size="sm"
                onClick={() => changeMapStyle("mapbox://styles/mapbox/dark-v11")}
              >
                Dark
              </Button>
              <Button
                variant={mapState.mapStyle.includes('light') ? "default" : "outline"}
                size="sm"
                onClick={() => changeMapStyle("mapbox://styles/mapbox/light-v11")}
              >
                Light
              </Button>
              <Button
                variant={mapState.mapStyle.includes('satellite') ? "default" : "outline"}
                size="sm"
                onClick={() => changeMapStyle("mapbox://styles/mapbox/satellite-streets-v12")}
              >
                Satellite
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
