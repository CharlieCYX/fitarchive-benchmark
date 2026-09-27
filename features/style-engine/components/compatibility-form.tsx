"use client";

import { useState, useTransition } from "react";
import { saveCompatibilityDecision } from "../actions";
import {
  CATEGORY_OPTIONS,
  CLIMATE_OPTIONS,
  ERA_OPTIONS,
  ENERGY_OPTIONS,
  MATERIAL_OPTIONS,
  PALETTE_OPTIONS,
  SILHOUETTE_OPTIONS,
} from "../taxonomy-options";
import {
  FeedbackPanel,
  LabeledSelect,
  inputClass,
  runStyleRequest,
  type StyleApiResponse,
} from "./style-common";

/**
 * Can This Work? (§8.4): describe two garments (or pick closet pieces) and
 * get a deterministic verdict — compatible / tension-but-usable /
 * contradictory — with dimension-by-dimension reasoning and repair moves.
 */

interface GarmentDraft {
  label: string;
  category: string;
  silhouette: string;
  material: string;
  palette: string;
  energy: string;
  era: string;
}

const EMPTY_GARMENT: GarmentDraft = {
  label: "",
  category: "",
  silhouette: "",
  material: "",
  palette: "",
  energy: "",
  era: "",
};

interface Assessment {
  dimension: string;
  score: number;
  note: string;
}

