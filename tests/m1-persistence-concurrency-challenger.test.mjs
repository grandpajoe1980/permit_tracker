import test, { after } from "node:test";
import assert from "node:assert/strict";
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
  auditEventRowToDomain,
  notificationRowToDomain,
} = await vite.ssrLoadModule("/lib/supabase/mappings.ts");

const schema = await vite.ssrLoadModule("/db/schema.ts");
const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");

// =========================================================================
// SECTION 1: IN-MEMORY VS SUPABASE MAPPINGS ROUND-TRIP & TYPE RESILIENCE
// =========================================================================

test("Mappings [Roundtrip]: WorkstreamRecord bidirectional serialization preserves all ITSM attributes", () => {
  const originalDomain = {
    id: "ws-test-roundtrip-1",
    projectId: "PRJ-PECAN-2026",
    code: "WS-TEST-RT",
    title: "Roundtrip Test Workstream",
    category: "permit",
    categoryLabel: "Permit",
    permitTypeId: "CPRA-CUP",
    currentStageName: "Technical Review",
    governmentConcierge: {
      name: "Sarah Johnson",
      title: "State Project Manager",
      agency: "Louisiana Governor's Office",
      email: "sarah.johnson@la.gov",
      phone: "(225) 342-7000",
    },
    regulatoryLead: {
      orgCode: "CPRA",
      orgName: "Coastal Protection and Restoration Authority",
      jurisdictionLevel: "State",
      assignedReviewerName: "Dr. Evelyn Thibodeaux",
      assignedReviewerEmail: "evelyn.thibodeaux@la.gov",
    },
    assignedReviewerUserId: "user-evelyn-thibodeaux",
    operationalState: "waiting_government",
    operationalStateLabel: "Waiting on Government",
    ragHealth: "yellow",
    isCriticalPath: true,
    baselineStartDate: "2026-06-01",
    baselineTargetDate: "2026-09-01",
    forecastStartDate: "2026-06-05",
    forecastTargetDate: "2026-09-15",
    actualStartDate: "2026-06-05",
    scheduleVarianceDays: 14,
    currentActionSummary: "Awaiting interagency hydrological review",
    waitingReason: "Interagency review backlog",
    waitingOnEntity: "CPRA Permitting Unit",
    nextExpectedEvent: "Technical concurrence",
    customerActionRequired: "Provide updated drainage calculations",
    primaryDelayReason: "interagency_dependency",
    delayNotes: "Review queued behind coastal surge model verification",
    escalationLevel: 2,
    escalationTriggeredAt: "2026-08-10T14:00:00Z",
    escalationSummary: "Escalated to agency supervisor",

    // ITSM Fields
    assignmentGroupId: "grp-cpra-cup",
    assignmentGroupName: "CPRA - Coastal Use & Hydrology Permitting",
    assignedToUserId: "user-evelyn-thibodeaux",
    assignedToUserName: "Dr. Evelyn Thibodeaux",
    assignedOrgCode: "CPRA",
    itsmState: "pending_agency",
    priority: "P2",
    statutoryDeadline: "2026-10-15T00:00:00Z",
    clockStatus: "paused",
    clockPausedReason: "Pending interagency hydrology model verification",
    clockPausedAt: "2026-08-01T12:00:00Z",
    clockTotalPausedSeconds: 86400,

    tasks: [],
    commitments: [],
    coordinationRequests: [],
    rfis: [],
  };

  // Convert to DB Row
  const row = domainToWorkstreamRow(originalDomain);

  // Validate DB Row Column Names (snake_case)
  assert.equal(row.id, originalDomain.id);
  assert.equal(row.project_id, originalDomain.projectId);
  assert.equal(row.code, originalDomain.code);
  assert.equal(row.title, originalDomain.title);
  assert.equal(row.assignment_group_id, originalDomain.assignmentGroupId);
  assert.equal(row.assigned_to_user_id, originalDomain.assignedToUserId);
  assert.equal(row.assigned_org_code, originalDomain.assignedOrgCode);
  assert.equal(row.itsm_state, originalDomain.itsmState);
  assert.equal(row.priority, originalDomain.priority);
  assert.equal(row.statutory_deadline, originalDomain.statutoryDeadline);
  assert.equal(row.clock_status, originalDomain.clockStatus);
  assert.equal(row.clock_paused_reason, originalDomain.clockPausedReason);
  assert.equal(row.clock_paused_at, originalDomain.clockPausedAt);
  assert.equal(row.clock_total_paused_seconds, originalDomain.clockTotalPausedSeconds);

  // Convert back to Domain Record
  const hydratedDomain = workstreamRowToDomain(row);

  // Assert equivalence of all ITSM properties
  assert.equal(hydratedDomain.id, originalDomain.id);
  assert.equal(hydratedDomain.assignmentGroupId, originalDomain.assignmentGroupId);
  assert.equal(hydratedDomain.assignedToUserId, originalDomain.assignedToUserId);
  assert.equal(hydratedDomain.assignedOrgCode, originalDomain.assignedOrgCode);
  assert.equal(hydratedDomain.itsmState, originalDomain.itsmState);
  assert.equal(hydratedDomain.priority, originalDomain.priority);
  assert.equal(hydratedDomain.statutoryDeadline, originalDomain.statutoryDeadline);
  assert.equal(hydratedDomain.clockStatus, originalDomain.clockStatus);
  assert.equal(hydratedDomain.clockPausedReason, originalDomain.clockPausedReason);
  assert.equal(hydratedDomain.clockPausedAt, originalDomain.clockPausedAt);
  assert.equal(hydratedDomain.clockTotalPausedSeconds, originalDomain.clockTotalPausedSeconds);
});

