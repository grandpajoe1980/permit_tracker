# PATH UX implementation runbook

Audience: smaller implementation models working one checkpoint at a time.  
Companion evidence: `docs/UX_SIMPLIFICATION_PLAN.md`.  
Rule: do not restart the architecture. Preserve the domain model, audited mutations, Supabase persistence, private document storage, and versioned workflow concepts.

## Current completion ledger — 2026-09-09

This ledger supplements CP0–CP10 and is the active status record for the PATH UX completion plan. Historical test counts and prior completion notes are not release evidence.

| Repair packet | Status | Evidence required before Verified |
|---|---|---|
| R1 — authenticated identity and request updates | Verified | Chromium and Firefox authenticated customer → non-admin staff clarification → customer response/read-back; submitter preserved, staff actor/audit/notification persisted, and wrong-submitter RPC rejected |
| R2 — authoritative assignment and Take Ownership | Implemented—unverified | Two authenticated workers claiming one record, persisted conflict result, assignment/audit/notification/queue read-back |
| R3 — shell and navigation | Implemented—unverified | Chromium and Firefox desktop/390px smoke checks pass; complete Back/Forward/focus/keyboard/touch/200% walkthrough and deployed long-content scroll proof remain |
| R4 — real-stage schedule | Implemented—unverified | Stage-run hydration, alignment/Today/readability, canonical workstream/phase/task destinations, deep-link anchor restoration, unscheduled/parallel cases, and idempotent demo-seed read-back; persisted block/unblock and full responsive proof remain |
| CP0–CP10 remaining gates | Open | Exercise each gate with authenticated persisted evidence; do not infer completion from source or fixture tests |
| R0 — baseline and evidence ledger | Verified | Linked project, current Git/deployment identity, tagged personas, migration parity, and test/browser environments recorded below; no unresolved migration ambiguity remains |
| Supabase migration consistency | Verified | `npx supabase migration list --linked` reports all 57 local/remote versions equal through `20260909021937`; linked `db push --dry-run` reports `upToDate: true` with no pending migrations, seeds, or roles |

### Evidence recorded during the current implementation wave

- Source and focused behavior: the identity-safe claim, staff-operator intake, assignment-label, stage-run hydration, shell, canonical schedule-link, phase-deep-link, RFI response projection, and footer-health tests pass. The final serial full suite completed with **452 tests, 444 passed, 8 skipped, 0 failed**. Skips remain unaccepted environment-gated cases.
- Release checks: final `npx vinext build`, full ESLint command, and explicit `node scripts/scan-build-secrets.mjs` all pass. ESLint reports warnings only; the build reports non-blocking large-chunk warnings.
- Live Supabase: project `zomzacaxwqfwjstkxbpv` contains the claim RPC and staff-operator boundary. The current wave also verified a customer request persisted for a different agency persona, a linked RFI created with a canonical organization ID, and customer response authorization through the project’s customer organization. A tagged RFI response was accepted after fresh read-back while unrelated holds remained active.
- R1 authenticated identity evidence: commits `bf33aaa`, `bb27dbb`, `8e096d0`, `e18b9c0`, and `8ba0d32` are deployed. Fresh Chromium and Firefox Playwright runs passed `tests/e2e/supabase-persistence.spec.ts --grep "Scenario 3"`; representative persisted records include `customer-request-c3a14bb7-2c2c-468a-9d1e-e1ebb53946f9` / `PATH-2026-68EC69ED`, with the original submitter `50e34731-7c7e-4205-b2d7-7976db33e333` and Sarah’s triage actor `031dc622-0885-42bb-9c84-1f9b6cb18a1d`. Direct RPC read-back confirmed the response, audit actor, and triage notification. A separate authenticated Alex probe against another submitter’s pending request was rejected with `only the original submitter can respond to this clarification`.
- R2 collision evidence (RPC boundary, not yet browser-verified): two independently authenticated eligible members, Maya Chen and Gwynne Shotwell, claimed task `task-6cd5d799-3016-4ea9-a1d0-8ef8b8eea61d` concurrently. Exactly one returned `claimed`, the other returned `conflict` naming Gwynne, persisted read-back matched Gwynne, and a `ticket_claimed` audit row identified Gwynne. The task assignment was restored to its original unassigned state after the probe; notification/queue and browser proof remain open.
- Live demo workflow: the tagged demo workstreams retain five distinct stages in the published workflow. `stage_runs` hydration is wired and preserves unavailable history rather than inventing completion dates.
- Migration reconciliation: the genuinely remote-only SQL statements were recovered from `supabase_migrations.schema_migrations`; locally mis-timestamped files were aligned to genuine applied versions. Normalized statement hashes match the live records. The linked migration list now reports **57/57 local/remote matches through `20260909021937`**, and the linked dry-run is clean.
- Git synchronization: the current source checkpoint is `8ba0d32b1156c10d2a392fd924c7011b2a7568de`, with matching local `main`/`origin/main` full SHAs and a clean worktree at ledger update time. This is branch synchronization evidence, not a verified tagged-release claim.
- Deployment and production smoke: `https://permit-tracker-iota.vercel.app/api/health` reports status `ok`, environment `production`, and deployed commit `8ba0d32`. Chromium and Firefox Playwright runs each pass the fresh R1 customer/staff persistence scenario against production. The guide is absent and the shell/footer health behavior is covered by browser and source tests.
- Still open: a browser-level two-worker Take Ownership flow with queue refresh and notification expectations; complete customer/staff/admin browser journey coverage; persisted schedule block/unblock and full alignment/Today/unscheduled/parallel proof; exact document-version browser byte verification; coordination-clearance and workflow-version browser stories; full keyboard/touch/Back/Forward/focus/zoom walkthrough; deployed smoke against this documentation checkpoint; and two consecutive final user-story/consistency review passes. No release acceptance claim is made from source, RPC, or partial live evidence alone.

The guide requirement formerly listed under CP10 is superseded by R3. PATH must not ship a replacement welcome panel or replay control.

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
