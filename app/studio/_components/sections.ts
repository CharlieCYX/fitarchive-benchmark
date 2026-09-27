/**
 * Studio section registry (route map §23.1). `phase` labels are honest:
 * sections render a "Planned in Phase X" state until their phase ships.
 */
export interface StudioSection {
  href: string;
  title: string;
  spec: string; // Build Bible section
  phase: string;
  summary: string;
}

export const STUDIO_SECTIONS: StudioSection[] = [
  {
    href: "/studio/research",
    title: "Research Inbox",
    spec: "§7.2",
    phase: "Live — Phase 3",
    summary: "Manual marketplace capture, duplicate detection, drop-candidate flags.",
  },
  {
    href: "/studio/catalog",
    title: "Catalog",
    spec: "§7.3",
    phase: "Live — Phase 3",
    summary: "Product master: condition, measurements, ownership, availability.",
  },
  {
    href: "/studio/sellers",
    title: "Sellers",
    spec: "§7.4",
    phase: "Live — Phase 3",
    summary: "Seller CRM, permission ledger, agreements, settlements.",
  },
  {
    href: "/studio/drops",
    title: "Drops",
    spec: "§7.5",
    phase: "Live — Phase 3",
    summary: "Drop builder: tiers, price ladder, readiness gate, hypotheses.",
  },
  {
    href: "/studio/campaigns",
    title: "Campaigns",
    spec: "§7.6",
    phase: "Live — Phase 3",
    summary: "Briefs, channel plan, tracked links, AI copy as suggestion.",
  },
  {
    href: "/studio/launch",
    title: "Launch Control",
    spec: "§7.7",
    phase: "Phase 3",
    summary: "Publish gate, live traffic, incidents, rollback.",
  },
  {
    href: "/studio/analytics",
    title: "Analytics",
    spec: "§9.1",
    phase: "Phase 5",
    summary: "Canonical metrics from first-party events — no hard-coded numbers.",
  },
  {
    href: "/studio/insights",
    title: "Insights",
    spec: "§9.2",
    phase: "Phase 5",
    summary: "Observation → hypothesis → experiment → validated result.",
  },
  {
    href: "/studio/ai-lab",
    title: "AI Lab",
    spec: "§13.5",
    phase: "Phase 7",
    summary: "Prompt versions, generation provenance, evaluation harness.",
  },
  {
    href: "/studio/garments",
    title: "Garment Lab",
    spec: "§9.4",
    phase: "Phase 8",
    summary: "Problem → evidence → ideation → prototype → wear test.",
  },
  {
    href: "/studio/product-lab",
    title: "Product Lab",
    spec: "§9.5",
    phase: "Phase 8",
    summary: "Problem briefs, PRDs, prototype tests, postmortems.",
  },
  {
    href: "/studio/portfolio",
    title: "Portfolio",
    spec: "§21",
    phase: "Phase 9",
    summary: "Role-lensed case studies from frozen snapshots.",
  },
];
