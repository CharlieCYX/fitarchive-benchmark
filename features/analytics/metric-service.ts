import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyChannel, intervalToDays, type ChannelGroup } from "@/lib/metrics/format";
import { priceBandLabel } from "@/features/drops/assortment";

/**
 * Analytics metric service (server-only) — the ONLY read path for dashboard
 * numbers (ADR-008 / EVENTS_AND_METRICS.md §2–§3). Every canonical metric
 * comes from the SQL views in migration 0015; the queries below are thin
 * wrappers (select + regroup for display), never re-implementations of the
 * metric formulas.
 *
 * Only the §12.3 *presentations* that are not canonical metrics — channel
 * grouping of raw attribution columns and research-inbox distributions — are
 * aggregated here, from raw columns, and are labeled as such in the UI.
 */

// ---------- shared helpers ----------

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function tagLabelMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await supabase.from("tags").select("id, label");
  return new Map((data ?? []).map((t) => [t.id as string, t.label as string]));
}

async function dropNameMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await supabase.from("drops").select("id, name").order("created_at");
  return new Map((data ?? []).map((d) => [d.id as string, d.name as string]));
}

// ---------- Drop overview (§12.3) ----------

export interface GmvPoint {
  day: string;
  gmvSgd: number;
}

export interface SellThroughRow {
  dropId: string;
  dropName: string;
  itemsOffered: number;
  itemsSold: number;
  rate: number | null;
}

export interface TimeToSaleRow {
  dropId: string;
  dropName: string;
  categoryLabel: string;
  medianInterval: string | null;
  sampleSize: number;
}

export interface DropOverview {
  totalGmvSgd: number | null;
  orderCount: number;
  /** Units = Σ items_sold from v_sell_through (drop-offered items only). */
  unitsSold: number;
  gmvByDay: GmvPoint[];
  sellThrough: SellThroughRow[];
  productViews: number;
  impressions: number;
  saves: number;
  inquiries: number;
  conversion: {
    completedOrders: number;
    productViews: number;
    viewingSessions: number;
    perProductView: number | null;
    perSession: number | null;
  } | null;
  timeToSale: TimeToSaleRow[];
}

