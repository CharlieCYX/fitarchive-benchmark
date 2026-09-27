import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Seller Portal" };

/**
 * /seller — seller portal (route map §23.1). Read-mostly: own items,
 * permissions, settlements (A7). Arrives with the seller tables in Phase 2.
 */
export default function SellerPortalPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">Seller Portal</h1>
        <Badge tone="accent">Planned — Phase 2</Badge>
      </div>
      <EmptyState
        className="mt-8"
        title="The seller portal ships with the seller CRM"
        description="Sellers will sign in to see their own items, permission states, agreements and settlement history — own records only, enforced by row-level security. The underlying seller and permission tables land in Phase 2."
        action={
          <Link href="/login" className="text-sm text-accent hover:text-accent-strong">
            Sign in →
          </Link>
        }
      />
      <p className="mt-6 text-xs text-warm-500">
        <Link href="/" className="hover:text-ink">← Back to FitArchive</Link>
      </p>
    </div>
  );
}
