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

const scheduleEngine = await vite.ssrLoadModule("/lib/engines/schedule-engine.ts");
const escalationEngine = await vite.ssrLoadModule("/lib/engines/escalation-engine.ts");
const coordinationEngine = await vite.ssrLoadModule("/lib/engines/coordination-engine.ts");
const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");

const {
  solveTaskDAG,
  evaluateProjectSchedule,
  aggregateDelayReasons,
  detectAccelerationOpportunities,
  calculateDateDiffDays,
  addDaysToDate,
} = scheduleEngine;

const { evaluateWorkstreamEscalation } = escalationEngine;
const {
  getAgencyCoordinationViews,
  groupIntoConsolidatedBatch,
  evaluateRFIClockImpact,
} = coordinationEngine;

// =========================================================================
// 1. DAG CRITICAL-PATH ENGINE STRESS TESTS
// =========================================================================

test("DAG Stress: Empty graph returns empty sets and zero project duration", () => {
  const result = solveTaskDAG([], []);
  assert.equal(result.criticalTaskIds.size, 0);
  assert.equal(result.taskEarlyFinish.size, 0);
  assert.equal(result.taskFloat.size, 0);
});

test("DAG Stress: Single task without dependencies has zero float and is critical", () => {
  const singleTask = {
    id: "TASK-SINGLE",
    workstreamId: "WS-1",
    title: "Solo Task",
    taskType: "agency_review",
    assignedOrgId: "org-1",
    assignedOrgCode: "LDEQ",
    status: "in_progress",
    isMilestone: false,
    isCriticalPath: false,
    durationDays: 14,
    floatDays: 0,
    predecessorTaskIds: [],
  };

  const result = solveTaskDAG([singleTask], []);
  assert.equal(result.criticalTaskIds.has("TASK-SINGLE"), true);
  assert.equal(result.taskEarlyFinish.get("TASK-SINGLE"), 14);
  assert.equal(result.taskFloat.get("TASK-SINGLE"), 0);
});

test("DAG Stress: Deep linear chain (500 tasks) computes exact serial duration and zero float without stack overflow", () => {
  const N = 500;
  const tasks = [];
  const dependencies = [];

  for (let i = 0; i < N; i++) {
    const taskId = `TASK-CHAIN-${i}`;
    const predIds = i > 0 ? [`TASK-CHAIN-${i - 1}`] : [];
    tasks.push({
      id: taskId,
      workstreamId: "WS-CHAIN",
      title: `Chain Task ${i}`,
      taskType: i % 10 === 0 ? "milestone" : "agency_review",
      assignedOrgId: "org-1",
      assignedOrgCode: "LDEQ",
      status: "pending",
      isMilestone: i % 10 === 0,
      isCriticalPath: false,
      durationDays: i % 10 === 0 ? 0 : 2, // zero-duration milestones interleaved
      floatDays: 0,
      predecessorTaskIds: predIds,
    });

    if (i > 0) {
      dependencies.push({
        id: `DEP-${i - 1}-${i}`,
        predecessorTaskId: `TASK-CHAIN-${i - 1}`,
        successorTaskId: taskId,
        dependencyType: "finish_to_start",
        gateType: "AND",
        lagDays: 0,
        isControlling: true,
      });
    }
  }

  const result = solveTaskDAG(tasks, dependencies);
  assert.equal(result.criticalTaskIds.size, N, "All tasks in a pure linear chain must be on the critical path");

  // Calculate expected total duration: 450 tasks of 2 days + 50 milestones of 0 days = 900 days
  const expectedTotal = 450 * 2;
  assert.equal(result.taskEarlyFinish.get(`TASK-CHAIN-${N - 1}`), expectedTotal);

  for (let i = 0; i < N; i++) {
    const taskId = `TASK-CHAIN-${i}`;
    assert.equal(result.taskFloat.get(taskId), 0, `Task ${taskId} must have 0 float`);
  }
});

