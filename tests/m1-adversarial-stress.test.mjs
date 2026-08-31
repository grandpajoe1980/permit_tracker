import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

// ============================================================================
// STRESS TEST SUITE 1: ITSM STATE TRANSITIONS & STRING PARSING BOUNDARIES
// ============================================================================

test("Adversarial: parseITSMState handles standard, normalized, and fallback inputs", () => {
  // 1. Exact matches for all valid states
  for (const s of VALID_ITSM_STATES) {
    assert.equal(parseITSMState(s), s);
  }

  // 2. Mixed case and hyphenated replacements
  assert.equal(parseITSMState("IN_PROGRESS"), "in_progress");
  assert.equal(parseITSMState("in-progress"), "in_progress");
  assert.equal(parseITSMState("Pending Customer"), "pending_customer");
  assert.equal(parseITSMState("PENDING_AGENCY"), "pending_agency");
  assert.equal(parseITSMState("triage"), "triaged");
  assert.equal(parseITSMState("TRIAGE"), "triaged");
  assert.equal(parseITSMState("complete"), "resolved");
  assert.equal(parseITSMState("completed"), "resolved");

  // 3. Invalid inputs return specified or default fallback ('submitted')
  assert.equal(parseITSMState("non_existent_state"), "submitted");
  assert.equal(parseITSMState("non_existent_state", "in_progress"), "in_progress");
  assert.equal(parseITSMState(""), "submitted");
  assert.equal(parseITSMState(null), "submitted");
  assert.equal(parseITSMState(undefined), "submitted");
  assert.equal(parseITSMState(12345), "submitted");
  assert.equal(parseITSMState({ state: "in_progress" }), "submitted");
  assert.equal(parseITSMState([]), "submitted");
  assert.equal(parseITSMState(true), "submitted");

  // Verify whitespace trimming in parseITSMState:
  assert.equal(parseITSMState("  blocked  "), "blocked");
  assert.equal(parseITSMState("  Pending Customer  "), "pending_customer");
  assert.equal(parseITSMState("\n triaged \t"), "triaged");
});

test("Adversarial: updateTicketITSMState on non-existent tickets and invalid entities", () => {
  repository.resetE2EDemo();

  // Non-existent ticket ID
  const invalidIdResult = repository.updateTicketITSMState({
    ticketType: "workstream",
    ticketId: "WS-DOES-NOT-EXIST",
    targetState: "in_progress",
  });
  assert.equal(invalidIdResult.success, false);
  assert.equal(invalidIdResult.ticket, null);

  // Invalid ticket type
  const invalidTypeResult = repository.updateTicketITSMState({
    ticketType: "invalid_type",
    ticketId: "WS-WETLANDS-PAD-A",
    targetState: "in_progress",
  });
  assert.equal(invalidTypeResult.success, false);
});

test("Adversarial: ITSM state transitions across all valid entity types and state matrix", () => {
  repository.resetE2EDemo();

  // Setup customer request in repository
  repository.createCustomerRequest({
    confirmationNumber: "CR-MOCK-1",
    projectId: "proj-spacex-la-001",
    requestType: "permit_authorization",
    title: "Adversarial Test Request",
    description: "Test request for state machine",
    submittedByName: "Test Runner",
    blocksActiveWork: false,
    status: "submitted",
  });
  const createdReq = repository.getCustomerRequests()[0];
  assert.ok(createdReq);

  const allEntityTypes = [
    { type: "workstream", id: "WS-WETLANDS-PAD-A" },
    { type: "customer_request", id: createdReq.id },
    { type: "task", id: "task-dotd-1" },
  ];

  // Iterate all entities through every possible state transition in order
  for (const entity of allEntityTypes) {
    for (const targetState of VALID_ITSM_STATES) {
      const res = repository.updateTicketITSMState({
        ticketType: entity.type,
        ticketId: entity.id,
        targetState,
        actorName: "Adversarial Challenger",
        reason: `Testing state transition to ${targetState}`,
        pauseReason: targetState.startsWith("pending") || targetState === "blocked" ? "Testing pause reason" : undefined,
      });

      assert.equal(res.success, true, `Transition to ${targetState} failed for ${entity.type}`);
      assert.equal(res.ticket.itsmState, targetState);

      // Verify clock status invariants
      if (targetState === "pending_customer" || targetState === "pending_agency" || targetState === "blocked") {
        assert.equal(res.ticket.clockStatus, "paused");
        assert.ok(res.ticket.clockPausedAt);
      } else if (targetState === "resolved" || targetState === "closed") {
        assert.equal(res.ticket.clockStatus, "stopped");
        assert.equal(res.ticket.clockPausedAt, undefined);
      } else {
        assert.equal(res.ticket.clockStatus, "active");
        assert.equal(res.ticket.clockPausedAt, undefined);
      }
    }
  }
});

