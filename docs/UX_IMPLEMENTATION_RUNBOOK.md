# PATH UX implementation runbook

Audience: smaller implementation models working one checkpoint at a time.  
Companion evidence: `docs/UX_SIMPLIFICATION_PLAN.md`.  
Rule: do not restart the architecture. Preserve the domain model, audited mutations, Supabase persistence, private document storage, and versioned workflow concepts.

## Current completion ledger — 2026-09-09

This ledger supplements CP0–CP10 and is the active status record for the PATH UX completion plan. Historical test counts are retained only as history; the evidence below is the current acceptance record.

| Repair packet | Status | Current acceptance evidence / remaining condition |
|---|---|---|
| R0 — baseline and evidence ledger | Verified | Project `zomzacaxwqfwjstkxbpv`, production app `1d3f46889bd424afd1e838770bc643fe98bfcb25`, linked migration parity, tagged personas, and browser environments are recorded below. |
| R1 — authenticated identity and request updates | Verified | Fresh authenticated Chromium and Firefox customer → non-admin staff clarification → customer response/read-back; submitter remains Alex, Sarah is the authenticated actor, audit/notification state persists, and wrong-submitter authorization is rejected. Canonical persona repair migrations are applied. |
| R2 — authoritative assignment and Take Ownership | Verified | Scenario 5 passes in both browsers; two-user claim collision, stale-state conflict, self-claim, canonical assignee name, assignment audit, and recipient notification were also read back through live RPC probes. |
| R3 — shell and navigation | Verified | Current production Scenarios 4, 6, and 10 pass in both browsers: stationary PATH header/sidebar, main-pane scrolling, history/focus restoration, mobile drawer, touch/keyboard reachability, and 200%-equivalent narrow reflow. |
| R4 — real-stage schedule | Verified | Current production Scenario 4 passes in both browsers with no internal Gantt scrollbar, Today at 30%, aligned ticks/blocks, readable square stage blocks, parallel stages, and chronological mobile schedule. Tagged demo data retains 3–5 real stages and persisted `stage_runs`. |
| CP1–2 — shared truth and lifecycle | Verified | Current production Scenarios 1–3, 7–8, and 11 plus live Node durability tests cover request/RFI/clarification, response/acceptance/resume, block/unblock, independent coordination response, counts/read-back, audit, and notifications. |
| CP3–6 — routes, inbox, customer, project | Verified | Current production suite is 11/11 in Chromium and 11/11 in Firefox, including fresh-context intake, copied/canonical record navigation, assignment, project/schedule/customer read-back, and customer-obligation behavior. |
| CP7 — schedule | Verified | Scenario 4 and Scenario 11 prove persisted stage progress changes the project Work/Schedule projections after refresh; source tests cover canonical destinations, unscheduled stages, and blocker variance. |
| CP8 — administration | Verified | Scenario 9 passes in both browsers: non-admin denial, reason-required typed correction, audited RPC, refresh/read-back, and restoration of the tagged demo task. |
| CP9 — workflow authoring | Verified | Live authenticated draft/save/reopen/invalid-config/publish/new-instance/version-pinning flow is recorded; owner/group validation and five-stage persisted completion pass without rewriting published history. |
| CP10 — usability | Verified | Guide is superseded; current browser coverage proves header/sidebar behavior, focus, keyboard/touch navigation, 390px layout, 200%-equivalent reflow, readable schedule, and no horizontal overflow. |
| Cross-cutting release gates | Verified | Current tests/live checks pass; the final user-story review and final implementation/data/runbook/deployment consistency review both found no actionable in-scope defect. |
| Supabase migration consistency | Verified | `npx supabase migration list --linked` reports **69/69 local/remote matches through `20260909201000`**; `npx supabase db push --linked --dry-run` reports `upToDate: true` with no pending migrations, seeds, or roles. |

### Evidence recorded during the current implementation wave

