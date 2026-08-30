# PATH Customer Portal and End-to-End Execution Plan

## Objective

Turn PATH into a usable customer and government project-delivery workspace while preserving the role-aware operational system. SpaceX must be able to understand and act on the project without seeing restricted government controls; government users must be able to triage, assign, review, coordinate, escalate, and close work through the same audited records.

## Current State

- The existing root route is now a role-aware operational shell with My Work as the default landing view; legacy cockpit tools remain available as secondary tools.
- `lib/domain-models.ts`, `lib/spacex-megaproject-fixture.ts`, and `lib/repository.ts` already model workstreams, tasks, workflow gates, RFIs, coordination requests, documents, escalations, audit events, and notifications.
- `app/page.tsx` routes workflow, blocker, intake, RFI, escalation, transfer, note, and document actions through the audited repository boundary, with existing Supabase request intake preserved.
- Supabase Auth/request loading exists in `lib/supabase-browser.ts`; local demo personas remain the reliable offline demo boundary.
- Historical starting validation for this phase was recorded before the customer-portal implementation; direct commands are used because the npm wrappers require Bash in this Windows environment.

## Current Delivery Validation

The customer portal implementation now includes a customer-safe command center, first-class Schedule/Gantt, structured request center, permit resource and external filing tracking, escalation triage, profiles/participants, immutable document lifecycle, exclusive work queues, deterministic browser persistence/reset, and Playwright handoff artifacts. The current direct lint command is `npx eslint . --quiet`, which reports zero errors after generated build/runtime directories were added to the global ignore list. The full direct suite passes 139 tests. Five logical checkpoints are committed and pushed, and the configured private production site is published at https://permit-tracker.grandpajoe.chatgpt.site.

## MVP Definition of Done

- Authenticated users land on a persona-aware workspace with My Work as the default.
- Reviewer cards answer what needs attention, why it is assigned, what to do, when it is due, and what happens next.
- A reusable permission-aware Work Action Bar exposes Complete Step, Request Information, Mark Blocked, Ask for Help, Escalate, and Add Note.
- Complete Step uses the workflow engine requirements and previews the handoff before calling the repository transition.
- Mark Blocked creates the appropriate structured RFI, coordination request, internal blocker, or statutory wait and previews recipients.
- RFI responses, exact document-version review, escalation history, and supervisor queues are discoverable from the shell.
- Customer view is sanitized and does not expose government-internal controls.
- Legacy request mutations use Supabase/RLS when Auth is configured; the new customer portal command records use the audited repository demo boundary until their browser hydration bridge is implemented.
- Focused tests cover role routing, queue prioritization, action availability, workflow gates, mutation routing, sanitization, and keyboard semantics.
- Build, lint, tests, and documentation are current.
- SpaceX can navigate directly to a customer-safe schedule/Gantt, request center, document center, contact directory, and help/escalation center.
- External filing records, profile edits, participant assignments, and exact document versions persist through refresh in the local demo boundary; cross-browser/relogin hydration for these new portal records remains the next production integration step.
- A deterministic E2E reset and manual/Playwright handoff artifacts exist.

## Requirements Matrix

