/**
 * Deterministic hard-constraint parser for /search (§9.3 fallback).
 * Extracts price constraints ("under $80", "over 50", "up to $120") and
 * category mentions (matched against ACTIVE category facets) from a free-text
 * query, returning the leftover free text. Pure module — unit-tested in
 * tests/unit/search-constraints.test.ts.
 *
 * This is NOT the natural-language layer; it only honors explicit, easily
 * verifiable constraint phrases and never guesses.
 */

export interface QueryConstraints {
  /** Free text that remains after constraint phrases are removed. */
  text: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  /** Category facet slug explicitly mentioned in the query. */
  category: string | null;
}

const MAX_PRICE_PATTERNS = [
  /\b(?:under|below|less than|up to|max(?:imum)?|at most|cheaper than)\s*(?:sgd\s*)?\$?\s*(\d+(?:\.\d{1,2})?)/i,
  /\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:sgd\s*)?(?:or less|or under|or cheaper)\b/i,
];

const MIN_PRICE_PATTERNS = [
  /\b(?:over|above|more than|at least|min(?:imum)?|from)\s*(?:sgd\s*)?\$?\s*(\d+(?:\.\d{1,2})?)/i,
  /\$?\s*(\d+(?:\.\d{1,2})?)\s*(?:sgd\s*)?(?:or more|and up|and above)\b/i,
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPrice(
  text: string,
  patterns: RegExp[],
): { text: string; value: number | null } {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) continue;
    return { text: text.replace(match[0], " "), value };
  }
  return { text, value: null };
}

/**
 * Parse a free-text query into hard constraints. Category matching is a
 * whole-word case-insensitive hit on an active facet's slug or label.
 */
export function parseQueryConstraints(
  query: string,
  categories: Array<{ slug: string; label: string }>,
): QueryConstraints {
  let text = query;

  const max = extractPrice(text, MAX_PRICE_PATTERNS);
  text = max.text;
  const min = extractPrice(text, MIN_PRICE_PATTERNS);
  text = min.text;

  let category: string | null = null;
  for (const facet of categories) {
    const terms = [facet.slug.replace(/-/g, " "), facet.label.toLowerCase()];
    for (const term of terms) {
      if (!term) continue;
      const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      if (re.test(text)) {
        category = facet.slug;
        text = text.replace(re, " ");
        break;
      }
    }
    if (category) break;
  }

  const leftover = text.replace(/\s+/g, " ").trim();
  return {
    text: leftover === "" ? null : leftover,
    minPrice: min.value,
    maxPrice: max.value,
    category,
  };
}
