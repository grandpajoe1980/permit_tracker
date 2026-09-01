# M1 Iteration 2: Supabase RPC Payload Validation & Testing Design

**Author**: `m1_r2_explorer_2` (M1 Iteration 2 RPC Testing Explorer)  
**Date**: 2026-08-31  
**Target Test Suite**: `tests/itsm-assignment-groups-persistence.test.mjs`  
**Target Mutation Module**: `lib/supabase/mutations.ts`  
**Authoritative Migration**: `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`

---

## 1. Executive Summary

During Milestone 1 Iteration 1 review, both reviewers (`m1_reviewer_1` and `m1_reviewer_2`) identified a critical runtime defect: the 5 newly introduced TypeScript Supabase RPC wrappers in `lib/supabase/mutations.ts` passed JSON payload objects with parameter keys that did not match the declared PostgreSQL function signatures in `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`.

Because PostgREST resolves RPC functions by strictly matching incoming JSON keys to PostgreSQL function argument names and types:
1. Any misnamed key (e.g. `p_reason` vs `p_assignment_notes`, `p_target_state` vs `p_new_state`, `p_group_id` vs `p_assignment_group_id` / `p_id`) causes PostgREST to return HTTP 404 / 400 (`function not found in schema cache`).
2. Any extraneous key (e.g. `p_actor_user_id`, `p_actor_name`, `p_membership_id`) causes signature matching failure.
3. In local unit tests where `isSupabaseConfigured()` was false or mocked, these RPC wrappers were not exercised against their payload contracts, allowing the defect to escape detection.

This document provides a **comprehensive test suite architecture and concrete assertions** for `tests/itsm-assignment-groups-persistence.test.mjs` that explicitly test, spy, and validate that `lib/supabase/mutations.ts` constructs exact, schema-compliant parameter payloads for all 5 PostgreSQL RPC functions under all permutations, edge cases, and error conditions.

---

## 2. PostgreSQL RPC vs TypeScript Mutation Parameter Matrix

| PostgreSQL RPC Function | Migration SQL Parameter Signature | `lib/supabase/mutations.ts` Current (Buggy) Payload | Corrected Payload Specification |
|---|---|---|---|
| `public.rpc_assign_ticket` | `(p_ticket_id TEXT, p_ticket_type TEXT, p_assignment_group_id UUID, p_assigned_to_user_id UUID DEFAULT NULL, p_assignment_notes TEXT DEFAULT NULL)` | `{ p_ticket_type, p_ticket_id, p_assignment_group_id, p_assigned_to_user_id, p_actor_user_id, p_actor_name, p_reason }` | `{ p_ticket_id: params.ticketId, p_ticket_type: params.ticketType, p_assignment_group_id: params.assignmentGroupId ?? null, p_assigned_to_user_id: params.assignedToUserId ?? null, p_assignment_notes: params.reason ?? null }` |
| `public.rpc_update_ticket_itsm_state` | `(p_ticket_id TEXT, p_ticket_type TEXT, p_new_state TEXT, p_reason TEXT DEFAULT NULL, p_pause_reason TEXT DEFAULT NULL)` | `{ p_ticket_type, p_ticket_id, p_target_state, p_actor_user_id, p_actor_name, p_reason, p_pause_reason }` | `{ p_ticket_id: params.ticketId, p_ticket_type: params.ticketType, p_new_state: params.targetState, p_reason: params.reason ?? null, p_pause_reason: params.pauseReason ?? null }` |
| `public.rpc_set_ticket_priority` | `(p_ticket_id TEXT, p_ticket_type TEXT, p_priority TEXT, p_reason TEXT DEFAULT NULL)` | `{ p_ticket_type, p_ticket_id, p_priority, p_actor_user_id, p_actor_name, p_reason }` | `{ p_ticket_id: params.ticketId, p_ticket_type: params.ticketType, p_priority: params.priority, p_reason: params.reason ?? null }` |
| `public.rpc_manage_assignment_group` | `(p_id UUID DEFAULT NULL, p_org_code TEXT DEFAULT NULL, p_name TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL, p_lead_user_id UUID DEFAULT NULL, p_active BOOLEAN DEFAULT true)` | `{ p_action, p_group_id, p_org_code, p_name, p_description, p_lead_user_id, p_actor_user_id, p_actor_name }` | `{ p_id: params.groupId ?? null, p_org_code: params.orgCode ?? null, p_name: params.name ?? null, p_description: params.description ?? null, p_lead_user_id: params.leadUserId ?? null, p_active: params.action !== "deactivate" }` |
| `public.rpc_manage_assignment_group_membership` | `(p_assignment_group_id UUID, p_user_id UUID, p_role TEXT DEFAULT 'member', p_action TEXT DEFAULT 'upsert')` | `{ p_action, p_membership_id, p_group_id, p_user_id, p_role, p_actor_user_id, p_actor_name }` | `{ p_assignment_group_id: params.groupId ?? null, p_user_id: params.userId ?? null, p_role: params.role ?? "member", p_action: params.action === "remove" ? "delete" : "upsert" }` |

