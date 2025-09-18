/**
 * Enhanced Redux Store Configuration
 * Provides centralized state management with RTK Query integration
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Import slice reducers
import authSlice from './slices/authSlice';
import uiSlice from './slices/uiSlice';
import railwaySlice from './slices/railwaySlice';
import aiSlice from './slices/aiSlice';
import notificationSlice from './slices/notificationSlice';

// Import API slices
import { railwayApi } from './api/railwayApi';
import { aiApi } from './api/aiApi';
import { authApi } from './api/authApi';

import { config, isDevelopment } from '@/config';

// Persist configuration
const persistConfig = {
  key: 'trakshya-root',
  storage,
  whitelist: ['auth', 'ui'], // Only persist auth and UI state
  blacklist: ['railway', 'ai'], // Don't persist real-time data
};

// Root reducer
const rootReducer = combineReducers({
  // Feature slices
  auth: authSlice,
  ui: uiSlice,
  railway: railwaySlice,
  ai: aiSlice,
  notifications: notificationSlice,

  // API slices
  [railwayApi.reducerPath]: railwayApi.reducer,
  [aiApi.reducerPath]: aiApi.reducer,
  [authApi.reducerPath]: authApi.reducer,
});

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Store configuration
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredPaths: ['register'],
      },
    })
      .concat(railwayApi.middleware)
      .concat(aiApi.middleware)
      .concat(authApi.middleware),
  devTools: isDevelopment() && {
    name: 'Trakshya Store',
    trace: true,
    traceLimit: 25,
  },
});

// Setup RTK Query listeners
setupListeners(store.dispatch);

// Create persistor
export const persistor = persistStore(store);

// Type definitions
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Store utilities
export const getStoreState = () => store.getState();


// Store health check
export const validateStore = () => {
  const state = store.getState();
  const issues: string[] = [];

  // Check for required state
  if (!state.auth) issues.push('Auth state not initialized');
  if (!state.ui) issues.push('UI state not initialized');
  if (!state.railway) issues.push('Railway state not initialized');

  return {
    isHealthy: issues.length === 0,
    issues,
    stateKeys: Object.keys(state),
  };
};

// Export store health for monitoring
export const storeHealth = validateStore();

if (isDevelopment()) {
  console.log('🏪 Store initialized:', {
    health: storeHealth,
    middleware: [
      'redux-persist',
      'RTK Query',
      'DevTools',
    ],
  });
}

// Store subscription for external monitoring
export const subscribeToStore = (callback: (state: RootState) => void) => {
  return store.subscribe(() => callback(store.getState()));
};

// Action creators for common operations
export const storeActions = {
  reset: () => ({ type: 'RESET_STORE' }),
  hydrate: (payload: Partial<RootState>) => ({ type: 'HYDRATE_STORE', payload }),
};

// Middleware for handling store reset
const resetMiddleware = (store: any) => (next: any) => (action: any) => {
  if (action.type === 'RESET_STORE') {
    // Clear persisted state
    persistor.purge();
    // Reset to initial state
    return next({ type: 'RESET' });
  }
  return next(action);
};

// Export middleware for external use
export { resetMiddleware };