| ID | Requirement | Priority | Implementation surface | Verification |
|---|---|---:|---|---|
| UX-01 | Role-aware application shell and default workspace | P0 | `app/page.tsx`, `lib/operational-ux.ts` | source/component tests |
| UX-02 | Prioritized My Work queue with explainability | P0 | `lib/operational-ux.ts`, root UI | unit/component tests |
| UX-03 | Unified detail page and breadcrumbs | P0 | root UI | SSR/source tests |
| UX-04 | Permission-aware Work Action Bar | P0 | root UI, action model | unit tests |
| UX-05 | Complete Step wizard and handoff preview | P0 | `lib/repository.ts`, root UI | transition/gating tests |
| UX-06 | Structured blocked/RFI/coordination workflow | P0 | `lib/repository.ts`, root UI | mutation routing tests |
| UX-07 | Notification routing and action center | P1 | repository, root UI | unit tests |
| UX-08 | Escalation intent and recipient preview | P0 | `lib/repository.ts`, root UI | unit tests |
| UX-09 | Exact document revision review | P0 | repository, root UI | version-specific tests |
| UX-10 | Supervisor, State PM, and SpaceX workspaces | P1 | root UI | role routing tests |
| UX-11 | Accessibility, responsive action bar, announcements | P0 | root UI, `app/globals.css` | source tests/manual review |
| UX-12 | Operational journeys documentation | P1 | `docs/operational-ux.md`, progress | doc review |
| CP-01 | Customer project command center | P0 | `app/page.tsx`, customer portal projection | source/component tests |
| CP-02 | Customer-accessible schedule/Gantt | P0 | shell navigation, `WorkstreamGraphGantt` | route/source tests |
| CP-03 | Request center and guided intake | P0 | customer UI, repository, intake model | workflow tests |
| CP-04 | External filing tracking | P0 | domain models, repository, schema/migration | persistence tests |
| CP-05 | Customer escalation lifecycle | P0 | repository, customer/government views | mutation tests |
| CP-06/07 | Profiles, contacts, participants | P0 | domain models, admin/customer UI | model/source tests |
| CP-08/11 | Assignment visibility and exclusive queues | P0 | `lib/operational-ux.ts` | unit tests |
| CP-09 | Complete document lifecycle | P0 | repository, document center | version tests |
| CP-10 | Permit resource library | P0 | catalog projection and UI | catalog tests |
| CP-12 | Workflow-driven completion | P0 | workflow/repository | gate tests |
| CP-13 | Deterministic E2E readiness | P0 | scripts/docs/tests | reset/schema/source tests |
| CP-14/15 | Realistic identities and Joe admin | P1 | fixtures/demo data/admin UI | fixture tests |

## Architecture

1. `lib/operational-ux.ts` is the pure translation layer from existing domain records to human work items, roles, available actions, priority, recipient resolution, and customer sanitization.
2. `lib/repository.ts` remains the audited domain mutation boundary for the demo/runtime fixture. New methods will create RFIs, mark structured waits, transition stages, append notes, escalate, and approve exact document versions.
3. `lib/supabase-browser.ts` continues to handle authenticated request reads and request intake. Supabase mutations are added only for tables and permissions already present in the schema; the demo repository remains the offline fallback.
4. `app/page.tsx` becomes a client shell with role-aware navigation, queue/detail/workspace routes, reusable dialogs, and no duplicated workflow rules.
5. Existing cockpit components stay available as secondary tools for authorized users and are not removed or made primary for ordinary reviewers.

## Task Dependency Graph

```text
DOC-01 current-state plan
  |
  +--> DOMAIN-01 operational work-item/action model
  |       |
  |       +--> REPO-01 audited mutation boundary
  |       |       |
  |       |       +--> UI-02 work detail + action dialogs
  |       |
  |       +--> UI-01 role-aware shell + My Work
  |                       |
  |                       +--> UI-02 detail/actions
  |                                       |
  |                                       +--> QA-01 focused tests + accessibility
  +--> DOC-02 journey documentation
```

```text
CP-14/15 identities + CP-06/07 participant/profile foundation
                 |
                 +--> CP-01 customer command center + CP-02 customer Gantt
                 |          |
                 |          +--> CP-03 request center + CP-04 external filings
                 |          |          |
                 |          |          +--> CP-05 escalation + CP-10 resource library
                 |          |
                 |          +--> CP-09 document lifecycle
                 |
                 +--> CP-08/11 assignment and exclusive queues
                              |
                              +--> CP-12 workflow completion
                                         |
                                         +--> CP-13 deterministic E2E handoff
```

## Agent Ownership

| Owner | Scope | Requirements |
|---|---|---|
| Orchestrator | Cross-cutting integration, customer shell, validation, checkpoint commits | CP-01–CP-15 |
| Domain/persistence specialist | Participant/profile/external filing/document records, repository methods, schema migration | CP-04, CP-06–CP-09 |
| Operational UX specialist | Assignment semantics, exclusive queues, customer-safe projection, workflow gates | CP-08, CP-11, CP-12 |
| QA/documentation specialist | Manual guide, reset, Playwright handoff/scenarios, acceptance coverage | CP-13 |

Lower agents must read `docs/PRD.MD`, this file, `docs/progress.md`, and relevant specialist instructions. A UI render alone never marks a requirement complete.

## Work Waves

### Wave 1 — Translation and persistence boundary — complete

- Add pure work-item projection, role routing, queue priority, action availability, recipient resolution, and customer sanitization.
- Add audited repository mutations for RFI, coordination request, internal block, escalation, transition, note, and exact document review.
- Add focused model tests.

### Wave 2 — Operational application shell — complete

