# PATH Customer Portal Manual E2E Guide

This guide covers the demo path for the Space Exploration Technologies Corp. (SpaceX) Pecan Island project. It is intentionally written so a human tester can complete the same flows that an automated browser runner will execute.

## Start clean

1. For offline fixture mode, run `node scripts/reset-e2e-demo.mjs`. For connected mode, use a disposable Supabase staging project and run `npm run supabase:seed:spacex`; never run a reset against production.
2. Start the app with `npm run dev`.
3. Open the local URL shown by Vite.
4. Use the persona selector on the sign-in page. Demo credentials are seeded by `scripts/seed-spacex-demo.mjs` when Supabase is configured; the in-memory selector remains available without Supabase.

Primary personas:

| Persona | Login | Password | Purpose |
| --- | --- | --- | --- |
| Alex Martin | `alex.martin@demo.permit.local` | `SpaceX-Demo-2026!` | Customer / submitter |
| Maya Chen | `maya.chen@demo.permit.local` | `SpaceX-Demo-2026!` | SpaceX regulatory program supervisor |
| Jordan Lee | `jordan.lee@demo.permit.local` | `Agency-Demo-2026!` | LDEQ environmental reviewer |
| Sam Rivera | `sam.rivera@demo.permit.local` | `Agency-Demo-2026!` | DOTD infrastructure reviewer |
| Riley Brooks | `riley.brooks@demo.permit.local` | `PATH-Demo-2026!` | Parish / community coordinator |
| Joe Skaggs | `joe.skaggs@demo.permit.local` | `PATH-Demo-2026!` | LED PATH administrator / Space Czar |

These are fictional staging identities only. They must not be used in production or represented as real agency accounts.

## Customer acceptance path — Alex Martin

1. Sign in as Alex Martin. Confirm the header identifies `Space Exploration Technologies Corp. (SpaceX)` and the Pecan Island project.
2. On **Project Home**, verify the stage, health, baseline launch date, forecast date, variance, next milestone, workstream summary, blocker cards, and customer actions.
3. Select **Schedule**. Confirm the schedule is a first-class primary navigation item, shows baseline and forecast dates, and omits internal notes, controls, and what-if tools. Select a workstream row and confirm it opens the related PATH action detail.
4. Select **Requests & permits**. Verify the six choices: permit/authorization, government help, project question, blocker/coordination, escalation, and not sure/concierge.
5. Open a permit wizard. Confirm the catalog shows trigger, prerequisites, expected duration, statutory minimum, agency contact, filing mode, official resource, and an external case/reference field where applicable. Submit a record and capture the `PATH-YYYY-NNNN` confirmation.
6. Reopen the request center. Confirm the submitted record is visible with its confirmation number and status. For an external filing, confirm the authoritative system and manual verification note are shown.
7. Submit a government-help request with an outcome, affected area, desired date, known agency, and “blocks active project work” checked. Confirm the request is visible to the state project office path and a notification is generated.
8. Submit an escalation request. Confirm the success message references the state project office and that the record is not silently treated as a local-only note.
9. Select **Documents**. Upload a small text or PDF file. Confirm a new immutable version appears with filename, size, SHA-256, uploader, upload time, agency review assignments, and `under_review` status. Download that exact version and verify the file contents.
10. Select **Contacts**. Confirm the customer-visible directory includes appropriate SpaceX, state, DOTD, CPRA, LDEQ, and parish contacts but excludes Joe Skaggs. Edit only Alex’s title, work email, phone, location, contact method, or availability; save; refresh; confirm the edit persists. Attempting to change organization or role is not offered in the customer form.
11. Select **Help & escalation** and confirm the state concierge contact, response expectation, request-center link, and escalation link are present.

## Government acceptance path

1. Sign in as Jordan Lee, Sam Rivera, or Riley Brooks. Confirm government tools expose the appropriate agency queue, RFIs, coordination, documents, schedule intelligence, and permit catalog.
2. Open **My Work** and verify every item appears in exactly one primary bucket: overdue, due today, needs action, waiting, upcoming, or recently completed. Confirm organization queue context is shown separately from personal assignments.
3. As Jordan or Sam, confirm only work personally assigned to the logged-in reviewer is labeled “assigned to you.” There must be no hardcoded T003 reviewer exception.
4. As a reviewer, issue or respond to an RFI and confirm the response is visible only to the assigned reviewer/requesting agency path until accepted.
5. Review a document version as an agency. Approve, approve with conditions, or request revision. Confirm the decision is tied to that immutable version and appears in the audit history.
6. As Maya, verify supervisor queue access, customer-request triage, escalation handling, and recipient previews. As Joe, verify the administration view shows participant roles, capabilities, assignment semantics, and the full `Space Czar` title without exposing internal administration to customers.

## Reset and evidence

Run `node scripts/reset-e2e-demo.mjs` between scenarios when isolation is required. Save screenshots using the scenario IDs in `docs/testing/playwright-scenarios.json`; record the confirmation number, document version ID, and audit event ID in the test notes. A pass requires both the expected UI state and the expected repository/audit/notification state.
