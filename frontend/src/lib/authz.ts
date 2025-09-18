import { createSupabaseAdmin } from "@/lib/supabase/server";

export type Role = "admin" | "controller" | "analyst";

// Check if Clerk is configured
const hasClerk = !!process.env.CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;

export async function getCurrentUserId(): Promise<string | null> {
  if (!hasClerk) {
    // Return mock user for development
    return 'dev-user';
  }

  try {
    const { auth } = await import('@clerk/nextjs/server');
    const { userId } = await auth();
    return userId ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentUserRole(): Promise<Role | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  if (!hasClerk || userId === 'dev-user') {
    // Return mock role for development
    return 'admin';
  }

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

