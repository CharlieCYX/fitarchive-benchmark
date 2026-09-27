import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Static invariants over the Phase 2 SQL artifacts. The executable versions of
 * these checks (real Postgres: migrations from zero, seed, metric views, RLS
 * probes) live in the pg harness documented in docs/TEST_REPORT.md; these keep
 * the cheap guarantees green in CI without a database.
 */

const root = path.resolve(__dirname, "..", "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const migrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const seedFiles = [
  path.join(root, "supabase", "seed.sql"),
  ...readdirSync(path.join(root, "supabase", "seeds"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(root, "supabase", "seeds", f)),
];
const seed = seedFiles.map((f) => readFileSync(f, "utf8")).join("\n");

describe("migration set (DATA_MODEL.md §5)", () => {
  it("contains 0001–0020 in order (0019 Phase 3 links; 0020 Phase 8–9 extensions)", () => {
    expect(migrations).toHaveLength(20);
    migrations.forEach((f, i) => {
      expect(f.startsWith(String(i + 1).padStart(4, "0") + "_")).toBe(true);
    });
  });

  it("0020 adds garment ideation rounds + portfolio §21.2 columns (Phase 8–9)", () => {
    const m20 = readFileSync(path.join(migrationsDir, "0020_phase8_9_extensions.sql"), "utf8");
    expect(m20).toContain("garment_ideation_rounds");
    expect(m20).toContain("ai_generation_id");
    expect(m20).toContain("evidence_links");
    expect(m20).toContain("ko_draft");
    expect(m20).toContain("instrumentation_plan");
    expect(m20).toContain("postmortem");
  });

  it("0019 links products back to source listings (§7.3 lineage)", () => {
    const m19 = readFileSync(path.join(migrationsDir, "0019_phase3_links.sql"), "utf8");
    expect(m19).toContain("source_listing_id");
    expect(m19).toMatch(/references public\.source_listings/);
  });

  it("events dedupe contract exists (unique org_id + client_event_id)", () => {
    const m9 = readFileSync(path.join(migrationsDir, "0009_events.sql"), "utf8");
    expect(m9).toMatch(/unique index.*\(org_id, client_event_id\)/is);
  });

  it("RLS migration enables RLS on every private table", () => {
    const m13 = readFileSync(path.join(migrationsDir, "0013_rls_policies.sql"), "utf8");
    for (const table of [
      "products", "sellers", "agreements", "permissions", "settlements",
      "orders", "payments", "events", "sessions", "closet_items",
      "style_sessions", "ai_generations", "source_listings",
    ]) {
      expect(m13).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("canonical metric views match EVENTS_AND_METRICS.md §2 keys", () => {
    const m15 = readFileSync(path.join(migrationsDir, "0015_metric_views.sql"), "utf8");
    for (const view of [
      "v_product_view_rate", "v_save_rate", "v_inquiry_rate", "v_external_ctr",
      "v_purchase_conversion", "v_sell_through", "v_time_to_sale", "v_gmv",
      "v_fitarchive_contribution", "v_campaign_ctr", "v_style_feedback_success",
      "v_dq_missing_properties", "v_dq_duplicate_sources", "v_dq_stale_permissions",
    ]) {
      expect(m15).toContain(`create or replace view public.${view}`);
    }
  });
});

describe("seed determinism (§23.4, A20)", () => {
  it("splits into seed.sql + seeds/*.sql matching config.toml sql_paths", () => {
    expect(seedFiles.length).toBeGreaterThanOrEqual(10);
    const config = readFileSync(path.join(root, "supabase", "config.toml"), "utf8");
    expect(config).toContain('sql_paths = ["./seed.sql", "./seeds/*.sql"]');
  });

  it("contains no now() / random() / gen_random_uuid() value generation", () => {
    expect(seed).not.toMatch(/\bnow\s*\(/);
    expect(seed).not.toMatch(/\brandom\s*\(/);
    expect(seed).not.toMatch(/\bgen_random_uuid\s*\(/);
  });

  it("is labeled as synthetic demo data", () => {
    expect(seed).toContain("SYNTHETIC DEMO DATA");
  });

  it("includes the FA-001…FA-010 canonical products", () => {
    for (let i = 1; i <= 10; i += 1) {
      expect(seed).toContain(`FA-${String(i).padStart(3, "0")}`);
    }
  });
});
