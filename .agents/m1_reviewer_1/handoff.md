# Milestone 1 Code & Schema Review Handoff Report

**Reviewer**: `m1_reviewer_1` (Roles: Reviewer, Adversarial Critic)  
**Target Deliverable**: Milestone 1 Implementation by `m1_worker_1`  
**Verdict**: **`REQUEST_CHANGES`**

---

## 1. Observation

A detailed line-by-line inspection was conducted across all 7 scope files and dependent modules:

### 1.1 PostgreSQL Migration (`supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`)
- Created `public.assignment_groups` (UUID PK, `uq_assignment_groups_org_name UNIQUE (org_code, name)`) and `public.assignment_group_memberships` (UUID PK, `uq_group_user_membership UNIQUE (assignment_group_id, user_id)`).
- Altered `customer_requests`, `workstreams`, and `tasks` with columns `assignment_group_id`, `assigned_to_user_id`, `itsm_state`, `priority`, `statutory_deadline`, `clock_status`, `clock_paused_reason`, `clock_paused_at`, `clock_total_paused_seconds`.
- Added performance indexes `idx_assignment_groups_org`, `idx_customer_requests_assignment`, `idx_workstreams_assignment`, etc.
- Implemented RLS helper functions in `app_private` (`is_assignment_group_member`, `is_fulfiller`, `can_fulfill_group`) with `SECURITY DEFINER` and `SET search_path = public, app_private`.
- Seeded 15 authentic assignment groups across 8 organizations with `ON CONFLICT (org_code, name) DO UPDATE`.
- Defined 5 atomic PostgreSQL RPC functions:
  1. `public.rpc_assign_ticket(p_ticket_id TEXT, p_ticket_type TEXT, p_assignment_group_id UUID, p_assigned_to_user_id UUID DEFAULT NULL, p_assignment_notes TEXT DEFAULT NULL)` (Lines 242–248)
  2. `public.rpc_update_ticket_itsm_state(p_ticket_id TEXT, p_ticket_type TEXT, p_new_state TEXT, p_reason TEXT DEFAULT NULL, p_pause_reason TEXT DEFAULT NULL)` (Lines 380–386)
  3. `public.rpc_set_ticket_priority(p_ticket_id TEXT, p_ticket_type TEXT, p_priority TEXT, p_reason TEXT DEFAULT NULL)` (Lines 544–549)
  4. `public.rpc_manage_assignment_group(p_id UUID DEFAULT NULL, p_org_code TEXT DEFAULT NULL, p_name TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL, p_lead_user_id UUID DEFAULT NULL, p_active BOOLEAN DEFAULT true)` (Lines 608–615)
  5. `public.rpc_manage_assignment_group_membership(p_assignment_group_id UUID, p_user_id UUID, p_role TEXT DEFAULT 'member', p_action TEXT DEFAULT 'upsert')` (Lines 674–679)

### 1.2 Supabase Client Mutations Discrepancy (`lib/supabase/mutations.ts`)
Direct comparison between SQL RPC parameters and `lib/supabase/mutations.ts` reveals **5 critical parameter signature mismatches**:

1. **`mutateAssignTicket`** (lines 1597–1605):
   ```typescript
   // mutations.ts passes:
   const { data, error } = await client.rpc("rpc_assign_ticket", {
     p_ticket_type: params.ticketType,
     p_ticket_id: params.ticketId,
     p_assignment_group_id: params.assignmentGroupId ?? null,
     p_assigned_to_user_id: params.assignedToUserId ?? null,
     p_actor_user_id: params.actorUserId ?? null,       // ❌ NOT in SQL signature (SQL uses auth.uid())
     p_actor_name: params.actorName ?? "System User",   // ❌ NOT in SQL signature (SQL fetches from profiles)
     p_reason: params.reason ?? null,                   // ❌ SQL parameter is named `p_assignment_notes`
   });
   ```

2. **`mutateUpdateTicketITSMState`** (lines 1623–1631):
   ```typescript
   // mutations.ts passes:
   const { data, error } = await client.rpc("rpc_update_ticket_itsm_state", {
     p_ticket_type: params.ticketType,
     p_ticket_id: params.ticketId,
     p_target_state: params.targetState,               // ❌ SQL parameter is named `p_new_state`
     p_actor_user_id: params.actorUserId ?? null,       // ❌ NOT in SQL signature
     p_actor_name: params.actorName ?? "System User",   // ❌ NOT in SQL signature
     p_reason: params.reason ?? null,
     p_pause_reason: params.pauseReason ?? null,
   });
   ```

