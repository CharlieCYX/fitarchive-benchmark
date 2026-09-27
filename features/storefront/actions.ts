"use server";

import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getServiceRoleClient } from "@/lib/db/admin";
import { getOrgId } from "@/lib/db/org";
import { getSessionUser } from "@/lib/auth/session";
import { recordEvent, ANON_SESSION_COOKIE } from "@/features/analytics/service";
import {
  resolveDemoCheckout,
  startDemoCheckout,
} from "@/features/checkout/service";
import type { BuyerContact, CheckoutIdentity } from "@/features/checkout/service";

/**
 * Shopper server actions (§8.1). All return serializable results — the
 * client components render honest states (auth required / unconfigured /
 * error) instead of dead buttons.
 */

export type ActionStatus =
  | { status: "ok" }
  | { status: "auth_required" }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

/** Resolve the pseudonymous identity for server-side event writes. */
async function checkoutIdentity(profileId: string | null): Promise<CheckoutIdentity> {
  const jar = await cookies();
  const existing = jar.get(ANON_SESSION_COOKIE)?.value;
  const anonId = existing ?? crypto.randomUUID();
  if (!existing) {
    jar.set(ANON_SESSION_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return { anonId, profileId, userAgent: null };
}

/**
 * Save / unsave a product (favorites, §8.2). Requires login — anonymous
 * shoppers get `auth_required` so the UI can prompt sign-in honestly.
 */
export async function toggleFavorite(
  productId: string,
): Promise<ActionStatus & { saved?: boolean }> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const user = await getSessionUser();
  if (!user) return { status: "auth_required" };
  const supabase = await getServerClient();
  if (!supabase) return { status: "unconfigured" };

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("profile_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id as string);
    if (error) return { status: "error", message: error.message };
  } else {
    const { error } = await supabase
      .from("favorites")
      .insert({ profile_id: user.id, product_id: productId });
    if (error) return { status: "error", message: error.message };
  }

  // product_save / product_unsave events (best-effort, server identity).
  try {
    const service = getServiceRoleClient();
    const orgId = await getOrgId(service);
    if (orgId) {
      const identity = await checkoutIdentity(user.id);
      await recordEvent(
        service,
        orgId,
        {
          event_name: existing ? "product_unsave" : "product_save",
          client_event_id: crypto.randomUUID(),
          occurred_at: null,
          route: null,
          referrer: null,
          properties: existing
            ? { product_id: productId }
            : { product_id: productId, collection_id: null },
        },
        identity,
      );
    }
  } catch {
    // Event write failure must not break the save action.
  }

  return { status: "ok", saved: !existing };
}

export type CheckoutStartResult =
  | { status: "ok"; orderId: string }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

/** Begin demo checkout (§10.3): order + initiated payment, item reserved. */
export async function startDemoCheckoutAction(
  productId: string,
  buyer: BuyerContact,
): Promise<CheckoutStartResult> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  try {
    const supabase = getServiceRoleClient();
    const orgId = await getOrgId(supabase);
    if (!orgId) {
      return { status: "error", message: "No organization row found (run migrations + seed)." };
    }
    const user = await getSessionUser();
    const identity = await checkoutIdentity(user?.id ?? null);
    const result = await startDemoCheckout(
      supabase,
      orgId,
      productId,
      { name: buyer.name?.slice(0, 120) || null, email: buyer.email?.slice(0, 200) || null },
      identity,
    );
    if (!result.ok) return { status: "error", message: result.error };
    return { status: "ok", orderId: result.orderId };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Checkout failed.",
    };
  }
}

/** Resolve a pending demo checkout (simulated pay / fail). */
export async function resolveDemoCheckoutAction(
  orderId: string,
  outcome: "pay" | "fail",
): Promise<ActionStatus & { state?: string }> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  try {
    const supabase = getServiceRoleClient();
    const orgId = await getOrgId(supabase);
    if (!orgId) return { status: "error", message: "No organization row found." };
    const user = await getSessionUser();
    const identity = await checkoutIdentity(user?.id ?? null);
    const result = await resolveDemoCheckout(supabase, orgId, orderId, outcome, identity);
    if (!result.ok) return { status: "error", message: result.error };
    return { status: "ok", state: result.state };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Could not resolve checkout.",
    };
  }
}
