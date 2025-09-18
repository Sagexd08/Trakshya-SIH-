/**
 * Railway Operations State Management
 * Handles trains, stations, conflicts, energy data, and real-time operations
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface Train {
  id: string;
  number: string;
  name: string;
  type: 'passenger' | 'freight' | 'express' | 'local' | 'special';
  status: 'on_time' | 'delayed' | 'cancelled' | 'diverted' | 'terminated';
  currentStation: string;
  nextStation: string;
  destination: string;
  origin: string;
  delay: number; // in minutes
  speed: number; // km/h
  position: {
    lat: number;
    lng: number;
    heading?: number;
  };
  schedule: {
    departure: string;
    arrival: string;
    estimatedArrival: string;
    estimatedDeparture: string;
  };
  capacity: {
    total: number;
    occupied: number;
    reserved: number;
  };
  energy: {
    consumption: number;
    efficiency: number;
    mode: 'normal' | 'eco' | 'performance';
  };
  lastUpdate: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  position: {
    lat: number;
    lng: number;
  };
  type: 'junction' | 'terminal' | 'halt' | 'crossing';
  platforms: number;
  capacity: number;
  currentOccupancy: number;
  facilities: string[];
  status: 'operational' | 'maintenance' | 'closed';
  congestionLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface Conflict {
  id: string;
  type: 'schedule' | 'route' | 'platform' | 'signal' | 'maintenance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'pending' | 'escalated';
  trainIds: string[];
  stationId?: string;
  description: string;
  predictedTime: string;
  estimatedDuration: number; // minutes
  impact: {
    delayMinutes: number;
    affectedTrains: number;
    passengerImpact: number;
  };
  resolution?: {
    strategy: string;
    implementedAt: string;
    resolvedAt?: string;
    effectiveness: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EnergyData {
  timestamp: string;
  baseline: number;
  optimized: number;
  savings: number;
  efficiency: number;
  carbonFootprint: number;
  renewablePercentage: number;
}

export interface SystemMetrics {
  totalTrains: number;
  activeTrains: number;
  delayedTrains: number;
  onTimePerformance: number;
  averageDelay: number;
  throughput: number;
  energyEfficiency: number;
  activeConflicts: number;
  resolvedConflicts: number;
  systemHealth: number;
  lastUpdate: string;
}

export interface RailwayState {
  // Core data
  trains: Record<string, Train>;
  stations: Record<string, Station>;
  conflicts: Record<string, Conflict>;
  energyData: EnergyData[];
  
  // Metrics
  metrics: SystemMetrics;
  
  // Real-time status
  isConnected: boolean;
  lastSync: string | null;
  
  // Filters and views
  filters: {
    trainTypes: string[];
    stations: string[];
    conflictSeverity: string[];
    timeRange: {
      start: string;
      end: string;
    };
  };
  
  // Map state
  map: {
    center: [number, number];
    zoom: number;
    selectedTrain: string | null;
    selectedStation: string | null;
    followMode: boolean;
    layers: {
      trains: boolean;
      stations: boolean;
      routes: boolean;
      conflicts: boolean;
      heatmap: boolean;
    };
  };
  
  // Loading states
  loading: {
    trains: boolean;
    stations: boolean;
    conflicts: boolean;
    metrics: boolean;
  };
  
  // Error states
  errors: {
    trains: string | null;
    stations: string | null;
    conflicts: string | null;
    metrics: string | null;
  };
}

// Initial state
const initialState: RailwayState = {
  trains: {},
  stations: {},
  conflicts: {},
  energyData: [],
  
  metrics: {
    totalTrains: 0,
    activeTrains: 0,
    delayedTrains: 0,
    onTimePerformance: 0,
    averageDelay: 0,
    throughput: 0,
    energyEfficiency: 0,
    activeConflicts: 0,
    resolvedConflicts: 0,
    systemHealth: 100,
    lastUpdate: new Date().toISOString(),
  },
  
  isConnected: false,
  lastSync: null,
  
  filters: {
    trainTypes: [],
    stations: [],
    conflictSeverity: [],
    timeRange: {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end: new Date().toISOString(),
    },
  },
  
  map: {
    center: [28.6139, 77.2090], // New Delhi
    zoom: 6,
    selectedTrain: null,
    selectedStation: null,
    followMode: false,
    layers: {
      trains: true,
      stations: true,
      routes: true,
      conflicts: true,
      heatmap: false,
    },
  },
  
  loading: {
    trains: false,
    stations: false,
    conflicts: false,
    metrics: false,
  },
  
  errors: {
    trains: null,
    stations: null,
    conflicts: null,
    metrics: null,
  },
};

// Async thunks
export const fetchTrains = createAsyncThunk(
  'railway/fetchTrains',
  async (params?: { stationCode?: string; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.stationCode) queryParams.append('station_code', params.stationCode);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const response = await fetch(`/api/railway/trains?${queryParams}`);
    if (!response.ok) throw new Error('Failed to fetch trains');
    return response.json();
  }
);

export const fetchStations = createAsyncThunk(
  'railway/fetchStations',
  async () => {
    const response = await fetch('/api/railway/stations');
    if (!response.ok) throw new Error('Failed to fetch stations');
    return response.json();
  }
);

export const fetchConflicts = createAsyncThunk(
  'railway/fetchConflicts',
  async (severity?: string) => {
    const queryParams = severity ? `?severity=${severity}` : '';
    const response = await fetch(`/api/railway/conflicts${queryParams}`);
    if (!response.ok) throw new Error('Failed to fetch conflicts');
    return response.json();
  }
);

export const updateTrainPosition = createAsyncThunk(
  'railway/updateTrainPosition',
  async (update: { trainId: string; position: Train['position']; speed: number }) => {
    const response = await fetch(`/api/railway/trains/${update.trainId}/position`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: update.position, speed: update.speed }),
    });
    if (!response.ok) throw new Error('Failed to update train position');
    return response.json();
  }
);

// Railway slice
const railwaySlice = createSlice({
  name: 'railway',
  initialState,
  reducers: {
    // Real-time updates
    updateTrain: (state, action: PayloadAction<Train>) => {
      state.trains[action.payload.id] = action.payload;
      state.lastSync = new Date().toISOString();
    },
    
    updateMultipleTrains: (state, action: PayloadAction<Train[]>) => {
      action.payload.forEach(train => {
        state.trains[train.id] = train;
      });
      state.lastSync = new Date().toISOString();
    },
    
    updateStation: (state, action: PayloadAction<Station>) => {
      state.stations[action.payload.id] = action.payload;
    },
    
    addConflict: (state, action: PayloadAction<Conflict>) => {
      state.conflicts[action.payload.id] = action.payload;
      state.metrics.activeConflicts = Object.values(state.conflicts)
        .filter(c => c.status === 'active').length;
    },
    
    resolveConflict: (state, action: PayloadAction<{ id: string; resolution: Conflict['resolution'] }>) => {
      const conflict = state.conflicts[action.payload.id];
      if (conflict) {
        conflict.status = 'resolved';
        conflict.resolution = action.payload.resolution;
        conflict.updatedAt = new Date().toISOString();
        
        state.metrics.activeConflicts = Object.values(state.conflicts)
          .filter(c => c.status === 'active').length;
        state.metrics.resolvedConflicts = Object.values(state.conflicts)
          .filter(c => c.status === 'resolved').length;
      }
    },
    
    updateMetrics: (state, action: PayloadAction<Partial<SystemMetrics>>) => {
      state.metrics = { ...state.metrics, ...action.payload };
      state.metrics.lastUpdate = new Date().toISOString();
    },
    
    addEnergyData: (state, action: PayloadAction<EnergyData>) => {
      state.energyData.push(action.payload);
      // Keep only last 24 hours of data
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      state.energyData = state.energyData.filter(d => d.timestamp > cutoff);
    },
    
    // Connection status
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (action.payload) {
        state.lastSync = new Date().toISOString();
      }
    },
    
    // Filters
    setFilters: (state, action: PayloadAction<Partial<RailwayState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    // Map controls
    setMapCenter: (state, action: PayloadAction<[number, number]>) => {
      state.map.center = action.payload;
    },
    
    setMapZoom: (state, action: PayloadAction<number>) => {
      state.map.zoom = action.payload;
    },
    
    selectTrain: (state, action: PayloadAction<string | null>) => {
      state.map.selectedTrain = action.payload;
      state.map.selectedStation = null; // Clear station selection
    },
    
    selectStation: (state, action: PayloadAction<string | null>) => {
      state.map.selectedStation = action.payload;
      state.map.selectedTrain = null; // Clear train selection
    },
    
    toggleFollowMode: (state) => {
      state.map.followMode = !state.map.followMode;
    },
    
    toggleMapLayer: (state, action: PayloadAction<keyof RailwayState['map']['layers']>) => {
      state.map.layers[action.payload] = !state.map.layers[action.payload];
    },
    
    // Clear data
    clearTrains: (state) => {
      state.trains = {};
    },
    
    clearConflicts: (state) => {
      state.conflicts = {};
      state.metrics.activeConflicts = 0;
      state.metrics.resolvedConflicts = 0;
    },
    
    // Reset state
    resetRailwayState: () => initialState,
  },
  
  extraReducers: (builder) => {
    // Fetch trains
    builder
      .addCase(fetchTrains.pending, (state) => {
        state.loading.trains = true;
        state.errors.trains = null;
      })
      .addCase(fetchTrains.fulfilled, (state, action) => {
        state.loading.trains = false;
        action.payload.trains?.forEach((train: Train) => {
          state.trains[train.id] = train;
        });
        state.metrics.totalTrains = Object.keys(state.trains).length;
        state.metrics.activeTrains = Object.values(state.trains)
          .filter(t => t.status !== 'cancelled' && t.status !== 'terminated').length;
        state.lastSync = new Date().toISOString();
      })
      .addCase(fetchTrains.rejected, (state, action) => {
        state.loading.trains = false;
        state.errors.trains = action.error.message || 'Failed to fetch trains';
      });
    
    // Fetch stations
    builder
      .addCase(fetchStations.pending, (state) => {
        state.loading.stations = true;
        state.errors.stations = null;
      })
      .addCase(fetchStations.fulfilled, (state, action) => {
        state.loading.stations = false;
        action.payload.stations?.forEach((station: Station) => {
          state.stations[station.id] = station;
        });
      })
      .addCase(fetchStations.rejected, (state, action) => {
        state.loading.stations = false;
        state.errors.stations = action.error.message || 'Failed to fetch stations';
      });
    
    // Fetch conflicts
    builder
      .addCase(fetchConflicts.pending, (state) => {
        state.loading.conflicts = true;
        state.errors.conflicts = null;
      })
      .addCase(fetchConflicts.fulfilled, (state, action) => {
        state.loading.conflicts = false;
        action.payload.conflicts?.forEach((conflict: Conflict) => {
          state.conflicts[conflict.id] = conflict;
        });
        state.metrics.activeConflicts = Object.values(state.conflicts)
          .filter(c => c.status === 'active').length;
      })
      .addCase(fetchConflicts.rejected, (state, action) => {
        state.loading.conflicts = false;
        state.errors.conflicts = action.error.message || 'Failed to fetch conflicts';
      });
  },
});

// Export actions
export const {
  updateTrain,
  updateMultipleTrains,
  updateStation,
  addConflict,
  resolveConflict,
  updateMetrics,
  addEnergyData,
  setConnectionStatus,
  setFilters,
  setMapCenter,
  setMapZoom,
  selectTrain,
  selectStation,
  toggleFollowMode,
  toggleMapLayer,
  clearTrains,
  clearConflicts,
  resetRailwayState,
} = railwaySlice.actions;

// Selectors
export const selectRailway = (state: { railway: RailwayState }) => state.railway;
export const selectTrains = (state: { railway: RailwayState }) => state.railway.trains;
export const selectStations = (state: { railway: RailwayState }) => state.railway.stations;
export const selectConflicts = (state: { railway: RailwayState }) => state.railway.conflicts;
export const selectMetrics = (state: { railway: RailwayState }) => state.railway.metrics;
export const selectMap = (state: { railway: RailwayState }) => state.railway.map;
export const selectSelectedTrain = (state: { railway: RailwayState }) => 
  state.railway.map.selectedTrain ? state.railway.trains[state.railway.map.selectedTrain] : null;

export default railwaySlice.reducer;
