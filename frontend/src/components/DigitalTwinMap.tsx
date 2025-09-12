"use client";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";
import type { FeatureCollection, Point, Feature, Geometry, LineString, MultiLineString } from "geojson";
import { advanceTrain, type Train } from "@/lib/map";
import { getSocket } from "@/lib/socket";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
if (TOKEN) mapboxgl.accessToken = TOKEN;

const TRACKS_URL = process.env.NEXT_PUBLIC_TRACKS_GEOJSON_URL || "/tracks-sample.geojson";
const STATIONS_URL = process.env.NEXT_PUBLIC_STATIONS_GEOJSON_URL || "/stations-sample.geojson";
const ACTIVE_CORRIDOR = process.env.NEXT_PUBLIC_ACTIVE_CORRIDOR || "";

export default function DigitalTwinMap() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !TOKEN) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let popup: mapboxgl.Popup | null = null;
    let trains: Train[] = [
      { id: "T123", lng: 88.3639, lat: 22.5726, speedKmph: 60, delayMin: 4, bearing: 280 },
      { id: "T456", lng: 72.8777, lat: 19.0760, speedKmph: 70, delayMin: 0, bearing: 30 },
    ];


    let followId: string | null = null;

    const map = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [79, 22],
      zoom: 5,
      pitch: 45,
      bearing: -17.6,
      antialias: true,
    });

    // track geometry cache and per-train route state
    let trackLines: [number, number][][] = [];
    const trainRoutes: Record<string, { line: [number, number][]; seg: number; t: number }> = {};
    let stationPoints: Feature<Point, { name?: string; rank?: number }>[] = [];
    type TrackProps = { name?: string; corridor?: string; active?: boolean; bottleneck?: boolean; track_type?: "passenger"|"freight"|"high-speed"; electrified?: boolean; importance?: number };
    let originalTracks: FeatureCollection<Geometry, TrackProps> | null = null;


    map.on("load", async () => {
      // Emphasize railway tracks from base style
      try {
        map.addLayer({
          id: "rail-overlay",
          type: "line",
          source: "composite",
          "source-layer": "road",
          filter: ["==", ["get", "class"], "rail"],
          paint: {
            "line-color": "#22c55e",
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 8, 1.2, 12, 2.5, 15, 5],
            "line-opacity": 0.8
          }
        }, map.getStyle().layers?.find(l => l.id.includes("road"))?.id);
      } catch {}

      // External high-fidelity tracks
      try {
        const res = await fetch(TRACKS_URL);
        if (res.ok) {
          const geo = await res.json();
          if (!map.getSource("tracks")) {
            map.addSource("tracks", { type: "geojson", data: geo });
            map.addLayer({
              id: "tracks-line",
              type: "line",
              source: "tracks",
              paint: {
                "line-color": [
                  "case",
                  ["==", ["get", "bottleneck"], true], "#ef4444",
                  ["match", ["get","track_type"],
                    "freight", "#fb923c",
                    "high-speed", "#22c55e",
                    "passenger", "#60a5fa",
                    "#94a3b8"
                  ]
                ],
                "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.5, 8, 2.5, 12, 4, 15, 8],
                "line-opacity": 0.9
              }
            });

            // Active corridor or active=true highlight
            const activeFilter = ["==", ["get","active"], true];
            const corridorFilter = ACTIVE_CORRIDOR ? ["==", ["get","corridor"], ACTIVE_CORRIDOR] : ["==", ["get","__none__"], "__none__"];
            map.addLayer({
              id: "tracks-active",
              type: "line",
              source: "tracks",
              filter: ["any", activeFilter, corridorFilter],
              paint: {
                "line-color": "#22d3ee",
                "line-width": ["interpolate", ["linear"], ["zoom"], 5, 2, 8, 3, 12, 5, 15, 9],
                "line-opacity": 1
              }
            });
            // Corridor controls (UI)
            const corridorsSet = new Set<string>();
            (geo.features || []).forEach((f: Feature<Geometry, { corridor?: string }> )=>{ const c = f?.properties?.corridor; if (c) corridorsSet.add(c); });
            const corridors = Array.from(corridorsSet).sort();
            const selected = new Set<string>(ACTIVE_CORRIDOR ? [ACTIVE_CORRIDOR] : []);
            const refreshFilter = () => {
              const selectedArr = Array.from(selected);
              const filterExpr = selectedArr.length
                ? ["any", ["==", ["get","active"], true], ["in", ["get","corridor"], ["literal", selectedArr]]]
                : ["==", ["get","active"], true];
              map.setFilter("tracks-active", filterExpr as unknown as mapboxgl.Expression);
            };
            refreshFilter();
            const ctrl: mapboxgl.IControl = {
              onAdd: () => {
                const el = document.createElement("div");
                el.className = "mapboxgl-ctrl p-2 rounded bg-black/60 text-xs text-slate-200 space-y-1";
                el.style.maxHeight = "180px"; el.style.overflow = "auto";
                el.innerHTML = `<div style="font-weight:600;margin-bottom:4px">Corridors</div>` +
                  corridors.map(c=>`<label style=\"display:flex;align-items:center;gap:6px\"><input type=\"checkbox\" data-corr=\"${c}\" ${selected.has(c)?"checked":""}/> ${c}</label>`).join("");
                el.addEventListener("change", (ev) => {
                  const t = ev.target as HTMLInputElement;
                  const c = t.getAttribute("data-corr");
                  if (!c) return;
                  if (t.checked) selected.add(c); else selected.delete(c);
                  refreshFilter();
                });
                return el;
              },
              onRemove: () => {}
            };
            map.addControl(ctrl, "top-right");


      // Stations (external or fallback)
      try {
        const sr = await fetch(STATIONS_URL);
        if (sr.ok) {
          const stations = await sr.json();
          stationPoints = (stations.features || []) as Feature<Point, { name?: string; rank?: number; station_type?: string; passenger_volume?: number }>[];
            // Cache original tracks and add analytics overlay source/layer
            originalTracks = geo as FeatureCollection<Geometry, TrackProps>;
            if (!map.getSource("corridor-analytics")) {
              map.addSource("corridor-analytics", { type: "geojson", data: { type: "FeatureCollection", features: [] } as FeatureCollection<LineString> });
              map.addLayer({ id: "corridor-analytics-line", type: "line", source: "corridor-analytics", paint: {
                "line-color": [
                  "interpolate", ["linear"], ["get","severity"],
                  0, "#22c55e",
                  0.5, "#eab308",
                  1, "#ef4444"
                ],
                "line-width": ["interpolate", ["linear"], ["get","capacity"], 0, 1, 1, 6, 2, 10],
                "line-opacity": 0.8
              }}, "tracks-active");
            }

            // Flythrough presets UI
            const flyPresets: Record<string, { center:[number,number]; zoom:number; bearing:number; pitch:number; duration:number }[]> = {
              "Golden Quadrilateral": [
                { center:[72.8777,19.076], zoom:5.5, bearing:20, pitch:60, duration:2000 },
                { center:[77.209,28.6139], zoom:6, bearing:80, pitch:55, duration:2500 },
                { center:[88.3639,22.5726], zoom:6, bearing:140, pitch:50, duration:2500 },
                { center:[80.2707,13.0827], zoom:6, bearing:200, pitch:55, duration:2500 }
              ],
              "WDFC": [
                { center:[77.209,28.6139], zoom:6.2, bearing:230, pitch:60, duration:2200 },
                { center:[72.5714,23.0225], zoom:6.4, bearing:250, pitch:60, duration:2200 },
                { center:[72.8777,19.076], zoom:6.2, bearing:270, pitch:55, duration:2200 }
              ],
              "EDFC": [
                { center:[77.209,28.6139], zoom:6.2, bearing:120, pitch:60, duration:2200 },
                { center:[82.9739,25.3176], zoom:6.4, bearing:120, pitch:55, duration:2200 },
                { center:[88.3639,22.5726], zoom:6.2, bearing:120, pitch:55, duration:2200 }
              ]
            };
            const flyCtrl: mapboxgl.IControl = {
              onAdd: () => {
                const el = document.createElement("div");
                el.className = "mapboxgl-ctrl p-2 rounded bg-black/60 text-xs text-slate-200";
                const opts = Object.keys(flyPresets).map(k=>`<option value="${k}">${k}</option>`).join("");
                el.innerHTML = `<div style="display:flex;gap:6px;align-items:center">
                  <label>Fly:</label>
                  <select data-fly style="background:#0b1220;color:#e2e8f0;border:1px solid #334155;border-radius:4px;padding:2px 6px">${opts}</select>
                  <button data-go style="padding:2px 8px;border:1px solid #334155;border-radius:4px;background:#0b1220;color:#e2e8f0">Go</button>
                </div>`;
                el.querySelector('[data-go]')?.addEventListener('click', ()=>{
                  const key = (el.querySelector('[data-fly]') as HTMLSelectElement).value;
                  const seq = flyPresets[key];
                  const run = (i:number) => {
                    if (!seq || i>=seq.length) return; const s = seq[i];
                    map.flyTo({ center:s.center, zoom:s.zoom, bearing:s.bearing, pitch:s.pitch, duration:s.duration, essential:true });
                    setTimeout(()=>run(i+1), s.duration+100);
                  };
                  run(0);
                });
                return el;
              }, onRemove: ()=>{}
            };
            map.addControl(flyCtrl, "top-right");

            // Simplifier + viewport culling for tracks
            const sq = (x:number)=>x*x;
            const distPointToSeg = (p:[number,number], a:[number,number], b:[number,number])=>{
              const ax=a[0], ay=a[1], bx=b[0], by=b[1], px=p[0], py=p[1];
              const abx=bx-ax, aby=by-ay; const t = ((px-ax)*abx + (py-ay)*aby) / (sq(abx)+sq(aby) || 1e-12);
              const tt = Math.max(0, Math.min(1, t)); const q:[number,number]=[ax+tt*abx, ay+tt*aby];
              return Math.hypot(px-q[0], py-q[1]);
            };
            const simplifyLine = (coords:[number,number][], eps:number):[number,number][]=>{
              if (coords.length<=2) return coords;
              const keep = new Uint8Array(coords.length); keep[0]=1; keep[coords.length-1]=1;
              const stack:[number,number][] = [[0, coords.length-1]];
              while (stack.length){
                const [i,j]=stack.pop()!; let maxD=0, idx=-1; const a=coords[i], b=coords[j];
                for(let k=i+1;k<j;k++){ const d=distPointToSeg(coords[k], a, b); if (d>maxD){maxD=d; idx=k;} }
                if (maxD>eps && idx>=0){ keep[idx]=1; stack.push([i,idx],[idx,j]); }
              }
              const out:[number,number][]=[]; for(let i=0;i<coords.length;i++) if (keep[i]) out.push(coords[i]);
              return out.length>=2? out : coords;
            };
            const updateTracksLOD = () => {
              if (!originalTracks) return;
              const b = map.getBounds() as mapboxgl.LngLatBounds;
              const west = b.getWest() - 1, south = b.getSouth() - 1, east = b.getEast() + 1, north = b.getNorth() + 1;
              const intersects = (minx:number,miny:number,maxx:number,maxy:number)=>!(maxx<west||minx>east||maxy<south||miny>north);
              const zoom = map.getZoom();
              const eps = zoom<6? 0.2 : zoom<9? 0.05 : zoom<12? 0.02 : 0.008;
              const feats: Feature<Geometry, TrackProps>[] = [];
              for (const f of originalTracks.features){
                if (!f.geometry) continue;
                if (f.geometry.type === "LineString"){
                  const c = (f.geometry as LineString).coordinates as [number,number][];
                  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity; for (const [x,y] of c){ if (x<minx)minx=x; if (y<miny)miny=y; if (x>maxx)maxx=x; if (y>maxy)maxy=y; }
                  if (!intersects(minx,miny,maxx,maxy)) continue;
                  const sc = simplifyLine(c, eps);
                  feats.push({ type:"Feature", properties: f.properties||{}, geometry: { type:"LineString", coordinates: sc } });
                } else if (f.geometry.type === "MultiLineString"){
                  const ml = (f.geometry as MultiLineString).coordinates as [number,number][][];
                  let hit=false; const outParts:[number,number][][]=[];
                  for (const part of ml){
                    let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity; for (const [x,y] of part){ if (x<minx)minx=x; if (y<miny)miny=y; if (x>maxx)maxx=x; if (y>maxy)maxy=y; }
                    if (!intersects(minx,miny,maxx,maxy)) continue; hit=true; outParts.push(simplifyLine(part, eps));
                  }
                  if (hit) feats.push({ type:"Feature", properties: f.properties||{}, geometry: { type:"MultiLineString", coordinates: outParts } as MultiLineString });
                }
              }
              const updated: FeatureCollection<Geometry, TrackProps> = { type:"FeatureCollection", features: feats };
              const src = map.getSource("tracks") as mapboxgl.GeoJSONSource; if (src) src.setData(updated as FeatureCollection<Geometry>);
            };
            map.on("moveend", updateTracksLOD);
            map.on("zoomend", updateTracksLOD);
            updateTracksLOD();

            // Corridor analytics via socket → overlay lines
            try {
              const s = getSocket();
              s.on("corridorAnalytics", (payload: { corridor:string; capacity:number; flow:number; severity:number }[]) => {
                if (!originalTracks) return;
                const byCorr = new Map(payload.map(p=>[p.corridor, p]));
                const out: Feature<LineString, { corridor:string; capacity:number; flow:number; severity:number }>[] = [];
                for (const f of originalTracks.features){
                  const c = (f.properties as TrackProps)?.corridor; if (!c) continue; const p = byCorr.get(c); if (!p) continue;
                  if (f.geometry?.type === "LineString"){
                    out.push({ type:"Feature", properties:{ corridor:c, capacity:p.capacity, flow:p.flow, severity: p.severity }, geometry: f.geometry as LineString });
                  } else if (f.geometry?.type === "MultiLineString"){
                    const parts = (f.geometry as MultiLineString).coordinates as [number,number][][];
                    for (const part of parts){ out.push({ type:"Feature", properties:{ corridor:c, capacity:p.capacity, flow:p.flow, severity:p.severity }, geometry:{ type:"LineString", coordinates: part } }); }
                  }
                }
                const fc: FeatureCollection<LineString, { corridor:string; capacity:number; flow:number; severity:number }> = { type:"FeatureCollection", features: out };
                const src = map.getSource("corridor-analytics") as mapboxgl.GeoJSONSource; if (src) src.setData(fc);
              });
            } catch {}

          if (!map.getSource("stations")) {
            map.addSource("stations", { type: "geojson", data: stations });
            map.addLayer({ id: "stations-circle", type: "circle", source: "stations", paint: {
              "circle-color": ["step", ["get","rank"], "#60a5fa", 2, "#34d399"],
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 2, 10, 4, 12, 6]
            }});
            // Simulated elevation: render freight slightly offset to suggest height separation
            map.addLayer({
              id: "tracks-freight-elev",
              type: "line",
              source: "tracks",
              filter: ["==", ["get","track_type"], "freight"],
              paint: {
                "line-color": "#fb923c",
                "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.2, 12, 3.5, 15, 7],
                "line-translate": [0, -2],
                "line-opacity": 0.9
              }
            });

            map.addLayer({ id: "stations-label", type: "symbol", source: "stations",
              layout: { "text-field": ["get","name"], "text-size": ["interpolate", ["linear"], ["zoom"], 5, 8, 12, 12], "text-offset":[0,1.2] },
              paint: { "text-color": "#cbd5e1", "text-halo-color":"#0b0f19", "text-halo-width": 1 }
            });
          }
        }
      } catch {}

          }
          // cache track polylines for snapping
          const feats = (geo.features || []) as Feature<Geometry>[];
          trackLines = [];
          for (const f of feats) {
            if (!f.geometry) continue;
            if (f.geometry.type === "LineString") trackLines.push((f.geometry as LineString).coordinates as [number,number][]);
            else if (f.geometry.type === "MultiLineString") trackLines.push(...(f.geometry as MultiLineString).coordinates as [number,number][][]);
          }
        }
      } catch (e) {
        console.warn("Tracks GeoJSON load failed", e);
      }

      // Trains source/layer
      type TrainProps = { id: string; speedKmph: number; delayMin: number; bearing?: number };
      const trainsFC = (): FeatureCollection<Point, TrainProps> => ({
        type: "FeatureCollection",
        features: trains.map(t => ({
          type: "Feature",
          properties: { id: t.id, speedKmph: t.speedKmph, delayMin: t.delayMin, bearing: t.bearing },
          geometry: { type: "Point", coordinates: [t.lng, t.lat] }
        }))
      });

      // active routes polyline layer
      map.addSource("active-routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } as FeatureCollection<LineString> });
      map.addLayer({ id: "active-routes-line", type: "line", source: "active-routes", paint: {
        "line-color": "#22c55e",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.5, 12, 3, 15, 6],
        "line-opacity": 0.9
      }});

      // trains as symbols (3D-like icon) instead of circles
      map.addSource("trains", { type: "geojson", data: trainsFC() });
      map.addLayer({
        id: "trains-symbol",
        type: "symbol",
        source: "trains",
        layout: {
          "icon-image": "rail-15",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 12, 1.2, 15, 1.6],
          "icon-rotate": ["coalesce", ["get","bearing"], 0],
          "icon-rotation-alignment": "map",
          "icon-allow-overlap": true
        }
      });

      // 3D train (glTF) custom layer – shown only when following a train and device seems capable
      const canUse3D = typeof window !== "undefined"
        && (navigator.hardwareConcurrency || 4) >= 4
        && (window.devicePixelRatio || 1) <= 2.5
        && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

      let threeRenderer: THREE.WebGLRenderer | null = null;
      let threeScene: THREE.Scene | null = null;
      let threeCamera: THREE.Camera | null = null;
      let trainRoot: THREE.Object3D | null = null;

      const loadTrainModel = async (): Promise<THREE.Object3D> => {
        if (trainRoot) return trainRoot;
        // Try to load a glTF; fallback to box geometry if missing
        try {
          const loader = new GLTFLoader();
          const gltf = await loader.loadAsync("/models/train.glb");
          const obj = gltf.scene || gltf.scenes?.[0];
          if (obj) {
            obj.traverse((n: THREE.Object3D) => { if ((n as unknown as THREE.Mesh).isMesh) { const m = n as unknown as THREE.Mesh; m.castShadow = false; m.receiveShadow = false; } });
            trainRoot = obj;
            return obj;
          }
        } catch {}
        const geom = new THREE.BoxGeometry(1, 0.35, 0.35);
        const mat = new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.1, roughness: 0.8 });
        const mesh = new THREE.Mesh(geom, mat);
        trainRoot = mesh;
        return mesh;
      };

      const updateTrainPose = () => {
        if (!trainRoot || !threeScene || !followId) { if (trainRoot) trainRoot.visible = false; return; }
        const ft = trains.find(t => t.id === followId);
        if (!ft) { trainRoot.visible = false; return; }
        const mc = mapboxgl.MercatorCoordinate.fromLngLat([ft.lng, ft.lat], 0);
        const scale = mc.meterInMercatorCoordinateUnits();
        trainRoot.visible = true;
        trainRoot.position.set(mc.x, mc.y, mc.z);
        trainRoot.scale.set(scale, scale, scale);
        // Orient along bearing; GLTF often Z-up, Mapbox uses mercator coords; rotateX to lay model flat
        trainRoot.rotation.set(Math.PI / 2, 0, -((ft.bearing || 0) * Math.PI / 180));
      };

      const threeLayer: mapboxgl.CustomLayerInterface = {
        id: "train-3d",
        type: "custom",
        renderingMode: "3d",
        onAdd: async (_mapboxMap: mapboxgl.Map, gl: WebGLRenderingContext) => {
          if (!canUse3D) return;
          threeScene = new THREE.Scene();
          threeCamera = new THREE.Camera();
          // shared canvas/context from Mapbox (provided by param)
          threeRenderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true, alpha: true });
          threeRenderer.autoClear = false;
          threeRenderer.setPixelRatio(1);
          // simple lighting
          const amb = new THREE.AmbientLight(0xffffff, 0.8);
          const dir = new THREE.DirectionalLight(0xffffff, 0.6);
          dir.position.set(0, 0, 10);
          threeScene.add(amb, dir);
          const root = await loadTrainModel();
          root.visible = false;
          threeScene.add(root);
        },
        render: (_gl: WebGLRenderingContext, matrix: number[]) => {
          if (!canUse3D || !threeRenderer || !threeScene || !threeCamera) return;
          (threeCamera as THREE.Camera).projectionMatrix = new THREE.Matrix4().fromArray(matrix as unknown as number[]);
          updateTrainPose();
          threeRenderer.resetState();
          threeRenderer.render(threeScene, threeCamera);
          // signal map to repaint
          map.triggerRepaint();
        }
      };

      try { map.addLayer(threeLayer, "trains-symbol"); } catch {}


      // Tooltip
      map.on("mouseenter", "trains-symbol", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0] as mapboxgl.MapboxGeoJSONFeature | undefined;
        if (!f) return;
        const point = f.geometry as Point;
        const [lng, lat] = point.coordinates as [number, number];
        const p = f.properties as unknown as { id: string; speedKmph: number; delayMin: number };
        popup?.remove();
        popup = new mapboxgl.Popup({ closeButton: false })
          .setLngLat([lng, lat])
          .setHTML(`<div style="font-size:12px">Train ${p.id}<br/>Speed: ${p.speedKmph} km/h<br/>Delay: ${p.delayMin} min</div>`)
          .addTo(map);
      });
      map.on("mouseleave", "trains-symbol", () => {
        map.getCanvas().style.cursor = "";
        popup?.remove();
        popup = null;
      });

      // Build snapped routes once tracks are ready
      const hav = (a:[number,number], b:[number,number])=>{
        const toRad=(x:number)=>x*Math.PI/180; const R=6371000;
        const dLat=toRad(b[1]-a[1]); const dLng=toRad(b[0]-a[0]);
        const lat1=toRad(a[1]); const lat2=toRad(b[1]);
        const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.sqrt(h));
      };
      const nearestLineFor = (p:[number,number]): { idx:number; seg:number; t:number; dist:number } | null => {
        let best:{idx:number; seg:number; t:number; dist:number}|null=null;
        trackLines.forEach((line, li)=>{
          for(let i=0;i<line.length-1;i++){
            const A=line[i] as [number,number], B=line[i+1] as [number,number];
            // project p onto AB in lon/lat space (approx planar for short segs)
            const ax=A[0], ay=A[1], bx=B[0], by=B[1]; const px=p[0], py=p[1];
            const abx=bx-ax, aby=by-ay; const apx=px-ax, apy=py-ay;
            const ab2=abx*abx+aby*aby || 1e-9; let tt=(apx*abx+apy*aby)/ab2; tt=Math.max(0,Math.min(1,tt));
            const proj:[number,number]=[ax+tt*abx, ay+tt*aby];
            const d=hav(p, proj);

      // Click for detailed popover
      map.on("click", "trains-symbol", (e) => {
        const f = e.features?.[0] as mapboxgl.MapboxGeoJSONFeature | undefined;
        if (!f) return;
        const p = f.properties as unknown as { id: string; speedKmph: number; delayMin: number };
        const train = trains.find(t=>t.id===p.id);
        const route = train ? trainRoutes[train.id] : undefined;
        // position
        let lngLat:[number,number];
        if (route){
          const A = route.line[route.seg] as [number,number];
          const B = route.line[route.seg+1] as [number,number] || route.line[route.seg];
          lngLat = [A[0]+(B[0]-A[0])*route.t, A[1]+(B[1]-A[1])*route.t];
        } else {
          const point = f.geometry as Point; lngLat = point.coordinates as [number,number];
        }
        // next station (nearest by geodesic as a simple proxy)
        let nextName = ""; let etaMin: number | null = null;
        if (train && stationPoints.length){
          let bestD = Infinity; let bestName = "";
          for (const s of stationPoints){
            const coords = (s.geometry?.type === "Point" ? (s.geometry.coordinates as [number,number]) : null);
            if (!coords) continue; const d = hav(lngLat, coords); if (d < bestD){ bestD = d; bestName = (s.properties?.name) || "Station"; }
          }
          if (bestD < Infinity){ nextName = bestName; const speedMps = ( (train.speedKmph||0) * 1000 ) / 3600; if (speedMps>0) etaMin = Math.round(bestD / speedMps / 60); }
        }
        const conflicts = (train?.predictedConflicts ?? Math.max(0, Math.round((train?.delayMin||0)/5)));
        const isFollowing = typeof followId !== "undefined" && followId === p.id;
        const html = `<div style="font-size:12px;line-height:1.2">
          <b>Train ${p.id}</b><br/>
          Speed: ${p.speedKmph} km/h \u2022 Delay: ${p.delayMin} min<br/>
          Conflicts (predicted): ${conflicts}${nextName ? `<br/>Next: ${nextName}${etaMin!=null?` (~${etaMin} min)`:""}` : ""}
          <div style="margin-top:6px"><button data-follow style="padding:4px 8px;border:1px solid #334155;border-radius:4px;background:#0b1220;color:#e2e8f0">${isFollowing?"Unfollow":"Follow"}</button></div>
        </div>`;
        popup?.remove();
        popup = new mapboxgl.Popup({ closeButton: true })
          .setLngLat(lngLat)
          .setHTML(html)
          .addTo(map);
        const btnEl = popup?.getElement()?.querySelector('[data-follow]') as HTMLButtonElement | null;
        if (btnEl) btnEl.addEventListener('click', () => { followId = isFollowing ? null : p.id; popup?.remove(); });
      });

            if(!best || d<best.dist) best={idx:li, seg:i, t:tt, dist:d};
          }
        });
        return best;
      };
      if (trackLines.length){
        trains.forEach(t=>{
          const m = nearestLineFor([t.lng, t.lat]);
          if (m){ trainRoutes[t.id] = { line: trackLines[m.idx], seg: m.seg, t: m.t }; }
        });
      }

      // Animation tick (snap to track if route exists else free move)
      // Flow animation for active tracks (dash cycling)
      let flowAnimPhase = 0;
      const flowDashPhases: number[][] = [ [2,2], [1.5,2.5], [1,3], [0.5,3.5] ];

      timer = setInterval(() => {
        // Update active routes polylines ahead of trains
        const features = trains.map((t): Feature<LineString, {id:string}> | null => {
          const route = trainRoutes[t.id];

          if (!route) return null;
          const A = route.line[route.seg] as [number,number];
          const B = route.line[route.seg+1] as [number,number] || route.line[route.seg];
          const pos:[number,number]=[A[0]+(B[0]-A[0])*route.t, A[1]+(B[1]-A[1])*route.t];
          const tail = route.line.slice(route.seg+1, Math.min(route.seg+6, route.line.length));
          const coords = [pos, ...tail] as [number,number][];

        // follow train camera
        if (followId) {
          const ft = trains.find(t => t.id === followId);
          if (ft) {
            try { map.easeTo({ center: [ft.lng, ft.lat], bearing: (ft.bearing ?? map.getBearing()), pitch: 50, duration: 900, zoom: Math.max(map.getZoom(), 6) }); } catch {}
          }
        }

          return { type: "Feature", properties: { id: t.id }, geometry: { type: "LineString", coordinates: coords } };
        }).filter((f): f is Feature<LineString, {id:string}> => !!f);
        const routes: FeatureCollection<LineString, {id:string}> = { type: "FeatureCollection", features };
        const rsrc = map.getSource("active-routes") as mapboxgl.GeoJSONSource;
        if (rsrc) rsrc.setData(routes);

        trains = trains.map(t => {
          const route = trainRoutes[t.id];
          if (!route) return advanceTrain(t, 1);
          const speedMps = (t.speedKmph*1000)/3600; let left=speedMps*1;
          while (left>0){
            const A = route.line[route.seg] as [number,number];
            const B = route.line[route.seg+1] as [number,number] || route.line[route.seg];
            const segLen = hav(A,B);
            const pos:[number,number]=[A[0]+(B[0]-A[0])*route.t, A[1]+(B[1]-A[1])*route.t];
            const remain = segLen*(1-route.t);
            if (left < remain){
              route.t += left/segLen; left = 0;
              t = { ...t, lng: pos[0], lat: pos[1] };
            } else {
              left -= remain; route.seg += 1; route.t = 0;
              if (route.seg >= route.line.length-1){ route.seg = 0; route.t = 0; }
              t = { ...t, lng: B[0], lat: B[1] };
            }
          }
          return t;
        });
        const src = map.getSource("trains") as mapboxgl.GeoJSONSource;
        if (src) src.setData(trainsFC());

        // animate dash on active tracks to indicate flow/capacity
        const dash = flowDashPhases[flowAnimPhase % flowDashPhases.length];
        try { map.setPaintProperty("tracks-active", "line-dasharray", dash); } catch {}
        flowAnimPhase = (flowAnimPhase + 1) % flowDashPhases.length;

      }, 1000);

      // Socket updates (if backend broadcasts)
      try {
        const s = getSocket();
        s.on("trains", (payload: Train[]) => {
          trains = payload;
          const src = map.getSource("trains") as mapboxgl.GeoJSONSource;
          if (src) src.setData(trainsFC());
        });
      } catch {}
    });

    return () => {
      clearInterval(timer);
      popup?.remove();
      map.remove();
    };
  }, []);

  if (!TOKEN) {
    return (
      <div className="w-full h-full grid place-items-center bg-neutral-950 text-neutral-400 border border-neutral-800 rounded">
        <div className="text-center text-sm">
          Mapbox token not set.<br/>
          Set NEXT_PUBLIC_MAPBOX_TOKEN to view the 3D Digital Twin map.
        </div>
      </div>
    );
  }

  return <div ref={ref} className="w-full h-full" />;
}

