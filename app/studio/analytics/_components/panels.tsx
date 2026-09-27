import { StatCard } from "@/components/charts/stat-card";
import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { ChartFrame } from "@/components/charts/chart-frame";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatSgd, formatDate } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  formatCount,
  formatIntervalDays,
  formatRate,
  formatSampleSize,
  intervalToDays,
} from "@/lib/metrics/format";
import type {
  AssortmentBucket,
  AssortmentPerformance,
  ChannelBreakdown,
  CreativeRow,
  DataQualityReport,
  DropOverview,
  ResearchRealityRow,
} from "@/features/analytics/metric-service";

/** Chart names offered to decision cards (must match the panels below). */
export const DASHBOARD_CHART_REFS = [
  "Drop overview — GMV",
  "Drop overview — Sell-through",
  "Drop overview — Median time-to-sell",
  "Assortment — category",
  "Assortment — price band",
  "Assortment — aesthetic",
  "Assortment — color",
  "Assortment — material",
  "Creative — tracked links",
  "Channel — page views",
  "Research vs reality",
  "Data quality",
];

// ---------- Drop overview ----------

export function DropOverviewStats({ data }: { data: DropOverview }) {
  const pooledSellThrough =
    data.sellThrough.length > 0 &&
    data.sellThrough.reduce((a, r) => a + r.itemsOffered, 0) > 0
      ? data.sellThrough.reduce((a, r) => a + r.itemsSold, 0) /
        data.sellThrough.reduce((a, r) => a + r.itemsOffered, 0)
      : null;
  const offered = data.sellThrough.reduce((a, r) => a + r.itemsOffered, 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="GMV (topline, not profit)"
        value={data.totalGmvSgd !== null ? formatSgd(data.totalGmvSgd) : null}
        note={`v_gmv · ${formatSampleSize(data.orderCount)} orders`}
      />
      <StatCard
        label="Units sold"
        value={data.unitsSold > 0 ? formatCount(data.unitsSold) : null}
        note={`v_sell_through Σ items_sold · ${formatSampleSize(offered)} offered`}
      />
      <StatCard
        label="Sell-through (pooled)"
        value={pooledSellThrough !== null ? formatRate(pooledSellThrough) : null}
        note={`v_sell_through · drop-offered items only, ${formatSampleSize(offered)}`}
      />
      <StatCard
        label="Product views"
        value={data.productViews > 0 ? formatCount(data.productViews) : null}
        note={`v_save_rate / v_product_view_rate · ${formatSampleSize(data.impressions)} impressions`}
      />
      <StatCard
        label="Saves"
        value={data.saves > 0 ? formatCount(data.saves) : null}
        note="v_save_rate · identity basis: user or session"
      />
      <StatCard
        label="Inquiries"
        value={data.inquiries > 0 ? formatCount(data.inquiries) : null}
        note="v_inquiry_rate · inquiry_start events"
      />
      <StatCard
        label="Conversion / product view"
        value={data.conversion ? formatRate(data.conversion.perProductView) : null}
        note={
          data.conversion
            ? `v_purchase_conversion · denominator: product views (n = ${data.conversion.productViews})`
            : "v_purchase_conversion"
        }
      />
      <StatCard
        label="Conversion / session"
        value={data.conversion ? formatRate(data.conversion.perSession) : null}
        note={
          data.conversion
            ? `v_purchase_conversion · denominator: sessions (n = ${data.conversion.viewingSessions})`
            : "v_purchase_conversion"
        }
      />
    </div>
  );
}

export function GmvTrend({ data }: { data: DropOverview }) {
  const rows = data.gmvByDay.map((p) => ({
    label: p.day,
    display: formatSgd(p.gmvSgd),
  }));
  return (
    <ChartFrame
      title="GMV by day"
      description="Paid/fulfilled orders only (v_gmv). Topline revenue — never read as profit."
      sampleSize={data.orderCount}
      note="Denominated in SGD"
      rows={rows}
      emptyTitle="No completed orders yet"
      emptyDescription="GMV appears once orders reach paid/fulfilled. The line is drawn only from real order rows."
    >
      <LineChart
        data={data.gmvByDay.map((p) => ({
          label: p.day.slice(5),
          value: p.gmvSgd,
          display: formatSgd(p.gmvSgd),
        }))}
      />
    </ChartFrame>
  );
}