test("DAG Stress: Diamond graph with asymmetric branch lengths calculates accurate float", () => {
  // Graph:
  //      -> B (10d) ->
  // A(5d)             D(2d)
  //      -> C (3d)  ->
  //
  // Path 1: A(5) + B(10) + D(2) = 17 days (Critical Path)
  // Path 2: A(5) + C(3) + D(2)  = 10 days (Float on C = 7 days)

  const tasks = [
    { id: "A", durationDays: 5, predecessorTaskIds: [] },
    { id: "B", durationDays: 10, predecessorTaskIds: ["A"] },
    { id: "C", durationDays: 3, predecessorTaskIds: ["A"] },
    { id: "D", durationDays: 2, predecessorTaskIds: ["B", "C"] },
  ].map((t) => ({
    ...t,
    workstreamId: "WS-DIAMOND",
    title: t.id,
    taskType: "agency_review",
    assignedOrgId: "org-1",
    assignedOrgCode: "LDEQ",
    status: "pending",
    isMilestone: false,
    isCriticalPath: false,
    floatDays: 0,
  }));

  const dependencies = [
    { id: "dep-A-B", predecessorTaskId: "A", successorTaskId: "B", dependencyType: "finish_to_start", gateType: "AND", lagDays: 0, isControlling: true },
    { id: "dep-A-C", predecessorTaskId: "A", successorTaskId: "C", dependencyType: "finish_to_start", gateType: "AND", lagDays: 0, isControlling: false },
    { id: "dep-B-D", predecessorTaskId: "B", successorTaskId: "D", dependencyType: "finish_to_start", gateType: "AND", lagDays: 0, isControlling: true },
    { id: "dep-C-D", predecessorTaskId: "C", successorTaskId: "D", dependencyType: "finish_to_start", gateType: "AND", lagDays: 0, isControlling: false },
  ];

  const result = solveTaskDAG(tasks, dependencies);

  // Early finish assertions
  assert.equal(result.taskEarlyFinish.get("A"), 5);
  assert.equal(result.taskEarlyFinish.get("B"), 15);
  assert.equal(result.taskEarlyFinish.get("C"), 8);
  assert.equal(result.taskEarlyFinish.get("D"), 17);

  // Float assertions
  assert.equal(result.taskFloat.get("A"), 0);
  assert.equal(result.taskFloat.get("B"), 0);
  assert.equal(result.taskFloat.get("C"), 7, "Task C should have exactly 7 days of float (17 - 2 - 3 - 5)");
  assert.equal(result.taskFloat.get("D"), 0);

  // Critical path assertions
  assert.equal(result.criticalTaskIds.has("A"), true);
  assert.equal(result.criticalTaskIds.has("B"), true);
  assert.equal(result.criticalTaskIds.has("C"), false, "Task C is non-critical");
  assert.equal(result.criticalTaskIds.has("D"), true);
});