- Source and focused behavior: the authenticated identity repairs, staff-operator boundary, assignment labels, claim RPC, stage-run hydration, parallel-stage projection, linked-request blocker projection, shell, canonical schedule links, RFI response projection, admin correction, workflow owner validation, mobile navigation, and footer-health tests pass. The serial Node suite completed with **463 tests, 455 passed, 0 failed, 8 environment-gated skips**. Those skipped files were then run with process-scoped live Supabase credentials: **30/30 passed, 0 skipped**.
- Release checks: full ESLint exits 0 with 299 warnings and 0 errors; `npx vinext build` passes with non-blocking chunk/static-analysis warnings; `node scripts/scan-build-secrets.mjs` passes; `npm run supabase:rls` passes with anonymous/isolated-table writes rejected.
- Current deployment: production health at `https://permit-tracker-iota.vercel.app/api/health?sha=1d3f468` reports status `ok`, environment `production`, and the full application SHA `1d3f46889bd424afd1e838770bc643fe98bfcb25`. No Git tag points at this SHA; synchronization is not described as a tagged release.
- Identity repair root cause and fix: the authenticated Maya and Sarah accounts had legacy demo UUID references in assignment/group/organization rows. `20260909200000_sync_maya_auth_identity.sql` and `20260909201000_merge_demo_persona_identities.sql` merge known demo aliases into canonical authenticated accounts, preserve original submitter/actor semantics, and assert the required group membership. A direct authenticated claim probe now returns `claimed` for Maya, and Scenario 11 completes through the Maya handoff.
- R1 lifecycle evidence: current production Scenarios 1–3 pass in Chromium and Firefox. Alex submits; Sarah performs authorized staff triage/clarification; Alex responds; fresh read-back preserves the original submitter and records the staff actor. Unauthorized submitter spoofing remains rejected by the server boundary.
- R2 assignment evidence: current production Scenario 5 passes in Chromium and Firefox. Sarah claims a tagged request, Joe’s stale competing claim receives the visible conflict, the assignment is read back as Sarah Johnson rather than a UUID, and self-claim does not create a self-notification. Independent live probes prove atomic collision behavior and distinct-recipient assignment notification delivery.
- R3/R4 evidence: current production Scenarios 4, 6, and 10 pass in both browsers. They verify fixed header/sidebar, main scroll ownership, no internal schedule scrollbar, aligned 30%-Today positioning, square 36px stage blocks, parallel active stages, canonical schedule destinations, Back/Forward state and focus restoration, mobile Escape/focus return, touch/keyboard actions, and no overflow at 390px or the 195 CSS-pixel 200%-equivalent viewport.
- CP1–2 and CP7 evidence: current production Scenario 2 completes a Jordan → Alex → Jordan RFI response/acceptance cycle; Scenario 3 proves a different authorized staff actor can update a customer request; Scenario 7 proves persisted block/unblock; Scenario 8 proves coordination response does not clear the linked dependency; Scenario 11 completes fresh Alex → Sarah → Maya → Sarah stages and reads back Team Work, project Work, Schedule, and customer state after refresh. Current full cross-browser result: **11/11 Chromium and 11/11 Firefox**.
- CP8/CP9 evidence: current production Scenario 9 passes in both browsers for admin denial/typed correction/audit/read-back. Focused and live workflow-authoring checks prove draft save/reopen, invalid owner/group rejection, valid publish, new-instance pinning, and unchanged published history.
- Exact document evidence: current production `1d3f468` `tests/e2e/document-management.spec.ts` passes **2/2 Chromium and 2/2 Firefox**. The browser uploads a tagged non-empty file, reads immutable metadata, downloads the exact Storage object, compares bytes/SHA-256, and verifies the seeded demo PDF; cleanup removes only the temporary tagged object/version.
- Migration and data evidence: all 69 local migrations match the linked project through `20260909201000`; the dry-run is clean. The tagged demo seed remains idempotent and retains relevant 3–5-stage workflows, persisted stage history, parallel stages, unscheduled-stage handling, and no fabricated document bytes.
- Current deployment smoke: `1d3f468` Scenario 11 passes in Chromium and Firefox, covering the complete fresh-context customer → staff → supervisor → staff journey, five persisted stages, project/schedule/customer read-back, and post-refresh state. The production health endpoint and browser footer report the same full SHA.
- Final review A — user stories: customer submission/clarification/response, non-admin staff triage, RFI request/response/acceptance, assignment claim/conflict, blocker/resume, coordination response, admin correction, workflow authoring, schedule, exact documents, notifications, mobile keyboard/touch, copied navigation, reload, Back/Forward, and customer completion were checked against the current or current-code deployment evidence. No actionable in-scope defect remained.
- Final review B — consistency: source contracts, focused/full tests, live persisted records, migration ledger/dry-run, current runbook, deployment health, GitHub `main`, and worktree were compared. Full local and remote SHAs equal `1d3f46889bd424afd1e838770bc643fe98bfcb25`; worktree is clean; no conflicting completion claim or migration mismatch remains.
- Current test-harness repairs: Scenario 2 now waits for authenticated hydration and authoritative refresh read-back; Scenarios 7–8 use canonical authenticated personas and search the persisted workstream/coordination projections rather than stale alias credentials or retired display assumptions.

