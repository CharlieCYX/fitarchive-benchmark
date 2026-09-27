/**
 * Drop assortment summary (§7.5): price ladder + category/aesthetic/price
 * breakdown, computed live from drop items. Pure module.
 */

export interface AssortmentItem {
  productId: string;
  title: string;
  tier: "entry" | "core" | "hero";
  effectivePriceSgd: number | null;
  categoryLabel: string | null;
  aestheticLabels: string[];
  availability: string;
}

export interface PriceBand {
  label: string;
  count: number;
}

export interface AssortmentSummary {
  itemCount: number;
  byTier: Array<{ tier: string; count: number }>;
  byCategory: Array<{ label: string; count: number }>;
  byAesthetic: Array<{ label: string; count: number }>;
  priceBands: PriceBand[];
  priceRange: { min: number; max: number } | null;
  /** price ladder: items sorted by effective price ascending */
  ladder: Array<{ productId: string; title: string; tier: string; price: number | null }>;
}

/** SGD price bands tuned to the archive's range (seed band SGD 40–90). */
export function priceBandLabel(price: number): string {
  if (price < 40) return "< $40";
  if (price < 70) return "$40–69";
  if (price < 100) return "$70–99";
  if (price < 150) return "$100–149";
  return "≥ $150";
}

function tally(values: Array<string | null>): Array<{ label: string; count: number }> {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = v ?? "Uncategorized";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizeAssortment(items: AssortmentItem[]): AssortmentSummary {
  const priced = items
    .map((i) => i.effectivePriceSgd)
    .filter((p): p is number => p !== null && p > 0);

  const bandOrder = ["< $40", "$40–69", "$70–99", "$100–149", "≥ $150"];
  const bandMap = new Map<string, number>();
  for (const p of priced) {
    const b = priceBandLabel(p);
    bandMap.set(b, (bandMap.get(b) ?? 0) + 1);
  }

  const tierOrder = ["hero", "core", "entry"];

  return {
    itemCount: items.length,
    byTier: tally(items.map((i) => i.tier))
      .sort(
        (a, b) => tierOrder.indexOf(a.label) - tierOrder.indexOf(b.label),
      )
      .map((t) => ({ tier: t.label, count: t.count })),
    byCategory: tally(items.map((i) => i.categoryLabel)),
    byAesthetic: tally(items.flatMap((i) => i.aestheticLabels)).filter(
      (a) => a.label !== "Uncategorized",
    ),
    priceBands: bandOrder
      .filter((b) => bandMap.has(b))
      .map((label) => ({ label, count: bandMap.get(label) as number })),
    priceRange:
      priced.length > 0
        ? { min: Math.min(...priced), max: Math.max(...priced) }
        : null,
    ladder: [...items]
      .sort((a, b) => (a.effectivePriceSgd ?? Infinity) - (b.effectivePriceSgd ?? Infinity))
      .map((i) => ({
        productId: i.productId,
        title: i.title,
        tier: i.tier,
        price: i.effectivePriceSgd,
      })),
  };
}
