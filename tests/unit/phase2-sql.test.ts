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
const seed = readFileSync(path.join(root, "supabase", "seed.sql"), "utf8");

describe("migration set (DATA_MODEL.md §5)", () => {
  it("contains exactly 0001–0018 in order", () => {
    expect(migrations).toHaveLength(18);
    migrations.forEach((f, i) => {
      expect(f.startsWith(String(i + 1).padStart(4, "0") + "_")).toBe(true);
    });
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
