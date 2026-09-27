import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatDate } from "@/lib/utils";
import {
  addAsset,
  addMeasurement,
  addOwnershipRecord,
  changeAvailability,
  removeMeasurement,
  saveProduct,
  toggleProductPublication,
} from "@/features/catalog/actions";
import { getProductDetail, listCategoryTags } from "@/features/catalog/service";
import { PERMISSION_STATE_LABELS } from "@/features/sellers/permissions";
import type { PermissionState } from "@/features/sellers/permissions";
import { CONDITION_GRADES } from "@/lib/validation/catalog";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Product detail" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function ProductDetailPage({
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
        title="Catalog"
        spec="§7.3"
        summary="Product detail, availability transitions, measurements and ownership."
      />
    );
  }

  const [{ id }, bannerParams] = await Promise.all([params, searchParams]);
  const [detail, categoryTags] = await Promise.all([
    getProductDetail(supabase, id),
    listCategoryTags(supabase),
  ]);
  if (!detail) notFound();

  const { product } = detail;
  const currentOwnership = detail.ownership[0] ?? null;

  return (
    <div className="max-w-5xl">
      <Link href="/studio/catalog" className="text-sm text-warm-500 hover:text-ink">
        ← Catalog
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">
          {product.sku} · {product.title}
        </h1>
        <Badge>{product.availability}</Badge>
        {product.published_at ? <Badge tone="success">live</Badge> : null}
        {currentOwnership ? (
          <Badge tone="info">
            {PERMISSION_STATE_LABELS[currentOwnership.state as PermissionState] ??
              currentOwnership.state}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-warm-500">
        {detail.sellerName ? `Seller: ${detail.sellerName}` : "Owned inventory"}
        {detail.sourceListing ? (
          <>
            {" · "}promoted from{" "}
            <Link
              href={`/studio/research/${detail.sourceListing.id}`}
              className="text-accent hover:text-accent-strong"
            >
              source listing
            </Link>
          </>
        ) : null}
      </p>

      <MessageBanner searchParams={bannerParams} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Identity & pricing" description="Public description is shopper-facing; private notes and cost basis are owner-only (§15.3)." />
          <form action={saveProduct} className="grid gap-4">
            <input type="hidden" name="product_id" value={product.id} />
            <FormField id="title" label="Title">
              <Input id="title" name="title" defaultValue={product.title} required />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="brand" label="Brand">
                <Input id="brand" name="brand" defaultValue={(product.brand as string) ?? ""} />
              </FormField>
              <FormField id="category_id" label="Category">
                <select id="category_id" name="category_id" defaultValue={(product.category_id as string) ?? ""} className={inputClass}>
                  <option value="">—</option>
                  {categoryTags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="condition_grade" label="Condition grade">
                <select id="condition_grade" name="condition_grade" defaultValue={(product.condition_grade as string) ?? ""} className={inputClass}>
                  <option value="">—</option>
                  {CONDITION_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {g.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="public_price_sgd" label="Public price (SGD)">
                <Input id="public_price_sgd" name="public_price_sgd" type="number" min="0" step="0.01" defaultValue={(product.public_price_sgd as string) ?? ""} />
              </FormField>
            </div>
            <FormField id="defect_notes" label="Defect notes (public-safe, §10.5)">
              <textarea id="defect_notes" name="defect_notes" rows={2} defaultValue={(product.defect_notes as string) ?? ""} className={inputClass} />
            </FormField>
            <FormField id="description_public" label="Public description">
              <textarea id="description_public" name="description_public" rows={3} defaultValue={(product.description_public as string) ?? ""} className={inputClass} />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="cost_basis_sgd" label="Cost basis (SGD, owner-only)">
                <Input id="cost_basis_sgd" name="cost_basis_sgd" type="number" min="0" step="0.01" defaultValue={(product.cost_basis_sgd as string) ?? ""} />
              </FormField>
              <FormField id="notes_private" label="Private notes (owner-only)">
                <textarea id="notes_private" name="notes_private" rows={1} defaultValue={(product.notes_private as string) ?? ""} className={inputClass} />
              </FormField>
            </div>
            <div>
              <Button type="submit">Save product</Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Availability"
              description={`State machine: draft → available → reserved → sold | withdrawn. Every transition is audited. Currently: ${product.availability}.`}
            />
            <div className="flex flex-wrap gap-2">
              {detail.allowedTransitions.length === 0 ? (
                <p className="text-sm text-warm-500">
                  Terminal state — returns are handled by commerce (Phase 4).
                </p>
              ) : (
                detail.allowedTransitions.map((to) => (
                  <form key={to} action={changeAvailability}>
                    <input type="hidden" name="product_id" value={product.id} />
                    <input type="hidden" name="to" value={to} />
                    <Button type="submit" variant="secondary" size="sm">
                      → {to}
                    </Button>
                  </form>
                ))
              )}
            </div>
            <form action={toggleProductPublication} className="mt-4 border-t border-warm-200 pt-4">
              <input type="hidden" name="product_id" value={product.id} />
              <input type="hidden" name="publish" value={product.published_at ? "false" : "true"} />
              <Button type="submit" variant={product.published_at ? "secondary" : "primary"} size="sm">
                {product.published_at ? "Unpublish product" : "Publish product"}
              </Button>
              <p className="mt-2 text-xs text-warm-500">
                Publishing requires availability=available. Non-owned items also
                need valid permission at drop publish time (§10.2).
              </p>
            </form>
          </Card>

          <Card>
            <CardHeader title="Measurements" description="Unit + method recorded per §10.5." />
            {detail.measurements.length === 0 ? (
              <p className="text-sm text-warm-500">No measurements yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {detail.measurements.map((m) => (
                  <li key={m.id} className="flex items-center justify-between border-b border-warm-200 pb-1 last:border-0">
                    <span className="text-ink">
                      {m.name}: {m.value} {m.unit}
                      {m.method ? <span className="text-warm-500"> ({m.method})</span> : null}
                    </span>
                    <form action={removeMeasurement}>
                      <input type="hidden" name="measurement_id" value={m.id} />
                      <input type="hidden" name="product_id" value={product.id} />
                      <button type="submit" className="text-xs text-danger hover:underline">
                        remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addMeasurement} className="mt-4 grid grid-cols-[1fr_90px_80px_auto] items-end gap-2">
              <input type="hidden" name="product_id" value={product.id} />
              <FormField id="m-name" label="Name">
                <Input id="m-name" name="name" placeholder="pit_to_pit" required />
              </FormField>
              <FormField id="m-value" label="Value">
                <Input id="m-value" name="value" type="number" step="0.1" min="0" required />
              </FormField>
              <FormField id="m-unit" label="Unit">
                <Input id="m-unit" name="unit" defaultValue="cm" />
              </FormField>
              <Button type="submit" variant="secondary" size="sm">
                Add
              </Button>
              <div className="col-span-4">
                <FormField id="m-method" label="Method">
                  <Input id="m-method" name="method" placeholder="laid flat, seam to seam" />
                </FormField>
              </div>
            </form>
          </Card>

          <Card>
            <CardHeader title="Ownership timeline" description="Latest open record is the current state (§11.2)." />
            {detail.ownership.length === 0 ? (
              <p className="text-sm text-warm-500">No ownership records.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {detail.ownership.map((o) => (
                  <li key={o.id} className="flex items-center gap-2">
                    <Badge tone={o.effective_to ? "neutral" : "info"}>
                      {PERMISSION_STATE_LABELS[o.state as PermissionState] ?? o.state}
                    </Badge>
                    <span className="text-warm-500">
                      {formatDate(o.effective_from)} → {o.effective_to ? formatDate(o.effective_to) : "current"}
                    </span>
                    {o.note ? <span className="text-xs text-warm-500">· {o.note}</span> : null}
                  </li>
                ))}
              </ul>
            )}
            <form action={addOwnershipRecord} className="mt-4 flex items-end gap-2">
              <input type="hidden" name="product_id" value={product.id} />
              <FormField id="o-state" label="New state">
                <select id="o-state" name="state" className={inputClass}>
                  {Object.entries(PERMISSION_STATE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField id="o-note" label="Note">
                <Input id="o-note" name="note" />
              </FormField>
              <Button type="submit" variant="secondary" size="sm">
                Record
              </Button>
            </form>
          </Card>

          <Card>
            <CardHeader title="Assets" description="Provenance + rights notes per §6.4 rule 7; synthetic imagery is disclosed, never hidden." />
            {detail.assets.length === 0 ? (
              <p className="text-sm text-warm-500">No assets attached.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {detail.assets.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-warm-200 pb-1 last:border-0">
                    <span className="break-all text-ink">{a.bucket}/{a.path}</span>
                    <Badge tone={a.privacy === "public" ? "success" : "neutral"}>{a.privacy}</Badge>
                    <Badge tone={a.provenance === "ai_synthetic" ? "accent" : "neutral"}>
                      {a.provenance}
                    </Badge>
                    {a.synthetic ? <Badge tone="warning">synthetic disclosed</Badge> : null}
                    {!a.alt_text ? <Badge tone="danger">no alt text</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
            <form action={addAsset} className="mt-4 grid gap-3">
              <input type="hidden" name="product_id" value={product.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField id="a-path" label="Path (storage key or URL)">
                  <Input id="a-path" name="path" required placeholder="products/fa-016/front.jpg" />
                </FormField>
                <FormField id="a-bucket" label="Bucket">
                  <select id="a-bucket" name="bucket" className={inputClass}>
                    <option value="private-assets">private-assets</option>
                    <option value="public-assets">public-assets</option>
                  </select>
                </FormField>
                <FormField id="a-privacy" label="Privacy">
                  <select id="a-privacy" name="privacy" className={inputClass}>
                    <option value="private">private</option>
                    <option value="public">public</option>
                  </select>
                </FormField>
                <FormField id="a-provenance" label="Provenance">
                  <select id="a-provenance" name="provenance" className={inputClass}>
                    <option value="operator">operator</option>
                    <option value="seller">seller</option>
                    <option value="ai_synthetic">ai_synthetic</option>
                  </select>
                </FormField>
                <FormField id="a-alt" label="Alt text (required before publish)">
                  <Input id="a-alt" name="alt_text" />
                </FormField>
                <FormField id="a-rights" label="Rights note (seller media)">
                  <Input id="a-rights" name="rights_note" />
                </FormField>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" name="synthetic" className="h-4 w-4" />
                Synthetic imagery (disclosed, §10.6)
              </label>
              <div>
                <Button type="submit" variant="secondary" size="sm">
                  Add asset
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