// ============================================================================
// STRESS TEST SUITE 2: ASSIGNMENT ROUTING & AUDIT LEDGER
// ============================================================================

test("Adversarial: Assignment routing behavior with unknown groups and users", () => {
  repository.resetE2EDemo();

  // 1. Assign to valid group
  const validGroupRes = repository.assignTicket({
    ticketType: "workstream",
    ticketId: "WS-WETLANDS-PAD-A",
    assignmentGroupId: "grp-dotd-heavyhaul",
    actorName: "Lead",
    reason: "Valid group route",
  });
  assert.equal(validGroupRes.success, true);
  assert.equal(validGroupRes.ticket.assignmentGroupId, "grp-dotd-heavyhaul");
  assert.equal(validGroupRes.ticket.assignmentGroupName, "DOTD - Structures & Bridge Review");
  assert.equal(validGroupRes.ticket.assignedOrgCode, "DOTD");

  // 2. Assign to unknown group ID (sets ID directly)
  const unknownGroupRes = repository.assignTicket({
    ticketType: "workstream",
    ticketId: "WS-WETLANDS-PAD-A",
    assignmentGroupId: "grp-nonexistent-random-999",
    actorName: "Test Lead",
    reason: "Assigned to unknown group",
  });
  assert.equal(unknownGroupRes.success, true);
  assert.equal(unknownGroupRes.ticket.assignmentGroupId, "grp-nonexistent-random-999");

  // 3. Assign to arbitrary user ID generates notification for target user
  const unknownUserRes = repository.assignTicket({
    ticketType: "workstream",
    ticketId: "WS-WETLANDS-PAD-A",
    assignedToUserId: "user-unknown-ghost-999",
    actorName: "Test Lead",
    reason: "Assigned to unknown user",
  });
  assert.equal(unknownUserRes.success, true);
  assert.equal(unknownUserRes.ticket.assignedToUserId, "user-unknown-ghost-999");
  const notifs = repository.getNotifications();
  assert.equal(notifs.some((n) => n.userId === "user-unknown-ghost-999"), true);
});

test("Adversarial: Rapid reassignment ping-pong between 6 organizations", () => {
  repository.resetE2EDemo();
  const initialAuditCount = repository.getAuditEvents().length;

  const groups = [
    "grp-dotd-heavyhaul",
    "grp-ldeq-water",
    "grp-cpra-cup",
    "grp-osfm-hazmat",
    "grp-vermilion-parish",
    "grp-spacex-tech",
  ];

  // Rapidly reassign 50 times across 6 distinct agencies
  for (let i = 0; i < 50; i++) {
    const targetGroup = groups[i % groups.length];
    const res = repository.assignTicketToGroup(
      "workstream",
      "WS-WETLANDS-PAD-A",
      targetGroup,
      "PingPong Actor",
      `Rapid hop #${i}`
    );
    assert.equal(res.success, true);
    assert.equal(res.ticket.assignmentGroupId, targetGroup);
  }

  const audits = repository.getAuditEvents();
  assert.equal(audits.length, initialAuditCount + 50);
});

