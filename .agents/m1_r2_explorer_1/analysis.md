# Detailed Remediation Analysis: Supabase RPC Caller Alignment in `lib/supabase/mutations.ts`

**Explorer**: `m1_r2_explorer_1` (Role: M1 Iteration 2 RPC Fix Explorer)  
**Date**: 2026-08-31  
**Target File**: `lib/supabase/mutations.ts` (Lines 1582–1716)  
**Reference Migration**: `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql` (Lines 241–723)  

---

## 1. Executive Summary

During Milestone 1 code and security review (by `m1_reviewer_1` and `m1_reviewer_2`), a critical discrepancy was identified between the 5 newly implemented PostgreSQL RPC functions in `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql` and the TypeScript Supabase client mutation wrappers in `lib/supabase/mutations.ts`.

Because PostgREST maps JSON payload keys strictly to PostgreSQL stored procedure parameter names, passing unknown parameter keys (e.g. `p_actor_user_id`, `p_actor_name`, `p_membership_id`) or mismatched parameter names (e.g. `p_target_state` instead of `p_new_state`, `p_reason` instead of `p_assignment_notes`, `p_group_id` instead of `p_assignment_group_id` or `p_id`) causes PostgREST to return HTTP 404/400 errors (`function not found in schema cache` or `could not choose best candidate function`).

While all unit tests in test environments without a live Supabase instance pass due to offline in-memory fallback, live database persistence in Milestones 2 through 4 will fail on all 5 ITSM RPC mutations unless `lib/supabase/mutations.ts` is remediated.

This analysis provides the exact 1:1 parameter alignment, security justification, backward compatibility mappings, and proposed code edits for `lib/supabase/mutations.ts`.

---

## 2. PostgreSQL RPC vs TypeScript Caller Comparison Matrix

| Function Name | SQL Migration Signature (`supabase/migrations/...`) | Current TS Payload (`lib/supabase/mutations.ts`) | Discrepancy & Root Cause | Remediated TS Payload |
|---|---|---|---|---|
| **1. `rpc_assign_ticket`** | `(p_ticket_id TEXT, p_ticket_type TEXT, p_assignment_group_id UUID, p_assigned_to_user_id UUID DEFAULT NULL, p_assignment_notes TEXT DEFAULT NULL)` | `{ p_ticket_type, p_ticket_id, p_assignment_group_id, p_assigned_to_user_id, p_actor_user_id, p_actor_name, p_reason }` | ❌ `p_actor_user_id` & `p_actor_name` not in SQL<br>❌ `p_reason` should be `p_assignment_notes` | `{ p_ticket_id, p_ticket_type, p_assignment_group_id, p_assigned_to_user_id, p_assignment_notes }` |
| **2. `rpc_update_ticket_itsm_state`** | `(p_ticket_id TEXT, p_ticket_type TEXT, p_new_state TEXT, p_reason TEXT DEFAULT NULL, p_pause_reason TEXT DEFAULT NULL)` | `{ p_ticket_type, p_ticket_id, p_target_state, p_actor_user_id, p_actor_name, p_reason, p_pause_reason }` | ❌ `p_actor_user_id` & `p_actor_name` not in SQL<br>❌ `p_target_state` should be `p_new_state` | `{ p_ticket_id, p_ticket_type, p_new_state, p_reason, p_pause_reason }` |
| **3. `rpc_set_ticket_priority`** | `(p_ticket_id TEXT, p_ticket_type TEXT, p_priority TEXT, p_reason TEXT DEFAULT NULL)` | `{ p_ticket_type, p_ticket_id, p_priority, p_actor_user_id, p_actor_name, p_reason }` | ❌ `p_actor_user_id` & `p_actor_name` not in SQL | `{ p_ticket_id, p_ticket_type, p_priority, p_reason }` |
| **4. `rpc_manage_assignment_group`** | `(p_id UUID DEFAULT NULL, p_org_code TEXT DEFAULT NULL, p_name TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL, p_lead_user_id UUID DEFAULT NULL, p_active BOOLEAN DEFAULT true)` | `{ p_action, p_group_id, p_org_code, p_name, p_description, p_lead_user_id, p_actor_user_id, p_actor_name }` | ❌ `p_action`, `p_actor_user_id`, `p_actor_name` not in SQL<br>❌ `p_group_id` should be `p_id`<br>❌ Missing `p_active` | `{ p_id, p_org_code, p_name, p_description, p_lead_user_id, p_active }` |
| **5. `rpc_manage_assignment_group_membership`** | `(p_assignment_group_id UUID, p_user_id UUID, p_role TEXT DEFAULT 'member', p_action TEXT DEFAULT 'upsert')` | `{ p_action, p_membership_id, p_group_id, p_user_id, p_role, p_actor_user_id, p_actor_name }` | ❌ `p_membership_id`, `p_actor_user_id`, `p_actor_name` not in SQL<br>❌ `p_group_id` should be `p_assignment_group_id`<br>❌ `action: "remove"` must map to `p_action: "delete"` | `{ p_assignment_group_id, p_user_id, p_role, p_action }` |