export async function getDropOverview(
  supabase: SupabaseClient,
  orgId: string,
): Promise<DropOverview> {
  const [gmvRes, sellRes, saveRes, inquiryRes, convRes, pvrRes, ttsRes, drops, tags] =
    await Promise.all([
      supabase.from("v_gmv").select("period_day, gmv_sgd, order_count").eq("org_id", orgId),
      supabase
        .from("v_sell_through")
        .select("drop_id, items_offered, items_sold, sell_through")
        .eq("org_id", orgId),
      supabase
        .from("v_save_rate")
        .select("product_id, saving_identities, product_views")
        .eq("org_id", orgId),
      supabase.from("v_inquiry_rate").select("inquiries, product_views").eq("org_id", orgId),
      supabase
        .from("v_purchase_conversion")
        .select(
          "completed_orders, product_views, viewing_sessions, conversion_per_product_view, conversion_per_session",
        )
        .eq("org_id", orgId)
        .maybeSingle(),
      supabase
        .from("v_product_view_rate")
        .select("impressions, product_views, unique_view_sessions")
        .eq("org_id", orgId),
      supabase
        .from("v_time_to_sale")
        .select("drop_id, category_id, median_time_to_sale, sample_size")
        .eq("org_id", orgId),
      dropNameMap(supabase),
      tagLabelMap(supabase),
    ]);

  const gmvRows = (gmvRes.data ?? []) as Array<Record<string, unknown>>;
  const gmvByDay: GmvPoint[] = gmvRows
    .map((r) => ({ day: String(r.period_day), gmvSgd: num(r.gmv_sgd) ?? 0 }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const totalGmvSgd = gmvRows.length
    ? gmvRows.reduce((a, r) => a + (num(r.gmv_sgd) ?? 0), 0)
    : null;
  const orderCount = gmvRows.reduce((a, r) => a + (num(r.order_count) ?? 0), 0);

  const sellRows = ((sellRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    dropId: r.drop_id as string,
    dropName: drops.get(r.drop_id as string) ?? "Unknown drop",
    itemsOffered: num(r.items_offered) ?? 0,
    itemsSold: num(r.items_sold) ?? 0,
    rate: num(r.sell_through),
  }));
  const unitsSold = sellRows.reduce((a, r) => a + r.itemsSold, 0);

  const saves = ((saveRes.data ?? []) as Array<Record<string, unknown>>).reduce(
    (a, r) => a + (num(r.saving_identities) ?? 0),
    0,
  );
  const saveViews = ((saveRes.data ?? []) as Array<Record<string, unknown>>).reduce(
    (a, r) => a + (num(r.product_views) ?? 0),
    0,
  );
  const inquiries = ((inquiryRes.data ?? []) as Array<Record<string, unknown>>).reduce(
    (a, r) => a + (num(r.inquiries) ?? 0),
    0,
  );
  const pvrRows = (pvrRes.data ?? []) as Array<Record<string, unknown>>;
  const impressions = pvrRows.reduce((a, r) => a + (num(r.impressions) ?? 0), 0);
  const productViews = Math.max(
    saveViews,
    pvrRows.reduce((a, r) => a + (num(r.product_views) ?? 0), 0),
  );

  const c = convRes.data as Record<string, unknown> | null;
  const conversion = c
    ? {
        completedOrders: num(c.completed_orders) ?? 0,
        productViews: num(c.product_views) ?? 0,
        viewingSessions: num(c.viewing_sessions) ?? 0,
        perProductView: num(c.conversion_per_product_view),
        perSession: num(c.conversion_per_session),
      }
    : null;

  const timeToSale: TimeToSaleRow[] = (
    (ttsRes.data ?? []) as Array<Record<string, unknown>>
  ).map((r) => ({
    dropId: r.drop_id as string,
    dropName: drops.get(r.drop_id as string) ?? "Unknown drop",
    categoryLabel: tags.get(r.category_id as string) ?? "Uncategorized",
    medianInterval: (r.median_time_to_sale as string | null) ?? null,
    sampleSize: num(r.sample_size) ?? 0,
  }));

  return {
    totalGmvSgd,
    orderCount,
    unitsSold,
    gmvByDay,
    sellThrough: sellRows,
    productViews,
    impressions,
    saves,
    inquiries,
    conversion,
    timeToSale,
  };
}

// ---------- Assortment performance (§12.3) ----------

export interface AssortmentBucket {
  label: string;
  /** Products in the bucket — the sample size shown beside every number. */
  products: number;
  views: number;
  saves: number;
  inquiries: number;
  /** saves / views across the bucket's products (v_save_rate columns). */
  saveRate: number | null;
  inquiryRate: number | null;
}

export interface AssortmentPerformance {
  byCategory: AssortmentBucket[];
  byPriceBand: AssortmentBucket[];
  byAesthetic: AssortmentBucket[];
  byMaterial: AssortmentBucket[];
  byColor: AssortmentBucket[];
}

interface ProductRow {
  id: string;
  public_price_sgd: unknown;
  category_id: string | null;
}

export async function getAssortmentPerformance(
  supabase: SupabaseClient,
  orgId: string,
): Promise<AssortmentPerformance> {
  const [productsRes, assignmentsRes, tagsRes, saveRes, inquiryRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, public_price_sgd, category_id")
      .eq("org_id", orgId)
      .not("published_at", "is", null),
    supabase
      .from("tag_assignments")
      .select("entity_id, tags!inner(dimension, label)")
      .eq("entity_type", "product")
      .eq("accepted", true)
      .in("tags.dimension", ["aesthetic", "material", "palette_role"]),
    supabase.from("tags").select("id, label").eq("dimension", "category"),
    supabase
      .from("v_save_rate")
      .select("product_id, saving_identities, product_views")
      .eq("org_id", orgId),
    supabase.from("v_inquiry_rate").select("product_id, inquiries").eq("org_id", orgId),
  ]);

  const products = (productsRes.data ?? []) as unknown as ProductRow[];
  const categoryLabels = new Map(
    ((tagsRes.data ?? []) as Array<{ id: string; label: string }>).map((t) => [
      t.id,
      t.label,
    ]),
  );

  // Per-product engagement from the canonical views.
  const engagement = new Map<string, { views: number; saves: number; inquiries: number }>();
  for (const p of products) engagement.set(p.id, { views: 0, saves: 0, inquiries: 0 });
  for (const r of (saveRes.data ?? []) as Array<Record<string, unknown>>) {
    const e = engagement.get(r.product_id as string);
    if (e) {
      e.views += num(r.product_views) ?? 0;
      e.saves += num(r.saving_identities) ?? 0;
    }
  }
  for (const r of (inquiryRes.data ?? []) as Array<Record<string, unknown>>) {
    const e = engagement.get(r.product_id as string);
    if (e) e.inquiries += num(r.inquiries) ?? 0;
  }

  function bucket(map: Map<string, Set<string>>): AssortmentBucket[] {
    return [...map.entries()]
      .map(([label, ids]) => {
        let views = 0;
        let saves = 0;
        let inquiries = 0;
        for (const id of ids) {
          const e = engagement.get(id);
          if (e) {
            views += e.views;
            saves += e.saves;
            inquiries += e.inquiries;
          }
        }
        return {
          label,
          products: ids.size,
          views,
          saves,
          inquiries,
          saveRate: views > 0 ? saves / views : null,
          inquiryRate: views > 0 ? inquiries / views : null,
        };
      })
      .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label));
  }

  const byCategory = new Map<string, Set<string>>();
  const byPrice = new Map<string, Set<string>>();
  for (const p of products) {
    const cat = p.category_id ? (categoryLabels.get(p.category_id) ?? "Uncategorized") : "Uncategorized";
    if (!byCategory.has(cat)) byCategory.set(cat, new Set());
    byCategory.get(cat)!.add(p.id);
    const price = num(p.public_price_sgd);
    const band = price !== null ? priceBandLabel(price) : "Unpriced";
    if (!byPrice.has(band)) byPrice.set(band, new Set());
    byPrice.get(band)!.add(p.id);
  }

  const byAesthetic = new Map<string, Set<string>>();
  const byMaterial = new Map<string, Set<string>>();
  const byColor = new Map<string, Set<string>>();
  const target =
    { aesthetic: byAesthetic, material: byMaterial, palette_role: byColor } as const;
  for (const a of (assignmentsRes.data ?? []) as Array<Record<string, unknown>>) {
    const tag = a.tags as { dimension: string; label: string } | null;
    const productId = a.entity_id as string;
    if (!tag || !engagement.has(productId)) continue;
    const map = target[tag.dimension as keyof typeof target];
    if (!map) continue;
    if (!map.has(tag.label)) map.set(tag.label, new Set());
    map.get(tag.label)!.add(productId);
  }

  return {
    byCategory: bucket(byCategory),
    byPriceBand: bucket(byPrice),
    byAesthetic: bucket(byAesthetic),
    byMaterial: bucket(byMaterial),
    byColor: bucket(byColor),
  };
}

