/**
 * Notification State Management
 * Handles system notifications, alerts, and real-time updates
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface SystemNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'emergency';
  category: 'system' | 'train' | 'conflict' | 'energy' | 'maintenance' | 'security';
  title: string;
  message: string;
  details?: string;
  timestamp: string;
  read: boolean;
  persistent: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  actions?: NotificationAction[];
  metadata?: {
    trainId?: string;
    stationId?: string;
    conflictId?: string;
    userId?: string;
    [key: string]: any;
  };
  expiresAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface NotificationAction {
  id: string;
  label: string;
  action: string;
  variant: 'primary' | 'secondary' | 'danger' | 'success';
  params?: Record<string, any>;
  requiresConfirmation?: boolean;
}

export interface NotificationSettings {
  enabled: boolean;
  categories: {
    system: boolean;
    train: boolean;
    conflict: boolean;
    energy: boolean;
    maintenance: boolean;
    security: boolean;
  };
  priorities: {
    low: boolean;
    medium: boolean;
    high: boolean;
    critical: boolean;
  };
  channels: {
    browser: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  sound: {
    enabled: boolean;
    volume: number;
    criticalOnly: boolean;
  };
  doNotDisturb: {
    enabled: boolean;
    startTime: string;
    endTime: string;
  };
  autoMarkRead: {
    enabled: boolean;
    delay: number; // seconds
  };
}

export interface NotificationState {
  notifications: SystemNotification[];
  unreadCount: number;
  settings: NotificationSettings;
  
  // Real-time connection
  isConnected: boolean;
  lastSync: string | null;
  
  // Filters
  filters: {
    categories: string[];
    priorities: string[];
    read: boolean | null;
    dateRange: {
      start: string | null;
      end: string | null;
    };
  };
  
  // UI state
  isOpen: boolean;
  selectedNotification: string | null;
  
  // Performance
  stats: {
    totalReceived: number;
    totalRead: number;
    averageResponseTime: number;
    criticalCount: number;
  };
}

// Initial state
const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  
  settings: {
    enabled: true,
    categories: {
      system: true,
      train: true,
      conflict: true,
      energy: true,
      maintenance: true,
      security: true,
    },
    priorities: {
      low: true,
      medium: true,
      high: true,
      critical: true,
    },
    channels: {
      browser: true,
      email: false,
      sms: false,
      push: false,
    },
    sound: {
      enabled: true,
      volume: 0.5,
      criticalOnly: false,
    },
    doNotDisturb: {
      enabled: false,
      startTime: '22:00',
      endTime: '06:00',
    },
    autoMarkRead: {
      enabled: false,
      delay: 10,
    },
  },
  
  isConnected: false,
  lastSync: null,
  
  filters: {
    categories: [],
    priorities: [],
    read: null,
    dateRange: {
      start: null,
      end: null,
    },
  },
  
  isOpen: false,
  selectedNotification: null,
  
  stats: {
    totalReceived: 0,
    totalRead: 0,
    averageResponseTime: 0,
    criticalCount: 0,
  },
};

// Helper functions
const shouldShowNotification = (
  notification: SystemNotification,
  settings: NotificationSettings
): boolean => {
  if (!settings.enabled) return false;
  if (!settings.categories[notification.category]) return false;
  if (!settings.priorities[notification.priority]) return false;
  
  // Check do not disturb
  if (settings.doNotDisturb.enabled) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = parseInt(settings.doNotDisturb.startTime.split(':')[0]) * 60 + 
                     parseInt(settings.doNotDisturb.startTime.split(':')[1]);
    const endTime = parseInt(settings.doNotDisturb.endTime.split(':')[0]) * 60 + 
                   parseInt(settings.doNotDisturb.endTime.split(':')[1]);
    
    if (startTime <= endTime) {
      // Same day range
      if (currentTime >= startTime && currentTime <= endTime) {
        return notification.priority === 'critical';
      }
    } else {
      // Overnight range
      if (currentTime >= startTime || currentTime <= endTime) {
        return notification.priority === 'critical';
      }
    }
  }
  
  return true;
};

// Notification slice
const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Add notification
    addNotification: (state, action: PayloadAction<Omit<SystemNotification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: SystemNotification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      
      // Check if notification should be shown
      if (shouldShowNotification(notification, state.settings)) {
        state.notifications.unshift(notification);
        state.unreadCount += 1;
        state.stats.totalReceived += 1;
        
        if (notification.priority === 'critical') {
          state.stats.criticalCount += 1;
        }
        
        // Auto-expire non-persistent notifications after 24 hours
        if (!notification.persistent && !notification.expiresAt) {
          notification.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        }
        
        // Limit total notifications to prevent memory issues
        if (state.notifications.length > 1000) {
          const removed = state.notifications.splice(1000);
          removed.forEach(n => {
            if (!n.read) state.unreadCount = Math.max(0, state.unreadCount - 1);
          });
        }
      }
    },
    
    // Mark notification as read
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.stats.totalRead += 1;
      }
    },
    
    // Mark all as read
    markAllAsRead: (state) => {
      state.notifications.forEach(n => {
        if (!n.read) {
          n.read = true;
          state.stats.totalRead += 1;
        }
      });
      state.unreadCount = 0;
    },
    
    // Acknowledge notification
    acknowledgeNotification: (state, action: PayloadAction<{ id: string; userId: string }>) => {
      const notification = state.notifications.find(n => n.id === action.payload.id);
      if (notification) {
        notification.acknowledgedBy = action.payload.userId;
        notification.acknowledgedAt = new Date().toISOString();
        if (!notification.read) {
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
          state.stats.totalRead += 1;
        }
      }
    },
    
    // Remove notification
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.read) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.notifications.splice(index, 1);
      }
    },
    
    // Clear expired notifications
    clearExpired: (state) => {
      const now = new Date().toISOString();
      const beforeCount = state.notifications.length;
      
      state.notifications = state.notifications.filter(n => {
        if (n.expiresAt && n.expiresAt <= now) {
          if (!n.read) state.unreadCount = Math.max(0, state.unreadCount - 1);
          return false;
        }
        return true;
      });
      
      const removedCount = beforeCount - state.notifications.length;
      if (removedCount > 0) {
        console.log(`Cleared ${removedCount} expired notifications`);
      }
    },
    
    // Clear all notifications
    clearAll: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    
    // Update settings
    updateSettings: (state, action: PayloadAction<Partial<NotificationSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    
    // Set connection status
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      if (action.payload) {
        state.lastSync = new Date().toISOString();
      }
    },
    
    // Set filters
    setFilters: (state, action: PayloadAction<Partial<NotificationState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    
    // UI actions
    togglePanel: (state) => {
      state.isOpen = !state.isOpen;
    },
    
    openPanel: (state) => {
      state.isOpen = true;
    },
    
    closePanel: (state) => {
      state.isOpen = false;
    },
    
    selectNotification: (state, action: PayloadAction<string | null>) => {
      state.selectedNotification = action.payload;
    },
    
    // Bulk operations
    bulkMarkAsRead: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(id => {
        const notification = state.notifications.find(n => n.id === id);
        if (notification && !notification.read) {
          notification.read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
          state.stats.totalRead += 1;
        }
      });
    },
    
    bulkRemove: (state, action: PayloadAction<string[]>) => {
      action.payload.forEach(id => {
        const index = state.notifications.findIndex(n => n.id === id);
        if (index !== -1) {
          const notification = state.notifications[index];
          if (!notification.read) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.notifications.splice(index, 1);
        }
      });
    },
    
    // Performance tracking
    updateStats: (state, action: PayloadAction<Partial<NotificationState['stats']>>) => {
      state.stats = { ...state.stats, ...action.payload };
    },
    
    // Reset state
    resetNotifications: () => initialState,
  },
});

// Export actions
export const {
  addNotification,
  markAsRead,
  markAllAsRead,
  acknowledgeNotification,
  removeNotification,
  clearExpired,
  clearAll,
  updateSettings,
  setConnectionStatus,
  setFilters,
  togglePanel,
  openPanel,
  closePanel,
  selectNotification,
  bulkMarkAsRead,
  bulkRemove,
  updateStats,
  resetNotifications,
} = notificationSlice.actions;

// Selectors
export const selectNotifications = (state: { notifications: NotificationState }) => state.notifications;
export const selectUnreadCount = (state: { notifications: NotificationState }) => state.notifications.unreadCount;
export const selectNotificationSettings = (state: { notifications: NotificationState }) => state.notifications.settings;
export const selectNotificationFilters = (state: { notifications: NotificationState }) => state.notifications.filters;

// Filtered notifications selector
export const selectFilteredNotifications = (state: { notifications: NotificationState }) => {
  const { notifications, filters } = state.notifications;
  
  return notifications.filter(notification => {
    // Category filter
    if (filters.categories.length > 0 && !filters.categories.includes(notification.category)) {
      return false;
    }
    
    // Priority filter
    if (filters.priorities.length > 0 && !filters.priorities.includes(notification.priority)) {
      return false;
    }
    
    // Read status filter
    if (filters.read !== null && notification.read !== filters.read) {
      return false;
    }
    
    // Date range filter
    if (filters.dateRange.start && notification.timestamp < filters.dateRange.start) {
      return false;
    }
    if (filters.dateRange.end && notification.timestamp > filters.dateRange.end) {
      return false;
    }
    
    return true;
  });
};

export default notificationSlice.reducer;
