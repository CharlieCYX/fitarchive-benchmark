import type { Metadata } from "next";
import Link from "next/link";
import { ConnectSupabaseNotice } from "@/components/editorial/connect-supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";
import { canAccessArchive } from "@/lib/auth/roles";
import { formatDate, formatSgd } from "@/lib/utils";
import {
  addClosetItem,
  addStyleReference,
  createCollection,
  deleteClosetItem,
  deleteStyleReference,
  removeFavorite,
} from "@/features/archive/actions";
import {
  loadClosetItems,
  loadCollections,
  loadFavorites,
  loadSavedOutfits,
  loadStyleReferences,
} from "@/features/archive/service";
import { listStyleSessionsForProfile } from "@/features/style-engine/service";
import { CATEGORY_OPTIONS } from "@/features/style-engine/taxonomy-options";

export const metadata: Metadata = {
  title: "Archive",
  description: "Your private shopper archive — saved products, collections, closet, references and outfits.",
};
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

const STYLE_SESSION_MODE_LABELS: Record<string, string> = {
  build_my_fit: "Build My Fit",
  can_this_work: "Can This Work?",
  decode_reference: "Decode This Reference",
};

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const supabase = await getServerClient();
  if (!supabase) return <ConnectSupabaseNotice section="The Archive" />;

  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          title="The Archive is private — sign in first"
          description="Saved products, collections, your closet, decoded references and outfit boards live here, private by default. Sign in with the magic link to open yours."
          action={
            <Link href="/login" className="text-sm text-accent hover:text-accent-strong">
              Sign in →
            </Link>
          }
        />
      </div>
    );
  }
  if (!canAccessArchive(user.role)) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          title="Your role has no Archive"
          description="Viewer accounts are read-only for public surfaces. Ask the operator to switch your role if this is wrong."
        />
      </div>
    );
  }

  const params = await searchParams;
  const [favorites, collections, closet, references, outfits, sessions] =
    await Promise.all([
      loadFavorites(supabase, user.id),
      loadCollections(supabase, user.id),
      loadClosetItems(supabase, user.id),
      loadStyleReferences(supabase, user.id),
      loadSavedOutfits(supabase, user.id),
      listStyleSessionsForProfile(supabase, user.id),
    ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-tight text-ink">Your Archive</h1>
          <p className="mt-2 max-w-2xl text-sm text-warm-700">
            §8.2 — structured taste data, private by default. Collections only
            become visible to others when you explicitly share them.
          </p>
        </div>
        <Badge tone="neutral">Private by default</Badge>
      </div>

      {params.notice || params.error ? (
        <div
          role="status"
          className={`mt-6 rounded-md border px-4 py-3 text-sm ${
            params.error
              ? "border-danger/30 bg-danger/5 text-danger"
              : "border-success/30 bg-success/5 text-success"
          }`}
        >
          {params.error ?? params.notice}
        </div>
      ) : null}

      {/* ------------------------------ closet ------------------------------ */}
      <Card className="mt-8">
        <CardHeader
          title={`Closet (${closet.length})`}
          description="What you own — the style engine builds around these first. Never public."
        />
        <form action={addClosetItem} className="grid gap-3 sm:grid-cols-3">
          <FormField id="ci-title" label="Title">
            <Input id="ci-title" name="title" required placeholder="White ribbed tank" />
          </FormField>
          <FormField id="ci-category" label="Category">
            <select id="ci-category" name="category" className={inputClass}>
              <option value="">— uncategorized —</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </FormField>
          <FormField id="ci-color" label="Color">
            <Input id="ci-color" name="color" placeholder="white" />
          </FormField>
          <FormField id="ci-fit" label="Fit notes">
            <Input id="ci-fit" name="fit_notes" placeholder="runs long" />
          </FormField>
          <FormField id="ci-wear" label="Wear frequency">
            <select id="ci-wear" name="wear_frequency" className={inputClass}>
              <option value="">—</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="rarely">rarely</option>
            </select>
          </FormField>
          <FormField id="ci-source" label="Ownership">
            <select id="ci-source" name="ownership_source" className={inputClass}>
              <option value="owned">owned</option>
              <option value="borrowed">borrowed</option>
              <option value="borrowed_for_content">borrowed for content</option>
              <option value="on_loan">on loan</option>
            </select>
          </FormField>
          <div className="sm:col-span-3">
            <Button type="submit">Add closet item</Button>
          </div>
        </form>
        {closet.length > 0 ? (
          <ul className="mt-4 divide-y divide-warm-100">
            {closet.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span className="text-ink">
                  {item.title}
                  <span className="ml-2 text-xs text-warm-500">
                    {[item.category, item.color, item.fitNotes, item.wearFrequency && `worn ${item.wearFrequency}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <form action={deleteClosetItem}>
                  <input type="hidden" name="closet_item_id" value={item.id} />
                  <button type="submit" className="text-xs text-warm-500 hover:text-danger">
                    remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-warm-500">No closet items yet.</p>
        )}
      </Card>

      {/* --------------------------- saved products -------------------------- */}
      <Card className="mt-6">
        <CardHeader title={`Saved products (${favorites.length})`} description="From the storefront — saved pieces stay here even when they sell." />
        {favorites.length === 0 ? (
          <p className="text-xs text-warm-500">
            Nothing saved yet — browse <Link href="/drops" className="text-accent hover:text-accent-strong">the drop</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-warm-100">
            {favorites.map((fav) => (
              <li key={fav.favoriteId} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <span>
                  {fav.slug ? (
                    <Link href={`/products/${fav.slug}`} className="text-accent hover:text-accent-strong">
                      {fav.title}
                    </Link>
                  ) : (
                    <span className="text-ink">{fav.title}</span>
                  )}
                  <span className="ml-2 text-xs text-warm-500">
                    {formatSgd(fav.priceSgd)} · {fav.availability} · saved {formatDate(fav.createdAt)}
                  </span>
                </span>
                <form action={removeFavorite}>
                  <input type="hidden" name="favorite_id" value={fav.favoriteId} />
                  <button type="submit" className="text-xs text-warm-500 hover:text-danger">unsave</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------------------------- collections ---------------------------- */}
      <Card className="mt-6">
        <CardHeader title={`Collections (${collections.length})`} description="Boards of products + references. Private until you flip the share toggle on the collection page." />
        <form action={createCollection} className="grid gap-3 sm:grid-cols-2">
          <FormField id="col-title" label="Title">
            <Input id="col-title" name="title" required placeholder="SG layering ideas" />
          </FormField>
          <FormField id="col-desc" label="Description">
            <Input id="col-desc" name="description" placeholder="optional" />
          </FormField>
          <div>
            <Button type="submit">New collection</Button>
          </div>
        </form>
        {collections.length > 0 ? (
          <ul className="mt-4 divide-y divide-warm-100">
            {collections.map((col) => (
              <li key={col.id} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                <Link href={`/archive/collections/${col.id}`} className="text-accent hover:text-accent-strong">
                  {col.title}
                </Link>
                <span className="text-xs text-warm-500">
                  {col.itemCount} item(s) ·{" "}
                  <Badge tone={col.isPublic ? "warning" : "neutral"}>
                    {col.isPublic ? "public" : "private"}
                  </Badge>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* ---------------------------- references ----------------------------- */}
      <Card className="mt-6">
        <CardHeader
          title={`Style references (${references.length})`}
          description="Saved looks with decoded attributes — the raw material for Decode This Reference."
        />
        <form action={addStyleReference} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="ref-source" label="Source">
              <select id="ref-source" name="source" className={inputClass}>
                <option value="url">url</option>
                <option value="upload">upload</option>
              </select>
            </FormField>
            <FormField id="ref-url" label="URL">
              <Input id="ref-url" name="url" placeholder="https://…" />
            </FormField>
          </div>
          <FormField id="ref-note" label="Note">
            <Input id="ref-note" name="note" placeholder="Boxy jacket over wide trouser, monochrome" />
          </FormField>
          <FormField
            id="ref-attrs"
            label="Decoded attributes (one per line, dimension:value — e.g. silhouette:boxy)"
          >
            <textarea id="ref-attrs" name="attributes" rows={3} className={inputClass} />
          </FormField>
          <div>
            <Button type="submit">Save reference</Button>
          </div>
        </form>
        {references.length > 0 ? (
          <ul className="mt-4 divide-y divide-warm-100">
            {references.map((ref) => (
              <li key={ref.id} className="py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink">
                    {ref.url ? (
                      <a href={ref.url} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-strong">
                        {ref.note ?? ref.url}
                      </a>
                    ) : (
                      ref.note ?? "(reference)"
                    )}
                  </span>
                  <form action={deleteStyleReference}>
                    <input type="hidden" name="style_reference_id" value={ref.id} />
                    <button type="submit" className="text-xs text-warm-500 hover:text-danger">remove</button>
                  </form>
                </div>
                {ref.attributes.length > 0 ? (
                  <p className="mt-1 text-xs text-warm-500">
                    {ref.attributes
                      .map((a) => `${a.dimension}:${a.value}${a.source === "ai_suggestion" ? " (ai)" : ""}${a.confidence !== null ? ` ${a.confidence.toFixed(2)}` : ""}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* ------------------------------ outfits ------------------------------ */}
      <Card className="mt-6">
        <CardHeader title={`Saved outfit boards (${outfits.length})`} description="Saved from Build My Fit — owned, FitArchive and placeholder pieces together." />
        {outfits.length === 0 ? (
          <p className="text-xs text-warm-500">
            Nothing saved yet — run <Link href="/style/build" className="text-accent hover:text-accent-strong">Build My Fit</Link> and save the result.
          </p>
        ) : (
          <ul className="space-y-3">
            {outfits.map((outfit) => (
              <li key={outfit.id} className="rounded-md border border-warm-200 p-3">
                <p className="text-sm font-medium text-ink">{outfit.title}</p>
                {outfit.thesis ? <p className="mt-1 text-xs text-warm-700">{outfit.thesis}</p> : null}
                <p className="mt-1 text-xs text-warm-500">
                  {[outfit.occasion, outfit.climate].filter(Boolean).join(" · ")}
                </p>
                <ul className="mt-2 space-y-0.5 text-xs text-warm-700">
                  {outfit.items.map((item, i) => (
                    <li key={i}>
                      {item.href ? (
                        <Link href={item.href} className="text-accent hover:text-accent-strong">{item.label}</Link>
                      ) : (
                        item.label
                      )}
                      {item.role ? <span className="text-warm-500"> — {item.role}</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* --------------------------- style sessions -------------------------- */}
      <Card className="mt-6">
        <CardHeader title={`Style sessions (${sessions.length})`} description="Recent engine runs, including saved Can This Work? decisions." />
        {sessions.length === 0 ? (
          <p className="text-xs text-warm-500">
            No sessions yet — try <Link href="/style" className="text-accent hover:text-accent-strong">the Style Engine</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-warm-100">
            {sessions.map((session) => (
              <li key={session.id} className="py-2 text-sm">
                <span className="font-medium text-ink">
                  {STYLE_SESSION_MODE_LABELS[session.mode] ?? session.mode}
                </span>
                <span className="ml-2 text-xs text-warm-500">
                  {formatDate(session.created_at)} · {session.deterministic ? "deterministic" : "AI-narrated"}
                </span>
                {typeof session.result.verdict === "string" ? (
                  <p className="mt-0.5 text-xs text-warm-700">
                    Verdict: {session.result.verdict}
                    {Array.isArray(session.result.repairMoves)
                      ? ` — ${(session.result.repairMoves as string[])[0] ?? ""}`
                      : ""}
                  </p>
                ) : typeof session.result.thesis === "string" ? (
                  <p className="mt-0.5 text-xs text-warm-700">{session.result.thesis}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
