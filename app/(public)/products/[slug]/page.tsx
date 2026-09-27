import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/db/server";
import {
  getPublishedProductBySlug,
  listPublishedProducts,
  relatedProducts,
} from "@/features/storefront/service";
import { ConnectSupabaseNotice } from "@/components/editorial/connect-supabase";
import {
  AVAILABILITY_LABELS,
  availabilityTone,
  CONDITION_LABELS,
  PhotoSlot,
  ProductCard,
} from "@/components/editorial/product-card";
import { Badge } from "@/components/ui/badge";
import { TrackEvent } from "@/components/editorial/track-event";
import { formatSgd } from "@/lib/utils";
import { ProductActions } from "./product-actions";

export const metadata: Metadata = { title: "Product" };

const PRODUCT_VIEW_SOURCES = ["drop_grid", "search", "direct", "referral"] as const;

/**
 * /products/[slug] — public product detail (§8.1, §10.5 product truth).
 * Unpublished/draft slugs 404. Condition, defects, measurements (unit +
 * method) and ownership wording are always stated; synthetic media is
 * disclosed when flagged.
 */
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const supabase = await getServerClient();
  if (!supabase) return <ConnectSupabaseNotice section="Product pages" />;

  const data = await getPublishedProductBySlug(supabase, slug);
  if (!data) notFound();

  const sp = await searchParams;
  const sourceRaw = Array.isArray(sp.source) ? sp.source[0] : sp.source;
  const source = (PRODUCT_VIEW_SOURCES as readonly string[]).includes(sourceRaw ?? "")
    ? (sourceRaw as (typeof PRODUCT_VIEW_SOURCES)[number])
    : "direct";

  const related = relatedProducts(await listPublishedProducts(supabase), data.item);
  const primaryDrop = data.drops[0] ?? null;
  const gallery = data.assets.length > 0 ? data.assets : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <TrackEvent
        event="product_view"
        properties={{
          product_id: data.item.id,
          drop_id: primaryDrop?.id ?? null,
          source,
        }}
      />

      <p className="text-xs text-warm-500">
        {primaryDrop ? (
          <Link href={`/drops/${primaryDrop.slug}`} className="hover:text-ink">
            ← {primaryDrop.name}
          </Link>
        ) : (
          <Link href="/drops" className="hover:text-ink">
            ← Drop archive
          </Link>
        )}
      </p>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        {/* Gallery — placeholder slots with alt text (storage upload is a
            later-phase integration; alt text is recorded on every asset). */}
        <div className="space-y-4">
          {gallery ? (
            gallery.map((asset, i) => (
              <PhotoSlot
                key={asset.id}
                alt={
                  asset.alt_text ??
                  `${data.item.title} — photo ${i + 1}`
                }
                className="aspect-[4/5] rounded-lg border border-warm-200"
              />
            ))
          ) : (
            <PhotoSlot
              alt={`${data.item.title} — photography pending`}
              className="aspect-[4/5] rounded-lg border border-dashed border-warm-300"
            />
          )}
          {data.syntheticMediaPresent ? (
            <p className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2 text-xs leading-relaxed text-accent">
              Disclosure: some imagery for this piece is synthetic / AI-assisted.
              Synthetic media never hides condition — defects are documented in
              text below.
            </p>
          ) : null}
        </div>

        {/* Facts */}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-warm-500">
            {data.item.categoryLabel ?? "Piece"} · {data.sku}
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight text-ink">
            {data.item.title}
          </h1>
          {data.item.brand ? (
            <p className="mt-1 text-sm text-warm-500">{data.item.brand}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-display text-2xl text-ink">
              {formatSgd(data.item.priceSgd)}
            </span>
            <Badge tone={availabilityTone(data.item.availability)}>
              {AVAILABILITY_LABELS[data.item.availability] ?? data.item.availability}
            </Badge>
            {data.item.conditionGrade ? (
              <Badge>
                {CONDITION_LABELS[data.item.conditionGrade] ?? data.item.conditionGrade}
              </Badge>
            ) : null}
          </div>

          {/* Ownership wording — honest operating model (§10.5, §15.3) */}
          <div className="mt-6 rounded-lg border border-warm-200 bg-warm-100/50 px-4 py-3">
            <p className="text-sm font-medium text-ink">{data.ownership.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-warm-700">
              {data.ownership.description}
            </p>
          </div>

          {data.item.description ? (
            <p className="mt-6 text-sm leading-relaxed text-warm-700">
              {data.item.description}
            </p>
          ) : null}

          {data.defectNotes ? (
            <div className="mt-4">
              <h2 className="text-xs font-medium uppercase tracking-wide text-warm-500">
                Condition notes / defects
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-warm-700">
                {data.defectNotes}
              </p>
            </div>
          ) : null}

          {data.measurements.length > 0 ? (
            <div className="mt-6">
              <h2 className="text-xs font-medium uppercase tracking-wide text-warm-500">
                Measurements
              </h2>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {data.measurements.map((m) => (
                    <tr key={m.id} className="border-b border-warm-200 last:border-0">
                      <th className="py-1.5 pr-4 text-left font-normal text-warm-700">
                        {m.name}
                      </th>
                      <td className="py-1.5 text-ink">
                        {m.value} {m.unit}
                      </td>
                      <td className="py-1.5 text-right text-xs text-warm-500">
                        {m.method ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-8">
            <ProductActions
              productId={data.item.id}
              productSlug={data.item.slug}
              productTitle={data.item.title}
              availability={data.item.availability}
              purchaseMode={data.ownership.purchaseMode}
              referral={data.referral}
            />
          </div>
        </div>
      </div>

      {/* Related pieces */}
      {related.length > 0 ? (
        <section className="mt-20 border-t border-warm-200 pt-10">
          <h2 className="font-display text-2xl text-ink">Related pieces</h2>
          <ul className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