export function SellThroughPanel({ data }: { data: DropOverview }) {
  const rows = data.sellThrough.map((r) => ({
    label: r.dropName,
    display: `${formatRate(r.rate)} (${r.itemsSold}/${r.itemsOffered})`,
  }));
  return (
    <ChartFrame
      title="Sell-through by drop"
      description="Paid/fulfilled drop items ÷ items offered (v_sell_through). Research-observed listings never count."
      sampleSize={data.sellThrough.reduce((a, r) => a + r.itemsOffered, 0)}
      rows={rows}
      emptyTitle="No drops offered yet"
      emptyDescription="Sell-through appears once a drop has items and completed orders."
    >
      <BarChart
        data={data.sellThrough.map((r) => ({
          label: r.dropName,
          value: r.rate ?? 0,
          display: formatRate(r.rate),
          sampleSize: r.itemsOffered,
        }))}
      />
    </ChartFrame>
  );
}

export function TimeToSalePanel({ data }: { data: DropOverview }) {
  const rows = data.timeToSale.map((r) => ({
    label: `${r.dropName} · ${r.categoryLabel}`,
    display: `${formatIntervalDays(r.medianInterval)} (n = ${r.sampleSize})`,
  }));
  return (
    <ChartFrame
      title="Median time-to-sell"
      description="Median (not mean) of paid_at − published_at per drop × category (v_time_to_sale)."
      sampleSize={data.timeToSale.reduce((a, r) => a + r.sampleSize, 0)}
      rows={rows}
      emptyTitle="No sales timing yet"
      emptyDescription="Needs paid orders on published products that belong to a drop."
    >
      <BarChart
        data={data.timeToSale.map((r) => ({
          label: `${r.dropName} · ${r.categoryLabel}`,
          value: intervalToDays(r.medianInterval) ?? 0,
          display: formatIntervalDays(r.medianInterval),
          sampleSize: r.sampleSize,
        }))}
      />
    </ChartFrame>
  );
}

// ---------- Assortment ----------

function AssortmentChart({
  title,
  buckets,
  metric,
}: {
  title: string;
  buckets: AssortmentBucket[];
  metric: "saveRate" | "inquiryRate";
}) {
  const totalProducts = buckets.reduce((a, b) => a + b.products, 0);
  const rows = buckets.map((b) => ({
    label: b.label,
    display: `${formatRate(metric === "saveRate" ? b.saveRate : b.inquiryRate)} · ${formatCount(b.views)} views`,
  }));
  return (
    <ChartFrame
      title={title}
      description={`${metric === "saveRate" ? "Save rate" : "Inquiry rate"} per bucket, from v_save_rate / v_inquiry_rate rolled up by product. Sample counts are published products per bucket.`}
      sampleSize={totalProducts}
      note="Rate denominators are product views per bucket"
      rows={rows}
      emptyTitle="No products in this cut"
      emptyDescription="Buckets fill in as published products get tagged and receive traffic."
    >
      <BarChart
        data={buckets.map((b) => ({
          label: b.label,
          value: (metric === "saveRate" ? b.saveRate : b.inquiryRate) ?? 0,
          display: formatRate(metric === "saveRate" ? b.saveRate : b.inquiryRate),
          sampleSize: b.products,
        }))}
      />
    </ChartFrame>
  );
}

export function AssortmentPanels({ data }: { data: AssortmentPerformance }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <AssortmentChart title="Category performance (save rate)" buckets={data.byCategory} metric="saveRate" />
      <AssortmentChart title="Price-band performance (save rate)" buckets={data.byPriceBand} metric="saveRate" />
      <AssortmentChart title="Aesthetic performance (inquiry rate)" buckets={data.byAesthetic} metric="inquiryRate" />
      <AssortmentChart title="Color palette performance (save rate)" buckets={data.byColor} metric="saveRate" />
      <AssortmentChart title="Material performance (save rate)" buckets={data.byMaterial} metric="saveRate" />
    </div>
  );
}

