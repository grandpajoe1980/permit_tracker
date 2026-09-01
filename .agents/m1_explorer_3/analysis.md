# Milestone 1 Repository & Mock Parity Analysis

**Role**: `m1_explorer_3` (Milestone 1 Repository & Mock Parity Explorer)  
**Date**: 2026-08-31  
**Target Milestone**: Milestone 1 (ITSM & Multi-Tenancy Data Model & Supabase Persistence)  
**Deliverables Covered**: `lib/repository.ts`, `lib/supabase/mutations.ts`, `lib/supabase/queries.ts`, `lib/supabase/mappings.ts`, `lib/spacex-megaproject-fixture.ts`

---

## 1. Executive Summary & Design Architecture

Milestone 1 elevates the SpaceX Louisiana Critical Path / PATH system into an enterprise ITSM and project delivery ticketing platform with full multi-tenancy, fulfiller queues, statutory SLA clocks, and atomic Supabase persistence.

This document formulates the exact specifications for:
1. **`ProjectDeliveryRepository` Methods (`lib/repository.ts`)**:
   - `getAssignmentGroups(orgCode?: string)` & `getAssignmentGroupById(groupId: string)`
   - `getAssignmentGroupMembers(groupId: string)` & `getAssignmentGroupMemberships(groupId?: string)`
   - `assignTicket(ticketId, groupId, userId?, reason?, ...)`
   - `assignTicketToGroup(ticketId, groupId, actorUserId, ...)`
   - `assignTicketToFulfiller(ticketId, userId, actorUserId, ...)`
   - `updateTicketITSMState(ticketId, state, actorUserId, ...)`
   - `updateStatutoryClock(ticketId, action, reason, actorName, actorOrgName)`
   - `setTicketPriority(ticketId, priority, actorUserId, ...)`
   - `createAssignmentGroup(...)` & `addAssignmentGroupMember(...)`
   - Complete `*Persisted` async counterparts with Supabase RPC integration and deterministic in-memory fallback.
2. **Supabase Mutation Wrappers (`lib/supabase/mutations.ts`)**:
   - `mutateAssignTicket` (calling `rpc_assign_ticket`)
   - `mutateUpdateTicketITSMState` (calling `rpc_update_ticket_itsm_state`)
   - `mutateSetTicketPriority` (calling `rpc_set_ticket_priority`)
   - `mutateManageAssignmentGroup` (calling `rpc_manage_assignment_group`)
   - `mutateManageAssignmentGroupMembership` (calling `rpc_manage_assignment_group_membership`)
   - Robust offline/test fallback executing database table updates and emitting audit events and notifications when Supabase RPCs are in demo/test mode.
3. **Seeding `lib/spacex-megaproject-fixture.ts`**:
   - 15 authentic multi-agency assignment groups spanning DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish, Governor's Project Office, and SpaceX.
   - Comprehensive `assignmentGroupMembershipsData` linking authentic personas (`user-sam-rivera`, `user-jordan-lee`, `user-jean-paul-guidry`, `user-dan-thibodeaux`, `user-robert-landry`, `user-riley-brooks`, `user-sarah-johnson`, `user-alex-martin`, `user-maya-chen`, `user-joe-skaggs`, `user-aris-thorne`).
   - Extended baseline fixture tickets with valid `assignmentGroupId`, `assignedToUserId`, `itsmState`, `priority`, and `clockStatus`.
4. **Dual-Mode Hydration Invariants (`lib/repository.ts`)**:
   - Seamless hydration from Supabase in production mode (`fetchAssignmentGroups`, `fetchAssignmentGroupMemberships`).
   - Resilient fallback to in-memory fixtures in test/demo mode (`allowsFixtureData()`).
   - Full reset parity in `resetE2EDemo()`.

---

## 2. `ProjectDeliveryRepository` Specification (`lib/repository.ts`)

### 2.1 Private State & Constructor Initialization

```typescript
class ProjectDeliveryRepository {
  private project: ProjectRecord = JSON.parse(JSON.stringify(spacexProjectRecord));
  private workstreams: WorkstreamRecord[] = JSON.parse(JSON.stringify(workstreamsData));
  private commitments: CommitmentRecord[] = JSON.parse(JSON.stringify(commitmentsData));
  private coordinationRequests: CoordinationRequestRecord[] = JSON.parse(JSON.stringify(coordinationRequestsData));
  private rfis: RFIRecord[] = JSON.parse(JSON.stringify(rfisData));
  private documents: DocumentRecord[] = JSON.parse(JSON.stringify(projectDocumentsData));
  private decisions: DecisionRecord[] = JSON.parse(JSON.stringify(projectDecisionsData));
  private meetings: MeetingRecord[] = JSON.parse(JSON.stringify(projectMeetingsData));
  private catalog: PermitTypeRecord[] = JSON.parse(JSON.stringify(permitCatalog));
  private auditEvents: AuditEventRecord[] = JSON.parse(JSON.stringify(spacexProjectRecord.auditLedger || []));
  private notifications: NotificationRecord[] = [];
  private organizations: OrganizationRecord[] = JSON.parse(JSON.stringify(registeredOrganizations));
  private profiles: UserProfileRecord[] = JSON.parse(JSON.stringify(projectProfiles));
  private memberships: OrganizationMembershipRecord[] = [];
  private participants: ProjectParticipantRecord[] = JSON.parse(JSON.stringify(projectParticipants));
  private externalFilings: ExternalFilingRecord[] = JSON.parse(JSON.stringify(initialExternalFilings));
  private customerRequests: CustomerRequestRecord[] = [];
  private workflowTemplates: WorkflowTemplateRecord[] = JSON.parse(JSON.stringify(workflowTemplatesData));
  
  // Milestone 1 Assignment Group & Queue State
  private assignmentGroups: AssignmentGroupRecord[] = JSON.parse(JSON.stringify(assignmentGroupsData));
  private assignmentGroupMemberships: AssignmentGroupMembershipRecord[] = JSON.parse(JSON.stringify(assignmentGroupMembershipsData));
  
  private isHydratedFromDb = false;
```

### 2.2 Dual-Mode Hydration (`hydrateFromSupabase`)

