/**
 * UI State Management
 * Handles application UI state, modals, sidebars, themes, and user interface preferences
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Types
export interface Modal {
  id: string;
  type: ModalType;
  isOpen: boolean;
  data?: any;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
}

export type ModalType = 
  | 'scenario'
  | 'train-details'
  | 'conflict-resolution'
  | 'user-profile'
  | 'settings'
  | 'help'
  | 'emergency'
  | 'maintenance'
  | 'analytics'
  | 'export-data';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  persistent?: boolean;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface Layout {
  sidebar: {
    isOpen: boolean;
    isCollapsed: boolean;
    width: number;
  };
  navbar: {
    height: number;
    isVisible: boolean;
  };
  panels: {
    assistant: boolean;
    insights: boolean;
    notifications: boolean;
  };
  grid: {
    columns: number;
    gap: number;
    responsive: boolean;
  };
}

export interface Theme {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  accentColor: string;
  fontSize: 'sm' | 'md' | 'lg';
  density: 'compact' | 'comfortable' | 'spacious';
  animations: boolean;
  reducedMotion: boolean;
}

export interface UIState {
  // Layout
  layout: Layout;
  
  // Theme
  theme: Theme;
  
  // Modals
  modals: Modal[];
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  
  // Loading states
  loading: {
    global: boolean;
    components: Record<string, boolean>;
  };
  
  // Error states
  errors: {
    global: string | null;
    components: Record<string, string>;
  };
  
  // Feature flags
  features: {
    experimentalUI: boolean;
    betaFeatures: boolean;
    debugMode: boolean;
  };
  
  // Performance
  performance: {
    renderTime: number;
    lastUpdate: string;
    memoryUsage?: number;
  };
  
  // Accessibility
  accessibility: {
    highContrast: boolean;
    screenReader: boolean;
    keyboardNavigation: boolean;
    focusVisible: boolean;
  };
}

// Initial state
const initialState: UIState = {
  layout: {
    sidebar: {
      isOpen: true,
      isCollapsed: false,
      width: 280,
    },
    navbar: {
      height: 64,
      isVisible: true,
    },
    panels: {
      assistant: false,
      insights: false,
      notifications: false,
    },
    grid: {
      columns: 12,
      gap: 16,
      responsive: true,
    },
  },
  
  theme: {
    mode: 'dark',
    primaryColor: '#06b6d4', // cyan-500
    accentColor: '#f59e0b', // amber-500
    fontSize: 'md',
    density: 'comfortable',
    animations: true,
    reducedMotion: false,
  },
  
  modals: [],
  
  notifications: [],
  unreadCount: 0,
  
  loading: {
    global: false,
    components: {},
  },
  
  errors: {
    global: null,
    components: {},
  },
  
  features: {
    experimentalUI: false,
    betaFeatures: false,
    debugMode: process.env.NODE_ENV === 'development',
  },
  
  performance: {
    renderTime: 0,
    lastUpdate: new Date().toISOString(),
  },
  
  accessibility: {
    highContrast: false,
    screenReader: false,
    keyboardNavigation: true,
    focusVisible: true,
  },
};

// UI slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Layout actions
    toggleSidebar: (state) => {
      state.layout.sidebar.isOpen = !state.layout.sidebar.isOpen;
    },
    
    collapseSidebar: (state, action: PayloadAction<boolean>) => {
      state.layout.sidebar.isCollapsed = action.payload;
    },
    
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.layout.sidebar.width = action.payload;
    },
    
    togglePanel: (state, action: PayloadAction<keyof Layout['panels']>) => {
      state.layout.panels[action.payload] = !state.layout.panels[action.payload];
    },
    
    setLayout: (state, action: PayloadAction<Partial<Layout>>) => {
      state.layout = { ...state.layout, ...action.payload };
    },
    
    // Theme actions
    setTheme: (state, action: PayloadAction<Partial<Theme>>) => {
      state.theme = { ...state.theme, ...action.payload };
    },
    
    toggleThemeMode: (state) => {
      state.theme.mode = state.theme.mode === 'dark' ? 'light' : 'dark';
    },
    
    // Modal actions
    openModal: (state, action: PayloadAction<Omit<Modal, 'isOpen'>>) => {
      const existingModal = state.modals.find(m => m.id === action.payload.id);
      if (existingModal) {
        existingModal.isOpen = true;
        existingModal.data = action.payload.data;
      } else {
        state.modals.push({ ...action.payload, isOpen: true });
      }
    },
    
    closeModal: (state, action: PayloadAction<string>) => {
      const modal = state.modals.find(m => m.id === action.payload);
      if (modal) {
        modal.isOpen = false;
      }
    },
    
    removeModal: (state, action: PayloadAction<string>) => {
      state.modals = state.modals.filter(m => m.id !== action.payload);
    },
    
    // Notification actions
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: `notification-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      state.notifications.unshift(notification);
      state.unreadCount += 1;
    },
    
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.read) {
        notification.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    
    markAllNotificationsRead: (state) => {
      state.notifications.forEach(n => n.read = true);
      state.unreadCount = 0;
    },
    
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
    
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    
    // Loading actions
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    
    setComponentLoading: (state, action: PayloadAction<{ component: string; loading: boolean }>) => {
      state.loading.components[action.payload.component] = action.payload.loading;
    },
    
    // Error actions
    setGlobalError: (state, action: PayloadAction<string | null>) => {
      state.errors.global = action.payload;
    },
    
    setComponentError: (state, action: PayloadAction<{ component: string; error: string | null }>) => {
      if (action.payload.error) {
        state.errors.components[action.payload.component] = action.payload.error;
      } else {
        delete state.errors.components[action.payload.component];
      }
    },
    
    clearErrors: (state) => {
      state.errors.global = null;
      state.errors.components = {};
    },
    
    // Feature flags
    toggleFeature: (state, action: PayloadAction<keyof UIState['features']>) => {
      state.features[action.payload] = !state.features[action.payload];
    },
    
    // Performance tracking
    updatePerformance: (state, action: PayloadAction<Partial<UIState['performance']>>) => {
      state.performance = { ...state.performance, ...action.payload };
      state.performance.lastUpdate = new Date().toISOString();
    },
    
    // Accessibility
    setAccessibility: (state, action: PayloadAction<Partial<UIState['accessibility']>>) => {
      state.accessibility = { ...state.accessibility, ...action.payload };
    },
    
    // Reset UI state
    resetUI: (state) => {
      return { ...initialState, features: state.features };
    },
  },
});

// Export actions
export const {
  toggleSidebar,
  collapseSidebar,
  setSidebarWidth,
  togglePanel,
  setLayout,
  setTheme,
  toggleThemeMode,
  openModal,
  closeModal,
  removeModal,
  addNotification,
  markNotificationRead,
  markAllNotificationsRead,
  removeNotification,
  clearNotifications,
  setGlobalLoading,
  setComponentLoading,
  setGlobalError,
  setComponentError,
  clearErrors,
  toggleFeature,
  updatePerformance,
  setAccessibility,
  resetUI,
} = uiSlice.actions;

// Selectors
export const selectUI = (state: { ui: UIState }) => state.ui;
export const selectLayout = (state: { ui: UIState }) => state.ui.layout;
export const selectTheme = (state: { ui: UIState }) => state.ui.theme;
export const selectModals = (state: { ui: UIState }) => state.ui.modals;
export const selectNotifications = (state: { ui: UIState }) => state.ui.notifications;
export const selectUnreadCount = (state: { ui: UIState }) => state.ui.unreadCount;
export const selectLoading = (state: { ui: UIState }) => state.ui.loading;
export const selectErrors = (state: { ui: UIState }) => state.ui.errors;
export const selectFeatures = (state: { ui: UIState }) => state.ui.features;

export default uiSlice.reducer;