---

## 3. Deep Dive Analysis per RPC Function

### 3.1 `mutateAssignTicket`

#### PostgreSQL Function Declaration
```sql
CREATE OR REPLACE FUNCTION public.rpc_assign_ticket(
  p_ticket_id TEXT,
  p_ticket_type TEXT,
  p_assignment_group_id UUID,
  p_assigned_to_user_id UUID DEFAULT NULL,
  p_assignment_notes TEXT DEFAULT NULL
)
RETURNS JSONB
```

#### Discrepancies Identified
1. **Extraneous Actor Parameters**: The current TS implementation sends `p_actor_user_id` and `p_actor_name`. In PostgreSQL, `v_actor_id := auth.uid()` is executed securely inside the `SECURITY DEFINER` function, and `v_actor_name` is retrieved from `public.profiles WHERE id = v_actor_id`. Sending client actor fields is both redundant and rejected by PostgREST.
2. **Parameter Name Mismatch**: The current TS passes `p_reason: params.reason ?? null`. In PostgreSQL, the parameter is declared as `p_assignment_notes TEXT DEFAULT NULL`.
3. **Parameter Ordering & Types**:
   - `p_ticket_id`: `TEXT`
   - `p_ticket_type`: `TEXT` (Validates `'customer_request'`, `'workstream'`, `'task'`)
   - `p_assignment_group_id`: `UUID` (Target assignment group ID)
   - `p_assigned_to_user_id`: `UUID` (Nullable)
   - `p_assignment_notes`: `TEXT` (Nullable)

#### Remediated Client Mapping
```typescript
export async function mutateAssignTicket(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  assignmentGroupId?: string;
  assignedToUserId?: string;
  assignmentNotes?: string;
  reason?: string;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data, error } = await client.rpc("rpc_assign_ticket", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_assignment_group_id: params.assignmentGroupId ?? null,
    p_assigned_to_user_id: params.assignedToUserId ?? null,
    p_assignment_notes: params.assignmentNotes ?? params.reason ?? null,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Ticket assignment was not confirmed by the database.") };
  }
  return { data, error: null };
}
```

---

### 3.2 `mutateUpdateTicketITSMState`

#### PostgreSQL Function Declaration
```sql
CREATE OR REPLACE FUNCTION public.rpc_update_ticket_itsm_state(
  p_ticket_id TEXT,
  p_ticket_type TEXT,
  p_new_state TEXT,
  p_reason TEXT DEFAULT NULL,
  p_pause_reason TEXT DEFAULT NULL
)
RETURNS JSONB
```

