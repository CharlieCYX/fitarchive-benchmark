# FitArchive Benchmark — Architectural Decision Records

Format: Context → Decision → Consequences. New ADRs append; never rewrite history.

## ADR-001 — Next.js App Router as the single application frame
**Context:** The system needs SEO-friendly public storefront/portfolio pages,
dense authenticated operator screens, server-side authorization, and
Netlify-compatible deployment (§6.1).
**Decision:** Next.js App Router + React Server Components. Public/editorial pages
are server-rendered for SEO and speed; operator studio uses client interactivity
with server actions for mutations; thin API routes only where webhooks, beacons or
non-HTML responses require them (§23.2).
**Consequences:** Server/client boundary becomes a security boundary (privileged
code never ships to the browser). Netlify deploy via the official Next runtime.
Alternative considered: separate SPA + API — rejected (two deployables, duplicated
auth, worse SEO for a portfolio whose public pages ARE the product).

## ADR-002 — One Postgres schema with RLS instead of multiple services
**Context:** §6.1 mandates Supabase; the permission model (§5) spans owner/seller/
shopper/analyst/public with row-level boundaries (seller sees only own items; cost
basis never public).
**Decision:** A single normalized Postgres schema (59 tables, DATA_MODEL.md) with
RLS enabled on every private table; authorization enforced in the database, with
server-side role guards as a second layer. No microservices.
**Consequences:** RLS is testable (§16.1 database tests, §20.3 red-team) and
impossible to bypass from the client; one migration history keeps 20+ modules
coherent (§2.2 forbids collapsing into JSON blobs). Cost: policies require care and
a dedicated migration (0013) plus per-table policies in later migrations. Data
conventions fixed here: uuid PKs, `timestamptz`, SGD `numeric(12,2)` money suffixed
`_sgd`, `org_id` on org-scoped tables.

## ADR-003 — Provider-neutral AI adapter with a mock default
**Context:** §13.1: FitArchive must not be a Kimi-only product; providers are
implementation details; §17.3: the app must fully work without paid AI.
**Decision:** `lib/ai` exposes the §13.1 `AIProvider` interface
(`generateText`, `generateStructured<T>`, optional `analyzeImage`, optional
`embed`). Adapters: `MockProvider` (deterministic, default, `AI_PROVIDER=mock`),
then optional `kimi`/`openai`/`anthropic`/`local`. FitArchive owns prompts
(`ai_prompt_versions`), evaluation cases (AI Lab), and canonical data. Every call
persists an `ai_generations` row with full provenance (§13.3) and outputs stay
`draft` until human acceptance (§6.4 rule 6).
**Consequences:** Provider swap = env change; benchmark runs at zero AI cost; AI
failure modes (malformed JSON, hallucinated IDs) are contract-tested against the
mock (§16.1). AI never writes canonical product data directly.

## ADR-004 — Demo checkout as a simulated payment state machine
**Context:** §10.3: the benchmark must not become a payment-compliance project;
two modes required: Demo Checkout and External/Manual Order.
**Decision:** `payments` rows driven by an explicit state machine
(`initiated → authorized → captured`, with `failed`/`refunded`; terminal demo rows
marked `simulated`) behind a `PaymentProvider` adapter interface. `orders.mode`
is `demo` or `external_manual`. A real payment adapter (e.g. a sandbox provider +
`/api/webhooks/payment`) can be added later without schema change.
**Consequences:** Order/settlement math is fully testable end-to-end; no live
credentials; settlement ledger (§10.4) runs identically for both modes.

## ADR-005 — Rename spec table `references` → `style_references`
**Context:** §11.1 lists tables `references` and `reference_attributes`, but
`REFERENCES` is a SQL reserved word, forcing permanent double-quoting and inviting
subtle bugs.
**Decision:** Tables are named `style_references` and
`style_reference_attributes`. All other §11.1 table names are used verbatim.
**Consequences:** Every doc and migration uses the renamed pair consistently
(this is the only deliberate deviation from §11.1 naming).

## ADR-006 — Portfolio snapshots are frozen, append-only JSON payloads
**Context:** §6.4 rule 8: public case studies derive from a publishable snapshot so
later operational edits never silently rewrite old portfolio evidence; §19.1 tests
"portfolio freeze".
**Decision:** `portfolio_snapshots.frozen_payload` (jsonb) captures the fully
rendered case study (all §21.2 fields + resolved metric values + artifact
references) at freeze time. `/portfolio/[slug]` reads snapshots only, never live
tables. New version = new snapshot row (`version` increments); old public snapshots
stay byte-identical. Private fields (cost basis, seller notes, buyer contacts, raw
AI output) are stripped at freeze time, enforced by an export test (§16.1).
**Consequences:** Recruiter links are stable and historically faithful; the
"evidence graph" (§21.1) links back to live records for the operator while the
public sees an immutable view.

## ADR-007 — Source PDFs are NOT committed as binaries; distilled instead
**Context:** Spec §2.1 step 2 says to put both PDFs into `/docs/reference`.
However, the GitHub MCP tooling used to populate the empty repo
(`CharlieCYX/fitarchive-benchmark`) pushes file contents as text and cannot upload
binary PDFs. Committing corrupted/base64-mangled binaries would be worse than
omitting them.
**Decision:** The two source PDFs are not committed. Instead their content is
distilled into `docs/reference/ROADMAP_SUMMARY.md` and
`docs/reference/BUILD_BIBLE_SUMMARY.md` — structured, faithful summaries (phases,
guardrails, MUST rules, acceptance criteria, hard-fail conditions) sufficient for
future agents to work without re-reading the PDFs. The original PDFs remain in the
operator's upload area outside the repo.
**Consequences:** Repo stays text-only and reviewable; summaries become the
canonical in-repo reference (contract docs in `docs/` remain authoritative where
they are more precise). If binary upload becomes available later, the PDFs may be
added to `docs/reference/` without changing any contract.

## ADR-008 — First-party events table + SQL views as the only metric source
**Context:** §6.4 rule 4 (single semantic layer), §19.3 (hard fail if dashboards
use hard-coded values), §12.2 (canonical definitions).
**Decision:** One append-only `events` table with dictionary-validated names and
idempotent ingest (`unique(org_id, client_event_id)`); every displayed metric comes
from a SQL view registered in `metric_definitions` and accessed via `lib/metrics`.
**Consequences:** Charts can always be traced to raw rows (§20.4); dedupe stress
test is a unique-index test; adding a metric = one view + one registry row.