The guide requirement formerly listed under CP10 is superseded by R3. PATH must not ship a replacement welcome panel or replay control. The plan is accepted against the stated gates. This is synchronized `main` evidence, not a verified tagged-release claim.

## Working protocol for every implementer

1. Pull `origin/main` with fast-forward only. Read this runbook, the companion plan, relevant tests, and only the files named in the assigned packet.
2. Inspect `git status`. Preserve unrelated work. Work on one packet only.
3. Before changing Supabase schema or SQL, read `.agents/skills/supabase/SKILL.md` and `.agents/skills/supabase-postgres-best-practices/SKILL.md`. Inspect the linked migration ledger first. Never repair or rewrite migration history speculatively.
4. Write the smallest shared abstraction that fixes the whole class of problem. Avoid isolated page-specific patches when the same record or action appears elsewhere.
5. Do not use fixture-only success as production proof. Never expose environment values or service-role credentials.
6. Add focused tests for changed behavior. Run them serially when they touch shared/live counts. Then run the checkpoint gate.
7. Record evidence in the commit message or checkpoint note: behavior tested, persona, record ID, persistence result, and any gap.
8. Commit one coherent packet. Push it. Compare full `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` SHAs. Do not claim completion until they match and the worktree is clean.

Standard commands from PowerShell:

```powershell
node --test --test-concurrency=1 tests/<focused-test>.test.mjs
node --test --test-concurrency=1 tests/*.test.mjs
npx eslint . --ignore-pattern dist --ignore-pattern .next --ignore-pattern .vercel --ignore-pattern scripts/reviewer2-exhaustive-audit.mjs
npx vinext build
```

After Supabase, source, or deployment changes, apply `.agents/skills/permit-tracker-verify-and-sync/SKILL.md` before declaring the checkpoint complete.

## Non-negotiable product contracts

- A record has one canonical destination and stable ID. Queue, project, schedule, notification, admin, search, and copied URL open the same record.
- Displayed assignment comes only from persisted assignee/team/agency fields. A submitter is never silently treated as an assignee.
- “Needs my action” means the signed-in person can perform a currently required action. Team-eligible unassigned work is labeled “Available to your team.”
- Waiting identifies who owns the next move. Blocked identifies a specific impediment, reason, and resolution action. Accepted, resolved, and closed records never appear as awaiting a response.
- The next-action sentence and available primary control come from one action descriptor. If an action is unavailable, explain why.
- Mutations return and render authoritative resulting state. Confirmations state what happened, who is next, clock/schedule effect, and notification delivery state.
- Missing data stays visibly unknown. Do not invent relationship IDs, phase dates, progress events, assignees, or notification success.
- Customer views never expose staff-only deliberation, access data, or internal notes.
- Published workflow versions and audit history remain immutable. Future workflow edits use drafts; live instance corrections are distinct audited operations.