3. **`mutateSetTicketPriority`** (lines 1648–1655):
   ```typescript
   // mutations.ts passes:
   const { data, error } = await client.rpc("rpc_set_ticket_priority", {
     p_ticket_type: params.ticketType,
     p_ticket_id: params.ticketId,
     p_priority: params.priority,
     p_actor_user_id: params.actorUserId ?? null,       // ❌ NOT in SQL signature
     p_actor_name: params.actorName ?? "System User",   // ❌ NOT in SQL signature
     p_reason: params.reason ?? null,
   });
   ```

4. **`mutateManageAssignmentGroup`** (lines 1674–1683):
   ```typescript
   // mutations.ts passes:
   const { data, error } = await client.rpc("rpc_manage_assignment_group", {
     p_action: params.action,                           // ❌ NOT in SQL signature
     p_group_id: params.groupId ?? null,               // ❌ SQL parameter is named `p_id`
     p_org_code: params.orgCode ?? null,
     p_name: params.name ?? null,
     p_description: params.description ?? null,
     p_lead_user_id: params.leadUserId ?? null,
     p_actor_user_id: params.actorUserId ?? null,       // ❌ NOT in SQL signature
     p_actor_name: params.actorName ?? "System Admin",  // ❌ NOT in SQL signature
   });
   ```

5. **`mutateManageAssignmentGroupMembership`** (lines 1701–1709):
   ```typescript
   // mutations.ts passes:
   const { data, error } = await client.rpc("rpc_manage_assignment_group_membership", {
     p_action: params.action,
     p_membership_id: params.membershipId ?? null,     // ❌ NOT in SQL signature
     p_group_id: params.groupId ?? null,               // ❌ SQL parameter is named `p_assignment_group_id`
     p_user_id: params.userId ?? null,
     p_role: params.role ?? "member",
     p_actor_user_id: params.actorUserId ?? null,       // ❌ NOT in SQL signature
     p_actor_name: params.actorName ?? "System Admin",  // ❌ NOT in SQL signature
   });
   ```

### 1.3 Domain Models & Algorithms (`lib/domain-models.ts`)
- All required interfaces (`AssignmentGroupRecord`, `AssignmentGroupMembershipRecord`, `TicketRecord`, `StatutoryClockState`, `PriorityMatrixEntry`) conform to `PROJECT.md` contracts.
- Calculation functions (`calculatePriority`, `calculateStatutoryClock`) and validation helpers (`parseITSMState`, `parsePriorityLevel`, `mapOperationalStateToITSMState`, `mapITSMStateToOperationalState`, `mapCustomerRequestStatusToITSMState`) are robust, pure algorithms.

### 1.4 Drizzle ORM Schema (`db/schema.ts`)
- Exported `assignmentGroups`, `assignmentGroupMemberships`, and updated `workstreams`, `customerRequests`, `tasks`.
- Defined complete relational bindings in `assignmentGroupsRelations`, `assignmentGroupMembershipsRelations`, `workstreamsRelations`, `customerRequestsRelations`, `tasksRelations`.

### 1.5 Repository Layer (`lib/repository.ts`)
- Implemented query and mutation methods for assignment groups and ticket states with dual-mode persistence (`assignTicket`, `assignTicketPersisted`, `updateTicketITSMState`, `updateTicketITSMStatePersisted`, etc.).
- Preserved offline fallback and deterministic demo fixtures.

### 1.6 Build and Test Results
- `npm run build`: Exit code 0 (All routes and bundles compiled cleanly).
- `node --test --test-concurrency=1 tests/*.test.mjs`: 309/309 tests passed across 22 test suites with 0 failures, 0 regressions.

---

## 2. Logic Chain

1. PostgREST executes RPC functions by mapping JSON body keys directly to PostgreSQL function argument names and types.
2. If the JSON payload sent by `@supabase/supabase-js` contains keys that do not match the function parameter names (such as `p_reason` instead of `p_assignment_notes`, `p_target_state` instead of `p_new_state`, `p_group_id` instead of `p_id` / `p_assignment_group_id`), or contains extraneous arguments (`p_actor_user_id`, `p_actor_name`, `p_membership_id`), PostgREST will fail with HTTP 404 / 400 "function not found" / "could not choose best candidate function".
3. In local unit test execution without an active Supabase server, `isSupabaseConfigured()` returns false, causing `repository.assignTicketPersisted()`, `repository.updateTicketITSMStatePersisted()`, and `repository.setTicketPriorityPersisted()` to execute only the in-memory mutation branch without exercising the PostgreSQL RPC network call.
4. As a result, the tests passed 100%, but live database operations in Milestone 2 through Milestone 4 will immediately fail upon executing any of these 5 persisted mutations.
5. Therefore, changes are required to align `lib/supabase/mutations.ts` with the SQL migration function signatures before Milestone 1 can be certified.

---

## 3. Review Findings & Challenges