// ---------- Creative + channel ----------

export function CreativePanel({ rows }: { rows: CreativeRow[] }) {
  const totalClicks = rows.reduce((a, r) => a + r.clicks, 0);
  const tableRows = rows.map((r) => ({
    label: `${r.campaignName} · ${r.channel}`,
    display: `${formatCount(r.clicks)} clicks`,
  }));
  return (
    <Card>
      <CardHeader
        title="Tracked-link clicks"
        description="Clicks per tracked link (v_campaign_ctr). Impressions are not instrumented, so CTR is never shown — per the metric guardrail, a rate is not invented."
      />
      <p className="mb-3 text-xs text-warm-500">{formatSampleSize(totalClicks)} clicks total</p>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-warm-300 bg-warm-100/50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-ink">No tracked links yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-warm-500">
            Create tracked links in Campaigns; clicks arrive via campaign_link_click events.
          </p>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Campaign</TH>
              <TH>Channel</TH>
              <TH>Clicks</TH>
              <TH>CTR</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.trackedLinkId}>
                <TD>{r.campaignName}</TD>
                <TD>{r.channel}</TD>
                <TD>{formatCount(r.clicks)}</TD>
                <TD className="text-warm-500">— (no impressions)</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {rows.length > 0 ? (
        <div className="mt-4">
          <BarChart
            tone="accent"
            data={rows.map((r) => ({
              label: `${r.campaignName} · ${r.channel}`,
              value: r.clicks,
              display: formatCount(r.clicks),
            }))}
          />
        </div>
      ) : null}
      <span className="sr-only">{tableRows.map((r) => `${r.label}: ${r.display}. `).join("")}</span>
    </Card>
  );
}

export function ChannelPanel({ data }: { data: ChannelBreakdown }) {
  const rows = data.pageViews.map((p) => ({
    label: CHANNEL_LABELS[p.channel],
    display: `${formatCount(p.views)} views · ${formatCount(p.sessions)} sessions`,
  }));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartFrame
        title="Channel breakdown (page views)"
        description="page_view rows grouped from UTM/tracked-link attribution (direct / social / referral / other). Presentation grouping of raw attribution columns — not a canonical §2 metric."
        sampleSize={data.totalPageViews}
        note={data.truncated ? `Showing most recent ${formatCount(data.rawRowLimit)} page views` : undefined}
        rows={rows}
        emptyTitle="No page views yet"
        emptyDescription="Channel mix appears once the storefront receives traffic."
      >
        <DonutChart
          centerLabel={formatCount(data.totalPageViews)}
          data={data.pageViews.map((p) => ({
            label: CHANNEL_LABELS[p.channel],
            value: p.views,
            display: formatCount(p.views),
          }))}
        />
      </ChartFrame>
      <ChartFrame
        title="Tracked-link clicks by channel"
        description="campaign_link_click events summed per tracked-link channel (v_campaign_ctr)."
        sampleSize={data.linkClicks.reduce((a, r) => a + r.clicks, 0)}
        rows={data.linkClicks.map((r) => ({
          label: r.channel,
          display: formatCount(r.clicks),
        }))}
        emptyTitle="No tracked-link clicks yet"
        emptyDescription="Clicks appear when shared tracked links are used."
      >
        <BarChart
          data={data.linkClicks.map((r) => ({
            label: r.channel,
            value: r.clicks,
            display: formatCount(r.clicks),
          }))}
        />
      </ChartFrame>
    </div>
  );
}

// ---------- Research vs reality ----------

