# Milestone 1 Database & SQL Schema Handoff Report

**Date**: 2026-08-31  
**Agent**: `m1_explorer_1` (Milestone 1 Database & SQL Schema Explorer)  
**Parent / Recipient**: `parent` (`6c0c2ad6-b060-4ca1-812d-09c87e71801e`)  
**Design Reference**: `/Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_1/analysis.md`  

---

## 1. Observation

1. **Existing Migrations & Data Architecture**:
   - `supabase/migrations/20260828170355_initial_path_mvp.sql` established the base schemas with `organizations`, `customer_organizations`, `profiles`, `organization_memberships`, `projects`, `project_participants`, and `workflow_stages`.
   - `supabase/migrations/20260830120000_customer_portal_delivery.sql` introduced `user_profiles`, `external_filings`, and `customer_requests`.
   - `supabase/migrations/20260830190000_authoritative_access_boundary.sql` and `20260830191500_secure_rpc_actor_context.sql` revoked direct mutations by `anon` and `authenticated`, enforcing authenticated transactions via `app_private` security definer helper functions and `public.rpc_*` functions.
   - `supabase/migrations/20260830225000_atomic_multi_workstream_triage.sql` established `public.rpc_triage_customer_request` for atomic fan-out of customer requests into multiple agency workstreams.

2. **Interface Contracts & Requirements in PROJECT.md**:
   - Section *Interface Contracts (M1 ↔ M2)* (lines 51–62) defines:
     - `AssignmentGroupRecord`: `{ id: string, orgCode: string, name: string, description: string, leadUserId?: string, active: boolean }`
     - `AssignmentGroupMembershipRecord`: `{ id: string, assignmentGroupId: string, userId: string, role: 'member' | 'lead' | 'backup' }`
     - Extended `customer_requests`, `workstreams`, and `tasks` with `assignment_group_id`, `assigned_to_user_id`, `itsm_state`, `priority` (P1-P4), `statutory_deadline`, `clock_status` ('active' | 'paused' | 'stopped'), and `clock_paused_reason`.
     - ITSM States: `'draft' | 'submitted' | 'triaged' | 'in_progress' | 'pending_customer' | 'pending_agency' | 'blocked' | 'resolved' | 'closed'`.
     - Priority: `'P1' | 'P2' | 'P3' | 'P4'`.

3. **Current Multi-Agency Data & Personas**:
   - `lib/spacex-megaproject-fixture.ts` lines 19–179 and `lib/customer-portal.ts` lines 15–150 define 8 distinct organizations (SpaceX, Governor's Project Office / LA-PROJECTS, DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish, plus USACE and LED) and key demo personas (Alex Martin, Maya Chen, Sam Rivera, Jordan Lee, Riley Brooks, Sarah Johnson, Joe Skaggs, Dr. Aris Thorne).

---

## 2. Logic Chain

1. **Step 1 (Schema & Table Modeling)**: Because the platform is transitioning to a full multi-agency ITSM and project management system, assignment queues must be modeled as relational entities in PostgreSQL. Creating `public.assignment_groups` and `public.assignment_group_memberships` allows tickets and work items to be assigned to dedicated agency queues and individual fulfillers, satisfying Requirement R1 and Feature F2.
2. **Step 2 (ITSM State Machine & Statutory Clock)**: By adding `itsm_state`, `priority`, `statutory_deadline`, `clock_status`, `clock_paused_at`, and `clock_total_paused_seconds` across `customer_requests`, `workstreams`, and `tasks`, both high-level customer requests and low-level task nodes share a unified lifecycle state machine while maintaining precise SLA tracking and paused duration accounting.
3. **Step 3 (RLS Security & Access Boundaries)**: Following Supabase Postgres best practices, table-level RLS is enabled on `assignment_groups` and `assignment_group_memberships`, direct mutation privileges are revoked from `anon` and `authenticated`, and access is protected via `app_private` helper functions (`is_assignment_group_member`, `is_fulfiller`, `can_fulfill_group`).
4. **Step 4 (Atomic RPC Transactions & Audit Ledger)**: State transitions and ticket assignments must not be performed via uncoordinated direct table updates. Exposing `public.rpc_assign_ticket`, `public.rpc_update_ticket_itsm_state`, `public.rpc_set_ticket_priority`, `public.rpc_manage_assignment_group`, and `public.rpc_manage_assignment_group_membership` guarantees atomic updates, automatic clock pause/resume duration computation, and immutable event logging to `public.audit_events`.
5. **Step 5 (Seed Data & Parity)**: Seeding 15 multi-agency assignment groups and their group memberships for existing profiles ensures live Supabase database instances and offline mock fixtures in `lib/repository.ts` operate with identical data structures and identifiers.

---

## 3. Caveats

1. **UUID vs String ID Compatibility**: Existing demo fixtures use both UUIDs (e.g. in Supabase migrations) and string IDs (e.g. `user-alex-martin`, `WS-LA82-HEAVYHAUL` in TypeScript fixtures). The migration uses `gen_random_uuid()` for `assignment_groups.id` with deterministic hex UUIDs for initial seeded rows (`d0000000-0000-0000-0000-000000000001` through `0015`), which map cleanly in both live Supabase SQL and TypeScript client mappings.
2. **Task & Customer Request ID Types**: In earlier migrations, `tasks.id` and `customer_requests.id` use `TEXT` primary keys, while `assignment_groups.id` uses `UUID`. The foreign keys on altered columns use `UUID` references with text casting where appropriate in client queries.

---

## 4. Conclusion

The complete database migration design for Milestone 1 has been formulated and documented in `/Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_1/analysis.md`. It includes:
- **Migration Script**: `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`
- **Tables**: `assignment_groups`, `assignment_group_memberships`
- **Table Alterations**: `customer_requests`, `workstreams`, `tasks` (ITSM states, P1-P4 priorities, statutory deadlines, clock pause/resume attributes)
- **RLS & Security Functions**: `app_private.is_assignment_group_member`, `app_private.is_fulfiller`, `app_private.can_fulfill_group`
- **RPC Functions**: `rpc_assign_ticket`, `rpc_update_ticket_itsm_state`, `rpc_set_ticket_priority`, `rpc_manage_assignment_group`, `rpc_manage_assignment_group_membership`
- **Seed Data**: 15 assignment groups across 8 agencies and backfilled ticket states.

The design is ready for immediate implementation by `m1_coder_1`.

---

## 5. Verification Method

1. **Inspect Analysis Document**:
   - Verify design document exists at `/Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_1/analysis.md`.
2. **SQL Syntax & Invariant Check**:
   - When the migration file is created at `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`, verify that:
     - All table creations have `CREATE TABLE IF NOT EXISTS`.
     - All column alterations have `ADD COLUMN IF NOT EXISTS`.
     - All check constraints match the valid enum values (`draft`, `submitted`, `triaged`, `in_progress`, `pending_customer`, `pending_agency`, `blocked`, `resolved`, `closed` and `P1`-`P4`).
     - Functions have explicit `SET search_path = public, app_private`.
     - Functions revoke execution from `public, anon` and grant to `authenticated`.
3. **Automated Test Run**:
   - Run project test command: `node --test tests/*.test.mjs`
