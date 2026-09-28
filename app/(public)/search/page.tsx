import type { Metadata } from "next";
import { getServerClient } from "@/lib/db/server";
import {
  listFilterFacets,
  listPublishedProducts,
} from "@/features/storefront/service";
import {
  applyStorefrontFilters,
  parseStorefrontFilters,
  serializeFilters,
  type StorefrontFilters,
} from "@/features/storefront/filters";
import { parseQueryConstraints } from "@/features/storefront/query-parse";
import { ConnectSupabaseNotice } from "@/components/editorial/connect-supabase";
import { FilterBar } from "@/components/editorial/filter-bar";
import { SearchResults } from "./search-results";

export const metadata: Metadata = {
  title: "Search",
  description:
    "Deterministic filter + text search over the published FitArchive catalog.",
};

/**
 * /search — deterministic filter + text match over the published catalog
 * (§9.3 deterministic fallback). The query box additionally understands
 * explicit hard constraints — price ("under $80", "over 50") and category
 * names matched against active facets — parsed deterministically into the
 * same filter shape (features/storefront/query-parse.ts). `search_submit` /
 * `search_result_click` events are wired (EVENTS §1).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) return <ConnectSupabaseNotice section="Search" />;

  const parsed = parseStorefrontFilters(await searchParams);
  const [all, facets] = await Promise.all([
    listPublishedProducts(supabase),
    listFilterFacets(supabase),
  ]);

  // Hard-constraint parse of the free-text query (§9.3): explicit URL filter
  // params always win over constraints extracted from the text.
  let filters: StorefrontFilters = parsed;
  let parsedFromQuery: string[] = [];
  if (parsed.q) {
    const constraints = parseQueryConstraints(parsed.q, facets.category);
    parsedFromQuery = [
      constraints.maxPrice !== null && parsed.maxPrice === null
        ? `under $${constraints.maxPrice}`
        : null,
      constraints.minPrice !== null && parsed.minPrice === null
        ? `over $${constraints.minPrice}`
        : null,
      constraints.category && parsed.category === null
        ? `category: ${constraints.category}`
        : null,
    ].filter((s): s is string => s !== null);
    filters = {
      ...parsed,
      q: constraints.text,
      maxPrice: parsed.maxPrice ?? constraints.maxPrice,
      minPrice: parsed.minPrice ?? constraints.minPrice,
      category: parsed.category ?? constraints.category,
    };
  }

  const results = applyStorefrontFilters(all, filters);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-warm-500">Search</p>
      <h1 className="mt-4 font-display text-4xl text-ink">Find a piece.</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-warm-700">
        Deterministic filter + text match over the published catalog — what
        you type is exactly what is matched, no hidden ranking. The query box
        understands simple hard constraints like &ldquo;outerwear under
        $80&rdquo; or &ldquo;linen dresses over $50&rdquo;: price and category
        phrases are parsed into the filters below, the rest stays free text.
      </p>
      {parsedFromQuery.length > 0 ? (
        <p className="mt-2 text-xs text-warm-500">
          Parsed from your query: {parsedFromQuery.join(" · ")}
        </p>
      ) : null}

      <div className="mt-8">
        <FilterBar action="/search" filters={filters} facets={facets} showQuery />
      </div>

      <SearchResults
        items={results.map((item) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          brand: item.brand,
          priceLabel:
            item.priceSgd === null
              ? "—"
              : new Intl.NumberFormat("en-SG", {
                  style: "currency",
                  currency: "SGD",
                }).format(item.priceSgd),
          availability: item.availability,
          conditionLabel: item.conditionGrade,
          categoryLabel: item.categoryLabel,
        }))}
        query={filters.q ?? ""}
        parsedFilters={serializeFilters(filters)}
        resultCount={results.length}
      />
    </div>
  );
}
