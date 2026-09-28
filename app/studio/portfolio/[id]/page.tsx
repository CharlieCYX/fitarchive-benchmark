import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { formatDate } from "@/lib/utils";
import { ROLE_LENSES, ROLE_LENS_LABELS, isRoleLens, ROLE_LENS_EMPHASIS } from "@/features/portfolio/lens";
import {
  EVIDENCE_REF_TARGETS,
  EVIDENCE_STAGE_LABELS,
  EVIDENCE_STAGES,
  assembleEvidenceGraph,
} from "@/features/portfolio/evidence-graph";
import type { EvidenceLink } from "@/features/portfolio/snapshot";
import {
  addEvidenceLink,
  addPortfolioArtifact,
  freezeSnapshot,
  generateKoDraft,
  removeEvidenceLink,
  saveKoDraft,
  savePortfolioNarrative,
  savePortfolioProject,
  setSnapshotVisibility,
} from "@/features/portfolio/actions";
import { getPortfolioBuilderDetail } from "@/features/portfolio/service";
import { PORTFOLIO_ARTIFACT_KINDS } from "@/lib/validation/portfolio";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Portfolio builder" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export default async function PortfolioBuilderPage({
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
        title="Portfolio Mode"
        spec="§21"
        summary="Case-study builder: evidence graph, artifacts, frozen snapshots."
      />
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const detail = await getPortfolioBuilderDetail(supabase, id);
  if (!detail) notFound();
  const { project, artifacts, snapshots } = detail;

  const evidenceLinks = (project.evidence_links as EvidenceLink[]) ?? [];
  const graph = assembleEvidenceGraph(evidenceLinks);
  const lens = isRoleLens(project.role_lens) ? project.role_lens : null;

  return (
    <div className="max-w-5xl">
      <p className="text-xs text-warm-500">
        <Link href="/studio/portfolio" className="hover:text-ink">← Portfolio</Link>
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">{project.title}</h1>
        {lens ? <Badge tone="accent">{ROLE_LENS_LABELS[lens]}</Badge> : <Badge tone="warning">no role lens</Badge>}
        <span className="text-xs text-warm-500">/portfolio/{project.slug}</span>
      </div>
      {lens ? <p className="mt-1 text-xs text-warm-500">Lens emphasis: {ROLE_LENS_EMPHASIS[lens]}</p> : null}

      <MessageBanner searchParams={sp} />

      {/* Core fields */}
      <Card className="mt-6">
        <CardHeader title="Case-study core" description="§21.2: title, one-line problem, role lens, exact contribution, context/constraints." />
        <form action={savePortfolioProject} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="portfolio_project_id" value={project.id} />
          <FormField id="title" label="Title">
            <Input id="title" name="title" defaultValue={project.title} required />
          </FormField>
          <FormField id="slug" label="Slug">
            <Input id="slug" name="slug" defaultValue={project.slug} required pattern="[a-z0-9\-]+" />
          </FormField>
          <FormField id="role_lens" label="Role lens">
            <select id="role_lens" name="role_lens" className={inputClass} defaultValue={project.role_lens ?? "merchandising"}>
              {ROLE_LENSES.map((l) => (
                <option key={l} value={l}>{ROLE_LENS_LABELS[l]}</option>
              ))}
            </select>
          </FormField>
          <FormField id="one_line_problem" label="One-line problem">
            <Input id="one_line_problem" name="one_line_problem" defaultValue={project.one_line_problem ?? ""} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="contribution" label="Exact contribution">
              <textarea id="contribution" name="contribution" rows={2} className={inputClass} defaultValue={project.contribution ?? ""} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField id="context_constraints" label="Context / constraints">
              <textarea id="context_constraints" name="context_constraints" rows={2} className={inputClass} defaultValue={project.context_constraints ?? ""} />
            </FormField>
          </div>
          <div>
            <Button type="submit">Save core</Button>
          </div>
        </form>
      </Card>

      {/* Evidence graph */}
      <Card className="mt-6">
        <CardHeader
          title="Evidence graph (§21.1)"
          description="Link real project objects — research → product/drop → campaign → events/metrics → insight → decision → next action. Never detached narrative."
        />
        <form action={addEvidenceLink} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="portfolio_project_id" value={project.id} />
          <FormField id="stage" label="Stage">
            <select id="stage" name="stage" className={inputClass}>
              {EVIDENCE_STAGES.map((s) => (
                <option key={s} value={s}>{EVIDENCE_STAGE_LABELS[s]}</option>
              ))}
            </select>
          </FormField>
          <FormField id="label" label="Label">
            <Input id="label" name="label" required placeholder="24 listings captured, 6 drop candidates" />
          </FormField>
          <FormField id="ref_table" label="Ref table (optional; must fit the stage)">
            <Input id="ref_table" name="ref_table" placeholder="source_listings" list="ref-tables" />
            <datalist id="ref-tables">
              {Object.values(EVIDENCE_REF_TARGETS).flat().map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </FormField>
          <FormField id="ref_id" label="Ref id (uuid, optional)">
            <Input id="ref_id" name="ref_id" placeholder="00000000-…" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="href" label="Link (optional)">
              <Input id="href" name="href" placeholder="/studio/drops/… or https://…" />
            </FormField>
          </div>
          <div>
            <Button type="submit">Add evidence link</Button>
          </div>
        </form>

        {graph.nodes.length === 0 ? (
          <p className="mt-4 text-sm text-warm-500">No evidence linked yet.</p>
        ) : (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-warm-500">Chain: {graph.chainSummary}</p>
            <ul className="mt-2 space-y-2">
              {graph.nodes.map((node, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone={node.attached ? "accent" : "neutral"}>{EVIDENCE_STAGE_LABELS[node.stage]}</Badge>
                  <span className="text-ink">{node.label}</span>
                  {node.attached ? (
                    <span className="font-mono text-xs text-warm-500">{node.ref_table}/{node.ref_id}</span>
                  ) : (
                    <Badge tone="warning">manual note</Badge>
                  )}
                  {node.href ? (
                    <span className="font-mono text-xs text-warm-500">{node.href}</span>
                  ) : null}
                  <form action={removeEvidenceLink}>
                    <input type="hidden" name="portfolio_project_id" value={project.id} />
                    <input type="hidden" name="index" value={i} />
                    <button type="submit" className="text-xs text-danger hover:underline">remove</button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Narrative fields */}
      <Card className="mt-6">
        <CardHeader title="Narrative (§21.2)" description="Evidence summary, the decision it drove, what changed next, and honest limitations." />
        <form action={savePortfolioNarrative} className="grid gap-4">
          <input type="hidden" name="portfolio_project_id" value={project.id} />
          <FormField id="evidence_summary" label="Evidence / data">
            <textarea id="evidence_summary" name="evidence_summary" rows={3} className={inputClass} defaultValue={project.evidence_summary ?? ""} />
          </FormField>
          <FormField id="decision" label="Decision">
            <textarea id="decision" name="decision" rows={2} className={inputClass} defaultValue={project.decision ?? ""} />
          </FormField>
          <FormField id="what_changed_next" label="What changed next">
            <textarea id="what_changed_next" name="what_changed_next" rows={2} className={inputClass} defaultValue={project.what_changed_next ?? ""} />
          </FormField>
          <FormField id="limitations" label="Limitations">
            <textarea id="limitations" name="limitations" rows={2} className={inputClass} defaultValue={project.limitations ?? ""} />
          </FormField>
          <div>
            <Button type="submit">Save narrative</Button>
          </div>
        </form>
      </Card>

      {/* Artifacts */}
      <Card className="mt-6">
        <CardHeader title="Execution artifacts" description="Images, charts, links and metric snapshots. Metric snapshots resolve into result metrics with period + sample at freeze time (§21.2)." />
        <form action={addPortfolioArtifact} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="portfolio_project_id" value={project.id} />
          <FormField id="kind" label="Kind">
            <select id="kind" name="kind" className={inputClass}>
              {PORTFOLIO_ARTIFACT_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </FormField>
          <FormField id="sort_order" label="Sort order">
            <Input id="sort_order" name="sort_order" type="number" min={0} defaultValue={0} />
          </FormField>
          <FormField id="asset_path" label="Asset path (public bucket)">
            <Input id="asset_path" name="asset_path" placeholder="public-assets/portfolio/drop001-grid.png" />
          </FormField>
          <FormField id="url" label="URL (for links)">
            <Input id="url" name="url" placeholder="https://…" />
          </FormField>
          <FormField id="metric_snapshot_id" label="Metric snapshot id (for metric_snapshot)">
            <Input id="metric_snapshot_id" name="metric_snapshot_id" placeholder="uuid" />
          </FormField>
          <FormField id="caption" label="Caption">
            <Input id="caption" name="caption" placeholder="Sell-through 0.75 for Drop #001 (9/12 items)." />
          </FormField>
          <div>
            <Button type="submit">Add artifact</Button>
          </div>
        </form>
        {artifacts.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {artifacts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-2">
                <Badge tone="neutral">{a.kind}</Badge>
                <span className="font-mono text-xs text-warm-500">{a.asset_path ?? a.url ?? a.metric_snapshot_id ?? ""}</span>
                <span className="w-full text-warm-700">{a.caption}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* KO draft */}
      <Card className="mt-6">
        <CardHeader
          title="Korean translation draft (optional)"
          description="Generated via the provider gateway and flagged machine-assisted until a human marks it reviewed (§13.4)."
        />
        <form action={generateKoDraft}>
          <input type="hidden" name="portfolio_project_id" value={project.id} />
          <Button type="submit" variant="secondary">Generate KO draft</Button>
        </form>
        <form action={saveKoDraft} className="mt-4 grid gap-4">
          <input type="hidden" name="portfolio_project_id" value={project.id} />
          <FormField id="ko_draft" label="KO draft">
            <textarea id="ko_draft" name="ko_draft" rows={5} className={inputClass} defaultValue={project.ko_draft ?? ""} />
          </FormField>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="ko_reviewed" defaultChecked={project.ko_reviewed} className="h-4 w-4 rounded border-warm-300" />
            Human-reviewed (clears the machine-assisted flag)
          </label>
          <div>
            <Button type="submit">Save KO draft</Button>
            {project.ko_draft ? (
              <Badge tone={project.ko_reviewed ? "success" : "warning"} className="ml-3">
                {project.ko_reviewed ? "human-reviewed" : "machine-assisted — not reviewed"}
              </Badge>
            ) : null}
          </div>
        </form>
      </Card>

      {/* Snapshots */}
      <Card className="mt-6">
        <CardHeader
          title="Frozen snapshots (§6.4 rule 8)"
          description="Freezing copies the current state into an immutable snapshot with a new version and slug. Later edits to products, metrics or this project NEVER rewrite a frozen snapshot — regenerate to publish a new version."
        />
        <form action={freezeSnapshot} className="flex flex-wrap items-center gap-4">
          <input type="hidden" name="portfolio_project_id" value={project.id} />
          <Button type="submit">Freeze new snapshot</Button>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="publish" className="h-4 w-4 rounded border-warm-300" />
            Publish immediately (public at /portfolio/[slug])
          </label>
        </form>

        {snapshots.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="No snapshots yet"
            description="Nothing is public until a snapshot is frozen and published."
          />
        ) : (
          <ul className="mt-4 space-y-2">
            {snapshots.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-md border border-warm-200 p-3 text-sm">
                <Badge tone="accent">v{s.version}</Badge>
                {s.is_public ? (
                  <Link href={`/portfolio/${s.slug}`} className="font-medium text-accent hover:text-accent-strong">
                    /portfolio/{s.slug} ↗
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-warm-500">/portfolio/{s.slug}</span>
                )}
                <Badge tone={s.is_public ? "success" : "neutral"}>{s.is_public ? "public" : "private"}</Badge>
                <span className="text-xs text-warm-500">frozen {formatDate(s.frozen_at)}</span>
                <form action={setSnapshotVisibility}>
                  <input type="hidden" name="portfolio_project_id" value={project.id} />
                  <input type="hidden" name="snapshot_id" value={s.id} />
                  <input type="hidden" name="is_public" value={s.is_public ? "false" : "true"} />
                  <button type="submit" className="text-xs text-accent hover:underline">
                    {s.is_public ? "unpublish" : "publish"}
                  </button>
                </form>
                <a href={`/api/export/portfolio/${s.id}`} className="text-xs text-accent hover:underline">
                  export JSON
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