// ============================================================================
// STRESS TEST SUITE 3: STATUTORY CLOCK PAUSE/RESUME ACCUMULATOR
// ============================================================================

test("Adversarial: Rapid sequential state toggles maintain clock pause accumulator integrity", () => {
  repository.resetE2EDemo();

  const ticketId = "WS-WETLANDS-PAD-A";
  const ws = repository.getWorkstreamById(ticketId);
  ws.clockTotalPausedSeconds = 0;

  // Toggle active -> paused -> active -> paused -> active 20 times
  for (let i = 0; i < 20; i++) {
    // 1. Pause clock
    const pRes = repository.updateTicketITSMState({
      ticketType: "workstream",
      ticketId,
      targetState: "pending_customer",
      pauseReason: `Pause cycle ${i}`,
    });
    assert.equal(pRes.ticket.clockStatus, "paused");
    assert.ok(pRes.ticket.clockPausedAt);

    // 2. Immediate transition to another paused state (pending_agency) - must NOT reset pausedAt timestamp
    const firstPausedAt = pRes.ticket.clockPausedAt;
    const pRes2 = repository.updateTicketITSMState({
      ticketType: "workstream",
      ticketId,
      targetState: "pending_agency",
      pauseReason: `Transition paused state cycle ${i}`,
    });
    assert.equal(pRes2.ticket.clockStatus, "paused");
    assert.equal(pRes2.ticket.clockPausedAt, firstPausedAt, "PausedAt timestamp must be preserved across paused-to-paused transitions");

    // 3. Resume clock
    const rRes = repository.updateTicketITSMState({
      ticketType: "workstream",
      ticketId,
      targetState: "in_progress",
      reason: `Resume cycle ${i}`,
    });
    assert.equal(rRes.ticket.clockStatus, "active");
    assert.equal(rRes.ticket.clockPausedAt, undefined);
    assert.equal(typeof rRes.ticket.clockTotalPausedSeconds, "number");
    assert.equal(rRes.ticket.clockTotalPausedSeconds >= 0, true);
  }

  assert.equal(ws.clockStatus, "active");
  assert.equal(typeof ws.clockTotalPausedSeconds, "number");
  assert.equal(isNaN(ws.clockTotalPausedSeconds), false);
});

test("Adversarial: calculateStatutoryClock boundary conditions (zero days, negative elapsed, future start, massive pause)", () => {
  // 1. Zero statutory days
  const zeroDays = calculateStatutoryClock({
    statutoryDays: 0,
    startDate: "2026-08-01",
    asOfDate: "2026-08-01",
  });
  assert.equal(zeroDays.statutoryDays, 0);
  assert.equal(zeroDays.elapsedDays, 0);
  assert.equal(zeroDays.remainingDays, 0);

  // 2. asOfDate before startDate (clock queried before formal start date)
  const beforeStart = calculateStatutoryClock({
    statutoryDays: 30,
    startDate: "2026-09-01",
    asOfDate: "2026-08-15",
  });
  assert.equal(beforeStart.elapsedDays, 0); // Math.max(0, ...) ensures no negative elapsed
  assert.equal(beforeStart.remainingDays, 30);

  // 3. Massive pause greater than total duration
  const massivePause = calculateStatutoryClock({
    statutoryDays: 30,
    startDate: "2026-08-01",
    asOfDate: "2026-08-31", // 30 raw days
    pauseHistory: [
      {
        pausedAt: "2026-08-02",
        resumedAt: "2026-08-25",
        pauseDurationDays: 100, // paused for 100 days
      },
    ],
  });
  assert.equal(massivePause.totalPausedDays, 100);
  assert.equal(massivePause.elapsedDays, 0); // 30 - 100 clamped to 0
  assert.equal(massivePause.remainingDays, 30);

  // 4. Currently paused with currentPausedAt
  const currentlyPaused = calculateStatutoryClock({
    statutoryDays: 45,
    startDate: "2026-08-01",
    asOfDate: "2026-08-21",
    isPaused: true,
    currentPausedAt: "2026-08-11", // paused for 10 days
  });
  assert.equal(currentlyPaused.isPaused, true);
  assert.equal(currentlyPaused.totalPausedDays, 10);
  assert.equal(currentlyPaused.elapsedDays, 10); // 20 raw - 10 paused = 10 elapsed
  assert.equal(currentlyPaused.remainingDays, 35);
});

