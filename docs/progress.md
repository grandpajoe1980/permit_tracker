# PATH Customer Portal and End-to-End Progress

## Current Status

The customer portal phase is implemented on top of the existing role-aware operational workspace. SpaceX has a customer-safe project command center, first-class schedule, guided request center, external filing tracking, documents, contacts, help/escalation, and notifications. Government users retain their existing queues, audited workflow actions, schedule intelligence, administration, and now have a government-side customer-request triage view.

## Completed Tasks

- Read the project instructions, PRD, execution plan, operational UX documentation, repository, models, fixtures, source tree, latest commits, and test suite before implementation.
- Added CP-01/02 customer navigation, project overview, customer-safe Gantt, direct workstream opening, and customer-safe schedule copy.
- Added CP-03/04/05/10 request center, permit wizard, verified resource/filing metadata, external-portal tracking, confirmation numbers, draft requests, and customer escalation routing.
- Added CP-06/07 realistic user profiles, project participants, contact directory, self-service contact editing, visibility filtering, Joe Skaggs administration, and structured workstream assignment semantics.
- Added CP-08/11 exclusive My Work bucket classification, personal assignment flags, agency queue separation, and removal of the hardcoded T003 reviewer exception.
- Added CP-09 immutable document revision upload/download, SHA-256 metadata, file metadata, review assignments, exact-version agency review, and review reset for new revisions.
- Added CP-12 configured workflow completion requirements and next-owner handoff behavior.
- Added browser refresh persistence for the deterministic fixture repository, `scripts/reset-e2e-demo.mjs`, manual E2E guidance, Playwright handoff guidance, and machine-readable scenarios.
- Added customer portal model tests and preserved all existing operational, persistence, component, and source-contract tests.

## Checkpoint Tasks

- Checkpoint 1: customer navigation, Gantt, overview, personas, Joe administrator, profile, and participant foundation.
- Checkpoint 2: request center, external filing/resource tracking, drafts, and escalation visibility.
- Checkpoint 3: document upload/download/version/review lifecycle.
- Checkpoint 4: personal assignment, exclusive work buckets, RFI routing, and workflow configuration.
- Checkpoint 5: deterministic reset, E2E handoff, final validation, commit, and publish.

## Pending Tasks

- The five logical checkpoints are committed and pushed to `origin/main`; the configured private production site is published.
- Connected Supabase persistence for the new relational customer tables remains a production integration follow-up; the demo/runtime boundary is deterministic and refresh-persistent.

## Delivery Evidence

- Production site: https://permit-tracker.grandpajoe.chatgpt.site
- Checkpoint 1: `1263881`
- Checkpoint 2: `f8c6427`
- Checkpoint 3: `2247dc1`
- Checkpoint 4: `e98d139`
- Checkpoint 5: `adb485f`

## Test Status

| Check | Current |
|---|---|
| Direct Vinext build | PASS |
| Focused tests | PASS — operational UX, permit data, DB persistence, and customer portal |
| Direct ESLint | PASS — `npx eslint . --quiet` reports 0 errors; generated output is ignored |
| Full direct test suite | PASS — 139 tests |

## Integration Status

- Existing cockpit components remain available as government secondary tools.
- Existing Supabase Auth/request loading/intake integration remains in place.
- The in-memory repository is the audited fixture command boundary; customer requests, profiles, external filings, document versions, notifications, and audit events are structured records.
- Browser refresh persistence uses `localStorage` key `path-e2e-demo-state-v1` only for the deterministic local demo. Supabase remains the authoritative production boundary when its integration is enabled.

## Blockers and Assumptions

- Npm wrappers invoke Bash, which is unavailable in the Windows shell. Direct `npx vinext build`, `npx eslint`, and `node --test` commands are used for validation.
- Supabase Auth is optional for the demo; persona selection remains available without configured credentials.
- Customer-facing addresses use realistic domains and synthetic demo identities. The `.test` aliases remain only where existing fixture compatibility requires them.
- Browser visual QA was not run because this is a delegated/background environment and the user did not request a browser review. Semantic controls, focusable headings, responsive action wrapping, live intake feedback, customer-safe schedule controls, and reduced-motion behavior are included.

## E2E References

- [Manual E2E guide](testing/manual-e2e-guide.md)
- [Playwright handoff](testing/playwright-handoff.md)
- [Scenario catalog](testing/playwright-scenarios.json)
- Reset with `node scripts/reset-e2e-demo.mjs`.

## User-Owned Files Preserved

The pre-existing untracked research report and Supabase migration were preserved outside checkpoint staging.
