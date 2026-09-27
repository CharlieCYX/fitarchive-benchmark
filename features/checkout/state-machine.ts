/**
 * Demo Checkout state machine (§10.3, ASSUMPTIONS A4): a simulated payment
 * flow — no real payment credentials anywhere. States:
 *
 *   created → pending → paid | failed
 *
 * created:  server action validated the product and built order+items.
 * pending:  order + payment (status 'initiated') rows written; item reserved.
 * paid:     payment 'simulated', order 'paid' (+paid_at), item sold.
 * failed:   payment 'failed', order 'cancelled', item released to available.
 *
 * Pure module — unit-tested in tests/unit/checkout-state.test.ts. The DB
 * wiring lives in features/checkout/service.ts.
 */

export type DemoCheckoutState = "created" | "pending" | "paid" | "failed";

const TRANSITIONS: Record<DemoCheckoutState, readonly DemoCheckoutState[]> = {
  created: ["pending"],
  pending: ["paid", "failed"],
  paid: [],
  failed: [],
};

export function canTransitionCheckout(
  from: DemoCheckoutState,
  to: DemoCheckoutState,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Human-readable reason a transition is blocked, or null when allowed. */
export function checkoutTransitionError(
  from: DemoCheckoutState,
  to: DemoCheckoutState,
): string | null {
  if (from === to) return `Checkout is already ${from}.`;
  if (canTransitionCheckout(from, to)) return null;
  if (from === "paid" || from === "failed") {
    return `${from} is terminal — demo checkouts cannot be reopened.`;
  }
  return `Cannot move from ${from} to ${to}. Allowed: ${
    TRANSITIONS[from].join(", ") || "none"
  }.`;
}

/** DB writes that must happen atomically-ish for a given transition. */
export interface CheckoutWrites {
  orderStatus: "pending" | "paid" | "cancelled";
  paymentStatus: "initiated" | "simulated" | "failed";
  productAvailability: "reserved" | "available" | "sold";
  setPaidAt: boolean;
}

export function checkoutTransitionWrites(
  from: DemoCheckoutState,
  to: DemoCheckoutState,
): CheckoutWrites | null {
  if (!canTransitionCheckout(from, to)) return null;
  switch (`${from}->${to}`) {
    case "created->pending":
      return {
        orderStatus: "pending",
        paymentStatus: "initiated",
        productAvailability: "reserved",
        setPaidAt: false,
      };
    case "pending->paid":
      return {
        orderStatus: "paid",
        paymentStatus: "simulated",
        productAvailability: "sold",
        setPaidAt: true,
      };
    case "pending->failed":
      return {
        orderStatus: "cancelled",
        paymentStatus: "failed",
        productAvailability: "available",
        setPaidAt: false,
      };
    default:
      return null;
  }
}

/** Map a persisted order status back onto the demo checkout states. */
export function checkoutStateFromOrderStatus(
  status: string,
): DemoCheckoutState | null {
  switch (status) {
    case "pending":
      return "pending";
    case "paid":
      return "paid";
    case "cancelled":
      return "failed";
    default:
      return null; // fulfilled/refunded are outside the demo flow
  }
}

/** Demo order numbers are unmistakably demo: `FA-DEMO-<base36 time>-<rand>`. */
export function buildDemoOrderNo(now: number = Date.now()): string {
  const rand = Math.floor(Math.random() * 36 ** 3)
    .toString(36)
    .padStart(3, "0");
  return `FA-DEMO-${now.toString(36).toUpperCase()}-${rand.toUpperCase()}`;
}
