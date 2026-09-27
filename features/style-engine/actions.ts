"use server";

import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getServiceRoleClient } from "@/lib/db/admin";
import { getOrgId } from "@/lib/db/org";
import { getSessionUser } from "@/lib/auth/session";
import { styleFeedbackSchema } from "@/lib/validation/style";
import {
  ANON_SESSION_COOKIE,
  recordEvent,
} from "@/features/analytics/service";
import { persistStyleFeedback } from "./service";

/**
 * Style Engine server actions (§8.3 feedback, §8.4 save-to-archive). All
 * return serializable results — client components render honest states
 * (saved / auth required / unconfigured) instead of dead buttons.
 */

export type StyleActionStatus =
  | { status: "ok" }
  | { status: "auth_required" }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

/** Session ownership: profile match, or same pseudonymous session. */
async function ownsStyleSession(
  service: ReturnType<typeof getServiceRoleClient>,
  styleSessionId: string,
  profileId: string | null,
  anonId: string | null,
): Promise<boolean> {
  const { data: row } = await service
    .from("style_sessions")
    .select("profile_id, session_id")
    .eq("id", styleSessionId)
    .maybeSingle();
  if (!row) return false;
  if (profileId && row.profile_id === profileId) return true;
  if (!profileId && row.profile_id === null && row.session_id && anonId) {
    const { data: session } = await service
      .from("sessions")
      .select("id")
      .eq("id", row.session_id)
      .eq("anon_id", anonId)
      .maybeSingle();
    return Boolean(session);
  }
  return false;
}

/**
 * Record §8.3 feedback (nailed it / too costume / too hot / wrong silhouette
 * / wrong budget / other) with an optional §8.8 failure-mode tag. Writes
 * style_feedback + fires the style_feedback event.
 */
export async function submitStyleFeedback(input: {
  styleSessionId: string;
  label: string;
  failureMode: string | null;
  note: string;
}): Promise<StyleActionStatus> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const parsed = styleFeedbackSchema.safeParse({
    style_session_id: input.styleSessionId,
    label: input.label,
    failure_mode: input.failureMode,
    note: input.note,
  });
  if (!parsed.success) return { status: "error", message: "Invalid feedback payload." };

  const user = await getSessionUser();
  const jar = await cookies();
  const anonId = jar.get(ANON_SESSION_COOKIE)?.value ?? null;

  let service;
  try {
    service = getServiceRoleClient();
  } catch {
    return { status: "unconfigured" };
  }

  const allowed = await ownsStyleSession(
    service,
    parsed.data.style_session_id,
    user?.id ?? null,
    anonId,
  );
  if (!allowed) {
    return { status: "error", message: "This style session isn't yours to rate." };
  }

  const { error } = await persistStyleFeedback(service, {
    styleSessionId: parsed.data.style_session_id,
    label: parsed.data.label,
    failureMode: parsed.data.failure_mode,
    note: parsed.data.note,
    createdBy: user?.id ?? null,
  });
  if (error) return { status: "error", message: error };

  const orgId = await getOrgId(service);
  if (orgId) {
    await recordEvent(
      service,
      orgId,
      {
        event_name: "style_feedback",
        client_event_id: crypto.randomUUID(),
        occurred_at: new Date().toISOString(),
        route: null,
        referrer: null,
        properties: {
          style_session_id: parsed.data.style_session_id,
          label: parsed.data.label,
        },
      },
      { anonId: anonId ?? crypto.randomUUID(), profileId: user?.id ?? null, userAgent: null },
    );
  }
  return { status: "ok" };
}

/**
 * Save a Build My Fit result to the Archive as an outfit board (§8.2/§8.3).
 * Requires sign-in — anonymous results stay ephemeral.
 */
export async function saveOutfitToArchive(input: {
  styleSessionId: string | null;
  title: string;
  thesis: string;
  occasion: string;
  climate: string;
  items: Array<{
    productId?: string;
    closetItemId?: string;
    placeholderLabel?: string;
    role: string;
  }>;
}): Promise<StyleActionStatus> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const user = await getSessionUser();
  if (!user) return { status: "auth_required" };
  const supabase = await getServerClient();
  if (!supabase) return { status: "unconfigured" };

  const title = input.title.trim().slice(0, 120);
  if (!title) return { status: "error", message: "Give the outfit a title." };

  const { data: outfit, error } = await supabase
    .from("outfits")
    .insert({
      profile_id: user.id,
      style_session_id: input.styleSessionId,
      title,
      thesis: input.thesis.slice(0, 2000) || null,
      occasion: input.occasion.slice(0, 80) || null,
      climate: input.climate,
      is_saved: true,
    })
    .select("id")
    .single();
  if (error || !outfit) return { status: "error", message: error?.message ?? "Save failed." };

  for (const item of input.items.slice(0, 12)) {
    await supabase.from("outfit_items").insert({
      outfit_id: outfit.id as string,
      product_id: item.productId ?? null,
      closet_item_id: item.closetItemId ?? null,
      placeholder_label: item.placeholderLabel ?? null,
      role: item.role.slice(0, 40),
    });
  }
  return { status: "ok" };
}

/**
 * Save a Can This Work? decision to the Archive (§8.4): the session result
 * is already persisted; this pins it to the signed-in shopper's profile so
 * it appears under Style sessions in /archive.
 */
export async function saveCompatibilityDecision(input: {
  styleSessionId: string;
}): Promise<StyleActionStatus> {
  if (!isSupabaseConfigured()) return { status: "unconfigured" };
  const user = await getSessionUser();
  if (!user) return { status: "auth_required" };

  let service;
  try {
    service = getServiceRoleClient();
  } catch {
    return { status: "unconfigured" };
  }
  const jar = await cookies();
  const anonId = jar.get(ANON_SESSION_COOKIE)?.value ?? null;
  const allowed = await ownsStyleSession(service, input.styleSessionId, user.id, anonId);
  if (!allowed) {
    return { status: "error", message: "This style session isn't yours to save." };
  }
  const { error } = await service
    .from("style_sessions")
    .update({ profile_id: user.id })
    .eq("id", input.styleSessionId);
  if (error) return { status: "error", message: error.message };
  return { status: "ok" };
}
