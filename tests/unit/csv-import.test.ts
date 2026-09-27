import { describe, expect, it } from "vitest";

import {
  RESEARCH_CSV_COLUMNS,
  parseCsv,
  validateResearchCsv,
} from "@/lib/integrations/csv";

const HEADER = RESEARCH_CSV_COLUMNS.join(",");

const VALID_ROW = [
  "Carousell",
  "https://carousell.sg/p/vintage-nike-jacket-123",
  "2026-09-01T10:00:00+08:00",
  "@thriftking",
  "Vintage Nike windbreaker",
  "Nike",
  "outerwear",
  "gorpcore",
  "navy",
  "nylon",
  "45",
  "good",
  "23",
  "5",
  "observed_only",
  "true",
  "drop candidate",
].join(",");

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles quoted cells with commas, quotes and newlines", () => {
    expect(parseCsv('a,b\n"x, ""y""","line1\nline2"')).toEqual([
      ["a", "b"],
      ['x, "y"', "line1\nline2"],
    ]);
  });

  it("handles CRLF and trailing newline", () => {
    expect(parseCsv("a,b\r\nc,d\r\n")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("validateResearchCsv (§23.3)", () => {
  it("accepts a fully valid document", () => {
    const result = validateResearchCsv(`${HEADER}\n${VALID_ROW}`);
    expect(result.headerError).toBeNull();
    expect(result.ok).toBe(true);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].title).toBe("Vintage Nike windbreaker");
    expect(result.valid[0].asking_price_sgd).toBe(45);
    expect(result.valid[0].drop_candidate).toBe(true);
    expect(result.valid[0].permission_state).toBe("observed_only");
    expect(result.invalid).toHaveLength(0);
  });

  it("fails the whole file when a required column is missing", () => {
    const result = validateResearchCsv("title,brand\nX,Nike");
    expect(result.ok).toBe(false);
    expect(result.headerError).toMatch(/source_platform/);
  });

  it("rejects invalid rows individually with per-field errors", () => {
    const badTitle = VALID_ROW.replace("Vintage Nike windbreaker", "X"); // too short
    const badPrice = VALID_ROW.replace(",45,", ",-10,"); // negative price
    const badPerm = VALID_ROW.replace("observed_only", "whatever");
    const result = validateResearchCsv(`${HEADER}\n${badTitle}\n${VALID_ROW}\n${badPrice}\n${badPerm}`);
    expect(result.ok).toBe(false);
    expect(result.valid).toHaveLength(1); // row 2 is still imported
    expect(result.invalid.map((e) => e.row)).toEqual([1, 3, 4]);
    expect(result.invalid[0].errors.join(" ")).toMatch(/title/);
    expect(result.invalid[1].errors.join(" ")).toMatch(/asking_price_sgd/);
    expect(result.invalid[2].errors.join(" ")).toMatch(/permission_state/);
  });

  it("rejects a non-URL source_url but allows an empty one", () => {
    const noUrl = VALID_ROW.replace("https://carousell.sg/p/vintage-nike-jacket-123", "");
    expect(validateResearchCsv(`${HEADER}\n${noUrl}`).valid).toHaveLength(1);
    const badUrl = VALID_ROW.replace("https://carousell.sg/p/vintage-nike-jacket-123", "not-a-url");
    const result = validateResearchCsv(`${HEADER}\n${badUrl}`);
    expect(result.valid).toHaveLength(0);
    expect(result.invalid[0].errors.join(" ")).toMatch(/source_url/);
  });

  it("ignores unknown columns but reports them", () => {
    const result = validateResearchCsv(`${HEADER},surprise\n${VALID_ROW},extra`);
    expect(result.ok).toBe(true); // data rows all valid
    expect(result.valid).toHaveLength(1);
    expect(result.invalid[0].errors.join(" ")).toMatch(/surprise/);
  });

  it("requires a header and at least one data row", () => {
    const result = validateResearchCsv(HEADER);
    expect(result.ok).toBe(false);
    expect(result.headerError).toBeTruthy();
  });
});
