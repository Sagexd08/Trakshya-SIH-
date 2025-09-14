"use client";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export type ChangeHandler = (payload: { table: string; event: string; record: any; }) => void;

export function subscribeTrainPositions(onChange: ChangeHandler) {
  const sb = createSupabaseBrowser();
  const channel = sb
    .channel("realtime:train_positions")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "train_positions" },
      (payload) => {
        onChange({ table: "train_positions", event: "INSERT", record: (payload as any).new });
      }
    )
    .subscribe();

  return () => { try { sb.removeChannel(channel); } catch {} };
}

export function subscribeEnergyLogs(onChange: ChangeHandler) {
  const sb = createSupabaseBrowser();
  const channel = sb
    .channel("realtime:energy_logs")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "energy_logs" },
      (payload) => {
        onChange({ table: "energy_logs", event: "INSERT", record: (payload as any).new });
      }
    )
    .subscribe();

  return () => { try { sb.removeChannel(channel); } catch {} };
}