## Checkpoint 0 — lock the baseline

Goal: make later results attributable to a specific source and deployment.

Files: `lib/version.ts`, `components/SystemVersionFooter.tsx`, deployment configuration, targeted verification scripts only.

Steps:

1. Capture local full SHA, `origin/main` full SHA, Vercel production deployment SHA, linked Supabase project ref, and current migration list without printing secrets.
2. Fix build metadata injection so the live footer never links to `/commit/unknown`. If metadata is unavailable, show “Build identity unavailable” without a bogus link.
3. Create isolated, clearly prefixed acceptance records or a deterministic seed for later journeys. Keep E2E records out of ordinary user queues unless the demo explicitly selects them.
4. Write a short baseline report containing reproducible URLs and record IDs for the intake request, workstream RFI, assignment, blocker, workflow-version, and document-version stories.

Gate:

- Local and production SHAs are visible and traceable.
- Baseline test data can be reset without deleting ordinary demo/business data.
- No page reports “empty” when the actual condition is failed loading or denied access.

Commit: `chore: establish UX repair acceptance baseline`

## Checkpoint 1 — create one authoritative operational projection

Goal: every UI reads the same meaning for assignment, lifecycle, waiting, actions, and related records.

Primary files: `lib/domain-models.ts`, `lib/supabase/queries.ts`, `lib/supabase/mappings.ts`, `lib/repository.ts`, `lib/operational-ux.ts`, `lib/workstream-truth.ts`, `lib/workflow-journey.ts`.

Steps:

1. Define an `OperationalRecordProjection` or equivalent containing record identity, parent workstream/project, submitter, individual assignee, assignment group, owning agency, lifecycle state, health, clock state, waiting party/reason, current step, next action, related RFIs/responses/documents/dependencies, and customer-safe summary.
2. Join RFIs and responses into workstream hydration. Remove the mapping that always initializes workstream RFIs to an empty array.
3. Separate workflow-stage history from task fallback. When `stage_runs` are absent, render “Step history not recorded”; preserve a known completed lifecycle state.
4. Remove `WS-CUSTOMER-INTAKE` and similar invented relationship fallbacks. Represent a pre-routing customer request as a valid standalone record with no workstream.
5. Remove submitter-as-owner fallback from customer-request mapping. Expose `submittedBy` separately and show persisted assignment or “Unassigned.”
6. Normalize terminal-state rules centrally. Accepted/closed RFIs and completed work must not retain waiting copy or waiting queue membership.
7. Make customer-action summaries derive from outstanding customer obligations rather than generic defaults.

Focused tests:

- Unlinked intake request has no fake workstream and displays Unassigned.
- Workstream hydration contains its linked RFIs and responses.
- Accepted RFI is terminal and not waiting.
- Completed work with no stage runs remains complete and reports unavailable history.
- Multiple outstanding RFIs/dependencies remain independently visible.

Gate:

- For each seeded record, queue row, detail page, project summary, and notification agree on state, assignment, and next owner after refresh.
- No presentation color or label determines business state.

Commit: `fix: unify authoritative operational record state`

## Checkpoint 2 — centralize action eligibility and fix RFI/clarification

Goal: every displayed next action is possible and persists correctly.

Primary files: `lib/operational-ux.ts`, `lib/repository.ts`, `lib/supabase/mutations.ts`, `app/page.tsx`, `components/path/work/NextActionPanel.tsx`, new action-descriptor module/components, relevant migrations/RPCs only if required.

Steps:

1. Define one action descriptor: action ID, label, eligible personas, required state, required fields, disabled reason, command, recipient preview, and expected result.
2. Make queue quick actions, detail primary action, “what you need to do,” and dialogs consume that descriptor.
3. Split two flows:
   - Pre-workstream customer request: “Request clarification” attaches to the request and routes to its submitter. It must not call a workstream RFI mutation.
   - Linked workstream: “Request information” requires a real resolved workstream and creates a linked RFI.