```typescript
async hydrateFromSupabase(projectId = "PRJ-PECAN-2026"): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const [
      ws,
      custReqs,
      extFilings,
      rfisList,
      coordReqs,
      comms,
      decs,
      mtgs,
      docs,
      profs,
      memberships,
      parts,
      notifs,
      audits,
      cat,
      orgs,
      workflowTemplates,
      groups,
      groupMemberships,
    ] = await Promise.all([
      fetchWorkstreams(projectId),
      fetchCustomerRequests(projectId),
      fetchExternalFilings(projectId),
      fetchRFIs(projectId),
      fetchCoordinationRequests(projectId),
      fetchCommitments(projectId),
      fetchDecisions(projectId),
      fetchMeetings(projectId),
      fetchDocuments(projectId),
      fetchUserProfiles(),
      fetchOrganizationMemberships(),
      fetchProjectParticipants(projectId),
      fetchNotifications(),
      fetchAuditEvents(projectId),
      fetchCatalog(),
      fetchOrganizations(),
      fetchWorkflowTemplates(),
      fetchAssignmentGroups(),
      fetchAssignmentGroupMemberships(),
    ]);

    const keepFixtures = allowsFixtureData();
    if (!keepFixtures || ws.length > 0) this.workstreams = ws;
    if (!keepFixtures || custReqs.length > 0) this.customerRequests = custReqs;
    if (!keepFixtures || extFilings.length > 0) this.externalFilings = extFilings;
    if (!keepFixtures || rfisList.length > 0) this.rfis = rfisList;
    if (!keepFixtures || coordReqs.length > 0) this.coordinationRequests = coordReqs;
    if (!keepFixtures || comms.length > 0) this.commitments = comms;
    if (!keepFixtures || decs.length > 0) this.decisions = decs;
    if (!keepFixtures || mtgs.length > 0) this.meetings = mtgs;
    if (!keepFixtures || docs.length > 0) this.documents = docs;
    if (!keepFixtures || profs.length > 0) this.profiles = profs;
    if (!keepFixtures || memberships.length > 0) this.memberships = memberships;
    if (!keepFixtures || parts.length > 0) this.participants = parts;
    if (!keepFixtures || notifs.length > 0) this.notifications = notifs;
    if (!keepFixtures || audits.length > 0) this.auditEvents = audits;
    if (!keepFixtures || cat.length > 0) this.catalog = cat;
    if (!keepFixtures || orgs.length > 0) this.organizations = orgs;
    if (!keepFixtures || workflowTemplates.length > 0) this.workflowTemplates = workflowTemplates;
    if (!keepFixtures || groups.length > 0) this.assignmentGroups = groups;
    if (!keepFixtures || groupMemberships.length > 0) this.assignmentGroupMemberships = groupMemberships;

    this.isHydratedFromDb = true;
    return true;
  } catch (err) {
    console.warn("Failed to hydrate from Supabase:", err);
    return false;
  }
}
```

### 2.3 Read Methods Specification

```typescript
// ==========================================
// ASSIGNMENT GROUPS & FULFILLER READ METHODS
// ==========================================

getAssignmentGroups(orgCode?: string): AssignmentGroupRecord[] {
  if (!orgCode) return this.assignmentGroups.filter((g) => g.active);
  const normalized = orgCode.toUpperCase().trim();
  return this.assignmentGroups.filter((g) => g.active && g.orgCode.toUpperCase() === normalized);
}

getAssignmentGroupById(groupId: string): AssignmentGroupRecord | undefined {
  return this.assignmentGroups.find((g) => g.id === groupId);
}

getAssignmentGroupMemberships(groupId?: string): AssignmentGroupMembershipRecord[] {
  if (!groupId) return this.assignmentGroupMemberships;
  return this.assignmentGroupMemberships.filter((m) => m.assignmentGroupId === groupId);
}

getAssignmentGroupMembers(groupId: string): UserProfileRecord[] {
  const memberships = this.getAssignmentGroupMemberships(groupId);
  const userIds = new Set(memberships.map((m) => m.userId));
  return this.profiles.filter((p) => userIds.has(p.userId) || userIds.has(p.id));
}

getTicketsByAssignmentGroup(groupId: string): {
  customerRequests: CustomerRequestRecord[];
  workstreams: WorkstreamRecord[];
} {
  return {
    customerRequests: this.customerRequests.filter((r) => r.assignmentGroupId === groupId),
    workstreams: this.workstreams.filter((w) => w.assignmentGroupId === groupId),
  };
}

getTicketsByFulfiller(userId: string): {
  customerRequests: CustomerRequestRecord[];
  workstreams: WorkstreamRecord[];
} {
  return {
    customerRequests: this.customerRequests.filter((r) => r.assignedToUserId === userId),
    workstreams: this.workstreams.filter((w) => w.assignedToUserId === userId),
  };
}
```

### 2.4 In-Memory Synchronous Mutation Methods