test("DAG Stress: Massive parallel fan-out / fan-in (50 parallel branches) correctly identifies bottleneck", () => {
  // Start node (1d) -> 50 branches with durations 1..50 -> End node (1d)
  // The branch with duration 50 is the sole critical branch (Total duration = 1 + 50 + 1 = 52)
  const branchesCount = 50;
  const tasks = [];
  const dependencies = [];

  tasks.push({
    id: "START",
    durationDays: 1,
    predecessorTaskIds: [],
    workstreamId: "WS-FAN",
    title: "Start",
    taskType: "milestone",
    assignedOrgId: "org-1",
    assignedOrgCode: "LDEQ",
    status: "completed",
    isMilestone: true,
    isCriticalPath: false,
    floatDays: 0,
  });

  for (let i = 1; i <= branchesCount; i++) {
    const branchId = `BRANCH-${i}`;
    tasks.push({
      id: branchId,
      durationDays: i,
      predecessorTaskIds: ["START"],
      workstreamId: "WS-FAN",
      title: `Branch ${i}`,
      taskType: "agency_review",
      assignedOrgId: "org-1",
      assignedOrgCode: "LDEQ",
      status: "in_progress",
      isMilestone: false,
      isCriticalPath: false,
      floatDays: 0,
    });

    dependencies.push({
      id: `dep-start-${branchId}`,
      predecessorTaskId: "START",
      successorTaskId: branchId,
      dependencyType: "finish_to_start",
      gateType: "AND",
      lagDays: 0,
      isControlling: false,
    });

    dependencies.push({
      id: `dep-${branchId}-end`,
      predecessorTaskId: branchId,
      successorTaskId: "END",
      dependencyType: "finish_to_start",
      gateType: "AND",
      lagDays: 0,
      isControlling: false,
    });
  }

  tasks.push({
    id: "END",
    durationDays: 1,
    predecessorTaskIds: tasks.filter((t) => t.id.startsWith("BRANCH-")).map((t) => t.id),
    workstreamId: "WS-FAN",
    title: "End",
    taskType: "milestone",
    assignedOrgId: "org-1",
    assignedOrgCode: "LDEQ",
    status: "pending",
    isMilestone: true,
    isCriticalPath: false,
    floatDays: 0,
  });

  const result = solveTaskDAG(tasks, dependencies);

  assert.equal(result.taskEarlyFinish.get("END"), 52);
  assert.equal(result.taskFloat.get("START"), 0);
  assert.equal(result.taskFloat.get("END"), 0);
  assert.equal(result.taskFloat.get(`BRANCH-${branchesCount}`), 0);
  assert.equal(result.criticalTaskIds.has(`BRANCH-${branchesCount}`), true);

  // Test float of non-critical branches
  for (let i = 1; i < branchesCount; i++) {
    const expectedFloat = branchesCount - i;
    assert.equal(
      result.taskFloat.get(`BRANCH-${i}`),
      expectedFloat,
      `BRANCH-${i} should have float ${expectedFloat}`
    );
    assert.equal(
      result.criticalTaskIds.has(`BRANCH-${i}`),
      false,
      `BRANCH-${i} should not be critical`
    );
  }
});

test("DAG Stress: Disconnected subgraphs (two independent project tracks)", () => {
  // Track 1: T1_A (10d) -> T1_B (20d) => Total 30d
  // Track 2: T2_A (40d) -> T2_B (10d) => Total 50d (Overall project controlling duration = 50d)
  const tasks = [
    { id: "T1_A", durationDays: 10, predecessorTaskIds: [] },
    { id: "T1_B", durationDays: 20, predecessorTaskIds: ["T1_A"] },
    { id: "T2_A", durationDays: 40, predecessorTaskIds: [] },
    { id: "T2_B", durationDays: 10, predecessorTaskIds: ["T2_A"] },
  ].map((t) => ({
    ...t,
    workstreamId: "WS-DISCONNECTED",
    title: t.id,
    taskType: "agency_review",
    assignedOrgId: "org-1",
    assignedOrgCode: "LDEQ",
    status: "pending",
    isMilestone: false,
    isCriticalPath: false,
    floatDays: 0,
  }));

  const dependencies = [
    { id: "dep-1", predecessorTaskId: "T1_A", successorTaskId: "T1_B", dependencyType: "finish_to_start", gateType: "AND", lagDays: 0, isControlling: false },
    { id: "dep-2", predecessorTaskId: "T2_A", successorTaskId: "T2_B", dependencyType: "finish_to_start", gateType: "AND", lagDays: 0, isControlling: true },
  ];

  const result = solveTaskDAG(tasks, dependencies);

  // Track 2 is critical
  assert.equal(result.taskFloat.get("T2_A"), 0);
  assert.equal(result.taskFloat.get("T2_B"), 0);
  assert.equal(result.criticalTaskIds.has("T2_A"), true);
  assert.equal(result.criticalTaskIds.has("T2_B"), true);

  // Track 1 has 20 days float (50 - 30)
  assert.equal(result.taskFloat.get("T1_A"), 20);
  assert.equal(result.taskFloat.get("T1_B"), 20);
  assert.equal(result.criticalTaskIds.has("T1_A"), false);
  assert.equal(result.criticalTaskIds.has("T1_B"), false);
});

