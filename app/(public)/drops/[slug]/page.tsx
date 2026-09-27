import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/db/server";
import {
  getDropStorefrontItems,
  getPublishedDropBySlug,
  listFilterFacets,
} from "@/features/storefront/service";
import {
  applyStorefrontFilters,
  parseStorefrontFilters,
} from "@/features/storefront/filters";
import { ConnectSupabaseNotice } from "@/components/editorial/connect-supabase";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/editorial/filter-bar";
import { ProductCard } from "@/components/editorial/product-card";
import { TrackEvent, TrackImpressions } from "@/components/editorial/track-event";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Drop" };

const TIER_LABELS: Record<string, string> = {
  hero: "Hero",
  core: "Core",
  entry: "Entry",
};

/**
 * /drops/[slug] — drop story + product grid (§8.1). Unpublished or unknown
 * slugs 404. Filters/sort are server-side query params (shareable URLs).
 */
export default async function DropPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const supabase = await getServerClient();
  if (!supabase) return <ConnectSupabaseNotice section="This drop" />;

  const drop = await getPublishedDropBySlug(supabase, slug);
  if (!drop) notFound();

  const filters = parseStorefrontFilters(await searchParams);
  const [dropItems, facets] = await Promise.all([
    getDropStorefrontItems(supabase, drop.id),
    listFilterFacets(supabase),
  ]);
  const filtered = applyStorefrontFilters(
    dropItems.map((d) => d.item),
    filters,
  );
  const metaById = new Map(dropItems.map((d) => [d.item.id, d]));

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <TrackEvent event="drop_view" properties={{ drop_id: drop.id }} />

      {/* Drop story (§8.1: campaign narrative, not a bare grid) */}
      <p className="text-xs uppercase tracking-[0.2em] text-warm-500">
        Published {formatDate(drop.published_at)}
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-ink">
        {drop.name}
      </h1>
      {drop.concept ? (
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          {drop.concept}
        </p>
      ) : null}
      {drop.story ? (
        <p className="mt-4 max-w-xl text-base leading-relaxed text-warm-700">
          {drop.story}
        </p>
      ) : null}
      {drop.hypothesis_summary ? (
        <p className="mt-6 max-w-xl border-l-2 border-accent pl-4 text-sm leading-relaxed text-warm-700">
          <span className="font-medium text-ink">The hypothesis:</span>{" "}
          {drop.hypothesis_summary}
        </p>
      ) : null}

      {/* Product grid with server-side filters */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-ink">The pieces</h2>
          <p className="text-xs text-warm-500">
            {filtered.length} of {dropItems.length} shown
          </p>
        </div>
        <div className="mt-6">
          <FilterBar action={`/drops/${drop.slug}`} filters={filters} facets={facets} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            className="mt-8"
            title="Nothing matches those filters"
            description="Loosen a filter or clear the search — the drop only contains what passed the readiness gate."
          />
        ) : (
          <>
            <TrackImpressions
              items={filtered.map((item) => ({
                product_id: item.id,
                drop_id: drop.id,
              }))}
            />
            <ul className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  badge={TIER_LABELS[metaById.get(item.id)?.tier ?? "core"]}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
