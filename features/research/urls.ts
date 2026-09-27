/**
 * Source-URL normalization for duplicate detection (§7.2).
 * Pure module — unit-tested in tests/unit/url-normalization.test.ts.
 *
 * Rules (deterministic, side-effect free):
 * - trim; only http/https accepted (anything else → null, caller stores NULL)
 * - lowercase scheme + host; strip leading "www."
 * - drop the fragment entirely
 * - strip known tracking params (utm_*, fbclid, gclid, …)
 * - sort remaining query params so ordering doesn't defeat dedupe
 * - strip trailing slashes on the path
 * - default ports disappear via URL.host
 */

const TRACKING_PARAM_EXACT = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "gad_source",
  "gbraid",
  "wbraid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_",
  "spm",
  "scm",
  "_ga",
  "si",
  "feature",
]);

function isTrackingParam(key: string): boolean {
  const k = key.toLowerCase();
  return k.startsWith("utm_") || TRACKING_PARAM_EXACT.has(k);
}

export function normalizeSourceUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParam(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();

  const path = url.pathname.replace(/\/+$/, "") || "/";
  const qs = url.searchParams.toString();
  return `${url.protocol}//${url.host}${path}${qs ? `?${qs}` : ""}`;
}
