"use client";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { connectWS } from "@/lib/wsClient";
import { subscribeTrainPositions } from "@/lib/supabase/realtime";
import { toast } from "sonner";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
if (TOKEN) mapboxgl.accessToken = TOKEN;

// Real-time train data integration with IRCTC API
type TPoint = { id: string; lng: number; lat: number; speed: number; weight: number; trainNo?: string; name?: string; nextStop?: string; delay?: number; status?: string };

// Comprehensive mapping of major Indian railway stations to IRCTC codes
const STATION_NAME_TO_CODE: Record<string, string> = {
  "New Delhi": "NDLS",
  "Mumbai CSMT": "CSMT",
  "Howrah Jn": "HWH",
  "Chennai Central": "MAS",
  "Ahmedabad Jn": "ADI",
  "Jaipur Jn": "JP",
  "Varanasi Jn": "BSB",
  "Nagpur": "NGP",
  "Kanpur Central": "CNB",
  "Vijayawada Jn": "BZA",
  "Pune Jn": "PUNE",
  "Hyderabad Decan": "HYB",
  "Bengaluru City": "SBC",
  "Lucknow": "LJN",
  "Patna Jn": "PNBE",
  "Bhopal Jn": "BPL",
  "Indore Jn": "INDB",
  "Coimbatore Jn": "CBE",
  "Thiruvananthapuram": "TVC",
  "Guwahati": "GHY"
};

// Major railway stations with coordinates for real-time data
const MAJOR_STATIONS = [
  { code: "NDLS", name: "New Delhi", coord: [77.209, 28.6139] },
  { code: "CSMT", name: "Mumbai CSMT", coord: [72.8777, 19.076] },
  { code: "HWH", name: "Howrah Jn", coord: [88.3639, 22.5726] },
  { code: "MAS", name: "Chennai Central", coord: [80.2707, 13.0827] },
  { code: "ADI", name: "Ahmedabad Jn", coord: [72.5714, 23.0225] },
  { code: "JP", name: "Jaipur Jn", coord: [75.7873, 26.9124] },
  { code: "BSB", name: "Varanasi Jn", coord: [82.9739, 25.3176] },
  { code: "NGP", name: "Nagpur", coord: [79.0882, 21.1458] },
  { code: "CNB", name: "Kanpur Central", coord: [80.3319, 26.4499] },
  { code: "BZA", name: "Vijayawada Jn", coord: [80.6480, 16.5062] },
  { code: "PUNE", name: "Pune Jn", coord: [73.8567, 18.5204] },
  { code: "HYB", name: "Hyderabad Decan", coord: [78.4867, 17.3850] },
  { code: "SBC", name: "Bengaluru City", coord: [77.5946, 12.9716] },
  { code: "LJN", name: "Lucknow", coord: [80.9462, 26.8467] },
  { code: "PNBE", name: "Patna Jn", coord: [85.1376, 25.5941] }
];

// GeoJSON feature type for sample stations
type StationFeature = { properties?: { name?: string }; geometry: { coordinates: [number, number] } };


type WSMessage = { type?: string; count?: number; text?: string };


