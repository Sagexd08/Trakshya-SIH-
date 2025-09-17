/**
 * Authentication State Management
 * Handles user authentication, permissions, and session management
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { config } from '@/config';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  permissions: Permission[];
  avatar?: string;
  lastLogin?: string;
  preferences: UserPreferences;
}

export type UserRole = 
  | 'admin' 
  | 'controller' 
  | 'operator' 
  | 'analyst' 
  | 'viewer'
  | 'maintenance'
  | 'safety_officer';

export type Permission = 
  | 'read_dashboard'
  | 'write_decisions'
  | 'manage_scenarios'
  | 'view_analytics'
  | 'manage_users'
  | 'system_admin'
  | 'emergency_override'
  | 'maintenance_mode';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'hi';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  dashboard: {
    layout: 'compact' | 'expanded';
    refreshInterval: number;
    defaultView: string;
  };
  accessibility: {
    highContrast: boolean;
    fontSize: 'small' | 'medium' | 'large';
    screenReader: boolean;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiry: string | null;
  loginAttempts: number;
  lastActivity: string | null;
  permissions: Permission[];
  role: UserRole | null;
  isDemo: boolean;
}

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionExpiry: null,
  loginAttempts: 0,
  lastActivity: null,
  permissions: [],
  role: null,
  isDemo: !config.services.clerk.enabled,
};

// Demo user for development
const demoUser: User = {
  id: 'demo-user',
  email: 'demo@trakshya.com',
  name: 'Demo Controller',
  role: 'controller',
  department: 'Operations',
  permissions: [
    'read_dashboard',
    'write_decisions',
    'manage_scenarios',
    'view_analytics',
  ],
  avatar: '/avatars/demo-user.png',
  lastLogin: new Date().toISOString(),
  preferences: {
    theme: 'dark',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    dashboard: {
      layout: 'expanded',
      refreshInterval: 30000,
      defaultView: 'dashboard',
    },
    accessibility: {
      highContrast: false,
      fontSize: 'medium',
      screenReader: false,
    },
  },
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      if (!config.services.clerk.enabled) {
        // Demo mode
        return demoUser;
      }

      // Real authentication logic would go here
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Login failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logoutUser',
  async (_, { rejectWithValue }) => {
    try {
      if (!config.services.clerk.enabled) {
        return; // Demo mode
      }

      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Logout failed');
    }
  }
);

export const refreshSession = createAsyncThunk(
  'auth/refreshSession',
  async (_, { rejectWithValue }) => {
    try {
      if (!config.services.clerk.enabled) {
        return demoUser; // Demo mode
      }

      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      
      if (!response.ok) {
        throw new Error('Session refresh failed');
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Session refresh failed');
    }
  }
);

// Auth slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.permissions = action.payload.permissions;
      state.role = action.payload.role;
      state.error = null;
    },

    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.permissions = [];
      state.role = null;
      state.sessionExpiry = null;
      state.lastActivity = null;
    },

    updateUserPreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      if (state.user) {
        state.user.preferences = { ...state.user.preferences, ...action.payload };
      }
    },

    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    clearError: (state) => {
      state.error = null;
    },

    updateLastActivity: (state) => {
      state.lastActivity = new Date().toISOString();
    },

    incrementLoginAttempts: (state) => {
      state.loginAttempts += 1;
    },

    resetLoginAttempts: (state) => {
      state.loginAttempts = 0;
    },

    setSessionExpiry: (state, action: PayloadAction<string>) => {
      state.sessionExpiry = action.payload;
    },

    initializeDemoMode: (state) => {
      if (state.isDemo) {
        state.user = demoUser;
        state.isAuthenticated = true;
        state.permissions = demoUser.permissions;
        state.role = demoUser.role;
        state.lastActivity = new Date().toISOString();
      }
    },
  },

  extraReducers: (builder) => {
    // Login user
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.permissions = action.payload.permissions;
        state.role = action.payload.role;
        state.loginAttempts = 0;
        state.lastActivity = new Date().toISOString();
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.loginAttempts += 1;
      });

    // Logout user
    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.role = null;
        state.sessionExpiry = null;
        state.lastActivity = null;
      });

    // Refresh session
    builder
      .addCase(refreshSession.fulfilled, (state, action) => {
        if (action.payload) {
          state.user = action.payload;
          state.isAuthenticated = true;
          state.permissions = action.payload.permissions;
          state.role = action.payload.role;
          state.lastActivity = new Date().toISOString();
        }
      })
      .addCase(refreshSession.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.permissions = [];
        state.role = null;
      });
  },
});

// Export actions
export const {
  setUser,
  clearUser,
  updateUserPreferences,
  setError,
  clearError,
  updateLastActivity,
  incrementLoginAttempts,
  resetLoginAttempts,
  setSessionExpiry,
  initializeDemoMode,
} = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectUserRole = (state: { auth: AuthState }) => state.auth.role;
export const selectUserPermissions = (state: { auth: AuthState }) => state.auth.permissions;
export const selectIsDemo = (state: { auth: AuthState }) => state.auth.isDemo;

// Permission checker
export const hasPermission = (permissions: Permission[], required: Permission) => {
  return permissions.includes(required) || permissions.includes('system_admin');
};

export default authSlice.reducer;
