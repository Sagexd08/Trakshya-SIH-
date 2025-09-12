# Trakshya — AI-Powered Railway Digital Twin (Frontend)

A Next.js + TypeScript dashboard showcasing real-time Indian Railways operations with 3D/2D maps, traffic heatmaps, conflicts, energy optimization, and scenario simulations.

## Features
- Digital Twin Map (Mapbox GL) with corridor flythroughs, viewport LOD + simplification, and optional 3D trains (Three.js + glTF)
- Real-time Traffic page
  - Heatmap and circle layers populated from live IRCTC RapidAPI data via a secure Next.js proxy
  - Fallback to realistic mock simulation when the API is unavailable or rate-limited
  - KPI overlay (Active, Avg Speed, Congestion)
- Energy Optimization
  - Chart powered by live-derived series aggregated from IRCTC data (local /api/energy/series)
  - SSR KPIs: baseline, optimized, and savings
- Conflicts, Reports, Scenarios, AI pages with demo content and KPIs
- Internationalization shell (English/Hindi) and dark UI using Tailwind + shadcn/ui

## Requirements
- Node.js 18+
- Mapbox access token
- Optional: IRCTC RapidAPI key for live data

## Environment Variables
Create `frontend/.env.local` with:

```
# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.YourTokenHere

# Optional external API base (for legacy backend calls)
NEXT_PUBLIC_API_BASE=http://localhost:8000

# RapidAPI (server-only)
IRCTC_RAPIDAPI_KEY=your-rapidapi-key
```

Notes:
- IRCTC_RAPIDAPI_KEY is read only by server-side API routes; it is never exposed to the browser.

## Install & Run

```bash
# from frontend/
npm install
npm run dev   # runs at http://localhost:3031

# build
npm run build
npm run start
```

## API Integration

### Next.js proxy: /api/irctc/live-station
- Proxies to `https://irctc1.p.rapidapi.com/api/v3/getLiveStation` with headers
- Query params: `station_code`, optional `hours` (default 2)
- Reads `IRCTC_RAPIDAPI_KEY` from server env
- Returns passthrough JSON with proper error codes

### Energy aggregation: /api/energy/series
- Aggregates current activity across several major stations via the live-station endpoint
- Produces a 24-point series `{ h, base, opt }` and `meta` for KPIs
- Chart: `src/components/EnergyChart.tsx`

## Real-time Traffic
- Component: `src/components/RealTimeTraffic.tsx`
- Behavior:
  - On load, seeds mock points and renders heatmap + circles
  - Attempts to hydrate from live IRCTC via `/api/irctc/live-station` for a limited set of stations (mapped from `public/stations-sample.geojson`)
  - If live succeeds, updates the map immediately and polls every 60s
  - If live fails or no key, continues with mock animation

## 3D Trains (optional)
- Three.js + GLTFLoader via a custom Mapbox layer
- Place a model at `frontend/public/models/train.glb`
- Graceful fallback to a simple box primitive and to 2D symbols on low-power devices

## Deployment (Vercel)
1) Push to GitHub (see next section)
2) Import the repo in Vercel
3) Set Environment Variables (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_MAPBOX_TOKEN` = your token
   - `IRCTC_RAPIDAPI_KEY` = your RapidAPI key (Server only)
   - optionally `NEXT_PUBLIC_API_BASE`
4) Deploy

## GitHub
If this directory is already a git repo:

```bash
# At repo root (one level above frontend/)
cd ..
# commit changes
git add Trakshya
git commit -m "Integrate IRCTC RapidAPI proxy + live Traffic + Energy series"
# add your remote and push
# git remote add origin https://github.com/<you>/<repo>.git
# or add a new remote name if one exists already
# git push origin <branch>
```

If the remote repo is `https://github.com/Sagexd08/Trakshya-SIH-.git`, add/push accordingly.

## Usage Guide
- Map: use presets to fly corridors, toggle layers; follow-train mode shows 3D model when available
- Traffic: density heatmap + speed circles; KPI strip updates with live poll
- Energy: watch baseline vs optimized series; KPIs computed on SSR from live-derived series
- Conflicts/Scenarios/AI: demo interactions ready to be wired to your backend

## Screenshots
Place screenshots under `frontend/public/screens/` and embed links here.

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
