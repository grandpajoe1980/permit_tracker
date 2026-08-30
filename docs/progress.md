# PATH Progress

## Current status

Wave 0 (truth/baseline) is complete. The repository is runnable with the
installed Windows toolchain, but the MVP is not complete. The claims in older
documentation that persistence and cross-browser verification were complete
were not reproducible from the current source and have been replaced with the
findings below.

## Completed in this checkpoint

- Read the repository protocol, PRD, plan, execution docs, operational UX,
  testing docs, source tree, migrations, recent commits, and package scripts.
- Added `docs/architecture.md` with the intended canonical architecture and
  explicit legacy boundaries.
- Rebased `docs/execution-plan.md` and this file on observed source behavior.
- Made build/lint/Drizzle package scripts invoke local binaries directly so
  the required gates run on Windows without GNU bash.

## Baseline verification

| Command | Result | Environment/evidence |
|---|---|---|
| `npx vinext build` | PASS | Vinext/Vite build completed; route output included `/`, `/api/health`, `/api/requests`. |
| `npx eslint . --ignore-pattern dist --ignore-pattern .next` | PASS with warnings | 0 errors; warning count remains high and is tracked as cleanup work. |
| `node --test tests/*.test.mjs` | PASS | 169 passed, 0 failed, 0 skipped; repeated Vite WebSocket port-in-use warnings. Primarily fixture/unit coverage. |
| `node scripts/supabase-probe.mjs` | PASS | Configured project responded; 37 REST paths, Storage read/write/cleanup probes passed. This does not prove RLS isolation. |
| `npm run build` / `npm run lint` before this checkpoint | BLOCKED | Both stopped because `bash` was unavailable on Windows. |

## Wave 3/4/7 checkpoint in progress

- Added explicit `APP_DATA_MODE` handling. Production does not seed empty
  database reads from fixtures; demo/test mode retains deterministic fixtures.
- Added request-bound SSR Supabase client and removed the browser's service-role
  fallback. The service-role helper is now explicit and diagnostic-only.
- Scoped repository reads by project and changed customer intake to the
  canonical `customer_requests` table.
- Added awaited persisted action paths for requests, RFIs, blockers, workflow
  advancement, document decisions, escalations, transfers, and notes. Failed
  writes now surface errors before visible success state is shown.
- Added forward-only RLS/Storage hardening migrations, authenticated actor
  triggers, project-bound RPC checks, notification recipient resolution, and
  anonymous RPC revocation. These migrations are not yet applied to the live
  project in this environment.
- Added pinned workflow-version fields, immutable transition/checklist tables,
  stage-run history, and an RPC-backed stage-completion gate that checks actor
  access, blockers, unresolved RFIs, checklist presence, minimum processing
  time, and records the handoff/audit in one transaction.
- Added version-scoped workflow designer transactions for draft creation, stage
  edits, validation, publication, and retirement of the prior active version.
  Published definitions remain immutable and the designer reports database
  confirmation before showing a saved/published state.
- Added the customer-request triage transaction that creates a linked
  workstream, pins its first stage/workflow version, updates the intake queue,
  and records the triage audit. The administration queue now exposes the
  server-backed triage operation.
- Replaced the schedule's fixed calendar window and fixed current date with
  project/workstream baseline and forecast dates plus the runtime current date.
- Removed the former commented document-content download fallback and routed
  blocker clearing and inter-agency coordination creation through awaited
  persistence paths. New forward migration
  `20260830213000_workstream_coordination_transactions.sql` owns those
  transactions.
- Added physical, request-bound App Router pages for project summaries,
  workstream detail, customer request receipts, and administrator workflow
  versions. Each route authenticates with the RLS-bound server client and
  returns a non-disclosing access/not-found response when the record is not
  visible.
- Converted administrator profile and participant edits to awaited persisted
  repository operations, guarded the last RFI direct-write fallbacks from
  production mode, and extended the forward RLS migration to remove the
  original generated `Public full access policy` plus broad legacy Storage
  policies.
- Added server-owned blocker, escalation, and transfer transactions, with
  production mutations refusing to fall back to browser-side multi-request
  writes when those RPCs are unavailable. Added source-contract checks for
  route authentication, production mode behavior, and action RPC coverage.
- Extended customer triage to create one or multiple linked workstreams from
  a request in a single administrator flow. Heavy-haul/coastal/wetlands
  intake creates the DOTD, CPRA, and USACE workstreams with distinct owners;
  the database retains all created workstream IDs on the request.

## Known blockers and risks

- A live Supabase project is configured, but the repository does not yet have
  a reproducible clean-context RLS negative-test harness for every persona.
- Existing historical migrations contain permissive policies; a forward
  hardening migration must supersede them without rewriting migration history.
- The large internal router must be extracted incrementally to avoid regressing
  the existing operational UI.

## Next actions

1. Finish replacing the remaining legacy direct-write fallbacks with atomic
   RPCs or explicit demo/test-only paths.
2. Add failure/RLS regression tests and validate the forward migrations against
   a running Supabase database.
3. Continue through government workbench, document lifecycle, and schedule
   persistence checkpoints; the first route extraction checkpoint is now in
   source and build-verified.
