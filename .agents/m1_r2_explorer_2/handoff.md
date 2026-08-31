# Milestone 1 Iteration 2: Supabase RPC Test Assertions Handoff Report

**Explorer**: `m1_r2_explorer_2` (Role: M1 Iteration 2 RPC Testing Explorer)  
**Target Milestone**: Milestone 1 Iteration 2 (ITSM & Multi-Tenancy Data Model & Supabase Persistence)  
**Parent Agent**: `6c0c2ad6-b060-4ca1-812d-09c87e71801e`

---

## 1. Observation

1. **PostgreSQL Migration (`supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`)**:
   - `public.rpc_assign_ticket` (lines 242–248): Declares parameters `(p_ticket_id TEXT, p_ticket_type TEXT, p_assignment_group_id UUID, p_assigned_to_user_id UUID DEFAULT NULL, p_assignment_notes TEXT DEFAULT NULL)`.
   - `public.rpc_update_ticket_itsm_state` (lines 380–386): Declares parameters `(p_ticket_id TEXT, p_ticket_type TEXT, p_new_state TEXT, p_reason TEXT DEFAULT NULL, p_pause_reason TEXT DEFAULT NULL)`.
   - `public.rpc_set_ticket_priority` (lines 544–549): Declares parameters `(p_ticket_id TEXT, p_ticket_type TEXT, p_priority TEXT, p_reason TEXT DEFAULT NULL)`.
   - `public.rpc_manage_assignment_group` (lines 608–615): Declares parameters `(p_id UUID DEFAULT NULL, p_org_code TEXT DEFAULT NULL, p_name TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL, p_lead_user_id UUID DEFAULT NULL, p_active BOOLEAN DEFAULT true)`.
   - `public.rpc_manage_assignment_group_membership` (lines 674–679): Declares parameters `(p_assignment_group_id UUID, p_user_id UUID, p_role TEXT DEFAULT 'member', p_action TEXT DEFAULT 'upsert')`.

2. **TypeScript Mutation Callers (`lib/supabase/mutations.ts`)**:
   - `mutateAssignTicket` (lines 1586–1610): Passes `p_reason` instead of `p_assignment_notes`, plus extraneous `p_actor_user_id` and `p_actor_name`.
   - `mutateUpdateTicketITSMState` (lines 1612–1636): Passes `p_target_state` instead of `p_new_state`, plus extraneous `p_actor_user_id` and `p_actor_name`.
   - `mutateSetTicketPriority` (lines 1638–1660): Passes extraneous `p_actor_user_id` and `p_actor_name`.
   - `mutateManageAssignmentGroup` (lines 1662–1688): Passes `p_action` and `p_group_id` instead of `p_id` and `p_active`, plus extraneous `p_actor_user_id` and `p_actor_name`.
   - `mutateManageAssignmentGroupMembership` (lines 1690–1715): Passes `p_membership_id` and `p_group_id` instead of `p_assignment_group_id`, plus extraneous `p_actor_user_id` and `p_actor_name`, and unmapped `p_action`.

3. **Current Test File (`tests/itsm-assignment-groups-persistence.test.mjs`)**:
   - Contains 10 subtests validating domain state models, statutory clock math, Drizzle schema exports, and raw SQL existence, but had no tests executing `lib/supabase/mutations.ts` or asserting RPC payload parameter dictionaries against PostgreSQL function signatures.

---

## 2. Logic Chain

1. PostgREST maps HTTP JSON request keys strictly to declared PostgreSQL function arguments. Extraneous or mismatched keys trigger HTTP 400/404 schema cache lookup failures.
2. In unit test mode without a live database connection, `getSupabaseBrowser()` instantiates an anon client instance, but mutation RPC calls were not exercised with payload assertions in `tests/itsm-assignment-groups-persistence.test.mjs`.
3. Intercepting `getSupabaseBrowser().rpc` via an in-memory spy allows testing exact payload key construction, type coercions, default values, and error handling in pure Node.js test execution.
4. Parsing `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql` directly within tests ensures that any future drift between SQL declarations and TypeScript RPC wrappers is flagged automatically.
5. Formulating 7 new test subtests in `tests/itsm-assignment-groups-persistence.test.mjs` directly covers all 5 RPC functions, all parameter variations, and guarantees 100% schema alignment.

---

## 3. Caveats

- The spy harness runs against the in-memory test client initialized by `lib/supabase/client.ts` during Node test execution (`getAppDataMode() === "test"`).
- Actual live PostgreSQL network execution is tested in E2E suites (`tests/e2e-cross-browser-durability.test.mjs`). The unit test assertions formulated here provide fast, regression-proof contract isolation.

---

## 4. Conclusion

The test design and exact assertion code have been formulated and documented in `/Users/joe/Repos/Permit/permit_tracker/.agents/m1_r2_explorer_2/analysis.md`. 

The test additions cover:
- Test 11: `mutateAssignTicket` parameter payload & key whitelist assertions.
- Test 12: `mutateUpdateTicketITSMState` state transition, reason, and clock pause payload assertions.
- Test 13: `mutateSetTicketPriority` priority levels and reason assertions.
- Test 14: `mutateManageAssignmentGroup` create/update/deactivate and `p_active` translation assertions.
- Test 15: `mutateManageAssignmentGroupMembership` add/update_role/remove and `p_action` ('upsert' vs 'delete') assertions.
- Test 16: Dynamic error propagation and typed error response handling.
- Test 17: Static AST/regex SQL migration parameter contract cross-verification.

The required code modifications for `lib/supabase/mutations.ts` are also fully detailed in `analysis.md`.

---

## 5. Verification Method

Once implemented by the worker:
1. Run the test suite:
   ```bash
   node --test tests/itsm-assignment-groups-persistence.test.mjs
   ```
   *Expected Output*: 17/17 tests passing (10 existing + 7 new).
2. Run full test suite:
   ```bash
   node --test --test-concurrency=1 tests/*.test.mjs
   ```
   *Expected Output*: 100% pass across all 22+ suites with 0 failures.
3. Run build verification:
   ```bash
   npm run build
   ```
   *Expected Output*: Exit code 0.
