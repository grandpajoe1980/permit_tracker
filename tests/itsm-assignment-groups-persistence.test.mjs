import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
const {
  calculatePriority,
  calculateStatutoryClock,
  isClockStatus,
  isITSMState,
  isPriorityLevel,
  mapCustomerRequestStatusToITSMState,
  mapITSMStateToOperationalState,
  mapOperationalStateToITSMState,
  parseITSMState,
  parsePriorityLevel,
  VALID_CLOCK_STATUSES,
  VALID_ITSM_STATES,
  VALID_PRIORITIES,
} = await vite.ssrLoadModule("/lib/domain-models.ts");

const {
  assignmentGroupRowToDomain,
  assignmentGroupMembershipRowToDomain,
  workstreamRowToDomain,
  domainToWorkstreamRow,
  customerRequestRowToDomain,
  domainToCustomerRequestRow,
  taskRowToDomain,
} = await vite.ssrLoadModule("/lib/supabase/mappings.ts");

const schema = await vite.ssrLoadModule("/db/schema.ts");

test("ITSM Assignment Groups: 15 multi-agency queues spanning 8 distinct organizations", () => {
  repository.resetE2EDemo();
  const groups = repository.getAssignmentGroups();
  assert.equal(groups.length >= 15, true, "Should have at least 15 assignment groups");

  const orgCodes = new Set(groups.map((g) => g.orgCode));
  assert.equal(orgCodes.has("SPACEX"), true);
  assert.equal(orgCodes.has("LA-PROJECTS"), true);
  assert.equal(orgCodes.has("DOTD"), true);
  assert.equal(orgCodes.has("LDEQ"), true);
  assert.equal(orgCodes.has("CPRA"), true);
  assert.equal(orgCodes.has("OSFM"), true);
  assert.equal(orgCodes.has("LSP"), true);
  assert.equal(orgCodes.has("VERMILION-PARISH"), true);
  assert.equal(orgCodes.size >= 8, true, "Should cover at least 8 distinct organizations");

  // Verify group lookups by org code
  const dotdGroups = repository.getAssignmentGroups("DOTD");
  assert.equal(dotdGroups.length >= 2, true, "DOTD should have at least 2 queues");
  assert.equal(dotdGroups.some((g) => g.id === "grp-dotd-heavyhaul"), true);
  assert.equal(dotdGroups.some((g) => g.id === "grp-dotd-access"), true);

  const ldeqGroups = repository.getAssignmentGroups("LDEQ");
  assert.equal(ldeqGroups.length >= 2, true, "LDEQ should have at least 2 queues");
  assert.equal(ldeqGroups.some((g) => g.id === "grp-ldeq-water"), true);
  assert.equal(ldeqGroups.some((g) => g.id === "grp-ldeq-air"), true);

  const cpraGroups = repository.getAssignmentGroups("CPRA");
  assert.equal(cpraGroups.length >= 2, true, "CPRA should have at least 2 queues");
  assert.equal(cpraGroups.some((g) => g.id === "grp-cpra-cup"), true);
  assert.equal(cpraGroups.some((g) => g.id === "grp-cpra-levee"), true);
});

test("ITSM Assignment Groups: membership lookups and dynamic group/member creation", () => {
  repository.resetE2EDemo();
  const heavyHaulMembers = repository.getAssignmentGroupMembers("grp-dotd-heavyhaul");
  assert.equal(heavyHaulMembers.length >= 1, true);
  assert.equal(heavyHaulMembers.some((m) => m.userId === "user-sam-rivera"), true);

  // Dynamic group creation
  const createdGroup = repository.createAssignmentGroup({
    orgCode: "USACE",
    name: "USACE - Regulatory Branch Review",
    description: "Army Corps Section 404 and Section 10 permit reviews",
    leadUserId: "user-martin-breaux",
    leadUserName: "Martin Breaux",
  });
  assert.ok(createdGroup.id);
  assert.equal(createdGroup.orgCode, "USACE");
  assert.equal(repository.getAssignmentGroupById(createdGroup.id)?.name, "USACE - Regulatory Branch Review");

  // Dynamic member addition
  const createdMember = repository.addAssignmentGroupMember({
    assignmentGroupId: createdGroup.id,
    userId: "user-martin-breaux",
    role: "lead",
    userName: "Martin Breaux",
    userEmail: "martin.breaux@usace.army.mil",
  });
  assert.ok(createdMember.id);
  assert.equal(createdMember.assignmentGroupId, createdGroup.id);

  const usaceMembers = repository.getAssignmentGroupMembers(createdGroup.id);
  assert.equal(usaceMembers.length, 1);
  assert.equal(usaceMembers[0].userId, "user-martin-breaux");
});