```typescript
// ==========================================
// IN-MEMORY SYNCHRONOUS MUTATION METHODS
// ==========================================

/**
 * Assigns a ticket (customer request or workstream) to an assignment group and optional fulfiller.
 */
assignTicket(params: {
  ticketId: string;
  ticketType?: "customer_request" | "workstream" | "task";
  groupId: string;
  userId?: string;
  reason?: string;
  actorUserId?: string;
  actorName?: string;
}): CustomerRequestRecord | WorkstreamRecord | null {
  const group = this.getAssignmentGroupById(params.groupId);
  if (!group) return null;

  const now = new Date().toISOString();
  const actor = params.actorUserId ? this.getProfileByUserId(params.actorUserId) : undefined;
  const actorName = params.actorName ?? actor?.fullName ?? "Authorized Fulfiller";

  // 1. Try customer request
  const req = this.customerRequests.find((r) => r.id === params.ticketId || r.confirmationNumber === params.ticketId);
  if (req && (params.ticketType === undefined || params.ticketType === "customer_request")) {
    const oldGroupId = req.assignmentGroupId;
    const oldAssigneeId = req.assignedToUserId;

    req.assignmentGroupId = params.groupId;
    req.assignmentGroupName = group.name;
    req.assignedToUserId = params.userId;
    if (params.userId) {
      const fulfiller = this.getProfileByUserId(params.userId);
      req.assignedToUserName = fulfiller?.fullName;
    } else {
      req.assignedToUserName = undefined;
    }
    if (req.itsmState === "draft" || req.itsmState === "submitted") {
      req.itsmState = "triaged";
      req.status = "triage";
    }
    req.updatedAt = now;

    this.auditEvents.unshift(
      createAuditEvent({
        entityType: "customer_request",
        entityId: req.confirmationNumber,
        actorName,
        actorOrgName: group.orgCode,
        actionType: "ticket_assigned",
        oldValue: `Group: ${oldGroupId || "None"}, Assignee: ${oldAssigneeId || "None"}`,
        newValue: `Group: ${group.name}, Assignee: ${req.assignedToUserName || "Unassigned"}`,
        reason: params.reason || `Routed to ${group.name}`,
      })
    );

    if (params.userId && params.userId !== params.actorUserId) {
      this.dispatchNotification({
        userId: params.userId,
        title: `Assigned: ${req.confirmationNumber}`,
        message: `${actorName} assigned ${req.title} to you in ${group.name}.`,
        type: "action_required",
        linkUrl: `/requests/${req.confirmationNumber}`,
        urgency: req.priority === "P1" ? "critical" : "high",
        metadata: { ticketId: req.id, confirmationNumber: req.confirmationNumber },
      });
    }

    return req;
  }

  // 2. Try workstream
  const ws = this.workstreams.find((w) => w.id === params.ticketId || w.code === params.ticketId);
  if (ws && (params.ticketType === undefined || params.ticketType === "workstream")) {
    const oldGroupId = ws.assignmentGroupId;
    const oldAssigneeId = ws.assignedToUserId;

    ws.assignmentGroupId = params.groupId;
    ws.assignmentGroupName = group.name;
    ws.assignedToUserId = params.userId;
    if (params.userId) {
      const fulfiller = this.getProfileByUserId(params.userId);
      ws.assignedToUserName = fulfiller?.fullName;
      ws.regulatoryLead.assignedReviewerName = fulfiller?.fullName ?? ws.regulatoryLead.assignedReviewerName;
      ws.regulatoryLead.assignedReviewerEmail = fulfiller?.workEmail ?? ws.regulatoryLead.assignedReviewerEmail;
    } else {
      ws.assignedToUserName = undefined;
    }
    ws.assignedOrgCode = group.orgCode;

    this.auditEvents.unshift(
      createAuditEvent({
        entityType: "workstream",
        entityId: ws.code,
        actorName,
        actorOrgName: group.orgCode,
        actionType: "ticket_assigned",
        oldValue: `Group: ${oldGroupId || "None"}, Assignee: ${oldAssigneeId || "None"}`,
        newValue: `Group: ${group.name}, Assignee: ${ws.assignedToUserName || "Unassigned"}`,
        reason: params.reason || `Routed to ${group.name}`,
      })
    );

    if (params.userId && params.userId !== params.actorUserId) {
      this.dispatchNotification({
        userId: params.userId,
        title: `Workstream Assigned: ${ws.code}`,
        message: `${actorName} assigned ${ws.title} to you in ${group.name}.`,
        type: "action_required",
        linkUrl: `/workstreams/${ws.code}`,
        urgency: ws.priority === "P1" ? "critical" : "high",
        metadata: { workstreamCode: ws.code },
      });
    }

    return ws;
  }

  return null;
}

assignTicketToGroup(
  ticketId: string,
  groupId: string,
  actorUserId: string,
  actorName?: string,
  reason?: string
): CustomerRequestRecord | WorkstreamRecord | null {
  return this.assignTicket({ ticketId, groupId, actorUserId, actorName, reason });
}

assignTicketToFulfiller(
  ticketId: string,
  userId: string,
  actorUserId: string,
  actorName?: string,
  reason?: string
): CustomerRequestRecord | WorkstreamRecord | null {
  const req = this.customerRequests.find((r) => r.id === ticketId || r.confirmationNumber === ticketId);
  if (req) {
    return this.assignTicket({
      ticketId,
      groupId: req.assignmentGroupId || "grp-state-po-triage",
      userId,
      actorUserId,
      actorName,
      reason,
    });
  }
  const ws = this.workstreams.find((w) => w.id === ticketId || w.code === ticketId);
  if (ws) {
    return this.assignTicket({
      ticketId,
      groupId: ws.assignmentGroupId || "grp-state-po-concierge",
      userId,
      actorUserId,
      actorName,
      reason,
    });
  }
  return null;
}

updateTicketITSMState(params: {
  ticketId: string;
  ticketType?: "customer_request" | "workstream" | "task";
  newState: ITSMState;
  actorUserId: string;
  actorName?: string;
  reason?: string;
  pauseReason?: string;
}): CustomerRequestRecord | WorkstreamRecord | null {
  const now = new Date().toISOString();
  const actor = this.getProfileByUserId(params.actorUserId);
  const actorName = params.actorName ?? actor?.fullName ?? "Authorized Fulfiller";

  // Clock status resolution
  let newClockStatus: ClockStatus = "active";
  if (["pending_customer", "pending_agency", "blocked"].includes(params.newState)) {
    newClockStatus = "paused";
  } else if (["resolved", "closed"].includes(params.newState)) {
    newClockStatus = "stopped";
  }

  // 1. Try customer request
  const req = this.customerRequests.find((r) => r.id === params.ticketId || r.confirmationNumber === params.ticketId);
  if (req && (params.ticketType === undefined || params.ticketType === "customer_request")) {
    const oldState = req.itsmState || "submitted";
    req.itsmState = params.newState;
    req.clockStatus = newClockStatus;
    if (newClockStatus === "paused") {
      req.clockPausedReason = params.pauseReason || params.reason || "Waiting on additional information";
      req.clockPausedAt = req.clockPausedAt || now;
    } else {
      req.clockPausedReason = undefined;
      req.clockPausedAt = undefined;
    }

    // Sync legacy status
    req.status =
      params.newState === "draft"
        ? "draft"
        : params.newState === "submitted"
        ? "submitted"
        : params.newState === "triaged"
        ? "triage"
        : params.newState === "resolved"
        ? "resolved"
        : params.newState === "closed"
        ? "closed"
        : "in_progress";
    req.updatedAt = now;

    this.auditEvents.unshift(
      createAuditEvent({
        entityType: "customer_request",
        entityId: req.confirmationNumber,
        actorName,
        actorOrgName: "PATH",
        actionType: "itsm_state_transition",
        oldValue: oldState,
        newValue: params.newState,
        reason: params.reason || `ITSM state updated to ${params.newState}`,
      })
    );

    return req;
  }

  // 2. Try workstream
  const ws = this.workstreams.find((w) => w.id === params.ticketId || w.code === params.ticketId);
  if (ws && (params.ticketType === undefined || params.ticketType === "workstream")) {
    const oldState = ws.itsmState || "in_progress";
    ws.itsmState = params.newState;
    ws.clockStatus = newClockStatus;

    if (params.newState === "blocked") {
      ws.operationalState = "blocked";
      ws.operationalStateLabel = "Blocked (Action Required)";
      ws.waitingReason = params.reason || "Workstream is blocked";
    } else if (params.newState === "pending_customer") {
      ws.operationalState = "waiting_applicant";
      ws.operationalStateLabel = "Waiting on Applicant (Clock Paused)";
      ws.waitingReason = params.pauseReason || params.reason || "Waiting on customer response";
    } else if (params.newState === "pending_agency") {
      ws.operationalState = "waiting_government";
      ws.operationalStateLabel = "Waiting on Agency Concurrence (Clock Paused)";
      ws.waitingReason = params.pauseReason || params.reason || "Waiting on reviewing agency";
    } else if (params.newState === "resolved" || params.newState === "closed") {
      ws.operationalState = "complete";
      ws.operationalStateLabel = "Complete";
      ws.actualCompletionDate = ws.actualCompletionDate || now.split("T")[0];
      ws.waitingReason = undefined;
    } else {
      ws.operationalState = "running";
      ws.operationalStateLabel = ws.currentStageName ? `Running (${ws.currentStageName})` : "Running";
      ws.waitingReason = undefined;
    }

    if (newClockStatus === "paused") {
      ws.clockPausedReason = params.pauseReason || params.reason;
      ws.clockPausedAt = ws.clockPausedAt || now;
    } else {
      ws.clockPausedReason = undefined;
      ws.clockPausedAt = undefined;
    }

    this.auditEvents.unshift(
      createAuditEvent({
        entityType: "workstream",
        entityId: ws.code,
        actorName,
        actorOrgName: ws.regulatoryLead.orgCode,
        actionType: "itsm_state_transition",
        oldValue: oldState,
        newValue: params.newState,
        reason: params.reason || `ITSM state updated to ${params.newState}`,
      })
    );

    return ws;
  }

  return null;
}

updateStatutoryClock(params: {
  ticketId: string;
  ticketType?: "customer_request" | "workstream";
  action: "pause" | "resume" | "stop";
  reason: string;
  actorName: string;
  actorOrgName: string;
}): CustomerRequestRecord | WorkstreamRecord | null {
  const req = this.customerRequests.find((r) => r.id === params.ticketId || r.confirmationNumber === params.ticketId);
  if (req) {
    const newState: ITSMState = params.action === "pause" ? "pending_customer" : params.action === "resume" ? "in_progress" : "closed";
    return this.updateTicketITSMState({
      ticketId: req.id,
      ticketType: "customer_request",
      newState,
      actorUserId: "user-system",
      actorName: params.actorName,
      reason: params.reason,
      pauseReason: params.action === "pause" ? params.reason : undefined,
    });
  }

  const ws = this.workstreams.find((w) => w.id === params.ticketId || w.code === params.ticketId);
  if (ws) {
    const newState: ITSMState = params.action === "pause" ? "pending_agency" : params.action === "resume" ? "in_progress" : "closed";
    return this.updateTicketITSMState({
      ticketId: ws.id,
      ticketType: "workstream",
      newState,
      actorUserId: "user-system",
      actorName: params.actorName,
      reason: params.reason,
      pauseReason: params.action === "pause" ? params.reason : undefined,
    });
  }

  return null;
}

setTicketPriority(params: {
  ticketId: string;
  ticketType?: "customer_request" | "workstream" | "task";
  priority: PriorityLevel;
  actorUserId: string;
  actorName?: string;
  reason?: string;
}): CustomerRequestRecord | WorkstreamRecord | null {
  const actor = this.getProfileByUserId(params.actorUserId);
  const actorName = params.actorName ?? actor?.fullName ?? "Authorized Fulfiller";

  const req = this.customerRequests.find((r) => r.id === params.ticketId || r.confirmationNumber === params.ticketId);
  if (req && (params.ticketType === undefined || params.ticketType === "customer_request")) {
    const old = req.priority || "P3";
    req.priority = params.priority;
    req.updatedAt = new Date().toISOString();

    this.auditEvents.unshift(
      createAuditEvent({
        entityType: "customer_request",
        entityId: req.confirmationNumber,
        actorName,
        actorOrgName: "PATH",
        actionType: "priority_updated",
        oldValue: old,
        newValue: params.priority,
        reason: params.reason || `Priority changed to ${params.priority}`,
      })
    );
    return req;
  }

  const ws = this.workstreams.find((w) => w.id === params.ticketId || w.code === params.ticketId);
  if (ws && (params.ticketType === undefined || params.ticketType === "workstream")) {
    const old = ws.priority || "P3";
    ws.priority = params.priority;

    this.auditEvents.unshift(
      createAuditEvent({
        entityType: "workstream",
        entityId: ws.code,
        actorName,
        actorOrgName: ws.regulatoryLead.orgCode,
        actionType: "priority_updated",
        oldValue: old,
        newValue: params.priority,
        reason: params.reason || `Priority changed to ${params.priority}`,
      })
    );
    return ws;
  }

  return null;
}

createAssignmentGroup(params: Omit<AssignmentGroupRecord, "id" | "createdAt" | "updatedAt">): AssignmentGroupRecord {
  const id = `grp-${params.orgCode.toLowerCase()}-${Date.now()}`;
  const now = new Date().toISOString();
  const newGroup: AssignmentGroupRecord = {
    ...params,
    id,
    createdAt: now,
    updatedAt: now,
  };
  this.assignmentGroups.push(newGroup);
  return newGroup;
}

addAssignmentGroupMember(params: Omit<AssignmentGroupMembershipRecord, "id" | "createdAt">): AssignmentGroupMembershipRecord {
  const id = `mem-${params.assignmentGroupId}-${params.userId}`;
  const now = new Date().toISOString();
  const membership: AssignmentGroupMembershipRecord = {
    ...params,
    id,
    createdAt: now,
  };
  this.assignmentGroupMemberships.push(membership);
  return membership;
}
```

