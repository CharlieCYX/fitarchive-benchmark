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
import { formatDate } from "@/lib/utils";
import { createDrop } from "@/features/drops/actions";
import { listDrops } from "@/features/drops/service";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Drops" };
export const dynamic = "force-dynamic";

export default async function DropsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Drop Builder"
        spec="§7.5"
        summary="Assortment, tiers, price ladder, readiness gate, hypotheses, clone-drop."
      />
    );
  }

  const params = await searchParams;
  const drops = await listDrops(supabase);

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Drops</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        Drop Builder (§7.5). Publishing runs the full §10.2 readiness gate and
        blocks with reasons when it fails.
      </p>

      <MessageBanner searchParams={params} />

      <Card className="mt-6">
        <CardHeader title="New drop" description="Concept first — every drop is an experiment (§7.5)." />
        <form action={createDrop} className="grid gap-4 sm:grid-cols-4">
          <FormField id="name" label="Name">
            <Input id="name" name="name" required placeholder="Drop #003" />
          </FormField>
          <FormField id="target_size_min" label="Target size min">
            <Input id="target_size_min" name="target_size_min" type="number" min="1" />
          </FormField>
          <FormField id="target_size_max" label="Target size max">
            <Input id="target_size_max" name="target_size_max" type="number" min="1" />
          </FormField>
          <FormField id="concept" label="Concept">
            <Input id="concept" name="concept" placeholder="Cropped outerwear for the wet season" />
          </FormField>
          <div>
            <Button type="submit">Create drop</Button>
          </div>
        </form>
      </Card>

      {drops.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No drops yet"
          description="Create the first drop above, then add products from the Catalog and work the readiness checklist."
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>Drop</TH>
              <TH>Status</TH>
              <TH>Items</TH>
              <TH>Launch</TH>
              <TH>Published</TH>
            </TR>
          </THead>
          <TBody>
            {drops.map((drop) => (
              <TR key={drop.id}>
                <TD>
                  <Link
                    href={`/studio/drops/${drop.id}`}
                    className="font-medium text-accent hover:text-accent-strong"
                  >
                    {drop.name}
                  </Link>
                  <span className="ml-2 text-xs text-warm-500">/{drop.slug}</span>
                </TD>
                <TD>
                  <Badge tone={drop.status === "published" ? "success" : "neutral"}>
                    {drop.status}
                  </Badge>
                </TD>
                <TD>{drop.item_count}</TD>
                <TD className="text-warm-500">{formatDate(drop.launch_at)}</TD>
                <TD className="text-warm-500">{formatDate(drop.published_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
