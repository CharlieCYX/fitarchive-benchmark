/**
 * Design tokens (Build Bible §14.2) — single source of truth for values that
 * also exist in app/globals.css (@theme). Kept in TS so charts and tests can
 * reference them without parsing CSS. Editorial + restrained: near-black,
 * warm grays, white, ONE violet accent used sparingly; muted semantics only.
 */

export const colors = {
  ink: "#1a1815", // near-black, warm
  inkSoft: "#45413a",
  paper: "#faf8f5", // warm off-white page background
  white: "#ffffff",
  warm100: "#f2efea",
  warm200: "#e5e1d9", // hairline borders
  warm300: "#cfc9bf",
  warm500: "#8e8880", // muted text
  warm700: "#57524b",
  accent: "#5b3fd3", // the single violet accent — use sparingly
  accentStrong: "#4b34b8",
  success: "#3e7a55",
  warning: "#8a6a1f",
  danger: "#a03e2c",
  info: "#3f5f7a",
} as const;

/** Spacing rhythm in px (§14.2). Tailwind v4's 4px base scale matches 1:1
 *  (p-1 = 4px … p-16 = 64px), so these exist for non-Tailwind consumers. */
export const spacingScale = [4, 8, 12, 16, 24, 32, 48, 64] as const;

export const radii = { sm: 6, md: 8, lg: 10 } as const;

export const fonts = {
  display:
    '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
} as const;
