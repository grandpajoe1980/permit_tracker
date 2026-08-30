# PATH Execution Plan

## Objective

Deliver the persisted customer-to-government project workflow described in
`docs/Plan.md`, preserving the existing PATH operational UX while replacing
false-success and fixture behavior with verified Supabase-backed behavior.

## Current state after Wave 0 rebaseline

- Next.js App Router/Vinext, React, TypeScript, Supabase Auth/Postgres/Storage.
- The main UI is still concentrated in `app/page.tsx` and uses internal route
  state; only `/api/health` and `/api/requests` are physical routes.
- Existing typed domain models, operational projections, document UI, Gantt UI,
  workflow engine helpers, migrations, and fixture tests are useful foundations.
- The production trust boundary is not yet acceptable: the server client can
  use a service key, API request handlers do not authenticate/validate actors,
  several queries ignore `projectId`, and later migrations installed broad
  write/read policies.
- Repository mutations frequently update memory and return before Supabase
  succeeds. Empty Supabase results are often replaced with fixture data.

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
