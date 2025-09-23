import * as Sentry from '@sentry/nextjs';

// Initialize Sentry in the browser only when DSN is provided
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    integrations: [],
    enabled: true,
    environment: process.env.NODE_ENV,
    // Send events through same-origin tunnel to avoid CSP and adblock issues
    tunnel: '/monitoring',
  });
}

