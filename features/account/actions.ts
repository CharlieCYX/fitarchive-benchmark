"use server";

import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Account / privacy server actions for /settings (§15.2). Everything runs on
 * the cookie-bound client: RLS guarantees the signed-in user can only ever
 * read or write their own rows.
 */

export type AccountActionStatus =
  | { status: "ok" }
  | { status: "auth_required" }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

/**
 * Export my data (§15.2): profile, favorites, closet, orders, style sessions
 * and data-rights requests as one JSON document. RLS scopes every table to
 * the caller; the payload is assembled server-side and returned for the
 * browser to save as a file.
 */
export async function exportMyData(): Promise<
  | { status: "ok"; filename: string; data: Record<string, unknown> }
  | Exclude<AccountActionStatus, { status: "ok" }>
> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const user = await getSessionUser();
  if (!user) return { status: "auth_required" };
  const supabase = await getServerClient();
  if (!supabase) return { status: "unconfigured" };

  const [profile, favorites, closet, orders, styleSessions, requests] =
    await Promise.all([
      supabase.from("profiles").select("id, role, display_name, locale, created_at").eq("id", user.id).maybeSingle(),
      supabase.from("favorites").select("product_id, created_at").eq("profile_id", user.id),
      supabase.from("closet_items").select("id, title, color, fit_notes, wear_frequency, ownership_source, created_at").eq("profile_id", user.id),
      supabase.from("orders").select("id, order_no, mode, status, subtotal_sgd, shipping_charge_sgd, total_sgd, placed_at, paid_at").eq("buyer_profile_id", user.id),
      supabase.from("style_sessions").select("id, mode, created_at").eq("profile_id", user.id),
      supabase.from("data_rights_requests").select("id, kind, note, status, created_at").eq("profile_id", user.id),
    ]);

  return {
    status: "ok",
    filename: `fitarchive-my-data-${new Date().toISOString().slice(0, 10)}.json`,
    data: {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      profile: profile.data ?? null,
      favorites: favorites.data ?? [],
      closet_items: closet.data ?? [],
      orders: orders.data ?? [],
      style_sessions: styleSessions.data ?? [],
      data_rights_requests: requests.data ?? [],
    },
  };
}

/**
 * File a data-rights request (§15.2): 'export' or 'delete'. Stored in
 * public.data_rights_requests (0021); the operator processes pending
 * requests. Self-service insert only — the row is bound to auth.uid().
 */
export async function requestDataRight(
  kind: "export" | "delete",
  note: string,
): Promise<AccountActionStatus> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const user = await getSessionUser();
  if (!user) return { status: "auth_required" };
  const supabase = await getServerClient();
  if (!supabase) return { status: "unconfigured" };

  const trimmed = note.trim().slice(0, 1000);
  const { error } = await supabase.from("data_rights_requests").insert({
    profile_id: user.id,
    kind,
    note: trimmed === "" ? null : trimmed,
  });
  if (error) return { status: "error", message: error.message };
  return { status: "ok" };
}
