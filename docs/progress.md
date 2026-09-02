# PATH Progress

## Current status

Wave 0 (truth/baseline) is complete. The repository is runnable with the
installed Windows toolchain, but the MVP is not complete. The claims in older
documentation that persistence and cross-browser verification were complete
were not reproducible from the current source and have been replaced with the
findings below.

## UX appended-work baseline — 2026-09-02

- Branch/commit: `main` at `0940e6a`.
- Pre-existing user change: `docs/PATH_UX_LUNA_IMPLEMENTATION_PLAN.md` is
  modified and is preserved without editing or staging.
- Checked-in footer metadata before this baseline reported `beb0663`; the
  protected build regenerated it to the current `0940e6a` commit through the
  existing version-generation path.
- `npm run build`: PASS under the elevated Windows runner; Vinext emitted the
  root, Admin, project, workstream, request, API, and demo-resource routes.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS with 304 existing warnings and 0 errors.
- `npm test`: PASS; build plus 360 Node tests passed, 0 failed, 0 skipped.
  Existing non-fatal Vite WebSocket port-in-use warnings remain.
- `npm run supabase:rls`: PASS; isolated project/document reads were hidden and
  unauthorized Storage upload was rejected by RLS.
- `npx playwright test --project=chromium
  tests/e2e/supabase-persistence.spec.ts`: BLOCKED by current browser
  expectations: the Alex flow could not find `Open SpaceX Pecan Island`, and
  the reviewer flow could not find a `COORDINATION` card with `Request
  Information`.
- `npx playwright test --project=chromium
  tests/e2e/document-management.spec.ts`: BLOCKED by current browser fixture
  state: upload reported `the selected document is no longer available`, and
  the seeded PDF download row was unavailable before timeout.

Persistence, RLS, audit, notifications, uploads, and downloads remain
regression gates for every stateful or navigation change.

## Appended Task 1 — project-card navigation (2026-09-02)

- Removed the post-authentication route reset that could overwrite a direct
  project/workstream URL before the URL-backed restore completed.
- Project summary rows and the Needs attention / Happening now / Next milestone
  cards now expose a large, keyboard-accessible workstream workspace target and
  retain the stable workstream identifier in the focus callback.
- Added focused tests for fresh-load URL preservation and clickable project
  summary cards.
- Verification: `node --test tests/project-navigation.test.mjs` — 10 passed;
  focused ESLint — 0 errors (existing warnings only); `npm run build` — PASS.
- Supabase, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: Appended Task 2 — separate administrative configuration from
the public Permit Catalog.

## Appended Task 2 — administration boundary (2026-09-02)

- Added a physical `/admin` landing route with server-side session and active
  `system_admin` / `organization_admin` membership checks.
- The Admin landing links to versioned Workflow Templates and the existing
  audited people/organizations/roles workspace; the public Permit Catalog
  remains a resource-only surface.
- Added focused source-contract tests for the server boundary and catalog
  separation.
- Verification: `node --test tests/admin-catalog.test.mjs` — 2 passed;
  `npx tsc --noEmit` — PASS; focused ESLint — 0 errors; `npm run build` — PASS
  with `/admin` emitted.
- Supabase schema, RLS, audit, notifications, uploads, and downloads were not
  changed; existing admin RPC authorization remains the mutation boundary.

Next ready task: Appended Task 3 — make each Permit Catalog resource actionable
without placeholder links or dead routes.

## Appended Task 3 — resource catalog completeness (2026-09-02)

- The public Permit Catalog now presents each permit as an actionable resource: purpose and trigger, responsible agency and reviewing group, prerequisites, configured review stages, submission guidance, official filing links, form/instructions/checklist links, related permits, and contact/escalation guidance.
- Internal fallback resources use stable, labeled demo-resource URLs with explicit resource variants (`form_pdf`, `guidance_doc`, and `checklist`); the demo page identifies them as fictional demonstration material. No dead `#` links were introduced, and the request action continues to preselect the catalog permit before opening the request flow.
- Verification: focused `node --test tests/admin-catalog.test.mjs` passed (2/2); `npm run build` passed and regenerated version metadata; prior protected baseline typecheck, lint, full Node suite, and RLS checks remain passing.
- Supabase persistence, RLS/RPC authorization, audit behavior, notifications, uploads, and downloads were not changed.

Next ready task: Appended Task 4 — expand the self-contained deterministic SpaceX demo seed environment.

## Appended Task 4 — self-contained SpaceX demo seed (2026-09-02)