4. Make RFI creation idempotent for retries. Persist RFI, clock/hold effect, audit event, and notification intent consistently. Do not claim a notification was delivered unless confirmed.
5. After creation, show a durable receipt with RFI code, recipient, request text, due date, waiting party, clock/schedule effect, and Open RFI link.
6. On customer response, preserve exact document-version IDs. On reviewer acceptance, clear only the hold satisfied by that response. Keep other RFIs/dependencies active.
7. Replace impossible free-text “next action” instructions such as “Record agency” with a real descriptor/control or a specific disabled reason.

Focused tests:

- Request clarification succeeds for an unlinked intake request.
- Workstream RFI succeeds only for a real linked workstream.
- Retry does not create duplicate RFIs.
- Customer sees the correct request, responds, and reviewer sees exact response/documents.
- Accepting one RFI does not clear unrelated holds.
- Failed mutation preserves prior UI state and offers retry.

Gate — complete this story end to end with authoritative persistence:

```text
Jordan → intake request → request clarification → Alex sees request
→ Alex responds → Jordan sees exact response → Jordan accepts
→ request/workstream resumes where appropriate → queues and project refresh
```

Run refresh and copied-link checks after every mutation boundary.

Commit: `fix: complete request clarification and RFI lifecycle`

## Checkpoint 3 — canonical routes and the shared record page

Goal: one destination and page structure per record.

Primary files: `lib/navigation.ts`, `app/page.tsx`, `app/work/[kind]/[id]` or existing equivalent, `app/workstreams/[workstreamId]/page.tsx`, `components/path/work/WorkItemPage.tsx`, `WorkItemFacts.tsx`, `ActivityFeed.tsx`, entity-link components.

Steps:

1. Create typed `EntityRef` and one canonical route builder/resolver for project, workstream, task, customer request, RFI, coordination request, commitment, determination, document/version, person, organization, group, and workflow definition.
2. Preserve legacy query/code URLs by resolving them to canonical IDs and replacing the URL after successful resolution.
3. Ensure `profile` is a recognized, reloadable route. Add canonical destinations for other directory entities before turning their names into links.
4. Build a shared record shell: breadcrumb, title/status, persisted assignment, next move, primary action, tabs for Overview/Documents/Activity, and parent links.
5. Use semantic links for navigation. Avoid nested interactive controls; a clickable row may have one separate, clearly labeled secondary control.
6. Move schedule selections and notifications directly to the selected record or phase anchor. Remove “insert selected workspace inside the long project overview” as the primary destination.
7. Restore route, filters, selected tab, focus, and main-pane scroll on Back/Forward.

Focused tests: extend `tests/s4-navigation-story.test.mjs` and `tests/project-navigation.test.mjs` for every entry point, refresh, browser history, case-insensitive legacy code resolution, unauthorized access, and missing record.

Gate:

- Open the same workstream from My Work, Team Work, project, schedule, notification, admin, and copied URL. Confirm identical stable URL, identity, state, and focus.
- Unauthorized users receive a useful access state without leaked fields.

Commit: `feat: establish canonical record destinations`

## Checkpoint 4 — simplify the shell and daily work inbox

Goal: a first-time staff user can find and understand their next action quickly.

Primary files: `app/page.tsx`, `lib/navigation.ts`, `components/path/*`, `app/globals.css`, new shell/inbox components.

Steps:

