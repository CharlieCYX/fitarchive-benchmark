import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatSgd } from "@/lib/utils";
import type { StorefrontItem } from "@/features/storefront/filters";

export const CONDITION_LABELS: Record<string, string> = {
  new_unworn: "New / unworn",
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  project_repair: "Project / repair",
};

export const AVAILABILITY_LABELS: Record<string, string> = {
  draft: "Draft",
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  withdrawn: "Withdrawn",
};

export function availabilityTone(
  availability: string,
): "success" | "warning" | "neutral" {
  if (availability === "available") return "success";
  if (availability === "reserved") return "warning";
  return "neutral";
}

/**
 * Photo placeholder slot (§8.1 alt-text workflow): product_assets carry
 * alt text + provenance, but binary storage upload is a later-phase
 * integration — so the slot renders the alt text honestly instead of a
 * broken <img> or a fake image.
 */
export function PhotoSlot({
  alt,
  className,
}: {
  alt: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center bg-warm-100 text-center ${className ?? ""}`}
    >
      <span className="max-w-[85%] text-[11px] leading-snug text-warm-500">
        {alt}
      </span>
    </div>
  );
}

/** Editorial product card for drop/search grids (server-rendered). */
export function ProductCard({
  item,
  badge,
  altText,
}: {
  item: StorefrontItem;
  /** Extra badge, e.g. the drop tier. */
  badge?: string;
  altText?: string | null;
}) {
  return (
    <li className="group">
      <Link href={`/products/${item.slug}`} className="block">
        <PhotoSlot
          alt={altText ?? `${item.title}${item.brand ? ` by ${item.brand}` : ""} — product photo`}
          className="aspect-[4/5] rounded-md border border-warm-200 transition-colors group-hover:border-warm-300"
        />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base leading-snug text-ink group-hover:text-accent">
              {item.title}
            </h3>
            {item.brand ? (
              <p className="mt-0.5 text-xs text-warm-500">{item.brand}</p>
            ) : null}
          </div>
          <p className="shrink-0 text-sm text-ink">{formatSgd(item.priceSgd)}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {badge ? <Badge tone="accent">{badge}</Badge> : null}
          {item.conditionGrade ? (
            <Badge>{CONDITION_LABELS[item.conditionGrade] ?? item.conditionGrade}</Badge>
          ) : null}
          <Badge tone={availabilityTone(item.availability)}>
            {AVAILABILITY_LABELS[item.availability] ?? item.availability}
          </Badge>
        </div>
      </Link>
    </li>
  );
}
