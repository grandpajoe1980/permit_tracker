# Playwright Handoff

## Runtime contract

- App root: repository root, launched with `npm run dev`.
- Reset command: `node scripts/reset-e2e-demo.mjs`.
- Primary project: `PRJ-PECAN-2026` / `SpaceX Pecan Island Launch Complex & Orbital Support Facility`.
- Customer organization: `Space Exploration Technologies Corp. (SpaceX)`.
- Scenario catalog: `docs/testing/playwright-scenarios.json`.
- Stable selectors should prefer visible labels, `aria-label`, `role`, and the IDs already attached to form controls. Avoid Tailwind class selectors and positional selectors.

## Authentication

The sign-in screen exposes demo persona buttons. Prefer selecting the persona by visible name for local E2E. When testing Supabase-backed authentication, use the realistic work email and password in `manual-e2e-guide.md`; do not hardcode service-role credentials in browser tests.

## State and isolation

The browser demo repository persists customer actions, document versions, notifications, audit events, and admin-directory changes in `localStorage` under `path-e2e-demo-state-v1` and `path-admin-team-users-v1`. The reset script restores the in-memory fixture for a new process; a browser test should also clear both keys before a fresh browser context when testing persistence. Supabase migrations and the seeded baseline are applied, but portal mutations are not yet hydrated from Supabase on browser login; treat cross-browser persistence as a production follow-up rather than an E2E assertion.

## Assertions that matter

1. Customer schedule is reachable directly from primary navigation and is customer-safe.
2. Customer request types create structured records with a confirmation number and notify the state project office.
3. External filings retain an authoritative-system reference and never imply PATH submitted on the agency’s behalf.
4. A document upload creates an immutable version, hash, download target, review assignments, audit event, and notification/audit trail as applicable.
5. Profile edits are self-service contact edits only; organization, project role, capabilities, and visibility remain controlled.
6. My Work buckets are mutually exclusive, and personal assignment is distinct from agency queue eligibility.
7. Customer escalation is visible to the government-side triage path.
8. Government-only notes, internal reviewer controls, Joe Skaggs, and internal administration are absent from customer-safe views.

## Suggested runner shape

```text
beforeEach: reset browser storage, visit app, choose persona
given: scenario precondition
when: execute navigation and form actions
then: assert visible result, record/audit/notification result, and persistence after reload
on failure: save screenshot, URL, console output, and scenario ID
```

The scenario JSON intentionally keeps expected UI, data, audit, notification, and persistence assertions separate so a runner can turn each field into a focused assertion without guessing hidden implementation details.
