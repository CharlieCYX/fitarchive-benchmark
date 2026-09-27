import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/charts/stat-card";
import { getServerClient } from "@/lib/db/server";
import { getCommandCenterSummary } from "@/features/studio/summary";
import { formatDate } from "@/lib/utils";
import { UnconfiguredState } from "./_components/unconfigured";

export const dynamic = "force-dynamic";

/**
 * Command Center (§7.1) — live counts from real queries; every card
 * deep-links to the records behind the number. Sell-through comes from the
 * canonical v_sell_through view (ADR-008). Nothing here is hard-coded.
 */
export default async function StudioPage() {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Command Center"
        spec="§7.1"
        summary="Drop status and sell-through, permissions awaiting action, missing data, assets awaiting approval, running experiments, latest insights, failed jobs — all live counts once connected."
      />
    );
  }

  const summary = await getCommandCenterSummary(supabase);
  const isEmpty =
    !summary.currentDrop &&
    summary.permissionsAwaiting === 0 &&
    summary.productsMissingData === 0 &&
    summary.productsMissingImagery === 0 &&
    summary.assetsAwaitingApproval === 0 &&
    summary.runningExperiments === 0 &&
    summary.failedJobs === 0 &&
    summary.recentInsights.length === 0;

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Command Center</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        What needs operator attention right now. Every number is a live query;
        every card deep-links to the records behind it.
      </p>

      {isEmpty ? (
        <EmptyState
          className="mt-8"
          title="Nothing on the board yet"
          description="Start by capturing marketplace finds in the Research Inbox, then promote the best candidates to the Catalog and build a drop."
          action={
            <Link
              href="/studio/research"
              className="text-sm font-medium text-accent hover:text-accent-strong"
            >
              Capture your first listing →
            </Link>
          }
        />
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href={summary.currentDrop ? `/studio/drops/${summary.currentDrop.id}` : "/studio/drops"}>
            <StatCard
              label="Current drop"
              value={summary.currentDrop ? summary.currentDrop.name : null}
              note={
                summary.currentDrop
                  ? `${summary.currentDrop.status} · ${summary.currentDrop.itemCount} items${
                      summary.currentDrop.launch_at
                        ? ` · launches ${formatDate(summary.currentDrop.launch_at)}`
                        : ""
                    }${
                      summary.sellThrough !== null
                        ? ` · sell-through ${(summary.sellThrough * 100).toFixed(0)}%`
                        : ""
                    }`
                  : "No active drop — create one in Drop Builder."
              }
            />
          </Link>
          <Link href="/studio/sellers">
            <StatCard
              label="Permissions awaiting action"
              value={summary.permissionsAwaiting}
              note="Contacted sellers not yet granted or declined (§5.2)."
            />
          </Link>
          <Link href="/studio/catalog?missing=data">
            <StatCard
              label="Products missing data"
              value={summary.productsMissingData}
              note="Unsold products without condition grade or public description."
            />
          </Link>
          <Link href="/studio/catalog?missing=imagery">
            <StatCard
              label="Products missing imagery"
              value={summary.productsMissingImagery}
              note="Unsold products with no assets attached."
            />
          </Link>
          <Link href="/studio/campaigns">
            <StatCard
              label="Assets awaiting approval"
              value={summary.assetsAwaitingApproval}
              note="Draft campaign assets needing review (§7.6)."
            />
          </Link>
          <Link href="/studio/insights">
            <StatCard
              label="Running experiments"
              value={summary.runningExperiments}
              note="Experiments with status=running (§12.4)."
            />
          </Link>
          <Link href="/studio">
            <StatCard
              label="Failed jobs"
              value={summary.failedJobs}
              note={
                summary.failedJobList[0]
                  ? `Latest: ${summary.failedJobList[0].kind} — ${summary.failedJobList[0].last_error ?? "no error message"}`
                  : "Job queue healthy."
              }
            />
          </Link>
        </div>
      )}

      {summary.recentInsights.length > 0 ? (
        <>
          <h2 className="mt-12 font-display text-lg text-ink">Latest insights</h2>
          <div className="mt-4 space-y-2">
            {summary.recentInsights.map((insight) => (
              <Link key={insight.id} href="/studio/insights" className="block">
                <Card className="flex items-center justify-between py-3 transition-colors hover:border-warm-300">
                  <div className="flex items-center gap-3">
                    <Badge tone="info">{insight.type}</Badge>
                    <span className="text-sm text-ink">{insight.title}</span>
                  </div>
                  <span className="text-xs text-warm-500">
                    {formatDate(insight.created_at)}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <h2 className="mt-12 font-display text-lg text-ink">Quick add</h2>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <QuickLink href="/studio/research" label="Capture listing" />
        <QuickLink href="/studio/sellers" label="Add seller" />
        <QuickLink href="/studio/drops" label="New drop" />
        <QuickLink href="/studio/campaigns" label="New campaign" />
      </div>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-warm-300 px-4 py-2 text-ink transition-colors hover:border-ink"
    >
      + {label}
    </Link>
  );
}