#### Discrepancies Identified
1. **Parameter Name Mismatch**: The current TS implementation passes `p_target_state: params.targetState`. The PostgreSQL signature declares `p_new_state TEXT`.
2. **Extraneous Actor Parameters**: Current TS passes `p_actor_user_id` and `p_actor_name`, which do not exist in the SQL signature.
3. **Valid State Enum**: PostgreSQL validates `p_new_state IN ('draft', 'submitted', 'triaged', 'in_progress', 'pending_customer', 'pending_agency', 'blocked', 'resolved', 'closed')`.

#### Remediated Client Mapping
```typescript
export async function mutateUpdateTicketITSMState(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  targetState?: string;
  newState?: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
  pauseReason?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const targetState = params.newState ?? params.targetState;
  if (!targetState) {
    return { data: null, error: new Error("Target state is required for ITSM state update") };
  }

  const { data, error } = await client.rpc("rpc_update_ticket_itsm_state", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_new_state: targetState,
    p_reason: params.reason ?? null,
    p_pause_reason: params.pauseReason ?? null,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "ITSM state update was not confirmed by the database.") };
  }
  return { data, error: null };
}
```

---

### 3.3 `mutateSetTicketPriority`

#### PostgreSQL Function Declaration
```sql
CREATE OR REPLACE FUNCTION public.rpc_set_ticket_priority(
  p_ticket_id TEXT,
  p_ticket_type TEXT,
  p_priority TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
```

#### Discrepancies Identified
1. **Extraneous Actor Parameters**: Current TS passes `p_actor_user_id` and `p_actor_name`.
2. **Valid Priority Enum**: PostgreSQL enforces `p_priority IN ('P1', 'P2', 'P3', 'P4')`.
3. **Matching Parameters**: `p_ticket_id`, `p_ticket_type`, `p_priority`, `p_reason`.

#### Remediated Client Mapping
```typescript
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
```

---

### 3.4 `mutateManageAssignmentGroup`

#### PostgreSQL Function Declaration
```sql
CREATE OR REPLACE FUNCTION public.rpc_manage_assignment_group(
  p_id UUID DEFAULT NULL,
  p_org_code TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_lead_user_id UUID DEFAULT NULL,
  p_active BOOLEAN DEFAULT true
)
RETURNS JSONB
```

#### Discrepancies Identified
1. **Parameter Name Mismatch**: Current TS passes `p_group_id: params.groupId ?? null`. The SQL parameter is named `p_id`.
2. **Missing `p_active` / Unrecognized `p_action`**: Current TS passes `p_action: params.action` which is not in SQL. Instead, PostgreSQL uses `p_id IS NULL` for create vs update, and `p_active BOOLEAN DEFAULT true` for deactivation.
   - If `params.action === "deactivate"`, `p_active` is `false`.
   - If `params.active !== undefined`, `p_active` is `params.active`.
   - Otherwise, `p_active` defaults to `true`.
3. **Extraneous Actor Parameters**: Current TS passes `p_actor_user_id` and `p_actor_name`. SQL checks `app_private.is_system_admin()` and `app_private.is_organization_admin(v_org_id)` using `auth.uid()`.
4. **Return Value Object**: SQL returns `{ id, orgCode, name, description, leadUserId, active, updatedAt }`. Returning a typed `AssignmentGroupRecord` ensures full TypeScript fidelity.

