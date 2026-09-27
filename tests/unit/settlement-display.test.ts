import { describe, expect, it } from "vitest";

import {
  CONTRIBUTION_LABEL,
  describeSellerTerms,
  settlementDisplayRows,
  settlementStatusLabel,
} from "@/features/sellers/settlement-display";
import { summarizeAssortment } from "@/features/drops/assortment";
import { formatSgd } from "@/lib/utils";

describe("settlement display logic (§10.4 honesty rules)", () => {
  it("never uses the word profit in the canonical label", () => {
    expect(CONTRIBUTION_LABEL).toBe("FitArchive contribution");
    expect(CONTRIBUTION_LABEL.toLowerCase()).not.toContain("profit");
  });

  it("describes share-based terms", () => {
    expect(
      describeSellerTerms({ type: "consignment", seller_share_pct: "60.00" }),
    ).toBe("consignment — 60% of sale price");
  });

  it("describes fixed payouts and combined terms", () => {
    expect(
      describeSellerTerms({ type: "referral", seller_fixed_amount_sgd: "15.00" }),
    ).toBe("referral — $15.00 fixed");
    expect(
      describeSellerTerms({
        type: "consignment",
        seller_share_pct: 50,
        seller_fixed_amount_sgd: 10,
      }),
    ).toContain("$10.00 fixed + 50% of sale price");
  });

  it("is honest when no terms are recorded", () => {
    expect(describeSellerTerms({ type: "owned" })).toBe(
      "owned — no payout terms recorded",
    );
  });

  it("renders settlement rows in canonical order from stored values", () => {
    const rows = settlementDisplayRows({
      gross_sale_sgd: "100.00",
      platform_fees_sgd: "3.90",
      seller_base_sgd: "60.00",
      fitarchive_gross_sgd: "40.00",
      fitarchive_contribution_sgd: "36.10",
    });
    expect(rows.map((r) => r.label)).toEqual([
      "Gross sale",
      "Platform fees",
      "Seller base",
      "FitArchive gross",
      "FitArchive contribution",
    ]);
    expect(rows[4]?.value).toBe("$36.10");
  });

  it("labels payout status plainly", () => {
    expect(settlementStatusLabel("paid")).toBe("Paid");
    expect(settlementStatusLabel("pending")).toBe("Pending payout");
  });

  it("formatSgd handles numeric strings from Postgres and nulls", () => {
    expect(formatSgd("1234.50")).toContain("1,234.50");
    expect(formatSgd(null)).toBe("—");
    expect(formatSgd("not-a-number")).toBe("—");
  });
});

describe("assortment summary (§7.5)", () => {
  const items = [
    { productId: "a", title: "A", tier: "hero" as const, effectivePriceSgd: 120, categoryLabel: "Outerwear", aestheticLabels: ["workwear"], availability: "available" },
    { productId: "b", title: "B", tier: "core" as const, effectivePriceSgd: 60, categoryLabel: "Outerwear", aestheticLabels: ["workwear", "minimal"], availability: "available" },
    { productId: "c", title: "C", tier: "entry" as const, effectivePriceSgd: 35, categoryLabel: "Top", aestheticLabels: [], availability: "draft" },
    { productId: "d", title: "D", tier: "core" as const, effectivePriceSgd: null, categoryLabel: null, aestheticLabels: [], availability: "draft" },
  ];

  it("tallies tiers, categories and aesthetics", () => {
    const s = summarizeAssortment(items);
    expect(s.itemCount).toBe(4);
    expect(s.byTier.find((t) => t.tier === "core")?.count).toBe(2);
    expect(s.byCategory.find((c) => c.label === "Outerwear")?.count).toBe(2);
    expect(s.byCategory.find((c) => c.label === "Uncategorized")?.count).toBe(1);
    expect(s.byAesthetic.find((a) => a.label === "workwear")?.count).toBe(2);
  });

  it("builds the price ladder ascending and ignores unpriced items in the range", () => {
    const s = summarizeAssortment(items);
    expect(s.ladder.map((l) => l.title)).toEqual(["C", "B", "A", "D"]);
    expect(s.priceRange).toEqual({ min: 35, max: 120 });
  });

  it("handles an empty drop honestly", () => {
    const s = summarizeAssortment([]);
    expect(s.itemCount).toBe(0);
    expect(s.priceRange).toBeNull();
    expect(s.ladder).toEqual([]);
  });
});