test("Schedule Engine: Date arithmetic utility boundaries", () => {
  assert.equal(calculateDateDiffDays("2026-08-01", "2026-08-14"), 13);
  assert.equal(calculateDateDiffDays("2026-08-14", "2026-08-01"), -13);
  assert.equal(calculateDateDiffDays("2026-08-01", "2026-08-01"), 0);
  assert.equal(calculateDateDiffDays("invalid", "2026-08-01"), 0);
  assert.equal(calculateDateDiffDays("2026-08-01", "invalid"), 0);

  assert.equal(addDaysToDate("2026-08-01", 10), "2026-08-11");
  assert.equal(addDaysToDate("2026-08-31", 1), "2026-09-01");
  assert.equal(addDaysToDate("2026-02-28", 1), "2026-03-01"); // 2026 is non-leap
  assert.equal(addDaysToDate("invalid-date", 5), "invalid-date");
});

test("Schedule Engine: Delay taxonomy covers all 13 taxonomy categories deterministically", () => {
  const delayReasons = [
    "applicant_information",
    "agency_workload",
    "interagency_dependency",
    "statutory_minimum",
    "public_comment",
    "engineering_change",
    "environmental_discovery",
    "legal_challenge",
    "third_party_utility",
    "weather",
    "procurement",
    "scheduling",
    "none",
  ];

  const dummyWorkstreams = delayReasons.map((reason, idx) => ({
    id: `ws-${reason}`,
    code: `WS-${reason.toUpperCase()}`,
    title: `WS ${reason}`,
    category: "permit",
    scheduleVarianceDays: idx + 1,
    primaryDelayReason: reason,
  }));

  const summary = aggregateDelayReasons(dummyWorkstreams);

  for (let i = 0; i < delayReasons.length; i++) {
    const reason = delayReasons[i];
    assert.equal(summary[reason], i + 1, `Category ${reason} must equal ${i + 1}`);
  }

  // Workstreams with scheduleVarianceDays <= 0 should NOT increment delay reasons
  const zeroVarianceWs = [
    { id: "ws-zero", code: "WS-Z", title: "Z", category: "permit", scheduleVarianceDays: 0, primaryDelayReason: "weather" },
    { id: "ws-neg", code: "WS-N", title: "N", category: "permit", scheduleVarianceDays: -5, primaryDelayReason: "weather" },
  ];
  const zeroSummary = aggregateDelayReasons(zeroVarianceWs);
  assert.equal(zeroSummary.weather, 0);
});

test("Schedule Engine: Parallel review acceleration detection heuristics", () => {
  const eligibleWs = [
    {
      id: "ws-acc-1",
      title: "CPRA Consistency Review",
      operationalState: "waiting_government",
      waitingOnEntity: "CPRA / DNR",
      scheduleVarianceDays: 13,
    },
    {
      id: "ws-acc-2",
      title: "Utility Interconnect Review",
      operationalState: "waiting_government",
      waitingOnEntity: "LPSC",
      scheduleVarianceDays: 3,
    },
    {
      id: "ws-acc-3",
      title: "DOTD Heavy Haul Route",
      operationalState: "running", // Not waiting_government -> ineligible
      waitingOnEntity: "DOTD",
      scheduleVarianceDays: 10,
    },
    {
      id: "ws-acc-4",
      title: "Wetlands Permit",
      operationalState: "waiting_government",
      waitingOnEntity: undefined, // No entity -> ineligible
      scheduleVarianceDays: 10,
    },
  ];

  const opportunities = detectAccelerationOpportunities(eligibleWs);
  assert.equal(opportunities.length, 2, "Only waiting_government with waitingOnEntity should be detected");

  // ws-acc-1 has variance 13 -> daysSaved = min(14, max(5, 13)) = 13
  assert.equal(opportunities[0].workstreamId, "ws-acc-1");
  assert.equal(opportunities[0].potentialDaysSaved, 13);
  assert.ok(opportunities[0].explanation.includes("CPRA / DNR coordination can proceed concurrently"));

  // ws-acc-2 has variance 3 -> daysSaved = min(14, max(5, 3)) = 5 (lower bounded to 5)
  assert.equal(opportunities[1].workstreamId, "ws-acc-2");
  assert.equal(opportunities[1].potentialDaysSaved, 5);
});

