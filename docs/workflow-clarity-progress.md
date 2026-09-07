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
| T09 | in_progress | Work detail states current owner/team; transfer uses the first persisted assignment-group label when no explicit target is configured; fixture fallbacks no longer notify guessed recipients. Full recipient selection/authorization proof remains. |
| T10 | in_progress | Core routes exist and deep-link handling improved; full navigation convergence remains. |
| T12 | verified | Intake queue is searchable, excludes drafts/terminal records, and opens an editable routing review with agency/title/workflow-version rows, add/remove workstreams, confirmation, and duplicate guards before the atomic fan-out RPC. Live Supabase read-back remains environment-blocked. |
| T13 | in_progress | Gantt avoids invented impact figures, shows current owner, and formats baseline/forecast dates in the summary and tooltips. Stage/history reconciliation remains. |
| T13 | in_progress | Removed invented customer-request due dates and document-review due dates; missing dates now display as unscheduled. |
| T14 | in_progress | Removed the unverified persistence-health badge, improved narrow-screen overflow behavior, added accessible schedule-row labels, and clarified customer search controls. Full viewport/keyboard verification remains. |
| T11 | in_progress | Customer Home has direct View My Requests and a post-submit receipt card with confirmation number, assignment status, and Open request. Full cross-reload/workstream proof remains. |
| T15 | pending | Final behavioral journeys and live persistence proof require configured isolated Supabase credentials. |

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
- Focused queue/RFI/navigation/commitment tests pass. Two legacy assertions conflict with the new behavior: one expects fabricated fallback stages, and one expects standalone links instead of authenticated in-app routing.
- Supabase mutation tests require configured test credentials and were not run against shared data. Local commits are ready; direct push was blocked by repository safety policy.
