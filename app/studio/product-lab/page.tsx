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
import { createProductBrief } from "@/features/product-lab/actions";
import { listProductBriefs } from "@/features/product-lab/service";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Product Lab" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function ProductLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Product Lab / PRD Studio"
        spec="§9.5"
        summary="Problem briefs with evidence and current workaround → PRD (competitor matrix, stories, FRs/NFRs, MVP boundary, success metrics + instrumentation) → prototype tests → feature build record → postmortem."
      />
    );
  }

  const params = await searchParams;
  const briefs = await listProductBriefs(supabase);

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Product Lab</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        §9.5: one problem brief per product initiative. Success metrics and
        the instrumentation plan are written before coding; the MVP boundary
        includes a deliberately-deferred list; the postmortem records what
        should not be built.
      </p>

      <MessageBanner searchParams={params} />

      <Card className="mt-6">
        <CardHeader
          title="New problem brief"
          description="Evidence first: what is the problem, what proves it, and what do people do today?"
        />
        <form action={createProductBrief} className="grid gap-4 sm:grid-cols-2">
          <FormField id="title" label="Title">
            <Input id="title" name="title" required placeholder="Size confidence for secondhand PDPs" />
          </FormField>
          <FormField id="target_outcome" label="Target outcome">
            <Input id="target_outcome" name="target_outcome" placeholder="PDP shows measured dims vs closet item dims" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="problem" label="Problem">
              <textarea id="problem" name="problem" rows={2} className={inputClass} />
            </FormField>
          </div>
          <FormField id="evidence" label="Evidence (events, inquiries, observations)">
            <textarea id="evidence" name="evidence" rows={2} className={inputClass} />
          </FormField>
          <FormField id="current_workaround" label="Current workaround">
            <textarea id="current_workaround" name="current_workaround" rows={2} className={inputClass} />
          </FormField>
          <div>
            <Button type="submit">Create brief</Button>
          </div>
        </form>
      </Card>

      {briefs.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No product briefs yet"
          description="Start from a problem with evidence — not a feature idea."
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>Brief</TH>
              <TH>Status</TH>
              <TH>PRD</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {briefs.map((b) => (
              <TR key={b.id}>
                <TD>
                  <Link href={`/studio/product-lab/${b.id}`} className="font-medium text-accent hover:text-accent-strong">
                    {b.title}
                  </Link>
                  {b.problem ? (
                    <p className="mt-0.5 max-w-md truncate text-xs text-warm-500">{b.problem}</p>
                  ) : null}
                </TD>
                <TD>
                  <Badge tone={b.status === "draft" ? "neutral" : "accent"}>{b.status}</Badge>
                </TD>
                <TD className="text-warm-500">{b.prd_count > 0 ? "written" : "—"}</TD>
                <TD className="text-warm-500">{formatDate(b.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
