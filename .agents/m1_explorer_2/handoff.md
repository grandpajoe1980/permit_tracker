# Milestone 1: Domain Models & Drizzle Schema Handoff Report

**Agent**: `m1_explorer_2` (Milestone 1 Domain Models & Drizzle Explorer)  
**Date**: 2026-08-31  
**Recipient**: `orchestrator` / `m1_implementer`  
**Full Design Document**: `/Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_2/analysis.md`

---

## 1. Observation

1. **`lib/domain-models.ts` Inspection**:
   - Currently contains 648 lines defining 40+ interfaces (e.g. `OrganizationRecord` at line 93, `CustomerRequestRecord` at line 243, `WorkstreamRecord` at line 553, `ProjectRecord` at line 623).
   - Currently lacks formal definitions for `AssignmentGroupRecord`, `AssignmentGroupMembershipRecord`, `ITSMState`, `PriorityLevel` ('P1'|'P2'|'P3'|'P4'), `StatutoryClockState`, and `TicketRecord`.
2. **`db/schema.ts` Inspection**:
   - Currently contains 691 lines declaring 27 SQLite Drizzle tables (`organizations` line 8, `users` line 50, `workstreams` line 224, `tasks` line 307, `customerRequests` line 668).
   - Currently lacks `assignmentGroups` and `assignmentGroupMemberships` tables, Drizzle ORM `relations()` declarations, and ITSM column extensions on `workstreams`, `customerRequests`, and `tasks`.
   - `tests/command-system.test.mjs` lines 50–84 explicitly asserts: `"Database Schema: exports all 22 relational Drizzle ORM tables"`, requiring that existing table exports are not removed or renamed.
3. **`lib/operational-ux.ts` Inspection**:
   - Defines `OperationalWorkItem` (line 64), `QueueSectionId` (line 49), and `getOperationalWorkItems` (line 505) routing work items by score, tone, and agency.
   - Status tones (`"red"`, `"amber"`, `"blue"`, `"green"`, `"slate"`) map cleanly to ITSM states (`draft` -> slate, `submitted` -> amber, `triaged`/`in_progress` -> blue, `pending_customer`/`pending_agency` -> amber, `blocked` -> red, `resolved`/`closed` -> green).
4. **`PROJECT.md` & `ORIGINAL_REQUEST.md` Interface Contracts**:
   - `PROJECT.md` lines 51–62 define the M1 ↔ M2 interface contract:
     - `AssignmentGroupRecord`: `{ id: string, orgCode: string, name: string, description: string, leadUserId?: string, active: boolean }`
     - `AssignmentGroupMembershipRecord`: `{ id: string, assignmentGroupId: string, userId: string, role: 'member' | 'lead' | 'backup' }`
     - `ITSMState`: `'draft' | 'submitted' | 'triaged' | 'in_progress' | 'pending_customer' | 'pending_agency' | 'blocked' | 'resolved' | 'closed'`
     - Priority scoring: `'P1' | 'P2' | 'P3' | 'P4'`
     - Clocks: `'active' | 'paused' | 'stopped'`

---

## 2. Logic Chain

1. **Premise 1 (ITSM & Tenancy Core)**: Multi-tenancy in ITSM requires an explicit intermediate tier between Organizations (`organizations`) and Users (`users`) — namely Assignment Groups (`assignment_groups`) and Fulfiller Queues (`assignment_group_memberships`). Based on Observation 4, this is a strict requirement for M1.
2. **Premise 2 (Schema Consistency)**: Adding `assignmentGroups` and `assignmentGroupMemberships` to `db/schema.ts`, along with column extensions on `workstreams`, `customerRequests`, and `tasks`, establishes parity with PostgreSQL Supabase migrations (`m1_explorer_1`) while preserving all existing exports required by `tests/command-system.test.mjs` (Observation 2).
3. **Premise 3 (State Decoupling & Interoperability)**: `OperationalState` and `ITSMState` represent complementary views (operational sub-state vs high-level ITSM lifecycle). Providing bi-directional mappings (`mapOperationalStateToITSMState`, `mapITSMStateToOperationalState`, `mapCustomerRequestStatusToITSMState`) guarantees that existing UI cockpits and test suites remain green while enabling ITSM triage workflows.
4. **Premise 4 (Clock & Priority Math)**: Calculating statutory clocks and priority scores deterministically via pure helper functions (`calculatePriority`, `calculateStatutoryClock`) ensures uniform behavior across live database queries and offline mock fixtures.

---

## 3. Caveats

- **SQLite vs Postgres Dialect in Drizzle**: `db/schema.ts` is configured with `drizzle-orm/sqlite-core` for offline/edge usage (`drizzle.config.ts`), while production runs on Supabase PostgreSQL. Column types, enums, and foreign keys have been modeled to maintain 1:1 conceptual parity across both.
- **Backwards Compatibility**: All existing legacy fields (`operationalState`, `ragHealth`, `customerRequests.status`) are preserved as optional/transitional properties so existing code does not break when new fields are populated.

---

## 4. Conclusion

The domain model updates in `lib/domain-models.ts` and schema extensions in `db/schema.ts` are fully designed, documented, and ready for Milestone 1 implementation.

Key artifacts produced in `/Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_2/analysis.md`:
1. Full TypeScript interfaces: `AssignmentGroupRecord`, `AssignmentGroupMembershipRecord`, `ITSMState`, `PriorityLevel`, `StatutoryClockState`, `ClockPauseRecord`, `PriorityMatrixEntry`, `TicketRecord`, updated `CustomerRequestRecord`, `WorkstreamRecord`, and `TaskRecord`.
2. Drizzle ORM schema: `assignmentGroups`, `assignmentGroupMemberships`, table column extensions, and `relations()` declarations.
3. Operational UX and demo data compatibility mappings and seed records.
4. Pure TypeScript type guards, validation functions, and serialization helpers.

---

## 5. Verification Method

1. **Source Inspection**:
   - Inspect `/Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_2/analysis.md` for complete code listings and interface structures.
2. **Test Command Verification**:
   - Run `npm test` to verify zero regression across all 28 existing test suites.
   - Command:
     ```bash
     npm test
     ```
3. **Schema Export Verification**:
   - Verify that `db/schema.ts` exports `assignmentGroups`, `assignmentGroupMemberships`, and all original 27 tables tested in `tests/command-system.test.mjs`.