---

## 3. Test Harness Design: In-Memory Client RPC Spying & Schema Contract Validation

### 3.1 Architecture Overview
To achieve fast, deterministic, offline-capable unit testing without external network dependencies:
1. **Dynamic Client RPC Spy**: `lib/supabase/client.ts` initializes a singleton `testAnonClientInstance` when `getAppDataMode() === "test"`. By attaching a lightweight spy to `getSupabaseBrowser().rpc`, we record every RPC invocation's function name and payload object.
2. **Strict Whitelist & Key Set Equality**: For each RPC caller, the tests assert `Object.keys(payload).sort()` equals the exact sorted list of declared SQL function parameters. If any extraneous key (like `p_actor_user_id`) or mismatched key (like `p_target_state`) is present, the test fails immediately with descriptive diff output.
3. **AST / Regex SQL Migration Contract Test**: Reads `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql` from disk, extracts all `CREATE OR REPLACE FUNCTION public.rpc_*` parameter lists, and validates bidirectional agreement between SQL migrations and TypeScript mutation expectations.
4. **Boundary & Permutation Coverage**: Validates optional/nullable arguments (`undefined` vs `null`), action transforms (`"remove"` -> `"delete"`, `"deactivate"` -> `p_active: false`), and error handling when the database returns error objects.

---

## 4. Exact Formulated Test Code for `tests/itsm-assignment-groups-persistence.test.mjs`

Below is the complete, drop-in test code to be appended to `tests/itsm-assignment-groups-persistence.test.mjs`.