- Replace cockpit-selector primary navigation with persona-aware shell, My Work, queue sections, context bar, notification indicator, and secondary tools.
- Preserve sign-in/demo persona access and existing stable test hooks.

### Wave 3 — Human workflows — complete

- Add unified detail view and reusable action bar.
- Implement Complete Step requirement checklist + handoff preview.
- Implement Mark Blocked intent routing + notification preview.
- Implement RFI response acceptance, document revision signoff, help/transfer, escalation, and add-note flows.

### Wave 4 — Role views, quality, and docs — complete

- Add supervisor/state office/SpaceX queue variants with internal-data sanitization.
- Add keyboard/focus/announcement protections and responsive action treatment.
- Add tests/docs, repair lint errors in touched code, run final validation.

### Wave 5 — Customer portal and identity foundation

- Add CP-14/15 realistic identities, Joe administrator, structured participant/profile records, and customer navigation.
- Make Schedule first-class for SpaceX and expand the customer-safe project command center.

**Checkpoint 1:** build, tests, lint wrapper, source-contract checks; commit customer workspace/participant foundation.

### Wave 6 — Requests, filings, resources, escalation

- Add guided request center and permit wizard, catalog/resource projection, external filing tracking, and customer escalation lifecycle.

**Checkpoint 2:** build, tests, lint wrapper, request/filing/escalation acceptance tests; commit request center.

### Wave 7 — Documents, assignments, workflow completion

- Complete upload/download/version/review lifecycle; correct ownership projection and mutually exclusive queues; remove hardcoded routing; make all fixture workflows operable from configuration.

**Checkpoints 3–4:** validate and commit document lifecycle, then workflow/assignment corrections separately.

### Wave 8 — Deterministic E2E handoff

- Add namespace-safe reset, manual E2E guide, Playwright handoff/scenarios, selector contract, README updates, regression repairs, and final audit/security notes.

**Checkpoint 5:** full direct validation, commit and publish.

## Checkpoint Boundaries and Acceptance Tests

1. **Customer workspace:** SpaceX persona sees Home, My Actions, Requests & Permits, Schedule, Documents, Contacts, Help & Escalation, Notifications; Schedule opens the Gantt; overview shows dates, variance, health, workstreams, blockers, events, and sanitized contacts.
2. **Request center:** all six customer intents are discoverable; permit wizard exposes filing mode/resources; external filing stores manual reference/status/receipt; escalation returns a confirmation and appears to government staff.
3. **Documents:** upload creates immutable vN+1, download targets exact version, review applies only to that version, and new versions reset review state.
4. **Ownership/workflows:** personally assigned work only enters My Work; agency-only work enters agency queue; waiting/FYI do not duplicate primary buckets; configured stage requirements and next owner drive completion.
5. **E2E handoff:** reset is idempotent and namespace-safe; the manual guide includes persona, navigation, expected UI/data/audit/notification/persistence results for each lifecycle step; scenario JSON is machine-readable.

## Risks and Assumptions

- The current production schema has request/assignment/notification/audit tables but not every relational table used by the in-memory command-system fixture. The implementation will not invent a second domain; demo mutations use the audited repository and Supabase request writes use existing RLS-scoped tables.
- Demo persona selection is intentionally local when Auth credentials are unavailable. This is documented as a demo boundary, not a production authorization boundary.
- “Environmental reviewer” maps to Jordan Lee/LDEQ in the current fixture; supervisor/state/customer views derive from the existing `DemoPersona` role and domain records.

## Testing Strategy

- Pure unit tests for role-aware queue projection, priority ordering, action availability, requirement gating, routing, notification recipients, document version targeting, and customer sanitization.
- Existing full suite remains the regression baseline.
- SSR/source tests continue to verify metadata, semantic controls, responsive/accessibility CSS, and preserved cockpit components.
- Direct commands are used for build/lint/tests in this Windows environment; npm scripts remain unchanged.

## Completion Checklist

- [x] Work-item/action model implemented and tested
- [x] Repository mutations audited and used by UI
- [x] Reviewer My Work default and explainability complete
- [x] Complete Step and Blocked workflows complete
- [x] RFI, coordination, escalation, document, supervisor, and SpaceX views complete
- [x] Accessibility and responsive behavior verified
- [x] Documentation updated
- [x] Build passes via direct Vinext command
- [x] Lint passes with no errors (pre-existing warnings remain)
- [x] Tests pass
- [ ] Connected portal mutation hydration and production publish of the remediation branch
