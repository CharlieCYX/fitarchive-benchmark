import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordEvent } from "@/features/analytics/service";
import {
  buildDemoOrderNo,
  checkoutStateFromOrderStatus,
  checkoutTransitionError,
  checkoutTransitionWrites,
  type DemoCheckoutState,
} from "./state-machine";

/**
 * Demo Checkout service (§10.3, ADR-004) — server-only, service-role client.
 * Simulated payments only: `payments.provider='simulated'`, `mode='demo'`.
 * No real payment credentials exist anywhere in this flow.
 */

export interface CheckoutIdentity {
  anonId: string;
  profileId: string | null;
  userAgent: string | null;
}

export interface BuyerContact {
  name: string | null;
  email: string | null;
}

export type CheckoutResult =
  | { ok: true; orderId: string; orderNo: string }
  | { ok: false; error: string };

const SELLOUT_STATES = ["owned", "permission_consignment"];

/** Start a demo checkout: creates order + items + initiated payment, reserves the item. */
export async function startDemoCheckout(
  supabase: SupabaseClient,
  orgId: string,
  productId: string,
  buyer: BuyerContact,
  identity: CheckoutIdentity,
): Promise<CheckoutResult> {
  const { data: product } = await supabase
    .from("products")
    .select(
      "id, title, availability, public_price_sgd, published_at, ownership_records(state, effective_from)",
    )
    .eq("id", productId)
    .maybeSingle();
  if (!product || !product.published_at) {
    return { ok: false, error: "This piece is not available for checkout." };
  }
  if (product.availability !== "available") {
    return {
      ok: false,
      error: `This piece is currently ${product.availability} — it cannot be checked out.`,
    };
  }

  const ownershipRows = (product.ownership_records ?? []) as Array<{
    state: string;
    effective_from: string;
  }>;
  const currentOwnership = [...ownershipRows].sort((a, b) =>
    b.effective_from.localeCompare(a.effective_from),
  )[0]?.state;
  if (!currentOwnership || !SELLOUT_STATES.includes(currentOwnership)) {
    return {
      ok: false,
      error:
        "This piece is not sold by FitArchive (referral / not-for-sale) — use the listed purchase route instead.",
    };
  }
  const price = Number(product.public_price_sgd);
  if (!Number.isFinite(price) || price < 0) {
    return { ok: false, error: "This piece has no valid public price." };
  }

  const writes = checkoutTransitionWrites("created", "pending")!;
  const orderNo = buildDemoOrderNo();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      org_id: orgId,
      order_no: orderNo,
      mode: "demo",
      status: writes.orderStatus,
      buyer_profile_id: identity.profileId,
      buyer_contact: { name: buyer.name, email: buyer.email },
      subtotal_sgd: price,
      shipping_charge_sgd: 0,
      total_sgd: price,
    })
    .select("id")
    .single();
  if (orderError || !order) {
    return { ok: false, error: orderError?.message ?? "Order creation failed." };
  }
  const orderId = order.id as string;

  const { error: itemError } = await supabase.from("order_items").insert({
    order_id: orderId,
    product_id: productId,
    unit_price_sgd: price,
    quantity: 1,
  });
  if (itemError) return { ok: false, error: itemError.message };

  const { error: paymentError } = await supabase.from("payments").insert({
    order_id: orderId,
    mode: "demo",
    provider: "simulated",
    status: writes.paymentStatus,
    amount_sgd: price,
    provider_reference: `sim-${orderNo}`,
    state_log: [
      { from: "created", to: "pending", at: new Date().toISOString(), mode: "demo" },
    ],
  });
  if (paymentError) return { ok: false, error: paymentError.message };

  const { error: reserveError } = await supabase
    .from("products")
    .update({ availability: writes.productAvailability })
    .eq("id", productId);
  if (reserveError) return { ok: false, error: reserveError.message };

  // checkout_start event (dictionary: { order_id }). Best-effort: a failed
  // event write must not break checkout.
  await recordEvent(
    supabase,
    orgId,
    {
      event_name: "checkout_start",
      client_event_id: crypto.randomUUID(),
      occurred_at: null,
      route: null,
      referrer: null,
      properties: { order_id: orderId },
    },
    identity,
  ).catch(() => undefined);

  return { ok: true, orderId, orderNo };
}