1. Extract the application shell from `app/page.tsx`. Desktop: fixed header and navigation rail, one independently scrolling main pane. Mobile: short PATH title, avatar/profile control, navigation drawer.
2. Staff primary navigation: My Work, Team Work, Projects, Services & Permits. Put Notifications and Profile in the header. Put Administration in its own authorized section. Preserve old RFI/coordination/document URLs as filtered inbox views.
3. Inbox default tabs: Needs my action, Waiting, Completed. Make Due soon/Overdue filters. Hide advanced type/agency/priority filters behind Filters.
4. Replace repeated large cards with compact rows showing title, next action, assignee/team, status, and due date. Put explanations, requirements, and history on the record page.
5. Team Work tabs: Unassigned, Assigned, Waiting, Completed. Add a team selector and persisted counts. Implement atomic Take ownership with stale-state conflict handling.
6. Derive tab/nav counts from the exact same filtered projection used for rows. Count clicks apply the matching filter.
7. Make the header identity clickable. Profile displays name, title, organization, teams/groups, roles, and why the user sees work.
8. Replace internal jargon in ordinary flows: DAG → Dependencies; Variance Engine → Schedule analysis; Fulfiller → Assigned to; Open Work & Workflow → Open.

Focused tests: extend `tests/assignment-queue.test.mjs`; test direct assignment, eligible team work, admin/supervisor scope labeling, counts, claim collision, filters, and profile route reload.

Gate:

- Jordan's Needs my action contains only executable work.
- Team Work count equals visible rows for the selected team/filter.
- A second user cannot overwrite a concurrent claim.
- Header/rail remain stable while main content scrolls; Back returns to the prior row and filter.

Commit: `feat: simplify staff navigation and work inbox`

## Checkpoint 5 — shorten customer home and request experience

Goal: customers see their obligations and recent outcomes before project machinery.

Primary files: `components/path/customer/CustomerHome.tsx`, `CustomerRequestList.tsx`, `GovernmentServices.tsx`, `SubmitRequestLauncher.tsx`, `lib/customer-portal.ts`, navigation/shell components.

Steps:

1. Customer navigation: Home, My Requests, Projects, Services & Permits. Put profile, notifications, help, documents, and schedule in contextual/header locations.
2. Home order: actions needing customer response, recent request updates, project summary, then optional broader workstream detail.
3. Fix “Requests needing your response” so it counts actual outstanding customer obligations. It must not count all submitted/triage/in-progress requests.
4. Remove generic “SPACEX ACTION” from workstreams with no customer action. State who is working and what happens next.
5. Preserve the existing service/permit intake. Add receiving agency/team, expected process, filing authority, and after-submission steps before confirmation.
6. Make demo sign-in searchable and grouped into Customer, Staff, and Admin. Feature three walkthrough personas. After selection show role/team context and land on the appropriate home.

Gate:

- Alex can identify every item requiring a response and none that do not.
- Customer action count equals the actionable list.
- A submitted service request displays receiving team and next step after refresh.
- No internal assignment/access details leak to the customer.

Commit: `feat: focus customer home on actions and request outcomes`

## Checkpoint 6 — make Project Overview concise and navigable

Goal: explain the project at a glance without repeating all records.

Primary files: `components/cockpits/ProjectOverviewPage.tsx`, `WorkstreamTruthSummary.tsx`, `WorkflowJourney.tsx`, project navigation components.

Steps:

1. Project tabs: Overview, Work, Schedule, Documents, People.
2. Overview contains one plain-language status sentence, target/forecast, clickable health counts, top blockers, next milestones, recent activity, and a short work preview.
3. Move all 23 workstream cards to Work with search/filter/sort. Remove the embedded full Gantt and duplicate metrics table from Overview.
4. Make health counts filter Work. Make applicant, owner, agency, person, document, commitment, decision, and participant summaries canonical links.
5. Render lifecycle as “Completed / Current / Next” only when supported by recorded state. Explain missing history instead of showing zero progress.
6. Keep advanced operational detail expandable. Use sentence case and reduce decorative uppercase/heavy type.

Gate:

- Overview first viewport answers overall state, largest issue, next milestone, and responsible party.
- Every count opens exactly the records counted.
- No full work list or full schedule appears on Overview.

Commit: `feat: create concise navigable project overview`

## Checkpoint 7 — fix schedule semantics and interactions

