"use client";

import { useState, useTransition } from "react";
import {
  AESTHETIC_OPTIONS,
  ERA_OPTIONS,
  ENERGY_OPTIONS,
  MATERIAL_OPTIONS,
  PALETTE_OPTIONS,
  SILHOUETTE_OPTIONS,
} from "../taxonomy-options";
import {
  ChipRow,
  FeedbackPanel,
  inputClass,
  runStyleRequest,
  type StyleApiResponse,
} from "./style-common";

/**
 * Decode This Reference (§8.5): describe a reference with attribute tags
 * (+ optional note), get a structured breakdown — silhouette, palette,
 * materials + substitutes, era with confidence/uncertainty, distinctive vs
 * incidental, Singapore-climate translation, and catalog/closet matches.
 */

interface AttributeRow {
  dimension: string;
  value: string;
}

const DIMENSION_VALUE_OPTIONS: Record<string, readonly string[]> = {
  silhouette: SILHOUETTE_OPTIONS,
  palette_role: PALETTE_OPTIONS,
  material: MATERIAL_OPTIONS,
  era: ERA_OPTIONS,
  energy: ENERGY_OPTIONS,
  aesthetic: AESTHETIC_OPTIONS,
};

interface DecodeResultView {
  silhouette?: { values: string[]; confidence: number; uncertain: boolean };
  palette?: { values: string[]; confidence: number; uncertain: boolean };
  materials?: { values: string[]; confidence: number; uncertain: boolean; substitutes: string[] };
  era?: { values: string[]; confidence: number; uncertain: boolean };
  distinctive?: string[];
  incidental?: string[];
  climateTranslation?: string[];
  uncertainties?: string[];
  narrative?: string;
  catalogNote?: string | null;
  matches?: Array<{ item: { label: string; source: string }; score: number; matched: string[] }>;
}

function ReadRow({
  label,
  read,
}: {
  label: string;
  read?: { values: string[]; confidence: number; uncertain: boolean };
}) {
  if (!read || !read.values.length) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-warm-100 py-2 text-sm">
      <span className="font-medium text-ink">{label}</span>
      <span className="text-right">
        <span className="text-warm-700">{read.values.join(" + ")}</span>{" "}
        <span className={`text-xs ${read.uncertain ? "text-amber-700" : "text-warm-500"}`}>
          {read.uncertain ? "uncertain" : "confident"} ({read.confidence.toFixed(2)})
        </span>
      </span>
    </div>
  );
}

export function DecodeForm() {
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<AttributeRow[]>([{ dimension: "silhouette", value: "" }]);
  const [pending, startTransition] = useTransition();
  const [response, setResponse] = useState<StyleApiResponse | null>(null);

  function setRow(index: number, key: keyof AttributeRow, value: string) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? key === "dimension"
            ? { dimension: value, value: "" }
            : { ...row, [key]: value }
          : row,
      ),
    );
  }

  function submit() {
    const attributes = rows
      .filter((r) => r.dimension && r.value)
      .map((r) => ({ dimension: r.dimension, value: r.value, confidence: null, source: "human" }));
    if (!attributes.length) {
      setResponse({ ok: false, error: "Add at least one attribute read from the reference." });
      return;
    }
    startTransition(async () => {
      const res = await runStyleRequest("decode_reference", {
        note,
        attributes,
        useAiNarrative: true,
      });
      setResponse(res);
    });
  }

  const result = response?.result as DecodeResultView | undefined;

  return (
    <div>
      <label htmlFor="decode-note" className="block text-xs font-medium text-warm-700">
        Reference note (what are you looking at?)
        <textarea
          id="decode-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Pinterest fit pic: boxy jacket over wide trousers, all black"
          className={`${inputClass} mt-1`}
        />
      </label>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-warm-700">Decoded attributes</legend>
        <div className="mt-2 space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <select
                aria-label={`Attribute ${i + 1} dimension`}
                value={row.dimension}
                onChange={(e) => setRow(i, "dimension", e.target.value)}
                className={inputClass}
              >
                {Object.keys(DIMENSION_VALUE_OPTIONS).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Attribute ${i + 1} value`}
                value={row.value}
                onChange={(e) => setRow(i, "value", e.target.value)}
                className={inputClass}
              >
                <option value="">— pick —</option>
                {(DIMENSION_VALUE_OPTIONS[row.dimension] ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              {rows.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Remove attribute ${i + 1}`}
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="px-2 text-warm-500 hover:text-ink"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {rows.length < 8 ? (
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { dimension: "silhouette", value: "" }])}
            className="mt-2 text-xs text-accent hover:text-accent-strong"
          >
            + Add attribute
          </button>
        ) : null}
      </fieldset>

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="mt-4 rounded-md bg-ink px-4 py-2 text-sm text-white hover:bg-warm-900 disabled:opacity-50"
      >
        {pending ? "Decoding…" : "Decode this reference"}
      </button>

      {response && !response.ok ? (
        <p className="mt-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{response.error}</p>
      ) : null}

      {response?.ok && result ? (
        <section className="mt-8 border-t border-warm-200 pt-6">
          <h2 className="font-display text-lg text-ink">Structured breakdown</h2>
          <div className="mt-2">
            <ReadRow label="Silhouette" read={result.silhouette} />
            <ReadRow label="Palette" read={result.palette} />
            <ReadRow label="Materials" read={result.materials} />
            <ReadRow label="Era" read={result.era} />
          </div>

          <ChipRow label="Distinctive (the look depends on these)" values={result.distinctive ?? []} />
          <ChipRow label="Incidental (replaceable)" values={result.incidental ?? []} />

          {result.materials?.substitutes?.length ? (
            <ChipRow label="Breathable substitutes" values={result.materials.substitutes} />
          ) : null}

          {result.climateTranslation?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink">Singapore translation</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-warm-700">
                {result.climateTranslation.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.uncertainties?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink">Stated uncertainties</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-warm-700">
                {result.uncertainties.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.matches?.length ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-ink">Catalog + closet matches</h3>
              <ul className="mt-2 space-y-2">
                {result.matches.map((m, i) => (
                  <li key={i} className="rounded-md border border-warm-200 p-3 text-sm">
                    <span className="font-medium text-ink">{m.item.label}</span>{" "}
                    <span className="text-xs text-warm-500">
                      {m.item.source === "closet" ? "· owned" : "· catalog"}
                    </span>
                    <p className="mt-1 text-xs text-warm-700">Matches: {m.matched.join(", ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-xs text-warm-500">
              {result.catalogNote ?? "No catalog or closet items matched these signals yet."}
            </p>
          )}

          <FeedbackPanel styleSessionId={response.style_session_id ?? null} />
        </section>
      ) : null}
    </div>
  );
}