### 2.5 Persisted Async Counterparts (`*Persisted`)

```typescript
// ==========================================
// PERSISTED ASYNC REPOSITORY METHODS
// ==========================================

async assignTicketPersisted(params: {
  ticketId: string;
  ticketType?: "customer_request" | "workstream" | "task";
  groupId: string;
  userId?: string;
  reason?: string;
  actorUserId: string;
  actorName?: string;
}): Promise<{ data: CustomerRequestRecord | WorkstreamRecord | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
    const updated = this.assignTicket(params);
    return { data: updated, error: updated ? null : new Error("Ticket not found.") };
  }

  const result = await mutateAssignTicket({
    ticketId: params.ticketId,
    ticketType: params.ticketType || (params.ticketId.startsWith("WS-") ? "workstream" : "customer_request"),
    assignmentGroupId: params.groupId,
    assignedToUserId: params.userId,
    assignmentNotes: params.reason,
  });

  if (result.error) return { data: null, error: result.error };
  await this.hydrateFromSupabase();

  const ticket =
    this.customerRequests.find((r) => r.id === params.ticketId || r.confirmationNumber === params.ticketId) ||
    this.workstreams.find((w) => w.id === params.ticketId || w.code === params.ticketId);

  return { data: ticket ?? null, error: null };
}

async updateTicketITSMStatePersisted(params: {
  ticketId: string;
  ticketType?: "customer_request" | "workstream" | "task";
  state: ITSMState;
  actorUserId: string;
  actorName?: string;
  reason?: string;
  pauseReason?: string;
}): Promise<{ data: CustomerRequestRecord | WorkstreamRecord | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
    const updated = this.updateTicketITSMState({
      ...params,
      newState: params.state,
    });
    return { data: updated, error: updated ? null : new Error("Ticket not found.") };
  }

  const result = await mutateUpdateTicketITSMState({
    ticketId: params.ticketId,
    ticketType: params.ticketType || (params.ticketId.startsWith("WS-") ? "workstream" : "customer_request"),
    newState: params.state,
    reason: params.reason,
    pauseReason: params.pauseReason,
  });

  if (result.error) return { data: null, error: result.error };
  await this.hydrateFromSupabase();

  const ticket =
    this.customerRequests.find((r) => r.id === params.ticketId || r.confirmationNumber === params.ticketId) ||
    this.workstreams.find((w) => w.id === params.ticketId || w.code === params.ticketId);

  return { data: ticket ?? null, error: null };
}

async setTicketPriorityPersisted(params: {
  ticketId: string;
  ticketType?: "customer_request" | "workstream" | "task";
  priority: PriorityLevel;
  actorUserId: string;
  actorName?: string;
  reason?: string;
}): Promise<{ data: CustomerRequestRecord | WorkstreamRecord | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
    const updated = this.setTicketPriority(params);
    return { data: updated, error: updated ? null : new Error("Ticket not found.") };
  }

  const result = await mutateSetTicketPriority({
    ticketId: params.ticketId,
    ticketType: params.ticketType || (params.ticketId.startsWith("WS-") ? "workstream" : "customer_request"),
    priority: params.priority,
    reason: params.reason,
  });

  if (result.error) return { data: null, error: result.error };
  await this.hydrateFromSupabase();

  const ticket =
    this.customerRequests.find((r) => r.id === params.ticketId || r.confirmationNumber === params.ticketId) ||
    this.workstreams.find((w) => w.id === params.ticketId || w.code === params.ticketId);

  return { data: ticket ?? null, error: null };
}
```

