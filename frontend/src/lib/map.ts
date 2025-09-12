export type Train = {
  id: string;
  lng: number;
  lat: number;
  speedKmph: number;
  delayMin: number;
  bearing?: number;
  predictedConflicts?: number;
};

export function advanceTrain(t: Train, dtSec: number): Train {
  const speedMps = (t.speedKmph * 1000) / 3600;
  const dist = speedMps * dtSec;
  const brad = ((t.bearing ?? 90) * Math.PI) / 180;
  const dlat = (dist / 111320) * Math.cos(brad);
  const dlng = (dist / (111320 * Math.cos((t.lat * Math.PI) / 180))) * Math.sin(brad);
  return { ...t, lat: t.lat + dlat, lng: t.lng + dlng };
}

