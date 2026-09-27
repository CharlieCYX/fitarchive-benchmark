import { z } from "zod";

/**
 * Event dictionary validation (EVENTS_AND_METRICS.md §1 — exact names/props).
 * `POST /api/events` rejects unknown names or missing required properties
 * with 400; the DB trigger in 0009_events.sql is defense in depth.
 *
 * Identity rule (§15.2): the payload NEVER carries trusted identity. The
 * envelope accepts an optional client `session_id` hint, but the server
 * resolves the real session from the pseudonymous cookie and attaches
 * `profile_id` only from the server-side auth session.
 */

export const EVENT_NAMES = [
  "page_view",
  "drop_view",
  "product_impression",
  "product_view",
  "product_save",
  "product_unsave",
  "share_click",
  "inquiry_start",
  "external_buy_click",
  "checkout_start",
  "order_complete",
  "search_submit",
  "search_result_click",
  "style_session_start",
  "style_result_generated",
  "style_feedback",
  "closet_item_add",
  "campaign_link_click",
  "portfolio_view",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export function isEventName(value: unknown): value is EventName {
  return (
    typeof value === "string" &&
    (EVENT_NAMES as readonly string[]).includes(value)
  );
}

const uuid = z.string().uuid();
const nullableUuid = z.string().uuid().nullable();
const shortText = (max: number) => z.string().trim().min(1).max(max);

/** Envelope shared by every ingest call (shared props: session/occurred_at/route/referrer). */
export const eventEnvelopeSchema = z.object({
  event_name: z.enum(EVENT_NAMES),
  client_event_id: uuid,
  occurred_at: z.iso.datetime({ offset: true }).optional(),
  route: z.string().max(500).optional(),
  referrer: z.string().max(1000).nullish(),
  /** Client hint only — the server-side session cookie is authoritative. */
  session_id: uuid.optional(),
  properties: z.record(z.string(), z.unknown()).default({}),
});

export type EventEnvelope = z.infer<typeof eventEnvelopeSchema>;

const utmProps = {
  campaign: z.string().max(200).nullable(),
  utm_source: z.string().max(200).nullable(),
  utm_medium: z.string().max(200).nullable(),
  utm_campaign: z.string().max(200).nullable(),
  utm_content: z.string().max(200).nullable(),
};

/** Per-name property schemas — keys and nullability per the dictionary. */
export const EVENT_PROPERTY_SCHEMAS: Record<EventName, z.ZodType<Record<string, unknown>>> = {
  page_view: z.object(utmProps),
  drop_view: z.object({ drop_id: uuid }),
  product_impression: z.object({
    product_id: uuid,
    drop_id: nullableUuid,
    position: z.number().int().nonnegative(),
  }),
  product_view: z.object({
    product_id: uuid,
    drop_id: nullableUuid,
    source: z.enum(["drop_grid", "search", "direct", "referral"]),
  }),
  product_save: z.object({ product_id: uuid, collection_id: nullableUuid }),
  product_unsave: z.object({ product_id: uuid }),
  share_click: z
    .object({
      product_id: uuid.optional(),
      drop_id: uuid.optional(),
      channel: shortText(40),
    })
    .refine(
      (o) => Number(Boolean(o.product_id)) + Number(Boolean(o.drop_id)) === 1,
      { message: "share_click requires exactly one of product_id / drop_id." },
    ),
  inquiry_start: z.object({
    product_id: uuid,
    method: z.enum(["form", "external_platform"]),
  }),
  external_buy_click: z.object({
    product_id: uuid,
    destination: z.string().url().max(2000),
    tracked_link_id: uuid,
  }),
  checkout_start: z.object({ order_id: uuid }),
  order_complete: z.object({
    order_id: uuid,
    revenue_sgd: z.number().nonnegative(),
  }),
  search_submit: z.object({
    query: z.string().max(500),
    parsed_filters: z.record(z.string(), z.unknown()).default({}),
    result_count: z.number().int().nonnegative(),
  }),
  search_result_click: z.object({
    query_id: uuid,
    product_id: uuid,
    position: z.number().int().nonnegative(),
  }),
  style_session_start: z.object({
    mode: z.enum(["build_my_fit", "can_this_work", "decode_reference"]),
  }),
  style_result_generated: z.object({
    style_session_id: uuid,
    provider: shortText(80),
    model: shortText(120),
  }),
  style_feedback: z.object({
    style_session_id: uuid,
    label: z.enum([
      "nailed_it",
      "too_costume",
      "too_hot",
      "wrong_silhouette",
      "wrong_budget",
      "other",
    ]),
  }),
  closet_item_add: z.object({ closet_item_id: uuid }),
  campaign_link_click: z.object({ tracked_link_id: uuid }),
  portfolio_view: z.object({
    portfolio_snapshot_id: uuid,
    section: shortText(120),
  }),
};

export interface ValidatedEvent {
  event_name: EventName;
  client_event_id: string;
  occurred_at: string | null;
  route: string | null;
  referrer: string | null;
  properties: Record<string, unknown>;
}

export type EventValidationResult =
  | { ok: true; event: ValidatedEvent }
  | { ok: false; error: string };

/**
 * Validate a raw POST body against the envelope + the per-name property
 * schema. Unknown names, malformed uuids and missing/extra-wrong required
 * properties are rejected (the API maps this to 400).
 */
export function validateEventPayload(body: unknown): EventValidationResult {
  const envelope = eventEnvelopeSchema.safeParse(body);
  if (!envelope.success) {
    return { ok: false, error: z.prettifyError(envelope.error) };
  }
  const { event_name, client_event_id, occurred_at, route, referrer, properties } =
    envelope.data;

  const props = EVENT_PROPERTY_SCHEMAS[event_name].safeParse(properties);
  if (!props.success) {
    return {
      ok: false,
      error: `Invalid properties for ${event_name}: ${z.prettifyError(props.error)}`,
    };
  }
  return {
    ok: true,
    event: {
      event_name,
      client_event_id,
      occurred_at: occurred_at ?? null,
      route: route ?? null,
      referrer: referrer ?? null,
      properties: props.data,
    },
  };
}
