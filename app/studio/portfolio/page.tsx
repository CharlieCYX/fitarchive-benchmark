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
import { ROLE_LENSES, ROLE_LENS_LABELS } from "@/features/portfolio/lens";
import { createPortfolioProject } from "@/features/portfolio/actions";
import { listPortfolioProjects } from "@/features/portfolio/service";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function PortfolioStudioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Portfolio Mode"
        spec="§21"
        summary="Role-lensed case studies built from real project objects, published only via frozen snapshots — later edits never rewrite published evidence."
      />
    );
  }

  const params = await searchParams;
  const projects = await listPortfolioProjects(supabase);

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Portfolio</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        §21: case studies link real records (research → product/drop →
        campaign → events/metrics → insight → decision → next action) and are
        reframed per role lens. Public pages render frozen snapshots only
        (§6.4 rule 8); snapshots strip private data (§15.2).
      </p>

      <MessageBanner searchParams={params} />

      <Card className="mt-6">
        <CardHeader
          title="New case-study project"
          description="The slug is the public URL key; the role lens frames the same evidence for a specific reader."
        />
        <form action={createPortfolioProject} className="grid gap-4 sm:grid-cols-2">
          <FormField id="title" label="Title">
            <Input id="title" name="title" required placeholder="Drop #001: research-to-sell-through loop" />
          </FormField>
          <FormField id="slug" label="Slug">
            <Input id="slug" name="slug" required placeholder="drop001-merch-case" pattern="[a-z0-9\-]+" />
          </FormField>
          <FormField id="role_lens" label="Role lens (§21)">
            <select id="role_lens" name="role_lens" className={inputClass}>
              {ROLE_LENSES.map((lens) => (
                <option key={lens} value={lens}>
                  {ROLE_LENS_LABELS[lens]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="one_line_problem" label="One-line problem">
            <Input id="one_line_problem" name="one_line_problem" placeholder="Can a tiny secondhand drop be run as a measurable experiment?" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="contribution" label="Exact contribution">
              <textarea id="contribution" name="contribution" rows={2} className={inputClass} placeholder="Solo: sourcing, permissioning, pricing, campaign, analytics, settlement." />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField id="context_constraints" label="Context / constraints">
              <textarea id="context_constraints" name="context_constraints" rows={2} className={inputClass} placeholder="Zero ad spend; SG market; n=12 items; 5-week window." />
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
          title="No portfolio projects yet"
          description="Create a project, link real evidence, then freeze a snapshot to publish."
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>Project</TH>
              <TH>Role lens</TH>
              <TH>Artifacts</TH>
              <TH>Snapshots</TH>
              <TH>Public</TH>
            </TR>
          </THead>
          <TBody>
            {projects.map((p) => (
              <TR key={p.id}>
                <TD>
                  <Link href={`/studio/portfolio/${p.id}`} className="font-medium text-accent hover:text-accent-strong">
                    {p.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-warm-500">/portfolio/{p.slug}</p>
                </TD>
                <TD>{p.role_lens ?? "—"}</TD>
                <TD className="text-warm-500">{p.artifact_count}</TD>
                <TD className="text-warm-500">{p.snapshot_count}</TD>
                <TD>
                  {p.public_snapshot_slug ? (
                    <Link href={`/portfolio/${p.public_snapshot_slug}`} className="text-accent hover:text-accent-strong">
                      <Badge tone="success">live ↗</Badge>
                    </Link>
                  ) : (
                    <Badge tone="neutral">not published</Badge>
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