// Fetch real-time train data from IRCTC API
async function fetchRealTimeTrains(): Promise<TPoint[]> {
  const realTimeTrains: TPoint[] = [];

  try {
    // Fetch data from multiple major stations
    const stationPromises = MAJOR_STATIONS.slice(0, 8).map(async (station) => {
      try {
        const response = await fetch(`/api/irctc/live-station?station_code=${station.code}&hours=2`, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch data for ${station.name}`);
        }

        const data = await response.json();
        const trains = data?.data?.trains || [];

        // Convert API data to TPoint format
        return trains.slice(0, 15).map((train: any, idx: number) => {
          const delay = parseInt(train.delay_dep || train.delay_arr || train.delay || '0');
          const speed = Math.max(20, 120 - Math.min(100, delay * 2));
          const weight = Math.max(0.1, Math.min(1, (100 - delay) / 100));

          // Add some geographical spread around the station
          const jitterLng = (Math.random() - 0.5) * 0.3;
          const jitterLat = (Math.random() - 0.5) * 0.3;

          return {
            id: `${station.code}-${train.trainNo || train.train_number || idx}`,
            lng: station.coord[0] + jitterLng,
            lat: station.coord[1] + jitterLat,
            speed,
            weight,
            trainNo: train.trainNo || train.train_number || `TR${1000 + idx}`,
            name: train.train_name || train.name || `Express ${idx}`,
            nextStop: train.to_station_name || train.to?.name || station.name,
            delay,
            status: delay > 30 ? 'delayed' : delay > 10 ? 'running' : 'on-time'
          } as TPoint;
        });
      } catch (error) {
        console.warn(`Failed to fetch data for ${station.name}:`, error);
        return [];
      }
    });

    const results = await Promise.allSettled(stationPromises);
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        realTimeTrains.push(...result.value);
      }
    });

    // If we have real-time data, return it
    if (realTimeTrains.length > 0) {
      console.log(`Fetched ${realTimeTrains.length} real-time trains`);
      return realTimeTrains;
    }
  } catch (error) {
    console.error('Error fetching real-time train data:', error);
  }

  // Fallback to enhanced mock data if real-time fails
  return seedMockTrains(120);
}

// Enhanced mock train generator with realistic data
function seedMockTrains(n = 120): TPoint[] {
  const out: TPoint[] = [];

  MAJOR_STATIONS.forEach((station, stationIdx) => {
    const trainsPerStation = Math.floor(n / MAJOR_STATIONS.length) + (stationIdx < n % MAJOR_STATIONS.length ? 1 : 0);

    for (let i = 0; i < trainsPerStation; i++) {
      const jitterLng = (Math.random() - 0.5) * 1.5;
      const jitterLat = (Math.random() - 0.5) * 1.2;
      const lng = station.coord[0] + jitterLng;
      const lat = station.coord[1] + jitterLat;

      const delay = Math.floor(Math.random() * 60); // 0-60 minutes delay
      const speed = Math.max(25, 120 - delay); // Speed inversely related to delay
      const weight = Math.max(0.1, Math.min(1, (100 - delay) / 100));

      const trainTypes = ['Express', 'Superfast', 'Mail', 'Passenger', 'Shatabdi', 'Rajdhani'];
      const trainType = trainTypes[Math.floor(Math.random() * trainTypes.length)];

      out.push({
        id: `${station.code}-${i}`,
        lng, lat, speed, weight,
        trainNo: `${12000 + stationIdx * 100 + i}`,
        name: `${station.name} ${trainType}`,
        nextStop: MAJOR_STATIONS[Math.floor(Math.random() * MAJOR_STATIONS.length)].name,
        delay,
        status: delay > 30 ? 'delayed' : delay > 10 ? 'running' : 'on-time'
      });
    }
  });

  return out;
}

export default function RealTimeTraffic() {
  const ref = useRef<HTMLDivElement>(null);


  const [, setStats] = useState<{ active: number; avgSpeed: number; congestion: number }>({ active: 0, avgSpeed: 0, congestion: 0 });


    const mapStyle = (typeof window !== 'undefined' && localStorage.getItem('mapStyle')) || "mapbox://styles/mapbox/dark-v11";

  useEffect(() => {

    if (!ref.current || !TOKEN) return;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: mapStyle,
      center: [79, 22],
      zoom: 5,
      pitch: 45,
      bearing: -15,

      antialias: true,
    });

    let timer: ReturnType<typeof setInterval> | undefined;
    let poller: ReturnType<typeof setInterval> | undefined;

    let trains: TPoint[] = [];
    let isLoadingTrains = true;

	    // Playback history (0 = live, 1..30 minutes ago)

      // React to global map style changes from Settings
      if (typeof window !== 'undefined') {
        const onStorage = (e: StorageEvent) => { if (e.key === 'mapStyle') location.reload(); };
        window.addEventListener('storage', onStorage);
      }

	    const history: TPoint[][] = [trains.map((p) => ({ ...p }))];
	    let playback = 0;

    let preferLive = true;
    // Advanced filtering state (map control updates these values)
    const filters = { q: "", minSpeed: 0, minWeight: 0, slowOnly: false, inView: false } as {
      q: string; minSpeed: number; minWeight: number; slowOnly: boolean; inView: boolean;
    };

    const getFilteredTrains = (): TPoint[] => {
      const q = filters.q.trim().toLowerCase();
      const bounds = filters.inView ? map.getBounds() : null;
      return trains.filter((t) => {
        if (filters.slowOnly && t.speed >= 50) return false;
        if (t.speed < filters.minSpeed) return false;
        if (t.weight < filters.minWeight) return false;
        if (q) {
          const hay = `${t.trainNo ?? ""} ${t.name ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (bounds) {
          if (!bounds.contains({ lng: t.lng, lat: t.lat })) return false;
        }
        return true;
      });
    };


    const toFC = (): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; weight: number; speed: number; trainNo?: string; name?: string; nextStop?: string; delay?: number; status?: string }> => ({
      type: "FeatureCollection",
      features: getFilteredTrains().map((t) => ({
        type: "Feature",
        properties: {
          id: t.id,
          weight: t.weight,
          speed: t.speed,
          trainNo: t.trainNo,
          name: t.name,
          nextStop: t.nextStop,
          delay: t.delay || 0,
          status: t.status || 'unknown'
        },
        geometry: { type: "Point", coordinates: [t.lng, t.lat] },
      })),
    });

    const updateSources = () => {
      const src = map.getSource("traffic") as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(toFC());
      const csrc = map.getSource("traffic-cluster") as mapboxgl.GeoJSONSource | undefined;
      if (csrc) csrc.setData(toFC());
    };


    map.on("load", async () => {
      // Initialize with real-time data
      try {
        trains = await fetchRealTimeTrains();
        isLoadingTrains = false;
        toast.success(`Loaded ${trains.length} real-time trains`);
      } catch (error) {
        console.error('Failed to load real-time data:', error);
        trains = seedMockTrains(120);
        isLoadingTrains = false;
        toast.warning('Using simulated data - real-time unavailable');
      }
      // Heatmap source for density visualization
      map.addSource("traffic", { type: "geojson", data: toFC() });
      map.addLayer({
        id: "traffic-heat",
        type: "heatmap",
        source: "traffic",
        maxzoom: 12,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 2.0],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(2,132,199,0)",
            0.2, "#60a5fa",
            0.4, "#22d3ee",
            0.6, "#34d399",
            0.8, "#eab308",
            1, "#ef4444",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 5, 10, 9, 25, 12, 35],
          "heatmap-opacity": 0.9,
        },
      });

	      // Clustered source and layers for count bubbles
	      const clusterSource = {
	        type: "geojson",
	        data: toFC(),
	        cluster: true,
	        clusterMaxZoom: 11,
	        clusterRadius: 40,
	      } as unknown;
	      // Cast to the broader source data type to appease TS without using 'any'
	      map.addSource("traffic-cluster", clusterSource as mapboxgl.AnySourceData);
	      map.addLayer({
	        id: "traffic-clusters",
	        type: "circle",
	        source: "traffic-cluster",
	        filter: ["has", "point_count"],
	        paint: {
	          "circle-color": [
	            "step",
	            ["get", "point_count"],
	            "#60a5fa",
	            20, "#22d3ee",
	            50, "#34d399",
	            100, "#eab308",
	            200, "#ef4444",
	          ],
	          "circle-radius": [
	            "step",
	            ["get", "point_count"],
	            12,
	            20, 16,
	            50, 20,
	            100, 24,
	            200, 28
	          ],
	          "circle-opacity": 0.8,
	          "circle-stroke-width": 1,
	          "circle-stroke-color": "#0b1220",
	        },
	      });
	      map.addLayer({
	        id: "traffic-cluster-count",
	        type: "symbol",
	        source: "traffic-cluster",
	        filter: ["has", "point_count"],
	        layout: {
	          "text-field": ["get", "point_count_abbreviated"],
	          "text-size": 11,
	          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
	        },
	        paint: { "text-color": "#e5e7eb" },
	      });

	      // Playback scrubber control (0..30 minutes)
	      const playbackCtrl: mapboxgl.IControl = {
	        onAdd: () => {
	          const el = document.createElement("div");
	          el.className = "mapboxgl-ctrl p-2 rounded bg-black/60 text-xs text-slate-200";
	          el.innerHTML = `
	            <div style=\"display:flex;gap:8px;align-items:center;min-width:220px\">
	              <div style=\"opacity:.7\">Playback</div>
	              <input type=\"range\" min=\"0\" max=\"30\" value=\"0\" step=\"1\" style=\"flex:1\" />
	              <div data-plab>Live</div>
	            </div>`;
	          const range = el.querySelector("input") as HTMLInputElement;
	          const label = el.querySelector("[data-plab]") as HTMLElement;
	          const setLabel = () => { label.textContent = playback === 0 ? "Live" : `${playback}m ago`; };
	          setLabel();
	          range.addEventListener("input", () => {
	            playback = Number(range.value);
	            setLabel();
	            const snap = history[playback];
	            if (snap) {
	              trains = snap.map((p) => ({ ...p }));
	              const src = map.getSource("traffic") as mapboxgl.GeoJSONSource | undefined;
      // Live/Simulated mode toggle control
      const modeCtrl: mapboxgl.IControl = {
        onAdd: () => {
          const el = document.createElement("div");
          el.className = "mapboxgl-ctrl p-2 rounded bg-black/60 text-xs text-slate-200";
          const render = () => {
            el.innerHTML = `<div style=\"display:flex;gap:8px;align-items:center\">`+
              `<div style=\"opacity:.7\">Mode</div>`+
              `<button data-btn class=\"px-2 py-1 rounded border\">${preferLive ? "Live" : "Simulated"}</button>`+
              `</div>`;
            const btn = el.querySelector("[data-btn]") as HTMLButtonElement;
            btn.onclick = () => { preferLive = !preferLive; render(); };
          };
          render();
          return el;
        },
        onRemove: () => {},
      };
      map.addControl(modeCtrl, "top-right");

      // Filters control (search, speed/weight sliders, toggles)
      const filtersCtrl: mapboxgl.IControl = {
        onAdd: () => {
          const el = document.createElement("div");
          el.className = "mapboxgl-ctrl p-2 rounded bg-black/60 text-xs text-slate-200";
          const render = () => {
            el.innerHTML = `
              <div style=\"display:grid;gap:6px;min-width:240px\">
                <div style=\"display:flex;gap:6px;align-items:center\">
                  <div style=\"opacity:.7\">Search</div>
                  <input data-q type=\"text\" placeholder=\"Train no/name\" style=\"flex:1;padding:2px 6px;border-radius:4px;background:#0b1220;border:1px solid #334155;color:#e5e7eb\" />
                </div>
                <div style=\"display:flex;gap:6px;align-items:center\">
                  <div style=\"opacity:.7\">Min speed</div>
                  <input data-mins type=\"range\" min=\"0\" max=\"120\" step=\"5\" value=\"0\" style=\"flex:1\" />
                  <div data-mins-v>0</div>
                </div>
                <div style=\"display:flex;gap:6px;align-items:center\">
                  <div style=\"opacity:.7\">Min weight</div>
                  <input data-minw type=\"range\" min=\"0\" max=\"1\" step=\"0.1\" value=\"0\" style=\"flex:1\" />
                  <div data-minw-v>0.0</div>
                </div>
                <div style=\"display:flex;gap:10px;align-items:center;justify-content:space-between\">
                  <label style=\"display:flex;gap:6px;align-items:center\"><input data-slow type=\"checkbox\"/> Slow only</label>
                  <label style=\"display:flex;gap:6px;align-items:center\"><input data-invw type=\"checkbox\"/> In view</label>
                </div>
              </div>`;
            const q = el.querySelector("[data-q]") as HTMLInputElement;
            const mins = el.querySelector("[data-mins]") as HTMLInputElement;
            const minsv = el.querySelector("[data-mins-v]") as HTMLElement;
            const minw = el.querySelector("[data-minw]") as HTMLInputElement;
            const minwv = el.querySelector("[data-minw-v]") as HTMLElement;
            const slow = el.querySelector("[data-slow]") as HTMLInputElement;
            const invw = el.querySelector("[data-invw]") as HTMLInputElement;
            q.value = filters.q; mins.value = String(filters.minSpeed); minsv.textContent = String(filters.minSpeed);
            minw.value = String(filters.minWeight); minwv.textContent = Number(filters.minWeight).toFixed(1);
            slow.checked = filters.slowOnly; invw.checked = filters.inView;
            const apply = () => { updateSources(); updateStats(); };
            q.oninput = () => { filters.q = q.value; apply(); };
            mins.oninput = () => { filters.minSpeed = Number(mins.value); minsv.textContent = String(filters.minSpeed); apply(); };
            minw.oninput = () => { filters.minWeight = Number(minw.value); minwv.textContent = Number(filters.minWeight).toFixed(1); apply(); };
            slow.onchange = () => { filters.slowOnly = slow.checked; apply(); };
            invw.onchange = () => { filters.inView = invw.checked; apply(); };
          };
          render();
          return el;
        },
        onRemove: () => {}
      };
      map.addControl(filtersCtrl, "top-right");

      // Refresh when moving if in-view filtering is on
      map.on("moveend", () => { if (filters.inView) { updateSources(); updateStats(); } });

	              if (src) src.setData(toFC());
	              const csrc = map.getSource("traffic-cluster") as mapboxgl.GeoJSONSource | undefined;
	              if (csrc) csrc.setData(toFC());
	              updateStats();
	            }
	          });
	          return el;
	        },
	        onRemove: () => {},
	      };
	      map.addControl(playbackCtrl, "bottom-left");



      // High-weight points as bright circles at high zoom

      map.addLayer({
        id: "traffic-circles",
        type: "circle",
        source: "traffic",
        minzoom: 8,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "weight"], 0, 3, 1, 8],
          "circle-color": [
            "case",
            [">=", ["get", "delay"], 30], "#ef4444", // Red for high delay (30+ min)
            [">=", ["get", "delay"], 10], "#f59e0b", // Orange for medium delay (10-30 min)
            [">=", ["get", "delay"], 5], "#eab308",  // Yellow for low delay (5-10 min)
            "#22c55e" // Green for on-time (0-5 min)
          ],
          "circle-opacity": 0.9,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Click to see train/station details with real-time info
      map.on("click", "traffic-circles", (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        const f = (e as unknown as { features?: mapboxgl.MapboxGeoJSONFeature[] }).features?.[0];
        const p = (f?.properties ?? {}) as Record<string, unknown>;
        const trainNo = String(p.trainNo ?? p.id ?? "");
        const name = String(p.name ?? "");
        const nextStop = String(p.nextStop ?? "");
        const speed = Number(p.speed ?? 0);
        const delay = Number(p.delay ?? 0);
        const status = String(p.status ?? "unknown");

        const statusColor = delay >= 30 ? "#ef4444" : delay >= 10 ? "#f59e0b" : delay >= 5 ? "#eab308" : "#22c55e";
        const statusText = delay >= 30 ? "Severely Delayed" : delay >= 10 ? "Delayed" : delay >= 5 ? "Minor Delay" : "On Time";

        const html = `<div style="font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto; min-width:200px; background: #1f2937; color: white; border-radius: 8px; padding: 12px;">
          <div style="font-weight:600; font-size: 14px; margin-bottom: 8px;">${name || "Train"}</div>
          <div style="margin-bottom: 4px;"><strong>Train No:</strong> ${trainNo}</div>
          <div style="margin-bottom: 4px;"><strong>Speed:</strong> ${Number.isFinite(speed) ? speed.toFixed(0) : "-"} km/h</div>
          <div style="margin-bottom: 4px;"><strong>Delay:</strong> <span style="color: ${statusColor};">${delay > 0 ? `+${delay} min` : 'On Time'}</span></div>
          <div style="margin-bottom: 4px;"><strong>Status:</strong> <span style="color: ${statusColor};">${statusText}</span></div>
          ${nextStop ? `<div><strong>Next Stop:</strong> ${nextStop}</div>` : ""}
          <div style="margin-top: 8px; font-size: 10px; color: #9ca3af;">Real-time data from IRCTC</div>
        </div>`;
        new mapboxgl.Popup({ closeButton: false, closeOnMove: true })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);
      });
      map.on("mouseenter", "traffic-circles", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "traffic-circles", () => { map.getCanvas().style.cursor = ""; });

      // Zoom into clusters on click
      map.on("click", "traffic-clusters", async (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        const f = e.features?.[0];
        const props = (f?.properties ?? {}) as Record<string, unknown>;
        const clusterId = props?.cluster_id as number | undefined;
        const src = map.getSource("traffic-cluster") as mapboxgl.GeoJSONSource & { getClusterExpansionZoom?: (id: number, cb: (err: unknown, zoom: number) => void) => void };
        if (src && typeof src.getClusterExpansionZoom === "function" && clusterId != null) {
          src.getClusterExpansionZoom(clusterId, (err: unknown, zoom: number) => {
            if (!err && Number.isFinite(zoom)) {
              const center = (f?.geometry as GeoJSON.Point).coordinates as [number, number];
              map.easeTo({ center, zoom });
            }
          });
        }
      });
      map.on("mouseenter", "traffic-clusters", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "traffic-clusters", () => { map.getCanvas().style.cursor = ""; });


      // Summary stats panel
      const ctrl: mapboxgl.IControl = {
        onAdd: () => {
          const el = document.createElement("div");
          el.className = "mapboxgl-ctrl p-2 rounded bg-black/60 text-xs text-slate-200";
          el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,auto);gap:12px;align-items:center">
              <div><div style="opacity:.7">Active</div><div data-active style="font-weight:700">-</div></div>
              <div><div style="opacity:.7">Avg Speed</div><div data-avg style="font-weight:700">-</div></div>
              <div><div style="opacity:.7">Congestion</div><div data-cong style="font-weight:700">-</div></div>
            </div>`;
          return el;
        },
        onRemove: () => {},
      };
      map.addControl(ctrl, "top-left");

      const updateStats = () => {
        const active = trains.length;
        const avgSpeed = trains.reduce((a, b) => a + b.speed, 0) / Math.max(1, trains.length);
        // crude congestion index: share of high density + slow trains
        const slow = trains.filter((t) => t.speed < 50).length / Math.max(1, trains.length);
        const dense = Math.min(1, map.getZoom() / 12);
        const congestion = Math.min(1, 0.3 + 0.7 * (slow * 0.6 + dense * 0.4));
        setStats({ active, avgSpeed, congestion });
        const container = map.getContainer();
        (container.querySelector('[data-active]') as HTMLElement | null)!.textContent = String(active);
        (container.querySelector('[data-avg]') as HTMLElement | null)!.textContent = `${avgSpeed.toFixed(1)} km/h`;

	      // Try to hydrate from live IRCTC data; fallback to mock remains active
	      async function tryFetchLiveOnce() {
        if (!preferLive) return false as const;
	        try {
	          const stationsFC = await fetch("/stations-sample.geojson").then((r) => r.json());
	          const stationFeatures = (stationsFC?.features || []) as StationFeature[];
	          const stations = stationFeatures
	            .map((f) => ({ name: (f.properties?.name ?? "") as string, coord: f.geometry.coordinates as [number, number] }))
	            .filter((s) => !!STATION_NAME_TO_CODE[s.name])
	            .slice(0, 10);

	          const tasks = stations.map(async (s) => {
	            const code = STATION_NAME_TO_CODE[s.name];
	            const url = `/api/irctc/live-station?station_code=${encodeURIComponent(code)}&hours=1`;
	            const res = await fetch(url, { cache: "no-store" });
	            if (!res.ok) throw new Error(`Upstream ${res.status}`);
	            const data = await res.json();
	            const trainsArr = (data?.data?.trains || data?.data || data?.trains || []).filter(Boolean) as unknown[];
            const pts: TPoint[] = (trainsArr as unknown[]).slice(0, 75).map((raw, idx) => {
              const t = raw as Record<string, unknown>;
              const delayNum = Number((t?.["delay_dep"] ?? t?.["delay_arr"] ?? t?.["delay"]) || 0);
              const speed = Math.max(10, 120 - Math.min(100, delayNum * 2));
              const dayVal = Number((t?.["day"] as unknown) ?? 1);
              const weight = Math.max(0, Math.min(1, (Number.isFinite(dayVal) ? dayVal : 1) / 10 || 0.6));
              const trainNo = String((t?.["trainNo"] ?? t?.["train_number"] ?? t?.["number"] ?? t?.["no"] ?? "")).trim();
              const name = String((t?.["train_name"] ?? t?.["name"] ?? "")).trim();
              const toObj = t?.["to"] as Record<string, unknown> | undefined;
              const nextStop = String((t?.["to_station_name"] ?? toObj?.["name"] ?? s.name ?? "")).trim();
              const j1 = (Math.random() - 0.5) * 0.18;
              const j2 = (Math.random() - 0.5) * 0.18;
              const lng = s.coord[0] + j1;
              const lat = s.coord[1] + j2;
              return { id: `${code}-${trainNo || idx}`, lng, lat, speed, weight, trainNo, name, nextStop } as TPoint;
            });

	            // const delays: number[] = (trainsArr as Array<{ delay_dep?: number; delay_arr?: number; delay?: number }>)
              // .map((t) => Number((t?.delay_dep ?? t?.delay_arr ?? t?.delay) || 0))
              // .filter((n) => Number.isFinite(n));
	            // const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
	            // const count = trainsArr.length;
	            // const speed = Math.max(10, 120 - Math.min(100, avgDelay * 2));
	            // const weight = Math.max(0, Math.min(1, count / 50));
	            return pts;
	          });

	          const results = await Promise.allSettled<TPoint[]>(tasks);
	          const okPoints: TPoint[] = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
	          if (!okPoints.length) return false as const;
	          trains = okPoints;
	          updateSources();
	          history.unshift(trains.map((p) => ({ ...p })));
	          if (history.length > 31) history.pop();
	          updateStats();
	          return true as const;
	        } catch {
	          return false as const;
	        }
	      }

      // Real-time data refresh
      const refreshRealTimeData = async () => {
        if (!preferLive) return;
        try {
          const newTrains = await fetchRealTimeTrains();
          if (newTrains.length > 0) {
            trains = newTrains;
            updateSources();
            history.unshift(trains.map((p) => ({ ...p })));
            if (history.length > 31) history.pop();
            updateStats();
            console.log(`Refreshed ${newTrains.length} real-time trains`);
          }
        } catch (error) {
          console.error('Failed to refresh real-time data:', error);
        }
      };

      // Initial real-time fetch and periodic refresh
      void refreshRealTimeData();
      poller = setInterval(refreshRealTimeData, 90000); // Refresh every 90 seconds

        (container.querySelector('[data-cong]') as HTMLElement | null)!.textContent = `${Math.round(congestion * 100)}%`;
      };

      // Ticker: update positions, weights, and map source
      timer = setInterval(() => {
        if (playback > 0) { return; }
        trains = trains.map((t) => {

          // Move roughly northeast/southwest with slight noise
          const dir = Math.random() < 0.5 ? 1 : -1;
          const dLng = (t.speed / 4000) * dir * (0.5 + Math.random());
          const dLat = (t.speed / 6000) * dir * (0.5 + Math.random());
          let lng = t.lng + dLng * 0.01;
          let lat = t.lat + dLat * 0.01;
          // keep inside India-ish bounding box
          lng = Math.min(97, Math.max(68, lng));
          lat = Math.min(37, Math.max(7, lat));
          // vary speed/weight a bit
          const speed = Math.max(20, Math.min(140, t.speed + (Math.random() - 0.5) * 8));
          const weight = Math.min(1, Math.max(0, t.weight + (Math.random() - 0.5) * 0.2));
          return { ...t, lng, lat, speed, weight };
        });
        const src = map.getSource("traffic") as mapboxgl.GeoJSONSource;
        if (src) src.setData(toFC());
        const csrc = map.getSource("traffic-cluster") as mapboxgl.GeoJSONSource | undefined;
        if (csrc) csrc.setData(toFC());
        updateStats();
      }, 1000);

      updateStats();
    });

    return () => {
      clearInterval(timer);
      if (poller) clearInterval(poller);
      map.remove();
    };
  }, [mapStyle]);

  // Connect to WebSocket for real-time notifications
  useEffect(() => {
    const ws = connectWS((msg) => {
      const m = msg as WSMessage;
      if (m?.type === 'train_positions_inserted') {
        const n = Number(m?.count || 0);
        if (n > 0) toast.success(`${n} train position${n === 1 ? '' : 's'} updated`);
      } else if (m?.type === 'notice') {
        if (m?.text) toast.message(m.text);
      }
    });
    return () => { try { (ws as unknown as WebSocket)?.close?.(); } catch {} };
  }, []);

  // Supabase Realtime: toast on new train position inserts
  useEffect(() => {
    try {
      const off = subscribeTrainPositions(() => {
        try { toast.message("New train position received"); } catch {}
      });
      return () => { try { off?.(); } catch {} };
    } catch {}
  }, []);


  if (!TOKEN) {
    return (
      <div className="w-full h-[72vh] grid place-items-center bg-neutral-950 text-neutral-400 border border-neutral-800 rounded">
        <div className="text-center text-sm">
          Mapbox token not set.<br />
          Set NEXT_PUBLIC_MAPBOX_TOKEN to view the Real-time Traffic map.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[72vh] rounded border border-neutral-800 overflow-hidden relative">
      <div ref={ref} className="w-full h-full" />
      <div className="absolute top-4 right-4 bg-neutral-900/90 border border-neutral-800 rounded p-3 text-xs space-y-2 backdrop-blur-sm">
        <div className="font-medium text-neutral-200">Real-time Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-neutral-300">On Time (0-5 min delay)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-neutral-300">Minor Delay (5-10 min)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span className="text-neutral-300">Delayed (10-30 min)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-neutral-300">Severely Delayed (30+ min)</span>
          </div>
        </div>
        <div className="pt-2 border-t border-neutral-700 text-neutral-400">
          <div>Heat map: Train density</div>
          <div>Clusters: Multiple trains</div>
        </div>
      </div>
    </div>
  );
}

