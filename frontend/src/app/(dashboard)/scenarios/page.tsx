import ScenarioModal from "@/components/ScenarioModal";

export default function Scenarios(){
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">What-If Scenarios</h2>
      <div className="rounded-md border border-neutral-800 bg-neutral-900 p-4">
        <ScenarioModal/>
      </div>
    </div>
  );
}