### 2.6 Demo State Reset (`resetE2EDemo`)

```typescript
resetE2EDemo(): void {
  this.project = JSON.parse(JSON.stringify(spacexProjectRecord));
  this.workstreams = JSON.parse(JSON.stringify(workstreamsData));
  this.commitments = JSON.parse(JSON.stringify(commitmentsData));
  this.coordinationRequests = JSON.parse(JSON.stringify(coordinationRequestsData));
  this.rfis = JSON.parse(JSON.stringify(rfisData));
  this.documents = JSON.parse(JSON.stringify(projectDocumentsData));
  this.decisions = JSON.parse(JSON.stringify(projectDecisionsData));
  this.meetings = JSON.parse(JSON.stringify(projectMeetingsData));
  this.catalog = JSON.parse(JSON.stringify(permitCatalog));
  this.auditEvents = JSON.parse(JSON.stringify(spacexProjectRecord.auditLedger || []));
  this.notifications = [];
  this.profiles = JSON.parse(JSON.stringify(projectProfiles));
  this.participants = JSON.parse(JSON.stringify(projectParticipants));
  this.externalFilings = JSON.parse(JSON.stringify(initialExternalFilings));
  this.customerRequests = [];
  this.workflowTemplates = JSON.parse(JSON.stringify(workflowTemplatesData));
  this.assignmentGroups = JSON.parse(JSON.stringify(assignmentGroupsData));
  this.assignmentGroupMemberships = JSON.parse(JSON.stringify(assignmentGroupMembershipsData));
}
```

---

## 3. Supabase Mutation Wrappers Specification (`lib/supabase/mutations.ts`)