// =========================================================================
// 2. 5-TIER ESCALATION ENGINE STRESS TESTS
// =========================================================================

test("Escalation Engine: Comprehensive 5-Tier Boundary Matrix (Days 0, 7, 8, 9, 10, 11, 12, 14, 15, 16)", () => {
  const baseWs = {
    id: "ws-test",
    code: "WS-TEST",
    title: "Test Workstream",
    category: "permit",
    isCriticalPath: false,
    operationalState: "running",
    scheduleVarianceDays: 0,
    governmentConcierge: { name: "Sarah Johnson", title: "Concierge", agency: "State", email: "", phone: "" },
    regulatoryLead: {
      orgCode: "LDEQ",
      orgName: "Louisiana Department of Environmental Quality",
      jurisdictionLevel: "State",
      assignedReviewerName: "Mark Dupree",
      assignedReviewerEmail: "mark.dupree@la.gov",
    },
  };

  // 1. Day 0-7: Level 0 (Reviewer / Normal Review)
  for (const day of [0, 1, 4, 7]) {
    const eval0 = evaluateWorkstreamEscalation(baseWs, day);
    assert.equal(eval0.currentLevel, 0, `Day ${day} must be Level 0`);
    assert.equal(eval0.isEscalated, false, `Day ${day} is not escalated`);
    assert.equal(eval0.isExecutiveActionRequired, false);
    assert.equal(eval0.levelLabel, "Level 0: Normal Review");
  }

  // 2. Day 8-9: Level 1 (Reviewer warning)
  for (const day of [8, 9]) {
    const eval1 = evaluateWorkstreamEscalation(baseWs, day);
    assert.equal(eval1.currentLevel, 1, `Day ${day} must be Level 1`);
    assert.equal(eval1.isEscalated, false, `Day ${day} warning is not escalated`);
    assert.equal(eval1.levelLabel, "Level 1: Reviewer Warning");
    assert.ok(eval1.notifiedParties.includes("Assigned Reviewer"));
    assert.equal(eval1.nextEscalationParty, "Section Supervisor");
  }

  // 3. Day 10-11: Level 2 (Supervisor Escalation)
  for (const day of [10, 11]) {
    const eval2 = evaluateWorkstreamEscalation(baseWs, day);
    assert.equal(eval2.currentLevel, 2, `Day ${day} must be Level 2`);
    assert.equal(eval2.isEscalated, true, `Day ${day} must be escalated`);
    assert.equal(eval2.levelLabel, "Level 2: Supervisor Escalation");
    assert.ok(eval2.notifiedParties.includes("Section Supervisor"));
    assert.equal(eval2.nextEscalationParty, "Agency Project Liaison");
  }

  // 4. Day 12-14: Level 3 (Agency Project Liaison Notified)
  for (const day of [12, 13, 14]) {
    const eval3 = evaluateWorkstreamEscalation(baseWs, day);
    assert.equal(eval3.currentLevel, 3, `Day ${day} must be Level 3`);
    assert.equal(eval3.isEscalated, true, `Day ${day} must be escalated`);
    assert.equal(eval3.levelLabel, "Level 3: Agency Project Liaison Notified");
    assert.ok(eval3.notifiedParties.includes("Agency Project Liaison"));
    assert.equal(eval3.nextEscalationParty, "State Project Office");
  }

  // 5. Day 15+: Level 4 (State Project Office Engaged)
  for (const day of [15, 16, 30]) {
    const eval4 = evaluateWorkstreamEscalation(baseWs, day);
    assert.equal(eval4.currentLevel, 4, `Day ${day} must be Level 4`);
    assert.equal(eval4.isEscalated, true, `Day ${day} must be escalated`);
    assert.equal(eval4.levelLabel, "Level 4: State Project Office Engaged");
    assert.ok(eval4.notifiedParties.includes("State Project Office"));
  }
});