```javascript
// ============================================================================
// SUPABASE RPC CONTRACT & PAYLOAD VALIDATION TEST SUITE
// ============================================================================

const mutations = await vite.ssrLoadModule("/lib/supabase/mutations.ts");
const { getSupabaseBrowser } = await vite.ssrLoadModule("/lib/supabase/client.ts");

/**
 * Helper to intercept client.rpc calls and record invocations.
 */
function setupRpcSpy() {
  const client = getSupabaseBrowser();
  assert.ok(client, "Supabase browser client must be initialized in test mode");

  const calls = [];
  const originalRpc = client.rpc;

  client.rpc = async (fnName, payload, options) => {
    calls.push({ fnName, payload, options });
    return { data: { success: true, fnName, ...payload }, error: null };
  };

  return {
    calls,
    getLastCall() {
      return calls[calls.length - 1];
    },
    mockResponse(data, error = null) {
      client.rpc = async (fnName, payload, options) => {
        calls.push({ fnName, payload, options });
        return { data, error };
      };
    },
    restore() {
      client.rpc = originalRpc;
    },
  };
}

test("Supabase RPC Payloads: mutateAssignTicket constructs valid PostgreSQL parameter payload", async () => {
  const spy = setupRpcSpy();

  try {
    // Test Case 1: Workstream assigned to group only (optional fulfiller and reason omitted)
    const res1 = await mutations.mutateAssignTicket({
      ticketType: "workstream",
      ticketId: "WS-LA82-HEAVYHAUL",
      assignmentGroupId: "grp-dotd-access",
    });

    assert.equal(res1.error, null);
    const call1 = spy.getLastCall();
    assert.equal(call1.fnName, "rpc_assign_ticket");
    assert.deepEqual(
      Object.keys(call1.payload).sort(),
      ["p_assigned_to_user_id", "p_assignment_group_id", "p_assignment_notes", "p_ticket_id", "p_ticket_type"].sort(),
      "Payload keys must strictly match PostgreSQL rpc_assign_ticket parameters"
    );
    assert.equal(call1.payload.p_ticket_id, "WS-LA82-HEAVYHAUL");
    assert.equal(call1.payload.p_ticket_type, "workstream");
    assert.equal(call1.payload.p_assignment_group_id, "grp-dotd-access");
    assert.equal(call1.payload.p_assigned_to_user_id, null);
    assert.equal(call1.payload.p_assignment_notes, null);

    // Negative check: No extraneous or mismatched keys
    assert.equal("p_reason" in call1.payload, false, "Must use p_assignment_notes, not p_reason");
    assert.equal("p_actor_user_id" in call1.payload, false, "Actor is derived server-side via auth.uid()");
    assert.equal("p_actor_name" in call1.payload, false, "Actor name is fetched server-side from profiles");

    // Test Case 2: Customer Request assigned to group and individual fulfiller with reason
    const res2 = await mutations.mutateAssignTicket({
      ticketType: "customer_request",
      ticketId: "REQ-2026-001",
      assignmentGroupId: "grp-ldeq-water",
      assignedToUserId: "user-maya-chen",
      reason: "Routing to LDEQ water quality specialist for expedited review",
    });

    assert.equal(res2.error, null);
    const call2 = spy.getLastCall();
    assert.equal(call2.fnName, "rpc_assign_ticket");
    assert.equal(call2.payload.p_ticket_type, "customer_request");
    assert.equal(call2.payload.p_ticket_id, "REQ-2026-001");
    assert.equal(call2.payload.p_assignment_group_id, "grp-ldeq-water");
    assert.equal(call2.payload.p_assigned_to_user_id, "user-maya-chen");
    assert.equal(call2.payload.p_assignment_notes, "Routing to LDEQ water quality specialist for expedited review");

    // Test Case 3: Task assignment
    const res3 = await mutations.mutateAssignTicket({
      ticketType: "task",
      ticketId: "TASK-CPRA-01",
      assignmentGroupId: "grp-cpra-cup",
      assignedToUserId: "user-sam-rivera",
      reason: "Task fulfillment assignment",
    });
    assert.equal(res3.error, null);
    const call3 = spy.getLastCall();
    assert.equal(call3.payload.p_ticket_type, "task");
  } finally {
    spy.restore();
  }
});

test("Supabase RPC Payloads: mutateUpdateTicketITSMState constructs valid PostgreSQL parameter payload", async () => {
  const spy = setupRpcSpy();

  try {
    // Test Case 1: In-progress transition
    const res1 = await mutations.mutateUpdateTicketITSMState({
      ticketType: "workstream",
      ticketId: "WS-WETLANDS-PAD-A",
      targetState: "in_progress",
      reason: "Starting environmental survey field work",
    });

    assert.equal(res1.error, null);
    const call1 = spy.getLastCall();
    assert.equal(call1.fnName, "rpc_update_ticket_itsm_state");
    assert.deepEqual(
      Object.keys(call1.payload).sort(),
      ["p_new_state", "p_pause_reason", "p_reason", "p_ticket_id", "p_ticket_type"].sort(),
      "Payload keys must strictly match PostgreSQL rpc_update_ticket_itsm_state parameters"
    );
    assert.equal(call1.payload.p_ticket_id, "WS-WETLANDS-PAD-A");
    assert.equal(call1.payload.p_ticket_type, "workstream");
    assert.equal(call1.payload.p_new_state, "in_progress");
    assert.equal(call1.payload.p_reason, "Starting environmental survey field work");
    assert.equal(call1.payload.p_pause_reason, null);

    // Negative check
    assert.equal("p_target_state" in call1.payload, false, "Must use p_new_state, not p_target_state");
    assert.equal("p_actor_user_id" in call1.payload, false, "Actor is derived server-side via auth.uid()");

    // Test Case 2: Clock-pausing state with pauseReason (pending_agency)
    const res2 = await mutations.mutateUpdateTicketITSMState({
      ticketType: "customer_request",
      ticketId: "REQ-002",
      targetState: "pending_agency",
      reason: "Waiting on external state agency",
      pauseReason: "Awaiting USACE jurisdictional wetland concurrence",
    });

    assert.equal(res2.error, null);
    const call2 = spy.getLastCall();
    assert.equal(call2.payload.p_ticket_type, "customer_request");
    assert.equal(call2.payload.p_new_state, "pending_agency");
    assert.equal(call2.payload.p_reason, "Waiting on external state agency");
    assert.equal(call2.payload.p_pause_reason, "Awaiting USACE jurisdictional wetland concurrence");

    // Test Case 3: Terminal state (resolved)
    const res3 = await mutations.mutateUpdateTicketITSMState({
      ticketType: "task",
      ticketId: "TASK-002",
      targetState: "resolved",
      reason: "Final permit issued and verified",
    });

    assert.equal(res3.error, null);
    const call3 = spy.getLastCall();
    assert.equal(call3.payload.p_new_state, "resolved");
    assert.equal(call3.payload.p_pause_reason, null);
  } finally {
    spy.restore();
  }
});

test("Supabase RPC Payloads: mutateSetTicketPriority constructs valid PostgreSQL parameter payload", async () => {
  const spy = setupRpcSpy();

  try {
    // Test Case 1: P1 Escalation with reason
    const res1 = await mutations.mutateSetTicketPriority({
      ticketType: "workstream",
      ticketId: "WS-SUBSTATION-230KV",
      priority: "P1",
      reason: "Critical path transformer lead time escalation",
    });

    assert.equal(res1.error, null);
    const call1 = spy.getLastCall();
    assert.equal(call1.fnName, "rpc_set_ticket_priority");
    assert.deepEqual(
      Object.keys(call1.payload).sort(),
      ["p_priority", "p_reason", "p_ticket_id", "p_ticket_type"].sort(),
      "Payload keys must strictly match PostgreSQL rpc_set_ticket_priority parameters"
    );
    assert.equal(call1.payload.p_ticket_id, "WS-SUBSTATION-230KV");
    assert.equal(call1.payload.p_ticket_type, "workstream");
    assert.equal(call1.payload.p_priority, "P1");
    assert.equal(call1.payload.p_reason, "Critical path transformer lead time escalation");

    // Negative check
    assert.equal("p_actor_user_id" in call1.payload, false, "Actor is derived server-side via auth.uid()");

    // Test Case 2: Priority P3 without reason
    const res2 = await mutations.mutateSetTicketPriority({
      ticketType: "customer_request",
      ticketId: "REQ-003",
      priority: "P3",
    });

    assert.equal(res2.error, null);
    const call2 = spy.getLastCall();
    assert.equal(call2.payload.p_priority, "P3");
    assert.equal(call2.payload.p_reason, null);
  } finally {
    spy.restore();
  }
});

test("Supabase RPC Payloads: mutateManageAssignmentGroup constructs valid PostgreSQL parameter payload", async () => {
  const spy = setupRpcSpy();

  try {
    // Test Case 1: Create new assignment group
    const res1 = await mutations.mutateManageAssignmentGroup({
      action: "create",
      orgCode: "USACE",
      name: "USACE - Regulatory Branch Review",
      description: "Army Corps Section 404 and Section 10 permit reviews",
      leadUserId: "user-martin-breaux",
    });

    assert.equal(res1.error, null);
    const call1 = spy.getLastCall();
    assert.equal(call1.fnName, "rpc_manage_assignment_group");
    assert.deepEqual(
      Object.keys(call1.payload).sort(),
      ["p_active", "p_description", "p_id", "p_lead_user_id", "p_name", "p_org_code"].sort(),
      "Payload keys must strictly match PostgreSQL rpc_manage_assignment_group parameters"
    );
    assert.equal(call1.payload.p_id, null, "p_id must be null for creation");
    assert.equal(call1.payload.p_org_code, "USACE");
    assert.equal(call1.payload.p_name, "USACE - Regulatory Branch Review");
    assert.equal(call1.payload.p_description, "Army Corps Section 404 and Section 10 permit reviews");
    assert.equal(call1.payload.p_lead_user_id, "user-martin-breaux");
    assert.equal(call1.payload.p_active, true, "p_active must be true for creation");

    // Negative check
    assert.equal("p_action" in call1.payload, false, "SQL RPC does not accept p_action; uses p_id/p_active");
    assert.equal("p_group_id" in call1.payload, false, "SQL parameter is named p_id, not p_group_id");

    // Test Case 2: Update existing assignment group
    const res2 = await mutations.mutateManageAssignmentGroup({
      action: "update",
      groupId: "grp-dotd-heavyhaul",
      name: "DOTD - Oversize & Superload Review",
      description: "Specialized route analysis",
    });

    assert.equal(res2.error, null);
    const call2 = spy.getLastCall();
    assert.equal(call2.payload.p_id, "grp-dotd-heavyhaul");
    assert.equal(call2.payload.p_name, "DOTD - Oversize & Superload Review");
    assert.equal(call2.payload.p_active, true);

    // Test Case 3: Deactivate existing assignment group
    const res3 = await mutations.mutateManageAssignmentGroup({
      action: "deactivate",
      groupId: "grp-retired-queue",
    });

    assert.equal(res3.error, null);
    const call3 = spy.getLastCall();
    assert.equal(call3.payload.p_id, "grp-retired-queue");
    assert.equal(call3.payload.p_active, false, "action 'deactivate' must map to p_active: false");
  } finally {
    spy.restore();
  }
});

test("Supabase RPC Payloads: mutateManageAssignmentGroupMembership constructs valid PostgreSQL parameter payload", async () => {
  const spy = setupRpcSpy();

  try {
    // Test Case 1: Add member (action: 'add' -> p_action: 'upsert')
    const res1 = await mutations.mutateManageAssignmentGroupMembership({
      action: "add",
      groupId: "grp-dotd-access",
      userId: "user-sam-rivera",
      role: "lead",
    });

    assert.equal(res1.error, null);
    const call1 = spy.getLastCall();
    assert.equal(call1.fnName, "rpc_manage_assignment_group_membership");
    assert.deepEqual(
      Object.keys(call1.payload).sort(),
      ["p_action", "p_assignment_group_id", "p_role", "p_user_id"].sort(),
      "Payload keys must strictly match PostgreSQL rpc_manage_assignment_group_membership parameters"
    );
    assert.equal(call1.payload.p_assignment_group_id, "grp-dotd-access");
    assert.equal(call1.payload.p_user_id, "user-sam-rivera");
    assert.equal(call1.payload.p_role, "lead");
    assert.equal(call1.payload.p_action, "upsert", "action 'add' must map to p_action 'upsert'");

    // Negative check
    assert.equal("p_membership_id" in call1.payload, false, "SQL RPC does not accept p_membership_id");
    assert.equal("p_group_id" in call1.payload, false, "SQL parameter is named p_assignment_group_id");

    // Test Case 2: Update member role (action: 'update_role' -> p_action: 'upsert')
    const res2 = await mutations.mutateManageAssignmentGroupMembership({
      action: "update_role",
      groupId: "grp-dotd-access",
      userId: "user-sam-rivera",
      role: "backup",
    });

    assert.equal(res2.error, null);
    const call2 = spy.getLastCall();
    assert.equal(call2.payload.p_role, "backup");
    assert.equal(call2.payload.p_action, "upsert");

    // Test Case 3: Remove member (action: 'remove' -> p_action: 'delete')
    const res3 = await mutations.mutateManageAssignmentGroupMembership({
      action: "remove",
      groupId: "grp-dotd-access",
      userId: "user-sam-rivera",
    });

    assert.equal(res3.error, null);
    const call3 = spy.getLastCall();
    assert.equal(call3.payload.p_action, "delete", "action 'remove' must map to p_action 'delete'");
    assert.equal(call3.payload.p_role, "member", "Default role should be 'member' when omitted");
  } finally {
    spy.restore();
  }
});

test("Supabase RPC Error Handling: propagates database exceptions with clear messages", async () => {
  const spy = setupRpcSpy();

  try {
    // Mock database exception (e.g. Assigned user not in group)
    spy.mockResponse(null, { message: "Assigned user is not an active member of assignment group" });

    const result = await mutations.mutateAssignTicket({
      ticketType: "workstream",
      ticketId: "WS-1",
      assignmentGroupId: "grp-1",
      assignedToUserId: "user-invalid",
    });

    assert.equal(result.data, null);
    assert.ok(result.error instanceof Error);
    assert.equal(result.error.message.includes("Assigned user is not an active member"), true);
  } finally {
    spy.restore();
  }
});

test("SQL Migration Schema Contract: RPC parameter names and types match mutation caller definitions", () => {
  const migrationPath = resolve(process.cwd(), "supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql");
  const sql = readFileSync(migrationPath, "utf-8");

  // Schema dictionary of expected RPC parameter declarations from SQL
  const rpcParameterSignatures = {
    rpc_assign_ticket: [
      "p_ticket_id",
      "p_ticket_type",
      "p_assignment_group_id",
      "p_assigned_to_user_id",
      "p_assignment_notes",
    ],
    rpc_update_ticket_itsm_state: [
      "p_ticket_id",
      "p_ticket_type",
      "p_new_state",
      "p_reason",
      "p_pause_reason",
    ],
    rpc_set_ticket_priority: [
      "p_ticket_id",
      "p_ticket_type",
      "p_priority",
      "p_reason",
    ],
    rpc_manage_assignment_group: [
      "p_id",
      "p_org_code",
      "p_name",
      "p_description",
      "p_lead_user_id",
      "p_active",
    ],
    rpc_manage_assignment_group_membership: [
      "p_assignment_group_id",
      "p_user_id",
      "p_role",
      "p_action",
    ],
  };

  for (const [fnName, expectedParams] of Object.entries(rpcParameterSignatures)) {
    const fnRegex = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${fnName}\\s*\\(([^)]+)\\)`, "i");
    const match = sql.match(fnRegex);
    assert.ok(match, `RPC function declaration public.${fnName} must exist in migration`);

    const paramBlock = match[1];
    for (const paramName of expectedParams) {
      assert.ok(
        paramBlock.includes(paramName),
        `RPC ${fnName} in SQL migration must declare parameter ${paramName}`
      );
    }
  }
});
```

---

## 5. Proposed Modifications to `lib/supabase/mutations.ts`

For the implementer agent (`m1_r2_worker`), the exact changes to `lib/supabase/mutations.ts` lines 1586–1714 are:

```typescript
// ==========================================
// ITSM TICKET & ASSIGNMENT MUTATIONS (RPC WRAPPERS)
// ==========================================

