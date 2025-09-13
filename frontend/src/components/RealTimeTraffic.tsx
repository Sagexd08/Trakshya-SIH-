"use client";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { connectWS } from "@/lib/wsClient";
import { toast } from "sonner";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
if (TOKEN) mapboxgl.accessToken = TOKEN;

// Simple mock train generator simulating nationwide movement
// Keep numbers modest to avoid perf issues

type TPoint = { id: string; lng: number; lat: number; speed: number; weight: number; trainNo?: string; name?: string; nextStop?: string };

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


type WSMessage = { type?: string; count?: number; text?: string };


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
    out.push({ id: `RT${i}`,
      lng, lat, speed, weight,
      trainNo: `TR${1000 + i}`,
      name: `Mock Express ${i}`,
      nextStop: ["NDLS","CSMT","HWH","MAS","ADI","JP","BSB"][i % 7],
    });
  }
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

    let trains: TPoint[] = seedMockTrains(180);

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


    const toFC = (): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; weight: number; speed: number; trainNo?: string; name?: string; nextStop?: string }> => ({
      type: "FeatureCollection",
      features: getFilteredTrains().map((t) => ({
        type: "Feature",
        properties: { id: t.id, weight: t.weight, speed: t.speed, trainNo: t.trainNo, name: t.name, nextStop: t.nextStop },
        geometry: { type: "Point", coordinates: [t.lng, t.lat] },
      })),
    });

    const updateSources = () => {
      const src = map.getSource("traffic") as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(toFC());
      const csrc = map.getSource("traffic-cluster") as mapboxgl.GeoJSONSource | undefined;
      if (csrc) csrc.setData(toFC());
    };


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
          "circle-radius": ["interpolate", ["linear"], ["get", "weight"], 0, 2, 1, 6],
          "circle-color": ["interpolate", ["linear"], ["get", "speed"], 0, "#ef4444", 80, "#eab308", 120, "#22c55e"],
          "circle-opacity": 0.9,
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "#0b1220",
        },
      });

      // Click to see train/station details
      map.on("click", "traffic-circles", (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        const f = (e as unknown as { features?: mapboxgl.MapboxGeoJSONFeature[] }).features?.[0];
        const p = (f?.properties ?? {}) as Record<string, unknown>;
        const trainNo = String(p.trainNo ?? p.id ?? "");
        const name = String(p.name ?? "");
        const nextStop = String(p.nextStop ?? "");
        const speed = Number(p.speed ?? 0);
        const html = `<div style="font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto; min-width:180px">
          <div style="font-weight:600">${name || "Train/Station"}</div>
          <div>${trainNo ? `No: ${trainNo}` : ""}</div>
          <div>Speed: ${Number.isFinite(speed) ? speed.toFixed(0) : "-"} km/h</div>
          <div>${nextStop ? `Next: ${nextStop}` : ""}</div>
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

