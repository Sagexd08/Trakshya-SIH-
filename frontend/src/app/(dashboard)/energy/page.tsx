import EnergyChart from "@/components/EnergyChart";

async function getEnergyKPIs() {
  try {
    const res = await fetch("/api/energy/series", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const points = Array.isArray(j?.points) ? j.points as Array<{ h: number; base: number; opt: number }> : [];
    if (!points.length) throw new Error("no-points");
    const baseline = Math.round(points.reduce((a, p) => a + p.base, 0));
    const optimized = Math.round(points.reduce((a, p) => a + p.opt, 0));
    return { baseline, optimized };
  } catch {
    // Fallback mock
    return { baseline: 1000, optimized: 860 };
  }
}

export default async function Energy(){
  const { baseline, optimized } = await getEnergyKPIs();
  const savings = baseline - optimized;
  const savingsPct = Math.round((savings / Math.max(1, baseline)) * 100);
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Energy Optimization</h2>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
          <div className="text-xs opacity-70">Baseline</div>
          <div className="text-lg font-semibold">{baseline} MWh</div>
        </div>
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
          <div className="text-xs opacity-70">Optimized</div>
          <div className="text-lg font-semibold">{optimized} MWh</div>
        </div>
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
          <div className="text-xs opacity-70">Savings</div>
          <div className="text-lg font-semibold text-emerald-400">{savings} MWh ({savingsPct}%)</div>
        </div>
      </div>
      <div className="rounded-md border border-neutral-800 bg-neutral-900 p-2">
        <div className="text-sm opacity-80 mb-2">Baseline vs Optimized</div>
        <EnergyChart/>
      </div>
    </div>
  );
}