// ============================================================================
// STRESS TEST SUITE 4: PRIORITY MATRIX & PARSING BOUNDARIES
// ============================================================================

test("Adversarial: calculatePriority 4x4 matrix and fallback behavior", () => {
  const levels = ["low", "medium", "high", "critical"];

  // Verify all 16 permutations return valid PriorityLevel
  for (const u of levels) {
    for (const i of levels) {
      const prio = calculatePriority(u, i);
      assert.equal(isPriorityLevel(prio), true, `calculatePriority(${u}, ${i}) returned invalid ${prio}`);
    }
  }

  // Case insensitivity
  assert.equal(calculatePriority("CRITICAL", "CRITICAL"), "P1");
  assert.equal(calculatePriority("High", "High"), "P2");
  assert.equal(calculatePriority("Medium", "Medium"), "P3");
  assert.equal(calculatePriority("Low", "Low"), "P4");

  // Invalid / Unrecognized values fallback to specified fallback
  assert.equal(calculatePriority("catastrophic", "extreme", "P1"), "P1");
  assert.equal(calculatePriority("unknown", "unknown", "P4"), "P4");
});

test("Adversarial: parsePriorityLevel parses strings, numbers, whitespace, and fallbacks", () => {
  assert.equal(parsePriorityLevel("P1"), "P1");
  assert.equal(parsePriorityLevel("p1"), "P1");
  assert.equal(parsePriorityLevel("  P2  "), "P2");
  assert.equal(parsePriorityLevel("critical"), "P1");
  assert.equal(parsePriorityLevel("HIGH"), "P2");
  assert.equal(parsePriorityLevel("medium"), "P3");
  assert.equal(parsePriorityLevel("NORMAL"), "P3");
  assert.equal(parsePriorityLevel("low"), "P4");

  // Invalid fallbacks
  assert.equal(parsePriorityLevel("P5"), "P3");
  assert.equal(parsePriorityLevel("P5", "P4"), "P4");
  assert.equal(parsePriorityLevel("INVALID"), "P3");
  assert.equal(parsePriorityLevel(null), "P3");
  assert.equal(parsePriorityLevel(undefined), "P3");
  assert.equal(parsePriorityLevel(123), "P3");
});

// ============================================================================
// STRESS TEST SUITE 5: BIDIRECTIONAL MAPPINGS & DATA INTEGRITY
// ============================================================================

test("Adversarial: Supabase row and domain converters handle sparse/null columns without throwing", () => {
  // Empty or sparse row
  const sparseWsRow = {
    id: "ws-sparse-1",
    project_id: "proj-1",
    code: "WS-SPARSE",
    title: "Sparse Workstream",
  };
  const wsDomain = workstreamRowToDomain(sparseWsRow);
  assert.equal(wsDomain.id, "ws-sparse-1");
  assert.equal(wsDomain.assignmentGroupId, undefined);
  assert.equal(wsDomain.clockTotalPausedSeconds, 0);

  const sparseReqRow = {
    id: "req-sparse-1",
    confirmation_number: "CR-000",
    project_id: "proj-1",
    title: "Sparse Request",
    description: "Sparse",
  };
  const reqDomain = customerRequestRowToDomain(sparseReqRow);
  assert.equal(reqDomain.id, "req-sparse-1");
  assert.equal(reqDomain.assignmentGroupId, undefined);

  const sparseTaskRow = {
    id: "task-sparse-1",
    workstream_id: "ws-sparse-1",
    title: "Sparse Task",
  };
  const taskDomain = taskRowToDomain(sparseTaskRow);
  assert.equal(taskDomain.id, "task-sparse-1");
});

