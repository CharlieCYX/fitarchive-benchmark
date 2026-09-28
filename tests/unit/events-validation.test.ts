import { describe, expect, it } from "vitest";

import {
  EVENT_NAMES,
  EVENT_PROPERTY_SCHEMAS,
  SERVER_ONLY_EVENT_NAMES,
  validateEventPayload,
} from "@/lib/validation/events";

const ID = {
  a: "11111111-1111-4111-8111-111111111111",
  b: "22222222-2222-4222-8222-222222222222",
  c: "33333333-3333-4333-8333-333333333333",
};

function envelope(name: string, properties: unknown) {
  return { event_name: name, client_event_id: ID.b, properties };
}

describe("event validation (EVENTS_AND_METRICS.md §1 + ADR-006)", () => {
  it("dictionary stays in sync with the contract", () => {
    expect(EVENT_NAMES).toHaveLength(19);
  });

  it("accepts every storefront event with valid properties", () => {
    const valid: Array<[string, unknown]> = [
      ["page_view", {}],
      [
        "page_view",
        { campaign: "drop-001", utm_source: "ig", utm_medium: "social", utm_campaign: "drop001", utm_content: "story" },
      ],
      ["product_view", { product_id: ID.a, drop_id: null }],
      ["favorite_add", { product_id: ID.a }],
      ["inquiry_start", { product_id: ID.a }],
      ["add_to_cart", { product_id: ID.a, variant_id: null }],
      [
        "external_buy_click",
        {
          product_id: ID.a,
          destination: "https://carousell.example/p/123",
          tracked_link_id: ID.c,
        },
      ],
      [
        "search_submit",
        { query: "cropped jacket", parsed_filters: { category: "outerwear" }, result_count: 4 },
      ],
      ["search_result_click", { query_id: ID.b, product_id: ID.a, position: 2 }],
      ["campaign_link_click", { tracked_link_id: ID.c }],
    ];
    for (const [name, properties] of valid) {
      const result = validateEventPayload(envelope(name, properties));
      expect(result.ok, `${name} should validate`).toBe(true);
    }
  });

  it("rejects revenue-bearing events on public ingest (red-team H5)", () => {
    // checkout_start / order_complete are written server-side by the demo
    // checkout service; accepting them publicly would let anyone spoof
    // v_purchase_conversion with a fabricated revenue_sgd.
    expect(SERVER_ONLY_EVENT_NAMES).toEqual(["checkout_start", "order_complete"]);
    for (const [name, properties] of [
      ["checkout_start", { order_id: ID.a }],
      ["order_complete", { order_id: ID.a, revenue_sgd: 68 }],
    ] as const) {
      const result = validateEventPayload(envelope(name, properties));
      expect(result.ok, `${name} must be rejected publicly`).toBe(false);
      if (!result.ok) expect(result.error).toContain("server-side");
    }
  });

  it("keeps the server-side property schemas for checkout events", () => {
    // The checkout service builds these payloads internally; the schemas
    // remain the contract for those server-side writes.
    expect(
      EVENT_PROPERTY_SCHEMAS.checkout_start.safeParse({ order_id: ID.a }).success,
    ).toBe(true);
    expect(
      EVENT_PROPERTY_SCHEMAS.order_complete.safeParse({
        order_id: ID.a,
        revenue_sgd: 68,
      }).success,
    ).toBe(true);
    expect(
      EVENT_PROPERTY_SCHEMAS.order_complete.safeParse({
        order_id: ID.a,
        revenue_sgd: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown event names", () => {
    const result = validateEventPayload(envelope("page_views", {}));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("event_name");
  });

  it("rejects malformed envelopes", () => {
    expect(validateEventPayload(null).ok).toBe(false);
    expect(validateEventPayload({}).ok).toBe(false);
    expect(
      validateEventPayload({ event_name: "page_view", client_event_id: "nope" }).ok,
    ).toBe(false);
    expect(validateEventPayload(envelope("product_view", { product_id: "x" })).ok).toBe(
      false,
    );
  });

  it("rejects a negative order_complete revenue", () => {
    expect(
      validateEventPayload(
        envelope("order_complete", { order_id: ID.a, revenue_sgd: -5 }),
      ).ok,
    ).toBe(false);
  });

  it("accepts style events with their shapes", () => {
    expect(
      validateEventPayload(
        envelope("style_session_start", { mode: "build_my_fit" }),
      ).ok,
    ).toBe(true);
    expect(
      validateEventPayload(
        envelope("style_result_view", { session_id: ID.a, mode: "decode_reference", outfit_count: 3 }),
      ).ok,
    ).toBe(true);
    expect(
      validateEventPayload(
        envelope("style_feedback_submit", { session_id: ID.a, label: "too_costume" }),
      ).ok,
    ).toBe(true);
    expect(
      validateEventPayload(
        envelope("style_outfit_save", { session_id: ID.a, outfit_id: ID.c }),
      ).ok,
    ).toBe(true);
  });
});
