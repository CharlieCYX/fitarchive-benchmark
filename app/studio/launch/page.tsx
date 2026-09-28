import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Launch Control" };

/**
 * /studio/launch — Launch Control (§7.7) is DEFERRED, not shipped. The
 * publish path it would orchestrate exists elsewhere: per-product publishing
 * in Catalog (setProductPublication) and the drop publish gate in Drops.
 * This page says so plainly instead of pretending a Phase 3 ETA.
 */
export default function StudioLaunchPage() {
  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">Launch Control</h1>
        <Badge tone="warning">Deferred</Badge>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wide text-warm-500">
        Build Bible §7.7
      </p>
      <EmptyState
        className="mt-8"
        title="Launch Control is deliberately not built in V1"
        description="The spec's unified publish gate / live traffic / incident / rollback console is deferred — the underlying operations are real and live in other modules: per-product publish in Catalog, the evidence-gated drop publish checklist in Drops, and metric monitoring in Analytics. Consolidating them here is a post-V1 decision; see docs/KNOWN_LIMITATIONS.md."
        action={
          <div className="flex justify-center gap-4 text-sm">
            <Link href="/studio/catalog" className="text-accent hover:text-accent-strong">
              Catalog →
            </Link>
            <Link href="/studio/drops" className="text-accent hover:text-accent-strong">
              Drops →
            </Link>
            <Link href="/studio/analytics" className="text-accent hover:text-accent-strong">
              Analytics →
            </Link>
          </div>
        }
      />
    </div>
  );
}
