# PATH Progress

## Current status

Wave 0 (truth/baseline) is complete. The repository is runnable with the
installed Windows toolchain, but the MVP is not complete. The claims in older
documentation that persistence and cross-browser verification were complete
were not reproducible from the current source and have been replaced with the
findings below.

## UX recovery baseline — 2026-09-02

- Branch/commit: `main` at `680b441b0a491cc43e17287a7e610d9360ff462a`.
- Pre-existing worktree state: the supplied
  `docs/PATH_UX_LUNA_IMPLEMENTATION_PLAN.md` is untracked; it is preserved
  without modification.
- Deployed/generated footer evidence currently reports `0fe54e2`, which does
  not match the checked-out commit. This is a metadata-generation defect to
  repair within the UX shell work; it is not treated as source authority.
- `npm run build`: PASS when executed outside the sandbox; Vinext completed
  and generated route metadata.
- `npm run test` / Node suite: PASS, 344 tests passed, 0 failed; repeated
  WebSocket port-in-use warnings remain non-fatal.
- `npm run supabase:rls`: PASS; isolated project/document reads were hidden
  and an unauthorized Storage upload was rejected by RLS.
- `npx tsc --noEmit`: FAIL on pre-existing type errors in
  `TicketWorkflowEditor.tsx`, `operational-ux.ts`, `repository.ts`, route
  resolvers, and missing `@playwright/test` types.
- `npm run lint`: FAIL before UX changes because generated `.vercel` output is
  linted and contains dependency errors; the repository also has existing
  warning debt.
- Protected Playwright suites: BLOCKED because `@playwright/test` is not
  installed/resolvable in the current checkout.

Persistence and document download checks are regression gates for every
stateful/navigation change; no UX-00 source behavior was changed.

## Flow visibility checkpoint (2026-09-02)

- Added a shared past/current/next workflow journey model and reusable UI.
- Project overview rows now show step progress; the project page also has a
  "Project right now" strip for attention, active work, and next milestone.
- Customer and worker work surfaces use the same ordered journey, with
  customer-safe labels and no internal assignee or completion-note leakage.
- Authenticated workstream routes hydrate tasks, pinned workflow stages, and
  persisted `stage_runs`; completed stages show their authoritative completion
  timestamp and internal completion note to workers.
- Added journey-model and role-safety tests. The serial full suite passes 344
  tests; the parallel suite has a known live-row-count race, while its isolated
  database test passes.

CHECKPOINT:
"checkpoint: workflow flow visibility and persisted history"

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
| `node --test tests/*.test.mjs` | PASS | 170 passed, 0 failed, 0 skipped; repeated Vite WebSocket port-in-use warnings. Primarily fixture/unit coverage. |
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
- Removed remaining repository fire-and-forget Supabase writes. Legacy
  synchronous helpers now remain fixture/test-only; production UI mutations
  use awaited persisted methods and report remote errors before success.
- Removed the browser-created blocker notification and added the forward
  migration `20260830220000_workstream_action_notifications.sql`, which
  derives persisted action confirmations from workstream audit events. The
  authenticated actor is the guaranteed recipient because free-text target
  names are not stable user identities.
- Added an explicit state-office intake queue so Sarah’s clean-context flow
  can retrieve and triage the exact customer request created by another
  browser. Added `lib/project-identifiers.ts` plus migration
  `20260830221000_project_reference_compatibility.sql` to normalize the
  historical fixture project alias to the canonical project UUID/number.
- Updated the test command to expose Node garbage collection, making the
  existing SSR memory stress gate deterministic after the full suite.
- Completed the strict cross-context RFI proof: Jordan issues a persisted RFI
  from a workstream-backed coordination item, the reviewer sees the linked
  workstream pause, Alex retrieves the exact question and responds, and a fresh
  Jordan context retrieves the exact response, accepts it, and sees the linked
  workstream resume.
- Added forward RLS hardening for workflow transitions and checklist metadata;
  authenticated reads now require an accessible project workstream unless the
  caller is a system administrator. Migration `20260830222000` still needs to
  be reconciled into the live migration ledger before it can be verified there.
- Removed the pre-authentication Supabase hydration race; initial loading now
  hydrates only after a browser session is established, preventing an
  unauthenticated empty result from overwriting authorized state.
- Replaced the Gantt's fixed March–December 2026 header with month segments
  derived from the persisted project timeline and a runtime today marker.
- Replaced disabled workflow-designer catalog controls with server-guarded
  organization and authorization registration forms. Their audit-backed RPCs
  are checked in as migration `20260830223000` and return the persisted record
  before the designer updates its visible list.
- Hydrated the workflow designer's catalog and organization roster from the
  authoritative Supabase tables after login, while retaining fixture data only
  for explicit demo/test mode. Fixed the document upload hydration race so a
  quick-demo upload resolves the post-hydration document UUID before writing to
  Storage.
- Added `npm run supabase:rls`, a disposable authenticated/anonymous isolation
  probe that verifies an ungranted customer cannot read a project or document
  and cannot upload to its private Storage path.
- Replaced the UI's sequential multi-workstream triage loop with one atomic
  `rpc_triage_customer_request` transaction. It locks the request, validates
  every requested workstream and published workflow, creates all linked
  workstreams plus their initial intake tasks, updates the request once, and
  writes one audit event; any failure rolls back the complete fan-out. Migration
  `20260830225000_atomic_multi_workstream_triage.sql` and the repository/RPC
  path are source-contract tested.