// ---------- Creative / channel (§12.3) ----------

export interface CreativeRow {
  trackedLinkId: string;
  campaignName: string;
  channel: string;
  clicks: number;
  /** Always null — impressions are not instrumented (§2 guardrail). */
  ctr: number | null;
}

export async function getCreativePerformance(
  supabase: SupabaseClient,
  orgId: string,
): Promise<CreativeRow[]> {
  const [ctrRes, campaignsRes] = await Promise.all([
    supabase
      .from("v_campaign_ctr")
      .select("tracked_link_id, campaign_id, channel, clicks, ctr")
      .eq("org_id", orgId),
    supabase.from("campaigns").select("id, name"),
  ]);
  const names = new Map(
    ((campaignsRes.data ?? []) as Array<{ id: string; name: string }>).map((c) => [
      c.id,
      c.name,
    ]),
  );
  return ((ctrRes.data ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({
      trackedLinkId: r.tracked_link_id as string,
      campaignName: names.get(r.campaign_id as string) ?? "Unknown campaign",
      channel: (r.channel as string) ?? "unknown",
      clicks: num(r.clicks) ?? 0,
      ctr: num(r.ctr), // stays null per guardrail — never invented
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

export interface ChannelBreakdown {
  /** page_view rows grouped by classified channel (presentation, not a §2 metric). */
  pageViews: Array<{ channel: ChannelGroup; views: number; sessions: number }>;
  /** campaign_link_click totals per tracked-link channel (from v_campaign_ctr). */
  linkClicks: Array<{ channel: string; clicks: number }>;
  totalPageViews: number;
  rawRowLimit: number;
  truncated: boolean;
}

const CHANNEL_RAW_ROW_LIMIT = 10000;

export async function getChannelBreakdown(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ChannelBreakdown> {
  const [eventsRes, creative] = await Promise.all([
    supabase
      .from("events")
      .select("session_id, properties")
      .eq("org_id", orgId)
      .eq("event_name", "page_view")
      .limit(CHANNEL_RAW_ROW_LIMIT),
    getCreativePerformance(supabase, orgId),
  ]);

  const groups = new Map<ChannelGroup, { views: number; sessions: Set<string> }>();
  const rows = (eventsRes.data ?? []) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const props = (row.properties ?? {}) as Record<string, unknown>;
    const channel = classifyChannel({
      utm_source: (props.utm_source as string | null) ?? null,
      utm_medium: (props.utm_medium as string | null) ?? null,
      referrer: (props.referrer as string | null) ?? null,
    });
    if (!groups.has(channel)) groups.set(channel, { views: 0, sessions: new Set() });
    const g = groups.get(channel)!;
    g.views += 1;
    if (row.session_id) g.sessions.add(row.session_id as string);
  }

  const linkClicksMap = new Map<string, number>();
  for (const c of creative) {
    linkClicksMap.set(c.channel, (linkClicksMap.get(c.channel) ?? 0) + c.clicks);
  }

  const order: ChannelGroup[] = ["direct", "social", "referral", "other"];
  return {
    pageViews: order
      .filter((ch) => groups.has(ch))
      .map((ch) => ({
        channel: ch,
        views: groups.get(ch)!.views,
        sessions: groups.get(ch)!.sessions.size,
      })),
    linkClicks: [...linkClicksMap.entries()]
      .map(([channel, clicks]) => ({ channel, clicks }))
      .sort((a, b) => b.clicks - a.clicks),
    totalPageViews: rows.length,
    rawRowLimit: CHANNEL_RAW_ROW_LIMIT,
    truncated: rows.length >= CHANNEL_RAW_ROW_LIMIT,
  };
}

// ---------- Research vs reality (§12.3) ----------

export interface ResearchRealityRow {
  category: string;
  /** Research side: observed marketplace listings (source_listings). */
  observedListings: number;
  avgAskingPriceSgd: number | null;
  visibleEngagement: number;
  /** Reality side: our published products + canonical-view engagement. */
  publishedProducts: number;
  productViews: number;
  saves: number;
}

/**
 * Research distributions come from research-inbox records (source_listings +
 * their category tag_assignments); internal engagement comes from the
 * canonical v_save_rate view joined to products. Two distributions side by
 * side — no ratio between them is implied (different populations).
 */
export async function getResearchVsReality(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ResearchRealityRow[]> {
  const [listingsRes, listingTagsRes, productsRes, tagsRes, saveRes] = await Promise.all([
    supabase
      .from("source_listings")
      .select("id, asking_price_sgd, visible_engagement")
      .eq("org_id", orgId)
      .eq("is_active", true),
    supabase
      .from("tag_assignments")
      .select("entity_id, tags!inner(dimension, label)")
      .eq("entity_type", "source_listing")
      .eq("accepted", true)
      .eq("tags.dimension", "category"),
    supabase
      .from("products")
      .select("id, category_id")
      .eq("org_id", orgId)
      .not("published_at", "is", null),
    supabase.from("tags").select("id, label").eq("dimension", "category"),
    supabase
      .from("v_save_rate")
      .select("product_id, saving_identities, product_views")
      .eq("org_id", orgId),
  ]);

  const categoryOfTag = new Map(
    ((tagsRes.data ?? []) as Array<{ id: string; label: string }>).map((t) => [
      t.id,
      t.label,
    ]),
  );
  const listingCategory = new Map<string, string>();
  for (const a of (listingTagsRes.data ?? []) as Array<Record<string, unknown>>) {
    const tag = a.tags as { label: string } | null;
    if (tag && !listingCategory.has(a.entity_id as string)) {
      listingCategory.set(a.entity_id as string, tag.label);
    }
  }

  const engagement = new Map<string, { views: number; saves: number }>();
  for (const r of (saveRes.data ?? []) as Array<Record<string, unknown>>) {
    engagement.set(r.product_id as string, {
      views: num(r.product_views) ?? 0,
      saves: num(r.saving_identities) ?? 0,
    });
  }

  const rows = new Map<string, ResearchRealityRow>();
  function rowFor(label: string): ResearchRealityRow {
    if (!rows.has(label)) {
      rows.set(label, {
        category: label,
        observedListings: 0,
        avgAskingPriceSgd: null,
        visibleEngagement: 0,
        publishedProducts: 0,
        productViews: 0,
        saves: 0,
      });
    }
    return rows.get(label)!;
  }

  const priceAcc = new Map<string, { sum: number; n: number }>();
  for (const l of (listingsRes.data ?? []) as Array<Record<string, unknown>>) {
    const label = listingCategory.get(l.id as string) ?? "Uncategorized";
    const row = rowFor(label);
    row.observedListings += 1;
    row.visibleEngagement += num(l.visible_engagement) ?? 0;
    const price = num(l.asking_price_sgd);
    if (price !== null) {
      const acc = priceAcc.get(label) ?? { sum: 0, n: 0 };
      acc.sum += price;
      acc.n += 1;
      priceAcc.set(label, acc);
    }
  }
  for (const [label, acc] of priceAcc) {
    if (acc.n > 0) rowFor(label).avgAskingPriceSgd = acc.sum / acc.n;
  }

  for (const p of (productsRes.data ?? []) as Array<Record<string, unknown>>) {
    const label = p.category_id
      ? (categoryOfTag.get(p.category_id as string) ?? "Uncategorized")
      : "Uncategorized";
    const row = rowFor(label);
    row.publishedProducts += 1;
    const e = engagement.get(p.id as string);
    if (e) {
      row.productViews += e.views;
      row.saves += e.saves;
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.observedListings + b.publishedProducts - (a.observedListings + a.publishedProducts),
  );
}

// ---------- Data quality (§12.3) ----------

export interface DataQualityReport {
  missingByEvent: Array<{ eventName: string; missingProperty: string; count: number }>;
  missingTotal: number;
  duplicateSources: Array<{ normalizedUrl: string; listingCount: number }>;
  stalePermissions: Array<{
    permissionId: string;
    scope: string;
    state: string;
    expiresAt: string | null;
    productSku: string | null;
  }>;
  eventCounts: Array<{ eventName: string; count: number }>;
  eventCountTotal: number;
}

export async function getDataQuality(
  supabase: SupabaseClient,
  orgId: string,
): Promise<DataQualityReport> {
  const [missingRes, dupRes, staleRes, eventsRes] = await Promise.all([
    supabase
      .from("v_dq_missing_properties")
      .select("event_name, missing_property")
      .eq("org_id", orgId)
      .limit(5000),
    supabase
      .from("v_dq_duplicate_sources")
      .select("normalized_url, listing_count")
      .eq("org_id", orgId),
    supabase
      .from("v_dq_stale_permissions")
      .select("permission_id, scope, state, expires_at, sku")
      .limit(200),
    supabase.from("events").select("event_name").eq("org_id", orgId).limit(50000),
  ]);

  const missingMap = new Map<string, number>();
  for (const r of (missingRes.data ?? []) as Array<Record<string, unknown>>) {
    const key = `${r.event_name}::${r.missing_property}`;
    missingMap.set(key, (missingMap.get(key) ?? 0) + 1);
  }

  const countMap = new Map<string, number>();
  for (const r of (eventsRes.data ?? []) as Array<{ event_name: string }>) {
    countMap.set(r.event_name, (countMap.get(r.event_name) ?? 0) + 1);
  }

  return {
    missingByEvent: [...missingMap.entries()]
      .map(([key, count]) => {
        const [eventName, missingProperty] = key.split("::");
        return { eventName, missingProperty, count };
      })
      .sort((a, b) => b.count - a.count),
    missingTotal: (missingRes.data ?? []).length,
    duplicateSources: ((dupRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      normalizedUrl: r.normalized_url as string,
      listingCount: num(r.listing_count) ?? 0,
    })),
    stalePermissions: ((staleRes.data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      permissionId: r.permission_id as string,
      scope: (r.scope as string) ?? "",
      state: (r.state as string) ?? "",
      expiresAt: (r.expires_at as string | null) ?? null,
      productSku: (r.sku as string | null) ?? null,
    })),
    eventCounts: [...countMap.entries()]
      .map(([eventName, count]) => ({ eventName, count }))
      .sort((a, b) => b.count - a.count),
    eventCountTotal: (eventsRes.data ?? []).length,
  };
}

// ---------- Dashboard snapshots (metric_snapshots, §9.1) ----------

export interface SnapshotRow {
  metricKey: string;
  scope: Record<string, string>;
  value: number | null;
  sampleSize: number | null;
}

/**
 * Current canonical metric values flattened into metric_snapshots rows
 * (values only — writes happen in the action). Only metrics with an honest
 * org-wide or per-scope value are included; campaign_ctr is skipped because
 * impressions are not instrumented (guardrail: never invent a rate).
 */
export async function buildSnapshotRows(
  supabase: SupabaseClient,
  orgId: string,
): Promise<SnapshotRow[]> {
  const [overview, styleRes, contributionRes] = await Promise.all([
    getDropOverview(supabase, orgId),
    supabase
      .from("v_style_feedback_success")
      .select("mode, success_rate, feedback_count, sessions_with_feedback")
      .eq("org_id", orgId),
    supabase
      .from("v_fitarchive_contribution")
      .select("fitarchive_contribution_sgd, settlement_count")
      .eq("org_id", orgId),
  ]);

  const rows: SnapshotRow[] = [];
  if (overview.totalGmvSgd !== null) {
    rows.push({
      metricKey: "gmv",
      scope: {},
      value: overview.totalGmvSgd,
      sampleSize: overview.orderCount,
    });
  }
  for (const st of overview.sellThrough) {
    rows.push({
      metricKey: "sell_through",
      scope: { drop_id: st.dropId },
      value: st.rate,
      sampleSize: st.itemsOffered,
    });
  }
  if (overview.conversion) {
    rows.push(
      {
        metricKey: "purchase_conversion",
        scope: { denominator: "product_view" },
        value: overview.conversion.perProductView,
        sampleSize: overview.conversion.productViews,
      },
      {
        metricKey: "purchase_conversion",
        scope: { denominator: "session" },
        value: overview.conversion.perSession,
        sampleSize: overview.conversion.viewingSessions,
      },
    );
  }
  for (const t of overview.timeToSale) {
    rows.push({
      metricKey: "time_to_sale",
      scope: { drop_id: t.dropId, category: t.categoryLabel },
      value: intervalToDays(t.medianInterval), // median days (view returns an interval)
      sampleSize: t.sampleSize,
    });
  }
  for (const s of (styleRes.data ?? []) as Array<Record<string, unknown>>) {
    rows.push({
      metricKey: "style_feedback_success",
      scope: { mode: s.mode as string },
      value: num(s.success_rate),
      sampleSize: num(s.feedback_count),
    });
  }
  const contributionRows = (contributionRes.data ?? []) as Array<Record<string, unknown>>;
  if (contributionRows.length > 0) {
    rows.push({
      metricKey: "fitarchive_contribution",
      scope: {},
      value: contributionRows.reduce(
        (a, r) => a + (num(r.fitarchive_contribution_sgd) ?? 0),
        0,
      ),
      sampleSize: contributionRows.reduce((a, r) => a + (num(r.settlement_count) ?? 0), 0),
    });
  }
  return rows;
}

export interface SnapshotListRow {
  id: string;
  metricKey: string;
  scope: Record<string, unknown>;
  value: number | null;
  sampleSize: number | null;
  capturedAt: string;
}

export async function listSnapshots(
  supabase: SupabaseClient,
  limit = 30,
): Promise<SnapshotListRow[]> {
  const { data } = await supabase
    .from("metric_snapshots")
    .select("id, metric_key, scope, value, sample_size, captured_at")
    .order("captured_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    metricKey: r.metric_key as string,
    scope: (r.scope ?? {}) as Record<string, unknown>,
    value: num(r.value),
    sampleSize: num(r.sample_size),
    capturedAt: r.captured_at as string,
  }));
}
