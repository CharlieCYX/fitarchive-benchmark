import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const migrationsDir = path.join(__dirname, "../../supabase/migrations");
const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();

describe("supabase/migrations (contract per DATA_MODEL.md §5)", () => {
  it("contains 0001–0021 in order (0019 Phase 3 links; 0020 Phase 8–9 extensions; 0021 products column lockdown)", () => {
    expect(migrations).toHaveLength(21);
    migrations.forEach((file, i) => {
      expect(file.startsWith(String(i + 1).padStart(4, "0"))).toBe(true);
    });
  });

  it("0020 adds garment ideation rounds + portfolio evidence graph + PRD extensions", () => {
    const m20 = readFileSync(path.join(migrationsDir, "0020_phase8_9_extensions.sql"), "utf8");
    for (const t of [
      "garment_ideation_rounds",
      "garment_measurements",
      "portfolio_evidence_nodes",
      "portfolio_evidence_edges",
    ]) {
      expect(m20).toContain(`public.${t}`);
      expect(m20).toMatch(new RegExp(`enable row level security`, "i"));
    }
    // §13.3 provenance + ko draft with disclosure flag
    expect(m20).toContain("ai_generation_id");
    expect(m20).toContain("ko_draft");
    expect(m20).toContain("ko_machine_assisted");
    // §9.2 instrumentation metadata on PRDs (spec §9.2 additions)
    expect(m20).toContain("instrumentation_plan");
    expect(m20).toContain("release_decision");
    expect(m20).toContain("postmortem");
  });

  it("0019 links products back to source listings (§7.3 lineage)", () => {
    const m19 = readFileSync(path.join(migrationsDir, "0019_phase3_links.sql"), "utf8");
    expect(m19).toContain("source_listing_id");
    expect(m19).toMatch(/references public\.source_listings/);
  });

  it("0021 locks authenticated to the public products column list (red-team C1)", () => {
    const m21 = readFileSync(
      path.join(migrationsDir, "0021_products_column_lockdown.sql"),
      "utf8",
    );
    // table-level SELECT revoked for both web roles
    expect(m21).toMatch(/revoke select on public\.products from authenticated/);
    expect(m21).toMatch(/revoke select on public\.products from anon/);
    // the granted column list must not include the private columns
    const grantBlocks = m21.match(/grant select \(([^)]+)\)\s+on public\.products/gi) ?? [];
    expect(grantBlocks.length).toBeGreaterThanOrEqual(2);
    for (const block of grantBlocks) {
      expect(block).not.toContain("cost_basis_sgd");
      expect(block).not.toContain("notes_private");
    }
    // owner full-row access moves to a security-definer RPC with an owner check
    expect(m21).toContain("public.get_owner_product_full");
    expect(m21).toMatch(/security definer/);
    expect(m21).toContain("public.is_owner()");
    // §15.2 data rights entry point
    expect(m21).toContain("public.data_rights_requests");
  });

  it("events table has the replay-dedupe unique constraint (§19.1)", () => {
    const m09 = readFileSync(path.join(migrationsDir, "0009_events.sql"), "utf8");
    expect(m09).toContain("client_event_id");
    expect(m09).toMatch(/unique\s*\(\s*org_id\s*,\s*client_event_id\s*\)/i);
  });

  it("every core table gets RLS enabled and at least one policy (0013)", () => {
    const m13 = readFileSync(path.join(migrationsDir, "0013_rls_policies.sql"), "utf8");
    const tables = [
      "organizations",
      "profiles",
      "sellers",
      "seller_contacts",
      "agreements",
      "permissions",
      "settlements",
      "source_platforms",
      "source_listings",
      "research_observations",
      "products",
      "product_variants",
      "product_measurements",
      "product_assets",
      "ownership_records",
      "tags",
      "tag_aliases",
      "tag_assignments",
      "drops",
      "drop_items",
      "drop_hypotheses",
      "campaigns",
      "campaign_assets",
      "campaign_posts",
      "tracked_links",
      "sessions",
      "events",
      "favorites",
      "collections",
      "collection_items",
      "orders",
      "order_items",
      "payments",
      "refunds_returns",
      "insights",
      "experiments",
      "experiment_assignments",
      "metric_definitions",
      "metric_snapshots",
      "style_references",
      "style_reference_attributes",
      "closet_items",
      "outfits",
      "outfit_items",
      "style_sessions",
      "style_feedback",
      "ai_prompt_versions",
      "ai_generations",
    ];
    for (const t of tables) {
      expect(m13, `${t} RLS enabled`).toMatch(
        new RegExp(`alter table public\\.${t} enable row level security`, "i"),
      );
      expect(m13, `${t} has a policy`).toMatch(
        new RegExp(`create policy \\w+ on public\\.${t}\\b`, "i"),
      );
    }
  });

  it("0015 creates every canonical metric view from EVENTS_AND_METRICS.md §2", () => {
    const m15 = readFileSync(path.join(migrationsDir, "0015_metric_views.sql"), "utf8");
    for (const view of [
      "v_active_users",
      "v_page_view_through",
      "v_save_rate",
      "v_inquiry_rate",
      "v_checkout_start_rate",
      "v_purchase_conversion",
      "v_revenue",
      "v_revenue_per_drop",
      "v_sell_through",
      "v_average_selling_price",
      "v_time_to_sale",
      "v_campaign_link_clicks",
      "v_campaign_ctr",
      "v_purchase_by_utm_campaign",
      "v_dq_missing_fields",
      "v_dq_price_anomalies",
      "v_dq_duplicate_sources",
      "v_dq_untagged_products",
    ]) {
      expect(m15).toContain(`public.${view}`);
    }
    // key formula guardrails present as SQL structure
    expect(m15).toMatch(/event_name = 'order_complete'/);
    expect(m15).toMatch(/coalesce\(shipping_charge_sgd, 0\)/);
    expect(m15).toMatch(/unique\(seller_id, period_start, period_end\)|unique \(seller_id, period_start, period_end\)/);
  });

  it("seed is deterministic and completes the §23.4 narrative minimums", () => {
    const seed = readFileSync(path.join(__dirname, "../../supabase/seed.sql"), "utf8");
    for (const sku of ["FA-001", "FA-010", "FA-014"]) {
      expect(seed).toContain(`'${sku}'`);
    }
    expect(seed).toContain("Drop #001");
    expect(seed).toContain("Drop #002");
    for (const handle of ["@thrift.jo", "@keepsakesg", "@weekendrack"]) {
      expect(seed).toContain(handle);
    }
    // tracked-link click chain + conversion attribution for v_campaign_ctr
    expect(seed).toContain("'campaign_link_click'");
    expect(seed).toContain("'order_complete'");
    // fixed UUIDs → deterministic
    expect(seed).toContain("d0000000-0000-4000-8000-000000000001");
  });
});
