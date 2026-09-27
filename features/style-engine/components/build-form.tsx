"use client";

import { useState, useTransition } from "react";
import { saveOutfitToArchive } from "../actions";
import {
  CLIMATE_OPTIONS,
  ERA_OPTIONS,
  ENERGY_OPTIONS,
  MATERIAL_OPTIONS,
  OCCASION_OPTIONS,
  PALETTE_OPTIONS,
  SILHOUETTE_OPTIONS,
} from "../taxonomy-options";
import {
  ChipRow,
  FeedbackPanel,
  LabeledSelect,
  inputClass,
  runStyleRequest,
  type StyleApiResponse,
} from "./style-common";

/**
 * Build My Fit (§8.3): 1–3 reference sets (manual tags stand in for decoded
 * references when no image exists), occasion, Singapore-default climate,
 * budget, rejected silhouettes and owned items. Deterministic engine first;
 * the mock provider may re-word the narrative.
 */

interface ReferenceDraft {
  silhouette: string;
  palette: string;
  material: string;
  era: string;
  energy: string;
}

interface BuildRecommendation {
  item: { id: string; source: string; label: string; priceSgd: number | null };
  role: string;
  explanation: string;
  confidence: number;
}

interface BuildRejection {
  item: { label: string };
  reason: string;
  detail: string;
}

const EMPTY_REFERENCE: ReferenceDraft = {
  silhouette: "",
  palette: "",
  material: "",
  era: "",
  energy: "",
};

