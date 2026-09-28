import { describe, expect, it } from "vitest";

import {
  buildEventRow,
  createMemoryEventWriter,
  ingestEvent,
} from "@/features/analytics/ingest";
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
  evt: "44444444-4444-4444-8444-444444444444",
};

function envelope(event_name: string, properties: Record<string, unknown>) {
  return {
    event_name,
    client_event_id: ID.evt,
    route: "/drops/drop-001",
    referrer: null,
    properties,
  };
}

describe("event dictionary validation (EVENTS_AND_METRICS.md §1)", () => {
  it("covers exactly the 19 dictionary names", () => {
    expect(EVENT_NAMES).toHaveLength(19);
    expect(EVENT_NAMES).toContain("page_view");
    expect(EVENT_NAMES).toContain("external_buy_click");
    expect(EVENT_NAMES).toContain("portfolio_view");
  });

  it("accepts a full page_view with attribution props", () => {
    const result = validateEventPayload(
      envelope("page_view", {
        campaign: "drop001_launch",
        utm_source: "ig",
        utm_medium: "bio",
        utm_campaign: "drop001_launch",
        utm_content: null,
      }),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts every storefront event with valid properties", () => {
    const valid: Array<[string, Record<string, unknown>]> = [
      ["drop_view", { drop_id: ID.a }],
      ["product_impression", { product_id: ID.a, drop_id: ID.b, position: 0 }],
      ["product_impression", { product_id: ID.a, drop_id: null, position: 3 }],
      [
        "product_view",
        { product_id: ID.a, drop_id: ID.b, source: "drop_grid" },
      ],
      ["product_view", { product_id: ID.a, drop_id: null, source: "direct" }],
      ["product_save", { product_id: ID.a, collection_id: null }],
      ["product_unsave", { product_id: ID.a }],
      ["inquiry_start", { product_id: ID.a, method: "form" }],
      ["inquiry_start", { product_id: ID.a, method: "external_platform" }],
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
    const result = validateEventPayload(envelope("page_veiw", {}));
    expect(result.ok).toBe(false);
  });

  it("rejects a missing/invalid client_event_id", () => {
    expect(
      validateEventPayload({ event_name: "drop_view", properties: { drop_id: ID.a } }).ok,
    ).toBe(false);
    expect(
      validateEventPayload({
        ...envelope("drop_view", { drop_id: ID.a }),
        client_event_id: "not-a-uuid",
      }).ok,
    ).toBe(false);
  });

  it("rejects missing required properties with a named error", () => {
    const result = validateEventPayload(
      envelope("product_view", { product_id: ID.a, drop_id: null }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("source");
  });

  it("enforces the share_click product XOR drop rule", () => {
    expect(
      validateEventPayload(envelope("share_click", { product_id: ID.a, channel: "copy_link" })).ok,
    ).toBe(true);
    expect(
      validateEventPayload(envelope("share_click", { drop_id: ID.b, channel: "whatsapp" })).ok,
    ).toBe(true);
    expect(
      validateEventPayload(envelope("share_click", { channel: "copy_link" })).ok,
    ).toBe(false);
    expect(
      validateEventPayload(
        envelope("share_click", { product_id: ID.a, drop_id: ID.b, channel: "copy_link" }),
      ).ok,
    ).toBe(false);
  });

  it("rejects a negative order_complete revenue", () => {
    expect(
      validateEventPayload(
        envelope("order_complete", { order_id: ID.a, revenue_sgd: -1 }),
      ).ok,
    ).toBe(false);
  });
});

describe("ingest dedupe contract (§12.1, §19.1)", () => {
  const ctx = { orgId: ID.c, sessionId: ID.b, profileId: null };

  function validEvent(clientEventId: string) {
    const result = validateEventPayload({
      ...envelope("drop_view", { drop_id: ID.a }),
      client_event_id: clientEventId,
    });
    if (!result.ok) throw new Error("fixture invalid");
    return result.event;
  }

  it("replaying the same client_event_id is a no-op, never double-counted", async () => {
    const writer = createMemoryEventWriter();
    const event = validEvent(ID.evt);

    const first = await ingestEvent(writer, event, ctx);
    const second = await ingestEvent(writer, event, ctx);
    const third = await ingestEvent(writer, event, ctx);

    expect(first).toMatchObject({ ok: true, status: "inserted" });
    expect(second).toMatchObject({ ok: true, status: "deduped", id: null });
    expect(third).toMatchObject({ ok: true, status: "deduped", id: null });
    expect(writer.rows.size).toBe(1);
  });

  it("different client_event_ids insert separately", async () => {
    const writer = createMemoryEventWriter();
    await ingestEvent(writer, validEvent(ID.evt), ctx);
    await ingestEvent(
      writer,
      validEvent("55555555-5555-4555-8555-555555555555"),
      ctx,
    );
    expect(writer.rows.size).toBe(2);
  });

  it("dedupe is scoped per org (unique(org_id, client_event_id))", async () => {
    const writer = createMemoryEventWriter();
    await ingestEvent(writer, validEvent(ID.evt), ctx);
    const otherOrg = await ingestEvent(writer, validEvent(ID.evt), {
      ...ctx,
      orgId: ID.a,
    });
    expect(otherOrg.ok && otherOrg.status).toBe("inserted");
    expect(writer.rows.size).toBe(2);
  });

  it("identity comes from server context, never the client payload", async () => {
    const result = validateEventPayload({
      ...envelope("drop_view", { drop_id: ID.a }),
      session_id: ID.a, // client-sent hint — must NOT be used
      properties: { drop_id: ID.a, profile_id: ID.a }, // injected identity — dropped by schema
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = buildEventRow(result.event, { ...ctx, profileId: ID.b });
    expect(row.session_id).toBe(ID.b); // server-resolved session
    expect(row.profile_id).toBe(ID.b); // server-side auth profile
    expect(row.properties).not.toHaveProperty("profile_id");
  });
});