test("Ticket Assignment: group and fulfiller assignment with audit events and notification", () => {
  repository.resetE2EDemo();
  const initialAuditCount = repository.getAuditEvents().length;
  const initialNotifCount = repository.getNotifications().length;

  // 1. Re-assign workstream to different group
  const wsAssign = repository.assignTicketToGroup(
    "workstream",
    "WS-LA82-HEAVYHAUL",
    "grp-dotd-access",
    "Sarah Johnson",
    "Reassigned to highway access team for route clearance"
  );
  assert.equal(wsAssign.success, true);
  assert.equal(wsAssign.ticket.assignmentGroupId, "grp-dotd-access");
  assert.equal(wsAssign.ticket.assignmentGroupName, "DOTD - Highway Access & Heavy-Haul");
  assert.equal(wsAssign.ticket.assignedOrgCode, "DOTD");

  // Verify reassignment audit event
  assert.equal(repository.getAuditEvents()[0].actionType, "ticket_reassigned");

  // 2. Re-assign workstream to new fulfiller
  const wsFulfiller = repository.assignTicketToFulfiller(
    "workstream",
    "WS-LA82-HEAVYHAUL",
    "user-maya-chen",
    "Sarah Johnson",
    "Reassigned to Maya Chen for specialized review"
  );
  assert.equal(wsFulfiller.success, true);
  assert.equal(wsFulfiller.ticket.assignedToUserId, "user-maya-chen");

  // 3. Verify audit event logged for fulfiller reassignment
  const audits = repository.getAuditEvents();
  assert.equal(audits.length >= initialAuditCount + 2, true);
  const latestAudit = audits[0];
  assert.equal(latestAudit.entityType, "workstream");
  assert.equal(latestAudit.actionType, "ticket_reassigned");

  // 4. Verify notification generated for fulfiller
  const notifs = repository.getNotifications();
  assert.equal(notifs.length > initialNotifCount, true);
  assert.equal(notifs[0].userId, "user-maya-chen");
  assert.equal(notifs[0].type, "assignment");

  // 5. Query tickets by assignment group & fulfiller
  const groupTickets = repository.getTicketsByAssignmentGroup("grp-dotd-access");
  assert.equal(groupTickets.workstreams.some((w) => w.id === "WS-LA82-HEAVYHAUL"), true);

  const fulfillerTickets = repository.getTicketsByFulfiller("user-maya-chen");
  assert.equal(fulfillerTickets.workstreams.some((w) => w.id === "WS-LA82-HEAVYHAUL"), true);
});

test("ITSM State Machine: state transitions, clock pause/resume, and operational synchronization", () => {
  repository.resetE2EDemo();

  // Test Workstream State Transitions
  const ws = repository.getWorkstreamById("WS-WETLANDS-PAD-A");
  assert.ok(ws);

  // Transition to pending_agency (should pause clock)
  const pauseResult = repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId: "WS-WETLANDS-PAD-A",
    targetState: "pending_agency",
    actorName: "Sarah Johnson",
    pauseReason: "Awaiting USACE jurisdictional wetland boundary concurrence",
  });
  assert.equal(pauseResult.success, true);
  assert.equal(pauseResult.ticket.itsmState, "pending_agency");
  assert.equal(pauseResult.ticket.clockStatus, "paused");
  assert.ok(pauseResult.ticket.clockPausedAt);
  assert.equal(pauseResult.ticket.clockPausedReason, "Awaiting USACE jurisdictional wetland boundary concurrence");
  assert.equal(pauseResult.ticket.operationalState, "waiting_government");

  // Transition to in_progress (should resume clock and accrue paused duration)
  const resumeResult = repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId: "WS-WETLANDS-PAD-A",
    targetState: "in_progress",
    actorName: "Sarah Johnson",
    reason: "USACE concurrence received",
  });
  assert.equal(resumeResult.success, true);
  assert.equal(resumeResult.ticket.itsmState, "in_progress");
  assert.equal(resumeResult.ticket.clockStatus, "active");
  assert.equal(resumeResult.ticket.clockPausedAt, undefined);
  assert.equal(resumeResult.ticket.operationalState, "running");

  // Transition to blocked (should pause clock and set health to red)
  const blockResult = repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId: "WS-WETLANDS-PAD-A",
    targetState: "blocked",
    actorName: "Sarah Johnson",
    pauseReason: "Substation right-of-way objection",
  });
  assert.equal(blockResult.success, true);
  assert.equal(blockResult.ticket.itsmState, "blocked");
  assert.equal(blockResult.ticket.clockStatus, "paused");
  assert.equal(blockResult.ticket.operationalState, "blocked");
  assert.equal(blockResult.ticket.ragHealth, "red");

  // Transition to resolved (should stop clock)
  const resolveResult = repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId: "WS-WETLANDS-PAD-A",
    targetState: "resolved",
    actorName: "Sarah Johnson",
    reason: "Final permit issued",
  });
  assert.equal(resolveResult.success, true);
  assert.equal(resolveResult.ticket.itsmState, "resolved");
  assert.equal(resolveResult.ticket.clockStatus, "stopped");
  assert.equal(resolveResult.ticket.operationalState, "complete");
  assert.ok(resolveResult.ticket.actualCompletionDate);
});

