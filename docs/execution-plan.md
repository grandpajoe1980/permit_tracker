# PATH Execution Plan

## Objective

Deliver the persisted customer-to-government project workflow described in
`docs/Plan.md`, preserving the existing PATH operational UX while replacing
false-success and fixture behavior with verified Supabase-backed behavior.

## Current state after Wave 0 rebaseline

## UX recovery and appended-plan status — 2026-09-02

- UX-00 through UX-13 source contracts and protected regression coverage are
  complete on local `main` checkpoints. The final Node suite passes 368 tests,
  the production build/typecheck/lint pass, and the Supabase RLS probe passes.
- Appended Tasks 1–5 are complete locally: direct project/workstream focus,
  server-gated Admin configuration, actionable resource catalog links,
  deterministic SpaceX demo data, and shell cleanup are implemented and
  covered by focused tests.
- The authorized supplemental Supabase demo seed completed successfully and
  is stable-ID/upsert based. Direct authenticated reads confirm the seeded
  Sarah/Jordan access and request visibility.
- Playwright is installed and runnable. The two protected suites still report
  browser-only failures: post-mutation request/RFI rows do not appear in the
  app-rendered list despite direct authenticated reads succeeding, and the
  document suite cannot locate the selected document/upload target. Exact
  evidence and attempted fixes are recorded in `docs/progress.md`.

- Next.js App Router/Vinext, React, TypeScript, Supabase Auth/Postgres/Storage.
- The main UI is still concentrated in `app/page.tsx` and uses internal route
  state; only `/api/health` and `/api/requests` are physical routes.
- Existing typed domain models, operational projections, document UI, Gantt UI,
  workflow engine helpers, migrations, and fixture tests are useful foundations.
- The main production trust-boundary defects are addressed in source and
  forward migrations: browser code uses publishable credentials, the requests
  API authenticates and validates input, repository reads carry project scope,
  the requests API resolves both canonical UUIDs and human-facing project
  numbers,
  later broad policies are superseded by explicit policies, and production
  mutation paths await canonical Supabase results. Live migration application
  and full clean-context RLS verification remain outstanding.
- Multi-workstream intake triage is now one server transaction: the UI submits
  the complete fan-out to `rpc_triage_customer_request`, which locks the
  request and commits workstream creation, request state, and audit together.
  Its checked-in migration still requires live-ledger reconciliation before
  deployment verification.
- Legacy workflow definitions are imported into immutable version/stage rows,
  and stage completion now reads the pinned version with server-enforced
  checklist, document, statutory, audit, task, and handoff notification gates.
- Fixture data is isolated behind explicit demo/test mode. Empty authorized
  production query results remain empty; the remaining in-memory repository
  methods are compatibility helpers for fixture/test execution only.
- Canonical project identifiers are UUID primary keys plus human-facing
  numbers. A forward compatibility migration normalizes historical
  `proj-spacex-pecan` request references and maps that fixture alias before
  production mutations.

## Dependency-aware waves

1. **Wave 1 — authoritative persistence and trust boundary**: request-bound
   clients, explicit data mode, project-scoped queries, awaited mutations,
   canonical request intake, secure RLS/storage migration, and failure tests.
2. **Wave 2 — workflow execution**: persisted pinned versions, stage runs,
   validated transitions, checklists/documents/dependencies/statutory gates,
   handoff, audit, and notifications.
3. **Wave 3 — workflow designer**: draft/edit/validate/preview/publish with
   immutable versions and admin-scoped authorization.
4. **Wave 4 — customer intake to workstreams**: persisted request receipt,
   uploads, triage, project/workstream creation, assignment, and notifications.
5. **Wave 5 — government workbench**: physical project/workstream surfaces and
   persisted notes, RFI, blockers, coordination, transfer, escalation, review,
   and completion actions.
6. **Wave 6 — document lifecycle**: private versioned storage, signed download,
   immutable metadata, review assignments, hashes, and authorization.
7. **Wave 7 — schedule/Gantt**: persisted tasks/dependencies, dynamic dates,
   baseline/actual/forecast, critical path, waits, and recalculation.
8. **Wave 8 — route extraction**: incrementally replace internal route state
   with physical App Router pages and shared layouts/components.
9. **Wave 9 — adversarial review**: security, RLS, failure, UX, and clean
   multi-context Playwright verification of the required journey.

## Checkpoint gates

At each wave: inspect the diff, run `npm run build`, `npm run lint`, the
relevant Node tests, and targeted Playwright tests where available; update
`docs/progress.md`; commit with a `checkpoint:` or focused feature message.

## MVP acceptance

The MVP is not complete until the SpaceX request → triage → three workstreams →
government task → RFI/document response → accepted response → validated stage
handoff → customer project/Gantt journey succeeds across fresh authorized
contexts, and unauthorized access/mutation is rejected by the backend.