```typescript
// ====================================================================
// 8. ITSM ASSIGNMENTS, LIFECYCLE & STATUTORY CLOCK MUTATIONS
// ====================================================================

export async function mutateAssignTicket(params: {
  ticketId: string;
  ticketType: "customer_request" | "workstream" | "task";
  assignmentGroupId: string;
  assignedToUserId?: string;
  assignmentNotes?: string;
}): Promise<MutationResult<{
  success: boolean;
  ticketId: string;
  ticketType: string;
  assignmentGroupId: string;
  assignedToUserId?: string;
}>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  // 1. Try PostgreSQL RPC
  const { data: rpcData, error: rpcError } = await client.rpc("rpc_assign_ticket", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_assignment_group_id: params.assignmentGroupId,
    p_assigned_to_user_id: params.assignedToUserId ?? null,
    p_assignment_notes: params.assignmentNotes ?? null,
  });

  if (!rpcError && rpcData) {
    const row = rpcData as Record<string, unknown>;
    return {
      data: {
        success: Boolean(row.success ?? true),
        ticketId: String(row.ticketId ?? params.ticketId),
        ticketType: String(row.ticketType ?? params.ticketType),
        assignmentGroupId: String(row.assignmentGroupId ?? params.assignmentGroupId),
        assignedToUserId: row.assignedToUserId ? String(row.assignedToUserId) : undefined,
      },
      error: null,
    };
  }

  if (!allowsFixtureData()) {
    return { data: null, error: new Error(`Ticket assignment RPC failed: ${rpcError?.message ?? "no data"}`) };
  }

  // Fallback for test / demo environments
  const now = new Date().toISOString();
  const table = params.ticketType === "workstream" ? "workstreams" : params.ticketType === "task" ? "tasks" : "customer_requests";
  const { error: updateError } = await client
    .from(table)
    .update({
      assignment_group_id: params.assignmentGroupId,
      assigned_to_user_id: params.assignedToUserId ?? null,
      updated_at: now,
    })
    .or(`id.eq.${params.ticketId},code.eq.${params.ticketId}`);

  if (updateError) return { data: null, error: new Error(updateError.message) };

  await insertAuditEvent({
    entityType: params.ticketType,
    entityId: params.ticketId,
    actorName: "Authorized Fulfiller",
    actorOrgName: "PATH",
    actionType: "ticket_assigned",
    newValue: `Group: ${params.assignmentGroupId}, Assignee: ${params.assignedToUserId || "None"}`,
    reason: params.assignmentNotes || "Ticket routed to assignment group",
  });

  return {
    data: {
      success: true,
      ticketId: params.ticketId,
      ticketType: params.ticketType,
      assignmentGroupId: params.assignmentGroupId,
      assignedToUserId: params.assignedToUserId,
    },
    error: null,
  };
}

export async function mutateUpdateTicketITSMState(params: {
  ticketId: string;
  ticketType: "customer_request" | "workstream" | "task";
  newState: ITSMState;
  reason?: string;
  pauseReason?: string;
}): Promise<MutationResult<{
  success: boolean;
  ticketId: string;
  ticketType: string;
  oldState?: string;
  newState: ITSMState;
  clockStatus: ClockStatus;
}>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data: rpcData, error: rpcError } = await client.rpc("rpc_update_ticket_itsm_state", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_new_state: params.newState,
    p_reason: params.reason ?? null,
    p_pause_reason: params.pauseReason ?? null,
  });

  if (!rpcError && rpcData) {
    const row = rpcData as Record<string, unknown>;
    return {
      data: {
        success: Boolean(row.success ?? true),
        ticketId: String(row.ticketId ?? params.ticketId),
        ticketType: String(row.ticketType ?? params.ticketType),
        oldState: row.oldState ? String(row.oldState) : undefined,
        newState: String(row.newState ?? params.newState) as ITSMState,
        clockStatus: String(row.clockStatus ?? "active") as ClockStatus,
      },
      error: null,
    };
  }

  if (!allowsFixtureData()) {
    return { data: null, error: new Error(`ITSM state transition RPC failed: ${rpcError?.message ?? "no data"}`) };
  }

  // Fallback
  const now = new Date().toISOString();
  const table = params.ticketType === "workstream" ? "workstreams" : params.ticketType === "task" ? "tasks" : "customer_requests";
  const clockStatus = ["pending_customer", "pending_agency", "blocked"].includes(params.newState)
    ? "paused"
    : ["resolved", "closed"].includes(params.newState)
    ? "stopped"
    : "active";

  const { error: updateError } = await client
    .from(table)
    .update({
      itsm_state: params.newState,
      clock_status: clockStatus,
      clock_paused_reason: clockStatus === "paused" ? params.pauseReason || params.reason : null,
      updated_at: now,
    })
    .or(`id.eq.${params.ticketId},code.eq.${params.ticketId}`);

  if (updateError) return { data: null, error: new Error(updateError.message) };

  await insertAuditEvent({
    entityType: params.ticketType,
    entityId: params.ticketId,
    actorName: "Authorized Fulfiller",
    actorOrgName: "PATH",
    actionType: "itsm_state_transition",
    newValue: params.newState,
    reason: params.reason || `ITSM state updated to ${params.newState}`,
  });

  return {
    data: {
      success: true,
      ticketId: params.ticketId,
      ticketType: params.ticketType,
      newState: params.newState,
      clockStatus,
    },
    error: null,
  };
}

export async function mutateSetTicketPriority(params: {
  ticketId: string;
  ticketType: "customer_request" | "workstream" | "task";
  priority: PriorityLevel;
  reason?: string;
}): Promise<MutationResult<{
  success: boolean;
  ticketId: string;
  ticketType: string;
  newPriority: PriorityLevel;
}>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data: rpcData, error: rpcError } = await client.rpc("rpc_set_ticket_priority", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_priority: params.priority,
    p_reason: params.reason ?? null,
  });

  if (!rpcError && rpcData) {
    const row = rpcData as Record<string, unknown>;
    return {
      data: {
        success: Boolean(row.success ?? true),
        ticketId: String(row.ticketId ?? params.ticketId),
        ticketType: String(row.ticketType ?? params.ticketType),
        newPriority: String(row.newPriority ?? params.priority) as PriorityLevel,
      },
      error: null,
    };
  }

  if (!allowsFixtureData()) {
    return { data: null, error: new Error(`Ticket priority RPC failed: ${rpcError?.message ?? "no data"}`) };
  }

  // Fallback
  const table = params.ticketType === "workstream" ? "workstreams" : params.ticketType === "task" ? "tasks" : "customer_requests";
  const { error: updateError } = await client
    .from(table)
    .update({ priority: params.priority, updated_at: new Date().toISOString() })
    .or(`id.eq.${params.ticketId},code.eq.${params.ticketId}`);

  if (updateError) return { data: null, error: new Error(updateError.message) };

  await insertAuditEvent({
    entityType: params.ticketType,
    entityId: params.ticketId,
    actorName: "Authorized Fulfiller",
    actorOrgName: "PATH",
    actionType: "priority_updated",
    newValue: params.priority,
    reason: params.reason || `Priority updated to ${params.priority}`,
  });

  return {
    data: {
      success: true,
      ticketId: params.ticketId,
      ticketType: params.ticketType,
      newPriority: params.priority,
    },
    error: null,
  };
}

export async function mutateManageAssignmentGroup(params: {
  id?: string;
  orgCode?: string;
  name?: string;
  description?: string;
  leadUserId?: string;
  active?: boolean;
}): Promise<MutationResult<AssignmentGroupRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data, error } = await client.rpc("rpc_manage_assignment_group", {
    p_id: params.id ?? null,
    p_org_code: params.orgCode ?? null,
    p_name: params.name ?? null,
    p_description: params.description ?? null,
    p_lead_user_id: params.leadUserId ?? null,
    p_active: params.active ?? true,
  });

  if (error || !data) return { data: null, error: new Error(error?.message ?? "Assignment group modification failed") };
  const row = data as Record<string, unknown>;
  return {
    data: {
      id: String(row.id),
      orgCode: String(row.orgCode ?? row.org_code),
      name: String(row.name),
      description: row.description ? String(row.description) : "",
      leadUserId: row.leadUserId ? String(row.leadUserId) : undefined,
      active: Boolean(row.active ?? true),
      createdAt: String(row.createdAt ?? row.created_at ?? new Date().toISOString()),
      updatedAt: String(row.updatedAt ?? row.updated_at ?? new Date().toISOString()),
    },
    error: null,
  };
}
```

---

## 4. Seeding `lib/spacex-megaproject-fixture.ts`

### 4.1 15 Authentic Multi-Agency Assignment Groups

