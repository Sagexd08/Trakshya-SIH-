# 🚆 Trakshya — AI-Powered Railway Digital Twin & Predictive Optimizer

[![CI](https://github.com/Sagexd08/Trakshya-SIH-/actions/workflows/ci.yml/badge.svg)](https://github.com/Sagexd08/Trakshya-SIH-/actions/workflows/ci.yml)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2FSagexd08%2FTrakshya-SIH-&env=NEXT_PUBLIC_MAPBOX_TOKEN,IRCTC_RAPIDAPI_KEY&project-name=trakshya-sih&repository-name=Trakshya-SIH-)

---

## 📌 Overview

**Trakshya** is an **AI-powered Digital Twin platform** for Indian Railways that enables **real-time traffic monitoring, predictive conflict detection, energy optimization, and what-if scenario simulations.**

This project leverages **Next.js, Supabase, and AI models (Google Gemini, ML pipelines in Python)** to build a **production-ready railway control tower dashboard**.

Key Features:
- 🗺️ **Digital Twin Map** — 3D map of train movements (Mapbox GL / Three.js)
- ⚡ **Predictive Insights** — conflict detection, delay forecasting, throughput optimization
- 📊 **Energy Dashboard** — baseline vs optimized energy consumption
- 🔔 **Realtime Alerts** — Supabase Realtime streams with AI-backed recommendations
- 🤖 **AI Assistant** — natural language queries using Gemini API
- 📈 **Scenario Simulator** — disruption modeling (fog, breakdown, track closure)
- 🌐 **Deployed on Vercel** — scalable, cloud-native architecture

---

## 🏗️ Tech Stack

### **Frontend**
- [Next.js 15](https://nextjs.org/) (App Router, TypeScript, SSR)
- [TailwindCSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)  
- [Framer Motion](https://www.framer.com/motion/) for smooth animations
- [Mapbox GL](https://www.mapbox.com/) & [Three.js](https://threejs.org/) for visualization
- [D3.js](https://d3js.org/) & [Recharts](https://recharts.org/) for analytics

### **Backend**
- [Supabase](https://supabase.com/) (Postgres + Row Level Security + Realtime + Edge Functions)
- Node.js API Routes (Next.js serverless functions)
- Clerk Authentication (Google, GitHub, Email/Password)

### **AI/ML**
- Python-based ML pipelines (TensorFlow / PyTorch / Scikit-learn)
- Google **Gemini API** for predictive insights & natural language recommendations
- Custom CNN for track/signal anomaly detection

---

## 📂 Repository Structure

Trakshya-SIH-/
│
├── frontend/ # Next.js 15 app (dashboard & UI)
│ ├── app/ # App Router pages
│ ├── components/ # Reusable UI components
│ ├── lib/ # Supabase client, Gemini client, utils
│ ├── public/ # Static assets
│ └── vitest.config.ts # Test config
│
├── .github/workflows/ci.yml # CI pipeline
└── README.md # You are here 🚀

yaml
Copy code

---

## ⚡ Quick Start

### 1. Requirements
- Node.js **18+**
- Mapbox Access Token
- Supabase Project Setup
- Optional: IRCTC RapidAPI Key
## 📊 Pages & Features
Dashboard: Digital Twin map + KPI summary

Traffic: Density heatmap, 30-min playback scrubber

Energy: Real-time consumption vs optimization

Conflicts: AI-powered conflict predictions

Scenarios: Disruption simulation (fog, breakdown)

AI Assistant: Chat with Gemini for insights

Reports: Export charts and insights as PDF/CSV

✅ Testing
Uses Vitest. Run:

bash
Copy code
cd frontend
npm run test
🚀 Deployment
Vercel
Import repo in Vercel.

Add env variables (Mapbox, Supabase, Clerk, RapidAPI).

Deploy. (Next.js config is auto-detected).

CI/CD
GitHub Actions run build + test on every push/PR.

Repo secrets: IRCTC_RAPIDAPI_KEY, NEXT_PUBLIC_MAPBOX_TOKEN, SUPABASE_KEYS, CLERK_KEYS.

📈 Roadmap
 Integrate real-time IRCTC APIs for nationwide scale.

 Expand CNN-based anomaly detection (tracks/signals).

 Add predictive scheduling & throughput optimization.

 Regional language voice assistant for on-ground staff.

 Blockchain integration for tamper-proof safety logs.

👥 Contributors
Sohom Chatterjee — Lead Developer & Architect

Open to contributors → PRs are welcome 🚀

📜 License
MIT License © 2025 Trakshya Team

✨ Tagline
“Trakshya — the digital nervous system of Indian Railways.”

vbnet
Copy code

👉 This README is **SIH-pitch ready**, developer-friendly, and deployment-oriented.  

### 2. Install & Run (from `frontend/`)
```bash
npm install
npm run dev   # http://localhost:3031
3. Build & Test
bash
Copy code
npm run build
npm run start
npm run test
🔑 Environment Variables
Create frontend/.env.local:

bash
Copy code
# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.YourTokenHere

# IRCTC RapidAPI Key (server-only)
IRCTC_RAPIDAPI_KEY=your-rapidapi-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Clerk Auth
NEXT_PUBLIC_CLERK_FRONTEND_API=<your-clerk-key>
CLERK_SECRET_KEY=<your-clerk-secret>
🔌 API Endpoints (local Next.js routes)
/api/irctc/live-station
Proxies IRCTC RapidAPI live station data.

Query: station_code=NDLS&hours=2

Returns train movement data in JSON.

/api/energy/series
Generates synthetic baseline vs optimized energy data.

Query: stations=NDLS,CSMT,HWH&hours=2

Returns energy chart dataset.

/api/conflicts
Runs conflict detection simulation using Supabase Edge Function.'''


