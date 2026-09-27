import type { StorefrontFilters } from "@/features/storefront/filters";

/**
 * Storefront filter bar (§8.1) — a plain GET form so every filter state is a
 * shareable URL and filtering happens server-side. Category / aesthetic /
 * material are controlled-vocabulary facets; colour is an honest text match
 * (no structured colour field in V1); size matches structured variant labels
 * when they exist.
 */
export function FilterBar({
  action,
  filters,
  facets,
  showQuery = false,
}: {
  action: string;
  filters: StorefrontFilters;
  facets: Record<"category" | "aesthetic" | "material", Array<{ slug: string; label: string }>>;
  showQuery?: boolean;
}) {
  const selectClass =
    "rounded-md border border-warm-300 bg-white px-2 py-1.5 text-sm text-ink";
  const inputClass =
    "w-24 rounded-md border border-warm-300 bg-white px-2 py-1.5 text-sm text-ink";

  return (
    <form
      action={action}
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-lg border border-warm-200 bg-white p-4"
    >
      {showQuery ? (
        <label className="flex flex-col gap-1 text-xs text-warm-500">
          Search
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="e.g. cropped wool jacket"
            className="w-56 rounded-md border border-warm-300 bg-white px-2 py-1.5 text-sm text-ink"
          />
        </label>
      ) : null}
      {(
        [
          ["category", "Category", facets.category],
          ["aesthetic", "Aesthetic", facets.aesthetic],
          ["material", "Material", facets.material],
        ] as const
      ).map(([name, label, options]) => (
        <label key={name} className="flex flex-col gap-1 text-xs text-warm-500">
          {label}
          <select name={name} defaultValue={filters[name] ?? ""} className={selectClass}>
            <option value="">All</option>
            {options.map((o) => (
              <option key={o.slug} value={o.slug}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="flex flex-col gap-1 text-xs text-warm-500">
        Colour (text match)
        <input
          type="text"
          name="color"
          defaultValue={filters.color ?? ""}
          placeholder="e.g. black"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-warm-500">
        Size (variant label)
        <input
          type="text"
          name="size"
          defaultValue={filters.size ?? ""}
          placeholder="e.g. M"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-warm-500">
        Min SGD
        <input
          type="number"
          name="min_price"
          min={0}
          defaultValue={filters.minPrice ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-warm-500">
        Max SGD
        <input
          type="number"
          name="max_price"
          min={0}
          defaultValue={filters.maxPrice ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-warm-500">
        Availability
        <select
          name="availability"
          defaultValue={filters.availability ?? ""}
          className={selectClass}
        >
          <option value="">All published</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold (archive)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-warm-500">
        Sort
        <select name="sort" defaultValue={filters.sort} className={selectClass}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
          <option value="title">Title A–Z</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-md bg-ink px-4 py-2 text-sm text-white hover:bg-ink-soft"
      >
        Apply
      </button>
    </form>
  );
}
