import { describe, expect, it } from "vitest";

import {
  buildDemoOrderNo,
  canTransitionCheckout,
  checkoutStateFromOrderStatus,
  checkoutTransitionError,
  checkoutTransitionWrites,
} from "@/features/checkout/state-machine";

describe("demo checkout state machine (§10.3, A4)", () => {
  it("happy path: created → pending → paid", () => {
    expect(canTransitionCheckout("created", "pending")).toBe(true);
    expect(canTransitionCheckout("pending", "paid")).toBe(true);

    const open = checkoutTransitionWrites("created", "pending");
    expect(open).toMatchObject({
      orderStatus: "pending",
      paymentStatus: "initiated",
      productAvailability: "reserved",
      setPaidAt: false,
    });

    const close = checkoutTransitionWrites("pending", "paid");
    expect(close).toMatchObject({
      orderStatus: "paid",
      paymentStatus: "simulated",
      productAvailability: "sold",
      setPaidAt: true,
    });
  });

  it("failure path: pending → failed releases the item", () => {
    const writes = checkoutTransitionWrites("pending", "failed");
    expect(writes).toMatchObject({
      orderStatus: "cancelled",
      paymentStatus: "failed",
      productAvailability: "available",
      setPaidAt: false,
    });
  });

  it("paid and failed are terminal", () => {
    expect(canTransitionCheckout("paid", "failed")).toBe(false);
    expect(canTransitionCheckout("failed", "paid")).toBe(false);
    expect(canTransitionCheckout("paid", "pending")).toBe(false);
    expect(checkoutTransitionError("paid", "failed")).toContain("terminal");
    expect(checkoutTransitionError("failed", "paid")).toContain("terminal");
  });

  it("rejects skipping pending (created → paid)", () => {
    expect(canTransitionCheckout("created", "paid")).toBe(false);
    expect(checkoutTransitionError("created", "paid")).toMatch(
      /Cannot move from created to paid/,
    );
    expect(checkoutTransitionWrites("created", "paid")).toBeNull();
  });

  it("rejects no-op transitions with a clear reason", () => {
    expect(checkoutTransitionError("pending", "pending")).toContain("already pending");
  });

  it("maps persisted order statuses back onto checkout states", () => {
    expect(checkoutStateFromOrderStatus("pending")).toBe("pending");
    expect(checkoutStateFromOrderStatus("paid")).toBe("paid");
    expect(checkoutStateFromOrderStatus("cancelled")).toBe("failed");
    // fulfilled/refunded are outside the demo flow
    expect(checkoutStateFromOrderStatus("fulfilled")).toBeNull();
    expect(checkoutStateFromOrderStatus("refunded")).toBeNull();
  });

  it("demo order numbers are unmistakably demo", () => {
    const no = buildDemoOrderNo(0);
    expect(no).toMatch(/^FA-DEMO-[A-Z0-9]+-[A-Z0-9]{3}$/);
    expect(buildDemoOrderNo(0)).toContain("FA-DEMO-");
  });
});
