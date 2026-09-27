# Reference: FitArchive — The Kimi Limit Test (Build Bible) — Summary

Faithful distillation of `FitArchive_Kimi_Ultimate_Build_Challenge_2026.pdf`
(27 Sep 2026) — the governing spec. The PDF itself is intentionally not committed
(ADR-007). Where this summary and the Phase 0 contract docs (`docs/ARCHITECTURE.md`,
`DATA_MODEL.md`, `EVENTS_AND_METRICS.md`) differ in precision, the contract docs win.

## Purpose & philosophy
- A deliberately over-scoped benchmark built from the Master Roadmap: tests whether
  the agent can architect, code, debug, design, document and deploy ONE coherent
  fashion-tech system without collapsing into disconnected demos.
- Production principle unchanged: research → curate → launch → measure; add
  technology only when evidence creates a reason. Benchmark asks for the full
  operating system around that loop.
- Repo is a **benchmark sandbox** (`fitarchive-benchmark`), separate from any real
  production project (§2.1, §23.8 production-migration filter).
- Unfinished modules are acceptable **if labeled honestly**; faking is not.

## What the benchmark adds to the roadmap (§1.2)
Operating model (owned/consigned/referral/borrowed/represented + settlement),
canonical relational data model, taxonomy governance (versioned controlled
vocabulary), event instrumentation (exact names/properties/attribution/dedupe),
metric semantics (definitions that don't drift between dashboards), experiment
design (hypotheses, controls, interpretation limits), AI governance (provenance,
approval, disclosure, rollback), role boundaries, security/reliability, integration
honesty (manual import/UTM/adapters — no magical APIs), portfolio extraction, cost
discipline.

## Preserved earlier concepts (§1.3)
Editorial Style Engine ("a style engine disguised as a fashion editorial"): 3–5
references → extract mood/silhouette/palette/material/era/energy → coherence check →
wearable translation (not costume). Legacy flow: **Arrival → Archive → Story Hole →
Storyboard → Story Set → Casting**. Features: Build My Fit, Can This Work?, Decode
This Reference, climate-aware (Singapore) translation, Archive as structured taste
data.

## How to run the benchmark (§2)
Kimi Code = main engineering env; read both PDFs first; write
IMPLEMENTATION_PLAN/ASSUMPTIONS/DECISIONS before code; phased autonomous build with
lint/typecheck/unit/E2E at every checkpoint; sub-agents may split
architecture/frontend/backend/QA but must not invent incompatible architectures;
credentials never in repo/prompts; every "complete" claim needs a demo path + test.

### What the builder must NOT do (§2.2 — MUST-NOT rules)
- No invented live integrations (Carousell/Instagram/TikTok/SSQRD) without real
  API/credentials.
- No static mockups described as production-ready.
- No calling tiny/synthetic data a "prediction model".
- No automatic scraping without a deliberate permission decision.
- No service-role/privileged keys in the browser.
- No placeholder buttons/dead nav/fake charts/TODOs for MUST features.
- No deceptive product imagery misrepresenting condition/fit/construction.
- No collapsing the schema into one generic JSON blob.

### One-month testing strategy (§2.3)
W1 architecture+core (repo, auth, schema, admin, catalog, drops, storefront, seed,
design system, deploy preview) · W2 data+analytics (events, dashboards, experiments,
attribution, exports, data quality, SQL views) · W3 AI+creative (Style Engine, NL
discovery, AI copy, recommendation prototype, garment lab) · W4 hardening+proof
(security, E2E, a11y, performance, portfolio mode, docs, deploy, scorecard).

## Product thesis & boundaries (§4)
**Thesis:** FitArchive turns overlooked fashion into structured market intelligence,
curated stories, measurable commerce, better product decisions and eventually new
fashion-tech experiences — preserving the evidence trail behind each decision.
**Six loops:** commerce (source→qualify→permission→curate→campaign→launch→measure→
settle→learn) · intelligence (observe→normalize→tag→compare→patterns→hypothesis→
test) · style (references→decode→resolve→story→match→feedback) · product
(problem→research→PRD→prototype→test→one feature→measure) · garment
(problem→evidence→ideate→flat→CLO→prototype→wear test→reflect) · portfolio
(artifact→evidence→contribution→result→role-specific case study).
**Non-goals:** no marketplace network effects before demand; no claiming to be a
pro designer/data scientist/ML engineer/stylist; no stealing seller content; no
"trend prediction" from tiny samples; not a generic AI wrapper; not an SSQRD
replacement; never a reason to delay Drop #001.
**Brand:** editorial, sparse, product-led; monochrome photography, assertive type,
one controlled violet accent, whitespace; data-viz like a fashion publication.
Legacy line "Let the world be your runway" — campaign-level only.

## Users & permissions (§5)
Roles: **Owner/operator** (full) · **Seller/consignor/collaborator** (own items,
agreements, settlements) · **Shopper/community** (public catalog + own data) ·
**Stylist/creative collaborator** (assigned projects/assets) · **Analyst/mentor**
(read-only scoped views) · **Recruiter/portfolio viewer** (public portfolio only) ·
**System/service** (server-only, never in browser).
Garment permission states (§5.2): `observed_only` → `contacted` →
`permission_referral` | `permission_consignment` | `owned` | `borrowed_for_content`
| `prototype_permission` → `expired_revoked` (unpublish + retain minimal records).

## Architecture (§6)
Stack: TypeScript, Next.js/React, Tailwind + accessible primitives, Supabase
(Postgres/Auth/Storage, RLS), Netlify, first-party events + SQL views, AI provider
adapter, Vitest/Jest + Playwright, GitHub Actions. Repo shape and architectural
rules are reproduced exactly in `docs/ARCHITECTURE.md` (§4, §8) — including: domain
logic out of components; privileged writes server-side; RLS everywhere; one semantic
metric layer; typed adapters with simulators; AI never writes canonical data
directly; upload metadata (ownership/checksum/type/privacy/provenance); frozen
portfolio snapshots.

## Modules (§7–§10) — must-haves & acceptance (digested)
- **§7.1 Command Center:** drop status/countdown/sell-through, permissions awaiting
  action, missing data/imagery, assets awaiting approval, running experiments,
  latest insights, failed jobs, quick-add. AC: deep-links; counts from DB; helpful
  empty state.
- **§7.2 Research Inbox:** quick-capture URL (<1 min), platform/seller, structured
  fields, screenshot upload, style tags, drop-candidate flag, confidence, duplicate
  detection by normalized URL. AC: source URL + capture time preserved; listing need
  not be public inventory.
- **§7.3 Catalog:** identity/variants, condition+defects, measurements, ownership
  state, cost basis + seller economics, media provenance, public vs private notes,
  availability/reservation, linked source listings. AC: product↔many observations;
  no private leakage; auditable status transitions.
- **§7.4 Seller CRM + Permission Ledger:** profile, channels, permission requests,
  agreement type/terms, fulfillment responsibility, payout reference (no banking
  secrets), expiry/revocation, message log, settlement history. AC: publishing
  non-owned item requires valid permission; revocation unpublishes; seller portal
  sees only own records.
- **§7.5 Drop Builder:** reorder assortment, entry/core/hero tiers, concept/story,
  price ladder, heroes, breakdown, readiness checklist, permission/stock gating,
  hypothesis, clone Drop #001→#002. AC: can't publish with blocked permissions;
  live assortment summary; Drop #002 references prior insights.
- **§7.6 Campaign Studio:** moodboard, brief, calendar, channel plan, asset
  versions, copy variants, UTM links, AI copy suggestions, synthetic-imagery
  disclosure, approval workflow. AC: provenance on every published asset; every
  tracked link maps campaign+channel+creative; AI output is suggestion until
  approved.
- **§7.7 Launch Control:** checklist, publish/unpublish, stock/reservations, live
  traffic, link health, incident log, offline annotations, rollback. AC: every
  public product/link verifiable; launch pausable; incidents overlay analytics.
- **§8.1 Storefront:** editorial drop landing with provenance/disclosure; PDP with
  photos/measurements/condition/ownership wording/price/availability/related;
  filter/sort; saves/share/inquiry/purchase; alt text; mobile-first.
- **§8.2 Shopper Archive:** saved products/collections, optional closet items,
  reference images with decoded attributes, outfit boards; private by default.
- **§8.3 Build My Fit:** 3–5 references + occasion/climate/budget/fit prefs/owned
  items → shared signals + contradictions → human-language style thesis →
  recommendation using owned/available first, with explanation+confidence → feedback
  labels (nailed it / too costume / too hot / wrong silhouette / wrong budget /
  other).
- **§8.4 Can This Work?:** color/silhouette/proportion/material/formality/era/energy
  comparison → compatible / tension-but-usable / contradictory with explanation +
  repair moves; save decision to Archive.
- **§8.5 Decode This Reference:** silhouette/proportion, palette/contrast,
  materials/substitutes, era/aesthetic labels WITH confidence+uncertainty,
  distinctive vs incidental, Singapore-climate translation, catalog/closet matches.
- **§8.6 Secondhand Alternative Finder:** catalog + approved sources; similarity
  rationale; label result origin (internal / referral / manual external /
  SSQRD-discovered); no unsupported "ethical" rankings.
- **§8.8 Style Engine evaluation harness:** authored test cases + expected
  constraints; operator review screen; failure modes: constraint_miss,
  hallucinated_inventory, cosplay_overfit, contradiction_blindness,
  unsupported_certainty, preference_miss.
- **§9.1 Intelligence Dashboard:** market obs + internal performance +
  external-vs-internal comparison; decision cards (decision/owner/date/confidence/
  affected drop); data coverage/quality; dashboard version snapshots.
- **§9.2 Tracker not predictor:** descriptive views first; forecast disabled until
  sample threshold + methodology; evidence states observation → hypothesis →
  experiment → validated result → forecast (language constrained per state).
- **§9.3 NL fashion search:** hard constraints parsed separately from soft intent;
  internal catalog + approved manual index only; reason-for-match tokens;
  exact-vs-approximate flags; deterministic filter fallback.
- **§9.4 Garment Innovation Lab:** real problem → before-state evidence → AI
  ideation rounds (prompt/refs/asset/criteria/comments) → Illustrator flats → CLO
  renders/fit maps with intent captions → before/after comparison → physical
  prototype record (tester, consent, feedback, discrepancies vs simulation) → case
  study separating simulated vs physical evidence.
- **§9.5 Product Lab / PRD Studio:** problem brief + workaround, competitor matrix,
  stories/FRs/NFRs, MVP boundary + deferred features, success metrics before coding,
  prototype links + test observations, one real feature record, postmortem.

## Commerce (§10)
Operating models: owned / consignment / referral / content-collaboration. Drop
readiness gate: 16 checks (concept, personas, size, tiers, permissions, media
rights, measurements/condition, pricing/economics, descriptions, assets, tracked
links, instrumentation, fulfillment, returns wording, dashboard receiving test
events, rollback verified). Order model: Demo Checkout (sandbox or simulated state
machine) + External/Manual; real adapter later; no live credentials needed.
Settlement math (canonical): see DATA_MODEL.md §6 — never display undefined
"profit". Product truth: structured condition (new/unworn, excellent, good, fair,
project/repair) + photo-linked defects; AI may clarify notes but not change grade
without approval; measurements keep unit+method; synthetic imagery disclosed and
never hides defects.

## Data & taxonomy (§11)
59 tables — full schema in `docs/DATA_MODEL.md`. Taxonomy dimensions + seed values
reproduced there (§3). Tag rules: every assignment stores source (human / seller /
AI / imported / rule) + confidence; AI tags not canonical until accepted for
consequential fields; conflicts allowed in research, resolved before public
presentation; versioned taxonomy with aliases so history never breaks.

## Events, metrics, experiments (§12)
Full event dictionary (19 events), 11 canonical metrics with guardrails, 7 dashboard
views, experiment object — all reproduced exactly in `docs/EVENTS_AND_METRICS.md`.
Example Drop #002 experiments: price ladder, photography style, collection framing,
hero concentration, external discovery route.

## AI subsystem (§13)
Provider-neutral `AIProvider` interface (generateText / generateStructured /
analyzeImage? / embed?). Feature priorities: HIGH = description/copy assistant,
reference decoder/tag suggestions, Style Engine explanation, research summary;
MEDIUM = NL search parser, campaign concepts, garment ideation, portfolio drafts;
CONDITIONAL = image similarity, forecasting (disabled until defensible). Every
generation records: feature, provider, model, prompt_version, system_prompt_hash,
input refs, output, raw_response_private, creator, timestamp, status
(draft/accepted/rejected/superseded), editor notes, disclosure required+text,
safety/truth flags. Human-in-the-loop: AI suggests, humans approve public copy and
consequential attributes; synthetic assets disclosed; analytics summaries cite the
metric layer; outfit AI cannot invent availability; AI-drafted Korean copy flagged
machine-assisted. AI Lab eval dimensions: grounding, constraint adherence,
truthfulness, utility, style quality, reproducibility.

## Design system (§14)
Editorial/restrained/premium; near-black/white/warm-gray + violet `#5B3FD3`; 4–64
spacing rhythm; 6–10px radii; hairline borders; semantic color only; reduced motion;
page families (editorial public / dense operator studio / creative studio / seller
portal / recruiter mode). Accessibility acceptance: keyboard operable, focus states,
semantic headings, labels/validation, alt-text workflow, WCAG AA contrast, reduced
motion, chart text alternatives.

## Security, privacy, reliability (§15)
Supabase Auth (magic link or password); RLS on every private table; server-side role
checks; secrets server-only; upload allowlist + unique paths + private buckets;
schema validation; rate limits on auth/search/AI; audit log for critical actions;
documented backups + seed/reset; friendly errors + correlation ids; lockfile +
dependency audit in CI. Privacy: no unnecessary banking data; closet/references/
collections private by default; pseudonymous sessions; portfolio snapshots strip
private data; delete/export workflow; explicit consent for wear testers. Integrity:
keep source URL/capture date/permission state; no republishing seller media without
documented rights; dead listings marked inactive but research preserved; public
products disclose owned/consigned/referral.

## Testing (§16)
Required layers: unit (metric formulas, search parsing, status transitions,
settlement math, tag normalization, AI validation) · DB/RLS (cross-role probes) ·
integration (listing→product→drop→publish→event→analytics) · E2E (login, create
drop, browse, save, style session, portfolio snapshot) · visual smoke ·
migration-from-zero · AI contract (valid+invalid) · export privacy. Golden E2E
scenario: operator capture → seller+consignment → promote → drop tier → campaign +
tracked link → publish → anonymous events → save/inquiry/checkout → analytics shows
real path → insight → Drop #002 hypothesis → portfolio snapshot → RLS probes. Manual
QA checklist: no dead nav, handled loading, no console errors, 390px responsive,
form recovery, keyboard tables, helpful empty states, page metadata, shareable URLs,
charts match raw events, deterministic seed reset, permission revocation, AI failure
safety, no private fields in public responses.

## Deployment & ops (§17)
Environments: local / preview (per-branch, demo seed) / benchmark production
(synthetic data) / real-later (separate project; migrate only reviewed modules via
§23.8 filter). Required tooling: health endpoint + build metadata; correlated error
logging; jobs table (status/retry/last error); migration history; seed/reset
command; portfolio-safe export script; feature flags (AI, checkout, public accounts,
garment lab, experimental); AI cost usage table. Cost philosophy: fully functional
without paid AI; dashboards always work from first-party data.

## Phase plan (§18.1) — expanded in docs/IMPLEMENTATION_PLAN.md
0 Understand → 1 Foundation → 2 Research+Catalog → 3 Drop+Campaign → 4
Storefront+Events → 5 Analytics → 6 Archive+Style Engine → 7 AI Lab → 8
Garment+Product Lab → 9 Portfolio Mode → 10 Hardening → 11 Stretch. Sub-agent rule:
one agent owns architecture/schema; others propose but never independently rewrite
contracts. Progress report format §18.3 (phase / completed / files+migrations /
tests / demo path / assumptions / limitations / next).

## Stress tests (§19.1)
Dataset scale (1,000 listings, 300 products, 20 sellers, 6 drops, 20k events —
usable) · permission reversal (safe unpublish + audit) · AI provider outage (core
still works) · malformed AI response (safe reject + log) · event replay (dedupe) ·
private-data probe (denied) · mobile operator flow · portfolio freeze consistency ·
one-command seed reset · large asset sets.

## Scorecard (§19.2, 0–5 each)
Requirement comprehension · architecture coherence · data modeling · long-horizon
execution · frontend quality · backend correctness · analytics integrity · AI honesty
· testing discipline · debugging ability · autonomy · documentation · security ·
deployment · self-review.

## HARD-FAIL conditions (§19.3)
1. Claims completion but core buttons/routes static or broken.
2. Service-role key or privileged credentials in client bundle.
3. Public user can read private seller/customer/closet data.
4. Dashboard hard-codes metrics after real event system exists.
5. Fabricated external marketplace integration.
6. AI-generated product facts published without verification/provenance.
7. Fresh clone cannot install/build (docs or migrations incomplete).
8. Critical data orphaned/deleted without FK behavior or audit.

## Portfolio mode (§21)
Same evidence graph reframed per role: merchandising/MD, buying, e-commerce/growth,
analytics/strategy, fashion-tech/product, garment development, K-pop merch/IP,
creative production. Case studies link real records (research→product/drop→campaign→
event/metric→insight→decision→next action) — never detached narrative. Snapshot
fields: title, one-line problem, role lens, exact contribution, context/constraints,
evidence/data, decision, execution artifacts, result metrics with period/sample,
what changed next, limitations, public links/images, EN + optional KO draft.

## SSQRD layer (§22)
SSQRD = discovery/distribution reference, not replacement. Adapter = manual
external-discovery source, tracked outbound links, CSV import/export (no scraping),
campaign attribution by discovery source, "SSQRD candidate" flag, competitor notes.
Differentiation: curated circular secondhand drops + structured experimentation +
style/garment lab vs SSQRD's global independent-brand discovery.

## Appendices (§23)
Route map + API map → reproduced in `docs/ARCHITECTURE.md` §5–6. Research CSV schema
(§23.3): source_platform, source_url, captured_at, seller_handle, title, brand,
category, aesthetic, color, material, asking_price_sgd, condition,
visible_engagement, listing_age_days, permission_state, drop_candidate, notes.
Demo seed (§23.4): 20–30 listings, 12–15 approved products, 3–4 sellers, Drop #001
+ upcoming #002, 2 campaigns, tracked links, 300–500 events, 1 garment case, 1 style
user with closet, 2 portfolio snapshots; narrative = Drop #001 shows cropped/boxy
outerwear + mid-price strength → Drop #002 uses that evidence; all synthetic.
Seed products FA-001…FA-010 (§23.5) → reproduced in seed plan (IMPLEMENTATION_PLAN
Phase 1/seed). Definition of done (§23.7): fresh clone boots; migrations+seed from
zero; owner/shopper/seller roles + RLS; research capture; catalog+assets; permission
gates; drop publish; storefront; first-party events; analytics from events;
insights→next drop; archive+collection; all 3 style modes (AI or deterministic); AI
adapter + provenance; garment case; portfolio snapshot; CSV import/export; no dead
MUST buttons; RLS/security tests; typecheck/lint/unit/E2E pass; mobile smoke; honest
KNOWN_LIMITATIONS; deployment available.

**Final instruction (§23.10):** Build the system, but preserve the original logic —
real sourcing, curation, launches, customer behavior, reflection. Technology makes
the loop more legible and powerful; it must not replace the loop with a demo.
