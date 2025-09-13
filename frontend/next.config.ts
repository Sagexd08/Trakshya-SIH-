import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      // Mapbox API (styles, glyphs, sprites)
      urlPattern: /^https:\/\/api\.mapbox\.com\/.*$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "mapbox-api",
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // Mapbox tiles
      urlPattern: /^https:\/\/tiles\.mapbox\.com\/.*$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "mapbox-tiles",
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // Explicit fonts/glyphs (covered by api.mapbox.com above, kept for clarity)
      urlPattern: /^https:\/\/api\.mapbox\.com\/(?:fonts|styles)\/v1\/.*$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "mapbox-fonts-styles",
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 300, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // App API routes (short TTL to avoid stale real-time data)
      urlPattern: /\/api\/(irctc\/.*|trains|energy\/.*)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "api-swr",
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 200, maxAgeSeconds: 60 },
      },
    },
    {
      // Background Sync for POSTs to our API (queues when offline)
      urlPattern: /\/api\/.*$/i,
      handler: "NetworkOnly",
      method: "POST",
      options: {
        backgroundSync: {
          name: "api-post-queue",
          options: { maxRetentionTime: 60 },
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  // Silence workspace root warning by setting the tracing root to this app
  outputFileTracingRoot: __dirname,
};

export default withPWA(nextConfig);
