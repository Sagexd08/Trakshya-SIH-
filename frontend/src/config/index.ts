/**
 * Centralized Configuration Management
 * Provides type-safe configuration with environment validation
 */

import { z } from 'zod';

// Environment validation schema
const envSchema = z.object({
  // App Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Trakshya'),
  NEXT_PUBLIC_APP_VERSION: z.string().default('2.0.0'),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // API Configuration
  NEXT_PUBLIC_API_BASE: z.string().url().optional(),
  API_RATE_LIMIT: z.coerce.number().default(100),
  API_TIMEOUT: z.coerce.number().default(30000),

  // External Services
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  IRCTC_RAPIDAPI_KEY: z.string().optional(),
  GOOGLE_GEMINI_API_KEY: z.string().optional(),

  // Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),

  // Database
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Monitoring & Analytics
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Feature Flags
  NEXT_PUBLIC_ENABLE_AI: z.coerce.boolean().default(true),
  NEXT_PUBLIC_ENABLE_REALTIME: z.coerce.boolean().default(true),
  NEXT_PUBLIC_ENABLE_3D: z.coerce.boolean().default(true),
  NEXT_PUBLIC_ENABLE_VOICE: z.coerce.boolean().default(false),

  // Performance
  NEXT_PUBLIC_CACHE_TTL: z.coerce.number().default(300),
  NEXT_PUBLIC_WS_RECONNECT_INTERVAL: z.coerce.number().default(5000),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.warn('⚠️ Environment validation failed, using defaults:', error);
    // Return safe defaults for development
    return {
      NODE_ENV: process.env.NODE_ENV || 'development',
      NEXT_PUBLIC_APP_NAME: 'Trakshya',
      NEXT_PUBLIC_APP_VERSION: '2.0.0',
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3031',
      NEXT_PUBLIC_API_BASE: 'http://localhost:3031/api',
      API_RATE_LIMIT: 100,
      API_TIMEOUT: 30000,

      // External Services
      NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      IRCTC_RAPIDAPI_KEY: process.env.IRCTC_RAPIDAPI_KEY,
      GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,

      // Authentication
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,

      // Database
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

      // Monitoring & Analytics
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID,
      LOG_LEVEL: 'info',

      // Feature Flags
      NEXT_PUBLIC_ENABLE_AI: 'true',
      NEXT_PUBLIC_ENABLE_REALTIME: 'true',
      NEXT_PUBLIC_ENABLE_3D: 'true',
      NEXT_PUBLIC_ENABLE_VOICE: 'false',

      // Performance
      NEXT_PUBLIC_CACHE_TTL: 300,
      NEXT_PUBLIC_WS_RECONNECT_INTERVAL: 5000,
    };
  }
};

export const env = parseEnv();

// Application Configuration
export const config = {
  app: {
    name: env.NEXT_PUBLIC_APP_NAME,
    version: env.NEXT_PUBLIC_APP_VERSION,
    environment: env.NODE_ENV,
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
  },

  api: {
    baseUrl: env.NEXT_PUBLIC_API_BASE,
    rateLimit: env.API_RATE_LIMIT,
    timeout: env.API_TIMEOUT,
  },

  services: {
    mapbox: {
      token: env.NEXT_PUBLIC_MAPBOX_TOKEN,
      enabled: !!env.NEXT_PUBLIC_MAPBOX_TOKEN,
    },
    irctc: {
      apiKey: env.IRCTC_RAPIDAPI_KEY,
      enabled: !!env.IRCTC_RAPIDAPI_KEY,
    },
    gemini: {
      apiKey: env.GOOGLE_GEMINI_API_KEY,
      enabled: !!env.GOOGLE_GEMINI_API_KEY,
    },
    clerk: {
      publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKey: env.CLERK_SECRET_KEY,
      enabled: !!(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY),
    },
    supabase: {
      url: env.SUPABASE_URL,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      enabled: !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
    },
  },

  features: {
    ai: env.NEXT_PUBLIC_ENABLE_AI,
    realtime: env.NEXT_PUBLIC_ENABLE_REALTIME,
    threeD: env.NEXT_PUBLIC_ENABLE_3D,
    voice: env.NEXT_PUBLIC_ENABLE_VOICE,
  },

  performance: {
    cacheTtl: env.NEXT_PUBLIC_CACHE_TTL,
    wsReconnectInterval: env.NEXT_PUBLIC_WS_RECONNECT_INTERVAL,
  },

  monitoring: {
    sentryDsn: env.NEXT_PUBLIC_SENTRY_DSN,
    analyticsId: env.NEXT_PUBLIC_ANALYTICS_ID,
    logLevel: env.LOG_LEVEL,
  },
} as const;

// Type exports
export type Config = typeof config;
export type Environment = typeof env.NODE_ENV;

// Utility functions
export const isDevelopment = () => config.app.environment === 'development';
export const isProduction = () => config.app.environment === 'production';
export const isTest = () => config.app.environment === 'test';

// Service availability checks
export const getAvailableServices = () => {
  return Object.entries(config.services)
    .filter(([, service]) => service.enabled)
    .map(([name]) => name);
};

// Feature flag helpers
export const isFeatureEnabled = (feature: keyof typeof config.features) => {
  return config.features[feature];
};

// Configuration validation
export const validateConfig = () => {
  const issues: string[] = [];

  // Check critical services
  if (!config.services.mapbox.enabled) {
    issues.push('Mapbox token not configured - maps will not work');
  }

  if (!config.services.supabase.enabled) {
    issues.push('Supabase not configured - data persistence disabled');
  }

  if (config.features.ai && !config.services.gemini.enabled) {
    issues.push('AI features enabled but Gemini API key not configured');
  }

  return {
    isValid: issues.length === 0,
    issues,
    availableServices: getAvailableServices(),
  };
};

// Export validation result for startup checks
export const configValidation = validateConfig();

// Log configuration status on startup
if (isDevelopment()) {
  console.log('🔧 Configuration loaded:', {
    environment: config.app.environment,
    availableServices: getAvailableServices(),
    enabledFeatures: Object.entries(config.features)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name),
    issues: configValidation.issues,
  });
}
