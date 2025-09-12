import DigitalTwinMap from "@/components/DigitalTwinMap";
import ConflictHeatmap from "@/components/ConflictHeatmap";
import EnergyChart from "@/components/EnergyChart";
import DelayForecast from "@/components/DelayForecast";
import DecisionCard from "@/components/DecisionCard";
import ScenarioModal from "@/components/ScenarioModal";
import AIInsightsPanel from "@/components/AIInsightsPanel";

export default function DashboardPage(){
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2 h-[420px] rounded-md border border-neutral-800 bg-neutral-900 p-2">
        <div className="text-sm opacity-80 mb-2">Digital Twin Map</div>
        <div className="h-[360px]"><DigitalTwinMap/></div>
      </div>
      <div className="col-span-1 space-y-4">
        <ScenarioModal/>
        <AIInsightsPanel/>
      </div>
      <div className="col-span-2 rounded-md border border-neutral-800 bg-neutral-900 p-2">
        <div className="text-sm opacity-80 mb-2">Conflict Heatmap</div>
        <ConflictHeatmap/>
      </div>
      <div className="col-span-1 rounded-md border border-neutral-800 bg-neutral-900 p-2">
        <div className="text-sm opacity-80 mb-2">Energy Efficiency</div>
        <EnergyChart/>
      </div>
      <div className="col-span-2 rounded-md border border-neutral-800 bg-neutral-900 p-2">
        <div className="text-sm opacity-80 mb-2">Delay Forecast</div>
        <DelayForecast/>
      </div>
      <div className="col-span-1 space-y-3">
        <DecisionCard/>
        <DecisionCard/>
      </div>
    </div>
  );
}