```typescript
export const assignmentGroupsData: AssignmentGroupRecord[] = [
  // 1. SpaceX Internal Queues
  {
    id: "grp-spacex-tech",
    orgCode: "SPACEX",
    organizationId: "org-spacex",
    name: "SpaceX - Internal Technical Queue",
    description: "Launch mount structural civil engineering, high-pressure deluge, and mechanical interface reviews",
    leadUserId: "user-alex-martin",
    leadUserName: "Alex Martin",
    active: true,
  },
  {
    id: "grp-spacex-reg",
    orgCode: "SPACEX",
    organizationId: "org-spacex",
    name: "SpaceX - Regulatory Affairs Queue",
    description: "Multi-agency permit applications, NEPA environmental disclosures, and statutory compliance management",
    leadUserId: "user-maya-chen",
    leadUserName: "Maya Chen",
    active: true,
  },

  // 2. Governor's Project Office (State Concierge)
  {
    id: "grp-state-po-triage",
    orgCode: "LA-PROJECTS",
    organizationId: "org-state-po",
    name: "Governor's Project Office - Executive Triage & Delivery",
    description: "State-level executive intake, cross-agency critical path unblocking, and Cabinet escalation coordination",
    leadUserId: "user-sarah-johnson",
    leadUserName: "Sarah Johnson",
    active: true,
  },
  {
    id: "grp-state-po-concierge",
    orgCode: "LA-PROJECTS",
    organizationId: "org-state-po",
    name: "Governor's Project Office - Interagency Concierge",
    description: "Dedicated state concierge facilitating interagency concurrence, timeline alignment, and agency meetings",
    leadUserId: "user-sarah-johnson",
    leadUserName: "Sarah Johnson",
    active: true,
  },

  // 3. DOTD (Transportation & Development)
  {
    id: "grp-dotd-heavyhaul",
    orgCode: "DOTD",
    organizationId: "org-dotd",
    name: "DOTD - Structures & Bridge Review",
    description: "LA-82 bridge structural load simulations, axle weight distribution ratings, and culvert reinforcement engineering",
    leadUserId: "user-sam-rivera",
    leadUserName: "Sam Rivera",
    active: true,
  },
  {
    id: "grp-dotd-access",
    orgCode: "DOTD",
    organizationId: "org-dotd",
    name: "DOTD - Highway Access & Heavy-Haul",
    description: "State highway oversize superload routing, turning radius clearances, and drive connection permits",
    leadUserId: "user-sam-rivera",
    leadUserName: "Sam Rivera",
    active: true,
  },

  // 4. LDEQ (Environmental Quality)
  {
    id: "grp-ldeq-water",
    orgCode: "LDEQ",
    organizationId: "org-ldeq",
    name: "LDEQ - Water Quality & Deluge Permitting",
    description: "LPDES industrial stormwater, acoustic water deluge runoff retention, and baseline canal monitoring",
    leadUserId: "user-jordan-lee",
    leadUserName: "Jordan Lee",
    active: true,
  },
  {
    id: "grp-ldeq-air",
    orgCode: "LDEQ",
    organizationId: "org-ldeq",
    name: "LDEQ - Air Quality & Environmental Review",
    description: "Title V minor air source modeling, flare stack emissions limits, and environmental impact assessments",
    leadUserId: "user-jordan-lee",
    leadUserName: "Jordan Lee",
    active: true,
  },

  // 5. CPRA (Coastal Protection & Restoration Authority)
  {
    id: "grp-cpra-cup",
    orgCode: "CPRA",
    organizationId: "org-cpra",
    name: "CPRA - Coastal Use & Hydrology Permitting",
    description: "Coastal Use Permits (CUP), coastal zone management consistency, and Chenier Plain wetland ecology",
    leadUserId: "user-jean-paul-guidry",
    leadUserName: "Jean-Paul Guidry",
    active: true,
  },
  {
    id: "grp-cpra-levee",
    orgCode: "CPRA",
    organizationId: "org-cpra",
    name: "CPRA - Drainage & Levee Concurrence",
    description: "Hydrologic surge modeling, flood protection levee buffer concurrence, and coastal restoration alignment",
    leadUserId: "user-jean-paul-guidry",
    leadUserName: "Jean-Paul Guidry",
    active: true,
  },

  // 6. OSFM (Office of State Fire Marshal)
  {
    id: "grp-osfm-lifesafety",
    orgCode: "OSFM",
    organizationId: "org-osfm",
    name: "OSFM - Life Safety & Plan Review",
    description: "Commercial building safety codes, explosive setback compliance, and emergency egress routing",
    leadUserId: "user-dan-thibodeaux",
    leadUserName: "Chief Dan Thibodeaux",
    active: true,
  },
  {
    id: "grp-osfm-hazmat",
    orgCode: "OSFM",
    organizationId: "org-osfm",
    name: "OSFM - Hazardous Materials & Cryogenic Safety",
    description: "Liquid methane (LCH4), liquid oxygen (LOX) bulk storage, and cryogenic propellant transfer safety",
    leadUserId: "user-dan-thibodeaux",
    leadUserName: "Chief Dan Thibodeaux",
    active: true,
  },

  // 7. LSP (Louisiana State Police)
  {
    id: "grp-lsp-hazmat",
    orgCode: "LSP",
    organizationId: "org-lsp",
    name: "LSP - Emergency Response & Route Clearance",
    description: "State Police cryogenic transport escort coordination, highway rolling roadblocks, and emergency access",
    leadUserId: "user-robert-landry",
    leadUserName: "Capt. Robert Landry",
    active: true,
  },

  // 8. Vermilion Parish (Parish Permitting & Police Jury)
  {
    id: "grp-vermilion-parish",
    orgCode: "VERMILION-PARISH",
    organizationId: "org-parish",
    name: "Vermilion Parish - Coastal Permitting & Police Jury",
    description: "Parish coastal development permits, public hearing notices, and Police Jury ordinance consistency",
    leadUserId: "user-riley-brooks",
    leadUserName: "Riley Brooks",
    active: true,
  },
  {
    id: "grp-vermilion-publicworks",
    orgCode: "VERMILION-PARISH",
    organizationId: "org-parish",
    name: "Vermilion Parish - Public Works & Drainage",
    description: "Parish drainage canal crossings, bridge weight restrictions, and local road maintenance agreements",
    leadUserId: "user-riley-brooks",
    leadUserName: "Riley Brooks",
    active: true,
  },
];
```

### 4.2 Group Memberships Seed Data