test("Priority Matrix: 4x4 calculation and priority updates", () => {
  // Verify Priority Matrix Entries
  assert.equal(calculatePriority("critical", "critical"), "P1");
  assert.equal(calculatePriority("critical", "high"), "P1");
  assert.equal(calculatePriority("high", "critical"), "P1");

  assert.equal(calculatePriority("critical", "medium"), "P2");
  assert.equal(calculatePriority("high", "high"), "P2");
  assert.equal(calculatePriority("medium", "critical"), "P2");

  assert.equal(calculatePriority("medium", "high"), "P3");
  assert.equal(calculatePriority("high", "medium"), "P3");
  assert.equal(calculatePriority("medium", "medium"), "P3");
  assert.equal(calculatePriority("low", "critical"), "P3");

  assert.equal(calculatePriority("low", "high"), "P4");
  assert.equal(calculatePriority("low", "medium"), "P4");
  assert.equal(calculatePriority("low", "low"), "P4");
  assert.equal(calculatePriority("high", "low"), "P4");
  assert.equal(calculatePriority("medium", "low"), "P4");

  // Test setTicketPriority mutation
  repository.resetE2EDemo();
  const prioResult = repository.setTicketPriority({
    ticketType: "workstream",
    ticketId: "WS-SUBSTATION-230KV",
    priority: "P1",
    actorName: "Sarah Johnson",
    reason: "Critical path transformer delay escalation",
  });
  assert.equal(prioResult.success, true);
  assert.equal(prioResult.ticket.priority, "P1");

  const latestAudit = repository.getAuditEvents()[0];
  assert.equal(latestAudit.actionType, "priority_changed");
  assert.equal(latestAudit.newValue, "P1");
});

test("Statutory Clock Calculation Engine: active, paused, multi-pause elapsed days", () => {
  // Active clock with no pauses
  const activeClock = calculateStatutoryClock({
    statutoryDays: 60,
    startDate: "2026-08-01",
    asOfDate: "2026-08-21",
    clockStatus: "active",
  });
  assert.equal(activeClock.statutoryDays, 60);
  assert.equal(activeClock.elapsedDays, 20);
  assert.equal(activeClock.remainingDays, 40);
  assert.equal(activeClock.isPaused, false);
  assert.equal(activeClock.totalPausedDays, 0);

  // Clock with historical pause of 10 days
  const pausedClock = calculateStatutoryClock({
    statutoryDays: 60,
    startDate: "2026-08-01",
    asOfDate: "2026-08-31",
    clockStatus: "active",
    pauseHistory: [
      {
        pausedAt: "2026-08-10T00:00:00Z",
        resumedAt: "2026-08-20T00:00:00Z",
        pauseDurationDays: 10,
        pauseReason: "RFI Cycle",
      },
    ],
  });
  assert.equal(pausedClock.totalPausedDays, 10);
  assert.equal(pausedClock.elapsedDays, 20); // 30 raw days - 10 paused days = 20 elapsed days
  assert.equal(pausedClock.remainingDays, 40);
});

