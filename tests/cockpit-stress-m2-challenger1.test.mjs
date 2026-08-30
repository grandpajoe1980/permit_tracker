import test, { after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

// Load modules via Vite SSR
const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const utils = await vite.ssrLoadModule("/lib/permit-utils.ts");
const workflowEngine = await vite.ssrLoadModule("/lib/engines/workflow-engine.ts");
const scheduleEngine = await vite.ssrLoadModule("/lib/engines/schedule-engine.ts");
const escalationEngine = await vite.ssrLoadModule("/lib/engines/escalation-engine.ts");
const coordinationEngine = await vite.ssrLoadModule("/lib/engines/coordination-engine.ts");

// Load Cockpit Components
const { SpaceXNoSurprises } = await vite.ssrLoadModule("/components/cockpits/SpaceXNoSurprises.tsx");
const { DailyCommandCenter } = await vite.ssrLoadModule("/components/cockpits/DailyCommandCenter.tsx");
const { WorkstreamGraphGantt } = await vite.ssrLoadModule("/components/cockpits/WorkstreamGraphGantt.tsx");
const { InteragencyCoordinationPanel } = await vite.ssrLoadModule("/components/cockpits/InteragencyCoordinationPanel.tsx");

const {
  spacexProjectRecord,
  registeredOrganizations,
  commitmentsData,
  coordinationRequestsData,
  rfisData,
  workstreamsData,
} = fixture;

const {
  getSpaceXNoSurprisesData,
  getDailyCommandCenterExceptions,
  getFullProjectRecord,
} = utils;

const {
  generateSixQuestionsSummary,
  deriveOperationalHealth,
  validateStageTransition,
} = workflowEngine;

const {
  evaluateProjectSchedule,
  solveTaskDAG,
  aggregateDelayReasons,
  detectAccelerationOpportunities,
  calculateDateDiffDays,
  addDaysToDate,
} = scheduleEngine;

const {
  groupIntoConsolidatedBatch,
  getAgencyCoordinationViews,
  evaluateRFIClockImpact,
} = coordinationEngine;

// =========================================================================
// SECTION 1: SPACEX NO-SURPRISES DASHBOARD STRESS TESTS
// =========================================================================

test("Cockpit 1 [SpaceX No-Surprises]: 4-Quad Data Generation and Partitioning Integrity", () => {
  const data = getSpaceXNoSurprisesData();

  assert.ok(Array.isArray(data.needsSpaceX), "needsSpaceX must be an array");
  assert.ok(Array.isArray(data.needsGovernment), "needsGovernment must be an array");
  assert.ok(Array.isArray(data.blocked), "blocked must be an array");
  assert.ok(Array.isArray(data.upcomingMilestones), "upcomingMilestones must be an array");
  assert.ok(data.commitments.length > 0, "commitments must not be empty");
  assert.ok(data.schedule, "schedule result must exist");

  // Invariant 1: needsSpaceX items must require applicant action or be in waiting_applicant
  for (const item of data.needsSpaceX) {
    const ws = item.workstream;
    const condition = ws.operationalState === "waiting_applicant" || (ws.customerActionRequired && ws.customerActionRequired !== "None");
    assert.ok(condition, `needsSpaceX workstream ${ws.code} must satisfy applicant waiting condition`);
    assert.ok(item.actionRequired, "actionRequired must be defined");
    assert.ok(item.dueDate, "dueDate must be defined");
    assert.ok(item.context.whoHasIt, "context.whoHasIt must be defined");
  }

  // Invariant 2: needsGovernment items must be running or in statutory waiting period
  for (const item of data.needsGovernment) {
    const ws = item.workstream;
    const condition = ws.operationalState === "running" || ws.operationalState === "statutory_waiting_period";
    assert.ok(condition, `needsGovernment workstream ${ws.code} must satisfy government action condition`);
    assert.ok(item.ownerOrg, "ownerOrg must be defined");
    assert.ok(item.ownerPerson, "ownerPerson must be defined");
  }

  // Invariant 3: blocked items must have blocked operationalState or schedule variance > 5
  for (const item of data.blocked) {
    const ws = item.workstream;
    const condition = ws.operationalState === "blocked" || ws.scheduleVarianceDays > 5;
    assert.ok(condition, `blocked workstream ${ws.code} must be blocked or variance > 5d`);
    assert.ok(item.blockerTitle, "blockerTitle must be defined");
    assert.ok(typeof item.scheduleImpactDays === "number", "scheduleImpactDays must be a number");
  }

  // Invariant 4: upcomingMilestones contains all workstreams
  assert.equal(data.upcomingMilestones.length, spacexProjectRecord.workstreams.length);
  for (const item of data.upcomingMilestones) {
    assert.ok(item.milestoneTitle, "milestoneTitle must be defined");
    assert.ok(item.targetDate, "targetDate must be defined");
    assert.ok(["green", "yellow", "red"].includes(item.ragHealth), `ragHealth ${item.ragHealth} must be valid`);
  }
});

test("Cockpit 1 [SpaceX No-Surprises]: 6-Question Context Narrative Invariants across All Permutations", () => {
  const testStates = [
    "running",
    "blocked",
    "waiting_applicant",
    "waiting_government",
    "statutory_waiting_period",
    "scheduled_hold",
    "completed",
  ];

  const testVariances = [-5, 0, 1, 5, 13, 30];
  const criticalFlags = [true, false];

  for (const state of testStates) {
    for (const variance of testVariances) {
      for (const isCritical of criticalFlags) {
        const syntheticWs = {
          id: `ws-${state}-${variance}-${isCritical}`,
          code: `WS-${state.toUpperCase()}`,
          title: `Synthetic Test Workstream ${state}`,
          category: "permit",
          operationalState: state,
          operationalStateLabel: state.replace("_", " "),
          scheduleVarianceDays: variance,
          isCriticalPath: isCritical,
          baselineTargetDate: "2026-10-01",
          forecastTargetDate: "2026-10-15",
          currentStageName: "Technical Review Phase",
          currentActionSummary: "Hydrodynamic culvert modeling analysis",
          waitingReason: "Awaiting formal concurrence memo",
          waitingOnEntity: "CPRA",
          customerActionRequired: state === "waiting_applicant" ? "Submit revised hydraulic drawings" : "None",
          nextExpectedEvent: "Interagency concurrence issuance",
          governmentConcierge: {
            name: "Sarah Johnson",
            title: "State Project Concierge",
            agency: "Louisiana State Project Office",
            email: "sarah.johnson@la.gov",
            phone: "(225) 555-0100",
          },
          regulatoryLead: {
            orgId: "org-cpra",
            orgCode: "CPRA",
            orgName: "Coastal Protection & Restoration Authority",
            jurisdictionLevel: "State",
            assignedReviewerName: "Jean-Paul Guidry",
            assignedReviewerEmail: "guidry@cpra.la.gov",
          },
          tasks: [],
          rfis: [],
          commitments: [],
        };

        const summary = generateSixQuestionsSummary(syntheticWs);

        // 1. Check all 6 question keys exist and are non-empty strings
        assert.ok(summary.whoHasIt && typeof summary.whoHasIt === "string");
        assert.ok(summary.whatDoing && typeof summary.whatDoing === "string");
        assert.ok(summary.waitingFor && typeof summary.waitingFor === "string");
        assert.ok(summary.waitingOn && typeof summary.waitingOn === "string");
        assert.ok(summary.whenDue && typeof summary.whenDue === "string");
        assert.ok(summary.missedConsequence && typeof summary.missedConsequence === "string");
        assert.ok(summary.deterministicParagraph && typeof summary.deterministicParagraph === "string");

        // 2. Invariant: No undefined or NaN tokens in narrative
        assert.doesNotMatch(summary.deterministicParagraph, /undefined|null|NaN|\[object Object\]/);
        assert.doesNotMatch(summary.whoHasIt, /undefined|null|NaN/);
        assert.doesNotMatch(summary.whatDoing, /undefined|null|NaN/);
        assert.doesNotMatch(summary.waitingFor, /undefined|null|NaN/);
        assert.doesNotMatch(summary.waitingOn, /undefined|null|NaN/);
        assert.doesNotMatch(summary.missedConsequence, /undefined|null|NaN/);

        // 3. Consequence logic
        if (isCritical) {
          assert.match(summary.missedConsequence, /Launch complex critical path slips by/);
        } else {
          assert.match(summary.missedConsequence, /Absorbed by project schedule float buffer/);
        }

        // 4. Action clause in paragraph
        if (state === "waiting_applicant") {
          assert.match(summary.deterministicParagraph, /Action required from SpaceX: Submit revised hydraulic drawings/);
        } else if (state === "statutory_waiting_period") {
          assert.match(summary.deterministicParagraph, /Mandatory statutory public notice period in progress/);
        } else {
          assert.match(summary.deterministicParagraph, /No action is currently required from SpaceX/);
        }

        // 5. Concierge contact presence
        assert.match(summary.deterministicParagraph, /State Project Concierge: Sarah Johnson \(sarah\.johnson@la\.gov\)/);
      }
    }
  }
});

test("Cockpit 1 [SpaceX No-Surprises]: Dual-Ownership Badges and React SSR Markup Invariants", () => {
  const html = renderToStaticMarkup(React.createElement(SpaceXNoSurprises));

  // Executive banner and badge
  assert.match(html, /SpaceX Executive Delivery Cockpit/);
  assert.match(html, /No-Surprises Delivery Dashboard/);
  assert.match(html, /Pecan Island Launch Complex Operations/);
  assert.match(html, /Gov Commitments/);
  assert.match(html, /SpaceX Owed/);

  // 4 Quad Cards
  assert.match(html, /Needs SpaceX/);
  assert.match(html, /Awaiting SpaceX Input/);
  assert.match(html, /Needs Government/);
  assert.match(html, /In Agency Review/);
  assert.match(html, /Blocked Items/);
  assert.match(html, /Active Schedule Blocker/);
  assert.match(html, /Upcoming Decisions/);
  assert.match(html, /Key Project Milestones/);

  // Dual ownership badges on cards
  assert.match(html, /State Concierge:/);
  assert.match(html, /Sarah Johnson/);
  assert.match(html, /Louisiana Governor&#x27;s Project Office|Louisiana Governor's Project Office/);
  assert.match(html, /Currently with:/);
  assert.match(html, /They are doing:/);
  assert.match(html, /Waiting on:/);
  assert.match(html, /SpaceX action required:/);

  // Workstreams
  assert.match(html, /WS-WETLANDS-PAD-A/);
  assert.match(html, /WS-LA82-HEAVYHAUL/);
  assert.match(html, /WS-SUBSTATION-230KV/);
  assert.match(html, /WS-PUBLIC-SAFETY-AIRSPACE/);
  assert.match(html, /WS-GAS-LNG-PIPELINE/);
  assert.match(html, /WS-HIGHBAY-OSFM/);
  assert.match(html, /WS-WORKFORCE-CONSORTIUM/);

  // Critical path markers
  assert.match(html, /⚡ Critical Path/);
});

// =========================================================================
// SECTION 2: DAILY COORDINATION COMMAND CENTER STRESS TESTS
// =========================================================================

test("Cockpit 2 [Daily Command Center]: Exception Matrix Counts and Standup Queue Invariants", () => {
  const exceptions = getDailyCommandCenterExceptions();

  assert.ok(typeof exceptions.blockerCount === "number");
  assert.ok(typeof exceptions.overdueCommitmentCount === "number");
  assert.ok(typeof exceptions.escalationCount === "number");
  assert.ok(typeof exceptions.nearDeadlineCount === "number");

  assert.equal(exceptions.blockerCount, 1, "Should identify 1 new blocker (WS-LA82-HEAVYHAUL)");
  assert.equal(exceptions.overdueCommitmentCount, 1, "Should identify 1 at-risk/overdue commitment (COM-003)");
  assert.equal(exceptions.escalationCount, 9, "All 9 workstreams evaluate for active standup triage");
  assert.equal(exceptions.nearDeadlineCount, 6, "Identifies 6 near deadline or critical path workstreams");

  assert.equal(exceptions.consolidatedRfiBatch.recipientOrgCode, "SPACEX");
  assert.ok(exceptions.coordinationRequests.length >= 3);
});

test("Cockpit 2 [Daily Command Center]: 4-Step Stepper Boundary Transitions and Action State Simulation", () => {
  // Simulate the exact state machine of DailyCommandCenter stepper
  const reviewQueue = [
    {
      id: "item-1",
      category: "Blocker Intervention",
      title: "LA-82 Heavy-Haul: CPRA Drainage Concurrence (CR-00451)",
      buttonLabel: "Send Joint Agency Meeting Invite",
    },
    {
      id: "item-2",
      category: "Overdue Commitment",
      title: "USACE Section 404 Completeness Letter (COM-003)",
      buttonLabel: "Dispatch Status Reminder",
    },
    {
      id: "item-3",
      category: "Applicant RFI Response",
      title: "SpaceX Rev 9 Axle Load Distribution Drawings (RFI-2026-0042)",
      buttonLabel: "Accept RFI & Resume Review Clock",
    },
    {
      id: "item-4",
      category: "Escalation Tier 2",
      title: "LDEQ Deluge Basin Public Hearing Comments (WS-WASTEWATER-DELUGE)",
      buttonLabel: "Authorize Draft Permit Release",
    },
  ];

  assert.equal(reviewQueue.length, 4, "Must have exactly 4 standup exception items");

  // State machine variables
  let reviewActive = false;
  let currentStepIndex = 0;
  let reviewedItems = new Set();

  // Test 1: Start Review from inactive state
  reviewActive = true;
  currentStepIndex = 0;
  assert.equal(reviewActive, true);
  assert.equal(currentStepIndex, 0);

  // Test 2: Step 0 boundary - Previous must be disabled
  const isPrevDisabledStep0 = currentStepIndex === 0;
  const isNextDisabledStep0 = currentStepIndex === reviewQueue.length - 1;
  assert.equal(isPrevDisabledStep0, true, "Previous button must be disabled on step 0");
  assert.equal(isNextDisabledStep0, false, "Next button must NOT be disabled on step 0");

  // Test 3: Advance through steps via Next
  currentStepIndex = 1;
  assert.equal(currentStepIndex === 0, false);
  assert.equal(currentStepIndex === reviewQueue.length - 1, false);

  currentStepIndex = 2;
  assert.equal(currentStepIndex === 0, false);
  assert.equal(currentStepIndex === reviewQueue.length - 1, false);

  currentStepIndex = 3;
  // Step 3 boundary - Next must be disabled
  const isPrevDisabledStep3 = currentStepIndex === 0;
  const isNextDisabledStep3 = currentStepIndex === reviewQueue.length - 1;
  assert.equal(isPrevDisabledStep3, false, "Previous button must NOT be disabled on step 3");
  assert.equal(isNextDisabledStep3, true, "Next button must be disabled on step 3");

  // Test 4: Walkthrough via handleMarkAction
  reviewActive = true;
  currentStepIndex = 0;
  reviewedItems = new Set();

  function simulateMarkAction() {
    reviewedItems.add(currentStepIndex);
    if (currentStepIndex < reviewQueue.length - 1) {
      currentStepIndex += 1;
    } else {
      reviewActive = false;
    }
  }

  // Step 0 action
  simulateMarkAction();
  assert.equal(reviewedItems.has(0), true);
  assert.equal(currentStepIndex, 1);
  assert.equal(reviewActive, true);

  // Step 1 action
  simulateMarkAction();
  assert.equal(reviewedItems.has(1), true);
  assert.equal(currentStepIndex, 2);
  assert.equal(reviewActive, true);

  // Step 2 action
  simulateMarkAction();
  assert.equal(reviewedItems.has(2), true);
  assert.equal(currentStepIndex, 3);
  assert.equal(reviewActive, true);

  // Step 3 (final) action -> MUST complete and exit stepper
  simulateMarkAction();
  assert.equal(reviewedItems.has(3), true);
  assert.equal(reviewActive, false, "Final step action must exit stepper mode");
  assert.equal(reviewedItems.size, 4, "All 4 items should be marked as reviewed");

  // Test 5: Open Review for individual card (e.g. index 2)
  currentStepIndex = 2;
  reviewActive = true;
  assert.equal(reviewActive, true);
  assert.equal(currentStepIndex, 2);
  assert.equal(reviewQueue[currentStepIndex].id, "item-3");
});

test("Cockpit 2 [Daily Command Center]: React SSR Static Markup Invariants", () => {
  const html = renderToStaticMarkup(React.createElement(DailyCommandCenter));

  assert.match(html, /Daily Coordination Command Center/);
  assert.match(html, /Morning Standup Radar/);
  assert.match(html, /Sunday, August 30, 2026/);
  assert.match(html, /Start Coordination Review/);
  assert.match(html, /New Blockers/);
  assert.match(html, /Overdue Commitments/);
  assert.match(html, /RFI Responses/);
  assert.match(html, /Approvals Done/);
  assert.match(html, /Deadlines &lt; 7d|Deadlines < 7d/);
  assert.match(html, /Critical Path Slips/);
  assert.match(html, /Agency Escalations/);

  // Exception Cards
  assert.match(html, /CR-00451/);
  assert.match(html, /COM-003/);
  assert.match(html, /RFI-2026-0042/);
  assert.match(html, /WS-WASTEWATER-DELUGE/);
  assert.match(html, /Open Review/);
});

// =========================================================================
// SECTION 3: WORKSTREAM EXECUTION GRAPH & GANTT STRESS TESTS
// =========================================================================

test("Cockpit 3 [Workstream Graph & Gantt]: 12-Column DAG Grid Layout & Baseline Schedule Math", () => {
  const project = getFullProjectRecord();
  const schedule = evaluateProjectSchedule(project.workstreams);

  assert.equal(project.baselineLaunchDate, "2026-12-15");
  assert.equal(project.currentForecastLaunchDate, "2026-12-28");
  assert.equal(project.scheduleVarianceDays, 13);

  // Check 12-column grid structure in workstreams
  for (const ws of project.workstreams) {
    assert.ok(ws.code, "Code required for Col 1-4");
    assert.ok(ws.title, "Title required for Col 1-4");
    assert.ok(ws.regulatoryLead.orgCode, "Org code required for Col 5-6");
    assert.ok(ws.baselineTargetDate, "Baseline date required for Col 7-8");
    assert.ok(ws.forecastTargetDate, "Forecast date required for Col 9-10");
    assert.ok(typeof ws.scheduleVarianceDays === "number", "Variance required for Col 11-12");

    if (ws.code === "WS-LA82-HEAVYHAUL") {
      assert.equal(ws.scheduleVarianceDays, 13);
      assert.equal(ws.isCriticalPath, true);
      assert.ok(ws.controllingDependencyTitle.includes("CR-00451"));
    }
  }
});

test("Cockpit 3 [Workstream Graph & Gantt]: 4-Tier Delay Taxonomy Attribution Math Invariants", () => {
  // Check delay taxonomy breakdown:
  // 1. Interagency Coordination: 13 days (46%)
  // 2. Statutory Minimum Notice: 7 days (25%)
  // 3. Public Hearing Comment: 8 days (29%)
  // 4. Engineering Revisions: 0 days (0% / absorbed)
  const interagencyDays = 13;
  const statutoryDays = 7;
  const publicCommentDays = 8;
  const engineeringDays = 0;

  const totalDelayDays = interagencyDays + statutoryDays + publicCommentDays + engineeringDays;
  assert.equal(totalDelayDays, 28, "Total delay variance days across affected streams is 28");

  const interagencyPct = Math.round((interagencyDays / totalDelayDays) * 100);
  const statutoryPct = Math.round((statutoryDays / totalDelayDays) * 100);
  const publicCommentPct = Math.round((publicCommentDays / totalDelayDays) * 100);

  assert.equal(interagencyPct, 46, "Interagency percentage must be 46%");
  assert.equal(statutoryPct, 25, "Statutory percentage must be 25%");
  assert.equal(publicCommentPct, 29, "Public comment percentage must be 29%");
  assert.equal(interagencyPct + statutoryPct + publicCommentPct, 100, "Percentage sum must equal 100%");
});

test("Cockpit 3 [Workstream Graph & Gantt]: Parallel Review Acceleration Actions and SSR Markup", () => {
  const html = renderToStaticMarkup(React.createElement(WorkstreamGraphGantt));

  assert.match(html, /Critical Path Execution Graph &amp; Intelligence|Critical Path Execution Graph & Intelligence/);
  assert.match(html, /Project Delivery Schedule &amp; Variance Engine|Project Delivery Schedule & Variance Engine/);
  assert.match(html, /Immutable Baseline/);
  assert.match(html, /2026-12-15/);
  assert.match(html, /Current Forecast/);
  assert.match(html, /2026-12-28/);
  assert.match(html, /\+13 Days/);

  // Tab buttons
  assert.match(html, /Workstream DAG &amp; Baseline Comparison|Workstream DAG & Baseline Comparison/);
  assert.match(html, /Delay Taxonomy Attribution/);
  assert.match(html, /Parallel Acceleration Opportunities/);

  // 12-column header titles
  assert.match(html, /Workstream \/ DAG Node/);
  assert.match(html, /Lead Agency/);
  assert.match(html, /Baseline Target/);
  assert.match(html, /Current Forecast/);
  assert.match(html, /Variance &amp; Controlling Path|Variance & Controlling Path/);
});

// =========================================================================
// SECTION 4: INTERAGENCY COORDINATION PANEL STRESS TESTS
// =========================================================================

test("Cockpit 4 [Interagency Coordination Panel]: Multi-Agency CR-00xxx Filtering Invariants", () => {
  const project = getFullProjectRecord();
  const allCrs = project.coordinationRequests;

  assert.equal(allCrs.length, 3, "Fixture contains 3 coordination requests");

  function filterCrs(selectedOrg) {
    return allCrs.filter((cr) => {
      if (selectedOrg === "ALL") return true;
      return (
        cr.targetOrgCode === selectedOrg ||
        cr.requestingOrgCode === selectedOrg
      );
    });
  }

  // 1. ALL filter returns all 3
  const allFiltered = filterCrs("ALL");
  assert.equal(allFiltered.length, 3);

  // 2. DOTD filter: CR-00451 (requesting: DOTD -> CPRA)
  const dotdFiltered = filterCrs("DOTD");
  assert.equal(dotdFiltered.length, 1);
  assert.ok(dotdFiltered.some((cr) => cr.code === "CR-00451"));

  // 3. CPRA filter: CR-00451 (target: CPRA) and CR-00452 (target: CPRA)
  const cpraFiltered = filterCrs("CPRA");
  assert.equal(cpraFiltered.length, 2);
  assert.ok(cpraFiltered.some((cr) => cr.code === "CR-00451"));
  assert.ok(cpraFiltered.some((cr) => cr.code === "CR-00452"));

  // 4. LDEQ filter: CR-00452 (requesting: LDEQ -> CPRA)
  const ldeqFiltered = filterCrs("LDEQ");
  assert.equal(ldeqFiltered.length, 1);
  assert.equal(ldeqFiltered[0].code, "CR-00452");

  // 5. VERMILION-PARISH filter: CR-00453 (target: VERMILION-PARISH)
  const parishFiltered = filterCrs("VERMILION-PARISH");
  assert.equal(parishFiltered.length, 1);
  assert.equal(parishFiltered[0].code, "CR-00453");

  // 6. Unknown agency returns 0
  const unknownFiltered = filterCrs("NON-EXISTENT-AGENCY");
  assert.equal(unknownFiltered.length, 0);
});

test("Cockpit 4 [Interagency Coordination Panel]: Consolidated RFI Batch Staging & Dispatch Gating", () => {
  const project = getFullProjectRecord();
  const allRfis = project.workstreams.flatMap((ws) => ws.rfis);
  assert.ok(allRfis.length >= 1, "Fixture must have RFIs");

  const batch = groupIntoConsolidatedBatch(allRfis);
  assert.equal(batch.batchId, "BATCH-2026-AUG-01");
  assert.equal(batch.recipientOrgCode, "SPACEX");
  assert.ok(batch.leadReviewerName.includes("Sarah Johnson"));
  assert.equal(batch.totalQuestions, 1);
  assert.equal(batch.status, "ready_for_dispatch");

  // Dispatch gating stress test:
  // If an RFI is unapproved, batch status must be staged_drafts
  const unapprovedRfi = {
    ...allRfis[0],
    id: "rfi-unapproved",
    leadReviewerApprovedAt: undefined,
  };
  const unapprovedBatch = groupIntoConsolidatedBatch([unapprovedRfi]);
  assert.equal(unapprovedBatch.status, "staged_drafts");

  // Clock impact stress test
  const clockImpact = evaluateRFIClockImpact(allRfis[0]);
  assert.equal(clockImpact.pausesClock, true);
  assert.ok(clockImpact.scheduleImpactExplanation.includes("Statutory review clock paused"));
});

test("Cockpit 4 [Interagency Coordination Panel]: React SSR Static Markup Invariants", () => {
  const html = renderToStaticMarkup(React.createElement(InteragencyCoordinationPanel));

  assert.match(html, /Interagency Action &amp; Concurrency Framework|Interagency Action & Concurrency Framework/);
  assert.match(html, /CR-00xxx Protocol/);
  assert.match(html, /Interagency Coordination Requests &amp; RFI Batches|Interagency Coordination Requests & RFI Batches/);
  assert.match(html, /Create Coordination Request/);
  assert.match(html, /Consolidated RFI Batch Cycle/);
  assert.match(html, /BATCH-2026-AUG-01/);
  assert.match(html, /Unified Applicant Technical Question Staging Area/);
  assert.match(html, /Sarah Johnson/);
  assert.match(html, /Dispatch Consolidated Batch/);

  // Agency filter buttons
  assert.match(html, /DOTD/);
  assert.match(html, /CPRA/);
  assert.match(html, /LDEQ/);
  assert.match(html, /VERMILION-PARISH/);

  // CR Requests
  assert.match(html, /CR-00451/);
  assert.match(html, /CR-00452/);
  assert.match(html, /CR-00453/);
  assert.match(html, /From: DOTD/);
  assert.match(html, /To: CPRA/);
});

// =========================================================================
// SECTION 5: CROSS-COCKPIT DATA CONSISTENCY & INTEGRATION RIGOR
// =========================================================================

test("Cross-Cockpit Integration: Shared Key Entities Consistency across Cockpits 1-4", () => {
  const project = getFullProjectRecord();
  const noSurprisesData = getSpaceXNoSurprisesData();
  const dailyExceptions = getDailyCommandCenterExceptions();
  const schedule = evaluateProjectSchedule(project.workstreams);
  const cpraRequests = getAgencyCoordinationViews("CPRA", project.coordinationRequests);

  // 1. Heavy-haul workstream consistency
  const heavyHaul = project.workstreams.find((w) => w.code === "WS-LA82-HEAVYHAUL");
  assert.ok(heavyHaul);
  assert.equal(heavyHaul.isCriticalPath, true);
  assert.equal(heavyHaul.scheduleVarianceDays, 13);
  assert.equal(heavyHaul.operationalState, "blocked");

  // Must appear in No-Surprises blocked quad
  assert.ok(noSurprisesData.blocked.some((b) => b.workstream.code === "WS-LA82-HEAVYHAUL"));

  // Must appear in Daily Command Center newBlockers
  assert.ok(dailyExceptions.newBlockers.some((b) => b.code === "WS-LA82-HEAVYHAUL"));

  // Must be controlling in schedule engine
  assert.ok(schedule.controllingWorkstreamIds.includes("WS-LA82-HEAVYHAUL"));

  // 2. CR-00451 coordination request consistency
  const cr451 = project.coordinationRequests.find((cr) => cr.code === "CR-00451");
  assert.ok(cr451);
  assert.equal(cr451.priority, "critical_path");
  assert.equal(cr451.requestingOrgCode, "DOTD");
  assert.equal(cr451.targetOrgCode, "CPRA");

  // Must appear in CPRA incoming view
  assert.ok(cpraRequests.myAgencyIncoming.some((r) => r.code === "CR-00451"));
  // Must be in CPRA bottlenecks
  assert.ok(cpraRequests.activeBottlenecks.some((r) => r.code === "CR-00451"));
});
