export interface StudioSection {
  href: string;
  title: string;
  spec: string;
  phase: string;
  summary: string;
}

export const STUDIO_SECTIONS: StudioSection[] = [
  {
    href: "/studio/catalog",
    title: "Catalog Ops",
    spec: "§9.1",
    phase: "Live — Phase 4",
    summary: "Product intake form + state machine (draft → repair → listed → reserved → sold → withdrawn), defect notes, measurements, tag assignment with provenance + accept/reject.",
  },
  {
    href: "/studio/drops",
    title: "Drops",
    spec: "§9.2",
    phase: "Live — Phase 4",
    summary: "Create drops, attach products, stage → announce → live → archive lifecycle (go-live/close enforce drop_invariant + availability alignment).",
  },
  {
    href: "/studio/orders",
    title: "Orders",
    spec: "§9.3",
    phase: "Live — Phase 4",
    summary: "Review checkout-created orders, confirm payment (order_paid + confirmation email + receipt), fulfill (order_shipped), cancel with reason.",
  },
  {
    href: "/studio/insights",
    title: "Insights",
    spec: "§12",
    phase: "Live — Phase 5",
    summary: "Drop performance (view→sale conversion), sell-through + time-to-sale, demand signals, closet coverage — org-scoped SQL views.",
  },
  {
    href: "/studio/campaigns",
    title: "Campaigns",
    spec: "§9.4",
    phase: "Live — Phase 5",
    summary: "Subject-line + hero copy drafts; A/B assignment (50/50 per session), send window rules, per-variant stats, variant_delivery audit.",
  },
  {
    href: "/studio/ai-lab",
    title: "AI Lab",
    spec: "§13.5",
    phase: "Live — Phase 7",
    summary: "Prompt versions, generation provenance, evaluation harness.",
  },
];
