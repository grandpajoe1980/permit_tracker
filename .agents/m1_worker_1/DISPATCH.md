## 2026-08-31T13:28:38Z
You are m1_worker_1 (role: Milestone 1 Implementation Lead).
Your working directory is /Users/joe/Repos/Permit/permit_tracker/.agents/m1_worker_1 (create it and write metadata/handoff files only within your directory).

Authoritative Request:
/Users/joe/Repos/Permit/permit_tracker/.agents/ORIGINAL_REQUEST.md
Master Project Plan:
/Users/joe/Repos/Permit/permit_tracker/PROJECT.md
Explorer Designs:
1. Database & SQL: /Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_1/analysis.md
2. Domain Models & Drizzle: /Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_2/analysis.md
3. Repository & Fixtures: /Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_3/analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Write Ownership for Milestone 1:
You own writing and editing the following files:
1. `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`: Complete PostgreSQL schema for `assignment_groups`, `assignment_group_memberships`, column alterations for `customer_requests`, `workstreams`, `tasks` (assignment_group_id, assigned_to_user_id, itsm_state, priority, statutory_deadline, clock_status, clock_paused_reason, clock_paused_at, clock_total_paused_seconds), RLS policies, RPCs (`rpc_assign_ticket`, `rpc_update_ticket_itsm_state`, `rpc_set_ticket_priority`, `rpc_manage_assignment_group`, `rpc_manage_assignment_group_membership`), and seed data for 15 assignment groups across 8 organizations.
2. `lib/domain-models.ts`: Add `AssignmentGroupRecord`, `AssignmentGroupMembershipRecord`, `ITSMState`, `PriorityLevel`, `StatutoryClockState`, `ClockStatus`, `TicketRecord`, and update `CustomerRequestRecord`, `WorkstreamRecord`, `TaskRecord`.
3. `db/schema.ts`: Add Drizzle ORM table definitions for `assignmentGroups`, `assignmentGroupMemberships`, table column extensions, and relations without removing any existing table exports.
4. `lib/repository.ts`: Implement `getAssignmentGroups()`, `getAssignmentGroupMembers()`, `assignTicket()`, `assignTicketToGroup()`, `assignTicketToFulfiller()`, `updateTicketITSMState()`, `updateStatutoryClock()`, `setTicketPriority()`, `createAssignmentGroup()`, `addAssignmentGroupMember()`, and async `*Persisted` counterparts.
5. `lib/supabase/mutations.ts`: Add `mutateAssignTicket`, `mutateUpdateTicketITSMState`, `mutateSetTicketPriority`, `mutateManageAssignmentGroup`, `mutateManageAssignmentGroupMembership`.
6. `lib/spacex-megaproject-fixture.ts`: Export `assignmentGroupsData` and `assignmentGroupMembershipsData` for DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish, Governor's Project Office, and SpaceX.
7. `tests/itsm-assignment-groups-persistence.test.mjs`: Create comprehensive unit & integration tests verifying assignment group operations, ITSM state transitions, statutory clock pause/resume, and dual-mode hydration.
8. Git Checkpoint: Create clean git commit with message `checkpoint(m1): implement itsm multi-tenancy assignment groups and persistence model`.

Verification requirement:
Run `npm run build` and `node --test --test-concurrency=1 tests/*.test.mjs` to verify that the build succeeds cleanly, new tests pass 100%, and all existing 28 test suites pass with zero regressions.

Write your handoff report to /Users/joe/Repos/Permit/permit_tracker/.agents/m1_worker_1/handoff.md with passing command outputs and communicate completion back to orchestrator.