#### Remediated Client Mapping
```typescript
export async function mutateManageAssignmentGroup(params: {
  action?: "create" | "update" | "deactivate";
  id?: string;
  groupId?: string;
  orgCode?: string;
  name?: string;
  description?: string;
  leadUserId?: string;
  active?: boolean;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<AssignmentGroupRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const targetId = params.id ?? params.groupId ?? null;
  const isActive = params.active !== undefined ? params.active : params.action !== "deactivate";

  const { data, error } = await client.rpc("rpc_manage_assignment_group", {
    p_id: targetId,
    p_org_code: params.orgCode ?? null,
    p_name: params.name ?? null,
    p_description: params.description ?? null,
    p_lead_user_id: params.leadUserId ?? null,
    p_active: isActive,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Assignment group operation was not confirmed by the database.") };
  }

  const row = data as Record<string, unknown>;
  const record: AssignmentGroupRecord = {
    id: String(row.id ?? targetId ?? ""),
    orgCode: String(row.orgCode ?? params.orgCode ?? ""),
    organizationId: row.organizationId ? String(row.organizationId) : undefined,
    name: String(row.name ?? params.name ?? ""),
    description: String(row.description ?? params.description ?? ""),
    leadUserId: row.leadUserId ? String(row.leadUserId) : (params.leadUserId ?? undefined),
    active: row.active !== undefined ? Boolean(row.active) : isActive,
    createdAt: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };

  return { data: record, error: null };
}
```

---

### 3.5 `mutateManageAssignmentGroupMembership`

#### PostgreSQL Function Declaration
```sql
CREATE OR REPLACE FUNCTION public.rpc_manage_assignment_group_membership(
  p_assignment_group_id UUID,
  p_user_id UUID,
  p_role TEXT DEFAULT 'member',
  p_action TEXT DEFAULT 'upsert'
)
RETURNS JSONB
```

#### Discrepancies Identified
1. **Parameter Name Mismatch**: Current TS passes `p_group_id: params.groupId`. The SQL parameter is named `p_assignment_group_id`.
2. **Action Mapping Mismatch**: Current TS passes `p_action: params.action` where `params.action` is `"add" | "remove" | "update_role"`. In PostgreSQL:
   - `IF p_action = 'delete' THEN ... ELSE ... [upsert]`.
   - Therefore, `"remove"` or `"delete"` must be translated to `p_action: 'delete'`.
   - `"add"`, `"update_role"`, or `"upsert"` must be translated to `p_action: 'upsert'`.
3. **Extraneous Parameters**: Current TS passes `p_membership_id`, `p_actor_user_id`, and `p_actor_name`.
   - The PostgreSQL table has a composite unique constraint `uq_group_user_membership UNIQUE (assignment_group_id, user_id)` and deletes/upserts directly using `(assignment_group_id, user_id)`.
   - `p_membership_id` is never used by the SQL function.
4. **Return Value Object**:
   - On deletion: SQL returns `{ "success": true, "action": "deleted" }`.
   - On upsert: SQL returns `{ "id": UUID, "assignmentGroupId": UUID, "userId": UUID, "role": TEXT, "updatedAt": TIMESTAMPTZ }`.

#### Remediated Client Mapping
```typescript
export async function mutateManageAssignmentGroupMembership(params: {
  action?: "add" | "remove" | "update_role" | "upsert" | "delete";
  assignmentGroupId?: string;
  groupId?: string;
  userId: string;
  role?: "member" | "lead" | "backup" | string;
  membershipId?: string;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<AssignmentGroupMembershipRecord | { success: boolean; action: string }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const assignmentGroupId = params.assignmentGroupId ?? params.groupId;
  if (!assignmentGroupId) {
    return { data: null, error: new Error("Assignment group ID is required for membership management") };
  }

  const isDelete = params.action === "remove" || params.action === "delete";
  const actionPayload = isDelete ? "delete" : "upsert";

  const { data, error } = await client.rpc("rpc_manage_assignment_group_membership", {
    p_assignment_group_id: assignmentGroupId,
    p_user_id: params.userId,
    p_role: params.role ?? "member",
    p_action: actionPayload,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Assignment group membership operation was not confirmed by the database.") };
  }

  if (isDelete) {
    return { data: { success: true, action: "deleted" }, error: null };
  }

  const row = data as Record<string, unknown>;
  const record: AssignmentGroupMembershipRecord = {
    id: String(row.id ?? params.membershipId ?? `${assignmentGroupId}-${params.userId}`),
    assignmentGroupId: String(row.assignmentGroupId ?? assignmentGroupId),
    userId: String(row.userId ?? params.userId),
    role: (String(row.role ?? params.role ?? "member") as "member" | "lead" | "backup"),
    createdAt: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };

  return { data: record, error: null };
}
```