export interface DemoOrderView {
  id: string;
  orderNo: string;
  status: string;
  totalSgd: number;
  placedAt: string;
  paidAt: string | null;
  items: Array<{ productId: string; title: string; unitPriceSgd: number }>;
  payment: {
    status: string;
    provider: string;
    stateLog: Array<Record<string, unknown>>;
  } | null;
}

/** Load a demo order for the checkout page (service role; id is the bearer). */
export async function loadDemoOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<DemoOrderView | null> {
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_no, mode, status, total_sgd, placed_at, paid_at, order_items(product_id, unit_price_sgd, products(title)), payments(status, provider, state_log)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.mode !== "demo") return null;
  const row = order as Record<string, unknown>;
  const items = ((row.order_items ?? []) as Array<Record<string, unknown>>).map(
    (i) => ({
      productId: i.product_id as string,
      title:
        ((i.products as { title?: string } | null)?.title as string) ?? "Item",
      unitPriceSgd: Number(i.unit_price_sgd),
    }),
  );
  const payment =
    ((row.payments ?? []) as Array<Record<string, unknown>>)[0] ?? null;
  return {
    id: row.id as string,
    orderNo: row.order_no as string,
    status: row.status as string,
    totalSgd: Number(row.total_sgd),
    placedAt: row.placed_at as string,
    paidAt: (row.paid_at as string | null) ?? null,
    items,
    payment: payment
      ? {
          status: payment.status as string,
          provider: payment.provider as string,
          stateLog: (payment.state_log ?? []) as Array<Record<string, unknown>>,
        }
      : null,
  };
}

export type ResolveResult = { ok: true; state: DemoCheckoutState } | { ok: false; error: string };

/** Resolve a pending demo checkout: simulated success or failure. */
export async function resolveDemoCheckout(
  supabase: SupabaseClient,
  orgId: string,
  orderId: string,
  outcome: "pay" | "fail",
  identity: CheckoutIdentity,
): Promise<ResolveResult> {
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, mode, total_sgd, order_items(product_id)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.mode !== "demo") {
    return { ok: false, error: "Demo order not found." };
  }

  const from = checkoutStateFromOrderStatus(order.status as string);
  if (!from) {
    return { ok: false, error: "This order is outside the demo checkout flow." };
  }
  const to: DemoCheckoutState = outcome === "pay" ? "paid" : "failed";
  const problem = checkoutTransitionError(from, to);
  if (problem) return { ok: false, error: problem };
  const writes = checkoutTransitionWrites(from, to)!;

  const now = new Date().toISOString();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, state_log")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (payment) {
    const log = [
      ...((payment.state_log ?? []) as Array<Record<string, unknown>>),
      { from, to, at: now, mode: "demo" },
    ];
    await supabase
      .from("payments")
      .update({ status: writes.paymentStatus, state_log: log })
      .eq("id", payment.id as string);
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({
      status: writes.orderStatus,
      ...(writes.setPaidAt ? { paid_at: now } : {}),
    })
    .eq("id", orderId);
  if (orderError) return { ok: false, error: orderError.message };

  const productIds = ((order.order_items ?? []) as Array<{ product_id: string }>).map(
    (i) => i.product_id,
  );
  if (productIds.length > 0) {
    await supabase
      .from("products")
      .update({ availability: writes.productAvailability })
      .in("id", productIds);
  }

  if (to === "paid") {
    // order_complete event (dictionary: { order_id, revenue_sgd }).
    await recordEvent(
      supabase,
      orgId,
      {
        event_name: "order_complete",
        client_event_id: crypto.randomUUID(),
        occurred_at: null,
        route: null,
        referrer: null,
        properties: { order_id: orderId, revenue_sgd: Number(order.total_sgd) },
      },
      identity,
    ).catch(() => undefined);
  }

  return { ok: true, state: to };
}