- Added migration `20260830231000_pin_legacy_workflows_and_enforce_versioned_completion.sql`.
  It imports legacy workflow definitions into pinned version/stage rows and
  replaces stage completion with a server gate that reads the pinned stage,
  enforces configured checklist/document and statutory-day requirements,
  records `stage_runs`, activates the next task, and notifies the next
  organization's supervisors/admins.
- Added an authoritative `fetchWorkflowTemplates` query and repository
  hydration path. The existing Workflow Designer now receives Supabase-backed
  definitions, versions, and stage rows in production, while fixture templates
  remain isolated to demo/test mode.
- Hardened `rpc_create_customer_request` so the database derives the actor from
  `auth.uid()`, canonicalizes the project reference, requires project access,
  validates referenced document versions against that project, and supports
  safe retry idempotency. Migration `20260830232000_secure_customer_request_actor.sql`
  supersedes the legacy client-supplied actor fields.
- Added the first-file customer intake path. The client uploads bytes to the
  private Storage bucket, then `rpc_create_customer_request_with_document`
  commits the document parent, immutable v1, request attachment link, audit,
  and notification together; failed database commits remove the uploaded
  object. The UI exposes an optional attachment on both plain-language and
  structured customer intake.
- The combined first-file RPC checks the request idempotency key before
  inserting a document parent, so a successful client retry returns the
  canonical request without creating an orphan document.
- The authenticated `/api/requests` route now resolves either a canonical
  project UUID or its human-facing project number before querying or creating
  requests.
- Removed the old unreachable client-side request audit/notification branch;
  the authoritative request RPC is the sole owner of production request,
  audit, and notification writes.
- Scoped workflow and permit-catalog administration to the owning organization.
  `organization_admin` members can read workflow stages and create, edit,
  validate, and publish their own workflow versions; system admins retain
  global access, while organization registration remains system-admin-only.
  Migration `20260830234000_scope_workflow_admin_by_organization.sql` owns the
  forward capability boundary.
- Hydrated the production administration roster from active organization
  memberships and user profiles. Role changes now go through
  `rpc_set_organization_member_role`, which enforces organization ownership,
  protects `system_admin`, audits the change, and returns the persisted
  membership before the UI updates.

## Known blockers and risks

- A live Supabase project is configured, but the repository does not yet have
  a reproducible clean-context RLS negative-test harness for every persona.
- Existing historical migrations contain permissive policies; a forward
  hardening migration must supersede them without rewriting migration history.
- The live migration ledger is ahead/behind the checkout in multiple places:
  `npx supabase migration list` reports remote `20260830210001` without a
  local file and local hardening/action migrations not yet applied remotely.
  Do not repair that history automatically; reconcile it before deployment.
- The previous Chromium document-upload failure was a client hydration race;
  after the fix, the live upload/download lifecycle passes. The live migration
  ledger still needs reconciliation before the checked-in forward Storage/RLS
  changes can be declared deployed everywhere.
- The large internal router must be extracted incrementally to avoid regressing
  the existing operational UI.
- The direct Vite dev server is the reproducible browser-test runtime here;
  `vinext start` served the shell but returned 404s for built `/assets/*` in
  this Sites-configured environment and needs deployment-runtime validation.
- The checked-in atomic triage RPC is not yet live-verified because the remote
  migration ledger must be reconciled before applying local migrations.
- The checked-in request-actor hardening RPC is not yet live-verified because
  the remote migration ledger must be reconciled before applying local
  migrations.
- Customer first-file intake is source-implemented but not live-verified; the
  remote migration ledger must be reconciled before the combined document /
  request RPC can be exercised against Supabase.
- The organization-scoped workflow capability is source-verified but not
  live-verified until the remote migration ledger is reconciled.
- Organization member role persistence is source-verified in migration
  `20260830235000_persist_organization_member_roles.sql`; live verification is
  pending the same ledger reconciliation.
- Added the missing mandatory-DAG completion guard in migration
  `20260830240000_enforce_mandatory_task_dependencies.sql`: a persisted
  `statutory_mandatory` predecessor must be complete before a workstream can
  transition to `complete`.

## Next actions

1. Add the remaining failure/workflow negative tests and validate every
   forward migration against a running Supabase database.
2. Reconcile the live migration ledger before applying the checked-in forward
   hardening/action/notification migrations.
3. Complete the clean-context SpaceX → triage → three workstreams → RFI →
   accepted response → stage handoff journey; the current Chromium suite
   proves only the request/RFI/document slices independently.

## Latest verification

| Command | Result | Evidence |
|---|---|---|
| `npx playwright test --project=chromium tests/e2e/supabase-persistence.spec.ts` | PASS | 2/2 scenarios passed; Scenario 1 proves exact request propagation and Scenario 2 proves exact RFI question, workstream pause, applicant response, reviewer acceptance, and workstream resume across isolated contexts. |
| `npx playwright test --project=chromium tests/e2e/document-management.spec.ts` | PASS | 2/2 passed after resolving the pre-hydration fixture document ID race; exact uploaded bytes and seeded private PDF were verified. |
| `npm run supabase:rls` | PASS | Disposable isolated project/document probe: authorized customer and anonymous reads returned no rows, and unauthorized Storage upload was rejected. |
| `npx tsc --noEmit` | PASS | TypeScript completed without errors. |
| `npm run build` | PASS | Vinext/Vite production build completed; asset-size and dynamic-route warnings remain. |
| `npx eslint . --ignore-pattern dist --ignore-pattern .next` | PASS with warnings | 0 errors; existing unused-import/unused-variable warning debt remains. |
| `npm test` | PASS | Build plus 170 Node tests: 170 passed, 0 failed, 0 skipped; Node runs with `--expose-gc` for the memory stress gate. |