---

## 4. Security & Architecture Rationale

### 4.1 Client-Side Actor Spoofing vs Server-Side `auth.uid()`
In the initial TypeScript implementation, caller methods attempted to pass `p_actor_user_id` and `p_actor_name`.
- **Vulnerability / Anti-pattern**: In an open REST/PostgREST interface, accepting actor IDs from the client body allows malicious users to forge audit records and impersonate project leads or agency administrators.
- **PostgreSQL Architecture**: The SQL functions are declared `SECURITY DEFINER` with `SET search_path = public, app_private`. They obtain the actor ID directly from `auth.uid()` (`v_actor_id := auth.uid()`) and resolve the display name from `public.profiles`. If `auth.uid()` is null, the function raises an immediate SQL exception (`Authentication required`).
- **Remediation**: The client parameters `actorUserId` and `actorName` are accepted optionally on TypeScript function signatures for logging and repository dual-mode compatibility, but are **never included** in the PostgREST RPC payload.

### 4.2 Admin Authorization Checks in Database
- `rpc_manage_assignment_group` verifies `app_private.is_system_admin()` or `app_private.is_organization_admin(v_org_id)`.
- `rpc_manage_assignment_group_membership` verifies system admin or organization admin status for the group's owning organization.
- No client-side override parameters are required or accepted.

---

## 5. Exact Proposed Code Replacement for `lib/supabase/mutations.ts`

Lines to replace: `lib/supabase/mutations.ts` (Lines 1582–1716).

```typescript
// ==========================================
// ITSM TICKET & ASSIGNMENT MUTATIONS (RPC WRAPPERS)
// ==========================================

export async function mutateAssignTicket(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  assignmentGroupId?: string;
  assignedToUserId?: string;
  assignmentNotes?: string;
  reason?: string;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data, error } = await client.rpc("rpc_assign_ticket", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_assignment_group_id: params.assignmentGroupId ?? null,
    p_assigned_to_user_id: params.assignedToUserId ?? null,
    p_assignment_notes: params.assignmentNotes ?? params.reason ?? null,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Ticket assignment was not confirmed by the database.") };
  }
  return { data, error: null };
}

export async function mutateUpdateTicketITSMState(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  targetState?: string;
  newState?: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
  pauseReason?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const targetState = params.newState ?? params.targetState;
  if (!targetState) {
    return { data: null, error: new Error("Target state is required for ITSM state update") };
  }

  const { data, error } = await client.rpc("rpc_update_ticket_itsm_state", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_new_state: targetState,
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
  action?: "create" | "update" | "deactivate";
  id?: string;
  groupId?: string;
  orgCode?: string;
  name?: string;
  description?: string;
  leadUserId?: string;
  active?: boolean;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<AssignmentGroupRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const targetId = params.id ?? params.groupId ?? null;
  const isActive = params.active !== undefined ? params.active : params.action !== "deactivate";

  const { data, error } = await client.rpc("rpc_manage_assignment_group", {
    p_id: targetId,
    p_org_code: params.orgCode ?? null,
    p_name: params.name ?? null,
    p_description: params.description ?? null,
    p_lead_user_id: params.leadUserId ?? null,
    p_active: isActive,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Assignment group operation was not confirmed by the database.") };
  }

  const row = data as Record<string, unknown>;
  const record: AssignmentGroupRecord = {
    id: String(row.id ?? targetId ?? ""),
    orgCode: String(row.orgCode ?? params.orgCode ?? ""),
    organizationId: row.organizationId ? String(row.organizationId) : undefined,
    name: String(row.name ?? params.name ?? ""),
    description: String(row.description ?? params.description ?? ""),
    leadUserId: row.leadUserId ? String(row.leadUserId) : (params.leadUserId ?? undefined),
    active: row.active !== undefined ? Boolean(row.active) : isActive,
    createdAt: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };

  return { data: record, error: null };
}

export async function mutateManageAssignmentGroupMembership(params: {
  action?: "add" | "remove" | "update_role" | "upsert" | "delete";
  assignmentGroupId?: string;
  groupId?: string;
  userId: string;
  role?: "member" | "lead" | "backup" | string;
  membershipId?: string;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<AssignmentGroupMembershipRecord | { success: boolean; action: string }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const assignmentGroupId = params.assignmentGroupId ?? params.groupId;
  if (!assignmentGroupId) {
    return { data: null, error: new Error("Assignment group ID is required for membership management") };
  }

  const isDelete = params.action === "remove" || params.action === "delete";
  const actionPayload = isDelete ? "delete" : "upsert";

  const { data, error } = await client.rpc("rpc_manage_assignment_group_membership", {
    p_assignment_group_id: assignmentGroupId,
    p_user_id: params.userId,
    p_role: params.role ?? "member",
    p_action: actionPayload,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Assignment group membership operation was not confirmed by the database.") };
  }

  if (isDelete) {
    return { data: { success: true, action: "deleted" }, error: null };
  }

  const row = data as Record<string, unknown>;
  const record: AssignmentGroupMembershipRecord = {
    id: String(row.id ?? params.membershipId ?? `${assignmentGroupId}-${params.userId}`),
    assignmentGroupId: String(row.assignmentGroupId ?? assignmentGroupId),
    userId: String(row.userId ?? params.userId),
    role: (String(row.role ?? params.role ?? "member") as "member" | "lead" | "backup"),
    createdAt: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };

  return { data: record, error: null };
}
```

