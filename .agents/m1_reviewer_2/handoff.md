# Milestone 1 Security & Persistence Review Handoff Report

## 1. Observation

### 1.1 PostgreSQL Migration & Security Infrastructure (`supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`)
- Created tables `public.assignment_groups` and `public.assignment_group_memberships` with primary keys, unique constraints `(org_code, name)` and `(assignment_group_id, user_id)`, foreign key references to `organizations` and `auth.users`, and CASCADE/SET NULL delete rules (lines 45-66).
- Altered `customer_requests`, `workstreams`, and `tasks` with `assignment_group_id`, `assigned_to_user_id`, `assigned_org_code`, `itsm_state`, `priority`, `statutory_deadline`, `clock_status`, `clock_paused_reason`, `clock_paused_at`, `clock_total_paused_seconds` (lines 72-118).
- Defined helper functions in `app_private` (`is_assignment_group_member`, `is_fulfiller`, `can_fulfill_group`) with `SECURITY DEFINER` and `SET search_path = public, app_private` (lines 144-192). Direct public execution revoked; `GRANT EXECUTE` given to `authenticated`.
- Enabled RLS on `assignment_groups` and `assignment_group_memberships` and revoked direct `INSERT, UPDATE, DELETE` from `authenticated` and `anon` (lines 198-204).
- Defined 5 atomic PL/pgSQL RPC functions with `SECURITY DEFINER` and `SET search_path = public, app_private`:
  1. `public.rpc_assign_ticket(p_ticket_id TEXT, p_ticket_type TEXT, p_assignment_group_id UUID, p_assigned_to_user_id UUID DEFAULT NULL, p_assignment_notes TEXT DEFAULT NULL)` (lines 242-376)
  2. `public.rpc_update_ticket_itsm_state(p_ticket_id TEXT, p_ticket_type TEXT, p_new_state TEXT, p_reason TEXT DEFAULT NULL, p_pause_reason TEXT DEFAULT NULL)` (lines 380-539)
  3. `public.rpc_set_ticket_priority(p_ticket_id TEXT, p_ticket_type TEXT, p_priority TEXT, p_reason TEXT DEFAULT NULL)` (lines 543-605)
  4. `public.rpc_manage_assignment_group(p_id UUID DEFAULT NULL, p_org_code TEXT DEFAULT NULL, p_name TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL, p_lead_user_id UUID DEFAULT NULL, p_active BOOLEAN DEFAULT true)` (lines 608-671)
  5. `public.rpc_manage_assignment_group_membership(p_assignment_group_id UUID, p_user_id UUID, p_role TEXT DEFAULT 'member', p_action TEXT DEFAULT 'upsert')` (lines 674-723)

### 1.2 RPC Parameter Signature Discrepancies (`lib/supabase/mutations.ts`)
Direct comparison between TypeScript client wrappers in `lib/supabase/mutations.ts` and PostgreSQL RPC definitions in `20260831140000_itsm_assignment_groups_and_states.sql`:

1. `mutateAssignTicket` (`lib/supabase/mutations.ts` lines 1586–1606):
   - **TS client passes**:
     ```ts
     client.rpc("rpc_assign_ticket", {
       p_ticket_type: params.ticketType,
       p_ticket_id: params.ticketId,
       p_assignment_group_id: params.assignmentGroupId ?? null,
       p_assigned_to_user_id: params.assignedToUserId ?? null,
       p_actor_user_id: params.actorUserId ?? null,
       p_actor_name: params.actorName ?? "System User",
       p_reason: params.reason ?? null,
     });
     ```
   - **SQL signature expects**: `(p_ticket_id TEXT, p_ticket_type TEXT, p_assignment_group_id UUID, p_assigned_to_user_id UUID DEFAULT NULL, p_assignment_notes TEXT DEFAULT NULL)`
   - **Mismatch**: Parameter names `p_actor_user_id` and `p_actor_name` do not exist in SQL; parameter `p_reason` is named `p_assignment_notes` in SQL.

