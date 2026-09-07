# Workflow clarity sprint

Starting revision: `928926a089599181c6bd08ffc72069e314c01c92`

## Status

| Task | Status | Notes |
| --- | --- | --- |
| T00 | verified | Fresh main verified at `928926a`; baseline review completed; lint/build blocked because dependencies are not installed in the checkout. |
| T01 | verified | Project workstream cards now stay in the authenticated in-app workspace; build passes. Standalone deep-link auth remains an external/browser verification item. |
| T02 | verified | Shared RFI projection no longer calls an issued/no-response RFI “Response received”; customer submissions leave action counts. |
| T03 | verified | Task, commitment, customer-request, and workflow completion dispatch explicitly; advance-stage aliases validated stage completion; coordination status action removed. |
| T04 | verified | Sidebar action count derives from the same grouped queue bucket; intake visibility cap removed. |
| T05 | verified | Removed duplicate outer action/facts/activity wrapper; detail page remains the single work-summary surface. |
| T06 | verified | Operational workflow editor no longer invents fallback stages or advertises local stage edits as persisted; process design is admin-only. |
| T07 | in_progress | RFI response dialog now accepts an optional file and attempts to persist it as an immutable version linked to the response. Cross-user live proof remains required. |
| T08 | in_progress | Added a persisted coordination response path with audit, explicit “respond to agency” action, and no automatic dependency resolution. |
| T09 | verified | Transfer dialog now requires an active persisted team, offers eligible members, and calls the canonical ticket-assignment mutation for workstreams, tasks, and customer requests. Help/consultation requests keep the current assignment. Full recipient/authorization proof remains an external check. |
| T10 | verified | Added canonical `/work/:kind/:id` authentication handoff, shell detail/request restoration, secondary-tool URL state, notification path resolution, and an actual unread count in primary navigation. Browser auth and cross-session route proof remains an external check. |
| T12 | verified | Intake queue is searchable, excludes drafts/terminal records, and opens an editable routing review with agency/title/workflow-version rows, add/remove workstreams, confirmation, and duplicate guards before the atomic fan-out RPC. Live Supabase read-back remains environment-blocked. |
| T13 | in_progress | Gantt avoids invented impact figures and shows current owner; mini-stepper now preserves multiple active parallel stages and Project Overview handles unscheduled forecasts safely. Full stage/history reconciliation remains. |
| T13 | in_progress | Removed invented customer-request due dates and document-review due dates; missing dates now display as unscheduled. |
| T14 | implemented; browser evidence open | Removed the unverified persistence-health badge, improved narrow-screen overflow behavior, added accessible schedule-row labels, clarified customer search controls, and completed the mobile shell/dialog/runtime pass. Shared dialog focus trapping, Escape/focus restoration, mobile menu semantics, corrected drawer offset, and honest toast live regions are now implemented. Rendered viewport/keyboard verification remains blocked by the local browser runtime. |
| T11 | in_progress | Customer Home has direct View My Requests and a post-submit receipt card with confirmation number, assignment status, and Open request. S1 now preserves one request identity across partial external-filing failure and reload; full attachment-byte/cross-user proof remains. |
| T15 | in_progress | Final offline regression contracts, live tagged-record read-back, and the S1 filing RPC probe are verified. Current `npm test` completes with 395 discovered, 369 passed, 0 failed, and 26 explicit Supabase-credential skips. Full authenticated browser acceptance remains open. |

## Confirmed baseline findings

- Reviewer queue badge/count can disagree.
- RFI ownership and response state can contradict each other.
- Customer request flow places upload before request selection and has plain-text tracking rows.
- Project/workstream deep links can render `Sign in required` after an authenticated in-app navigation.
- Action dispatch can complete a parent stage for record types that require record-specific completion.
- Workflow designer stage edits are local-only while displaying success.
- Project, mini-stepper, Gantt, and detail views can disagree on stage/hold information.

## Checkpoint policy

For each task: reproduce, patch minimally, run focused tests/build/lint as appropriate, inspect diff, update this file, and commit. Live database writes require isolated records and read-back verification.

