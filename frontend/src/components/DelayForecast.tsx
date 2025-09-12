"use client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const mk = () => Array.from({length: 30}, (_,i)=>({ i, v: Math.round(Math.random()*10)}));
const trains = [
  { id: "T123", data: mk(), conf: 0.82 },
  { id: "T456", data: mk(), conf: 0.71 },
  { id: "T789", data: mk(), conf: 0.64 },
];

export default function DelayForecast(){
  return (
    <div className="grid grid-cols-3 gap-3">
      {trains.map(t => (
        <div key={t.id} className="p-3 rounded-md border border-neutral-800 bg-neutral-900">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="opacity-80">{t.id}</span>
            <span className="opacity-80">Conf: {(t.conf*100).toFixed(0)}%</span>
          </div>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={t.data}>
                <Line type="monotone" dataKey="v" stroke="#f59e0b" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}

