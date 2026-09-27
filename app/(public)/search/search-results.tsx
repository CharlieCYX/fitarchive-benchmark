"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/events/track";

export interface SearchResultItem {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  priceLabel: string;
  availability: string;
  conditionLabel: string | null;
  categoryLabel: string | null;
}

/**
 * Search results grid + event wiring (EVENTS §1): fires one `search_submit`
 * per distinct query state (carrying query, parsed_filters, result_count) and
 * a `search_result_click` per click, linked by the submit event's id when the
 * ingest API returned one (fire-and-forget otherwise — never blocks nav).
 */
export function SearchResults({
  items,
  query,
  parsedFilters,
  resultCount,
}: {
  items: SearchResultItem[];
  query: string;
  parsedFilters: Record<string, string | number>;
  resultCount: number;
}) {
  const [queryEventId, setQueryEventId] = useState<string | null>(null);
  const submitKey = JSON.stringify({ query, parsedFilters, resultCount });
  const lastSubmit = useRef<string | null>(null);

  useEffect(() => {
    if (lastSubmit.current === submitKey) return;
    lastSubmit.current = submitKey;
    const { query: q, parsedFilters: pf, resultCount: rc } = JSON.parse(
      submitKey,
    ) as {
      query: string;
      parsedFilters: Record<string, string | number>;
      resultCount: number;
    };
    setQueryEventId(null);
    void trackEvent("search_submit", {
      query: q,
      parsed_filters: pf,
      result_count: rc,
    }).then(setQueryEventId);
  }, [submitKey]);

  function onResultClick(productId: string, position: number) {
    if (!queryEventId) return;
    void trackEvent("search_result_click", {
      query_id: queryEventId,
      product_id: productId,
      position,
    });
  }

  if (items.length === 0) {
    return (
      <div className="mt-10 rounded-lg border border-dashed border-warm-300 bg-warm-100/50 px-6 py-12 text-center">
        <h2 className="font-display text-lg text-ink">No published pieces match</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-warm-700">
          Try fewer filters or broader terms. Only published pieces are
          searchable — drafts and withdrawn items never appear.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-10">
      <p className="text-xs text-warm-500">
        {resultCount} result{resultCount === 1 ? "" : "s"}
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item, position) => (
          <li key={item.id}>
            <Link
              href={`/products/${item.slug}?source=search`}
              onClick={() => onResultClick(item.id, position)}
              className="group block"
            >
              <div
                role="img"
                aria-label={`${item.title}${item.brand ? ` by ${item.brand}` : ""} — product photo`}
                className="flex aspect-[4/5] items-center justify-center rounded-md border border-warm-200 bg-warm-100 text-center transition-colors group-hover:border-warm-300"
              >
                <span className="max-w-[85%] text-[11px] leading-snug text-warm-500">
                  {item.title}
                  {item.brand ? ` — ${item.brand}` : ""}
                </span>
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-base leading-snug text-ink group-hover:text-accent">
                    {item.title}
                  </h3>
                  {item.brand ? (
                    <p className="mt-0.5 text-xs text-warm-500">{item.brand}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm text-ink">{item.priceLabel}</p>
              </div>
              <p className="mt-1 text-xs text-warm-500">
                {[item.categoryLabel, item.conditionLabel, item.availability]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
