# PATH: reviewed development backlog

Review date: 2026-09-07. Baseline: `6e83dbac20b5e5931939abd7b15856c28b77b483`.

## Scope and evidence

The initial review was read-only; the follow-up seed checkpoint adds only the tagged, non-destructive scenario script and its contract test. Git fetch confirmed HEAD and origin/main had zero divergence before this checkpoint. The live https://permit-tracker-iota.vercel.app/ sign-in page displays the same commit and production environment. The scenario seed does not create auth users, delete rows, or fabricate Storage bytes.

Reviewed the original conversation's T00–T15 goals, `PATH_UX_LUNA_IMPLEMENTATION_PLAN.md`, `workflow-clarity-progress.md`, and the customer submission, triage, navigation, catalog, modal and repository paths. This is a targeted review, not an exhaustive security audit. S3 implementation checks were rerun on the synced checkout; rendered signed-in browser and mobile viewport evidence remains blocked by the local browser runtime.

## Assessment

Preserve the substantial improvements: record-specific completion, explicit RFI handoffs, persisted coordination, canonical routes, customer Home/search/receipts, editable fan-out, parallel stage display, honest missing dates, and server-backed assignment. The project has a useful foundation, but “all remaining work is verification” is too optimistic.

Use four distinct statuses: implemented, behavior-verified, browser-verified, and blocked. A source-text assertion or passing build cannot alone close a workflow milestone.

| Original task | Revised assessment |
| --- | --- |
| T00 | Baseline recovered; status documentation needs consolidation. |
| T01 / T10 | Canonical routes implemented; navigation consolidation and browser recovery acceptance remain. |
| T02–T05 | Major correctness and clarity improvements implemented; retain behavior regression coverage. |
| T06 | Admin-only design improvements implemented; audit all administration entry points before calling permissions complete. |
| T07 | Text response/acceptance has historical database proof; non-empty attachment and revision/recovery journey open. |
| T08 | Historical response and explicit dependency-clear proof exists; receiving-user browser/notification acceptance open. |
| T09 | Persisted assignment selectors implemented; full recipient, help/escalation and authorization matrix open. |
| T11 | Home/search/receipt implemented; incorrect linkage and external-filing recovery need development. |
| T12 | Implemented and live-probe verified: persisted agency/team/member/workflow/date routing, clarification, link-existing work, stable rows, validation and retry protection are in place; browser cross-user acceptance remains. |
| T13 | Honest dates and parallel-stage improvements implemented; full shared stage/history/hold reconciliation open. |
| T14 | Accessibility/runtime implementation is complete for the reviewed shell, dialogs, feedback, and narrow-screen layout; rendered keyboard/viewport acceptance remains blocked by the local browser runtime. |
| T15 | Current suite: 395 discovered, 369 passed, zero failed, 26 explicitly skipped for missing local Supabase credentials. Live browser and authenticated integration acceptance remain. |

## Findings and recommended sprints

### Seed checkpoint — 2026-09-07

The connected Supabase demo project now has a repeatable scenario set from `supabase/demo-scenarios.sql`. The same DML was executed twice and read back successfully; the second run did not increase the tagged counts.

| Tagged record | Count | Coverage |
| --- | ---: | --- |
| Workstreams | 4 | waiting applicant, blocked dependency, parallel active review, complete closeout |
| Tasks / dependencies | 6 / 2 | completed, pending customer, blocked, active, submitted |
| Customer requests | 5 | unlinked intake, routed active, RFI waiting, coordination blocked, resolved |
| RFIs / responses | 3 / 2 | issued, submitted for review, accepted |
| Coordination requests | 3 | pending, response recorded but unresolved, concurred/resolved |
| Filing / notifications / audit events | 1 / 3 / 4 | explicit unsent filing, recipient-linked notices, lifecycle evidence |

The seed references an existing document version only when it has non-zero bytes and a hash. No qualifying version was present during this run, so attachment arrays remain empty and the scenarios are explicitly attachment-ready rather than pretending that a Storage object exists. Local lint, build/security scan, and the focused source-contract suite pass.

### S1 — Request identity and recoverable submission (completed implementation; T11/T12)

Implemented and live-verified on 2026-09-07:

- Removed the CPRA/ wetlands workstream fallback from customer submission and draft paths. External filings remain unlinked until intake routing supplies a real workstream.
- Added `external_filings.customer_request_id`, made `workstream_id` nullable for pre-routing filings, and added a request/permit uniqueness index.
- Replaced the direct external-filings insert with authenticated `rpc_create_external_filing`, which validates project/request/workstream scope, records the authenticated actor, writes its audit event, and returns the canonical row.
- Reused a stable request ID and confirmation number from browser recovery metadata. The existing customer-request RPC remains the authoritative request idempotency boundary.
- Added deterministic filing IDs, a duplicate-submit guard, a reload-safe partial-success receipt, and a retry action that only repeats filing tracking.
- Stopped inventing today as a filing submission date; blank dates remain blank, while the database records a separate verification timestamp only when a status is explicitly recorded.

