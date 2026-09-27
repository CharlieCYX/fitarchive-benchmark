import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatSgd, formatDate } from "@/lib/utils";
import { captureListing } from "@/features/research/actions";
import { listListings, listPlatforms } from "@/features/research/service";
import { PERMISSION_STATE_LABELS } from "@/features/sellers/permissions";
import type { PermissionState } from "@/features/sellers/permissions";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Research Inbox" };
export const dynamic = "force-dynamic";

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Research Inbox"
        spec="§7.2"
        summary="Manual marketplace capture with duplicate detection, structured fields and drop-candidate flags."
      />
    );
  }

  const params = await searchParams;
  const filters = {
    platform: params.platform || undefined,
    permission_state: params.permission_state || undefined,
    drop_candidate:
      params.drop_candidate === "yes" || params.drop_candidate === "no"
        ? params.drop_candidate
        : undefined,
    q: params.q || undefined,
  } as const;

  const [platforms, listings, categoryTags] = await Promise.all([
    listPlatforms(supabase),
    listListings(supabase, filters),
    supabase
      .from("tags")
      .select("id, label")
      .eq("dimension", "category")
      .eq("is_active", true)
      .order("label")
      .then(({ data }) => (data ?? []) as Array<{ id: string; label: string }>),
  ]);

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl text-ink">Research Inbox</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        Quick-capture marketplace finds (§7.2). Duplicates are detected by
        normalized URL; capturing takes under a minute.
      </p>

      <MessageBanner searchParams={params} />

      <Card className="mt-6">
        <CardHeader
          title="Quick capture"
          description="Source URL and capture time are preserved. A repeated URL returns the existing record."
        />
        <form action={captureListing} className="grid gap-4 sm:grid-cols-3">
          <FormField id="source_platform_id" label="Source platform">
            <select
              id="source_platform_id"
              name="source_platform_id"
              required
              className="w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink"
            >
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="source_url" label="Source URL">
            <Input id="source_url" name="source_url" type="url" placeholder="https://carousell.sg/p/…" />
          </FormField>
          <FormField id="seller_handle" label="Seller handle">
            <Input id="seller_handle" name="seller_handle" placeholder="@seller" />
          </FormField>
          <FormField id="title" label="Title">
            <Input id="title" name="title" required placeholder="Boxy cropped work jacket" />
          </FormField>
          <FormField id="brand" label="Brand">
            <Input id="brand" name="brand" />
          </FormField>
          <FormField id="category_tag_id" label="Category">
            <select
              id="category_tag_id"
              name="category_tag_id"
              className="w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink"
            >
              <option value="">—</option>
              {categoryTags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="asking_price_sgd" label="Asking price (SGD)">
            <Input id="asking_price_sgd" name="asking_price_sgd" type="number" min="0" step="0.01" />
          </FormField>
          <FormField id="condition_note" label="Condition">
            <Input id="condition_note" name="condition_note" placeholder="Light wear at cuffs" />
          </FormField>
          <FormField id="visible_engagement" label="Visible engagement">
            <Input id="visible_engagement" name="visible_engagement" type="number" min="0" />
          </FormField>
          <FormField id="listing_age_days" label="Listing age (days)">
            <Input id="listing_age_days" name="listing_age_days" type="number" min="0" />
          </FormField>
          <FormField id="tags" label="Tags" hint="Comma-separated; matched against the taxonomy">
            <Input id="tags" name="tags" placeholder="boxy, workwear, 90s" />
          </FormField>
          <FormField id="notes" label="Notes">
            <Input id="notes" name="notes" />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="drop_candidate" className="h-4 w-4" />
            Drop candidate
          </label>
          <div className="sm:col-span-3">
            <Button type="submit">Capture listing</Button>
          </div>
        </form>
      </Card>

      <form className="mt-8 flex flex-wrap items-end gap-3" method="get">
        <FormField id="f-platform" label="Platform">
          <select
            id="f-platform"
            name="platform"
            defaultValue={filters.platform ?? ""}
            className="rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="f-state" label="Permission">
          <select
            id="f-state"
            name="permission_state"
            defaultValue={filters.permission_state ?? ""}
            className="rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Object.entries(PERMISSION_STATE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="f-candidate" label="Drop candidate">
          <select
            id="f-candidate"
            name="drop_candidate"
            defaultValue={filters.drop_candidate ?? ""}
            className="rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </FormField>
        <FormField id="f-q" label="Search title">
          <Input id="f-q" name="q" defaultValue={filters.q ?? ""} />
        </FormField>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {listings.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No listings match"
          description="Capture a find above, or widen the filters. Listings stay in the inbox until promoted to the Catalog — they are not public inventory."
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>Platform</TH>
              <TH>Seller</TH>
              <TH>Price</TH>
              <TH>Permission</TH>
              <TH>Candidate</TH>
              <TH>Captured</TH>
            </TR>
          </THead>
          <TBody>
            {listings.map((listing) => (
              <TR key={listing.id}>
                <TD>
                  <Link
                    href={`/studio/research/${listing.id}`}
                    className="font-medium text-accent hover:text-accent-strong"
                  >
                    {listing.title}
                  </Link>
                  {listing.brand ? (
                    <span className="ml-2 text-xs text-warm-500">{listing.brand}</span>
                  ) : null}
                </TD>
                <TD>{listing.platform_name ?? "—"}</TD>
                <TD>{listing.seller_handle ?? "—"}</TD>
                <TD>{formatSgd(listing.asking_price_sgd)}</TD>
                <TD>
                  <Badge
                    tone={
                      listing.permission_state === "expired_revoked"
                        ? "danger"
                        : listing.permission_state === "observed_only"
                          ? "neutral"
                          : "info"
                    }
                  >
                    {PERMISSION_STATE_LABELS[listing.permission_state as PermissionState] ??
                      listing.permission_state}
                  </Badge>
                </TD>
                <TD>{listing.drop_candidate ? <Badge tone="accent">drop candidate</Badge> : "—"}</TD>
                <TD className="text-warm-500">{formatDate(listing.captured_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
