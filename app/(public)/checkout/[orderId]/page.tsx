import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getServiceRoleClient } from "@/lib/db/admin";
import { loadDemoOrder } from "@/features/checkout/service";
import { ConnectSupabaseNotice } from "@/components/editorial/connect-supabase";
import { Badge } from "@/components/ui/badge";
import { formatSgd, formatDate } from "@/lib/utils";
import { CheckoutActions } from "./checkout-actions";

export const metadata: Metadata = { title: "Demo checkout" };

/**
 * /checkout/[orderId] — demo checkout (§10.3, ASSUMPTIONS A4). Simulated
 * payment state machine (created → pending → paid | failed); no real payment
 * credentials exist anywhere in this flow. The order id in the URL is the
 * bearer reference for the demo (see KNOWN_LIMITATIONS).
 */
export default async function DemoCheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!isSupabaseConfigured()) {
    return <ConnectSupabaseNotice section="Demo checkout" />;
  }

  const supabase = getServiceRoleClient();
  const order = await loadDemoOrder(supabase, orderId);
  if (!order) notFound();

  const pending = order.status === "pending";
  const paid = order.status === "paid";

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center gap-3">
        <h1 className="font-display text-3xl text-ink">Checkout</h1>
        <Badge tone="accent">DEMO — simulated payment</Badge>
      </div>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-warm-700">
        This is the FitArchive demo checkout: a simulated payment state machine
        (§10.3). No card details are requested, no real charge is made, and no
        real payment provider is contacted.
      </p>

      <div className="mt-8 rounded-lg border border-warm-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-warm-500">Order {order.orderNo}</p>
          <Badge
            tone={paid ? "success" : pending ? "warning" : "neutral"}
          >
            {order.status}
          </Badge>
        </div>
        <ul className="mt-4 divide-y divide-warm-200">
          {order.items.map((item) => (
            <li
              key={item.productId}
              className="flex items-baseline justify-between py-3 text-sm"
            >
              <span className="text-ink">{item.title}</span>
              <span className="text-ink">{formatSgd(item.unitPriceSgd)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t border-warm-200 pt-4">
          <span className="text-sm text-warm-700">Total (SGD)</span>
          <span className="font-display text-xl text-ink">
            {formatSgd(order.totalSgd)}
          </span>
        </div>

        {pending ? <CheckoutActions orderId={order.id} /> : null}
        {paid ? (
          <p className="mt-6 rounded-md border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
            Simulated payment recorded — order marked paid on{" "}
            {formatDate(order.paidAt)}. The piece is now sold and an{" "}
            <code>order_complete</code> event was written to the first-party
            event stream.
          </p>
        ) : null}
        {order.status === "cancelled" ? (
          <p className="mt-6 rounded-md border border-warm-300 bg-warm-100/50 px-4 py-3 text-sm text-warm-700">
            The simulated payment failed — the order is cancelled and the piece
            has been released back to available.
          </p>
        ) : null}

        {order.payment ? (
          <details className="mt-6 text-xs text-warm-500">
            <summary className="cursor-pointer hover:text-ink">
              Payment record ({order.payment.provider}, {order.payment.status}) —
              state log
            </summary>
            <ol className="mt-2 space-y-1">
              {order.payment.stateLog.map((entry, i) => (
                <li key={i}>
                  {String(entry.from)} → {String(entry.to)} ·{" "}
                  {formatDate(typeof entry.at === "string" ? entry.at : null)}
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </div>

      <p className="mt-6 text-sm">
        <Link href="/drops" className="text-accent hover:text-accent-strong">
          ← Back to the drop archive
        </Link>
      </p>
    </div>
  );
}