## Verification notes

- `npm run lint` completed with warning-only findings; no lint errors.
- `npm run build` completed, including the build secret scan.
- Focused queue/RFI/navigation/commitment tests pass. The project-navigation assertion was updated to cover the focused in-app workspace rather than a stale standalone-link contract.
- Supabase mutation tests require configured test credentials and were not run against shared data. Navigation checkpoint is pushed to `main` at `6c5aa855b30552111988b158427e8bd01832ce96` (GitHub contents commits); local implementation checkpoint is `f38af62c0b648b105388f95fedf298ec19a661ae`.

## Live Supabase verification — 2026-09-07

- Linked project: `zomzacaxwqfwjstkxbpv` (demo project). A development branch was not available on the current plan, so the approved demo project was used with uniquely tagged records only.
- Applied and recorded forward migration `20260907120213_repair_customer_triage_columns`: adds the columns required by the deployed atomic triage RPC (`customer_requests.triaged_at`, `triaged_by_user_id`, `triage_notes`, `triaged_workstream_ids`, and `workstreams.customer_request_id`) plus its lookup index.
- Applied and recorded forward migration `20260907120931_sync_customer_triage_state`: when a request is triaged, the trigger aligns `itsm_state` to `triaged`. `20260907121335_lock_down_triage_trigger_function` revokes API execute access from the trigger-only helper.
- Persisted demo journey `PATH-2026-E2E-A9F4` (`customer-request-e2e-20260907-a9f4`) and triaged it into `E2E-A9F4-USACE`, `E2E-A9F4-LDEQ`, and `E2E-A9F4-STATEPO`. Read-back confirmed `status=in_progress`, `itsm_state=triaged`, three canonical workstream IDs, pinned request workflow stages, and `customer_request_id` links.
- Assigned those workstreams through `rpc_assign_ticket` to the exact persisted groups `USACE - Federal Water and Wetlands Review`, `LDEQ - Air Quality & Environmental Review`, and `Governor's Project Office - Executive Triage & Delivery`; read-back confirmed group IDs, agency codes, three assignment audit events, the request audit trail, and the intake notification.
- Transactional triage and trigger probes passed without leaving additional records. Security advisor no longer reports the trigger helper; pre-existing SECURITY DEFINER and performance policy advisories remain unchanged and require a separate security/performance sprint.
- Remaining unverified scope: browser-authenticated cross-user journeys, file upload/RFI/coordination mutations, and mobile visual checks. No unrelated production business records were changed; the only persisted business rows created for validation are the explicitly tagged demo records above.

## Live external-filing recovery verification — 2026-09-07

- Applied forward migration `20260907132000_customer_request_filing_recovery` to the connected demo project. Read-back confirms `external_filings.customer_request_id`, nullable `workstream_id`, request/permit uniqueness, and the migration ledger entry.
- The new `rpc_create_external_filing` is `search_path`-hardened, callable by `authenticated`, denied to `anon`, and owns the filing audit insert because the direct table insert is intentionally denied by the RLS boundary.
- With Joe Skaggs's system-admin identity placed in the transaction JWT context, a request-linked filing with no workstream returned the canonical row and actor identity; the transaction was rolled back, so no probe record remained.
- A second rollback probe invoked the same deterministic filing ID twice and read exactly one row inside the transaction. This proves retry idempotency without changing demo data.
- Local `npm test` now completes 394 tests with 368 passing, 0 failing, and 26 explicitly skipped for unavailable local Supabase credentials; lint, production build, and the build secret scan pass.

## Live RFI and coordination verification — 2026-09-07

