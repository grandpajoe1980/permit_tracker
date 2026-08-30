# PATH Operational UX Execution Plan

## Objective

Turn PATH from a cockpit selector into a role-aware operational work system. An authenticated reviewer should land on **My Work**, understand why each item is assigned, complete or block it in plain language, see the next handoff, and leave an auditable persisted result.

## Current State

- The existing root route is now a role-aware operational shell with My Work as the default landing view; legacy cockpit tools remain available as secondary tools.
- `lib/domain-models.ts`, `lib/spacex-megaproject-fixture.ts`, and `lib/repository.ts` already model workstreams, tasks, workflow gates, RFIs, coordination requests, documents, escalations, audit events, and notifications.
- `app/page.tsx` routes workflow, blocker, intake, RFI, escalation, transfer, note, and document actions through the audited repository boundary, with existing Supabase request intake preserved.
- Supabase Auth/request loading exists in `lib/supabase-browser.ts`; local demo personas remain the reliable offline demo boundary.
- Final direct validation: `npx vinext build` passes; direct `node --test tests/*.test.mjs` passes 127 tests; direct ESLint exits with 0 errors and 192 warnings. The npm wrappers cannot run in this Windows shell because Bash is unavailable.

## MVP Definition of Done

- Authenticated users land on a persona-aware workspace with My Work as the default.
- Reviewer cards answer what needs attention, why it is assigned, what to do, when it is due, and what happens next.
- A reusable permission-aware Work Action Bar exposes Complete Step, Request Information, Mark Blocked, Ask for Help, Escalate, and Add Note.
- Complete Step uses the workflow engine requirements and previews the handoff before calling the repository transition.
- Mark Blocked creates the appropriate structured RFI, coordination request, internal blocker, or statutory wait and previews recipients.
- RFI responses, exact document-version review, escalation history, and supervisor queues are discoverable from the shell.
- Customer view is sanitized and does not expose government-internal controls.
- Mutations are server-authorized when Supabase is configured and otherwise use the existing audited repository demo boundary; resulting state is rendered from authoritative mutation results.
- Focused tests cover role routing, queue prioritization, action availability, workflow gates, mutation routing, sanitization, and keyboard semantics.
- Build, lint, tests, and documentation are current.

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
- [ ] Changes committed and site published
