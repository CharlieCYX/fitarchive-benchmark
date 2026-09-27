import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatSgd, formatDate } from "@/lib/utils";
import { promoteToProduct, recordObservation } from "@/features/research/actions";
import { getListingDetail } from "@/features/research/service";
import { PERMISSION_STATE_LABELS } from "@/features/sellers/permissions";
import type { PermissionState } from "@/features/sellers/permissions";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Listing detail" };
export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
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
        title="Research Inbox"
        spec="§7.2"
        summary="Listing detail, observations and promote-to-product."
      />
    );
  }

  const [{ id }, bannerParams] = await Promise.all([params, searchParams]);
  const detail = await getListingDetail(supabase, id);
  if (!detail) notFound();

  const { listing, observations, promotedProduct } = detail;

  return (
    <div className="max-w-4xl">
      <Link href="/studio/research" className="text-sm text-warm-500 hover:text-ink">
        ← Research Inbox
      </Link>
      <div className="mt-2 flex items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">{listing.title}</h1>
        <Badge tone="info">
          {PERMISSION_STATE_LABELS[listing.permission_state as PermissionState] ??
            listing.permission_state}
        </Badge>
        {listing.drop_candidate ? <Badge tone="accent">drop candidate</Badge> : null}
      </div>

      <MessageBanner searchParams={bannerParams} />

      <Card className="mt-4">
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Field label="Platform" value={listing.platform_name ?? "—"} />
          <Field
            label="Source URL"
            value={
              listing.source_url ? (
                <a
                  href={listing.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:text-accent-strong"
                >
                  {listing.source_url}
                </a>
              ) : (
                "—"
              )
            }
          />
          <Field label="Normalized URL" value={listing.normalized_url ?? "—"} />
          <Field label="Seller handle" value={listing.seller_handle ?? "—"} />
          <Field label="Brand" value={listing.brand ?? "—"} />
          <Field label="Asking price" value={formatSgd(listing.asking_price_sgd)} />
          <Field label="Condition" value={listing.condition_note ?? "—"} />
          <Field
            label="Engagement / age"
            value={`${listing.visible_engagement ?? "—"} likes · ${
              listing.listing_age_days ?? "—"
            } days`}
          />
          <Field label="Captured" value={formatDate(listing.captured_at)} />
          <Field label="Notes" value={listing.notes ?? "—"} />
        </dl>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Promote to Catalog"
          description="Creates a draft product linked back to this listing (§7.2 → §7.3). Ownership state carries over; nothing is published."
        />
        {promotedProduct ? (
          <p className="text-sm text-ink">
            Already promoted →{" "}
            <Link
              href={`/studio/catalog/${promotedProduct.id}`}
              className="font-medium text-accent hover:text-accent-strong"
            >
              {promotedProduct.sku} · {promotedProduct.title}
            </Link>
          </p>
        ) : (
          <form action={promoteToProduct}>
            <input type="hidden" name="listing_id" value={listing.id} />
            <Button type="submit">Promote to draft product</Button>
          </form>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Observations"
          description="Repeat observations over time build the evidence trail (§9.2)."
        />
        {observations.length === 0 ? (
          <p className="text-sm text-warm-500">No observations yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {observations.map((o) => (
              <li key={o.id} className="border-b border-warm-200 pb-2 last:border-0">
                <span className="text-ink">{o.note}</span>
                <span className="ml-2 text-xs text-warm-500">
                  {formatDate(o.observed_at)}
                  {o.confidence !== null ? ` · confidence ${o.confidence}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <form action={recordObservation} className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
          <input type="hidden" name="listing_id" value={listing.id} />
          <FormField id="note" label="Note">
            <Input id="note" name="note" required placeholder="Seller relisted at $55" />
          </FormField>
          <FormField id="confidence" label="Confidence (0–1)">
            <Input id="confidence" name="confidence" type="number" min="0" max="1" step="0.05" />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-warm-500">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{value}</dd>
    </div>
  );
}
