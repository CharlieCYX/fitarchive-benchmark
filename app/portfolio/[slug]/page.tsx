import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Case study" };

/**
 * /portfolio/[slug] — public case study (§21). Phase 1: no snapshots exist
 * yet, and rule §6.4(8) forbids reading live tables — so this is an honest
 * placeholder until frozen portfolio_snapshots ship in Phase 9.
 */
export default async function PortfolioCaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">Portfolio case study</h1>
        <Badge tone="accent">Planned — Phase 9</Badge>
      </div>
      <EmptyState
        className="mt-8"
        title={`No published case study at “${slug}” yet`}
        description="Portfolio case studies are rendered from frozen snapshots so later edits never rewrite published evidence. The snapshot machinery ships in Phase 9; until then no case study is live."
      />
      <p className="mt-6 text-xs text-warm-500">
        <Link href="/" className="hover:text-ink">← Back to FitArchive</Link>
      </p>
    </div>
  );
}