- RFI demo `RFI-E2E-A9F4` was issued by the project office to `SPACEPORT`, responded to by the Alex Martin demo identity, and accepted by the authorized project-office identity. Read-back confirmed `issued → submitted_by_applicant → accepted`, response `under_review → accepted`, the linked workstream hold cleared, and three corresponding audit events.
- Coordination demo `CR-E2E-A9F4` was created from `E2E-A9F4-LDEQ` targeting CPRA. The workstream was placed in `waiting_government`; recording a `concurred` response left that wait intact; only the explicit blocker-clear operation resumed the workstream. Read-back confirmed the coordination response plus `coordination_request_created`, `workstream_blocked`, `coordination_response_recorded`, and `workstream_resumed` audit events.
- The approved global RFI trigger migration is now applied as `20260907123535_rfi_team_notifications_and_actor`. It captures the authenticated response submitter, notifies configured active members of the recipient/requesting agency teams, notifies the actual responder when a response is accepted, and revokes API execution from all trigger helpers.

## Global RFI trigger verification — 2026-09-07

- Persisted tagged journey `RFI-GLOBAL-8C21`: Jordan Lee issued the RFI from LDEQ to SPACEPORT, Alex Martin responded, and Joe Skaggs accepted it.
- Read-back confirmed `rfis.status=accepted`, `rfi_responses.review_status=accepted`, `submitted_by_user_id=Alex Martin`, and the linked workstream returned to `operational_state=running` with no waiting reason.
- Read-back confirmed three recipient-team notifications for the configured SPACEPORT members, two requesting-team notifications for configured LDEQ members, and one acceptance notification addressed to Alex Martin. Every notification has the canonical `/work/rfi/rfi-global-8c21` link and a unique dedupe key.
- Audit read-back confirmed actor identities for issue (Jordan), response (Alex), and acceptance (Joe). The live probe completed without errors; the remaining boundary is browser-authenticated file-upload and mobile verification.

## Live authorization-boundary verification — 2026-09-07

- With the Alex Martin demo identity in the request JWT context, `has_project_access` returned `true` for the tagged project while `can_mutate_ticket` returned an explicit `false` for an unassigned task. The task remained `in_progress`; no write was attempted.
- The original helper could return SQL `NULL` for nullable assignee/group fields. Forward migration `20260907123737_harden_mutation_authorization_nulls` now coalesces nullable authorization branches and access checks to `false`.
- With the Joe Skaggs system-admin identity, the same project and task returned `true` for both access and mutation authority. Routine privileges leave the helper callable by `authenticated`; trigger-only RFI helpers remain non-executable by API roles.

## Live completion-semantics verification — 2026-09-07

- Task `task-3b01f616f8984d9799716dc070331f4f` completed through `rpc_complete_task`; read-back confirmed `status=completed`, `itsm_state=resolved`, completion date, one task audit event, and one deduplicated completion notification. Its parent remained on Request intake until stage completion was separately invoked.
- Commitment `commitment-e2e-a9f4` moved from `on_track` to `fulfilled` through `rpc_update_commitment_status`; read-back confirmed the fulfilled date, one audit event, and the parent workstream remained unchanged.
- `rpc_complete_workstream_stage` first rejected an incomplete checklist with the exact missing requirement. After supplying `Confirm request intake evidence`, it created stage run `677d0c86-72e8-4b1a-bc0c-403bd4e6eff8`, recorded the completed checklist and actor, advanced the workstream to Technical team review, and created the next-stage task. This proves task/commitment/stage completion remain distinct events.

## Browser acceptance checkpoint — 2026-09-07

- The deployed customer workspace loaded at commit `f110fdb`; Alex Martin's Home, My Requests, request search, canonical work-item links, and project/Gantt views rendered in an authenticated browser session.
- Jordan Lee's reviewer workspace showed issued RFIs in `Waiting on others`; the detail projection incorrectly described response-acceptance actions before an applicant response existed. The projection now says to wait for the applicant response and labels the next handoff accurately.
- The customer RFI response dialog exposes text plus an optional immutable-version attachment. A synthetic response was staged, but the connected browser file chooser transferred only the filename and no file bytes from both workspace and `/tmp` paths; the app correctly rejected the empty attachment. Supabase read-back confirms `RFI-2026-60A808BA` remains `issued` with zero responses, so the live record is unchanged.
- Lint, production build/security scan, source-contract tests, project-navigation tests, and operational UX tests pass after the clarity fix.