---

## 6. Unit Testing Recommendations for RPC Payload Schemas

To prevent future regression and satisfy Finding 2 from Reviewer 1, we recommend adding a dedicated unit test suite in `tests/itsm-assignment-groups-persistence.test.mjs` that mocks the `SupabaseClient.rpc` call and directly validates the emitted payload objects.

### Suggested Test Snippet
```javascript
test("Supabase Mutations: RPC wrapper payload fidelity and SQL parameter alignment", async () => {
  const capturedRpcCalls = [];
  const mockClient = {
    rpc: async (fnName, payload) => {
      capturedRpcCalls.push({ fnName, payload });
      return { data: { success: true }, error: null };
    },
  };

  // 1. mutateAssignTicket
  // Verify payload matches: (p_ticket_id, p_ticket_type, p_assignment_group_id, p_assigned_to_user_id, p_assignment_notes)
  // Ensure no p_actor_user_id or p_reason
  
  // 2. mutateUpdateTicketITSMState
  // Verify payload matches: (p_ticket_id, p_ticket_type, p_new_state, p_reason, p_pause_reason)
  // Ensure no p_actor_name or p_target_state
  
  // 3. mutateSetTicketPriority
  // Verify payload matches: (p_ticket_id, p_ticket_type, p_priority, p_reason)
  
  // 4. mutateManageAssignmentGroup
  // Verify payload matches: (p_id, p_org_code, p_name, p_description, p_lead_user_id, p_active)
  
  // 5. mutateManageAssignmentGroupMembership
  // Verify payload matches: (p_assignment_group_id, p_user_id, p_role, p_action)
});
```

---

## 7. Implementation Checklist for Worker & Reviewers

1. [ ] Apply proposed edits to `lib/supabase/mutations.ts` (Lines 1586–1714).
2. [ ] Add RPC parameter validation tests in `tests/itsm-assignment-groups-persistence.test.mjs`.
3. [ ] Run `npm run build` to verify TypeScript compile-time type safety.
4. [ ] Run `node --test --test-concurrency=1 tests/*.test.mjs` to verify all test suites pass.
5. [ ] Certify Milestone 1.
