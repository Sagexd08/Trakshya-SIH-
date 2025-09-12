import ConflictHeatmap from "@/components/ConflictHeatmap";

export default function Conflicts(){
  // Mock KPIs for demo purposes
  const kpis = [
    { label: "Active Conflicts", value: 128 },
    { label: "Severe (>.7)", value: 23 },
    { label: "Trend", value: "Rising" },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Conflict Predictions</h2>
      <div className="grid grid-cols-3 gap-3">
        {kpis.map((k)=> (
          <div key={k.label} className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
            <div className="text-xs opacity-70">{k.label}</div>
            <div className="text-lg font-semibold">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-md border border-neutral-800 bg-neutral-900 p-2">
        <div className="text-sm opacity-80 mb-2">Time–Distance Heatmap</div>
        <ConflictHeatmap/>
      </div>
    </div>
  );
}

