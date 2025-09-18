import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface CacheSchema extends DBSchema {
  trains: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      version: number;
    };
    indexes: { 'by-timestamp': number };
  };
  train_positions: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      version: number;
    };
    indexes: { 'by-timestamp': number; 'by-train': string };
  };
  conflicts: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      version: number;
    };
    indexes: { 'by-timestamp': number };
  };
  signals: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      version: number;
    };
    indexes: { 'by-timestamp': number };
  };
  energy_logs: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      version: number;
    };
    indexes: { 'by-timestamp': number };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: any;
      timestamp: number;
    };
  };
}

class IndexedDBCache {
  private db: IDBPDatabase<CacheSchema> | null = null;
  private dbName = 'TrakshyaCache';
  private dbVersion = 1;
  private maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private maxEntries = 10000; // Maximum entries per store

  async init(): Promise<void> {
    try {
      this.db = await openDB<CacheSchema>(this.dbName, this.dbVersion, {
        upgrade(db) {
          // Create trains store
          if (!db.objectStoreNames.contains('trains')) {
            const trainsStore = db.createObjectStore('trains', { keyPath: 'id' });
            trainsStore.createIndex('by-timestamp', 'timestamp');
          }

          // Create train_positions store
          if (!db.objectStoreNames.contains('train_positions')) {
            const positionsStore = db.createObjectStore('train_positions', { keyPath: 'id' });
            positionsStore.createIndex('by-timestamp', 'timestamp');
            positionsStore.createIndex('by-train', 'data.train_no');
          }

          // Create conflicts store
          if (!db.objectStoreNames.contains('conflicts')) {
            const conflictsStore = db.createObjectStore('conflicts', { keyPath: 'id' });
            conflictsStore.createIndex('by-timestamp', 'timestamp');
          }

          // Create signals store
          if (!db.objectStoreNames.contains('signals')) {
            const signalsStore = db.createObjectStore('signals', { keyPath: 'id' });
            signalsStore.createIndex('by-timestamp', 'timestamp');
          }

          // Create energy_logs store
          if (!db.objectStoreNames.contains('energy_logs')) {
            const energyStore = db.createObjectStore('energy_logs', { keyPath: 'id' });
            energyStore.createIndex('by-timestamp', 'timestamp');
          }

          // Create metadata store
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', { keyPath: 'key' });
          }
        },
      });

      console.log('IndexedDB cache initialized');
      
      // Clean up old entries on initialization
      await this.cleanup();
    } catch (error) {
      console.error('Failed to initialize IndexedDB cache:', error);
    }
  }

  async set(storeName: keyof CacheSchema, id: string, data: any): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) throw new Error('Database not initialized');

    try {
      const timestamp = Date.now();
      const version = await this.getNextVersion(storeName, id);
      
      await this.db.put(storeName as any, {
        id,
        data,
        timestamp,
        version
      });

      // Maintain cache size
      await this.maintainCacheSize(storeName);
    } catch (error) {
      console.error(`Failed to cache data in ${storeName}:`, error);
    }
  }

  async get(storeName: keyof CacheSchema, id: string): Promise<any | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    try {
      const entry = await this.db.get(storeName as any, id);
      
      if (!entry) return null;
      
      // Check if entry is expired
      if (Date.now() - entry.timestamp > this.maxAge) {
        await this.delete(storeName, id);
        return null;
      }
      
      return entry.data;
    } catch (error) {
      console.error(`Failed to get data from ${storeName}:`, error);
      return null;
    }
  }

  async getAll(storeName: keyof CacheSchema, limit?: number): Promise<any[]> {
    if (!this.db) await this.init();
    if (!this.db) return [];

    try {
      const tx = this.db.transaction(storeName as any, 'readonly');
      const store = tx.objectStore(storeName as any);
      const index = (store as any).index('by-timestamp');

      // Get entries in reverse chronological order (newest first)
      const entries = (await index.getAll(undefined, limit)) as Array<{ id: string; data: any; timestamp: number; version?: number }>;
      entries.reverse();
      
      const now = Date.now();
      const validEntries = entries.filter(entry => 
        now - entry.timestamp <= this.maxAge
      );
      
      return validEntries.map(entry => entry.data);
    } catch (error) {
      console.error(`Failed to get all data from ${storeName}:`, error);
      return [];
    }
  }

  async delete(storeName: keyof CacheSchema, id: string): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    try {
      await this.db.delete(storeName as any, id);
    } catch (error) {
      console.error(`Failed to delete data from ${storeName}:`, error);
    }
  }

  async clear(storeName: keyof CacheSchema): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    try {
      await this.db.clear(storeName as any);
    } catch (error) {
      console.error(`Failed to clear ${storeName}:`, error);
    }
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    try {
      const storeNames: (keyof CacheSchema)[] = [
        'trains', 'train_positions', 'conflicts', 'signals', 'energy_logs'
      ];
      
      for (const storeName of storeNames) {
        await this.clear(storeName);
      }
      
      console.log('All cache stores cleared');
    } catch (error) {
      console.error('Failed to clear all stores:', error);
    }
  }

  async cleanup(): Promise<void> {
    if (!this.db) return;

    try {
      const storeNames: (keyof CacheSchema)[] = [
        'trains', 'train_positions', 'conflicts', 'signals', 'energy_logs'
      ];
      
      const now = Date.now();
      
      for (const storeName of storeNames) {
        const tx = this.db.transaction(storeName as any, 'readwrite');
        const store = tx.objectStore(storeName as any);
        const index = (store as any).index('by-timestamp');

        // Get all expired entries
        const expiredEntries = await index.getAll(
          IDBKeyRange.upperBound(now - this.maxAge)
        );
        
        // Delete expired entries
        for (const entry of expiredEntries) {
          await store.delete(entry.id);
        }
        
        await tx.done;
      }
      
      console.log('Cache cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup cache:', error);
    }
  }

  private async maintainCacheSize(storeName: keyof CacheSchema): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(storeName as any, 'readwrite');
      const store = tx.objectStore(storeName as any);
      const count = await store.count();
      
      if (count > this.maxEntries) {
        const index = (store as any).index('by-timestamp');
        const oldestEntries = await index.getAll(
          undefined,
          count - this.maxEntries
        );
        
        for (const entry of oldestEntries) {
          await store.delete(entry.id);
        }
      }
      
      await tx.done;
    } catch (error) {
      console.error(`Failed to maintain cache size for ${storeName}:`, error);
    }
  }

  private async getNextVersion(storeName: keyof CacheSchema, id: string): Promise<number> {
    if (!this.db) return 1;

    try {
      const existing = await this.db.get(storeName as any, id);
      return existing ? existing.version + 1 : 1;
    } catch (error) {
      return 1;
    }
  }

  // Metadata operations
  async setMetadata(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    try {
      await this.db.put('metadata', {
        key,
        value,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Failed to set metadata:', error);
    }
  }

  async getMetadata(key: string): Promise<any | null> {
    if (!this.db) await this.init();
    if (!this.db) return null;

    try {
      const entry = await this.db.get('metadata', key);
      return entry ? entry.value : null;
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return null;
    }
  }

  // Batch operations for better performance
  async setBatch(storeName: keyof CacheSchema, items: Array<{ id: string; data: any }>): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    try {
      const tx = this.db.transaction(storeName as any, 'readwrite');
      const store = tx.objectStore(storeName as any);
      const timestamp = Date.now();
      
      for (const item of items) {
        const version = await this.getNextVersion(storeName, item.id);
        await store.put({
          id: item.id,
          data: item.data,
          timestamp,
          version
        });
      }
      
      await tx.done;
      await this.maintainCacheSize(storeName);
    } catch (error) {
      console.error(`Failed to batch set data in ${storeName}:`, error);
    }
  }

  // Get cache statistics
  async getStats(): Promise<{
    totalSize: number;
    storeStats: Record<string, { count: number; oldestEntry: Date | null; newestEntry: Date | null }>;
  }> {
    if (!this.db) await this.init();
    if (!this.db) return { totalSize: 0, storeStats: {} };

    try {
      const storeNames: (keyof CacheSchema)[] = [
        'trains', 'train_positions', 'conflicts', 'signals', 'energy_logs'
      ];
      
      let totalSize = 0;
      const storeStats: Record<string, any> = {};
      
      for (const storeName of storeNames) {
        const tx = this.db.transaction(storeName as any, 'readonly');
        const store = tx.objectStore(storeName as any);
        const index = (store as any).index('by-timestamp');

        const count = await store.count();
        totalSize += count;
        
        const oldest = await index.get(IDBKeyRange.lowerBound(0));
        const newest = await index.get(IDBKeyRange.upperBound(Date.now()));
        
        storeStats[storeName] = {
          count,
          oldestEntry: oldest ? new Date(oldest.timestamp) : null,
          newestEntry: newest ? new Date(newest.timestamp) : null
        };
        
        await tx.done;
      }
      
      return { totalSize, storeStats };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { totalSize: 0, storeStats: {} };
    }
  }
}

// Singleton instance
export const indexedDBCache = new IndexedDBCache();

// Initialize cache when module loads
if (typeof window !== 'undefined') {
  indexedDBCache.init().catch(console.error);
}
