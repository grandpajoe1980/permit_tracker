# BRIEFING — 2026-08-31T13:14:00Z

## Mission
Map current codebase architecture regarding Data Modeling, Supabase Persistence, Mock/Offline Fallback, Multi-Tenancy, and ITSM/PM Lifecycle States.

## 🔒 My Identity
- Archetype: explorer
- Roles: Data Model & Persistence Explorer
- Working directory: /Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_1
- Original parent: 6c0c2ad6-b060-4ca1-812d-09c87e71801e
- Milestone: Survey & Architecture Discovery

## 🔒 Key Constraints
- Read-only investigation — do NOT implement application code changes.
- Output comprehensive report to `analysis.md` and summary in `handoff.md`.
- Send message back to parent agent upon completion.

## Current Parent
- Conversation ID: 6c0c2ad6-b060-4ca1-812d-09c87e71801e
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `supabase/migrations/` (29 SQL migration files)
  - `db/schema.ts`, `db/index.ts`
  - `lib/domain-models.ts`, `lib/demo-data.ts`, `lib/operational-ux.ts`, `lib/customer-portal.ts`, `lib/spacex-megaproject-fixture.ts`
  - `lib/repository.ts`, `lib/data-mode.ts`
  - `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/queries.ts`, `lib/supabase/mutations.ts`, `lib/supabase/storage.ts`, `lib/supabase/storage-primitives.ts`, `lib/document-download-utils.ts`
  - `lib/engines/` (`workflow-engine.ts`, `schedule-engine.ts`, `escalation-engine.ts`, `coordination-engine.ts`, `audit-engine.ts`, `sla-worker.ts`)
  - `components/cockpits/`, `components/admin/AdminDirectory.tsx`, `components/documents/DocumentViewerModal.tsx`
  - `app/page.tsx`, `app/projects/`, `app/requests/`
  - `scripts/`, `tests/`
- **Key findings**:
  - Supabase PostgreSQL is the authoritative persistence engine with 29 migrations, atomic RPC functions, and RLS policies.
  - Complete TypeScript domain models exist in `lib/domain-models.ts` with offline fallback in `lib/repository.ts`.
  - Multi-tenancy currently operates at Company/Agency and individual user level, with a major GAP in first-class Assignment Groups (no `assignment_groups` table or model).
  - ITSM states are fragmented across 4 different state models (`customer_requests`, `workstreams`, `requests`, `ServiceRequest`) and need standardization to standard 9-state ITSM lifecycle.
  - In-ticket workflow editing is missing (current designer only edits global draft templates, not live ticket DAGs).
  - Document vault and attachments use SHA-256 + private Storage bucket with download utilities.
- **Unexplored areas**: None. Complete survey achieved.

## Key Decisions Made
- Authored comprehensive architectural analysis in `/Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_1/analysis.md`.
- Formulated 5-component handoff in `/Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_1/handoff.md`.

## Artifact Index
- `/Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_1/analysis.md` — Comprehensive Data Model, Persistence, Multi-Tenancy & ITSM/PM Architecture Analysis
- `/Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_1/handoff.md` — 5-Component Handoff Report for Orchestrator
