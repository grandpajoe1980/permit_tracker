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
