import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatSgd } from "@/lib/utils";
import { AVAILABILITY_STATUSES } from "@/features/catalog/availability";
import { listProducts } from "@/features/catalog/service";
import { catalogFiltersSchema } from "@/lib/validation/catalog";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Catalog" };
export const dynamic = "force-dynamic";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Catalog"
        spec="§7.3"
        summary="Product master: condition, measurements, ownership state, availability, cost basis."
      />
    );
  }

  const params = await searchParams;
  const parsed = catalogFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : {};

  const products = await listProducts(supabase, filters);

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl text-ink">Catalog</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        Product master (§7.3): identity, condition, measurements, ownership and
        availability. Products enter via Research Inbox promote; private notes
        and cost basis never leave the owner view.
      </p>

      <MessageBanner searchParams={params} />

      <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
        <FormField id="f-availability" label="Availability">
          <select
            id="f-availability"
            name="availability"
            defaultValue={filters.availability ?? ""}
            className="rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {AVAILABILITY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="f-missing" label="Missing">
          <select
            id="f-missing"
            name="missing"
            defaultValue={filters.missing ?? ""}
            className="rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink"
          >
            <option value="">Nothing</option>
            <option value="data">Condition/description</option>
            <option value="imagery">Imagery</option>
          </select>
        </FormField>
        <FormField id="f-q" label="Search title">
          <Input id="f-q" name="q" defaultValue={filters.q ?? ""} />
        </FormField>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {products.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No products match"
          description="Promote a research listing from the Inbox to create a draft product, or widen the filters."
          action={
            <Link
              href="/studio/research"
              className="text-sm font-medium text-accent hover:text-accent-strong"
            >
              Go to Research Inbox →
            </Link>
          }
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>SKU</TH>
              <TH>Title</TH>
              <TH>Seller</TH>
              <TH>Condition</TH>
              <TH>Price</TH>
              <TH>Availability</TH>
              <TH>Live</TH>
              <TH>Data</TH>
            </TR>
          </THead>
          <TBody>
            {products.map((product) => (
              <TR key={product.id}>
                <TD className="text-warm-500">{product.sku}</TD>
                <TD>
                  <Link
                    href={`/studio/catalog/${product.id}`}
                    className="font-medium text-accent hover:text-accent-strong"
                  >
                    {product.title}
                  </Link>
                  {product.brand ? (
                    <span className="ml-2 text-xs text-warm-500">{product.brand}</span>
                  ) : null}
                </TD>
                <TD>{product.seller_name ?? "owned"}</TD>
                <TD>{product.condition_grade ?? <span className="text-danger">missing</span>}</TD>
                <TD>{formatSgd(product.public_price_sgd)}</TD>
                <TD>
                  <Badge
                    tone={
                      product.availability === "available"
                        ? "success"
                        : product.availability === "sold"
                          ? "neutral"
                          : product.availability === "draft"
                            ? "warning"
                            : "info"
                    }
                  >
                    {product.availability}
                  </Badge>
                </TD>
                <TD>{product.published_at ? <Badge tone="success">live</Badge> : "—"}</TD>
                <TD className="text-xs text-warm-500">
                  {product.measurement_count}m · {product.asset_count}a
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
