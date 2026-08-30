# PATH Customer Portal and End-to-End Execution Plan

## Objective

Turn PATH into a production-grade, Supabase-authoritative customer and government project-delivery workspace while preserving the role-aware operational system. SpaceX must be able to understand and act on the project without seeing restricted government controls; government users must be able to triage, assign, review, coordinate, escalate, and close work through the same audited records committed directly to Supabase PostgreSQL and Supabase Storage.

## Current State

- **Authoritative Persistence Runtime**: Fully integrated with live Supabase PostgreSQL (project `zomzacaxwqfwjstkxbpv`) and Supabase Storage (`path-documents`).
- **Data Durability**: All mutations write directly to Supabase PostgreSQL via atomic RPC functions or RLS-protected tables; all queries hydrate from Supabase. No dependency on localStorage as a production source of truth.
- **Cross-Browser Synchronization**: Supabase Realtime channel (`postgres_changes`) actively updates concurrent browser sessions on database mutations.
- **Top Navigation Status**: Visual Supabase DB live connection badge confirms active connection and timestamp of latest persisted write.
- **Verification**: 150/150 full test suite passes (0 failures); 3/3 transactional multi-user durability flows pass; `npx vinext build` and `npx eslint . --quiet` pass with 0 errors.

## Requirements Matrix & Completion Status

| ID | Requirement | Priority | Implementation Surface | Verification | Status |
|---|---|---:|---|---|:---:|
| UX-01 | Role-aware application shell and default workspace | P0 | `app/page.tsx`, `lib/operational-ux.ts` | source/component tests | **COMPLETE** |
| UX-02 | Prioritized My Work queue with explainability | P0 | `lib/operational-ux.ts`, root UI | unit/component tests | **COMPLETE** |
| UX-03 | Unified detail page and breadcrumbs | P0 | root UI | SSR/source tests | **COMPLETE** |
| UX-04 | Permission-aware Work Action Bar | P0 | root UI, action model | unit tests | **COMPLETE** |
| UX-05 | Complete Step wizard and handoff preview | P0 | `lib/repository.ts`, root UI | transition/gating tests | **COMPLETE** |
| UX-06 | Structured blocked/RFI/coordination workflow | P0 | `lib/repository.ts`, root UI | mutation routing tests | **COMPLETE** |
| UX-07 | Notification routing and action center | P1 | repository, root UI | unit tests | **COMPLETE** |
| UX-08 | Escalation intent and recipient preview | P0 | `lib/repository.ts`, root UI | unit tests | **COMPLETE** |
| UX-09 | Exact document revision review | P0 | repository, root UI | version-specific tests | **COMPLETE** |
| UX-10 | Supervisor, State PM, and SpaceX workspaces | P1 | root UI | role routing tests | **COMPLETE** |
| UX-11 | Accessibility, responsive action bar, announcements | P0 | root UI, `app/globals.css` | source tests/manual review | **COMPLETE** |
| UX-12 | Operational journeys documentation | P1 | `docs/operational-ux.md`, progress | doc review | **COMPLETE** |
| CP-01 | Customer project command center | P0 | `app/page.tsx`, customer portal projection | source/component tests | **COMPLETE** |
| CP-02 | Customer-accessible schedule/Gantt | P0 | shell navigation, `WorkstreamGraphGantt` | route/source tests | **COMPLETE** |
| CP-03 | Request center and guided intake | P0 | customer UI, repository, intake model | workflow tests | **COMPLETE** |
| CP-04 | External filing tracking | P0 | domain models, repository, schema/migration | persistence tests | **COMPLETE** |
| CP-05 | Customer escalation lifecycle | P0 | repository, customer/government views | mutation tests | **COMPLETE** |
| CP-06/07 | Profiles, contacts, participants | P0 | domain models, admin/customer UI | model/source tests | **COMPLETE** |
| CP-08/11 | Assignment visibility and exclusive queues | P0 | `lib/operational-ux.ts` | unit tests | **COMPLETE** |
| CP-09 | Complete document lifecycle & private storage | P0 | `lib/supabase/storage.ts`, document center | version/hash tests | **COMPLETE** |
| CP-10 | Permit resource library | P0 | catalog projection and UI | catalog tests | **COMPLETE** |
| CP-12 | Workflow-driven completion | P0 | workflow/repository | gate tests | **COMPLETE** |
| DB-01 | Supabase PostgreSQL Authoritative Runtime | P0 | `lib/supabase/`, `lib/repository.ts` | durability test suite | **COMPLETE** |
| DB-02 | Cross-Browser Persistence & Dual-Context Tests | P0 | `tests/e2e/`, `playwright.config.ts` | Playwright & Node E2E | **COMPLETE** |
| DB-03 | Realtime Multi-Client Synchronization | P0 | `app/page.tsx` Realtime channel | multi-session tests | **COMPLETE** |