2. `mutateUpdateTicketITSMState` (`lib/supabase/mutations.ts` lines 1612–1635):
   - **TS client passes**:
     ```ts
     client.rpc("rpc_update_ticket_itsm_state", {
       p_ticket_type: params.ticketType,
       p_ticket_id: params.ticketId,
       p_target_state: params.targetState,
       p_actor_user_id: params.actorUserId ?? null,
       p_actor_name: params.actorName ?? "System User",
       p_reason: params.reason ?? null,
       p_pause_reason: params.pauseReason ?? null,
     });
     ```
   - **SQL signature expects**: `(p_ticket_id TEXT, p_ticket_type TEXT, p_new_state TEXT, p_reason TEXT DEFAULT NULL, p_pause_reason TEXT DEFAULT NULL)`
   - **Mismatch**: Parameter `p_target_state` is named `p_new_state` in SQL; parameters `p_actor_user_id` and `p_actor_name` do not exist in SQL.

3. `mutateSetTicketPriority` (`lib/supabase/mutations.ts` lines 1638–1659):
   - **TS client passes**:
     ```ts
     client.rpc("rpc_set_ticket_priority", {
       p_ticket_type: params.ticketType,
       p_ticket_id: params.ticketId,
       p_priority: params.priority,
       p_actor_user_id: params.actorUserId ?? null,
       p_actor_name: params.actorName ?? "System User",
       p_reason: params.reason ?? null,
     });
     ```
   - **SQL signature expects**: `(p_ticket_id TEXT, p_ticket_type TEXT, p_priority TEXT, p_reason TEXT DEFAULT NULL)`
   - **Mismatch**: Parameters `p_actor_user_id` and `p_actor_name` do not exist in SQL.

4. `mutateManageAssignmentGroup` (`lib/supabase/mutations.ts` lines 1662–1687):
   - **TS client passes**: `{ p_action, p_group_id, p_org_code, p_name, p_description, p_lead_user_id, p_actor_user_id, p_actor_name }`
   - **SQL signature expects**: `(p_id UUID DEFAULT NULL, p_org_code TEXT DEFAULT NULL, p_name TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL, p_lead_user_id UUID DEFAULT NULL, p_active BOOLEAN DEFAULT true)`
   - **Mismatch**: `p_action` and `p_group_id` do not match `p_id`; `p_actor_user_id` and `p_actor_name` do not exist in SQL.

5. `mutateManageAssignmentGroupMembership` (`lib/supabase/mutations.ts` lines 1690–1714):
   - **TS client passes**: `{ p_action, p_membership_id, p_group_id, p_user_id, p_role, p_actor_user_id, p_actor_name }`
   - **SQL signature expects**: `(p_assignment_group_id UUID, p_user_id UUID, p_role TEXT DEFAULT 'member', p_action TEXT DEFAULT 'upsert')`
   - **Mismatch**: `p_group_id` vs `p_assignment_group_id`; `p_membership_id`, `p_actor_user_id`, `p_actor_name` do not exist in SQL; TS action string `'remove'` does not match SQL delete check (`IF p_action = 'delete'`).

### 1.3 Repository & Dual-Mode Hydration (`lib/repository.ts`)
- Repository implements dual hydration via `hydrateFromSupabase()` and fallback in-memory state initialized from `lib/spacex-megaproject-fixture.ts` (lines 120-227).
- In-memory mutations (`assignTicket`, `updateTicketITSMState`, `updateStatutoryClock`, `setTicketPriority`, `createAssignmentGroup`, `addAssignmentGroupMember`) accurately maintain state, audit events, and notifications.
- Persisted mutations (`assignTicketPersisted`, `updateTicketITSMStatePersisted`, `setTicketPriorityPersisted`) call `mutateAssignTicket`, `mutateUpdateTicketITSMState`, `mutateSetTicketPriority` when `isSupabaseConfigured()` is true (lines 2120-2189).

### 1.4 Verification Execution Results
- `npm run build`: Exit code 0 (All routes and bundles compiled cleanly).
- `node --test --test-concurrency=1 tests/*.test.mjs`:
  - 22 suites, 309 subtests executed.
  - 309 passed, 0 failed.

---

## 2. Logic Chain

