import SystemMetricsChart from "@/components/SystemMetricsChart";

export default function Reports(){
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Reports</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-3">
          <div className="text-sm opacity-80 mb-2">CPU / Network Utilization</div>
          <SystemMetricsChart/>
        </div>
        <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-sm opacity-80 mb-2">Exports</div>
          <div className="text-xs opacity-70">Export to PDF/CSV coming soon.</div>
        </div>
      </div>
    </div>
  );
}