test("Mappings [Roundtrip]: CustomerRequestRecord bidirectional serialization preserves all ITSM attributes", () => {
  const originalDomain = {
    id: "req-cr-test-1",
    confirmationNumber: "REQ-2026-0042",
    projectId: "PRJ-PECAN-2026",
    requestType: "permit_authorization",
    title: "Access Gate 4 Culvert Permit Request",
    description: "Requesting DOTD Highway 82 culvert connection permit",
    requestedOutcome: "Commercial turn-in authorization",
    locationOrAffectedArea: "LA-82 MP 14.2",
    desiredDate: "2026-09-01",
    scheduleImportance: "critical",
    knownAgencyCode: "DOTD",
    knownPermitTypeId: "DOTD-HEAVYHAUL",
    submittedByUserId: "user-marcus-vance",
    submittedByName: "Marcus Vance",
    relatedWorkstreamId: "WS-LA82-HEAVYHAUL",
    blocksActiveWork: true,
    status: "in_progress",
    attachmentDocumentVersionIds: ["doc-ver-1", "doc-ver-2"],

    // ITSM Fields
    assignmentGroupId: "grp-dotd-access",
    assignmentGroupName: "DOTD - Highway Access & Heavy-Haul",
    assignedToUserId: "user-maya-chen",
    assignedToUserName: "Maya Chen",
    itsmState: "in_progress",
    priority: "P1",
    urgency: "critical",
    impact: "critical",
    statutoryDeadline: "2026-09-15T00:00:00Z",
    clockStatus: "active",
    clockPausedReason: undefined,
    clockPausedAt: undefined,
    clockTotalPausedSeconds: 3600,
    createdAt: "2026-08-01T08:00:00Z",
    updatedAt: "2026-08-05T10:00:00Z",
  };

  const row = domainToCustomerRequestRow(originalDomain);

  assert.equal(row.id, originalDomain.id);
  assert.equal(row.confirmation_number, originalDomain.confirmationNumber);
  assert.equal(row.assignment_group_id, originalDomain.assignmentGroupId);
  assert.equal(row.assigned_to_user_id, originalDomain.assignedToUserId);
  assert.equal(row.itsm_state, originalDomain.itsmState);
  assert.equal(row.priority, originalDomain.priority);
  assert.equal(row.urgency, originalDomain.urgency);
  assert.equal(row.impact, originalDomain.impact);
  assert.equal(row.statutory_deadline, originalDomain.statutoryDeadline);
  assert.equal(row.clock_status, originalDomain.clockStatus);
  assert.equal(row.clock_total_paused_seconds, originalDomain.clockTotalPausedSeconds);

  const hydrated = customerRequestRowToDomain(row);
  assert.equal(hydrated.id, originalDomain.id);
  assert.equal(hydrated.assignmentGroupId, originalDomain.assignmentGroupId);
  assert.equal(hydrated.assignedToUserId, originalDomain.assignedToUserId);
  assert.equal(hydrated.itsmState, originalDomain.itsmState);
  assert.equal(hydrated.priority, originalDomain.priority);
  assert.equal(hydrated.urgency, originalDomain.urgency);
  assert.equal(hydrated.impact, originalDomain.impact);
  assert.equal(hydrated.clockStatus, originalDomain.clockStatus);
  assert.equal(hydrated.clockTotalPausedSeconds, originalDomain.clockTotalPausedSeconds);
});