1. In Supabase and PostgREST, client RPC calls (`client.rpc('rpc_name', payload)`) match JSON payload property keys to PostgreSQL function parameter names.
2. If the client payload contains parameter keys that do not exist in the database function signature (such as `p_actor_user_id`, `p_actor_name`), or if key names differ (such as `p_target_state` vs `p_new_state`, `p_reason` vs `p_assignment_notes`, `p_group_id` vs `p_assignment_group_id`), PostgREST fails to resolve the RPC endpoint and returns `404 / 400 Could not find function in schema cache`.
3. In `20260831140000_itsm_assignment_groups_and_states.sql`, the RPC functions derive the actor context internally from `auth.uid()` (`v_actor_id := auth.uid()`), which is good security design to prevent impersonation.
4. However, `lib/supabase/mutations.ts` passes client-side `p_actor_user_id`, `p_actor_name`, and discordant parameter names.
5. Consequently, when connected to a live Supabase instance (`isSupabaseConfigured() = true`), all 5 ITSM mutation RPCs will fail at runtime.
6. Therefore, the implementation requires alignment between TypeScript mutation wrappers (`lib/supabase/mutations.ts`) and PostgreSQL RPC signatures before Milestone 1 can be certified for live persistence.

---

## 3. Caveats

- In offline fixture mode (`isSupabaseConfigured() = false`), `repository.assignTicket()`, `repository.updateTicketITSMState()`, and `repository.setTicketPriority()` operate purely in memory and succeed 100%, which is why the unit and integration tests passed.
- The SQL schema design, DDL tables, indexes, RLS policies, and helper functions in `app_private` are secure, robust, and correctly implemented.
- The defect is strictly localized to the interface contract parameter alignment in `lib/supabase/mutations.ts` (and/or minor adjustments in the SQL RPC parameter list if caller-provided notes are desired).

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

### Findings Summary:

#### [Critical] Finding 1: RPC Parameter Signature Mismatch in `lib/supabase/mutations.ts`
- **What**: Client RPC callers in `lib/supabase/mutations.ts` pass unexpected parameter names (`p_actor_user_id`, `p_actor_name`, `p_target_state`, `p_group_id`, `p_membership_id`) that do not match the PostgreSQL function signatures in `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`.
- **Where**: `lib/supabase/mutations.ts` lines 1586–1714.
- **Why**: PostgREST rejects RPC calls with unexpected or mismatched JSON payload parameters, causing runtime mutation failure on live Supabase instances.
- **Suggestion**: Update `lib/supabase/mutations.ts` to pass the exact parameter names expected by the PostgreSQL functions:
  - `mutateAssignTicket`: `{ p_ticket_id: params.ticketId, p_ticket_type: params.ticketType, p_assignment_group_id: params.assignmentGroupId ?? null, p_assigned_to_user_id: params.assignedToUserId ?? null, p_assignment_notes: params.reason ?? null }`
  - `mutateUpdateTicketITSMState`: `{ p_ticket_id: params.ticketId, p_ticket_type: params.ticketType, p_new_state: params.targetState, p_reason: params.reason ?? null, p_pause_reason: params.pauseReason ?? null }`
  - `mutateSetTicketPriority`: `{ p_ticket_id: params.ticketId, p_ticket_type: params.ticketType, p_priority: params.priority, p_reason: params.reason ?? null }`
  - `mutateManageAssignmentGroup`: `{ p_id: params.groupId ?? null, p_org_code: params.orgCode ?? null, p_name: params.name ?? null, p_description: params.description ?? null, p_lead_user_id: params.leadUserId ?? null, p_active: params.action !== "deactivate" }`
  - `mutateManageAssignmentGroupMembership`: `{ p_assignment_group_id: params.groupId, p_user_id: params.userId, p_role: params.role ?? "member", p_action: params.action === "remove" ? "delete" : "upsert" }`

---

## 5. Verification Method

To independently verify the fix once implemented:

1. **Verify RPC Signature Compatibility**:
   Inspect `lib/supabase/mutations.ts` (lines 1586-1714) against `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql` (lines 242-723). Ensure 1:1 parameter key correspondence.

2. **Run Build Verification**:
   ```bash
   npm run build
   ```
   *Expected result*: Exit code 0.

3. **Run Milestone 1 and Full Regression Test Suite**:
   ```bash
   node --test --test-concurrency=1 tests/*.test.mjs
   ```
   *Expected result*: 309/309 tests pass across all test suites.