export function BuildForm({
  closetItems,
  signedIn,
}: {
  closetItems: Array<{ id: string; label: string }>;
  signedIn: boolean;
}) {
  const [references, setReferences] = useState<ReferenceDraft[]>([
    { ...EMPTY_REFERENCE },
    { ...EMPTY_REFERENCE },
  ]);
  const [occasion, setOccasion] = useState("daily");
  const [climate, setClimate] = useState("hot-humid");
  const [budget, setBudget] = useState("");
  const [avoid, setAvoid] = useState<string[]>([]);
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [response, setResponse] = useState<StyleApiResponse | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function setRef(index: number, key: keyof ReferenceDraft, value: string) {
    setReferences((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    );
  }

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function submit() {
    setSaveMessage(null);
    const refPayload = references
      .map((r) =>
        (
          [
            ["silhouette", r.silhouette],
            ["palette_role", r.palette],
            ["material", r.material],
            ["era", r.era],
            ["energy", r.energy],
          ] as const
        )
          .filter(([, v]) => v)
          .map(([dimension, value]) => ({
            dimension,
            value,
            confidence: null,
            source: "human",
          })),
      )
      .filter((set) => set.length > 0);
    if (!refPayload.length) {
      setResponse({ ok: false, error: "Describe at least one reference (one tag is enough)." });
      return;
    }
    startTransition(async () => {
      const res = await runStyleRequest("build_my_fit", {
        references: refPayload,
        occasion,
        climate,
        budgetSgd: budget ? Number(budget) : null,
        avoidSilhouettes: avoid,
        ownedItemIds: ownedIds,
        useAiNarrative: true,
      });
      setResponse(res);
    });
  }

  const result = response?.result as
    | {
        thesis?: string;
        narrative?: string;
        sharedSignals?: string[];
        contradictions?: string[];
        climateNotes?: string[];
        recommendations?: BuildRecommendation[];
        rejected?: BuildRejection[];
        confidence?: number;
        aiEnhanced?: boolean;
        catalogNote?: string | null;
      }
    | undefined;

  function saveOutfit() {
    const recs = result?.recommendations;
    if (!recs) return;
    startTransition(async () => {
      const status = await saveOutfitToArchive({
        styleSessionId: response?.style_session_id ?? null,
        title: `${occasion} fit — ${new Date().toISOString().slice(0, 10)}`,
        thesis: result?.thesis ?? "",
        occasion,
        climate,
        items: recs.map((r) => ({
          productId: r.item.source === "catalog" ? r.item.id : undefined,
          closetItemId: r.item.source === "closet" ? r.item.id : undefined,
          placeholderLabel: r.item.source === "manual" ? r.item.label : undefined,
          role: r.role,
        })),
      });
      setSaveMessage(
        status.status === "ok"
          ? "Saved to your Archive as an outfit board."
          : status.status === "auth_required"
            ? "Sign in to save outfits."
            : status.status === "unconfigured"
              ? "Saving activates when Supabase is connected."
              : status.message,
      );
    });
  }

  return (
    <div>
      <div className="grid gap-6">
        <section>
          <h2 className="text-sm font-medium text-ink">References (manual tags)</h2>
          <p className="mt-1 text-xs text-warm-700">
            Decode 1–3 looks you like into tags. The engine reads the pattern
            across them — one tag per row is enough.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {references.map((ref, i) => (
              <fieldset key={i} className="rounded-md border border-warm-200 p-3">
                <legend className="px-1 text-xs uppercase tracking-wide text-warm-500">
                  Reference {i + 1}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  <LabeledSelect id={`r${i}-sil`} label="Silhouette" value={ref.silhouette} onChange={(v) => setRef(i, "silhouette", v)} options={SILHOUETTE_OPTIONS} />
                  <LabeledSelect id={`r${i}-pal`} label="Palette" value={ref.palette} onChange={(v) => setRef(i, "palette", v)} options={PALETTE_OPTIONS} />
                  <LabeledSelect id={`r${i}-mat`} label="Material" value={ref.material} onChange={(v) => setRef(i, "material", v)} options={MATERIAL_OPTIONS} />
                  <LabeledSelect id={`r${i}-era`} label="Era" value={ref.era} onChange={(v) => setRef(i, "era", v)} options={ERA_OPTIONS} />
                  <LabeledSelect id={`r${i}-ene`} label="Energy" value={ref.energy} onChange={(v) => setRef(i, "energy", v)} options={ENERGY_OPTIONS} />
                </div>
              </fieldset>
            ))}
          </div>
          {references.length < 3 ? (
            <button
              type="button"
              onClick={() => setReferences((prev) => [...prev, { ...EMPTY_REFERENCE }])}
              className="mt-2 text-xs text-accent hover:text-accent-strong"
            >
              + Add a third reference
            </button>
          ) : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <LabeledSelect id="occasion" label="Occasion" value={occasion} onChange={setOccasion} options={OCCASION_OPTIONS} allowEmpty={null} />
          <LabeledSelect id="climate" label="Climate" value={climate} onChange={setClimate} options={CLIMATE_OPTIONS} allowEmpty={null} />
          <label htmlFor="budget" className="block text-xs font-medium text-warm-700">
            Budget ceiling (SGD, optional)
            <input
              id="budget"
              type="number"
              min={1}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 90"
              className={`${inputClass} mt-1`}
            />
          </label>
          <fieldset className="text-xs font-medium text-warm-700">
            Silhouettes you reject
            <div className="mt-1 flex flex-wrap gap-1">
              {SILHOUETTE_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAvoid((prev) => toggle(prev, s))}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    avoid.includes(s)
                      ? "border-accent text-accent"
                      : "border-warm-300 text-warm-700"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        {closetItems.length > 0 ? (
          <fieldset className="text-xs font-medium text-warm-700">
            Owned items to build around (from your Archive closet)
            <div className="mt-1 flex flex-wrap gap-1">
              {closetItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setOwnedIds((prev) => toggle(prev, item.id))}
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    ownedIds.includes(item.id)
                      ? "border-accent text-accent"
                      : "border-warm-300 text-warm-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-xs text-warm-500">
            {signedIn
              ? "Your closet is empty — add items in the Archive to build around what you own."
              : "Sign in and add closet items in the Archive to build around what you own."}
          </p>
        )}

        <div>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="rounded-md bg-ink px-4 py-2 text-sm text-white hover:bg-warm-900 disabled:opacity-50"
          >
            {pending ? "Building…" : "Build my fit"}
          </button>
        </div>
      </div>

      {response && !response.ok ? (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {response.error}
        </p>
      ) : null}

      {response?.ok && result ? (
        <section className="mt-8 border-t border-warm-200 pt-6">
          <h2 className="font-display text-lg text-ink">Your fit thesis</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-warm-700">
            {result.narrative ?? result.thesis}
          </p>
          <p className="mt-2 text-xs text-warm-500">
            Confidence {(result.confidence ?? 0).toFixed(2)} ·{" "}
            {result.aiEnhanced
              ? `narrative enhanced by ${response.provider}/${response.model}`
              : "fully deterministic"}
            {response.persisted ? "" : " · not persisted (Supabase offline)"}
          </p>
          <ChipRow label="Shared signals" values={result.sharedSignals ?? []} />
          <ChipRow label="Contradictions" values={result.contradictions ?? []} />
          <ChipRow label="Climate notes" values={result.climateNotes ?? []} />
          {result.catalogNote ? (
            <p className="mt-2 text-xs text-warm-500">{result.catalogNote}</p>
          ) : null}

          {result.recommendations?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink">Recommended (owned first)</h3>
              <ul className="mt-2 space-y-2">
                {result.recommendations.map((rec) => (
                  <li key={`${rec.item.source}-${rec.item.id}`} className="rounded-md border border-warm-200 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{rec.item.label}</span>
                      <span className="text-xs text-warm-500">
                        {rec.role}
                        {rec.item.source === "closet" ? " · owned" : rec.item.priceSgd !== null ? ` · SGD ${rec.item.priceSgd}` : ""}
                        {" · "}{(rec.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-warm-700">{rec.explanation}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.rejected?.length ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-warm-500">
                {result.rejected.length} item(s) ruled out by hard constraints — see why
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-warm-700">
                {result.rejected.map((rej, i) => (
                  <li key={i}>
                    <span className="font-medium">{rej.item.label}</span> — {rej.detail}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {signedIn ? (
            <button
              type="button"
              onClick={saveOutfit}
              disabled={pending}
              className="mt-4 rounded-md border border-warm-300 px-3 py-1.5 text-xs text-warm-700 hover:border-warm-500"
            >
              Save as outfit board in my Archive
            </button>
          ) : null}
          {saveMessage ? <p className="mt-2 text-xs text-warm-700">{saveMessage}</p> : null}

          <FeedbackPanel styleSessionId={response.style_session_id ?? null} />
        </section>
      ) : null}
    </div>
  );
}