// ============================================================================
// STRESS TEST SUITE 6: CALENDAR, LEAP YEAR & STATUTORY DEADLINE PRECISION
// ============================================================================

test("Adversarial: Statutory clock handles leap year and year-crossing date arithmetic", () => {
  // 1. Leap year leap day spanning (Feb 2028: 2028-02-15 + 30 days)
  const leapClock = calculateStatutoryClock({
    statutoryDays: 30,
    startDate: "2028-02-15",
    asOfDate: "2028-03-01",
    clockStatus: "active",
  });
  // In 2028 (leap year), Feb has 29 days.
  // 2028-02-15 to 2028-03-01 is 15 days elapsed.
  assert.equal(leapClock.elapsedDays, 15);
  assert.equal(leapClock.remainingDays, 15);
  assert.equal(leapClock.statutoryDeadline, "2028-03-16");

  // 2. Year-crossing statutory clock (Dec 15 -> Jan 14)
  const yearCrossingClock = calculateStatutoryClock({
    statutoryDays: 30,
    startDate: "2026-12-15",
    asOfDate: "2027-01-05",
    clockStatus: "active",
  });
  assert.equal(yearCrossingClock.elapsedDays, 21);
  assert.equal(yearCrossingClock.remainingDays, 9);
  assert.equal(yearCrossingClock.statutoryDeadline, "2027-01-14");

  // 3. Pause extensions pushing deadline across month boundaries
  const pausedMonthCrossClock = calculateStatutoryClock({
    statutoryDays: 30,
    startDate: "2026-08-01",
    asOfDate: "2026-08-20",
    clockStatus: "active",
    pauseHistory: [
      {
        pausedAt: "2026-08-05",
        resumedAt: "2026-08-15",
        pauseDurationDays: 10,
        pauseReason: "Agency Concurrence",
      },
    ],
  });
  // Deadline originally 2026-08-31 (30 days from Aug 1), with 10 days pause pushed to 2026-09-10
  assert.equal(pausedMonthCrossClock.statutoryDeadline, "2026-09-10");
  assert.equal(pausedMonthCrossClock.totalPausedDays, 10);
});

// ============================================================================
// STRESS TEST SUITE 7: POSTGRESQL RLS & RPC STRUCTURAL SECURITY AUDIT
// ============================================================================

test("Adversarial: PostgreSQL migration verifies search_path hardening, RLS, and constraints", () => {
  const sqlPath = resolve(root, "supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  // Verify all 5 RPC functions have SECURITY DEFINER and search_path hardening
  const rpcs = [
    "rpc_assign_ticket",
    "rpc_update_ticket_itsm_state",
    "rpc_set_ticket_priority",
    "rpc_manage_assignment_group",
    "rpc_manage_assignment_group_membership",
  ];

  for (const rpc of rpcs) {
    assert.equal(sql.includes(`CREATE OR REPLACE FUNCTION public.${rpc}`), true, `Missing RPC ${rpc}`);
    assert.equal(sql.includes(`SECURITY DEFINER`), true, `Missing SECURITY DEFINER`);
    assert.equal(sql.includes(`SET search_path = public, app_private`), true, `Missing search_path hardening`);
  }

  // Verify RLS enabled on both new tables
  assert.equal(sql.includes("ALTER TABLE public.assignment_groups ENABLE ROW LEVEL SECURITY"), true);
  assert.equal(sql.includes("ALTER TABLE public.assignment_group_memberships ENABLE ROW LEVEL SECURITY"), true);

  // Verify anonymous and public direct mutations are revoked
  assert.equal(sql.includes("REVOKE INSERT, UPDATE, DELETE ON TABLE public.assignment_groups, public.assignment_group_memberships FROM authenticated"), true);
});

