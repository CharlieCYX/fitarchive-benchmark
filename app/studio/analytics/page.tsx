import type { Metadata } from "next";
import { getServerClient } from "@/lib/db/server";
import { getOrgId } from "@/lib/db/org";
import {
  getAssortmentPerformance,
  getChannelBreakdown,
  getCreativePerformance,
  getDataQuality,
  getDropOverview,
  getResearchVsReality,
  listSnapshots,
} from "@/features/analytics/metric-service";
import { listDropOptions, listInsights, listOwnerOptions } from "@/features/analytics/insights";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";
import { DecisionCards, SnapshotPanel } from "./_components/decision-cards";
import {
  AssortmentPanels,
  ChannelPanel,
  CreativePanel,
  DataQualityPanel,
  DropOverviewStats,
  GmvTrend,
  ResearchRealityPanel,
  SellThroughPanel,
  TimeToSalePanel,
} from "./_components/panels";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-10 border-t border-warm-200 pt-6">
      <h2 id={id} className="font-display text-xl text-ink">
        {title}
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-warm-700">{description}</p>
    </div>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Intelligence Dashboard"
        spec="§9.1 / §12.3"
        summary="Canonical metrics from first-party events — drop overview, assortment, creative, channel, research-vs-reality and data quality, all read from the SQL metric views. No hard-coded numbers."
      />
    );
  }

  const params = await searchParams;
  const orgId = await getOrgId(supabase);
  if (!orgId) {
    return (
      <UnconfiguredState
        title="Intelligence Dashboard"
        spec="§9.1 / §12.3"
        summary="No organization row found — run the migrations and seed first."
      />
    );
  }

  const [overview, assortment, creative, channels, research, dq, insights, drops, owners, snapshots] =
    await Promise.all([
      getDropOverview(supabase, orgId),
      getAssortmentPerformance(supabase, orgId),
      getCreativePerformance(supabase, orgId),
      getChannelBreakdown(supabase, orgId),
      getResearchVsReality(supabase, orgId),
      getDataQuality(supabase, orgId),
      listInsights(supabase, orgId),
      listDropOptions(supabase),
      listOwnerOptions(supabase),
      listSnapshots(supabase),
    ]);

  const decisions = insights.filter((i) => i.title.startsWith("Decision — "));

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl text-ink">Intelligence Dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        Every number below comes from the canonical SQL metric views
        (EVENTS_AND_METRICS.md §2) — never recomputed in the UI, never
        hard-coded. Every chart states its sample size and offers a data-table
        alternative.
      </p>

      <div className="mt-4">
        <MessageBanner searchParams={params} />
      </div>

      <nav aria-label="Dashboard sections" className="mt-4 flex flex-wrap gap-2 text-xs">
        {[
          ["drop-overview", "Drop overview"],
          ["assortment", "Assortment"],
          ["creative", "Creative"],
          ["channel", "Channel"],
          ["research-vs-reality", "Research vs reality"],
          ["data-quality", "Data quality"],
          ["decisions", "Decisions"],
          ["snapshots", "Snapshots"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-sm border border-warm-300 px-2 py-1 text-warm-700 hover:border-ink hover:text-ink"
          >
            {label}
          </a>
        ))}
      </nav>

      <SectionHeading
        id="drop-overview"
        title="Drop overview"
        description="GMV, units, sell-through, views, saves, inquiries, conversion (both denominators labeled) and median time-to-sell."
      />
      <div className="mt-4 space-y-4">
        <DropOverviewStats data={overview} />
        <div className="grid gap-4 lg:grid-cols-2">
          <GmvTrend data={overview} />
          <SellThroughPanel data={overview} />
        </div>
        <TimeToSalePanel data={overview} />
      </div>

      <SectionHeading
        id="assortment"
        title="Assortment"
        description="Category, price-band, aesthetic, color and material performance. Sample counts sit beside every number."
      />
      <div className="mt-4">
        <AssortmentPanels data={assortment} />
      </div>

      <SectionHeading
        id="creative"
        title="Creative"
        description="Tracked-link click performance per campaign link."
      />
      <div className="mt-4">
        <CreativePanel rows={creative} />
      </div>

      <SectionHeading
        id="channel"
        title="Channel"
        description="Direct, social, referral and other/manual traffic from UTM and tracked-link attribution."
      />
      <div className="mt-4">
        <ChannelPanel data={channels} />
      </div>

      <SectionHeading
        id="research-vs-reality"
        title="Research vs reality"
        description="Marketplace observation distributions next to internal engagement — two populations, read side by side."
      />
      <div className="mt-4">
        <ResearchRealityPanel rows={research} />
      </div>

      <SectionHeading
        id="data-quality"
        title="Data quality"
        description="Missingness, event volume by type, duplicate source records and stale permissions."
      />
      <div className="mt-4">
        <DataQualityPanel data={dq} />
      </div>

      <SectionHeading
        id="decisions"
        title="Decision cards"
        description="Attach a written decision with owner, date and confidence to any chart above."
      />
      <div className="mt-4">
        <DecisionCards decisions={decisions} drops={drops} owners={owners} />
      </div>

      <SectionHeading
        id="snapshots"
        title="Dashboard snapshots"
        description="Freeze current metric values into metric_snapshots for portfolio versioning."
      />
      <div className="mt-4 mb-10">
        <SnapshotPanel snapshots={snapshots} />
      </div>
    </div>
  );
}
