import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssortmentItem } from "./assortment";
import type { ReadinessInput, ReadinessItemInput } from "./readiness";
import { evaluateReadiness, type ReadinessResult } from "./readiness";
import type { PermissionState } from "../sellers/permissions";
import { isPermissionValid } from "../sellers/permissions";

/**
 * Drop Builder service (§7.5) — server-only. The readiness gate (§10.2) is
 * assembled here from live data and evaluated by the pure
 * features/drops/readiness module; publish BLOCKS when the gate fails.
 */

export interface DropListRow {
  id: string;
  slug: string;
  name: string;
  status: string;
  launch_at: string | null;
  published_at: string | null;
  item_count: number;
}

export async function listDrops(supabase: SupabaseClient): Promise<DropListRow[]> {
  const { data } = await supabase
    .from("drops")
    .select("id, slug, name, status, launch_at, published_at, drop_items(count)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    status: row.status as string,
    launch_at: (row.launch_at as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    item_count: (row.drop_items as Array<{ count: number }> | null)?.[0]?.count ?? 0,
  }));
}

export interface DropItemRow {
  drop_item_id: string;
  product_id: string;
  sku: string;
  title: string;
  tier: "entry" | "core" | "hero";
  position: number;
  price_override_sgd: string | null;
  public_price_sgd: string | null;
  availability: string;
  category_label: string | null;
  published_at: string | null;
}

export interface DropDetail {
  drop: {
    id: string;
    slug: string;
    name: string;
    concept: string | null;
    story: string | null;
    hypothesis_summary: string | null;
    status: string;
    target_size_min: number | null;
    target_size_max: number | null;
    launch_at: string | null;
    published_at: string | null;
    cloned_from_id: string | null;
  };
  clonedFromName: string | null;
  cloneNames: Array<{ id: string; name: string }>;
  items: DropItemRow[];
  hypotheses: Array<{
    id: string;
    statement: string;
    expected_outcome: string | null;
    evidence_basis: string | null;
  }>;
  readiness: ReadinessResult;
  assortmentItems: AssortmentItem[];
  /** readiness gate inputs, kept so publish can re-evaluate server-side */
  readinessInput: Omit<ReadinessInput, "attestations">;
}

interface ItemJoinRow {
  id: string;
  position: number;
  tier: "entry" | "core" | "hero";
  price_override_sgd: string | null;
  products: {
    id: string;
    sku: string;
    title: string;
    availability: string;
    public_price_sgd: string | null;
    published_at: string | null;
    condition_grade: string | null;
    description_public: string | null;
    seller_id: string | null;
    tags: { label: string } | null;
    product_measurements: Array<{ count: number }> | null;
    product_assets: Array<{
      id: string;
      privacy: string;
      alt_text: string | null;
      provenance: string;
      rights_note: string | null;
    }> | null;
    ownership_records: Array<{ state: string; effective_from: string }> | null;
  } | null;
}

interface PermissionRow {
  product_id: string | null;
  seller_id: string;
  state: PermissionState;
  granted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export async function getDropDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<DropDetail | null> {
  const { data: drop } = await supabase
    .from("drops")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!drop) return null;