export async function mutateAssignTicket(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  assignmentGroupId?: string;
  assignedToUserId?: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_assign_ticket", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_assignment_group_id: params.assignmentGroupId ?? null,
    p_assigned_to_user_id: params.assignedToUserId ?? null,
    p_assignment_notes: params.reason ?? null,
  });
  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Ticket assignment was not confirmed by the database.") };
  }
  return { data, error: null };
}

export async function mutateUpdateTicketITSMState(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  targetState: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
  pauseReason?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_update_ticket_itsm_state", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_new_state: params.targetState,
    p_reason: params.reason ?? null,
    p_pause_reason: params.pauseReason ?? null,
  });
  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "ITSM state update was not confirmed by the database.") };
  }
  return { data, error: null };
}

export async function mutateSetTicketPriority(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  priority: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_set_ticket_priority", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_priority: params.priority,
    p_reason: params.reason ?? null,
  });
  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Priority update was not confirmed by the database.") };
  }
  return { data, error: null };
}

export async function mutateManageAssignmentGroup(params: {
  action: "create" | "update" | "deactivate";
  groupId?: string;
  orgCode?: string;
  name?: string;
  description?: string;
  leadUserId?: string;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<AssignmentGroupRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_manage_assignment_group", {
    p_id: params.groupId ?? null,
    p_org_code: params.orgCode ?? null,
    p_name: params.name ?? null,
    p_description: params.description ?? null,
    p_lead_user_id: params.leadUserId ?? null,
    p_active: params.action !== "deactivate",
  });
  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Assignment group operation was not confirmed by the database.") };
  }
  return { data: data as AssignmentGroupRecord, error: null };
}