Goal: show real phases and make every click go somewhere specific.

Primary files: `components/cockpits/WorkstreamGraphGantt.tsx`, schedule engine/model files, canonical navigation components.

Steps:

1. Default viewport places Today at **30% ±2%** of the date-grid width, excluding the label column; Fit project remains an explicit exception/control.
2. Expand each workstream into real workflow stages/tasks. Support parallel steps. Use recorded actuals, baseline, and forecast distinctly.
3. Never synthesize phase dates. Show Not scheduled and an authorized configuration link when dates are absent.
4. A workstream bar opens the workstream. A phase opens its phase/anchor. A task opens the task. Do not scroll to a generic `aria-pressed` element.
5. Keep color plus text/pattern/status icons. Add an equivalent chronological list for mobile and screen readers.
6. Move simulator, delay taxonomy, and other dense analysis under Advanced analysis.
7. Do not provide an internal Gantt scrollbar. Use range/zoom/previous/next/Today/Fit project controls and preserve a usable chronological list.

Gate:

- Click at least three different bars/phases/tasks and confirm distinct canonical destinations.
- Block/unblock changes schedule and project health after refresh.
- At 390px the list alternative is usable without horizontal body overflow.

Commit: `feat: show actionable workflow phases in schedule`

## Checkpoint 8 — connect administration and typed editing

Goal: admins can follow relationships and safely correct persisted data.

Primary files: `components/admin/AdminExplorer.tsx`, `AdminDirectory.tsx`, admin API routes, repository mutation boundary, canonical entity links.

Steps:

1. Split admin into Records, People, Teams & Agencies, Workflows, and Audit.
2. In Inspect, render known relationships as canonical links. Keep raw JSON in a collapsed technical section.
3. Add typed Edit forms for project, workstream, task, customer request, RFI metadata/state where appropriate, person/profile, organization, assignment group, assignment, active/visibility, and document metadata. Do not expose arbitrary SQL/JSON mutation.
4. Live-state corrections require a reason, validation, audit event, and resulting-state receipt. Published workflow definitions and audit entries stay read only.
5. Fix people/profile hydration before interpreting zero visible profiles as no data. Assignment dropdowns show canonical names once, never repeated UUIDs.
6. Separate sign-in eligibility, organization role, project participation, group membership, active status, and visibility controls.
7. At 390px render record cards or a responsive definition list rather than narrow multi-column tables.

Focused tests: extend `tests/basic-admin-portal.test.mjs` and `tests/admin-catalog.test.mjs` for authorization, validation, persistence, audit, relationship navigation, empty/error states, and mobile structure.

Gate:

- Admin follows workstream → person → group → project, edits assignment/status with a reason, refreshes, and sees the same state in My Work and project views.
- Non-admin cannot access the editor or invoke its mutation.

Commit: `feat: connect admin records and audited editors`

## Checkpoint 9 — complete the workflow designer

Goal: build on the existing Supabase draft/validate/publish path to define future work safely.

Primary files: `components/cockpits/WorkflowDesignerPanel.tsx`, `TicketWorkflowEditor.tsx`, workflow engine/domain models, existing workflow RPC migrations.

Steps:

1. Keep live instance editing labeled “This work item.” Keep template authoring under Workflows.
2. Replace fixed v4/v5 text with values from the selected template/version.
3. Allow draft creation/resume; add/remove/reorder stages and tasks; configure owning agency/group, default assignment, duration/SLA, dependencies, parallelism, required documents/data, RFI/customer-response behavior, hold behavior, completion criteria, and permitted transitions.
4. Save each change to the draft. Reopening the page must reconstruct the same draft.
5. Validate unreachable stages, cycles where prohibited, missing owners, invalid transitions, impossible requirements, missing duration/statutory constraints, and references to inactive records.
6. Before publish, show a readable change preview and explain that existing work remains pinned. Publish atomically and audit it.
7. Create a new workstream from the new version and prove old work/history stayed unchanged. Any live-version migration is a separate explicit audited feature.
8. Start with an ordered process list and expandable settings. Defer a graphical canvas until usability evidence requires it.

