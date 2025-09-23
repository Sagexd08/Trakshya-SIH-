/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');
// Prevent leaking Mapbox secret tokens in production builds
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_MAPBOX_TOKEN && process.env.NEXT_PUBLIC_MAPBOX_TOKEN.startsWith('sk.')) {
  throw new Error('Refusing to build with a secret Mapbox token (sk...). Set NEXT_PUBLIC_MAPBOX_TOKEN to a public pk token for production.');
}


const nextConfig = {
  // Enable experimental features
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: ['lucide-react', 'recharts', 'd3'],
    // Enable partial prerendering
    ppr: false, // Disable for now as it's still experimental
  },

  // External packages for server components
  serverExternalPackages: ['@google/generative-ai'],

  // Ensure ESM libs with web workers are transpiled correctly in Next/webpack
  transpilePackages: [
    'troika-three-text',
    'troika-three-utils',
    'troika-worker-utils',
    '@react-three/fiber',
    '@react-three/drei'
  ],

  // Performance optimizations
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Image optimization
  images: {
    domains: ['api.mapbox.com', 'tiles.mapbox.com'],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 1 week
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://cdn.vercel-insights.com https://js.sentry-cdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com; connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com https://*.supabase.co https://*.supabase.in https://*.ingest.sentry.io https://*.sentry.io ws: wss:; font-src 'self' https://fonts.gstatic.com https://api.mapbox.com; worker-src 'self' blob:; frame-ancestors 'none'; object-src 'none'",
          },
          // Performance headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, stale-while-revalidate=300',
          },
        ],
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: isServer
            ? '../analyze/server.html'
            : './analyze/client.html',
        })
      );
    }


    // Optimize imports
    config.resolve.alias = {
      ...config.resolve.alias,
      // Optimize lodash imports
      'lodash': 'lodash-es',
    };

    // Tree shaking for specific libraries
    config.resolve.mainFields = ['module', 'main'];

    // Optimize chunks
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for stable dependencies
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common chunk for shared code
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
          // UI library chunk
          ui: {
            name: 'ui',
            chunks: 'all',
            test: /node_modules\/@radix-ui/,
            priority: 30,
          },
          // Charts chunk
          charts: {
            name: 'charts',
            chunks: 'all',
            test: /node_modules\/(recharts|d3)/,
            priority: 30,
          },
          // Map chunk
          map: {
            name: 'map',
            chunks: 'all',
            test: /node_modules\/(mapbox-gl|@react-three)/,
            priority: 30,
          },
        },
      };
    }

    return config;
  },

  // PWA configuration
  async rewrites() {
    // Avoid registering a service worker during development to prevent cache issues
    if (process.env.NODE_ENV !== 'production') {
      return [];
    }
    return [
      {
        source: '/sw.js',
        destination: '/_next/static/sw.js',
      },
    ];
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Output configuration
  output: 'standalone',
  outputFileTracingRoot: __dirname,

  // Compression
  compress: true,

  // Power optimizations
  poweredByHeader: false,

  // Strict mode
  reactStrictMode: true,

  // SWC minification is enabled by default in Next.js 15

  // Trailing slash
  trailingSlash: false,

  // TypeScript configuration
  typescript: {
    // Ignore build errors in production (not recommended for real projects)
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    // Ignore ESLint errors during builds (not recommended for real projects)
    ignoreDuringBuilds: false,
  },
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry Webpack plugin
  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Wizard-recommended options
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true,
};

// Export configuration with Sentry if available
module.exports = process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;



