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
  GARMENT_ASSET_KINDS,
  GARMENT_PROBLEM_KINDS,
  GARMENT_TEST_KINDS,
} from "@/lib/validation/garments";
import {
  addGarmentAsset,
  addGarmentTest,
  runIdeationRound,
  saveGarmentMeasurements,
  saveGarmentProject,
} from "@/features/garment-lab/actions";
import { getGarmentProjectDetail } from "@/features/garment-lab/service";
import { assembleGarmentCaseStudy, type CaseStudyAsset, type CaseStudyTest } from "@/features/garment-lab/case-study";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Garment project" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

function measurementsToText(ms: Array<{ name: string; value: number; unit: string; method?: string | null }>): string {
  return ms.map((m) => [m.name, m.value, m.unit, m.method ?? ""].join(", ").replace(/, $/, "")).join("\n");
}

export default async function GarmentProjectPage({
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
        title="Garment Innovation Lab"
        spec="§9.4"
        summary="Project detail: before-state, ideation rounds, simulations, physical tests, case study."
      />
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const detail = await getGarmentProjectDetail(supabase, id);
  if (!detail) notFound();
  const { project, tests, assets, rounds } = detail;

  const caseStudy = assembleGarmentCaseStudy({
    title: project.title,
    problem_statement: project.problem_statement,
    problem_kind: project.problem_kind,
    before_notes: project.before_notes,
    tests: tests as CaseStudyTest[],
    assets: assets as CaseStudyAsset[],
    measurements_before: project.measurements_before,
    measurements_after: project.measurements_after,
  });

  return (
    <div className="max-w-5xl">
      <p className="text-xs text-warm-500">
        <Link href="/studio/garments" className="hover:text-ink">← Garment Lab</Link>
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">{project.title}</h1>
        <Badge tone="accent">{project.problem_kind ?? "unclassified"}</Badge>
        <Badge tone="neutral">{project.status}</Badge>
        {detail.productTitle ? <Badge tone="info">product: {detail.productTitle}</Badge> : null}
      </div>

      <MessageBanner searchParams={sp} />

      {/* Project record + before-state */}
      <Card className="mt-6">
        <CardHeader
          title="Project & before-state"
          description="The problem statement and before-notes anchor every later claim. Photos are recorded as assets with intent captions."
        />
        <form action={saveGarmentProject} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="garment_project_id" value={project.id} />
          <FormField id="title" label="Title">
            <Input id="title" name="title" defaultValue={project.title} required />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField id="problem_kind" label="Problem kind">
              <select id="problem_kind" name="problem_kind" className={inputClass} defaultValue={project.problem_kind ?? "fit"}>
                {GARMENT_PROBLEM_KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </FormField>
            <FormField id="status" label="Status">
              <select id="status" name="status" className={inputClass} defaultValue={project.status}>
                {["active", "prototype_tested", "concluded", "paused"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField id="problem_statement" label="Problem statement">
              <textarea id="problem_statement" name="problem_statement" rows={2} className={inputClass} defaultValue={project.problem_statement ?? ""} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField id="before_notes" label="Before-state notes / wear-test observations">
              <textarea id="before_notes" name="before_notes" rows={3} className={inputClass} defaultValue={project.before_notes ?? ""} />
            </FormField>
          </div>
          <input type="hidden" name="product_id" value={project.product_id ?? ""} />
          <div>
            <Button type="submit">Save project</Button>
          </div>
        </form>
      </Card>

      {/* Before/after measurements */}
      <Card className="mt-6">
        <CardHeader
          title="Before / after measurements"
          description="One measurement per line: name, value, unit[, method]. The comparison below only computes a delta when the unit matches."
        />
        <form action={saveGarmentMeasurements} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="garment_project_id" value={project.id} />
          <FormField id="measurements_before" label="Before">
            <textarea id="measurements_before" name="measurements_before" rows={4} className={inputClass} defaultValue={measurementsToText(project.measurements_before)} placeholder={"pocket_depth, 11, cm, seam-to-opening"} />
          </FormField>
          <FormField id="measurements_after" label="After (prototype)">
            <textarea id="measurements_after" name="measurements_after" rows={4} className={inputClass} defaultValue={measurementsToText(project.measurements_after)} placeholder={"pocket_depth, 16, cm, seam-to-opening"} />
          </FormField>
          <div>
            <Button type="submit">Save measurements</Button>
          </div>
        </form>
        {caseStudy.measurement_comparison.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-warm-200 text-left text-xs uppercase tracking-wide text-warm-500">
                  <th className="py-2 pr-4">Measurement</th>
                  <th className="py-2 pr-4">Before</th>
                  <th className="py-2 pr-4">After</th>
                  <th className="py-2">Δ</th>
                </tr>
              </thead>
              <tbody>
                {caseStudy.measurement_comparison.map((m) => (
                  <tr key={m.name} className="border-b border-warm-100">
                    <td className="py-2 pr-4 font-medium text-ink">{m.name}</td>
                    <td className="py-2 pr-4 text-warm-700">{m.before !== null ? `${m.before} ${m.unit}` : "—"}</td>
                    <td className="py-2 pr-4 text-warm-700">{m.after !== null ? `${m.after} ${m.unit}` : "—"}</td>
                    <td className="py-2 text-warm-700">{m.delta !== null ? `${m.delta > 0 ? "+" : ""}${m.delta} ${m.unit}` : "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {/* AI ideation rounds */}
      <Card className="mt-6">
        <CardHeader
          title="AI ideation rounds"
          description="Every round stores the exact prompt, references, selection criteria and operator comments, linked to a full ai_generations provenance row (§13.3). Output is a draft hypothesis — never evidence."
        />
        <form action={runIdeationRound} className="grid gap-4">
          <input type="hidden" name="garment_project_id" value={project.id} />
          <FormField id="prompt_text" label="Exact prompt">
            <textarea id="prompt_text" name="prompt_text" rows={2} required className={inputClass} placeholder="Propose three pocket constructions that keep a 16cm phone clear of the crop line…" />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="reference_notes" label="References (garments, links, sketches)">
              <textarea id="reference_notes" name="reference_notes" rows={2} className={inputClass} />
            </FormField>
            <FormField id="selection_criteria" label="Selection criteria">
              <textarea id="selection_criteria" name="selection_criteria" rows={2} className={inputClass} placeholder="Keeps silhouette; survives 30 wash cycles; no visible hardware." />
            </FormField>
          </div>
          <FormField id="operator_comments" label="Operator comments (post-round review)">
            <textarea id="operator_comments" name="operator_comments" rows={2} className={inputClass} />
          </FormField>
          <div>
            <Button type="submit">Run ideation round</Button>
          </div>
        </form>

        {rounds.length > 0 ? (
          <ol className="mt-6 space-y-4">
            {rounds.map((r) => (
              <li key={r.id} className="rounded-md border border-warm-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">Round {r.round_number}</span>
                  {r.ai_generations ? (
                    <Badge tone="neutral">
                      {r.ai_generations.provider}/{r.ai_generations.model} · {r.ai_generations.status}
                    </Badge>
                  ) : (
                    <Badge tone="warning">no provenance row</Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-warm-500">Prompt</p>
                <p className="whitespace-pre-wrap text-sm text-warm-700">{r.prompt_text}</p>
                {r.reference_notes ? (
                  <p className="mt-1 text-sm text-warm-700"><span className="text-xs text-warm-500">References: </span>{r.reference_notes}</p>
                ) : null}
                {r.selection_criteria ? (
                  <p className="mt-1 text-sm text-warm-700"><span className="text-xs text-warm-500">Criteria: </span>{r.selection_criteria}</p>
                ) : null}
                {r.operator_comments ? (
                  <p className="mt-1 text-sm text-warm-700"><span className="text-xs text-warm-500">Operator: </span>{r.operator_comments}</p>
                ) : null}
                {r.ai_generations?.output_text ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-accent">Generated output (draft)</summary>
                    <pre className="mt-1 overflow-x-auto rounded-md bg-warm-50 p-3 text-xs text-warm-700">{r.ai_generations.output_text}</pre>
                  </details>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
      </Card>

      {/* Assets: flats, CLO renders, fit maps, photos */}
      <Card className="mt-6">
        <CardHeader
          title="Flats, CLO renders, fit maps, photos"
          description="Every asset records what the image is intended to show (§9.4) — simulated renders are captioned as simulation, never implied to be physical evidence."
        />
        <form action={addGarmentAsset} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="garment_project_id" value={project.id} />
          <FormField id="kind" label="Kind">
            <select id="kind" name="kind" className={inputClass}>
              {GARMENT_ASSET_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </FormField>
          <FormField id="version" label="Version">
            <Input id="version" name="version" type="number" min={1} defaultValue={1} />
          </FormField>
          <FormField id="asset_path" label="Asset path (private bucket)">
            <Input id="asset_path" name="asset_path" required placeholder="private-assets/garment/pocket-flat-v1.svg" />
          </FormField>
          <FormField id="ai_generation_id" label="AI generation id (optional)">
            <Input id="ai_generation_id" name="ai_generation_id" placeholder="uuid, when AI-assisted" />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="caption" label="Intent caption — what is this image intended to show?">
              <textarea id="caption" name="caption" rows={2} required className={inputClass} placeholder="CLO render: intended to show phone clearance vs crop line; simulated drape only, not physical evidence." />
            </FormField>
          </div>
          <div>
            <Button type="submit">Record asset</Button>
          </div>
        </form>

        {assets.length > 0 ? (
          <ul className="mt-6 space-y-2">
            {assets.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <Badge tone="neutral">{a.kind} v{a.version}</Badge>
                <span className="font-mono text-xs text-warm-500">{a.asset_path}</span>
                {a.ai_generation_id ? <Badge tone="info">AI-linked</Badge> : null}
                <span className="w-full text-warm-700">{a.caption}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* Tests */}
      <Card className="mt-6">
        <CardHeader
          title="Simulations & physical tests"
          description="CLO simulations are simulated evidence; wear tests and prototype tests are physical evidence. A named human tester requires explicit consent (§15.3)."
        />
        <form action={addGarmentTest} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="garment_project_id" value={project.id} />
          <FormField id="kind" label="Kind">
            <select id="kind" name="kind" className={inputClass}>
              {GARMENT_TEST_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </FormField>
          <FormField id="tester_label" label="Tester label (pseudonymous)">
            <Input id="tester_label" name="tester_label" placeholder="tester-a" />
          </FormField>
          <FormField id="tested_at" label="Tested at">
            <Input id="tested_at" name="tested_at" type="datetime-local" />
          </FormField>
          <label className="mt-6 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="consent_obtained" className="h-4 w-4 rounded border-warm-300" />
            Explicit consent obtained (§15.3)
          </label>
          <div className="sm:col-span-2">
            <FormField id="context" label="Context (conditions, duration, alteration details)">
              <textarea id="context" name="context" rows={2} className={inputClass} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField id="feedback" label="Feedback">
              <textarea id="feedback" name="feedback" rows={2} className={inputClass} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField id="discrepancies_vs_simulation" label="Discrepancies vs simulation">
              <textarea id="discrepancies_vs_simulation" name="discrepancies_vs_simulation" rows={2} className={inputClass} placeholder="What did the simulation get wrong?" />
            </FormField>
          </div>
          <div>
            <Button type="submit">Record test</Button>
          </div>
        </form>

        {tests.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {tests.map((t) => (
              <li key={t.id} className="rounded-md border border-warm-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={t.kind === "clo_simulation" ? "info" : "success"}>{t.kind}</Badge>
                  {t.tester_label ? <span className="text-warm-700">{t.tester_label}</span> : null}
                  {t.tester_label ? (
                    <Badge tone={t.consent_obtained ? "success" : "danger"}>
                      {t.consent_obtained ? "consent" : "NO CONSENT"}
                    </Badge>
                  ) : null}
                  <span className="text-xs text-warm-500">{formatDate(t.tested_at)}</span>
                </div>
                {t.context ? <p className="mt-1 text-warm-700">{t.context}</p> : null}
                {t.feedback ? <p className="mt-1 text-warm-700">{t.feedback}</p> : null}
                {t.discrepancies_vs_simulation ? (
                  <p className="mt-1 text-warning">Δ vs simulation: {t.discrepancies_vs_simulation}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* Case study */}
      <Card className="mt-6">
        <CardHeader
          title="Case study (auto-assembled)"
          description="Simulated evidence and physical evidence are presented in separate sections — a render can never be quoted as a wear test."
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-info">Simulated evidence</h3>
            {caseStudy.simulated.tests.length + caseStudy.simulated.assets.length === 0 ? (
              <p className="mt-2 text-sm text-warm-500">No simulations recorded yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-warm-700">
                {caseStudy.simulated.tests.map((t, i) => (
                  <li key={`t-${i}`}>{t.context ?? t.kind}{t.feedback ? ` — ${t.feedback}` : ""}</li>
                ))}
                {caseStudy.simulated.assets.map((a, i) => (
                  <li key={`a-${i}`} className="text-warm-500">{a.kind} v{a.version}: {a.caption}</li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-success">Physical evidence</h3>
            {caseStudy.physical.tests.length + caseStudy.physical.assets.length === 0 ? (
              <p className="mt-2 text-sm text-warm-700">No physical prototype or wear test recorded yet — the case study cannot claim tested performance.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm text-warm-700">
                {caseStudy.physical.tests.map((t, i) => (
                  <li key={`t-${i}`}>
                    {t.kind}{t.tester_label ? ` (${t.tester_label})` : ""}: {t.feedback ?? t.context ?? ""}
                  </li>
                ))}
                {caseStudy.physical.assets.map((a, i) => (
                  <li key={`a-${i}`} className="text-warm-500">{a.kind} v{a.version}: {a.caption}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
        {caseStudy.discrepancies.length > 0 ? (
          <section className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-warning">Discrepancies (simulation vs physical)</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warm-700">
              {caseStudy.discrepancies.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </Card>
    </div>
  );
}