Evidence:

- Forward migration `20260907132000_customer_request_filing_recovery` is applied to project `zomzacaxwqfwjstkxbpv`; read-back confirms both new indexes, nullable workstream identity, migration ledger entry, and `anon_execute=false` / `authenticated_execute=true` for the RPC.
- Auth-context rollback probe succeeded with Joe Skaggs's system-admin identity: a request-linked filing was returned with `workstream_id = null`, actor linkage, audit insertion, and no committed probe row.
- A second rollback probe called the same filing twice and read back exactly one row inside the transaction, proving the idempotency boundary without leaving demo data.
- `npm test`: 394 total, 368 passed, 0 failed, 26 explicitly skipped because local Supabase URL/key credentials are unavailable. Lint, production build, and secret scan pass.

Remaining S1 acceptance boundary: a browser file chooser in this environment still cannot transfer non-empty bytes, so the attachment-byte portion remains part of S5. The request/filing persistence boundary itself is complete.

### S2 — Finish deliberate intake routing (T12) — completed implementation

Implemented in the application and live Supabase project:

- The routing dialog now selects persisted agencies, assignment groups and eligible members rather than accepting free-text ownership.
- Every route requires a published workflow and an intentional target date; the RPC writes those dates to the existing task/workstream schedule fields without inventing a deadline.
- Stable row keys, unique-code validation, disabled pending states and server-side duplicate protection cover remove/add and repeated confirmation.
- Coordinators can ask for clarification or link a request to existing project work; neither alternative creates a new workstream.
- The forward migration validates project-admin authorization, agency/team compatibility, membership eligibility, published workflow state, request state and project scope. It grants execution only to authenticated callers and uses a fixed search path.

Evidence:

- Migration `deliberate_intake_routing` is applied to project `zomzacaxwqfwjstkxbpv`; the live read-back shows anonymous/public execution denied and authenticated execution allowed for the three intended RPCs.
- Rollback-safe live probes rejected an invalid team, an ineligible member and duplicate workstream codes. A valid route created one workstream and a second confirmation returned the original IDs with `idempotent=true`; the transaction was rolled back.
- Separate rollback-safe probes read back `pending_customer` plus audit/notification for clarification, and `in_progress` plus the existing workstream, audit and notification for link-existing. The tagged request remained `submitted` and unlinked after rollback.
- Focused source contracts pass (23/23), lint passes, production build and secret scan pass. Full local Node discovery reports 370 passed, 3 credential-dependent failures and 26 explicit skips; the failures are the existing scripts that require local Supabase environment variables.

Remaining S2 acceptance: complete the same route/clarification/link flows in two fresh browser sessions and read back the personal/team queues as the actual assigned users. This is an evidence boundary, not an implementation gap.

### S3 — Accessible interactions and runtime stability (T14) — implementation complete

Implemented on the synced checkout:

- Added a shared dialog-focus hook used by work actions, intake routing, and document preview. It captures the opener, moves focus into the dialog, traps Tab, closes on Escape, and restores focus after close.
- Added `aria-expanded`, `aria-controls`, `aria-current`, an explicit mobile navigation ID, and a mobile sign-out label. Escape and navigation both return focus to the menu control.
- Corrected the mobile drawer's fixed position for the road-stripe offset and retained narrow-screen scrolling rather than clipping controls.
- Replaced the always-green toast with success, warning, info, and alert semantics, including appropriate live-region behavior.
- Closed the no-Supabase hydration cleanup gap so the scheduled hydration frame is cancelled on the early-return path.

Evidence:

- `npm run lint -- --quiet`: pass.
- `npm test`: 395 discovered, 369 passed, 0 failed, 26 explicitly skipped for unavailable local Supabase credentials. Build and artifact secret scan pass as part of the command.
- Loopback HTTP smoke check returned the real login shell with status 200 and no server-side error text.
- Playwright browser launch is blocked because no system browser or `agent-browser` executable is installed; the Playwright Chromium download timed out/returned 502 from its CDN. A rendered 390/768/1440px screenshot, keyboard journey, and browser-console confirmation therefore remain evidence gaps. The footer's `Committed: unknown` in the unauthenticated local shell also remains a separate metadata follow-up.

S3 is an implementation-complete checkpoint, not a claim of browser acceptance. Keep the browser boundary open until a browser-capable environment can verify focus restoration, 200% zoom, on-screen keyboards, long labels, nested schedule scrolling, and any application-origin console error on reload.

### S4 — Navigation and one coherent work story (T10/T13)

Evidence: `lib/navigation.ts` has centralized definitions, but `app/page.tsx` still hand-renders Schedule, Document Vault and Permit Catalog under “Secondary tools.” Definitions also include both contacts and help with the same label. Canonical routes exist; this is consolidation, not another routing rewrite.