- Expanded the repeatable Supabase seed with the required agency, state, local, applicant, internal-team, and external-partner organizations, including federal consultation organizations used by the Louisiana program.
- Fixed the persona-to-organization and filing-user mismatches. Seeded professional demonstration personas remain under `@demo.permit.local`, carry an explicit fictional marker, and retain differentiated customer, agency, coordinator, consultant, executive, and administrator roles.
- Added stable-ID assignment groups and memberships; a versioned `spaceport_request` workflow with stages; the `WS-AIR-TITLE-V` workstream; completed, current, customer-pending, blocked, and future tasks; finish-to-start dependencies; request workflow instances and assignments; an applicant action-required notification; and an audit entry. Re-running the supplemental seed updates these records instead of generating duplicates.
- Expanded `supabase/seed.sql` with the same registry organizations for a self-contained local seed baseline. Existing Storage/document and authoritative reset-seed behavior remains intact.
- Verification: `node --check scripts/seed-spacex-demo.mjs` — PASS; focused `node --test tests/spacex-demo-seed.test.mjs` — 2 passed; `npx tsc --noEmit` — PASS; `npm run lint` — PASS with 304 existing warnings and 0 errors.
- The live seed was not executed because the repository’s documented remote migration-ledger mismatch remains an external Supabase deployment blocker; no database or secrets were changed during this checkpoint.

Next ready task: Appended Task 5 — verify the complete seeded path end to end and close remaining UX recovery gaps.

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

## UX-01 — centralized PATH product copy (2026-09-02)

- Added `lib/product-copy.ts` with shared product, program, and full project
  display-name constants.
- Updated root metadata, login/shell labels, footer branding, operational
  projections, and the seeded project record to use the shared copy.
- Removed Vermilion Parish from the login hero and persistent footer while
  retaining it as project location context and domain data.
- Focused verification: `node --test tests/source-contract.test.mjs
  tests/project-navigation.test.mjs tests/rendered-html.test.mjs` — 16 passed.
- `npm run build` — PASS; regenerated `lib/version.ts` and Vinext output.
- Supabase, RLS, audit, notifications, uploads, and downloads were not
  changed.

Next ready task: UX-02 — simplify the logged-out sign-in experience.

## UX-02 — simplified PATH sign-in (2026-09-02)

- Extracted the logged-out experience into
  `components/path/LoginPage.tsx` with one centered sign-in card.
- Removed the hero claim, benefit cards, default-landing explanation, and
  demo-persona paragraph from the first-time view.
- Preserved email/username, password, Sign In, Quick Demo Sign-In, collapsed
  persona choices, keyboard focus styles, and an assertive login error region.
- Focused verification: source/SSR tests — 10 passed; focused ESLint — 0
  errors (existing warnings only); `npm run build` — PASS.
- Supabase, RLS, audit, notifications, uploads, and downloads were not
  changed.

Next ready task: UX-03 — stable navigation and return-context contract.

## UX-03 — stable navigation and return context (2026-09-02)

- Added `lib/navigation.ts` as the single route vocabulary and canonical
  `/work/{kind}/{id}` work-item URL contract.
- Root-shell navigation now writes browser history, preserves queue filters and
  scroll position, restores them on Back, and shows an inline unavailable-item
  state for an unauthorized or missing canonical work URL.
- Project and work-item actions now use the shared navigation contract while
  retaining existing authenticated data and physical route resolvers.
- Focused source, project-navigation, and rendered-shell tests — 18 passed;
  focused ESLint — 0 errors (existing warnings only); `npm run build` — PASS.
- Supabase, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-04 — rebuild the customer landing experience.

## UX-04 — customer landing experience (2026-09-02)

- Customer authentication now opens the project home by default.
- Added the customer-home/request-launcher components and placed the primary
  `Submit a Request` path before project status details.
- Preserved all six persisted request intents, added a compact request list with
  owner/status/update context and the empty state `No requests submitted yet.`.
- Request attachments are selected from the request-center context rather than
  a persistent My Work control; permit forms retain authoritative filing guidance.
- Focused source, project-navigation, and rendered-shell tests — 19 passed;
  focused ESLint — 0 errors (existing warnings only); `npm run build` — PASS.
- Supabase, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-05 — simplify My Work and correct counts.

## UX-05 — actionable My Work grouping (2026-09-02)

- Centralized actionable classification in `requiresCurrentUserAction` and
  changed the queue to four mutually exclusive groups: Needs my action, Due
  soon, Waiting on others, and Recently completed.
- Removed the six-item group truncation so visible cards and the navigation
  badge use the complete actionable projection.
- Made work titles semantic exact-item links and removed the duplicate generic
  Project button from collapsed cards.
- Focused operational/source tests — 21 passed; focused ESLint — 0 errors
  (existing warnings only); `npm run build` — PASS.
- Supabase, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-06 — build the unified work item page.

## UX-06 — unified work-item summary (2026-09-02)

- Added shared `WorkItemPage`, `NextActionPanel`, `WorkItemFacts`, and
  `ActivityFeed` components around the existing exact-record detail renderer.
