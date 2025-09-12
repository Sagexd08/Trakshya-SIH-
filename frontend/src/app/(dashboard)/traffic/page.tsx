import RealTimeTraffic from "@/components/RealTimeTraffic";

export default function Traffic(){
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Real-time Traffic</h2>
      <div className="rounded-md border border-neutral-800 bg-neutral-900 p-2">
        <div className="text-sm opacity-80 mb-2">Network density and speeds (mock)</div>
        <RealTimeTraffic/>
      </div>
    </div>
  );
}