### [Critical] Finding 1: RPC Parameter Name and Arity Mismatch in `lib/supabase/mutations.ts`
- **Location**: `lib/supabase/mutations.ts` (lines 1586–1714) vs `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql` (lines 242, 380, 544, 608, 674)
- **Why**: PostgREST RPC dispatch fails when named parameters do not match Postgres function declarations.
- **Remediation**:
  Update `lib/supabase/mutations.ts` to pass exact argument maps:
  - `mutateAssignTicket`:
    ```typescript
    const { data, error } = await client.rpc("rpc_assign_ticket", {
      p_ticket_id: params.ticketId,
      p_ticket_type: params.ticketType,
      p_assignment_group_id: params.assignmentGroupId,
      p_assigned_to_user_id: params.assignedToUserId ?? null,
      p_assignment_notes: params.reason ?? null,
    });
    ```
  - `mutateUpdateTicketITSMState`:
    ```typescript
    const { data, error } = await client.rpc("rpc_update_ticket_itsm_state", {
      p_ticket_id: params.ticketId,
      p_ticket_type: params.ticketType,
      p_new_state: params.targetState,
      p_reason: params.reason ?? null,
      p_pause_reason: params.pauseReason ?? null,
    });
    ```
  - `mutateSetTicketPriority`:
    ```typescript
    const { data, error } = await client.rpc("rpc_set_ticket_priority", {
      p_ticket_id: params.ticketId,
      p_ticket_type: params.ticketType,
      p_priority: params.priority,
      p_reason: params.reason ?? null,
    });
    ```
  - `mutateManageAssignmentGroup`:
    ```typescript
    const { data, error } = await client.rpc("rpc_manage_assignment_group", {
      p_id: params.groupId ?? null,
      p_org_code: params.orgCode ?? null,
      p_name: params.name ?? null,
      p_description: params.description ?? null,
      p_lead_user_id: params.leadUserId ?? null,
      p_active: params.action !== "deactivate",
    });
    ```
  - `mutateManageAssignmentGroupMembership`:
    ```typescript
    const { data, error } = await client.rpc("rpc_manage_assignment_group_membership", {
      p_assignment_group_id: params.groupId,
      p_user_id: params.userId,
      p_role: params.role ?? "member",
      p_action: params.action === "remove" ? "delete" : "upsert",
    });
    ```

### [Minor] Finding 2: Missing direct unit tests for `lib/supabase/mutations.ts` RPC parameter schemas
- **Location**: `tests/itsm-assignment-groups-persistence.test.mjs`
- **Why**: Unit tests checked SQL string inclusion and in-memory repository methods, but did not assert parameter payload compatibility for the Supabase RPC functions.
- **Suggestion**: Add parameter assertions verifying that the mutation caller payloads match the SQL function parameter signatures.

---

## 4. Integrity Check

- **Hardcoded test results**: None detected. All domain calculations and statutory clock formulas are real algorithmic code.
- **Facade implementations**: None detected. All Drizzle schemas, repository state stores, and SQL tables are fully implemented.
- **Task shortcuts / external bypassing**: None detected.
- **Fabricated verification logs**: None.

---

## 5. Verified Claims

| Claim | Method | Result |
|---|---|---|
| Drizzle schema exports all 22+ tables and ITSM relations | Checked `db/schema.ts` exports and relation objects | PASS |
| 15 Assignment Groups span 8 organizations | Inspected fixture and migration seeds | PASS |
| Priority Matrix 4x4 logic and fallbacks | Tested via domain model calculation suite | PASS |
| Statutory Clock handles active/pause/resumed states | Tested via engine calculation suite | PASS |
| Clean compilation | Executed `npm run build` | PASS (exit 0) |
| Full regression test suite | Executed `node --test --test-concurrency=1 tests/*.test.mjs` | PASS (309/309) |

---

## 6. Caveats

- In-memory repository, domain models, and Drizzle schemas are in excellent shape.
- Once the 5 RPC parameter mismatches in `lib/supabase/mutations.ts` are resolved, Milestone 1 will be fully complete and ready for approval.

---

## 7. Conclusion

**Verdict**: **`REQUEST_CHANGES`**

Milestone 1 implementation is high quality, well structured, and passes build and unit tests, but contains a critical parameter mismatch in `lib/supabase/mutations.ts` across all 5 new Supabase RPC callers. Resolving these parameter names and signatures will make the data layer fully functional against live Supabase PostgreSQL.

---

## 8. Verification Method

To verify the required fix:
1. Review `lib/supabase/mutations.ts` lines 1586–1714 against `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql` function signatures.
2. Run build verification:
   ```bash
   npm run build
   ```
3. Run full test suite:
   ```bash
   node --test --test-concurrency=1 tests/*.test.mjs
   ```
