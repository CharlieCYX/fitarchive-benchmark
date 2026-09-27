import { z } from "zod";

/**
 * Research CSV import adapter (§23.3 schema) — pure module, unit-tested.
 *
 * Validated batch import for research listings. The parser handles quoted
 * cells/commas/newlines; every row is validated independently — valid rows
 * import, invalid rows are reported with per-field errors and never
 * partially inserted by the caller.
 */

/** §23.3 canonical column order (header must match, order-insensitive). */
export const RESEARCH_CSV_COLUMNS = [
  "source_platform",
  "source_url",
  "captured_at",
  "seller_handle",
  "title",
  "brand",
  "category",
  "aesthetic",
  "color",
  "material",
  "asking_price_sgd",
  "condition",
  "visible_engagement",
  "listing_age_days",
  "permission_state",
  "drop_candidate",
  "notes",
] as const;

export type ResearchCsvColumn = (typeof RESEARCH_CSV_COLUMNS)[number];

export const PERMISSION_STATES = [
  "observed_only",
  "asked_pending",
  "granted",
  "declined",
] as const;

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

export const researchCsvRowSchema = z.object({
  source_platform: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1, "source_platform is required.").max(120),
  ),
  source_url: z.preprocess(
    emptyToUndefined,
    z.string().trim().url("source_url must be a valid URL.").max(2000).optional(),
  ),
  captured_at: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .refine((v) => !Number.isNaN(Date.parse(v)), "captured_at must be a date/timestamp.")
      .optional(),
  ),
  seller_handle: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  title: z.preprocess(
    emptyToUndefined,
    z.string().trim().min(2, "title is required (min 2 chars).").max(300),
  ),
  brand: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  category: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  aesthetic: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  color: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  material: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  asking_price_sgd: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .nonnegative("asking_price_sgd cannot be negative.")
      .max(1_000_000)
      .optional(),
  ),
  condition: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  visible_engagement: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().nonnegative().optional(),
  ),
  listing_age_days: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().nonnegative().optional(),
  ),
  permission_state: z.preprocess(
    emptyToUndefined,
    z.enum(PERMISSION_STATES).optional(),
  ),
  drop_candidate: z.preprocess((v) => {
    if (typeof v !== "string") return undefined;
    const t = v.trim().toLowerCase();
    if (t === "") return undefined;
    if (["true", "yes", "1", "y"].includes(t)) return true;
    if (["false", "no", "0", "n"].includes(t)) return false;
    return v; // invalid → schema error
  }, z.boolean().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(4000).optional()),
});

export type ResearchCsvRow = z.infer<typeof researchCsvRowSchema>;

/* ------------------------------------------------------------------ */
/* CSV parsing (RFC-4180-ish: quoted cells, embedded commas/newlines)  */
/* ------------------------------------------------------------------ */

/** Parse CSV text into a matrix of cell strings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/* ------------------------------------------------------------------ */
/* Batch validation                                                    */
/* ------------------------------------------------------------------ */

export interface CsvRowError {
  /** 1-based data-row index (header excluded). */
  row: number;
  errors: string[];
  raw: Record<string, string>;
}

export interface CsvImportValidation {
  ok: boolean;
  /** Header problems (missing required columns) — when set, no rows run. */
  headerError: string | null;
  valid: ResearchCsvRow[];
  invalid: CsvRowError[];
}

const REQUIRED_COLUMNS: readonly ResearchCsvColumn[] = ["source_platform", "title"];

/**
 * Validate a full CSV document against the §23.3 schema. Unknown extra
 * columns are ignored (noted by the caller); missing REQUIRED columns fail
 * the whole file; every other row-level problem fails just that row.
 */
export function validateResearchCsv(text: string): CsvImportValidation {
  const matrix = parseCsv(text);
  if (matrix.length < 2) {
    return {
      ok: false,
      headerError: "CSV needs a header row and at least one data row.",
      valid: [],
      invalid: [],
    };
  }
  const header = matrix[0].map((h) => h.trim().toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return {
      ok: false,
      headerError: `Missing required column(s): ${missing.join(", ")}. Expected schema (§23.3): ${RESEARCH_CSV_COLUMNS.join(", ")}.`,
      valid: [],
      invalid: [],
    };
  }
  const unknown = header.filter(
    (h) => !(RESEARCH_CSV_COLUMNS as readonly string[]).includes(h),
  );

  const valid: ResearchCsvRow[] = [];
  const invalid: CsvRowError[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const raw: Record<string, string> = {};
    header.forEach((col, j) => {
      raw[col] = matrix[i][j] ?? "";
    });
    const parsed = researchCsvRowSchema.safeParse(raw);
    if (parsed.success) {
      valid.push(parsed.data);
    } else {
      invalid.push({
        row: i,
        errors: parsed.error.issues.map(
          (issue) => `${String(issue.path[0] ?? "?")}: ${issue.message}`,
        ),
        raw,
      });
    }
  }
  if (unknown.length) {
    // Unknown columns are ignored but surfaced — no silent data loss claims.
    invalid.push({
      row: 0,
      errors: [`Ignored unknown column(s): ${unknown.join(", ")}`],
      raw: {},
    });
  }
  return { ok: invalid.filter((e) => e.row > 0).length === 0, headerError: null, valid, invalid };
}
