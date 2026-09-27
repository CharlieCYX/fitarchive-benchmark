import { describe, expect, it } from "vitest";

import { computeSettlement, demoPaymentFeeSgd } from "@/lib/metrics/settlement";

/**
 * Settlement math fixtures (DATA_MODEL.md §6 / Build Bible §10.4).
 * The expectations below are byte-identical to the settlement rows in
 * supabase/seed.sql — the DB-side identities are also enforced by the
 * check constraints in 0010_commerce.sql and the pg assertion harness.
 */
describe("settlement math (§10.4)", () => {
  it("consignment share: FA-001 SGD 68 @ 60%", () => {
    const r = computeSettlement({
      itemSalePriceSgd: 68,
      sellerSharePct: 60,
      platformFeesSgd: demoPaymentFeeSgd(68),
    });
    expect(r.sellerBaseSgd).toBe(40.8);
    expect(r.fitarchiveGrossSgd).toBe(27.2);
    expect(r.fitarchiveContributionSgd).toBe(24.39);
  });

  it("consignment share: FA-002 SGD 85 @ 55%", () => {
    const r = computeSettlement({
      itemSalePriceSgd: 85,
      sellerSharePct: 55,
      platformFeesSgd: demoPaymentFeeSgd(85),
    });
    expect(r.sellerBaseSgd).toBe(46.75);
    expect(r.fitarchiveGrossSgd).toBe(38.25);
    expect(r.fitarchiveContributionSgd).toBe(34.86);
  });

  it("referral share with no platform fee (external_manual): FA-011 SGD 28 @ 15%", () => {
    const r = computeSettlement({ itemSalePriceSgd: 28, sellerSharePct: 15 });
    expect(r.sellerBaseSgd).toBe(4.2);
    expect(r.fitarchiveGrossSgd).toBe(23.8);
    expect(r.fitarchiveContributionSgd).toBe(23.8);
  });

  it("fixed-amount agreement overrides percentage", () => {
    const r = computeSettlement({ itemSalePriceSgd: 100, sellerFixedAmountSgd: 30 });
    expect(r.sellerBaseSgd).toBe(30);
    expect(r.fitarchiveGrossSgd).toBe(70);
  });

  it("contribution subtracts shipping subsidy and campaign cost", () => {
    const r = computeSettlement({
      itemSalePriceSgd: 60,
      sellerSharePct: 60,
      platformFeesSgd: 2.54,
      shippingSubsidySgd: 2,
      campaignVariableCostSgd: 1.5,
    });
    expect(r.fitarchiveGrossSgd).toBe(24);
    expect(r.fitarchiveContributionSgd).toBe(17.96);
  });

  it("rejects agreements with neither share nor fixed amount", () => {
    expect(() => computeSettlement({ itemSalePriceSgd: 50 })).toThrow();
  });

  it("rejects out-of-range share percentages", () => {
    expect(() => computeSettlement({ itemSalePriceSgd: 50, sellerSharePct: 140 })).toThrow();
  });

  it("demo payment fee schedule: 3.4% + SGD 0.50", () => {
    expect(demoPaymentFeeSgd(68)).toBe(2.81);
    expect(demoPaymentFeeSgd(60)).toBe(2.54);
    expect(demoPaymentFeeSgd(45)).toBe(2.03);
  });
});