test("Escalation Engine: Schedule Variance boundary values (variance 0, 1, 2, 3, 4, 5, 10)", () => {
  const makeWs = (variance, isCritical = false, state = "running") => ({
    id: "ws-var",
    code: "WS-VAR",
    title: "Variance Test",
    category: "permit",
    isCriticalPath: isCritical,
    operationalState: state,
    scheduleVarianceDays: variance,
    governmentConcierge: { name: "Sarah Johnson", title: "Concierge", agency: "State", email: "", phone: "" },
    regulatoryLead: {
      orgCode: "LDEQ",
      orgName: "LDEQ",
      jurisdictionLevel: "State",
      assignedReviewerName: "Mark Dupree",
      assignedReviewerEmail: "mark@la.gov",
    },
  });

  // Non-critical path with low elapsed days (elapsed = 5d) driven strictly by variance:
  assert.equal(evaluateWorkstreamEscalation(makeWs(0), 5).currentLevel, 0);
  assert.equal(evaluateWorkstreamEscalation(makeWs(1), 5).currentLevel, 1);
  assert.equal(evaluateWorkstreamEscalation(makeWs(2), 5).currentLevel, 2);
  assert.equal(evaluateWorkstreamEscalation(makeWs(3), 5).currentLevel, 3);
  assert.equal(evaluateWorkstreamEscalation(makeWs(4), 5).currentLevel, 4);
  assert.equal(evaluateWorkstreamEscalation(makeWs(5, false), 5).currentLevel, 4);
  assert.equal(evaluateWorkstreamEscalation(makeWs(10, false), 5).currentLevel, 4); // Non-critical path caps at Level 4

  // Critical path with variance >= 5 triggers State Project Office Intervention (Level 4)
  const cp5 = evaluateWorkstreamEscalation(makeWs(5, true), 5);
  assert.equal(cp5.currentLevel, 4);
  assert.equal(cp5.levelLabel, "Level 4: State Project Office Intervention");
  assert.equal(cp5.isEscalated, true);
  assert.equal(cp5.isExecutiveActionRequired, false);
  assert.ok(cp5.notifiedParties.some((p) => p.includes("Sarah Johnson")));

  // Critical path with variance >= 10 triggers Level 5 Executive Megaproject Review
  const cp10 = evaluateWorkstreamEscalation(makeWs(10, true), 5);
  assert.equal(cp10.currentLevel, 5);
  assert.equal(cp10.levelLabel, "Level 5: Executive Megaproject Review");
  assert.equal(cp10.isEscalated, true);
  assert.equal(cp10.isExecutiveActionRequired, true);
  assert.ok(cp10.notifiedParties.includes("Governor's Office of Major Projects & Economic Development"));
  assert.ok(cp10.recommendedAction.includes("Immediate executive coordination session"));

  // Critical path with variance >= 5 AND blocked state triggers Level 5 Executive Megaproject Review
  const cpBlocked = evaluateWorkstreamEscalation(makeWs(5, true, "blocked"), 5);
  assert.equal(cpBlocked.currentLevel, 5);
  assert.equal(cpBlocked.levelLabel, "Level 5: Executive Megaproject Review");
  assert.equal(cpBlocked.isExecutiveActionRequired, true);
  assert.ok(cpBlocked.notifiedParties.includes("Governor's Office of Major Projects & Economic Development"));

  // Negative variance should result in daysDelayed = 0 and Level 0
  const negVar = evaluateWorkstreamEscalation(makeWs(-3), 5);
  assert.equal(negVar.currentLevel, 0);
  assert.equal(negVar.daysDelayed, 0);
});

// =========================================================================
// 3. COORDINATION ENGINE STRESS TESTS
// =========================================================================