- Detail views now expose the next action, owner/removal rule, Completed /
  Current / Next summary, and saved activity before the supporting workflow
  and record facts.
- The summary uses persisted journey/status data and explicitly avoids
  inventing completion history.
- Focused source tests — 13 passed; focused ESLint — 0 errors (existing
  warnings only); `npm run build` — PASS.
- Supabase, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-07 — make mutations refresh in place.

## UX-07 — mutation refresh and truthful saving state (2026-09-02)

- Persisted work-item actions now enter a Saving state, await the existing
  repository mutation, rehydrate authorized Supabase data, rebuild the
  canonical operational projection, and reselect the same item while staying
  on its detail route.
- Success messaging is emitted only after the refresh path completes; existing
  real mutation errors remain inline and do not produce success messaging.
- Focused source test — 14 passed; focused ESLint — 0 errors (existing
  warnings only); `npm run build` — PASS.
- RPC semantics, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-08 — repair workstream navigation and journey hydration.

## UX-08 — workstream route identity and hydration (2026-09-02)

- Centralized route-segment normalization with URL decoding, trimming, and
  Unicode normalization before project/workstream identity resolution.
- Preserved project scope on workstream resolution and the existing
  project-scoped compatibility redirect from `/workstreams/{id}`.
- Existing authenticated route hydration continues to load tasks, the pinned
  workflow-version stages, and persisted stage runs in parallel and renders
  unknown history honestly.
- Focused route/source tests — 22 passed; `npm run build` — PASS.
- Supabase query shape, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-09 — rebuild the project workstream interaction.

## UX-09 — visible project workstream focus (2026-09-02)

- Project workstream rows now expose `aria-pressed` focus state and keyboard
  semantics; selecting a row scrolls the selected journey into the visible
  viewport instead of leaving it below the grid.
- Existing scan fields and customer-safe journey rendering remain intact.
- Focused ProjectOverview/source lint — 0 errors; `npm run build` — PASS.
- Supabase, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-10 — make the Gantt truthful and usable.

## UX-10 — truthful schedule clock and controls (2026-09-02)

- Added shared `lib/time.ts` date normalization and replaced the hard-coded
  August 30 queue/Gantt clock with the current date by default.
- Gantt accepts an injected as-of date for deterministic tests and now exposes
  Day, Week, Month, Fit project, and Today controls while retaining the full
  table alternative and exact row activation.
- Focused Gantt/source tests — 19 passed; focused lint — 0 errors (existing
  warnings only); `npm run build` — PASS.
- Schedule state taxonomy, Supabase, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-11 — improve escalation selection.

## UX-11 — explicit escalation association (2026-09-02)

- Added an explicit escalation-target selector with project-wide/not-sure,
  workstream, permit, RFI, and document-decision choices.
- Escalation launched from a record is preselected to that record’s canonical
  kind/source identity; the existing recipient/customer-message preview remains
  in place before confirmation.
- Focused escalation/source tests — 18 passed; focused lint — 0 errors
  (existing warnings only); `npm run build` — PASS.
- Existing persisted escalation RPC/request behavior, RLS, audit, notifications,
  uploads, and downloads were not changed.

Next ready task: UX-12 — remove noise and finish the shell.

## UX-12 — shell noise and status placement (2026-09-02)

- Footer now carries environment and connection health alongside PATH version,
  commit hash/date, and persistence status.
- Header health pill, persistent official-filing notice, and empty secondary
  tools heading are hidden from the ordinary shell so current context, user,
  notifications, and sign-out remain primary.
- Focused shell/source/render tests — 20 passed; focused lint — 0 errors
  (existing warnings only); `npm run build` — PASS.
- Persistence, RLS, audit, notifications, uploads, and downloads were not changed.

Next ready task: UX-13 — full regression and usability proof.

## UX-13 — full regression and usability proof (2026-09-02)

- Full protected Node regression: `npm test` PASS — 356 tests passed, 0 failed,
  0 skipped. Existing non-fatal Vite WebSocket port warnings remain.
- Supabase isolation: `npm run supabase:rls` PASS — isolated reads were hidden
  and unauthorized Storage upload was rejected.
- Production build: `npm run build` PASS; footer metadata regenerated.
- Focused UX source/render/Gantt/operational suites pass, including canonical
  work-item navigation, customer request entry, queue exclusivity, mutation
  refresh, route normalization, project focus, escalation targeting, and shell
  status placement.
- Full `npx tsc --noEmit` remains blocked by pre-existing repository type debt
  in TicketWorkflowEditor, operational-ux/repository models, and missing
  `@playwright/test` types. The route-resolver cast introduced during UX-08 was
  corrected; remaining errors are outside the UX changes.
- Full `npm run lint` remains blocked by generated `.vercel` output: 124 errors
  and existing warning debt. Focused UX lint has 0 errors.
