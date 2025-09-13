# Trakshya — AI-Powered Railway Digital Twin

[![CI](https://github.com/Sagexd08/Trakshya-SIH-/actions/workflows/ci.yml/badge.svg)](https://github.com/Sagexd08/Trakshya-SIH-/actions/workflows/ci.yml)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2FSagexd08%2FTrakshya-SIH-&env=NEXT_PUBLIC_MAPBOX_TOKEN,IRCTC_RAPIDAPI_KEY&project-name=trakshya-sih&repository-name=Trakshya-SIH-)

A production-ready Next.js + TypeScript dashboard that visualizes real-time Indian Railways operations with maps, traffic heatmaps, energy optimization, and scenario simulations.

## Repository Structure

- frontend/ — Next.js 15 app (App Router, Tailwind, shadcn/ui, Mapbox GL, Three.js)
- .github/workflows/ci.yml — CI that builds and runs tests on every push/PR

## Quick Start

1) Requirements
- Node.js 18+
- Mapbox access token
- Optional: IRCTC RapidAPI key

2) Install & run (from frontend/)

```bash
npm install
npm run dev  # http://localhost:3031
```

3) Build & test

```bash
npm run build
npm run start
npm run test
```

## Environment Variables
Create frontend/.env.local:

```bash
# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.YourTokenHere

# RapidAPI (server-only)
IRCTC_RAPIDAPI_KEY=your-rapidapi-key

# Optional legacy backend base
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

Notes:
- IRCTC_RAPIDAPI_KEY is only read by server-side API routes and never exposed to the client.

## API Endpoints (local Next.js routes)

### GET /api/irctc/live-station
Proxies to IRCTC RapidAPI getLiveStation.
- Query: station_code=NDLS&hours=2 (hours defaults to 2)
- Headers added server-side; uses IRCTC_RAPIDAPI_KEY
- Status codes: 200 passthrough, 400 missing station_code, 500 missing key, 502 upstream error

### GET /api/energy/series
Aggregates current activity across major stations and synthesizes a 24-point energy series.
- Query: stations=NDLS,CSMT,HWH (optional; defaults in route), hours=2
- Returns: { points: [{ h, base, opt } x24], meta: { stations, hours } }

## Example usage (local)

```bash
curl "http://localhost:3031/api/irctc/live-station?station_code=NDLS&hours=2"
```

```bash
curl "http://localhost:3031/api/energy/series?stations=NDLS,CSMT,HWH&hours=2"
```

## Pages
- Traffic: live density heatmap + clustered bubbles; 30‑minute playback scrubber
- Energy: baseline vs optimized series computed from live aggregation
- Conflicts, Scenarios, AI, Reports: demo-ready pages with typed components

## Testing
- Vitest configuration: frontend/vitest.config.ts
- Run: cd frontend && npm run test

## CI
- GitHub Actions builds and tests on every push/PR
- Set repo secrets for CI:
  - IRCTC_RAPIDAPI_KEY
  - NEXT_PUBLIC_MAPBOX_TOKEN

## Deploy to Vercel
1) Import the repo in Vercel or click the Deploy button above.
2) Set Environment Variables (Project Settings → Environment Variables):
   - NEXT_PUBLIC_MAPBOX_TOKEN (Public)
   - IRCTC_RAPIDAPI_KEY (Server)
3) Deploy. Next.js defaults are auto-detected by Vercel.

Optional: Add the same vars as GitHub repo Secrets so CI can build your PRs.

