"use client";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
if (TOKEN) mapboxgl.accessToken = TOKEN;

// Simple mock train generator simulating nationwide movement
// Keep numbers modest to avoid perf issues

type TPoint = { id: string; lng: number; lat: number; speed: number; weight: number };

// Minimal mapping of station names in sample geojson to IRCTC station codes
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
};

// GeoJSON feature type for sample stations
type StationFeature = { properties?: { name?: string }; geometry: { coordinates: [number, number] } };



function seedMockTrains(n = 150): TPoint[] {
  // Seed around major metros and corridors
  const hubs: [number, number][] = [
    [77.209, 28.6139], // Delhi
    [72.8777, 19.076], // Mumbai
    [88.3639, 22.5726], // Kolkata
    [80.2707, 13.0827], // Chennai
    [72.5714, 23.0225], // Ahmedabad
    [73.8567, 18.5204], // Pune
    [78.4867, 17.3850], // Hyderabad
    [77.5946, 12.9716], // Bengaluru
    [75.8577, 22.7196], // Bhopal
  ];
  const out: TPoint[] = [];
  for (let i = 0; i < n; i++) {
    const [blng, blat] = hubs[Math.floor(Math.random() * hubs.length)];
    const jitterLng = (Math.random() - 0.5) * 2.5; // ~2.5 deg spread
    const jitterLat = (Math.random() - 0.5) * 2.0;
    const lng = blng + jitterLng;
    const lat = blat + jitterLat;
    const speed = 40 + Math.random() * 80; // 40-120 km/h
    const weight = Math.min(1, Math.max(0, 0.5 + (Math.random() - 0.5) * 0.8));
    out.push({ id: `RT${i}`, lng, lat, speed, weight });
  }
  return out;
}

export default function RealTimeTraffic() {
  const ref = useRef<HTMLDivElement>(null);


  const [, setStats] = useState<{ active: number; avgSpeed: number; congestion: number }>({ active: 0, avgSpeed: 0, congestion: 0 });

  useEffect(() => {
    if (!ref.current || !TOKEN) return;
    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [79, 22],
      zoom: 5,
      pitch: 45,
      bearing: -15,
      antialias: true,
    });

    let timer: ReturnType<typeof setInterval> | undefined;
    let poller: ReturnType<typeof setInterval> | undefined;

    let trains: TPoint[] = seedMockTrains(180);

	    // Playback history (0 = live, 1..30 minutes ago)
	    const history: TPoint[][] = [trains.map((p) => ({ ...p }))];
	    let playback = 0;


    const toFC = (): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; weight: number; speed: number }> => ({
      type: "FeatureCollection",
      features: trains.map((t) => ({
        type: "Feature",
        properties: { id: t.id, weight: t.weight, speed: t.speed },
        geometry: { type: "Point", coordinates: [t.lng, t.lat] },
      })),
    });

    map.on("load", () => {
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
          "circle-radius": ["interpolate", ["linear"], ["get", "weight"], 0, 2, 1, 6],
          "circle-color": ["interpolate", ["linear"], ["get", "speed"], 0, "#ef4444", 80, "#eab308", 120, "#22c55e"],
          "circle-opacity": 0.9,
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "#0b1220",
        },
      });

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
	            const trainsArr = (data?.data?.trains || data?.data || data?.trains || []).filter(Boolean);
	            const delays: number[] = (trainsArr as Array<{ delay_dep?: number; delay_arr?: number; delay?: number }>)
              .map((t) => Number((t?.delay_dep ?? t?.delay_arr ?? t?.delay) || 0))
              .filter((n) => Number.isFinite(n));
	            const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;
	            const count = trainsArr.length;
	            const speed = Math.max(10, 120 - Math.min(100, avgDelay * 2));
	            const weight = Math.max(0, Math.min(1, count / 50));
	            return { id: code, lng: s.coord[0], lat: s.coord[1], speed, weight } as TPoint;
	          });

	          const results = await Promise.allSettled<TPoint>(tasks);
	          const okPoints: TPoint[] = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
	          if (!okPoints.length) return false as const;
	          trains = okPoints;
	          const src = map.getSource("traffic") as mapboxgl.GeoJSONSource | undefined;
	          if (src) src.setData(toFC());
	          const csrc = map.getSource("traffic-cluster") as mapboxgl.GeoJSONSource | undefined;
	          if (csrc) csrc.setData(toFC());
	          history.unshift(trains.map((p) => ({ ...p })));
	          if (history.length > 31) history.pop();
	          updateStats();
	          return true as const;
	        } catch {
	          return false as const;
	        }
	      }

	      void tryFetchLiveOnce();
	      poller = setInterval(() => { void tryFetchLiveOnce(); }, 60000);

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
    <div className="w-full h-[72vh] rounded border border-neutral-800 overflow-hidden">
      <div ref={ref} className="w-full h-full" />
      <div className="absolute top-4 right-4 bg-neutral-900/70 border border-neutral-800 rounded p-2 text-xs space-y-1">
        <div className="opacity-80">Legend</div>
        <div>Heat: density • Circle: speed (red=slow → green=fast)</div>
      </div>
    </div>
  );
}

