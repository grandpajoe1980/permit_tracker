# Objective

Turn PATH into a maintainable, accessible SpaceX Louisiana permitting-workspace MVP: authenticated employees submit project requests, internal teams receive them through database routing, and program leaders monitor progress in Supabase.

# Current State

- The source repository contains only `index.html` and a two-line README.
- The HTML file embeds all styles, demo accounts, permit records, and navigation logic.
- The initial LDEQ demo has been replaced by one SpaceX Louisiana workspace with internal Environment, Infrastructure, Community, Safety, and Spaceport teams.
- Supabase Auth, Postgres/RLS, Storage, request routing, and seed tooling are versioned; hosted migration application is complete.

# MVP Definition of Done

The MVP is complete when a SpaceX employee can sign in, see only authorized requests, submit a new request, and inspect status/timeline data while internal team members can receive requests through RLS-protected routing. Seed data remains clearly illustrative.

# Requirements Matrix

| ID | Requirement | Priority | Initial status | Main areas | Dependencies | Acceptance criteria | Verification |
|---|---|---:|---|---|---|---|---|
| DEMO-01 | Disclose prototype/demo status and data limitations | P0 | Partial | App shell, copy | None | Every route/view retains a conspicuous demo notice; no real-time or official-service claim remains | Source and rendered HTML tests |
| FLOW-01 | Enter the single SpaceX Louisiana workspace | P0 | Complete | Landing/sign-in | DEMO-01 | No agency selector; account access determines workspace permissions | Browser journey |
| AUTH-01 | Enter a demo account and sign out | P0 | Partial | Sign-in, session state | FLOW-01 | Three supplied scenarios authenticate with the shared demo password; invalid input shows a safe accessible error; sign-out clears state | Unit tests and manual journey |
| DASH-01 | View the signed-in scenario's application summary | P0 | Partial | Dashboard, permit data | AUTH-01 | Dashboard shows linked application ID, permit type, date, status, and bounded progress; action-required scenario is conspicuous | Data/unit tests and manual journey |
| DETAIL-01 | View application metadata, timeline, next steps, and contact | P0 | Partial | Detail view, timeline | DASH-01 | Detail represents completed/current/future states and all scenario-specific alerts and next steps | Data tests and manual journey |
| PRINT-01 | Print a useful application summary | P1 | Partial | Detail view, print CSS | DETAIL-01 | Print hides navigation/actions and preserves the application summary and demo disclaimer | CSS/source test and print preview check |
| APPLY-01 | Submit a new project request | P0 | Complete | Dashboard request form | AUTH-01 | Authenticated employee can write a request and receive a routed team | Supabase/RLS verification |
| A11Y-01 | Support keyboard, assistive technology, reduced motion, and responsive layouts | P0 | Missing | All views, CSS | FLOW-01 through DETAIL-01 | Semantic controls, visible focus, announced errors/status, focus on view changes, reduced-motion and mobile rules | Static checks and manual keyboard pass |
| ENG-01 | Provide maintainable build, lint, tests, and run documentation | P0 | Missing | Project config, tests, README | All implementation | Production build, lint, and focused tests pass; README documents scope and commands | CI-equivalent commands |
| PROD-01 | Real identity, server-side authorization, and authoritative agency data | P3 | Not started | Backend/integrations | External identity and agency systems | Explicitly excluded from demo; documented as required before production use | Documentation review |
| PROD-02 | Additional agencies and proactive notifications | P3 | Not started | Integrations | PROD-01 and agency agreements | Explicitly excluded from demo | Documentation review |

# Architecture

- Vinext/React client interface using the existing Sites starter and vendored UI primitives.
- Typed, immutable demo records in `lib/demo-data.ts`.
- Pure helpers for authentication lookup and progress calculations in `lib/permit-utils.ts`.
- A single client-side state machine in `app/page.tsx` for the narrow demo journey.
- Responsive and print styling in `app/globals.css`.
- Node's built-in test runner for data, helper, source, and rendered-output assertions.

Supabase Auth + Postgres/RLS provide the MVP persistence and authorization boundary. `scripts/seed-spacex-demo.mjs` creates non-production `.test` users and illustrative requests; replace them before any real deployment.

# Task Dependency Graph

```text
FOUNDATION-01 typed demo model and helpers
  |-- UI-01 shell, agency selection, and sign-in
  |     `-- UI-02 dashboard and action alerts
  |           `-- UI-03 detail timeline and print summary
  `-- TEST-01 data/helper tests

UI-01 + UI-02 + UI-03
  `-- QUALITY-01 accessibility, responsive, and copy hardening
        `-- TEST-02 build/lint/rendered-output verification
              `-- RELEASE-01 documentation, checkpoint, and deployment
```

# Work Waves

## Wave 1 — Foundation

- FOUNDATION-01: Create typed demo data and pure helpers.
- DOCS-01: Establish this execution plan and persistent progress record.

## Wave 2 — Core Journey

- UI-01: Build the demo shell, agency selection, and sign-in.
- UI-02: Build the application dashboard and action-required alert.
- UI-03: Build the permit detail timeline, next steps, contact, and print action.

## Wave 3 — Quality

- QUALITY-01: Apply semantic controls, focus management, reduced motion, responsive and print behavior, and honest demo labeling.
- TEST-01/02: Add focused data, helper, source, and rendered-output tests; run build and lint.

## Wave 4 — Release

- REVIEW-01: Independently review inferred requirements, quality/security, and tests.
- RELEASE-01: Resolve high findings, update progress, publish a verified checkpoint, and synchronize source to GitHub.

# Risks

- No PRD exists, so scope is inferred from the repository's demo and must not be mistaken for a production portal specification.
- Agency workflow details, contact information, deadlines, and legal language are illustrative and unverified.
- Client-side demo authentication provides no security. Production use requires an identity provider, server-side sessions, authorization, auditability, and authoritative data integration.
- External application URLs can change and require owner validation before a production launch.

# Testing Strategy

1. Type/build validation through the existing production build.
2. Pure helper and demo-data integrity tests with `node:test`.
3. Source/rendered-output assertions for metadata, demo disclosure, accessibility markers, and print/reduced-motion CSS.
4. Focused manual journey for each scenario: select agency, sign in, dashboard, detail, print trigger, back navigation, and sign out.

# Completion Checklist

- [x] DEMO-01 through ENG-01 implemented
- [x] Three demo journeys represented accurately
- [x] Invalid sign-in and sign-out behavior covered by implementation/contracts
- [x] Keyboard, focus, responsive, reduced-motion, and print behavior covered
- [x] Critical demo workflow passed live browser E2E
- [ ] Production build passes
- [x] Lint passes
- [ ] Automated tests pass
- [ ] No known blocker/high findings remain
- [ ] README and progress record are current
- [ ] Verified deployment completed
- [ ] Completed source synchronized to GitHub