test("Coordination Engine: Consolidated RFI batching invariants and approval gating", () => {
  // Test 1: Empty RFI array
  const emptyBatch = groupIntoConsolidatedBatch([]);
  assert.equal(emptyBatch.status, "staged_drafts");
  assert.equal(emptyBatch.totalQuestions, 0);
  assert.equal(emptyBatch.stagedRfis.length, 0);
  assert.equal(emptyBatch.recipientOrgCode, "SPACEX");

  // Test 2: Staged RFIs with some unapproved
  const unapprovedRfis = [
    {
      id: "RFI-1",
      code: "RFI-001",
      workstreamId: "WS-1",
      workstreamTitle: "Wetlands",
      requestingOrgId: "org-1",
      requestingOrgCode: "USACE",
      recipientOrgId: "org-spacex",
      recipientOrgCode: "SPACEX",
      title: "Soil Core Sample Depth",
      questionText: "Please provide deeper soil core analysis for Launch Pad A.",
      technicalReason: "Geotechnical stability verification",
      requiredDocumentTypes: ["geotech_report"],
      issuedDate: "2026-08-20",
      responseDeadline: "2026-09-05",
      clockImpact: "clock_paused",
      scheduleImpactDays: 14,
      status: "staged_draft",
      isConsolidatedCycle: true,
      leadReviewerApprovedAt: "2026-08-25T10:00:00Z",
    },
    {
      id: "RFI-2",
      code: "RFI-002",
      workstreamId: "WS-1",
      workstreamTitle: "Wetlands",
      requestingOrgId: "org-2",
      requestingOrgCode: "LDEQ",
      recipientOrgId: "org-spacex",
      recipientOrgCode: "SPACEX",
      title: "Water Discharge Volume",
      questionText: "Specify peak deluge discharge volume per static fire.",
      technicalReason: "LPDES compliance",
      requiredDocumentTypes: ["deluge_calc"],
      issuedDate: "2026-08-22",
      responseDeadline: "2026-09-05",
      clockImpact: "clock_paused",
      scheduleImpactDays: 14,
      status: "staged_draft",
      isConsolidatedCycle: true,
      leadReviewerApprovedAt: undefined, // NOT approved
    },
  ];

  const batchDraft = groupIntoConsolidatedBatch(unapprovedRfis, "BATCH-TEST-001");
  assert.equal(batchDraft.batchId, "BATCH-TEST-001");
  assert.equal(batchDraft.totalQuestions, 2);
  assert.equal(batchDraft.status, "staged_drafts", "Batch must remain in staged_drafts if any RFI is unapproved");

  // Test 3: Staged RFIs all approved -> ready_for_dispatch
  unapprovedRfis[1].leadReviewerApprovedAt = "2026-08-26T14:00:00Z";
  const batchReady = groupIntoConsolidatedBatch(unapprovedRfis, "BATCH-TEST-002");
  assert.equal(batchReady.status, "ready_for_dispatch", "Batch must transition to ready_for_dispatch when all RFIs are approved");
  assert.equal(batchReady.totalQuestions, 2);

  // Test 4: Mixed RFIs (staged vs issued/accepted)
  const mixedRfis = [
    ...unapprovedRfis,
    {
      id: "RFI-3",
      code: "RFI-003",
      workstreamId: "WS-2",
      workstreamTitle: "Roads",
      requestingOrgId: "org-3",
      requestingOrgCode: "DOTD",
      recipientOrgId: "org-spacex",
      recipientOrgCode: "SPACEX",
      title: "Bridge Load Rating",
      questionText: "Bridge load rating verification",
      technicalReason: "Heavy Haul",
      requiredDocumentTypes: [],
      issuedDate: "2026-08-01",
      responseDeadline: "2026-08-15",
      clockImpact: "clock_running",
      scheduleImpactDays: 0,
      status: "accepted", // Already processed, NOT staged
      isConsolidatedCycle: false,
    },
  ];

  const mixedBatch = groupIntoConsolidatedBatch(mixedRfis);
  assert.equal(mixedBatch.totalQuestions, 2, "Only staged_draft or isConsolidatedCycle RFIs should be included in batch");
});