## Mobile layout checkpoint — 2026-09-07

- Narrow screens now use full-width action controls for customer requests, work-item actions, dialogs, and administration forms; long headers and responsibility summaries wrap without crowding.
- Gantt schedule controls and tabs stack cleanly on mobile, while the dense DAG metrics grid becomes labeled mobile rows instead of a compressed desktop table.
- Customer request status, the shared shell header, and the version footer use mobile-safe spacing and wrapping without reintroducing page-level clipping.
- Verification: lint, production build/security scan, and 43 focused source/UX/navigation tests pass. Supervised local preview startup succeeded, but the cloud browser blocked the preview URL before a rendered 390px screenshot could be captured.

## Final verification checkpoint — 2026-09-07

- The deployed runtime/Site source remains at `37d5c3ef9113d08978720316e113442fef3eca5c`; GitHub `main` and the local checkout include the verification-only follow-up plus test-harness hardening. The older Site source head was preserved on `codex-backup-31a-mobile-sync` before synchronization.
- Updated stale regression contracts to match the current product behavior: readable Gantt dates, non-clipping mobile overflow, and neutral workspace-status footer language. The combined focused shell, UI, cockpit, operational, navigation, and source-contract suites now pass 64/64 tests.
- Lint, production build, and build-artifact secret scan pass.
- Full `npm test` now completes cleanly: 387 tests total, 361 passed, 0 failed, and 26 live-Supabase tests explicitly skipped because local URL/key credentials are unavailable. Middleware-only Vite servers disable unused WebSockets, and production-worker test children are shut down deterministically, so the former port `24678` collision and hanging runner are resolved.
- Supabase read-back confirms `RFI-E2E-A9F4` and `RFI-GLOBAL-8C21` are `accepted`, `CR-E2E-A9F4` is `concurred`, and `RFI-2026-60A808BA` remains `issued` with no response after the blocked file-byte transfer attempt.
- Supabase production verification on this checkpoint confirms the latest migration ledger reaches `20260907124408`, the triaged demo request remains `in_progress` with `itsm_state = triaged` and three linked workstreams, and an unauthorized synthetic RFI-response probe produced zero persisted rows. All public tables have RLS enabled, no public RPC is executable by `anon`, and no `app_private` helper is executable by `public`.
- Supabase Storage evidence is still incomplete: both accepted synthetic RFIs have empty `attached_document_version_ids`, so the database proves response acceptance but not a non-empty uploaded file byte path. Supabase advisors report 27 warnings: the intended authenticated access to `SECURITY DEFINER` mutation RPCs and disabled leaked-password protection. The RPCs were reviewed as the application’s authorized transaction boundary; no anonymous or public helper exposure was found.
- Browser boundary: the older Vercel shell loads, while the current supervised Site preview is blocked by the cloud browser before rendering. Browser-authenticated file upload with non-empty bytes and a rendered 390px screenshot remain the final external checks.

## S3 accessibility and runtime stability checkpoint — 2026-09-07

- Added shared focus behavior to the work-action, intake-routing, and document-viewer dialogs: initial focus, Tab containment, Escape close, and opener restoration.
- Added mobile navigation semantics (`aria-expanded`, `aria-controls`, `aria-current`, explicit sign-out naming), Escape handling, focus return, and road-stripe-aware drawer positioning.
- Replaced the shared green-only toast with success, warning, info, and alert live-region states. Supabase-absent hydration now cancels its scheduled frame during cleanup.
- Verification: `npm run lint -- --quiet` passed; `npm test` completed with 395 discovered, 369 passed, 0 failed, and 26 explicit Supabase-credential skips; production build and secret scan passed; loopback HTTP smoke returned the login shell successfully.
- Browser verification remains open because this runner has neither `agent-browser` nor a system Chromium, and the Playwright Chromium download timed out/returned 502. No Supabase migration or seed change was needed for S3; GitHub main remains the deployment source for Vercel.
