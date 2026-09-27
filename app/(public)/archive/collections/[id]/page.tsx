import type { Metadata } from "next";
import Link from "next/link";
import { ConnectSupabaseNotice } from "@/components/editorial/connect-supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";
import { formatSgd } from "@/lib/utils";
import {
  addCollectionItem,
  removeCollectionItem,
  toggleCollectionPublic,
} from "@/features/archive/actions";
import { loadCollectionDetail, loadFavorites, loadStyleReferences } from "@/features/archive/service";

export const metadata: Metadata = { title: "Collection" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { id } = await params;
  const supabase = await getServerClient();
  if (!supabase) return <ConnectSupabaseNotice section="Collections" />;

  const user = await getSessionUser();
  const detail = await loadCollectionDetail(supabase, id, user?.id ?? null);
  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          title="Collection not found"
          description="It may be private (collections are private by default) or deleted. If it's yours, sign in to see it."
          action={
            <Link href="/archive" className="text-sm text-accent hover:text-accent-strong">
              Back to Archive →
            </Link>
          }
        />
      </div>
    );
  }

  const sp = await searchParams;
  const [favorites, references] = detail.ownedByViewer
    ? await Promise.all([
        loadFavorites(supabase, user!.id),
        loadStyleReferences(supabase, user!.id),
      ])
    : [[], []];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-xs uppercase tracking-wide text-warm-500">
        <Link href="/archive" className="hover:text-ink">Archive</Link> / Collection
      </p>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl tracking-tight text-ink">{detail.title}</h1>
        <Badge tone={detail.isPublic ? "warning" : "neutral"}>
          {detail.isPublic ? "public" : "private"}
        </Badge>
      </div>
      {detail.description ? (
        <p className="mt-2 text-sm text-warm-700">{detail.description}</p>
      ) : null}

      {sp.notice || sp.error ? (
        <div
          role="status"
          className={`mt-6 rounded-md border px-4 py-3 text-sm ${
            sp.error
              ? "border-danger/30 bg-danger/5 text-danger"
              : "border-success/30 bg-success/5 text-success"
          }`}
        >
          {sp.error ?? sp.notice}
        </div>
      ) : null}

      {detail.ownedByViewer ? (
        <form action={toggleCollectionPublic} className="mt-4">
          <input type="hidden" name="collection_id" value={detail.id} />
          <Button type="submit" variant="secondary">
            {detail.isPublic ? "Make private" : "Share publicly"}
          </Button>
          <p className="mt-1 text-xs text-warm-500">
            Sharing is explicit — nothing in your Archive is public unless you toggle it.
          </p>
        </form>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-ink">Items ({detail.items.length})</h2>
        {detail.items.length === 0 ? (
          <p className="mt-2 text-xs text-warm-500">Empty board — add saved products or references below.</p>
        ) : (
          <ul className="mt-2 divide-y divide-warm-100">
            {detail.items.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span>
                  {item.product ? (
                    <Link href={`/products/${item.product.slug}`} className="text-accent hover:text-accent-strong">
                      {item.product.title}
                    </Link>
                  ) : (
                    <span className="text-ink">{item.reference?.note ?? "reference"}</span>
                  )}
                  <span className="ml-2 text-xs text-warm-500">
                    {item.product ? formatSgd(item.product.priceSgd) : "reference"}
                    {item.note ? ` · ${item.note}` : ""}
                  </span>
                </span>
                {detail.ownedByViewer ? (
                  <form action={removeCollectionItem}>
                    <input type="hidden" name="collection_id" value={detail.id} />
                    <input type="hidden" name="collection_item_id" value={item.id} />
                    <button type="submit" className="text-xs text-warm-500 hover:text-danger">remove</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.ownedByViewer ? (
        <section className="mt-8 border-t border-warm-200 pt-6">
          <h2 className="text-sm font-medium text-ink">Add to this collection</h2>
          <form action={addCollectionItem} className="mt-3 grid gap-3">
            <input type="hidden" name="collection_id" value={detail.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="add-product" label="Saved product">
                <select id="add-product" name="product_id" className={inputClass}>
                  <option value="">— none —</option>
                  {favorites.map((fav) => (
                    <option key={fav.productId} value={fav.productId}>
                      {fav.title}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="add-ref" label="Style reference">
                <select id="add-ref" name="style_reference_id" className={inputClass}>
                  <option value="">— none —</option>
                  {references.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.note ?? ref.url ?? ref.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField id="add-note" label="Note (optional)">
              <Input id="add-note" name="note" placeholder="Mood anchor" />
            </FormField>
            <div>
              <Button type="submit">Add item</Button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
