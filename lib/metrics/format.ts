/**
 * Metric formatting + channel attribution helpers (EVENTS_AND_METRICS.md §2/§3).
 * PURE module — no I/O. Unit-tested in tests/unit/metric-format.test.ts.
 *
 * Honesty rules enforced here:
 * - A NULL rate (no denominator) renders as an em dash, never "0%" (§2 guardrails).
 * - Rates from the SQL views arrive as 0–1 ratios rounded to 4dp.
 * - Sample sizes are always formattable so charts can state "n = …".
 */

/** Ratio (0–1) → "12.3%". Null/invalid → em dash (never a fabricated zero). */
export function formatRate(
  value: number | string | null | undefined,
  digits = 1,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

/** Integer-ish count → locale string; null → em dash. */
export function formatCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-SG", { maximumFractionDigits: 0 }).format(n);
}

/** Sample-size context shown beside every chart number (§12.3). */
export function formatSampleSize(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n = —";
  return `n = ${n}`;
}

/**
 * Postgres interval text (default IntervalStyle) → fractional days.
 * Handles "5 days", "1 day 02:30:00", "12:00:00", "-2 days", and a bare
 * ISO-8601-ish "P5D" just in case a client serializes differently.
 * Returns null when unparseable — the UI then shows the raw string.
 */
export function intervalToDays(interval: string | null | undefined): number | null {
  if (!interval) return null;
  const s = interval.trim();
  const m = s.match(
    /^(?:(-?\d+)\s+days?)?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/,
  );
  if (m && (m[1] !== undefined || m[2] !== undefined)) {
    const days = Number(m[1] ?? 0);
    const hours = Number(m[2] ?? 0);
    const minutes = Number(m[3] ?? 0);
    const seconds = Number(m[4] ?? 0);
    const fraction = (hours * 3600 + minutes * 60 + seconds) / 86400;
    return days < 0 ? days - fraction : days + fraction;
  }
  const iso = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/i);
  if (iso) {
    return (
      Number(iso[1] ?? 0) + (Number(iso[2] ?? 0) + Number(iso[3] ?? 0) / 60) / 24
    );
  }
  return null;
}

/** Median time-to-sale (an interval) → "5.2 days" (§2: median, not mean). */
export function formatIntervalDays(
  interval: string | null | undefined,
  digits = 1,
): string {
  const days = intervalToDays(interval);
  if (days === null) return "—";
  return `${days.toFixed(digits)} days`;
}

export type ChannelGroup = "direct" | "social" | "referral" | "other";

export const CHANNEL_LABELS: Record<ChannelGroup, string> = {
  direct: "Direct",
  social: "Social",
  referral: "Referral",
  other: "Other / manual",
};

const SOCIAL_SOURCES = new Set([
  "instagram",
  "ig",
  "tiktok",
  "facebook",
  "fb",
  "pinterest",
  "xiaohongshu",
  "telegram",
  "whatsapp",
  "threads",
]);

const REFERRAL_SOURCES = new Set(["carousell", "ssqrd"]);

const SOCIAL_HOSTS = [
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "fb.com",
  "pinterest.",
  "xiaohongshu.com",
  "t.me",
  "threads.net",
];

const REFERRAL_HOSTS = ["carousell.", "ssqrd."];

function referrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Channel attribution for page_view rows (§12.3 Channel view).
 * Tracked-link UTMs win; bare referrers fall back to host matching;
 * no signal at all is "direct". This is presentation grouping over the raw
 * attribution columns — NOT a canonical §2 metric — kept pure + tested.
 */
export function classifyChannel(input: {
  utm_source?: string | null;
  utm_medium?: string | null;
  referrer?: string | null;
}): ChannelGroup {
  const source = input.utm_source?.trim().toLowerCase() || null;
  const medium = input.utm_medium?.trim().toLowerCase() || null;
  if (source) {
    if (SOCIAL_SOURCES.has(source)) return "social";
    if (REFERRAL_SOURCES.has(source) || medium === "referral") return "referral";
    return "other";
  }
  const host = referrerHost(input.referrer);
  if (!host) return "direct";
  if (
    host === "localhost" ||
    host.endsWith(".fitarchive.sg") ||
    host === "fitarchive.sg" ||
    host.endsWith(".netlify.app")
  ) {
    return "direct";
  }
  if (SOCIAL_HOSTS.some((h) => host.includes(h))) return "social";
  if (REFERRAL_HOSTS.some((h) => host.includes(h))) return "referral";
  return "other";
}
