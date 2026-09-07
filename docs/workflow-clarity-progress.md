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
- Focused queue/RFI/navigation/commitment tests pass. The project-navigation assertion was updated to cover the focused in-app workspace rather than a stale standalone-link contract.
- Supabase mutation tests require configured test credentials and were not run against shared data. Navigation checkpoint is pushed to `main` at `6c5aa855b30552111988b158427e8bd01832ce96` (GitHub contents commits); local implementation checkpoint is `f38af62c0b648b105388f95fedf298ec19a661ae`.