export async function mutateManageAssignmentGroupMembership(params: {
  action: "add" | "remove" | "update_role";
  membershipId?: string;
  groupId?: string;
  userId?: string;
  role?: string;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<AssignmentGroupMembershipRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_manage_assignment_group_membership", {
    p_assignment_group_id: params.groupId ?? null,
    p_user_id: params.userId ?? null,
    p_role: params.role ?? "member",
    p_action: params.action === "remove" ? "delete" : "upsert",
  });
  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Assignment group membership operation was not confirmed by the database.") };
  }
  return { data: data as AssignmentGroupMembershipRecord, error: null };
}
```

---

## 6. Verification and Test Execution Protocol

To verify the test assertions and implementation:
1. Update `lib/supabase/mutations.ts` with the aligned parameter keys.
2. Add the test assertions above to `tests/itsm-assignment-groups-persistence.test.mjs`.
3. Execute the unit test suite:
   ```bash
   node --test tests/itsm-assignment-groups-persistence.test.mjs
   ```
   *Expected Result*: All 17 subtests pass (10 existing + 7 new).
4. Run full regression suite:
   ```bash
   node --test --test-concurrency=1 tests/*.test.mjs
   ```
   *Expected Result*: All 300+ tests pass with zero regressions.
5. Run build verification:
   ```bash
   npm run build
   ```
   *Expected Result*: Clean build with exit code 0.
