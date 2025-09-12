"use client";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

const alerts = [
  { level: "critical", title: "Bottleneck near Allahabad", detail: "Conflict between T123 and T456 in 35 min" },
  { level: "moderate", title: "Energy spike on T789", detail: "+12% vs baseline in next hour" },
  { level: "info", title: "No delays expected on Howrah-Delhi corridor", detail: "Within threshold" },
];

export default function AIInsightsPanel(){
  const icon = (lvl: string) => lvl === "critical" ? <AlertTriangle className="text-red-400"/> : lvl === "moderate" ? <Info className="text-yellow-400"/> : <CheckCircle2 className="text-green-400"/>;
  return (
    <div className="space-y-2">
      {alerts.map((a, i)=> (
        <div key={i} className="p-3 rounded-md bg-neutral-900 border border-neutral-800">
          <div className="flex items-center gap-2">
            {icon(a.level)}
            <div className="font-medium">{a.title}</div>
          </div>
          <div className="text-sm opacity-80 ml-6">{a.detail}</div>
        </div>
      ))}
    </div>
  );
}

