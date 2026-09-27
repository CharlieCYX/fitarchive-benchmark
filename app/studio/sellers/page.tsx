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
import { createSeller } from "@/features/sellers/actions";
import { listSellers } from "@/features/sellers/service";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Sellers" };
export const dynamic = "force-dynamic";

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Seller CRM + Permission Ledger"
        spec="§7.4"
        summary="Seller profiles, contacts, permission requests, agreements and settlement history."
      />
    );
  }

  const params = await searchParams;
  const sellers = await listSellers(supabase);

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Sellers</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        CRM + permission ledger (§7.4). Publishing a non-owned item requires a
        valid permission; revoking one unpublishes affected products.
      </p>

      <MessageBanner searchParams={params} />

      <Card className="mt-6">
        <CardHeader title="Add seller" description="Handle + display name; contacts, agreements and permissions attach on the seller page." />
        <form action={createSeller} className="grid gap-4 sm:grid-cols-3">
          <FormField id="handle" label="Handle">
            <Input id="handle" name="handle" required placeholder="@thriftwithmei" />
          </FormField>
          <FormField id="display_name" label="Display name">
            <Input id="display_name" name="display_name" required placeholder="Thrift With Mei" />
          </FormField>
          <FormField id="notes_private" label="Private notes (owner-only)">
            <Input id="notes_private" name="notes_private" />
          </FormField>
          <div>
            <Button type="submit">Add seller</Button>
          </div>
        </form>
      </Card>

      {sellers.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No sellers yet"
          description="Add the first seller above, then record contacts and a permission request before publishing their items."
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>Seller</TH>
              <TH>Handle</TH>
              <TH>Status</TH>
              <TH>Products</TH>
              <TH>Open permissions</TH>
            </TR>
          </THead>
          <TBody>
            {sellers.map((seller) => (
              <TR key={seller.id}>
                <TD>
                  <Link
                    href={`/studio/sellers/${seller.id}`}
                    className="font-medium text-accent hover:text-accent-strong"
                  >
                    {seller.display_name}
                  </Link>
                </TD>
                <TD className="text-warm-500">{seller.handle}</TD>
                <TD>
                  <Badge tone={seller.status === "active" ? "success" : "neutral"}>
                    {seller.status}
                  </Badge>
                </TD>
                <TD>{seller.product_count}</TD>
                <TD>
                  {seller.open_permissions > 0 ? (
                    <Badge tone="warning">{seller.open_permissions} awaiting</Badge>
                  ) : (
                    "0"
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