Gate:

- Save/reopen draft, observe validation failure, correct it, publish, create new work on the new version, and verify an existing instance remains pinned.

Commit: `feat: complete versioned workflow authoring`

## Checkpoint 10 — visual, responsive, and language pass

Goal: make PATH calm, familiar, accessible, and pleasant after behavior is trustworthy.

Primary files: shared shell/record/inbox components and `app/globals.css`.

Steps:

1. Keep navy/teal identity; reduce heavy type, uppercase micro-labels, nested borders, repeated cards, and simultaneous status colors.
2. Reserve red/amber for real attention. Never rely on color alone.
3. Add modest feedback: checkmarks for recorded completion, concise receipts such as “Response sent — Jordan is next,” useful empty states, skeletons, and retry states.
4. Respect reduced motion. Preserve focus visibility, 44px touch targets, readable contrast, and logical heading order.
5. At 390px verify short shell title, visible identity/profile, navigation drawer, stacked record header/actions, mobile record cards, and schedule list.
6. Do not add a first-use guide or replacement welcome panel. The former guide requirement is superseded by the R3 shell contract; keep controls discoverable through stable navigation, labels, focus states, and record-level next-action copy.

Gate:

- Keyboard-only and touch walkthroughs complete the primary customer, staff, and admin stories.
- No clipped primary actions, body-width overflow, lost focus, or unexplained icon-only controls.

Commit: `style: finish accessible PATH usability pass`

## Final release gate

Do not release based only on rendered buttons, unit tests, or successful RPC responses. All of the following must pass:

1. `node --test --test-concurrency=1 tests/*.test.mjs`
2. ESLint command above.
3. `npx vinext build`, followed explicitly by `node scripts/scan-build-secrets.mjs`; a direct build does not invoke the npm postbuild lifecycle.
4. Supabase migration list matches local/remote expectations; dry-run push is clean when migrations changed.
5. RLS isolation checks when auth, policies, views, RPCs, storage, or user data changed.
6. Primary staff story: clarification/RFI → customer response → acceptance → resume → complete → project/schedule update.
7. Team story: available team work → claim/reassign → block → notification → project risk → unblock → continue, including stale-tab collision.
8. Admin story: inspect → linked entity → audited edit → operational view reflects update.
9. Workflow story: saved draft → validation → publish → new instance uses new version → old instance unchanged.
10. Exact document-version story: upload → metadata → signed URL → HTTP fetch → byte length/SHA-256 → review/response references same version.
11. Desktop and 390px checks in Chrome and one other supported browser: refresh, copied deep links, Back/Forward, focus, keyboard, and touch.
12. Production deployment reports the intended full SHA. Smoke-test the deployed URL. Local and `origin/main` full SHAs match and the worktree is clean.

## Guidance when a packet reveals a larger problem

- Stop at the first broken boundary and document the evidence. Fix that boundary within the packet if it owns the problem.
- If the fix requires another checkpoint's foundation, do not add a local workaround. Move the dependency earlier and update this runbook in the same planning commit.
- If data appears duplicated, first compare canonical IDs, organization codes, memberships, references, and audit history. Never merge or delete records by similar display name alone.
- If state columns disagree, define precedence and compatibility behavior before migrating data. Preserve auditability and rollback paths.
- If a mutation returns success but refreshed state disagrees, treat it as failure and trace UI → command/RPC → database → hydration → projection → UI.

## Suggested implementation order for Luna tasks

Assign one checkpoint per task. Checkpoints 1 and 2 may each be divided into one model task for data/domain work and one for UI/tests, but the checkpoint gate remains indivisible. Do not run checkpoints 3–10 in parallel because each consumes the contracts established earlier. A task prompt should quote the packet, name the expected commit, and instruct the model to continue until its gate passes, then push and report full-SHA equality.
