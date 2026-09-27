import { z } from "zod";

/** Shared zod schemas for API routes + forms (react-hook-form in later phases). */

export const emailSchema = z.email({ message: "Enter a valid email address." });

export const magicLinkSchema = z.object({
  email: emailSchema,
});

export type MagicLinkInput = z.infer<typeof magicLinkSchema>;

export * from "./research";
export * from "./catalog";
export * from "./sellers";
export * from "./drops";
export * from "./campaigns";
export * from "./events";