```typescript
export const assignmentGroupMembershipsData: AssignmentGroupMembershipRecord[] = [
  // SpaceX
  { id: "mem-spx-1", assignmentGroupId: "grp-spacex-tech", userId: "user-alex-martin", role: "lead", userName: "Alex Martin", userEmail: "alex.martin@spacex.com" },
  { id: "mem-spx-2", assignmentGroupId: "grp-spacex-tech", userId: "user-aris-thorne", role: "member", userName: "Dr. Aris Thorne", userEmail: "aris.thorne@gulfcoast-engineering.example" },
  { id: "mem-spx-3", assignmentGroupId: "grp-spacex-reg", userId: "user-maya-chen", role: "lead", userName: "Maya Chen", userEmail: "maya.chen@spacex.com" },
  { id: "mem-spx-4", assignmentGroupId: "grp-spacex-reg", userId: "user-alex-martin", role: "backup", userName: "Alex Martin", userEmail: "alex.martin@spacex.com" },

  // Governor's Project Office
  { id: "mem-gpo-1", assignmentGroupId: "grp-state-po-triage", userId: "user-sarah-johnson", role: "lead", userName: "Sarah Johnson", userEmail: "sarah.johnson@la.gov" },
  { id: "mem-gpo-2", assignmentGroupId: "grp-state-po-triage", userId: "user-joe-skaggs", role: "backup", userName: "Joe Skaggs", userEmail: "joe.skaggs@la.gov" },
  { id: "mem-gpo-3", assignmentGroupId: "grp-state-po-concierge", userId: "user-sarah-johnson", role: "lead", userName: "Sarah Johnson", userEmail: "sarah.johnson@la.gov" },

  // DOTD
  { id: "mem-dotd-1", assignmentGroupId: "grp-dotd-heavyhaul", userId: "user-sam-rivera", role: "lead", userName: "Sam Rivera", userEmail: "sam.rivera@la.gov" },
  { id: "mem-dotd-2", assignmentGroupId: "grp-dotd-access", userId: "user-sam-rivera", role: "lead", userName: "Sam Rivera", userEmail: "sam.rivera@la.gov" },

  // LDEQ
  { id: "mem-ldeq-1", assignmentGroupId: "grp-ldeq-water", userId: "user-jordan-lee", role: "lead", userName: "Jordan Lee", userEmail: "jordan.lee@la.gov" },
  { id: "mem-ldeq-2", assignmentGroupId: "grp-ldeq-air", userId: "user-jordan-lee", role: "lead", userName: "Jordan Lee", userEmail: "jordan.lee@la.gov" },

  // CPRA
  { id: "mem-cpra-1", assignmentGroupId: "grp-cpra-cup", userId: "user-jean-paul-guidry", role: "lead", userName: "Jean-Paul Guidry", userEmail: "jp.guidry@cpra.la.gov" },
  { id: "mem-cpra-2", assignmentGroupId: "grp-cpra-levee", userId: "user-jean-paul-guidry", role: "lead", userName: "Jean-Paul Guidry", userEmail: "jp.guidry@cpra.la.gov" },

  // OSFM
  { id: "mem-osfm-1", assignmentGroupId: "grp-osfm-lifesafety", userId: "user-dan-thibodeaux", role: "lead", userName: "Chief Dan Thibodeaux", userEmail: "dan.thibodeaux@dps.la.gov" },
  { id: "mem-osfm-2", assignmentGroupId: "grp-osfm-hazmat", userId: "user-dan-thibodeaux", role: "lead", userName: "Chief Dan Thibodeaux", userEmail: "dan.thibodeaux@dps.la.gov" },

  // LSP
  { id: "mem-lsp-1", assignmentGroupId: "grp-lsp-hazmat", userId: "user-robert-landry", role: "lead", userName: "Capt. Robert Landry", userEmail: "robert.landry@dps.la.gov" },

  // Vermilion Parish
  { id: "mem-parish-1", assignmentGroupId: "grp-vermilion-parish", userId: "user-riley-brooks", role: "lead", userName: "Riley Brooks", userEmail: "riley.brooks@vermilionparish.org" },
  { id: "mem-parish-2", assignmentGroupId: "grp-vermilion-publicworks", userId: "user-riley-brooks", role: "lead", userName: "Riley Brooks", userEmail: "riley.brooks@vermilionparish.org" },
];
```

---

## 5. Supabase Queries & Mappings Extensions

### 5.1 `lib/supabase/mappings.ts`

```typescript
export function assignmentGroupRowToDomain(row: Row): AssignmentGroupRecord {
  return {
    id: str(row.id),
    orgCode: str(row.org_code),
    organizationId: str(row.organization_id) || undefined,
    name: str(row.name),
    description: str(row.description) || "",
    leadUserId: str(row.lead_user_id) || undefined,
    active: bool(row.active, true),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

export function assignmentGroupMembershipRowToDomain(row: Row): AssignmentGroupMembershipRecord {
  return {
    id: str(row.id),
    assignmentGroupId: str(row.assignment_group_id),
    userId: str(row.user_id),
    role: (str(row.role, "member") as "member" | "lead" | "backup"),
    createdAt: str(row.created_at),
  };
}
```

### 5.2 `lib/supabase/queries.ts`

```typescript
export async function fetchAssignmentGroups(orgCode?: string): Promise<AssignmentGroupRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  let query = client.from("assignment_groups").select("*").eq("active", true).order("name", { ascending: true });
  if (orgCode) {
    query = query.eq("org_code", orgCode.toUpperCase().trim());
  }
  const { data, error } = await query;
  return error || !data ? [] : data.map(assignmentGroupRowToDomain);
}

export async function fetchAssignmentGroupMemberships(groupId?: string): Promise<AssignmentGroupMembershipRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  let query = client.from("assignment_group_memberships").select("*").order("created_at", { ascending: true });
  if (groupId) {
    query = query.eq("assignment_group_id", groupId);
  }
  const { data, error } = await query;
  return error || !data ? [] : data.map(assignmentGroupMembershipRowToDomain);
}
```

---

## 6. Synthesis & Cross-Component Parity Matrix

| Domain Property | PostgreSQL Column | Drizzle Column | In-Memory Fixture | Repository Hydration Source |
|---|---|---|---|---|
| Assignment Group ID | `assignment_group_id UUID` | `assignmentGroupId: text()` | `assignmentGroupId: string` | `fetchAssignmentGroups` |
| Assigned Fulfiller | `assigned_to_user_id UUID` | `assignedToUserId: text()` | `assignedToUserId: string` | `fetchUserProfiles` |
| ITSM State | `itsm_state TEXT` | `itsmState: text()` | `itsmState: ITSMState` | `fetchWorkstreams` / `fetchCustomerRequests` |
| Priority | `priority TEXT` | `priority: text()` | `priority: PriorityLevel` | `fetchWorkstreams` / `fetchCustomerRequests` |
| Statutory Deadline | `statutory_deadline TIMESTAMPTZ` | `statutoryDeadline: text()` | `statutoryDeadline: string` | `fetchWorkstreams` |
| Clock Status | `clock_status TEXT` | `clockStatus: text()` | `clockStatus: ClockStatus` | `fetchWorkstreams` |
| Clock Paused Reason | `clock_paused_reason TEXT` | `clockPausedReason: text()` | `clockPausedReason: string` | `fetchWorkstreams` |
| Clock Total Paused Sec | `clock_total_paused_seconds INT` | `clockTotalPausedSeconds: integer()` | `clockTotalPausedSeconds: number` | `fetchWorkstreams` |

---

## 7. Verification & Invalidation Strategy

1. **TypeScript Type Safety**:
   - `ProjectDeliveryRepository` conforms to all method signatures required by `PROJECT.md` and UI cockpits.
   - Dual-mode hydration handles `null` / `undefined` safely when switching between database and mock modes.
2. **Regression Baseline**:
   - Running `npm run test` must execute existing test suites (`tests/*.test.mjs`) without failures.
3. **Parity Check**:
   - In-memory assignments in `ProjectDeliveryRepository.assignTicket()` match PostgreSQL behavior in `rpc_assign_ticket`.
   - In-memory state transitions in `ProjectDeliveryRepository.updateTicketITSMState()` match `rpc_update_ticket_itsm_state`.
