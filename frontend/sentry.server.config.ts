import * as Sentry from '@sentry/nextjs';

// Initialize Sentry on the server only when DSN is provided
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    integrations: [],
    enabled: true,
    environment: process.env.NODE_ENV,
  });
}

