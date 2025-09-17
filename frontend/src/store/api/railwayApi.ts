/**
 * Railway API using RTK Query
 * Provides type-safe API calls with caching, invalidation, and real-time updates
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { config } from '@/config';
import type { Train, Station, Conflict, EnergyData, SystemMetrics } from '../slices/railwaySlice';

// Base query with authentication and error handling
const baseQuery = fetchBaseQuery({
  baseUrl: config.api.baseUrl || '/api',
  timeout: config.api.timeout,
  prepareHeaders: (headers, { getState }) => {
    // Add authentication headers if available
    const token = (getState() as any).auth?.user?.token;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    headers.set('content-type', 'application/json');
    return headers;
  },
});

// Enhanced base query with retry logic and error handling
const baseQueryWithRetry = async (args: any, api: any, extraOptions: any) => {
  let result = await baseQuery(args, api, extraOptions);
  
  // Retry on network errors
  if (result.error && result.error.status === 'FETCH_ERROR') {
    // Wait 1 second and retry
    await new Promise(resolve => setTimeout(resolve, 1000));
    result = await baseQuery(args, api, extraOptions);
  }
  
  return result;
};

// Railway API definition
export const railwayApi = createApi({
  reducerPath: 'railwayApi',
  baseQuery: baseQueryWithRetry,
  tagTypes: ['Train', 'Station', 'Conflict', 'Energy', 'Metrics'],
  keepUnusedDataFor: 300, // 5 minutes
  refetchOnMountOrArgChange: 30, // 30 seconds
  refetchOnFocus: true,
  refetchOnReconnect: true,
  
  endpoints: (builder) => ({
    // Trains
    getTrains: builder.query<{ trains: Train[]; total: number }, {
      stationCode?: string;
      limit?: number;
      offset?: number;
      status?: string;
      type?: string;
    }>({
      query: (params = {}) => ({
        url: '/railway/trains',
        params: {
          limit: 50,
          offset: 0,
          ...params,
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.trains.map(({ id }) => ({ type: 'Train' as const, id })),
              { type: 'Train', id: 'LIST' },
            ]
          : [{ type: 'Train', id: 'LIST' }],
      transformResponse: (response: any) => ({
        trains: response.trains || [],
        total: response.total || 0,
      }),
    }),
    
    getTrain: builder.query<Train, string>({
      query: (trainId) => `/railway/trains/${trainId}`,
      providesTags: (result, error, id) => [{ type: 'Train', id }],
    }),
    
    updateTrainPosition: builder.mutation<Train, {
      trainId: string;
      position: { lat: number; lng: number; heading?: number };
      speed: number;
    }>({
      query: ({ trainId, ...patch }) => ({
        url: `/railway/trains/${trainId}/position`,
        method: 'PUT',
        body: patch,
      }),
      invalidatesTags: (result, error, { trainId }) => [
        { type: 'Train', id: trainId },
        { type: 'Train', id: 'LIST' },
      ],
    }),
    
    updateTrainStatus: builder.mutation<Train, {
      trainId: string;
      status: Train['status'];
      delay?: number;
    }>({
      query: ({ trainId, ...patch }) => ({
        url: `/railway/trains/${trainId}/status`,
        method: 'PUT',
        body: patch,
      }),
      invalidatesTags: (result, error, { trainId }) => [
        { type: 'Train', id: trainId },
        { type: 'Train', id: 'LIST' },
        { type: 'Metrics', id: 'SYSTEM' },
      ],
    }),
    
    // Stations
    getStations: builder.query<{ stations: Station[] }, {
      type?: string;
      region?: string;
      limit?: number;
    }>({
      query: (params = {}) => ({
        url: '/railway/stations',
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.stations.map(({ id }) => ({ type: 'Station' as const, id })),
              { type: 'Station', id: 'LIST' },
            ]
          : [{ type: 'Station', id: 'LIST' }],
    }),
    
    getStation: builder.query<Station, string>({
      query: (stationId) => `/railway/stations/${stationId}`,
      providesTags: (result, error, id) => [{ type: 'Station', id }],
    }),
    
    getStationTrains: builder.query<{ trains: Train[] }, {
      stationId: string;
      hours?: number;
    }>({
      query: ({ stationId, hours = 2 }) => ({
        url: `/railway/stations/${stationId}/trains`,
        params: { hours },
      }),
      providesTags: (result, error, { stationId }) => [
        { type: 'Station', id: stationId },
        { type: 'Train', id: 'LIST' },
      ],
    }),
    
    // Conflicts
    getConflicts: builder.query<{ conflicts: Conflict[] }, {
      severity?: string;
      status?: string;
      limit?: number;
    }>({
      query: (params = {}) => ({
        url: '/railway/conflicts',
        params: {
          limit: 100,
          ...params,
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.conflicts.map(({ id }) => ({ type: 'Conflict' as const, id })),
              { type: 'Conflict', id: 'LIST' },
            ]
          : [{ type: 'Conflict', id: 'LIST' }],
    }),
    
    getConflict: builder.query<Conflict, string>({
      query: (conflictId) => `/railway/conflicts/${conflictId}`,
      providesTags: (result, error, id) => [{ type: 'Conflict', id }],
    }),
    
    resolveConflict: builder.mutation<Conflict, {
      conflictId: string;
      resolution: {
        strategy: string;
        implementedAt: string;
        effectiveness?: number;
      };
    }>({
      query: ({ conflictId, resolution }) => ({
        url: `/railway/conflicts/${conflictId}/resolve`,
        method: 'POST',
        body: { resolution },
      }),
      invalidatesTags: (result, error, { conflictId }) => [
        { type: 'Conflict', id: conflictId },
        { type: 'Conflict', id: 'LIST' },
        { type: 'Metrics', id: 'SYSTEM' },
      ],
    }),
    
    // Energy
    getEnergyData: builder.query<{ data: EnergyData[] }, {
      startTime?: string;
      endTime?: string;
      stations?: string[];
    }>({
      query: (params = {}) => ({
        url: '/railway/energy',
        params: {
          startTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endTime: new Date().toISOString(),
          ...params,
        },
      }),
      providesTags: [{ type: 'Energy', id: 'LIST' }],
    }),
    
    getEnergySeries: builder.query<{
      points: Array<{ h: number; base: number; opt: number }>;
      meta: { stations: string[]; hours: number };
    }, {
      stations?: string;
      hours?: number;
    }>({
      query: (params = {}) => ({
        url: '/api/energy/series',
        params: {
          stations: 'NDLS,CSMT,HWH',
          hours: 2,
          ...params,
        },
      }),
      providesTags: [{ type: 'Energy', id: 'SERIES' }],
    }),
    
    // System Metrics
    getSystemMetrics: builder.query<SystemMetrics, void>({
      query: () => '/railway/metrics',
      providesTags: [{ type: 'Metrics', id: 'SYSTEM' }],
    }),
    
    // Live Station Data (IRCTC Integration)
    getLiveStationData: builder.query<any, {
      stationCode: string;
      hours?: number;
    }>({
      query: ({ stationCode, hours = 2 }) => ({
        url: '/api/irctc/live-station',
        params: { station_code: stationCode, hours },
      }),
      keepUnusedDataFor: 60, // 1 minute for live data
    }),
    
    // Real-time updates
    subscribeToUpdates: builder.query<any, void>({
      query: () => '/railway/subscribe',
      // This would typically be a WebSocket connection
      // For now, we'll use polling
      pollingInterval: 5000, // 5 seconds
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useGetTrainsQuery,
  useGetTrainQuery,
  useUpdateTrainPositionMutation,
  useUpdateTrainStatusMutation,
  useGetStationsQuery,
  useGetStationQuery,
  useGetStationTrainsQuery,
  useGetConflictsQuery,
  useGetConflictQuery,
  useResolveConflictMutation,
  useGetEnergyDataQuery,
  useGetEnergySeriesQuery,
  useGetSystemMetricsQuery,
  useGetLiveStationDataQuery,
  useSubscribeToUpdatesQuery,
} = railwayApi;

// Export API for store configuration
export default railwayApi;
