import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getServerClient } from "@/lib/db/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessSellerPortal, ROLE_LABELS } from "@/lib/auth/roles";
import { getSellerPortalData } from "@/features/sellers/portal";
import { PERMISSION_STATE_LABELS } from "@/features/sellers/permissions";
import type { PermissionState } from "@/features/sellers/permissions";
import { formatDate, formatSgd } from "@/lib/utils";

export const metadata: Metadata = { title: "Seller Portal" };
export const dynamic = "force-dynamic";

const AVAILABILITY_LABELS: Record<string, string> = {
  draft: "Draft",
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  withdrawn: "Withdrawn",
};

/**
 * /seller — seller portal (route map §23.1). Sellers sign in to see their
 * OWN items, permission states and settlement history — read-only in V1;
 * scoping is enforced by RLS (sellers_self_read / *_seller_read), and the
 * server-side role guard below is the second layer. Owner can inspect.
 */
export default async function SellerPortalPage() {
  if (!isSupabaseConfigured()) {
    return (
      <Shell title="Seller Portal">
        <EmptyState
          className="mt-8"
          title="Connect Supabase to activate the seller portal"
          description="Sellers sign in to see their own items, permission states and settlement history — own records only, enforced by row-level security. Set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY and apply the migrations to go live."
        />
      </Shell>
    );
  }

  const user = await getSessionUser();
  if (!user) {
    return (
      <Shell title="Seller Portal">
        <EmptyState
          className="mt-8"
          title="Sign in with your seller account"
          description="The portal shows your own items, permission states and settlements — nothing else. Access is limited to seller accounts."
          action={
            <Link href="/login" className="text-sm text-accent hover:text-accent-strong">
              Sign in →
            </Link>
          }
        />
      </Shell>
    );
  }

  if (!canAccessSellerPortal(user.role)) {
    return (
      <Shell title="Seller Portal">
        <EmptyState
          className="mt-8"
          title="Seller accounts only"
          description={`You are signed in as ${ROLE_LABELS[user.role]}. The seller portal is limited to seller accounts (the operator can inspect from Studio).`}
        />
      </Shell>
    );
  }

  const supabase = await getServerClient();
  const data = supabase ? await getSellerPortalData(supabase, user.id) : null;
  if (!data) {
    return (
      <Shell title="Seller Portal">
        <EmptyState
          className="mt-8"
          title="No seller record is linked to this account"
          description="Your sign-in works, but no seller profile points at it yet. The operator links seller records to accounts from Studio → Sellers."
        />
      </Shell>
    );
  }

  return (
    <Shell title="Seller Portal">
      <p className="mt-2 text-sm text-warm-700">
        Signed in as <span className="font-medium text-ink">{data.seller.display_name}</span>{" "}
        (@{data.seller.handle}) · <Badge tone={data.seller.status === "active" ? "success" : "neutral"}>{data.seller.status}</Badge>
      </p>
      <p className="mt-1 text-xs text-warm-500">
        Read-only in V1 — items, permissions and settlements are managed by
        the operator; contact the studio to change anything.
      </p>

      {/* Items */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">Your items ({data.items.length})</h2>
        {data.items.length === 0 ? (
          <p className="mt-3 text-sm text-warm-700">
            No items are linked to your seller record yet.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200 text-left text-xs uppercase tracking-wide text-warm-500">
                <th className="py-2 pr-4 font-normal">Item</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 font-normal">Listed price</th>
                <th className="py-2 font-normal">Published</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-warm-200 last:border-0">
                  <td className="py-2 pr-4">
                    <span className="text-ink">{item.title}</span>{" "}
                    <span className="text-xs text-warm-500">{item.sku}</span>
                  </td>
                  <td className="py-2 pr-4 text-warm-700">
                    {AVAILABILITY_LABELS[item.availability] ?? item.availability}
                  </td>
                  <td className="py-2 pr-4 text-warm-700">{formatSgd(item.public_price_sgd)}</td>
                  <td className="py-2 text-warm-700">{formatDate(item.published_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Permission states */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">
          Permissions ({data.permissions.length})
        </h2>
        {data.permissions.length === 0 ? (
          <p className="mt-3 text-sm text-warm-700">
            No permission records yet — the operator logs every permission
            decision here.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200 text-left text-xs uppercase tracking-wide text-warm-500">
                <th className="py-2 pr-4 font-normal">Scope</th>
                <th className="py-2 pr-4 font-normal">Item</th>
                <th className="py-2 pr-4 font-normal">State</th>
                <th className="py-2 pr-4 font-normal">Granted</th>
                <th className="py-2 font-normal">Expires / revoked</th>
              </tr>
            </thead>
            <tbody>
              {data.permissions.map((p) => (
                <tr key={p.id} className="border-b border-warm-200 last:border-0">
                  <td className="py-2 pr-4 text-ink">{p.scope}</td>
                  <td className="py-2 pr-4 text-warm-700">
                    {p.product_title ?? "All your items"}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge tone={p.state === "expired_revoked" ? "danger" : "info"}>
                      {PERMISSION_STATE_LABELS[p.state as PermissionState] ?? p.state}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4 text-warm-700">{formatDate(p.granted_at)}</td>
                  <td className="py-2 text-warm-700">
                    {p.revoked_at
                      ? `Revoked ${formatDate(p.revoked_at)}`
                      : formatDate(p.expires_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Settlements */}
      <section className="mt-10">
        <h2 className="font-display text-xl text-ink">
          Settlements ({data.settlements.length})
        </h2>
        {data.settlements.length === 0 ? (
          <p className="mt-3 text-sm text-warm-700">
            No settlements yet — a settlement row appears here for each sale
            period the operator closes.
          </p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200 text-left text-xs uppercase tracking-wide text-warm-500">
                <th className="py-2 pr-4 font-normal">Period</th>
                <th className="py-2 pr-4 font-normal">Gross sale</th>
                <th className="py-2 pr-4 font-normal">Your payout</th>
                <th className="py-2 pr-4 font-normal">Platform fees</th>
                <th className="py-2 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.settlements.map((s) => (
                <tr key={s.id} className="border-b border-warm-200 last:border-0">
                  <td className="py-2 pr-4 text-warm-700">
                    {formatDate(s.period_start)} – {formatDate(s.period_end)}
                  </td>
                  <td className="py-2 pr-4 text-warm-700">{formatSgd(s.gross_sale_sgd)}</td>
                  <td className="py-2 pr-4 text-ink">{formatSgd(s.seller_base_sgd)}</td>
                  <td className="py-2 pr-4 text-warm-700">{formatSgd(s.platform_fees_sgd)}</td>
                  <td className="py-2">
                    <Badge tone={s.status === "paid" ? "success" : "warning"}>
                      {s.status === "paid" && s.paid_at
                        ? `Paid ${formatDate(s.paid_at)}`
                        : s.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      {children}
      <p className="mt-10 text-xs text-warm-500">
        <Link href="/" className="hover:text-ink">← Back to FitArchive</Link>
      </p>
    </div>
  );
}
