import { createSupabaseBrowser } from '@/lib/supabase/client';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface RealtimeSubscriptionOptions {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onData?: (payload: RealtimePostgresChangesPayload<any>) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

interface ConnectionState {
  isConnected: boolean;
  lastConnected: Date | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  maxReconnectDelay: number;
}

class SupabaseRealtimeManager {
  private supabase = createSupabaseBrowser();
  private channels: Map<string, RealtimeChannel> = new Map();
  private connectionState: ConnectionState = {
    isConnected: false,
    lastConnected: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    reconnectDelay: 1000, // Start with 1 second
    maxReconnectDelay: 30000 // Max 30 seconds
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.setupConnectionMonitoring();
  }

  private setupConnectionMonitoring() {
    // Monitor connection status
    this.heartbeatTimer = setInterval(() => {
      this.checkConnection();
    }, 10000); // Check every 10 seconds

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Network back online, attempting to reconnect...');
        this.reconnectAll();
      });

      window.addEventListener('offline', () => {
        console.log('Network offline, pausing realtime subscriptions');
        this.handleDisconnection();
      });
    }
  }

  private async checkConnection() {
    try {
      // Avoid noisy pings to non-existent tables; rely on channel status instead.
      // If we are currently disconnected and have active listeners, attempt reconnect.
      const hasListeners = this.listeners.size > 0 && Array.from(this.listeners.keys()).some(k => !k.startsWith('_'));
      if (!this.connectionState.isConnected && hasListeners && !this.reconnectTimer) {
        this.reconnectAll();
      }
    } catch {
      // No-op: channel events will drive reconnection
    }
  }

  private handleDisconnection() {
    if (this.connectionState.isConnected) {
      this.connectionState.isConnected = false;
      this.notifyListeners('disconnect');
      console.log('Supabase realtime disconnected');
    }
  }

  private handleReconnection() {
    this.connectionState.isConnected = true;
    this.connectionState.lastConnected = new Date();
    this.connectionState.reconnectAttempts = 0;
    this.connectionState.reconnectDelay = 1000; // Reset delay
    this.notifyListeners('connect');
    console.log('Supabase realtime reconnected');
  }

  private calculateBackoffDelay(): number {
    // Exponential backoff with jitter
    const baseDelay = Math.min(
      this.connectionState.reconnectDelay * Math.pow(2, this.connectionState.reconnectAttempts),
      this.connectionState.maxReconnectDelay
    );
    
    // Add jitter (±25%)
    const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
    return Math.max(1000, baseDelay + jitter);
  }

  private async reconnectAll() {
    if (this.connectionState.reconnectAttempts >= this.connectionState.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.connectionState.reconnectAttempts++;
    const delay = this.calculateBackoffDelay();

    console.log(`Attempting reconnection ${this.connectionState.reconnectAttempts}/${this.connectionState.maxReconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Remove all existing channels
        this.channels.forEach((channel) => {
          this.supabase.removeChannel(channel);
        });
        this.channels.clear();

        // Recreate all subscriptions
        const subscriptions = Array.from(this.listeners.keys());
        for (const subscriptionKey of subscriptions) {
          const [table, event, filter] = subscriptionKey.split(':');
          await this.resubscribe(table, event as any, filter);
        }

        this.handleReconnection();
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.reconnectAll(); // Try again
      }
    }, delay);
  }

  private async resubscribe(table: string, event: string, filter?: string) {
    const subscriptionKey = `${table}:${event}:${filter || ''}`;
    const callbacks = this.listeners.get(subscriptionKey);
    
    if (callbacks && callbacks.size > 0) {
      await this.subscribe({
        table,
        event: event as any,
        filter,
        onData: (payload) => {
          callbacks.forEach(callback => callback(payload));
        }
      });
    }
  }

  private notifyListeners(event: 'connect' | 'disconnect') {
    const eventListeners = this.listeners.get(`_${event}`);
    if (eventListeners) {
      eventListeners.forEach(callback => callback());
    }
  }

  async subscribe(options: RealtimeSubscriptionOptions): Promise<string> {
    const {
      table,
      event = '*',
      filter,
      onData,
      onError,
      onConnect,
      onDisconnect
    } = options;

    const subscriptionKey = `${table}:${event}:${filter || ''}`;
    
    // Store callback for reconnection
    if (onData) {
      if (!this.listeners.has(subscriptionKey)) {
        this.listeners.set(subscriptionKey, new Set());
      }
      this.listeners.get(subscriptionKey)!.add(onData);
    }

    // Store connection callbacks
    if (onConnect) {
      if (!this.listeners.has('_connect')) {
        this.listeners.set('_connect', new Set());
      }
      this.listeners.get('_connect')!.add(onConnect);
    }

    if (onDisconnect) {
      if (!this.listeners.has('_disconnect')) {
        this.listeners.set('_disconnect', new Set());
      }
      this.listeners.get('_disconnect')!.add(onDisconnect);
    }

    try {
      const channelName = `realtime:${subscriptionKey}`;
      
      // Remove existing channel if it exists
      if (this.channels.has(channelName)) {
        const existingChannel = this.channels.get(channelName)!;
        this.supabase.removeChannel(existingChannel);
      }

      const channel = this.supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event,
            schema: 'public',
            table,
            filter
          },
          (payload: RealtimePostgresChangesPayload<any>) => {
            if (onData) {
              onData(payload);
            }
          }
        )
        .subscribe((status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => {
          if (status === 'SUBSCRIBED') {
            this.connectionState.isConnected = true;
            this.connectionState.lastConnected = new Date();
            if (onConnect) onConnect();
            console.log(`Subscribed to ${table} changes`);
          } else if (status === 'CHANNEL_ERROR') {
            this.connectionState.isConnected = false;
            if (onDisconnect) onDisconnect();
            console.warn(`Realtime channel error for ${table} (will retry)`);
            if (!this.reconnectTimer) this.reconnectAll();
          } else if (status === 'TIMED_OUT') {
            this.connectionState.isConnected = false;
            if (onDisconnect) onDisconnect();
            console.warn(`Realtime subscription timed out for ${table} (will retry)`);
            if (!this.reconnectTimer) this.reconnectAll();
          } else if (status === 'CLOSED') {
            this.connectionState.isConnected = false;
            if (onDisconnect) onDisconnect();
            console.log(`Realtime subscription closed for ${table}`);
            if (!this.reconnectTimer) this.reconnectAll();
          }
        });

      this.channels.set(channelName, channel);
      return subscriptionKey;

    } catch (error) {
      console.warn('Subscription setup error (will not crash):', error);
      if (onDisconnect) onDisconnect();
      // Do not throw in dev to avoid noisy overlay; retries will occur via checkConnection
      return subscriptionKey;
    }
  }

  unsubscribe(subscriptionKey: string) {
    const channelName = `realtime:${subscriptionKey}`;
    const channel = this.channels.get(channelName);
    
    if (channel) {
      this.supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }

    // Remove listeners
    this.listeners.delete(subscriptionKey);
    
    console.log(`Unsubscribed from ${subscriptionKey}`);
  }

  unsubscribeAll() {
    this.channels.forEach((channel, channelName) => {
      this.supabase.removeChannel(channel);
    });
    this.channels.clear();
    this.listeners.clear();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    console.log('All subscriptions removed');
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  // Convenience methods for common subscriptions
  subscribeToTrains(onData: (payload: any) => void, onError?: (error: Error) => void) {
    return this.subscribe({
      table: 'trains',
      event: '*',
      onData,
      onError
    });
  }

  subscribeToTrainPositions(onData: (payload: any) => void, onError?: (error: Error) => void) {
    return this.subscribe({
      table: 'train_positions',
      event: '*',
      onData,
      onError
    });
  }

  subscribeToConflicts(onData: (payload: any) => void, onError?: (error: Error) => void) {
    return this.subscribe({
      table: 'conflicts',
      event: '*',
      onData,
      onError
    });
  }

  subscribeToSignals(onData: (payload: any) => void, onError?: (error: Error) => void) {
    return this.subscribe({
      table: 'signals',
      event: '*',
      onData,
      onError
    });
  }

  subscribeToEnergyLogs(onData: (payload: any) => void, onError?: (error: Error) => void) {
    return this.subscribe({
      table: 'energy_logs',
      event: '*',
      onData,
      onError
    });
  }
}

// Singleton instance
export const realtimeManager = new SupabaseRealtimeManager();

// React hook for easy usage
export function useSupabaseRealtime() {
  return realtimeManager;
}