  const [
    { data: items },
    { data: hypotheses },
    { data: clonedFrom },
    { data: clones },
  ] = await Promise.all([
    supabase
      .from("drop_items")
      .select(
        "id, position, tier, price_override_sgd, products(id, sku, title, availability, public_price_sgd, published_at, condition_grade, description_public, seller_id, tags(label), product_measurements(count), product_assets(id, privacy, alt_text, provenance, rights_note), ownership_records(state, effective_from))",
      )
      .eq("drop_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("drop_hypotheses")
      .select("id, statement, expected_outcome, evidence_basis")
      .eq("drop_id", id)
      .order("created_at"),
    drop.cloned_from_id
      ? supabase.from("drops").select("name").eq("id", drop.cloned_from_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("drops").select("id, name").eq("cloned_from_id", id),
  ]);

  const joinRows = (items ?? []) as unknown as ItemJoinRow[];
  const productIds = joinRows.map((r) => r.products?.id).filter(Boolean) as string[];
  const sellerIds = [
    ...new Set(
      joinRows.map((r) => r.products?.seller_id).filter(Boolean) as string[],
    ),
  ];

  // Permissions, agreements, aesthetic tags, campaigns, metric registry and
  // drop events — batched across the whole drop, no N+1 loops.
  const [
    { data: permissions },
    { data: agreements },
    { data: aestheticAssignments },
    { data: campaigns },
    metricDefs,
    dropEvents,
  ] = await Promise.all([
    productIds.length > 0
      ? supabase
          .from("permissions")
          .select("product_id, seller_id, state, granted_at, expires_at, revoked_at")
          .or(
            `product_id.in.(${productIds.join(",")}),seller_id.in.(${sellerIds.join(",") || NIL_UUID})`,
          )
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    sellerIds.length > 0
      ? supabase
          .from("agreements")
          .select("seller_id, fulfillment_responsibility, return_terms, status")
          .in("seller_id", sellerIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
    productIds.length > 0
      ? supabase
          .from("tag_assignments")
          .select("entity_id, tags(label, dimension)")
          .eq("entity_type", "product")
          .eq("accepted", true)
          .in("entity_id", productIds)
      : Promise.resolve({ data: [] }),
    supabase.from("campaigns").select("id").eq("drop_id", id),
    supabase.from("metric_definitions").select("key", { count: "exact", head: true }),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .filter("properties->>drop_id", "eq", id),
  ]);

  const campaignIds = ((campaigns ?? []) as Array<{ id: string }>).map((c) => c.id);
  const { count: trackedLinkCount } = campaignIds.length
    ? await supabase
        .from("tracked_links")
        .select("id", { count: "exact", head: true })
        .in("campaign_id", campaignIds)
    : { count: 0 };

  const permissionRows = (permissions ?? []) as PermissionRow[];
  const agreementRows = (agreements ?? []) as Array<{
    seller_id: string;
    fulfillment_responsibility: string | null;
    return_terms: string | null;
  }>;
  const aestheticsByProduct = new Map<string, string[]>();
  for (const a of (aestheticAssignments ?? []) as unknown as Array<{
    entity_id: string;
    tags: { label: string; dimension: string } | null;
  }>) {
    if (a.tags?.dimension !== "aesthetic") continue;
    const list = aestheticsByProduct.get(a.entity_id) ?? [];
    list.push(a.tags.label);
    aestheticsByProduct.set(a.entity_id, list);
  }

  const readinessItems: ReadinessItemInput[] = [];
  const itemRows: DropItemRow[] = [];
  const assortmentItems: AssortmentItem[] = [];

  for (const row of joinRows) {
    const p = row.products;
    if (!p) continue;
    const ownership = [...(p.ownership_records ?? [])].sort((a, b) =>
      b.effective_from.localeCompare(a.effective_from),
    )[0];
    const ownershipState = (ownership?.state ?? null) as PermissionState | null;
    // Prefer a valid permission over an expired/revoked one: a product can
    // carry several ledger rows (renewals), and the gate should see the
    // current best, not the newest row.
    const permissionCandidates = permissionRows.filter(
      (perm) =>
        perm.product_id === p.id ||
        (perm.product_id === null && perm.seller_id === p.seller_id),
    );
    const permission =
      permissionCandidates.find((perm) => isPermissionValid(perm)) ??
      permissionCandidates[0] ??
      null;
    const agreement = p.seller_id
      ? (agreementRows.find((a) => a.seller_id === p.seller_id) ?? null)
      : null;

    const assets = p.product_assets ?? [];
    const publicAssets = assets.filter(
      (a) => a.privacy === "public" && a.alt_text,
    ).length;
    const missingRights = assets.filter(
      (a) => a.provenance === "seller" && !a.rights_note,
    ).length;

    const effectivePrice =
      row.price_override_sgd !== null
        ? Number(row.price_override_sgd)
        : p.public_price_sgd !== null
          ? Number(p.public_price_sgd)
          : null;
    const categoryLabel = p.tags?.label ?? null;
    const aesthetics = aestheticsByProduct.get(p.id) ?? [];

    itemRows.push({
      drop_item_id: row.id,
      product_id: p.id,
      sku: p.sku,
      title: p.title,
      tier: row.tier,
      position: row.position,
      price_override_sgd: row.price_override_sgd,
      public_price_sgd: p.public_price_sgd,
      availability: p.availability,
      category_label: categoryLabel,
      published_at: p.published_at,
    });
    readinessItems.push({
      productId: p.id,
      title: p.title,
      tier: row.tier,
      effectivePriceSgd: effectivePrice,
      conditionGrade: p.condition_grade,
      measurementCount:
        (p.product_measurements as Array<{ count: number }> | null)?.[0]?.count ?? 0,
      publicAssetCount: publicAssets,
      descriptionPublic: p.description_public,
      ownershipState,
      permission,
      fulfillmentResponsibility: agreement?.fulfillment_responsibility ?? null,
      returnTerms: agreement?.return_terms ?? null,
      assetsMissingRightsNote: missingRights,
      availability: p.availability,
    });
    assortmentItems.push({
      productId: p.id,
      title: p.title,
      tier: row.tier,
      effectivePriceSgd: effectivePrice,
      categoryLabel,
      aestheticLabels: aesthetics,
      availability: p.availability,
    });
  }

  const readinessInput: Omit<ReadinessInput, "attestations"> = {
    concept: drop.concept as string | null,
    itemCount: itemRows.length,
    targetSizeMin: drop.target_size_min as number | null,
    targetSizeMax: drop.target_size_max as number | null,
    items: readinessItems,
    trackedLinkCount: trackedLinkCount ?? 0,
    metricDefinitionsCount: (metricDefs.count as number | null) ?? 0,
    dropEventCount: (dropEvents.count as number | null) ?? 0,
  };

  return {
    drop: drop as DropDetail["drop"],
    clonedFromName: (clonedFrom as { name?: string } | null)?.name ?? null,
    cloneNames: (clones ?? []) as Array<{ id: string; name: string }>,
    items: itemRows,
    hypotheses: (hypotheses ?? []) as DropDetail["hypotheses"],
    // Page display shows attestations unmet — they are publish-form inputs.
    readiness: evaluateReadiness({
      ...readinessInput,
      attestations: { personas: false, rollback: false },
    }),
    assortmentItems,
    readinessInput,
  };
}

/**
 * Publish a drop (§10.2 gate enforced). Re-evaluates the full gate with the
 * operator's attestations; BLOCKS with the list of failed checks when any
 * fail. Sets status='published' + published_at (the publication_change audit
 * trigger logs it).
 */
export async function publishDrop(
  supabase: SupabaseClient,
  dropId: string,
  attestations: { personas: boolean; rollback: boolean },
): Promise<{ ok: boolean; error?: string; failures?: string[] }> {
  const detail = await getDropDetail(supabase, dropId);
  if (!detail) return { ok: false, error: "Drop not found." };
  if (detail.drop.status === "published") {
    return { ok: false, error: "Drop is already published." };
  }

  const result = evaluateReadiness({ ...detail.readinessInput, attestations });
  if (!result.passed) {
    return {
      ok: false,
      error: `Readiness gate failed — ${result.failedCount} check${result.failedCount === 1 ? "" : "s"} unmet.`,
      failures: result.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.label}: ${c.detail}`),
    };
  }

  const { error } = await supabase
    .from("drops")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", dropId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Clone a drop (§7.5 Drop #001 → #002), preserving the comparison link. */
export async function cloneDrop(
  supabase: SupabaseClient,
  orgId: string,
  dropId: string,
): Promise<{ ok: boolean; newDropId?: string; error?: string }> {
  const { data: source } = await supabase
    .from("drops")
    .select("*")
    .eq("id", dropId)
    .maybeSingle();
  if (!source) return { ok: false, error: "Drop not found." };

  const match = /#(\d+)/.exec(source.name as string);
  const nextName = match
    ? (source.name as string).replace(
        /#\d+/,
        `#${String(Number(match[1]) + 1).padStart(3, "0")}`,
      )
    : `${source.name} (copy)`;
  const slugBase = (source.slug as string).replace(/-\d+$/, "");
  const slug = `${slugBase}-${Date.now().toString(36)}`;

  const { data: created, error } = await supabase
    .from("drops")
    .insert({
      org_id: orgId,
      slug,
      name: nextName,
      concept: source.concept,
      story: source.story,
      hypothesis_summary: source.hypothesis_summary,
      target_size_min: source.target_size_min,
      target_size_max: source.target_size_max,
      status: "planning",
      cloned_from_id: dropId,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { ok: false, error: error?.message ?? "Clone failed." };
  }

  // Hypotheses carry forward so the new drop keeps the evidence trail (§7.5).
  const { data: hypotheses } = await supabase
    .from("drop_hypotheses")
    .select("statement, expected_outcome, evidence_basis, linked_insight_id")
    .eq("drop_id", dropId);
  if (hypotheses && hypotheses.length > 0) {
    await supabase.from("drop_hypotheses").insert(
      (hypotheses as Array<Record<string, unknown>>).map((h) => ({
        ...h,
        drop_id: created.id,
      })),
    );
  }
  return { ok: true, newDropId: created.id as string };
}