function GarmentEditor({
  title,
  draft,
  onChange,
  closetItems,
  onPickCloset,
  idPrefix,
}: {
  title: string;
  draft: GarmentDraft;
  onChange: (d: GarmentDraft) => void;
  closetItems: Array<{ id: string; label: string; category: string | null }>;
  onPickCloset: (id: string) => void;
  idPrefix: string;
}) {
  return (
    <fieldset className="rounded-md border border-warm-200 p-3">
      <legend className="px-1 text-xs uppercase tracking-wide text-warm-500">{title}</legend>
      {closetItems.length > 0 ? (
        <select
          aria-label={`${title} from closet`}
          className={`${inputClass} mb-2`}
          value=""
          onChange={(e) => e.target.value && onPickCloset(e.target.value)}
        >
          <option value="">Prefill from my closet…</option>
          {closetItems.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2 block text-xs font-medium text-warm-700">
          Label
          <input
            value={draft.label}
            onChange={(e) => onChange({ ...draft, label: e.target.value })}
            placeholder="e.g. Vintage wool blazer"
            className={`${inputClass} mt-1`}
          />
        </label>
        <LabeledSelect id={`${idPrefix}-cat`} label="Category" value={draft.category} onChange={(v) => onChange({ ...draft, category: v })} options={CATEGORY_OPTIONS} />
        <LabeledSelect id={`${idPrefix}-sil`} label="Silhouette" value={draft.silhouette} onChange={(v) => onChange({ ...draft, silhouette: v })} options={SILHOUETTE_OPTIONS} />
        <LabeledSelect id={`${idPrefix}-mat`} label="Material" value={draft.material} onChange={(v) => onChange({ ...draft, material: v })} options={MATERIAL_OPTIONS} />
        <LabeledSelect id={`${idPrefix}-pal`} label="Palette" value={draft.palette} onChange={(v) => onChange({ ...draft, palette: v })} options={PALETTE_OPTIONS} />
        <LabeledSelect id={`${idPrefix}-ene`} label="Energy" value={draft.energy} onChange={(v) => onChange({ ...draft, energy: v })} options={ENERGY_OPTIONS} />
        <LabeledSelect id={`${idPrefix}-era`} label="Era" value={draft.era} onChange={(v) => onChange({ ...draft, era: v })} options={ERA_OPTIONS} />
      </div>
    </fieldset>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  compatible: "border-green-300 bg-green-50 text-green-900",
  tension_but_usable: "border-amber-300 bg-amber-50 text-amber-900",
  contradictory: "border-red-300 bg-red-50 text-red-900",
};

const VERDICT_LABELS: Record<string, string> = {
  compatible: "Compatible",
  tension_but_usable: "Tension — but usable",
  contradictory: "Contradictory",
};

export function CompatibilityForm({
  closetItems,
  signedIn,
}: {
  closetItems: Array<{ id: string; label: string; category: string | null }>;
  signedIn: boolean;
}) {
  const [itemA, setItemA] = useState<GarmentDraft>({ ...EMPTY_GARMENT });
  const [itemB, setItemB] = useState<GarmentDraft>({ ...EMPTY_GARMENT });
  const [climate, setClimate] = useState("hot-humid");
  const [pending, startTransition] = useTransition();
  const [response, setResponse] = useState<StyleApiResponse | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function prefill(setter: (d: GarmentDraft) => void, id: string) {
    const closet = closetItems.find((c) => c.id === id);
    if (!closet) return;
    setter({ ...EMPTY_GARMENT, label: closet.label, category: closet.category ?? "" });
  }

  function toProfile(draft: GarmentDraft, prefix: string) {
    return {
      id: `${prefix}-${draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "unnamed"}`,
      source: "manual",
      label: draft.label || "Unnamed piece",
      category: draft.category || null,
      silhouette: draft.silhouette ? [draft.silhouette] : [],
      material: draft.material ? [draft.material] : [],
      palette: draft.palette ? [draft.palette] : [],
      energy: draft.energy ? [draft.energy] : [],
      era: draft.era ? [draft.era] : [],
      priceSgd: null,
      availability: null,
    };
  }

  function submit() {
    setSaveMessage(null);
    if (!itemA.label.trim() || !itemB.label.trim()) {
      setResponse({ ok: false, error: "Label both pieces so the verdict can refer to them." });
      return;
    }
    startTransition(async () => {
      const res = await runStyleRequest("can_this_work", {
        itemA: toProfile(itemA, "a"),
        itemB: toProfile(itemB, "b"),
        climate,
        question: "",
        useAiNarrative: true,
      });
      setResponse(res);
    });
  }

  const result = response?.result as
    | {
        verdict?: string;
        score?: number;
        assessments?: Assessment[];
        repairMoves?: string[];
        climateWarnings?: string[];
      }
    | undefined;

  function saveDecision() {
    startTransition(async () => {
      const sessionId = response?.style_session_id;
      if (!sessionId) {
        setSaveMessage("This run wasn't persisted — connect Supabase to save decisions.");
        return;
      }
      const status = await saveCompatibilityDecision({ styleSessionId: sessionId });
      setSaveMessage(
        status.status === "ok"
          ? "Decision saved — find it under Style sessions in your Archive."
          : status.status === "auth_required"
            ? "Sign in to save decisions to your Archive."
            : status.status === "unconfigured"
              ? "Saving activates when Supabase is connected."
              : status.message,
      );
    });
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <GarmentEditor title="Piece A" draft={itemA} onChange={setItemA} closetItems={closetItems} onPickCloset={(id) => prefill(setItemA, id)} idPrefix="a" />
        <GarmentEditor title="Piece B" draft={itemB} onChange={setItemB} closetItems={closetItems} onPickCloset={(id) => prefill(setItemB, id)} idPrefix="b" />
      </div>
      <div className="mt-4 max-w-xs">
        <LabeledSelect id="compat-climate" label="Climate" value={climate} onChange={setClimate} options={CLIMATE_OPTIONS} allowEmpty={null} />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="mt-4 rounded-md bg-ink px-4 py-2 text-sm text-white hover:bg-warm-900 disabled:opacity-50"
      >
        {pending ? "Comparing…" : "Can this work?"}
      </button>

      {response && !response.ok ? (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{response.error}</p>
      ) : null}

      {response?.ok && result ? (
        <section className="mt-8 border-t border-warm-200 pt-6">
          <span className={`inline-block rounded-md border px-3 py-1 text-sm font-medium ${VERDICT_STYLES[result.verdict ?? ""] ?? ""}`}>
            {VERDICT_LABELS[result.verdict ?? ""] ?? result.verdict} — score {result.score}
          </span>

          <ul className="mt-4 space-y-2">
            {(result.assessments ?? []).map((a) => (
              <li key={a.dimension} className="text-sm">
                <span className="font-medium capitalize text-ink">{a.dimension}</span>{" "}
                <span className="text-xs text-warm-500">({Math.round(a.score * 100)}%)</span>
                <p className="text-xs text-warm-700">{a.note}</p>
              </li>
            ))}
          </ul>

          {result.repairMoves?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink">Repair moves</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-warm-700">
                {result.repairMoves.map((move, i) => (
                  <li key={i}>{move}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.climateWarnings?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink">Climate warnings</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-warm-700">
                {result.climateWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {signedIn ? (
            <button
              type="button"
              onClick={saveDecision}
              disabled={pending}
              className="mt-4 rounded-md border border-warm-300 px-3 py-1.5 text-xs text-warm-700 hover:border-warm-500"
            >
              Save this decision to my Archive
            </button>
          ) : null}
          {saveMessage ? <p className="mt-2 text-xs text-warm-700">{saveMessage}</p> : null}

          <FeedbackPanel styleSessionId={response.style_session_id ?? null} />
        </section>
      ) : null}
    </div>
  );
}