- UX-13 browser journeys are externally blocked: both existing Playwright
  suites fail before collection because `@playwright/test` is absent from
  `node_modules`; no credentials or source-level workaround can safely replace
  this protected browser gate.

Definition-of-done status: all implementation tasks are checkpointed locally;
the only unresolved items are the documented environment/debt blockers above.

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

## Historical verification from the prior checkpoint

| Command | Result | Evidence |
|---|---|---|
| `npx playwright test --project=chromium tests/e2e/supabase-persistence.spec.ts` | PASS | 2/2 scenarios passed; Scenario 1 proves exact request propagation and Scenario 2 proves exact RFI question, workstream pause, applicant response, reviewer acceptance, and workstream resume across isolated contexts. |
| `npx playwright test --project=chromium tests/e2e/document-management.spec.ts` | PASS | 2/2 passed after resolving the pre-hydration fixture document ID race; exact uploaded bytes and seeded private PDF were verified. |
| `npm run supabase:rls` | PASS | Disposable isolated project/document probe: authorized customer and anonymous reads returned no rows, and unauthorized Storage upload was rejected. |
| `npx tsc --noEmit` | PASS | TypeScript completed without errors. |
| `npm run build` | PASS | Vinext/Vite production build completed; asset-size and dynamic-route warnings remain. |
| `npx eslint . --ignore-pattern dist --ignore-pattern .next` | PASS with warnings | 0 errors; existing unused-import/unused-variable warning debt remains. |
| `npm test` | PASS | Build plus 170 Node tests: 170 passed, 0 failed, 0 skipped; Node runs with `--expose-gc` for the memory stress gate. |

## September 2, 2026 continuation checkpoint

- Fixed project workstream navigation in the client shell. Project, customer,
  schedule, vault, and catalog workstream controls now route through the
  stable workstream identifier and preserve `/?view=project&workstream=...`.
  The focused project view is now an explicit workstream workspace with the
  current stage, assignment group, next action, tasks, configured stages,
  documents, activity, decisions, dependencies, and hold state. Invalid
  identifiers have a recovery state with project-list navigation.
- Separated State Project Office intake from administrator access. The Admin
  route now requires `isAdministrator`, while State Project Office users use
  the distinct `intake` route. Workflow Templates, authorization catalog
  administration, and Agency Registry remain behind the authorized Admin
  route. The public/customer-facing catalog is read-only and includes
  purpose/trigger, agency and reviewing group, prerequisites, stages,
  submission guidance, resources, contact/escalation, related permits, and a
  request-start action.
- Added internal demo resource pages for catalog entries without an
  authoritative form or instruction URL. They are explicitly labeled as
  fictional PATH demo material and do not impersonate government forms.
- Hardened the repeatable seed path: `supabase/seed.sql` now upserts core
  federal/state/local coordination organizations, and
  `scripts/seed-spacex-demo.mjs` uses `@demo.permit.local` accounts, expands
  demo personas to include the requested public professional roles, upserts
  their profiles/memberships/participants, and retains repeatable request
  upserts.
- Added navigation and source-contract coverage for the exact workstream query
  contract and Admin/catalog boundary.

### Verification for this checkpoint

| Command | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | PASS | TypeScript completed without errors after correcting pre-existing type drift in the ticket workflow editor/repository notification path. |
| `npm run build` | PASS (elevated Windows runner) | Vinext build emitted root, Admin, catalog demo-resource, project, workstream, request, and API routes. |
| `node --test tests/project-navigation.test.mjs` | BLOCKED in restricted runner | Node test worker creation returned Windows `spawn EPERM` before test code executed; rerun with the elevated runner is pending. |

### Remaining follow-up

- The focused Node suites pass under the elevated Windows runner: 34/34.
- The full `npm test` gate passes under the elevated Windows runner: 358/358
  tests, 0 failures.
- Chromium was installed and the four existing browser specs were executed;
  all four currently fail in the browser fixture/auth setup before completing
  their assertions (the runner now reaches the app, but the document and
  queue fixtures are not available in that browser session). This is tracked
  separately from the clean Node/live-Supabase persistence gate.
- Reconcile the remote Supabase migration ledger before applying any pending
  forward migrations; deployment remains intentionally out of scope because
  the assignment explicitly prohibits push/deploy.

## Final verification — September 2, 2026

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS; 0 errors, 304 warnings |
| `npm test` | PASS; build plus 358 tests passed |
| `node --check scripts/seed-spacex-demo.mjs` | PASS |
| `npx playwright test --project=chromium tests/e2e/supabase-persistence.spec.ts tests/e2e/document-management.spec.ts` | EXECUTED; 4 browser assertions fail because the browser session lacks the expected seeded document/queue fixture state |
