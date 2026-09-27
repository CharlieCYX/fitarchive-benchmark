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
} from "@/features/storefront/filters";
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
 * (§9.3 deterministic fallback). The natural-language AI parse layer lands
 * in Phase 6/7 and will translate queries INTO this same filter shape; this
 * page stays the honest fallback. `search_submit` / `search_result_click`
 * events are wired (EVENTS §1).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) return <ConnectSupabaseNotice section="Search" />;

  const filters = parseStorefrontFilters(await searchParams);
  const [all, facets] = await Promise.all([
    listPublishedProducts(supabase),
    listFilterFacets(supabase),
  ]);
  const results = applyStorefrontFilters(all, filters);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-warm-500">Search</p>
      <h1 className="mt-4 font-display text-4xl text-ink">Find a piece.</h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-warm-700">
        Deterministic filter + text match over the published catalog — what you
        type is exactly what is matched, no hidden ranking. Natural-language
        search (&ldquo;a cropped boxy jacket for hot-humid days under
        $80&rdquo;) arrives in Phase 6/7 and will plug into this same filter
        shape.
      </p>

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
