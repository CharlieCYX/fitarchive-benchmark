import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatSgd } from "@/lib/utils";
import {
  addHypothesis,
  addItem,
  cloneDropAction,
  publishDropAction,
  removeItem,
  saveDrop,
  unpublishDrop,
  updateItem,
} from "@/features/drops/actions";
import { getDropDetail } from "@/features/drops/service";
import { summarizeAssortment } from "@/features/drops/assortment";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Drop detail" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function DropDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Drop Builder"
        spec="§7.5"
        summary="Drop detail, assortment, readiness gate and publish."
      />
    );
  }

  const [{ id }, bannerParams] = await Promise.all([params, searchParams]);
  const [detail, { data: availableProducts }, { data: insightOptions }] = await Promise.all([
    getDropDetail(supabase, id),
    supabase
      .from("products")
      .select("id, sku, title, availability")
      .in("availability", ["draft", "available"])
      .order("sku")
      .limit(200),
    // §9.2 link: hypotheses can descend from recorded insights.
    supabase
      .from("insights")
      .select("id, title, type")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (!detail) notFound();

  const { drop, readiness } = detail;
  const summary = summarizeAssortment(detail.assortmentItems);
  const inDrop = new Set(detail.items.map((i) => i.product_id));
  const candidates = ((availableProducts ?? []) as Array<{
    id: string;
    sku: string;
    title: string;
    availability: string;
  }>).filter((p) => !inDrop.has(p.id));
  const published = drop.status === "published";

  return (
    <div className="max-w-6xl">
      <Link href="/studio/drops" className="text-sm text-warm-500 hover:text-ink">
        ← Drops
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">{drop.name}</h1>
        <Badge tone={published ? "success" : "neutral"}>{drop.status}</Badge>
        {detail.clonedFromName ? (
          <span className="text-sm text-warm-500">
            cloned from{" "}
            <Link href={`/studio/drops/${drop.cloned_from_id}`} className="text-accent hover:text-accent-strong">
              {detail.clonedFromName}
            </Link>
          </span>
        ) : null}
      </div>
      {detail.cloneNames.length > 0 ? (
        <p className="mt-1 text-sm text-warm-500">
          Clones:{" "}
          {detail.cloneNames.map((c, i) => (
            <span key={c.id}>
              {i > 0 ? ", " : ""}
              <Link href={`/studio/drops/${c.id}`} className="text-accent hover:text-accent-strong">
                {c.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      <MessageBanner searchParams={bannerParams} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Concept, story & hypothesis" description="Every drop is an experiment (§7.5)." />
          <form action={saveDrop} className="grid gap-4">
            <input type="hidden" name="drop_id" value={drop.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="name" label="Name">
                <Input id="name" name="name" defaultValue={drop.name} required />
              </FormField>
              <FormField id="target_size_min" label="Target min">
                <Input id="target_size_min" name="target_size_min" type="number" min="1" defaultValue={drop.target_size_min ?? ""} />
              </FormField>
              <FormField id="target_size_max" label="Target max">
                <Input id="target_size_max" name="target_size_max" type="number" min="1" defaultValue={drop.target_size_max ?? ""} />
              </FormField>
            </div>
            <FormField id="concept" label="Concept">
              <textarea id="concept" name="concept" rows={2} defaultValue={drop.concept ?? ""} className={inputClass} />
            </FormField>
            <FormField id="story" label="Story">
              <textarea id="story" name="story" rows={3} defaultValue={drop.story ?? ""} className={inputClass} />
            </FormField>
            <FormField id="hypothesis_summary" label="Hypothesis" hint="What do we expect to learn? (§9.2 language discipline)">
              <textarea id="hypothesis_summary" name="hypothesis_summary" rows={2} defaultValue={drop.hypothesis_summary ?? ""} className={inputClass} />
            </FormField>
            <FormField id="launch_at" label="Launch at">
              <Input id="launch_at" name="launch_at" type="datetime-local" defaultValue={drop.launch_at ? drop.launch_at.slice(0, 16) : ""} />
            </FormField>
            <div>
              <Button type="submit">Save drop</Button>
            </div>
          </form>
          <form action={cloneDropAction} className="mt-4 border-t border-warm-200 pt-4">
            <input type="hidden" name="drop_id" value={drop.id} />
            <Button type="submit" variant="secondary" size="sm">
              Clone to next drop
            </Button>
            <p className="mt-1 text-xs text-warm-500">
              Copies concept, story, targets and hypotheses; keeps the cloned_from comparison link (§7.5).
            </p>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Readiness checklist (§10.2)"
            description="16 checks, computed live. Manual checks are attestations given in the publish form — never assumed."
          />
          <ul className="space-y-1.5 text-sm">
            {readiness.checks.map((check) => (
              <li key={check.key} className="flex items-start gap-2">
                <span aria-hidden>{check.passed ? "✅" : "⬜"}</span>
                <div>
                  <span className={check.passed ? "text-ink" : "font-medium text-ink"}>
                    {check.label}
                  </span>
                  {check.manual ? <Badge tone="info" className="ml-2">attestation</Badge> : null}
                  <p className="text-xs text-warm-500">{check.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          {published ? (
            <form action={unpublishDrop} className="mt-4 border-t border-warm-200 pt-4">
              <input type="hidden" name="drop_id" value={drop.id} />
              <Button type="submit" variant="secondary" size="sm">
                Pause / unpublish drop (rollback)
              </Button>
            </form>
          ) : (
            <form action={publishDropAction} className="mt-4 space-y-3 border-t border-warm-200 pt-4">
              <input type="hidden" name="drop_id" value={drop.id} />
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" name="attest_personas" className="mt-0.5 h-4 w-4" />
                Target personas are documented for this drop (check 2).
              </label>
              <label className="flex items-start gap-2 text-sm text-ink">
                <input type="checkbox" name="attest_rollback" className="mt-0.5 h-4 w-4" />
                Rollback path verified — I can pause/unpublish immediately (check 16).
              </label>
              <Button type="submit">Run gate & publish</Button>
              <p className="text-xs text-warm-500">
                Publish re-evaluates all 16 checks server-side and blocks with reasons when any fail.
              </p>
            </form>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Assortment" description="Add, tier, reorder and price items. Effective price = override ?? product price." />
        {detail.items.length === 0 ? (
          <p className="text-sm text-warm-500">No items yet — add the first below.</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm text-ink">
            <thead className="border-b border-warm-200 text-xs uppercase tracking-wide text-warm-500">
              <tr>
                <th className="px-2 py-2 font-medium">Order</th>
                <th className="px-2 py-2 font-medium">Item</th>
                <th className="px-2 py-2 font-medium">Tier</th>
                <th className="px-2 py-2 font-medium">Price override</th>
                <th className="px-2 py-2 font-medium">Availability</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-200">
              {detail.items.map((item, index) => (
                <tr key={item.drop_item_id} className="align-middle">
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <form action={updateItem}>
                        <input type="hidden" name="drop_item_id" value={item.drop_item_id} />
                        <input type="hidden" name="drop_id" value={drop.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button type="submit" disabled={index === 0} className="px-1 text-warm-500 hover:text-ink disabled:opacity-30" aria-label="Move up">
                          ↑
                        </button>
                      </form>
                      <form action={updateItem}>
                        <input type="hidden" name="drop_item_id" value={item.drop_item_id} />
                        <input type="hidden" name="drop_id" value={drop.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button type="submit" disabled={index === detail.items.length - 1} className="px-1 text-warm-500 hover:text-ink disabled:opacity-30" aria-label="Move down">
                          ↓
                        </button>
                      </form>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <Link href={`/studio/catalog/${item.product_id}`} className="font-medium text-accent hover:text-accent-strong">
                      {item.sku} · {item.title}
                    </Link>
                    {item.category_label ? (
                      <span className="ml-2 text-xs text-warm-500">{item.category_label}</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <form action={updateItem} className="flex items-center gap-1">
                      <input type="hidden" name="drop_item_id" value={item.drop_item_id} />
                      <input type="hidden" name="drop_id" value={drop.id} />
                      <select name="tier" defaultValue={item.tier} className="rounded-md border border-warm-300 bg-white px-2 py-1 text-sm">
                        <option value="entry">entry</option>
                        <option value="core">core</option>
                        <option value="hero">hero</option>
                      </select>
                      <button type="submit" className="text-xs text-accent hover:text-accent-strong">
                        set
                      </button>
                    </form>
                  </td>
                  <td className="px-2 py-2">
                    <form action={updateItem} className="flex items-center gap-1">
                      <input type="hidden" name="drop_item_id" value={item.drop_item_id} />
                      <input type="hidden" name="drop_id" value={drop.id} />
                      <input
                        type="number"
                        name="price_override_sgd"
                        min="0"
                        step="0.01"
                        placeholder={item.public_price_sgd ?? ""}
                        defaultValue={item.price_override_sgd ?? ""}
                        className="w-24 rounded-md border border-warm-300 bg-white px-2 py-1 text-sm"
                      />
                      <button type="submit" className="text-xs text-accent hover:text-accent-strong">
                        set
                      </button>
                    </form>
                  </td>
                  <td className="px-2 py-2">
                    <Badge tone={item.availability === "available" ? "success" : "warning"}>
                      {item.availability}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">
                    <form action={removeItem}>
                      <input type="hidden" name="drop_item_id" value={item.drop_item_id} />
                      <input type="hidden" name="drop_id" value={drop.id} />
                      <button type="submit" className="text-xs text-danger hover:underline">
                        remove
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addItem} className="mt-4 grid grid-cols-[1fr_120px_140px_auto] items-end gap-2 border-t border-warm-200 pt-4">
          <input type="hidden" name="drop_id" value={drop.id} />
          <FormField id="add-product" label="Add product">
            <select id="add-product" name="product_id" className={inputClass} required>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.title} ({p.availability})
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="add-tier" label="Tier">
            <select id="add-tier" name="tier" className={inputClass} defaultValue="core">
              <option value="entry">entry</option>
              <option value="core">core</option>
              <option value="hero">hero</option>
            </select>
          </FormField>
          <FormField id="add-price" label="Price override">
            <Input id="add-price" name="price_override_sgd" type="number" min="0" step="0.01" />
          </FormField>
          <Button type="submit" variant="secondary" size="sm">
            Add
          </Button>
        </form>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Assortment summary" description="Live breakdown — updates as you edit." />
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <h4 className="text-xs uppercase tracking-wide text-warm-500">By tier</h4>
              <ul className="mt-1 space-y-0.5">
                {summary.byTier.map((t) => (
                  <li key={t.tier} className="text-ink">{t.tier}: {t.count}</li>
                ))}
              </ul>
              <h4 className="mt-3 text-xs uppercase tracking-wide text-warm-500">By category</h4>
              <ul className="mt-1 space-y-0.5">
                {summary.byCategory.map((c) => (
                  <li key={c.label} className="text-ink">{c.label}: {c.count}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs uppercase tracking-wide text-warm-500">By aesthetic</h4>
              {summary.byAesthetic.length === 0 ? (
                <p className="mt-1 text-warm-500">No aesthetic tags on items.</p>
              ) : (
                <ul className="mt-1 space-y-0.5">
                  {summary.byAesthetic.map((a) => (
                    <li key={a.label} className="text-ink">{a.label}: {a.count}</li>
                  ))}
                </ul>
              )}
              <h4 className="mt-3 text-xs uppercase tracking-wide text-warm-500">Price bands</h4>
              <ul className="mt-1 space-y-0.5">
                {summary.priceBands.map((b) => (
                  <li key={b.label} className="text-ink">{b.label}: {b.count}</li>
                ))}
              </ul>
              {summary.priceRange ? (
                <p className="mt-2 text-warm-700">
                  Range {formatSgd(summary.priceRange.min)}–{formatSgd(summary.priceRange.max)}
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Price ladder" description="Sorted by effective price." />
          {summary.ladder.length === 0 ? (
            <p className="text-sm text-warm-500">No items yet.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {summary.ladder.map((item) => (
                <li key={item.productId} className="flex items-center justify-between border-b border-warm-200 pb-1 last:border-0">
                  <span className="text-ink">
                    {item.title} <span className="text-xs text-warm-500">({item.tier})</span>
                  </span>
                  <span className="text-ink">{formatSgd(item.price)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Hypotheses" description="Statements this drop tests (§9.2). Clones carry these forward." />
        {detail.hypotheses.length === 0 ? (
          <p className="text-sm text-warm-500">No hypotheses recorded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.hypotheses.map((h) => (
              <li key={h.id} className="border-b border-warm-200 pb-2 last:border-0">
                <p className="text-ink">{h.statement}</p>
                {h.expected_outcome ? (
                  <p className="text-xs text-warm-500">Expected: {h.expected_outcome}</p>
                ) : null}
                {h.evidence_basis ? (
                  <p className="text-xs text-warm-500">Evidence: {h.evidence_basis}</p>
                ) : null}
                {h.linked_insight_title ? (
                  <p className="text-xs text-warm-500">
                    Linked insight: {h.linked_insight_title}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <form action={addHypothesis} className="mt-4 grid gap-3 border-t border-warm-200 pt-4">
          <input type="hidden" name="drop_id" value={drop.id} />
          <FormField id="h-statement" label="Statement">
            <Input id="h-statement" name="statement" required placeholder="Cropped silhouettes outsell oversized in the 40–90 band" />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="h-expected" label="Expected outcome">
              <Input id="h-expected" name="expected_outcome" placeholder="≥60% sell-through in 3 weeks" />
            </FormField>
            <FormField id="h-evidence" label="Evidence basis">
              <Input id="h-evidence" name="evidence_basis" placeholder="Drop #001 sell-through + observation log" />
            </FormField>
          </div>
          <FormField id="h-insight" label="Linked insight" hint="Optional — the insight this hypothesis descends from (§9.2).">
            <select id="h-insight" name="linked_insight_id" className={inputClass}>
              <option value="">—</option>
              {((insightOptions ?? []) as Array<{ id: string; title: string; type: string }>).map((i) => (
                <option key={i.id} value={i.id}>
                  [{i.type}] {i.title}
                </option>
              ))}
            </select>
          </FormField>
          <div>
            <Button type="submit" variant="secondary" size="sm">
              Record hypothesis
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