export function ResearchRealityPanel({ rows }: { rows: ResearchRealityRow[] }) {
  const observed = rows.reduce((a, r) => a + r.observedListings, 0);
  const published = rows.reduce((a, r) => a + r.publishedProducts, 0);
  return (
    <Card>
      <CardHeader
        title="Research vs reality, by category"
        description="Left: marketplace observation distributions (research inbox — what the market shows). Right: internal engagement on our published products (v_save_rate). Two different populations — read side by side, never as a ratio."
      />
      <p className="mb-3 text-xs text-warm-500">
        {formatSampleSize(observed)} observed listings · {formatSampleSize(published)} published products
      </p>
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-warm-300 bg-warm-100/50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-ink">Nothing to compare yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-warm-500">
            Capture listings in the Research Inbox and publish products; this panel compares the two distributions by category.
          </p>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Category</TH>
              <TH>Observed listings</TH>
              <TH>Avg asking</TH>
              <TH>Visible engagement</TH>
              <TH>Our products</TH>
              <TH>Product views</TH>
              <TH>Saves</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.category}>
                <TD className="font-medium">{r.category}</TD>
                <TD>{formatCount(r.observedListings)}</TD>
                <TD>{r.avgAskingPriceSgd !== null ? formatSgd(r.avgAskingPriceSgd) : "—"}</TD>
                <TD>{formatCount(r.visibleEngagement)}</TD>
                <TD>{formatCount(r.publishedProducts)}</TD>
                <TD>{formatCount(r.productViews)}</TD>
                <TD>{formatCount(r.saves)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

// ---------- Data quality ----------

export function DataQualityPanel({ data }: { data: DataQualityReport }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Events tracked"
          value={data.eventCountTotal > 0 ? formatCount(data.eventCountTotal) : null}
          note="events table, all types"
        />
        <StatCard
          label="Events missing required props"
          value={data.missingTotal > 0 ? formatCount(data.missingTotal) : data.eventCountTotal > 0 ? "0" : null}
          note="v_dq_missing_properties"
        />
        <StatCard
          label="Duplicate source records"
          value={formatCount(data.duplicateSources.length)}
          note="v_dq_duplicate_sources (should stay 0)"
        />
        <StatCard
          label="Stale permissions on published items"
          value={formatCount(data.stalePermissions.length)}
          note="v_dq_stale_permissions"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Event counts by type"
          description="Raw counts per event_name (dictionary §1). Volume context for every metric above."
          sampleSize={data.eventCountTotal}
          rows={data.eventCounts.map((e) => ({
            label: e.eventName,
            display: formatCount(e.count),
          }))}
          emptyTitle="No events yet"
          emptyDescription="Event volume appears once tracking fires."
        >
          <BarChart
            data={data.eventCounts.map((e) => ({
              label: e.eventName,
              value: e.count,
              display: formatCount(e.count),
            }))}
          />
        </ChartFrame>
        <Card>
          <CardHeader
            title="Missingness & integrity"
            description="Detail rows behind the data-quality counts."
          />
          {data.missingByEvent.length === 0 &&
          data.duplicateSources.length === 0 &&
          data.stalePermissions.length === 0 ? (
            <p className="text-sm text-warm-500">
              <Badge tone="success">clean</Badge>{" "}
              <span className="ml-2">
                No missing required properties, no duplicate source URLs, no stale permissions on published items.
              </span>
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              {data.missingByEvent.length > 0 ? (
                <div>
                  <p className="mb-1 font-medium text-ink">Missing required properties</p>
                  <ul className="space-y-1 text-warm-700">
                    {data.missingByEvent.map((m) => (
                      <li key={`${m.eventName}-${m.missingProperty}`}>
                        <Badge tone="warning">{m.eventName}</Badge> missing{" "}
                        <code className="text-xs">{m.missingProperty}</code> × {m.count}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.duplicateSources.length > 0 ? (
                <div>
                  <p className="mb-1 font-medium text-ink">Duplicate source URLs</p>
                  <ul className="space-y-1 text-warm-700">
                    {data.duplicateSources.map((d) => (
                      <li key={d.normalizedUrl}>
                        <Badge tone="danger">duplicate</Badge>{" "}
                        <span className="text-xs">{d.normalizedUrl}</span> × {d.listingCount}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.stalePermissions.length > 0 ? (
                <div>
                  <p className="mb-1 font-medium text-ink">Stale permissions</p>
                  <ul className="space-y-1 text-warm-700">
                    {data.stalePermissions.map((p) => (
                      <li key={p.permissionId}>
                        <Badge tone="danger">stale</Badge> {p.productSku ?? p.permissionId} ·{" "}
                        {p.scope} expired {formatDate(p.expiresAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