Tasks:
- Put Schedule and project documents visibly within Project context; eliminate duplicate destination definitions and labels.
- Preserve exact record, filter, tab and return position across entry points.
- Compare queue/detail/project/mini-stepper/Gantt against one shared authoritative stage/owner/hold projection.
- Preserve concurrent active stages and actual completion history; expose unknown dependency/date information without inventing impact.

Acceptance: open one workstream from queue, project, notification and copied URL; refresh/back/forward/auth recovery returns to the same record. Complete a tagged stage separately in a future authorized verification sprint and confirm all views agree, including parallel work and mobile schedule.

### S5 — Documents, RFI, coordination and assignment acceptance (T07–T09/T15)

Tasks:
- Upload real non-empty bytes; verify immutable version ID, size/hash, authorized download and response linkage.
- Exercise reviewer clarification, revised response, acceptance and notification delivery after fresh login.
- Exercise coordination response independently from dependency clearance.
- Transfer to an eligible recipient; verify personal/team queues, prior owner view, audit actor and actual notification recipient.
- Prove help/escalation preserve assignment and reach configured recipients, or explicitly report undelivered state.
- Test wrong-project access, unauthorized writes, expired session, upload failure and repeated submission.

Acceptance: independent customer/reviewer/recipient contexts, persisted read-back, audit and notification assertions for every mutation. Prior SQL actor-context probes are not substitutes for real browser sessions. Keep tagged demo records identifiable; do not mutate unrelated records.

### S6 — Catalog and administration completeness (original follow-ups)

Evidence: `PermitCatalogPanel.tsx` already supplies resources, instructions, checklist and Start this request. Missing resources fall back to `app/demo-resources/[permitCode]/page.tsx`, which is explicitly fictional and generic. The catalog sometimes labels a page link as a download and styles verification statuses uniformly green.

Tasks:
- Preserve existing catalog work; classify official resource, internal demo guide, unavailable resource and actual file download distinctly.
- Record provenance/review date for authoritative resources and avoid a verified visual treatment for unverified statuses.
- Check all administration access paths for workflow templates, agency registry, users, memberships and record inspection, including server enforcement.
- Inventory seed personas/scenarios before expanding them; add only missing lifecycle coverage with repeatable, idempotent seeds. The new `npm run supabase:seed:scenarios` checkpoint adds tagged intake, active, RFI, coordination, completion, parallel-stage, notification, audit, and unsent-filing scenarios without destructive cleanup.

Acceptance: catalog → correct resource → request with correct permit identity, no misleading download claim; unauthorized admin routes/API operations denied; seed rerun produces no duplicates. Official permit-content research is a separate future task, not validated by this code review.

### S7 — Maintainability and release gate (T00/T15)

Evidence: `app/page.tsx` is 1,974 lines with dense inline render functions; repository is 2,456 lines. Source-contract tests directly inspect source text. The progress table duplicates T13 and still cites resolved port-collision and credential blockers in places where later entries supersede them.

Tasks:
- Extract request submission, routing, dialogs and shell navigation incrementally behind behavior tests; no broad rewrite.
- Retain useful source contracts but prioritize user-visible behavior and database assertions.
- Separate offline and integration test commands. Missing required integration configuration must fail the release gate, not silently count as acceptance.
- Consolidate task status into one evidence-linked table; keep historical checkpoints as history.
- Use GitHub main → existing Vercel project as the deployment path; verify SHA, build status and smoke tests. Avoid duplicate manual API deployments.

Acceptance: no unclassified skipped release checks, current deployment SHA matches approved source, scenario results and viewport evidence recorded, known issues explicitly accepted rather than marked complete.

## Working order and guardrails

Recommended next implementation sprint: S4 — navigation and one coherent work story. Run S5 acceptance incrementally with each affected workflow, not only at the end. S6 is targeted completeness, and S7 runs throughout.

The next logical end-to-end journey is: Alex submits two different permit requests (one with an optional attachment), refreshes after the receipt, and confirms each request keeps its own permit identity and no workstream is guessed; Sarah opens the intake queue, edits agency/team/member/workflow routing, previews the fan-out, confirms exactly the intended workstreams, and Jordan/Sam read back their respective queues after a fresh sign-in. A failed routing confirmation must be retryable without duplicate workstreams.

Keep Supabase authoritative, preserve immutable documents and identifiers, do not weaken RLS/auth or rewrite historical migrations, use forward repairs only after reproduced failures and approval. Commit coherent changes with relevant tests. At each sprint end report evidence, unresolved items and the next logical end-to-end sprint; await Joe's go before starting it.

The scenario seed is source-complete and designed for live read-back; its connected execution is recorded above and its cross-user browser acceptance remains open. S1 adds a live request-linked filing/RPC read-back, while the browser attachment-byte boundary remains open. Supabase advisors still report pre-existing authenticated SECURITY DEFINER and permissive-policy warnings; the S2 RPCs follow the reviewed application transaction boundary with a fixed `search_path` and no anonymous execution. S3 closes the accessibility/runtime implementation slice, while signed-in/mobile browser review remains a clearly open acceptance item rather than an assumed pass.
