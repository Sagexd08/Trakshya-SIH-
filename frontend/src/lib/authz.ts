import { createSupabaseAdmin } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";

export type Role = "admin" | "controller" | "analyst";

export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { userId } = auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserRole(): Promise<Role | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  try {
    const sb = createSupabaseAdmin();
    const { data, error } = await sb.from("profiles").select("role").eq("clerk_id", userId).maybeSingle();
    if (error) throw error;
    const role = data?.role as Role | undefined;
    if (!role) return null;
    if (role === "admin" || role === "controller" || role === "analyst") return role;
    return null;
  } catch {
    return null;
  }
}

export function hasRole(role: Role | null, allowed: Role[]): boolean {
  return !!role && allowed.includes(role);
}