test("Coordination Engine: Statutory Clock impact evaluation invariants", () => {
  const pausedRfi = {
    id: "RFI-P",
    code: "RFI-P",
    workstreamId: "WS-1",
    workstreamTitle: "Wetlands",
    requestingOrgId: "org-1",
    requestingOrgCode: "USACE",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Paused Clock RFI",
    questionText: "Question",
    technicalReason: "Reason",
    requiredDocumentTypes: [],
    issuedDate: "2026-08-15",
    responseDeadline: "2026-08-29",
    clockImpact: "clock_paused",
    scheduleImpactDays: 14,
    status: "issued",
    isConsolidatedCycle: true,
  };

  const pausedEval = evaluateRFIClockImpact(pausedRfi);
  assert.equal(pausedEval.pausesClock, true);
  assert.ok(pausedEval.scheduleImpactExplanation.includes("Statutory review clock paused from 2026-08-15"));
  assert.ok(pausedEval.scheduleImpactExplanation.includes("Added 14 day(s)"));

  const runningRfi = {
    ...pausedRfi,
    clockImpact: "clock_running",
    scheduleImpactDays: 0,
  };

  const runningEval = evaluateRFIClockImpact(runningRfi);
  assert.equal(runningEval.pausesClock, false);
  assert.ok(runningEval.scheduleImpactExplanation.includes("Review clock remains running"));
  assert.ok(runningEval.scheduleImpactExplanation.includes("2026-08-29"));
});

test("Coordination Engine: Agency view routing with case-insensitivity and bottleneck filters", () => {
  const requests = [
    {
      id: "CR-1",
      code: "CR-00001",
      workstreamId: "WS-1",
      workstreamTitle: "Pad A",
      requestingOrgId: "org-dotd",
      requestingOrgCode: "DOTD",
      targetOrgId: "org-cpra",
      targetOrgCode: "CPRA",
      requestingUserName: "Pierre",
      title: "Coastal Concurrence",
      needDescription: "Check coastal consistency",
      requestedDate: "2026-08-10",
      dueDate: "2026-08-24",
      attachedDocumentVersionIds: [],
      blocksWorkstreamTitle: "Pad A Heavy Haul",
      priority: "critical_path",
      status: "in_review",
    },
    {
      id: "CR-2",
      code: "CR-00002",
      workstreamId: "WS-1",
      workstreamTitle: "Pad A",
      requestingOrgId: "org-ldeq",
      requestingOrgCode: "LDEQ",
      targetOrgId: "org-cpra",
      targetOrgCode: "cpra", // lowercase
      requestingUserName: "Mark",
      title: "Stormwater Concurrence",
      needDescription: "Water runoff",
      requestedDate: "2026-08-12",
      dueDate: "2026-08-26",
      attachedDocumentVersionIds: [],
      blocksWorkstreamTitle: "Pad A Drainage",
      priority: "normal",
      status: "pending",
    },
    {
      id: "CR-3",
      code: "CR-00003",
      workstreamId: "WS-2",
      workstreamTitle: "Substation",
      requestingOrgId: "org-cpra",
      requestingOrgCode: "cpra", // lowercase
      targetOrgId: "org-ldeq",
      targetOrgCode: "LDEQ",
      requestingUserName: "Sarah",
      title: "Wetlands Buffer Confirmation",
      needDescription: "Buffer",
      requestedDate: "2026-08-01",
      dueDate: "2026-08-15",
      attachedDocumentVersionIds: [],
      blocksWorkstreamTitle: "Substation",
      priority: "critical_path",
      status: "closed", // Closed request
    },
  ];

  // Check CPRA view (mixed case query)
  const cpraViews = getAgencyCoordinationViews("CpRa", requests);
  // Incoming: CR-1 (in_review) and CR-2 (pending) - CR-3 is closed and target is LDEQ
  assert.equal(cpraViews.myAgencyIncoming.length, 2);
  assert.equal(cpraViews.requestsSentByMyAgency.length, 1); // CR-3 sent by cpra
  // Bottlenecks: priority === "critical_path" and (pending or in_review) -> CR-1 (CR-3 is closed so not bottleneck)
  assert.equal(cpraViews.activeBottlenecks.length, 1);
  assert.equal(cpraViews.activeBottlenecks[0].id, "CR-1");
});