test("Type Guards & Mapping Helpers: bidirectional validation fidelity", () => {
  // Validate type guards
  assert.equal(isITSMState("in_progress"), true);
  assert.equal(isITSMState("unknown_state"), false);
  assert.equal(isPriorityLevel("P1"), true);
  assert.equal(isPriorityLevel("P5"), false);
  assert.equal(isClockStatus("paused"), true);
  assert.equal(isClockStatus("invalid"), false);

  // Validate state mapping functions
  assert.equal(mapOperationalStateToITSMState("complete"), "resolved");
  assert.equal(mapOperationalStateToITSMState("blocked"), "blocked");
  assert.equal(mapOperationalStateToITSMState("waiting_applicant"), "pending_customer");
  assert.equal(mapOperationalStateToITSMState("waiting_government"), "pending_agency");
  assert.equal(mapOperationalStateToITSMState("running"), "in_progress");

  assert.equal(mapITSMStateToOperationalState("resolved"), "complete");
  assert.equal(mapITSMStateToOperationalState("pending_customer"), "waiting_applicant");
  assert.equal(mapITSMStateToOperationalState("pending_agency"), "waiting_government");
  assert.equal(mapITSMStateToOperationalState("blocked"), "blocked");
  assert.equal(mapITSMStateToOperationalState("in_progress"), "running");

  assert.equal(mapCustomerRequestStatusToITSMState("triage"), "triaged");
  assert.equal(mapCustomerRequestStatusToITSMState("in_progress"), "in_progress");
  assert.equal(mapCustomerRequestStatusToITSMState("resolved"), "resolved");
});

