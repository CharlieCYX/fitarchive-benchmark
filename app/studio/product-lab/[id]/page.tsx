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
  addPrototypeTest,
  addRelease,
  savePostmortem,
  savePrd,
  saveProductBrief,
} from "@/features/product-lab/actions";
import { getProductBriefDetail } from "@/features/product-lab/service";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Product brief" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

const BRIEF_STATUSES = ["draft", "prd_written", "prv_prototyped", "shipped", "postmortem_done", "rejected"];

function jsonText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) && value.length === 0) return "";
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

export default async function ProductBriefPage({
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
        title="Product Lab / PRD Studio"
        spec="§9.5"
        summary="Brief detail: PRD, prototype tests, build record, postmortem."
      />
    );
  }

  const { id } = await params;
  const sp = await searchParams;
  const detail = await getProductBriefDetail(supabase, id);
  if (!detail) notFound();
  const { brief, prds, prototypeTests } = detail;
  const prd = prds[0] ?? null;

  return (
    <div className="max-w-5xl">
      <p className="text-xs text-warm-500">
        <Link href="/studio/product-lab" className="hover:text-ink">← Product Lab</Link>
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">{brief.title}</h1>
        <Badge tone="accent">{brief.status}</Badge>
      </div>

      <MessageBanner searchParams={sp} />

      {/* Problem brief */}
      <Card className="mt-6">
        <CardHeader title="Problem brief" description="Evidence and the current workaround come before any solution." />
        <form action={saveProductBrief} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="product_brief_id" value={brief.id} />
          <FormField id="title" label="Title">
            <Input id="title" name="title" defaultValue={brief.title} required />
          </FormField>
          <FormField id="status" label="Status">
            <select id="status" name="status" className={inputClass} defaultValue={brief.status}>
              {BRIEF_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="problem" label="Problem">
              <textarea id="problem" name="problem" rows={2} className={inputClass} defaultValue={brief.problem ?? ""} />
            </FormField>
          </div>
          <FormField id="evidence" label="Evidence">
            <textarea id="evidence" name="evidence" rows={3} className={inputClass} defaultValue={brief.evidence ?? ""} />
          </FormField>
          <FormField id="current_workaround" label="Current workaround">
            <textarea id="current_workaround" name="current_workaround" rows={3} className={inputClass} defaultValue={brief.current_workaround ?? ""} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="target_outcome" label="Target outcome">
              <Input id="target_outcome" name="target_outcome" defaultValue={brief.target_outcome ?? ""} />
            </FormField>
          </div>
          <div>
            <Button type="submit">Save brief</Button>
          </div>
        </form>
      </Card>

      {/* PRD */}
      <Card className="mt-6">
        <CardHeader
          title="PRD"
          description="Competitor matrix, user stories, FRs/NFRs as JSON; success metrics and the instrumentation plan are written before coding; the deferred list defines the MVP boundary."
        />
        <form action={savePrd} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="product_brief_id" value={brief.id} />
          <FormField id="competitor_matrix" label='Competitor matrix (JSON object)'>
            <textarea id="competitor_matrix" name="competitor_matrix" rows={3} className={inputClass} defaultValue={jsonText(prd?.competitor_matrix)} placeholder='{"carousell":"no measurements","vestiaire":"flat dims only"}' />
          </FormField>
          <FormField id="user_stories" label="User stories (JSON array)">
            <textarea id="user_stories" name="user_stories" rows={3} className={inputClass} defaultValue={jsonText(prd?.user_stories)} placeholder='["As a shopper I can compare pit-to-pit against my own jacket"]' />
          </FormField>
          <FormField id="functional_requirements" label="Functional requirements (JSON array)">
            <textarea id="functional_requirements" name="functional_requirements" rows={3} className={inputClass} defaultValue={jsonText(prd?.functional_requirements)} />
          </FormField>
          <FormField id="nonfunctional_requirements" label="Non-functional requirements (JSON array)">
            <textarea id="nonfunctional_requirements" name="nonfunctional_requirements" rows={3} className={inputClass} defaultValue={jsonText(prd?.nonfunctional_requirements)} />
          </FormField>
          <FormField id="mvp_scope" label="MVP scope">
            <textarea id="mvp_scope" name="mvp_scope" rows={3} className={inputClass} defaultValue={prd?.mvp_scope ?? ""} />
          </FormField>
          <FormField id="deferred_features" label="Deliberately deferred (NOT in MVP)">
            <textarea id="deferred_features" name="deferred_features" rows={3} className={inputClass} defaultValue={prd?.deferred_features ?? ""} placeholder="Fit prediction, size recommendations, AR." />
          </FormField>
          <FormField id="success_metrics" label="Success metrics (JSON array)">
            <textarea id="success_metrics" name="success_metrics" rows={3} className={inputClass} defaultValue={jsonText(prd?.success_metrics)} placeholder='["inquiry_rate +10% on measured PDPs"]' />
          </FormField>
          <FormField id="instrumentation_plan" label="Instrumentation plan">
            <textarea id="instrumentation_plan" name="instrumentation_plan" rows={3} className={inputClass} defaultValue={prd?.instrumentation_plan ?? ""} placeholder="Events/views per metric, period, sample rationale." />
          </FormField>
          <div>
            <Button type="submit">{prd ? "Save PRD" : "Create PRD"}</Button>
          </div>
        </form>
      </Card>

      {prd ? (
        <>
          {/* Prototype tests */}
          <Card className="mt-6">
            <CardHeader title="Prototype tests" description="Figma link + observations + confusion notes, per pseudonymous tester." />
            <form action={addPrototypeTest} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="product_brief_id" value={brief.id} />
              <input type="hidden" name="prd_id" value={prd.id} />
              <FormField id="prototype_url" label="Prototype URL (Figma)">
                <Input id="prototype_url" name="prototype_url" placeholder="https://figma.com/…" />
              </FormField>
              <FormField id="tester_label" label="Tester label (pseudonymous)">
                <Input id="tester_label" name="tester_label" placeholder="tester-b" />
              </FormField>
              <FormField id="tested_at" label="Tested at">
                <Input id="tested_at" name="tested_at" type="datetime-local" />
              </FormField>
              <div className="sm:col-span-2">
                <FormField id="observation" label="Observation">
                  <textarea id="observation" name="observation" rows={2} required className={inputClass} />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField id="confusion_notes" label="Confusion notes">
                  <textarea id="confusion_notes" name="confusion_notes" rows={2} className={inputClass} />
                </FormField>
              </div>
              <div>
                <Button type="submit">Record test</Button>
              </div>
            </form>

            {prototypeTests.length > 0 ? (
              <ul className="mt-6 space-y-3">
                {prototypeTests.map((t) => (
                  <li key={t.id} className="rounded-md border border-warm-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      {t.tester_label ? <Badge tone="neutral">{t.tester_label}</Badge> : null}
                      <span className="text-xs text-warm-500">{formatDate(t.tested_at)}</span>
                      {t.prototype_url ? (
                        <a href={t.prototype_url} className="text-xs text-accent hover:text-accent-strong" target="_blank" rel="noreferrer">
                          prototype ↗
                        </a>
                      ) : null}
                    </div>
                    <p className="mt-1 text-warm-700">{t.observation}</p>
                    {t.confusion_notes ? (
                      <p className="mt-1 text-warning">Confusion: {t.confusion_notes}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {/* Feature build record */}
          <Card className="mt-6">
            <CardHeader title="Feature build record" description="One real feature: releases + the feedback each release received." />
            <form action={addRelease} className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="product_brief_id" value={brief.id} />
              <input type="hidden" name="prd_id" value={prd.id} />
              <FormField id="version" label="Version">
                <Input id="version" name="version" required placeholder="v0.1" />
              </FormField>
              <FormField id="released_at" label="Released at">
                <Input id="released_at" name="released_at" type="datetime-local" />
              </FormField>
              <div className="sm:col-span-2">
                <FormField id="summary" label="Summary">
                  <textarea id="summary" name="summary" rows={2} required className={inputClass} />
                </FormField>
              </div>
              <div className="sm:col-span-2">
                <FormField id="feedback" label="Feedback received">
                  <textarea id="feedback" name="feedback" rows={2} className={inputClass} />
                </FormField>
              </div>
              <div>
                <Button type="submit">Add release</Button>
              </div>
            </form>
            {prd.releases.length > 0 ? (
              <ol className="mt-6 space-y-2">
                {prd.releases.map((r, i) => (
                  <li key={i} className="rounded-md border border-warm-200 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone="accent">{r.version}</Badge>
                      <span className="text-xs text-warm-500">{formatDate(r.released_at)}</span>
                    </div>
                    <p className="mt-1 text-warm-700">{r.summary}</p>
                    {r.feedback ? <p className="mt-1 text-xs text-warm-500">Feedback: {r.feedback}</p> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </Card>

          {/* Postmortem */}
          <Card className="mt-6">
            <CardHeader
              title="Postmortem"
              description="What happened, what the metrics said — and explicitly what should NOT be built."
            />
            <form action={savePostmortem} className="grid gap-4">
              <input type="hidden" name="product_brief_id" value={brief.id} />
              <input type="hidden" name="prd_id" value={prd.id} />
              <FormField id="postmortem" label="Postmortem (include a 'do not build' list)">
                <textarea id="postmortem" name="postmortem" rows={6} className={inputClass} defaultValue={prd.postmortem ?? ""} />
              </FormField>
              <div>
                <Button type="submit">Save postmortem</Button>
              </div>
            </form>
          </Card>
        </>
      ) : null}
    </div>
  );
}