test("Mappings [Fuzz/Resilience]: Handles null, undefined, unexpected types, and coerced values gracefully", () => {
  // Test Row with nulls and missing values
  const emptyRow = {
    id: "ws-empty",
    project_id: "PRJ-1",
    code: "WS-EMPTY",
    title: "Empty Workstream",
    assignment_group_id: null,
    assigned_to_user_id: null,
    assigned_org_code: null,
    itsm_state: null,
    priority: null,
    statutory_deadline: null,
    clock_status: null,
    clock_paused_reason: null,
    clock_paused_at: null,
    clock_total_paused_seconds: null,
  };

  const ws = workstreamRowToDomain(emptyRow);
  assert.equal(ws.id, "ws-empty");
  assert.equal(ws.assignmentGroupId, undefined);
  assert.equal(ws.assignedToUserId, undefined);
  assert.equal(ws.assignedOrgCode, undefined);
  assert.equal(ws.itsmState, undefined);
  assert.equal(ws.priority, undefined);
  assert.equal(ws.statutoryDeadline, undefined);
  assert.equal(ws.clockStatus, undefined);
  assert.equal(ws.clockPausedReason, undefined);
  assert.equal(ws.clockPausedAt, undefined);
  assert.equal(ws.clockTotalPausedSeconds, 0); // fallback to 0

  // Coercion test: string numbers for clock_total_paused_seconds
  const coercedRow = {
    id: "ws-coerced",
    project_id: "PRJ-1",
    code: "WS-COERCED",
    title: "Coerced Workstream",
    clock_total_paused_seconds: "12345",
    is_critical_path: "true",
  };
  const wsCoerced = workstreamRowToDomain(coercedRow);
  assert.equal(wsCoerced.clockTotalPausedSeconds, 12345);
  assert.equal(wsCoerced.isCriticalPath, true);

  // Assignment Group mappings resilience
  const groupRow = {
    id: "grp-test",
    org_code: "DOTD",
    name: "DOTD Structures",
    description: null,
    lead_user_id: null,
    active: "1",
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
  const grp = assignmentGroupRowToDomain(groupRow);
  assert.equal(grp.id, "grp-test");
  assert.equal(grp.description, "");
  assert.equal(grp.leadUserId, undefined);
  assert.equal(grp.active, true);

  // Assignment Group Membership mapping resilience
  const memberRow = {
    id: "mem-test",
    assignment_group_id: "grp-test",
    user_id: "user-1",
    role: "lead",
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
  const mem = assignmentGroupMembershipRowToDomain(memberRow);
  assert.equal(mem.id, "mem-test");
  assert.equal(mem.role, "lead");
});

// =========================================================================
// SECTION 2: DRIZZLE SCHEMA RELATIONAL INTEGRITY & FOREIGN KEYS
// =========================================================================

test("Drizzle Schema: Table definitions and columns match ITSM requirements", () => {
  // 1. Check assignmentGroups table columns
  assert.ok(schema.assignmentGroups, "assignmentGroups table must be exported");
  assert.ok(schema.assignmentGroups.id, "id column required");
  assert.ok(schema.assignmentGroups.orgCode, "orgCode column required");
  assert.ok(schema.assignmentGroups.organizationId, "organizationId column required");
  assert.ok(schema.assignmentGroups.name, "name column required");
  assert.ok(schema.assignmentGroups.description, "description column required");
  assert.ok(schema.assignmentGroups.leadUserId, "leadUserId column required");
  assert.ok(schema.assignmentGroups.active, "active column required");

  // 2. Check assignmentGroupMemberships table columns
  assert.ok(schema.assignmentGroupMemberships, "assignmentGroupMemberships table must be exported");
  assert.ok(schema.assignmentGroupMemberships.assignmentGroupId, "assignmentGroupId column required");
  assert.ok(schema.assignmentGroupMemberships.userId, "userId column required");
  assert.ok(schema.assignmentGroupMemberships.role, "role column required");

  // 3. Check workstreams table ITSM extensions
  assert.ok(schema.workstreams.assignmentGroupId, "workstreams.assignmentGroupId column required");
  assert.ok(schema.workstreams.assignedToUserId, "workstreams.assignedToUserId column required");
  assert.ok(schema.workstreams.assignedOrgCode, "workstreams.assignedOrgCode column required");
  assert.ok(schema.workstreams.itsmState, "workstreams.itsmState column required");
  assert.ok(schema.workstreams.priority, "workstreams.priority column required");
  assert.ok(schema.workstreams.statutoryDeadline, "workstreams.statutoryDeadline column required");
  assert.ok(schema.workstreams.clockStatus, "workstreams.clockStatus column required");
  assert.ok(schema.workstreams.clockPausedReason, "workstreams.clockPausedReason column required");
  assert.ok(schema.workstreams.clockPausedAt, "workstreams.clockPausedAt column required");
  assert.ok(schema.workstreams.clockTotalPausedSeconds, "workstreams.clockTotalPausedSeconds column required");

  // 4. Check customerRequests table ITSM extensions
  assert.ok(schema.customerRequests.assignmentGroupId, "customerRequests.assignmentGroupId column required");
  assert.ok(schema.customerRequests.assignedToUserId, "customerRequests.assignedToUserId column required");
  assert.ok(schema.customerRequests.itsmState, "customerRequests.itsmState column required");
  assert.ok(schema.customerRequests.priority, "customerRequests.priority column required");
  assert.ok(schema.customerRequests.urgency, "customerRequests.urgency column required");
  assert.ok(schema.customerRequests.impact, "customerRequests.impact column required");
  assert.ok(schema.customerRequests.statutoryDeadline, "customerRequests.statutoryDeadline column required");
  assert.ok(schema.customerRequests.clockStatus, "customerRequests.clockStatus column required");
  assert.ok(schema.customerRequests.clockPausedReason, "customerRequests.clockPausedReason column required");
  assert.ok(schema.customerRequests.clockPausedAt, "customerRequests.clockPausedAt column required");
  assert.ok(schema.customerRequests.clockTotalPausedSeconds, "customerRequests.clockTotalPausedSeconds column required");
});

test("Drizzle Relations: Relational link definitions across groups, memberships, users, and tickets", () => {
  // 1. Assignment Groups Relations
  assert.ok(schema.assignmentGroupsRelations, "assignmentGroupsRelations must be defined");
  // 2. Assignment Group Memberships Relations
  assert.ok(schema.assignmentGroupMembershipsRelations, "assignmentGroupMembershipsRelations must be defined");
  // 3. Workstreams Relations
  assert.ok(schema.workstreamsRelations, "workstreamsRelations must be defined");
  // 4. Customer Requests Relations
  assert.ok(schema.customerRequestsRelations, "customerRequestsRelations must be defined");
  // 5. Users Relations
  assert.ok(schema.usersRelations, "usersRelations must be defined");
  // 6. Organizations Relations
  assert.ok(schema.organizationsRelations, "organizationsRelations must be defined");
  // 7. Tasks Relations
  assert.ok(schema.tasksRelations, "tasksRelations must be defined");
});

test("Fixture Referential Integrity: All assignment groups, memberships, and workstream assignments resolve correctly", () => {
  const { assignmentGroupsData, assignmentGroupMembershipsData, workstreamsData, registeredOrganizations } = fixture;

  const validGroupIds = new Set(assignmentGroupsData.map((g) => g.id));

  // 1. Check every group has required fields
  for (const group of assignmentGroupsData) {
    assert.ok(group.orgCode, `Group ${group.id} must have an orgCode`);
    assert.ok(group.name, `Group ${group.id} must have a name`);
    assert.equal(typeof group.active, "boolean", `Group ${group.id} active must be boolean`);
  }

  // 2. Every group membership must reference an existing group
  for (const mem of assignmentGroupMembershipsData) {
    assert.equal(
      validGroupIds.has(mem.assignmentGroupId),
      true,
      `Membership ${mem.id} references non-existent group ${mem.assignmentGroupId}`
    );
    assert.ok(mem.userId, `Membership ${mem.id} must have userId`);
    assert.equal(
      ["member", "lead", "backup"].includes(mem.role),
      true,
      `Membership ${mem.id} has invalid role ${mem.role}`
    );
  }

  // 3. Every workstream with an assignmentGroupId must reference a valid group
  for (const ws of workstreamsData) {
    if (ws.assignmentGroupId) {
      assert.equal(
        validGroupIds.has(ws.assignmentGroupId),
        true,
        `Workstream ${ws.id} references non-existent assignment group ${ws.assignmentGroupId}`
      );
    }
    if (ws.itsmState) {
      assert.equal(
        VALID_ITSM_STATES.includes(ws.itsmState),
        true,
        `Workstream ${ws.id} has invalid itsmState ${ws.itsmState}`
      );
    }
    if (ws.priority) {
      assert.equal(
        VALID_PRIORITIES.includes(ws.priority),
        true,
        `Workstream ${ws.id} has invalid priority ${ws.priority}`
      );
    }
    if (ws.clockStatus) {
      assert.equal(
        VALID_CLOCK_STATUSES.includes(ws.clockStatus),
        true,
        `Workstream ${ws.id} has invalid clockStatus ${ws.clockStatus}`
      );
    }
  }
});

// =========================================================================
// SECTION 3: AUDIT EVENT & NOTIFICATION DISPATCH INVARIANTS UPON REASSIGNMENTS
// =========================================================================

test("Audit & Notification Invariants: Initial assignment vs Reassignment distinguishing logic", () => {
  repository.resetE2EDemo();

  // Create a brand new customer request with NO prior assignment
  const initialAuditCount = repository.getAuditEvents().length;
  const initialNotifCount = repository.getNotifications().length;

  const newReq = {
    id: "req-fresh-1",
    confirmationNumber: "REQ-FRESH-001",
    projectId: "PRJ-PECAN-2026",
    requestType: "permit_authorization",
    title: "Fresh Unassigned Request",
    description: "New intake",
    submittedByName: "Marcus Vance",
    submittedByUserId: "user-marcus-vance",
    status: "submitted",
    itsmState: "submitted",
    priority: "P3",
    urgency: "medium",
    impact: "medium",
    clockStatus: "active",
    clockTotalPausedSeconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  repository.getCustomerRequests().push(newReq);

  // 1. First-time assignment (no prior group/assignee)
  const assignResult1 = repository.assignTicket({
    ticketType: "customer_request",
    ticketId: "req-fresh-1",
    assignmentGroupId: "grp-dotd-heavyhaul",
    assignedToUserId: "user-sam-rivera",
    actorName: "Sarah Johnson",
    actorUserId: "user-sarah-johnson",
    reason: "Initial triage to DOTD Heavy-Haul queue",
  });
  assert.equal(assignResult1.success, true);

  // Invariant 1: Action type for first assignment is 'ticket_assigned'
  const audit1 = repository.getAuditEvents()[0];
  assert.equal(audit1.actionType, "ticket_assigned");
  assert.equal(audit1.entityType, "customer_request");
  assert.equal(audit1.entityId, "req-fresh-1");
  assert.equal(audit1.actorName, "Sarah Johnson");
  assert.ok(audit1.newValue.includes("grp-dotd-heavyhaul"));

  // Invariant 2: Notification dispatched to assignee
  const notif1 = repository.getNotifications()[0];
  assert.equal(notif1.userId, "user-sam-rivera");
  assert.equal(notif1.type, "assignment");
  assert.equal(notif1.isRead, false);

  // 2. Re-assign to another group AND another fulfiller
  const assignResult2 = repository.assignTicket({
    ticketType: "customer_request",
    ticketId: "req-fresh-1",
    assignmentGroupId: "grp-dotd-access",
    assignedToUserId: "user-maya-chen",
    actorName: "Sarah Johnson",
    actorUserId: "user-sarah-johnson",
    reason: "Re-routed to Highway Access queue",
  });
  assert.equal(assignResult2.success, true);

  // Invariant 3: Action type for subsequent reassignment is 'ticket_reassigned'
  const audit2 = repository.getAuditEvents()[0];
  assert.equal(audit2.actionType, "ticket_reassigned");
  assert.ok(audit2.oldValue.includes("grp-dotd-heavyhaul"));
  assert.ok(audit2.newValue.includes("grp-dotd-access"));

  // Invariant 4: Notification dispatched to new assignee
  const notif2 = repository.getNotifications()[0];
  assert.equal(notif2.userId, "user-maya-chen");
  assert.equal(notif2.type, "assignment");

  // 3. Re-assign to NO fulfiller (group-only queue routing)
  const assignResult3 = repository.assignTicket({
    ticketType: "customer_request",
    ticketId: "req-fresh-1",
    assignmentGroupId: "grp-ldeq-water",
    assignedToUserId: undefined, // no individual fulfiller
    actorName: "Sarah Johnson",
    reason: "Routed to LDEQ Water general queue",
  });
  assert.equal(assignResult3.success, true);

  // Invariant 5: Notification count did NOT increment for unassigned fulfiller
  const notifsAfterGroupOnly = repository.getNotifications().length;
  assert.equal(notifsAfterGroupOnly, initialNotifCount + 2);
});

test("Audit & Notification Invariants: High-frequency concurrent reassignment burst maintains total audit trail", () => {
  repository.resetE2EDemo();
  const initialAuditCount = repository.getAuditEvents().length;
  const initialNotifCount = repository.getNotifications().length;

  const testTicketId = "WS-WETLANDS-PAD-A";
  const fulfillers = [
    { group: "grp-cpra-cup", user: "user-evelyn-thibodeaux" },
    { group: "grp-cpra-levee", user: "user-martin-breaux" },
    { group: "grp-ldeq-water", user: "user-jordan-lee" },
    { group: "grp-dotd-access", user: "user-maya-chen" },
  ];

  const BURST_COUNT = 40;
  for (let i = 0; i < BURST_COUNT; i++) {
    const target = fulfillers[i % fulfillers.length];
    const res = repository.assignTicket({
      ticketType: "workstream",
      ticketId: testTicketId,
      assignmentGroupId: target.group,
      assignedToUserId: target.user,
      actorName: `Admin Burst #${i}`,
      reason: `Burst test step ${i}`,
    });
    assert.equal(res.success, true);
  }

  // Verify total audit events added = BURST_COUNT
  const finalAuditCount = repository.getAuditEvents().length;
  assert.equal(finalAuditCount, initialAuditCount + BURST_COUNT);

  // Verify total notifications added = BURST_COUNT (since every iteration had a valid user)
  const finalNotifCount = repository.getNotifications().length;
  assert.equal(finalNotifCount, initialNotifCount + BURST_COUNT);

  // Verify chronological audit order (latest first)
  const audits = repository.getAuditEvents();
  assert.equal(audits[0].reason, `Burst test step ${BURST_COUNT - 1}`);
  assert.equal(audits[BURST_COUNT - 1].reason, "Burst test step 0");
});

test("Cross-Tenant Queue Routing: Assignment to different agency queues updates queue filters and ticket metadata", () => {
  repository.resetE2EDemo();

  const ticketId = "WS-LA82-HEAVYHAUL";

  // Initial state: Assigned to DOTD Heavyhaul
  let dotdHeavyTickets = repository.getTicketsByAssignmentGroup("grp-dotd-heavyhaul");
  assert.equal(dotdHeavyTickets.workstreams.some((w) => w.id === ticketId), true);

  // Re-assign to Vermilion Parish Permitting queue (grp-vermilion-parish)
  repository.assignTicket({
    ticketType: "workstream",
    ticketId,
    assignmentGroupId: "grp-vermilion-parish",
    assignedToUserId: "user-riley-brooks",
    actorName: "Sarah Johnson",
    reason: "Local parish road bond verification",
  });

  // Check that old queue no longer contains ticket
  dotdHeavyTickets = repository.getTicketsByAssignmentGroup("grp-dotd-heavyhaul");
  assert.equal(dotdHeavyTickets.workstreams.some((w) => w.id === ticketId), false);

  // Check that new queue contains ticket
  const vermilionTickets = repository.getTicketsByAssignmentGroup("grp-vermilion-parish");
  assert.equal(vermilionTickets.workstreams.some((w) => w.id === ticketId), true);

  // Check assignedOrgCode updated
  const updatedWs = repository.getWorkstreamById(ticketId);
  assert.equal(updatedWs.assignedOrgCode, "VERMILION-PARISH");
  assert.equal(updatedWs.assignmentGroupId, "grp-vermilion-parish");
});

test("Error Resilience: Non-existent ticket assignment and state update return safe error responses", () => {
  repository.resetE2EDemo();
  const initialAuditCount = repository.getAuditEvents().length;
  const initialNotifCount = repository.getNotifications().length;

  // Non-existent ticket assignment
  const invalidAssign = repository.assignTicket({
    ticketType: "workstream",
    ticketId: "WS-DOES-NOT-EXIST",
    assignmentGroupId: "grp-dotd-access",
    assignedToUserId: "user-maya-chen",
  });
  assert.equal(invalidAssign.success, false);
  assert.equal(invalidAssign.ticket, null);

  // Non-existent ticket state update
  const invalidState = repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId: "WS-DOES-NOT-EXIST",
    targetState: "in_progress",
  });
  assert.equal(invalidState.success, false);
  assert.equal(invalidState.ticket, null);

  // Non-existent ticket priority update
  const invalidPriority = repository.setTicketPriority({
    ticketType: "workstream",
    ticketId: "WS-DOES-NOT-EXIST",
    priority: "P1",
  });
  assert.equal(invalidPriority.success, false);
  assert.equal(invalidPriority.ticket, null);

  // Verify no corrupt audit events or phantom notifications were recorded
  assert.equal(repository.getAuditEvents().length, initialAuditCount);
  assert.equal(repository.getNotifications().length, initialNotifCount);
});

// =========================================================================
// SECTION 4: STATUTORY CLOCK PAUSE/RESUME ACCUMULATION & COMPLEXITY
// =========================================================================

test("Statutory Clock: calculateStatutoryClock handles pause history, active pauses, and deadline calculation accurately", () => {
  // Case 1: Simple running clock with 30 statutory days, 10 days elapsed, 0 pauses
  const c1 = calculateStatutoryClock({
    statutoryDays: 30,
    startDate: "2026-08-01",
    asOfDate: "2026-08-11",
    clockStatus: "active",
  });
  assert.equal(c1.statutoryDays, 30);
  assert.equal(c1.elapsedDays, 10);
  assert.equal(c1.remainingDays, 20);
  assert.equal(c1.isPaused, false);
  assert.equal(c1.totalPausedDays, 0);
  assert.equal(c1.statutoryDeadline, "2026-08-31");

  // Case 2: Clock with 1 historical pause of 5 days
  const c2 = calculateStatutoryClock({
    statutoryDays: 30,
    startDate: "2026-08-01",
    asOfDate: "2026-08-16", // 15 calendar days
    clockStatus: "active",
    pauseHistory: [
      {
        pausedAt: "2026-08-05",
        resumedAt: "2026-08-10",
        reason: "RFI Issued",
      },
    ],
  });
  assert.equal(c2.totalPausedDays, 5);
  assert.equal(c2.elapsedDays, 10); // 15 - 5 = 10 net days
  assert.equal(c2.remainingDays, 20);
  // Deadline pushed out by 5 days: August 31 + 5 days = September 5
  assert.equal(c2.statutoryDeadline, "2026-09-05");

  // Case 3: Clock currently paused for 4 days
  const c3 = calculateStatutoryClock({
    statutoryDays: 30,
    startDate: "2026-08-01",
    asOfDate: "2026-08-14", // 13 calendar days
    clockStatus: "paused",
    currentPausedAt: "2026-08-10", // paused 4 days ago
    currentPausedReason: "Awaiting applicant response",
  });
  assert.equal(c3.isPaused, true);
  assert.equal(c3.totalPausedDays, 4);
  assert.equal(c3.elapsedDays, 9); // 13 - 4 = 9
  assert.equal(c3.remainingDays, 21);
  // Deadline pushed out by 4 days: August 31 + 4 days = September 4
  assert.equal(c3.statutoryDeadline, "2026-09-04");
});

test("Statutory Clock: High-cadence interleaved pause-resume state cycles accumulate totalPausedSeconds monotonically", () => {
  repository.resetE2EDemo();
  const ticketId = "WS-WETLANDS-PAD-A";

  const ws = repository.getWorkstreamById(ticketId);
  assert.ok(ws);
  const initialPausedSeconds = ws.clockTotalPausedSeconds || 0;

  // Cycle 1: Pause clock
  repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId,
    targetState: "pending_customer",
    pauseReason: "RFI-001 Issued",
  });
  assert.equal(ws.clockStatus, "paused");
  assert.ok(ws.clockPausedAt);

  // Cycle 1: Resume clock
  repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId,
    targetState: "in_progress",
    reason: "RFI-001 Answered",
  });
  assert.equal(ws.clockStatus, "active");
  assert.equal(ws.clockPausedAt, undefined);
  assert.equal(ws.clockTotalPausedSeconds >= initialPausedSeconds, true);

  const afterCycle1 = ws.clockTotalPausedSeconds;

  // Cycle 2: Pause clock again (pending agency)
  repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId,
    targetState: "pending_agency",
    pauseReason: "Awaiting USACE concurrence",
  });
  assert.equal(ws.clockStatus, "paused");

  // Cycle 2: Resume clock again
  repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId,
    targetState: "in_progress",
    reason: "USACE concurrence received",
  });
  assert.equal(ws.clockStatus, "active");
  assert.equal(ws.clockTotalPausedSeconds >= afterCycle1, true);

  // Cycle 3: Block ticket (pauses clock)
  repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId,
    targetState: "blocked",
    pauseReason: "Public hearing injunction",
  });
  assert.equal(ws.clockStatus, "paused");

  // Cycle 3: Resolve ticket (stops clock and accrues final paused duration)
  repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId,
    targetState: "resolved",
    reason: "Permit issued",
  });
  assert.equal(ws.clockStatus, "stopped");
  assert.equal(ws.clockPausedAt, undefined);
  assert.equal(ws.clockTotalPausedSeconds >= afterCycle1, true);
  assert.ok(!Number.isNaN(ws.clockTotalPausedSeconds));
});