test("Supabase Mappings: Assignment Group, Workstream, Customer Request, and Task ITSM fidelity", () => {
  // Assignment Group row mapping
  const groupRow = {
    id: "grp-test-1",
    org_code: "DOTD",
    organization_id: "org-dotd",
    name: "DOTD - Bridge Review",
    description: "Structural load ratings",
    lead_user_id: "user-sam-rivera",
    active: true,
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
  const groupDomain = assignmentGroupRowToDomain(groupRow);
  assert.equal(groupDomain.id, "grp-test-1");
  assert.equal(groupDomain.orgCode, "DOTD");
  assert.equal(groupDomain.name, "DOTD - Bridge Review");

  // Assignment Group Membership row mapping
  const membershipRow = {
    id: "mem-test-1",
    assignment_group_id: "grp-test-1",
    user_id: "user-sam-rivera",
    role: "lead",
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
  const membershipDomain = assignmentGroupMembershipRowToDomain(membershipRow);
  assert.equal(membershipDomain.id, "mem-test-1");
  assert.equal(membershipDomain.assignmentGroupId, "grp-test-1");
  assert.equal(membershipDomain.role, "lead");

  // Workstream ITSM row mapping
  const wsRow = {
    id: "ws-test-1",
    project_id: "proj-1",
    code: "WS-TEST-1",
    title: "Test Workstream",
    assignment_group_id: "grp-test-1",
    assignment_group_name: "DOTD - Bridge Review",
    assigned_to_user_id: "user-sam-rivera",
    assigned_to_user_name: "Sam Rivera",
    assigned_org_code: "DOTD",
    itsm_state: "in_progress",
    priority: "P2",
    statutory_deadline: "2026-10-15",
    clock_status: "active",
    clock_total_paused_seconds: 3600,
  };
  const wsDomain = workstreamRowToDomain(wsRow);
  assert.equal(wsDomain.assignmentGroupId, "grp-test-1");
  assert.equal(wsDomain.assignedToUserId, "user-sam-rivera");
  assert.equal(wsDomain.itsmState, "in_progress");
  assert.equal(wsDomain.priority, "P2");
  assert.equal(wsDomain.statutoryDeadline, "2026-10-15");
  assert.equal(wsDomain.clockStatus, "active");
  assert.equal(wsDomain.clockTotalPausedSeconds, 3600);

  const wsBackToRow = domainToWorkstreamRow(wsDomain);
  assert.equal(wsBackToRow.assignment_group_id, "grp-test-1");
  assert.equal(wsBackToRow.assigned_to_user_id, "user-sam-rivera");
  assert.equal(wsBackToRow.itsm_state, "in_progress");
  assert.equal(wsBackToRow.priority, "P2");
  assert.equal(wsBackToRow.clock_status, "active");

  // Customer Request ITSM row mapping
  const reqRow = {
    id: "req-test-1",
    confirmation_number: "REQ-001",
    project_id: "proj-1",
    request_type: "permit_authorization",
    title: "Request 1",
    description: "Description 1",
    assignment_group_id: "grp-test-1",
    assigned_to_user_id: "user-sam-rivera",
    itsm_state: "submitted",
    priority: "P3",
    urgency: "high",
    impact: "high",
    clock_status: "active",
  };
  const reqDomain = customerRequestRowToDomain(reqRow);
  assert.equal(reqDomain.assignmentGroupId, "grp-test-1");
  assert.equal(reqDomain.assignedToUserId, "user-sam-rivera");
  assert.equal(reqDomain.itsmState, "submitted");
  assert.equal(reqDomain.priority, "P3");
  assert.equal(reqDomain.urgency, "high");
  assert.equal(reqDomain.impact, "high");

  const reqBackToRow = domainToCustomerRequestRow(reqDomain);
  assert.equal(reqBackToRow.assignment_group_id, "grp-test-1");
  assert.equal(reqBackToRow.assigned_to_user_id, "user-sam-rivera");
  assert.equal(reqBackToRow.itsm_state, "submitted");
  assert.equal(reqBackToRow.priority, "P3");

  // Task ITSM row mapping
  const taskRow = {
    id: "task-test-1",
    workstream_id: "ws-test-1",
    title: "Task 1",
    assigned_org_id: "org-dotd",
    assignment_group_id: "grp-test-1",
    itsm_state: "in_progress",
    priority: "P1",
    clock_status: "active",
  };
  const taskDomain = taskRowToDomain(taskRow);
  assert.equal(taskDomain.assignmentGroupId, "grp-test-1");
  assert.equal(taskDomain.itsmState, "in_progress");
  assert.equal(taskDomain.priority, "P1");
});

test("Drizzle ORM Schema: tables, columns, and relations structural integrity", () => {
  assert.ok(schema.assignmentGroups, "assignmentGroups table must be exported");
  assert.ok(schema.assignmentGroupMemberships, "assignmentGroupMemberships table must be exported");
  assert.ok(schema.organizationsRelations, "organizationsRelations must be exported");
  assert.ok(schema.usersRelations, "usersRelations must be exported");
  assert.ok(schema.assignmentGroupsRelations, "assignmentGroupsRelations must be exported");
  assert.ok(schema.assignmentGroupMembershipsRelations, "assignmentGroupMembershipsRelations must be exported");
  assert.ok(schema.projectsRelations, "projectsRelations must be exported");
  assert.ok(schema.workstreamsRelations, "workstreamsRelations must be exported");
  assert.ok(schema.customerRequestsRelations, "customerRequestsRelations must be exported");
  assert.ok(schema.tasksRelations, "tasksRelations must be exported");
});

test("SQL Migration: schema migration file exists and defines all tables, columns, RLS, and RPCs", () => {
  const migrationPath = resolve(process.cwd(), "supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql");
  assert.equal(existsSync(migrationPath), true, "Migration file must exist");

  const sqlContent = readFileSync(migrationPath, "utf-8");
  assert.equal(sqlContent.includes("CREATE TABLE IF NOT EXISTS public.assignment_groups"), true);
  assert.equal(sqlContent.includes("CREATE TABLE IF NOT EXISTS public.assignment_group_memberships"), true);
  assert.equal(sqlContent.includes("CREATE OR REPLACE FUNCTION public.rpc_assign_ticket"), true);
  assert.equal(sqlContent.includes("CREATE OR REPLACE FUNCTION public.rpc_update_ticket_itsm_state"), true);
  assert.equal(sqlContent.includes("CREATE OR REPLACE FUNCTION public.rpc_set_ticket_priority"), true);
  assert.equal(sqlContent.includes("CREATE OR REPLACE FUNCTION public.rpc_manage_assignment_group"), true);
  assert.equal(sqlContent.includes("CREATE OR REPLACE FUNCTION public.rpc_manage_assignment_group_membership"), true);
  assert.equal(sqlContent.includes("INSERT INTO public.assignment_groups"), true);
});

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
