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
import { GARMENT_PROBLEM_KINDS } from "@/lib/validation/garments";
import { createGarmentProject } from "@/features/garment-lab/actions";
import { listGarmentProjects } from "@/features/garment-lab/service";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Garment Lab" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function GarmentLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Garment Innovation Lab"
        spec="§9.4"
        summary="Real garment problem → before-state evidence → AI ideation rounds → flats/CLO → before/after comparison → physical prototype → case study separating simulated from physical evidence."
      />
    );
  }

  const params = await searchParams;
  const [projects, { data: products }] = await Promise.all([
    listGarmentProjects(supabase),
    supabase
      .from("products")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const productOptions = (products ?? []) as Array<{ id: string; title: string }>;

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Garment Innovation Lab</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        §9.4: start from a real garment and a real problem (fit restriction,
        pocket utility, movement, proportion, modularity, comfort, waste). AI
        ideation rounds are recorded with full provenance; the case study
        separates simulated evidence from physical evidence.
      </p>

      <MessageBanner searchParams={params} />

      <Card className="mt-6">
        <CardHeader
          title="New project"
          description="Anchor the project to a catalog product when the problem comes from a real piece."
        />
        <form action={createGarmentProject} className="grid gap-4 sm:grid-cols-2">
          <FormField id="title" label="Title">
            <Input id="title" name="title" required placeholder="Pocket depth on cropped jackets" />
          </FormField>
          <FormField id="problem_kind" label="Problem kind">
            <select id="problem_kind" name="problem_kind" className={inputClass}>
              {GARMENT_PROBLEM_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="product_id" label="Linked product (optional)">
            <select id="product_id" name="product_id" className={inputClass}>
              <option value="">— none —</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="problem_statement" label="Problem statement">
              <textarea id="problem_statement" name="problem_statement" rows={2} className={inputClass} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField id="before_notes" label="Before-state notes (photos recorded as assets; measurements on the detail page)">
              <textarea id="before_notes" name="before_notes" rows={2} className={inputClass} />
            </FormField>
          </div>
          <div>
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </Card>

      {projects.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No garment projects yet"
          description="Create a project from a real garment problem, then record the before-state, ideation rounds, simulations and physical tests."
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>Project</TH>
              <TH>Problem</TH>
              <TH>Status</TH>
              <TH>Product</TH>
              <TH>Rounds / tests / assets</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {projects.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link href={`/studio/garments/${p.id}`} className="font-medium text-accent hover:text-accent-strong">
                    {p.title}
                  </Link>
                </TD>
                <TD>{p.problem_kind ?? "—"}</TD>
                <TD>
                  <Badge tone={p.status === "active" ? "accent" : "neutral"}>{p.status}</Badge>
                </TD>
                <TD>{p.product_title ?? "—"}</TD>
                <TD className="text-warm-500">
                  {p.round_count} / {p.test_count} / {p.asset_count}
                </TD>
                <TD className="text-warm-500">{formatDate(p.created_at)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
