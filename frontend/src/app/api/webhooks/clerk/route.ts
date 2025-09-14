import { NextRequest } from "next/server";
import { Webhook } from "svix";
import { createSupabaseAdmin } from "@/lib/supabase/server";

function normalizeRole(input: unknown): "admin" | "controller" | "analyst" {
  const v = String(input ?? "controller").toLowerCase();
  if (v === "admin" || v === "controller" || v === "analyst") return v;
  return "controller";
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET || "";
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  const body = await req.text();

  // If secret is missing (local dev), accept payload without verification
  let evt: any;
  try {
    if (secret && svixId && svixTimestamp && svixSignature) {
      const wh = new Webhook(secret);
      evt = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } else {
      evt = JSON.parse(body || "{}");
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  const type: string = evt?.type || "";
  const user = evt?.data || {};

  if (!user?.id) {
    return new Response(JSON.stringify({ status: "ignored", reason: "no user id" }), { status: 200, headers: { "content-type": "application/json" } });
  }

  // Extract email
  let email: string | null = null;
  try {
    const emails: Array<any> = Array.isArray(user.email_addresses) ? user.email_addresses : [];
    const primaryId: string | undefined = user.primary_email_address_id;
    email = (emails.find((e) => e.id === primaryId)?.email_address || emails[0]?.email_address || null) ?? null;
  } catch { email = null; }

  // Extract role from metadata (public takes precedence for prototype)
  const roleVal = user?.public_metadata?.role ?? user?.private_metadata?.role ?? "controller";
  const role = normalizeRole(roleVal);

  // Upsert into Supabase profiles
  try {
    const sb = createSupabaseAdmin();
    const { error } = await sb.from("profiles").upsert({
      clerk_id: String(user.id),
      email: email ?? undefined,
      role,
    }, { onConflict: "clerk_id" });
    if (error) throw error;
  } catch (e) {
    // Do not fail the webhook for DB issues in prototype
    return new Response(JSON.stringify({ status: "ok", type, upsert: "skipped", reason: (e as Error)?.message || String(e) }), { status: 200, headers: { "content-type": "application/json" } });
  }

  return new Response(JSON.stringify({ status: "ok", type, role }), { status: 200, headers: { "content-type": "application/json" } });
}

