# PATH: reviewed development backlog

Review date: 2026-09-07. Baseline: `6e83dbac20b5e5931939abd7b15856c28b77b483`.

## Scope and evidence

The initial review was read-only; the follow-up seed checkpoint adds only the tagged, non-destructive scenario script and its contract test. Git fetch confirmed HEAD and origin/main had zero divergence before this checkpoint. The live https://permit-tracker-iota.vercel.app/ sign-in page displays the same commit and production environment. The scenario seed does not create auth users, delete rows, or fabricate Storage bytes.

Reviewed the original conversation's T00–T15 goals, `PATH_UX_LUNA_IMPLEMENTATION_PLAN.md`, `workflow-clarity-progress.md`, and the customer submission, triage, navigation, catalog, modal and repository paths. This is a targeted review, not an exhaustive security audit. The signed-in workspace and mobile viewports were not freshly exercised. Previous test and database results below are historical evidence, not tests rerun today.

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
| T12 | Partially implemented, not complete: editable agency/title/workflow fan-out exists; team/person/date, clarification and link-existing options remain. |
| T13 | Honest dates and parallel-stage improvements implemented; full shared stage/history/hold reconciliation open. |
| T14 | Responsive source changes implemented; accessible dialogs, navigation and rendered viewport acceptance remain. |
| T15 | Historical suite: 361 passed, zero failed, 26 skipped. Live browser and authenticated integration acceptance remain. |

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

### S2 — Finish deliberate intake routing (T12)

Evidence: `components/path/intake/TriageRoutingDialog.tsx` and `lib/repository.ts::triageCustomerRequestPersisted` expose agency code/name, title and workflow version, but not team, assignee or target date. Agency fields are free text. New row codes derive from current row count, so remove/add can repeat codes. Confirmation has no pending-state guard in this component.

Tasks:
- Use persisted agency/team/member selectors with eligibility checks.
- Add intentional target date and compatible published workflow selection.
- Add clarification and link-existing-work alternatives, maintaining request identity across all linked workstreams.
- Use stable row identity and validated unique workstream codes.
- Add pending state, field errors and a final readable routing preview.
- Prove concurrent and repeated confirmation are duplicate-safe at the server, not only via the UI guard.

Acceptance: route one request to three teams; remove/add a row; reject invalid agency/member/workflow combinations; double-submit concurrently; confirm exactly three linked workstreams and actual assignments after fresh login. Clarification and link-existing paths must not create unwanted work.

### S3 — Accessible interactions and runtime stability (T14)

Live evidence: sign-in page console emitted application-origin minified React error #418 on this visit. Diagnose the exact cause; do not assume its source. A separate extension-origin console error is excluded from application findings. Footer renders `Committed: unknown` despite showing the correct SHA.

Code evidence: triage and action dialogs use hand-written `role=dialog` overlays; full focus behavior needs verification. Shell sign-out text is hidden at mobile widths without an explicit aria-label on the button. Mobile menu lacks expanded/control state. Shared toast always uses green success styling and a check icon even when populated with failure messages.

Tasks:
- Reproduce and fix the React mismatch/error; add a clean-console public-page smoke test.
- Adopt the existing accessible dialog primitive or implement focus containment, Escape, initial focus and focus restoration explicitly.
- Add accurate mobile menu and sign-out accessible semantics.
- Give success, warning, partial-success and error feedback distinct semantics and recovery actions.
- Verify all major screens at 390/768/1440px and 200% zoom, including on-screen-keyboard forms, long names and nested schedule scrolling.
- Make build metadata deterministic across server/client and identify unknown timestamps honestly.

Acceptance: keyboard-only open/edit/cancel/confirm, focus restored, no background focus escape, screen-reader control names present, no unreachable mobile controls, and no application-origin error on reload.

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

Recommended next implementation sprint: S2 — finish deliberate intake routing. Run S5 acceptance incrementally with each affected workflow, not only at the end. S3 follows the routing slice for accessible/error-state verification; S4 follows core correctness; S6 is targeted completeness, and S7 runs throughout.

The next logical end-to-end journey is: Alex submits two different permit requests (one with an optional attachment), refreshes after the receipt, and confirms each request keeps its own permit identity and no workstream is guessed; Sarah opens the intake queue, edits agency/team/member/workflow routing, previews the fan-out, confirms exactly the intended workstreams, and Jordan/Sam read back their respective queues after a fresh sign-in. A failed routing confirmation must be retryable without duplicate workstreams.

Keep Supabase authoritative, preserve immutable documents and identifiers, do not weaken RLS/auth or rewrite historical migrations, use forward repairs only after reproduced failures and approval. Commit coherent changes with relevant tests. At each sprint end report evidence, unresolved items and the next logical end-to-end sprint; await Joe's go before starting it.

The scenario seed is source-complete and designed for live read-back; its connected execution is recorded above and its cross-user browser acceptance remains open. S1 now adds a live request-linked filing/RPC read-back, while the browser attachment-byte boundary remains open. Supabase advisors still report pre-existing authenticated SECURITY DEFINER and permissive-policy warnings; the new RPC follows the same reviewed application transaction boundary with a fixed `search_path` and no anonymous execution. Signed-in/mobile browser review remains a clearly open acceptance item rather than an assumed pass.
