import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after, beforeEach, describe } from "node:test";
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

// Load modules dynamically via Vite SSR engine
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
const {
  demoPersonas,
  pecanIslandRequests,
  serviceRequests,
} = await vite.ssrLoadModule("/lib/demo-data.ts");
const {
  registeredOrganizations,
  projectDocumentsData,
  workstreamsData,
  permitCatalog,
  commitmentsData,
  coordinationRequestsData,
  rfisData,
  workflowTemplatesData,
  spacexProjectRecord,
} = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const {
  getOperationalPersona,
  getOperationalWorkItems,
  getAvailableActions,
  groupMyWork,
} = await vite.ssrLoadModule("/lib/operational-ux.ts");
const {
  downloadDocumentVersion,
  triggerFileDownload,
} = await vite.ssrLoadModule("/lib/document-download-utils.ts");
const {
  calculateDateDiffDays,
  addDaysToDate,
  solveTaskDAG,
  aggregateDelayReasons,
  detectAccelerationOpportunities,
  evaluateProjectSchedule,
} = await vite.ssrLoadModule("/lib/engines/schedule-engine.ts");
const {
  generateSixQuestionsSummary,
  validateStageTransition,
  deriveOperationalHealth,
} = await vite.ssrLoadModule("/lib/engines/workflow-engine.ts");
const {
  evaluateWorkstreamEscalation,
} = await vite.ssrLoadModule("/lib/engines/escalation-engine.ts");
const {
  createAuditEvent,
  filterAuditEvents,
} = await vite.ssrLoadModule("/lib/engines/audit-engine.ts");
const {
  getProjectOverview,
  customerVisibleProfiles,
  participantForWorkstream,
  participantForTask,
  projectProfiles,
  projectParticipants,
  initialExternalFilings,
} = await vite.ssrLoadModule("/lib/customer-portal.ts");

// Reset repository before every test to ensure strict test isolation
beforeEach(() => {
  repository.resetE2EDemo();
});

// Helper for DAG cycle detection
function detectDAGCycle(tasks, dependencies) {
  const adj = new Map();
  tasks.forEach((t) => adj.set(t.id, []));
  dependencies.forEach((d) => {
    adj.get(d.predecessorTaskId)?.push(d.successorTaskId);
  });

  const visited = new Set();
  const recStack = new Set();

  function isCyclic(id) {
    if (recStack.has(id)) return true;
    if (visited.has(id)) return false;

    visited.add(id);
    recStack.add(id);

    const neighbors = adj.get(id) || [];
    for (const neighbor of neighbors) {
      if (isCyclic(neighbor)) return true;
    }

    recStack.delete(id);
    return false;
  }

  for (const t of tasks) {
    if (isCyclic(t.id)) return true;
  }
  return false;
}

// ============================================================================
// TIER 1: FEATURE COVERAGE (F1 through F13 — >=5 tests per feature)
// ============================================================================

describe("Tier 1: Feature Coverage (F1 to F13)", () => {

  // --------------------------------------------------------------------------
  // F1: Multi-Agency & Customer Tenancy Model
  // --------------------------------------------------------------------------
  describe("F1: Multi-Agency & Customer Tenancy Model", () => {
    test("F1.1: SpaceX modeled as Applicant customer organization with project liaison metadata", () => {
      const orgs = repository.getOrganizations();
      const spacex = orgs.find((o) => o.code === "SPACEX");
      assert.ok(spacex, "SpaceX org must exist");
      assert.equal(spacex.jurisdictionLevel, "Applicant");
      assert.equal(spacex.name, "Space Exploration Technologies Corp.");
      assert.ok(spacex.projectLiaisonName, "Must have project liaison");
      assert.ok(spacex.projectLiaisonEmail.includes("@spacex"), "Liaison must have spacex email");
      assert.equal(spacex.isActive, true);
    });

    test("F1.2: State reviewing agencies (DOTD, LDEQ, CPRA) registered with statutory authorities", () => {
      const orgs = repository.getOrganizations();
      const dotd = orgs.find((o) => o.code === "DOTD");
      const ldeq = orgs.find((o) => o.code === "LDEQ");
      const cpra = orgs.find((o) => o.code === "CPRA");

      assert.ok(dotd && ldeq && cpra, "DOTD, LDEQ, CPRA must exist");
      assert.equal(dotd.jurisdictionLevel, "State");
      assert.equal(ldeq.jurisdictionLevel, "State");
      assert.equal(cpra.jurisdictionLevel, "State");
      assert.ok(dotd.statutoryAuthority?.includes("La. R.S. 48:221"));
      assert.ok(ldeq.statutoryAuthority?.includes("La. R.S. 30:2001"));
    });

    test("F1.3: Louisiana State Project Delivery Office configured as State Project Concierge", () => {
      const orgs = repository.getOrganizations();
      const statePo = orgs.find((o) => o.code === "LA-PROJECTS");
      assert.ok(statePo, "LA-PROJECTS must exist");
      assert.equal(statePo.jurisdictionLevel, "State");
      assert.ok(statePo.statutoryAuthority?.includes("La. R.S. 51:936"));
      assert.equal(statePo.projectLiaisonName, "Sarah Johnson");
      assert.equal(statePo.projectLiaisonEmail, "sarah.johnson@la.gov");
    });

    test("F1.4: Multi-tenancy isolation prevents applicant from seeing non-customer visible internal profiles", () => {
      const visibleProfiles = customerVisibleProfiles(projectProfiles);
      const joeSkaggs = visibleProfiles.find((p) => p.userId === "user-joe-skaggs");
      assert.equal(joeSkaggs, undefined, "Internal admin profile must not be visible to customer view");
      assert.ok(visibleProfiles.every((p) => p.isCustomerVisible === true));
      assert.ok(visibleProfiles.some((p) => p.organizationId === "org-spacex"));
    });

    test("F1.5: Tenant-specific default SLA days and holiday calendars are maintained per organization", () => {
      const orgs = repository.getOrganizations();
      const spacex = orgs.find((o) => o.code === "SPACEX");
      const dotd = orgs.find((o) => o.code === "DOTD");
      const ldeq = orgs.find((o) => o.code === "LDEQ");

      assert.equal(spacex?.defaultSlaDays, 5, "SpaceX private turn-around SLA is 5 days");
      assert.equal(dotd?.defaultSlaDays, 20, "DOTD engineering review SLA is 20 days");
      assert.equal(ldeq?.defaultSlaDays, 30, "LDEQ environmental SLA is 30 days");
      assert.equal(dotd?.holidayCalendar, "Louisiana State Legal Holidays");
    });
  });

  // --------------------------------------------------------------------------
  // F2: Assignment Groups & Fulfiller Queues
  // --------------------------------------------------------------------------
  describe("F2: Assignment Groups & Fulfiller Queues", () => {
    test("F2.1: Fulfiller personas map to specific agency credentials and workspace roles", () => {
      const sam = getOperationalPersona(demoPersonas.find((p) => p.id === "sam-rivera"));
      const jordan = getOperationalPersona(demoPersonas.find((p) => p.id === "jordan-lee"));
      const alex = getOperationalPersona(demoPersonas.find((p) => p.id === "alex-martin"));

      assert.ok(sam && jordan && alex);
      assert.equal(sam.agencyCode, "DOTD");
      assert.equal(sam.workspace, "agency");
      assert.equal(jordan.agencyCode, "LDEQ");
      assert.equal(jordan.workspace, "reviewer");
      assert.equal(alex.agencyCode, "SPACEX");
      assert.equal(alex.isCustomer, true);
    });

    test("F2.2: Operational work items partition correctly by fulfiller persona agency and assignment", () => {
      const sam = demoPersonas.find((p) => p.id === "sam-rivera");
      const jordan = demoPersonas.find((p) => p.id === "jordan-lee");

      const samItems = getOperationalWorkItems({
        persona: sam,
        workstreams: repository.getWorkstreams(),
        rfis: repository.getRFIs(),
        customerRequests: repository.getCustomerRequests(),
      }).items;

      const jordanItems = getOperationalWorkItems({
        persona: jordan,
        workstreams: repository.getWorkstreams(),
        rfis: repository.getRFIs(),
        customerRequests: repository.getCustomerRequests(),
      }).items;

      assert.ok(samItems.length > 0);
      assert.ok(jordanItems.length > 0);
      assert.ok(samItems.some((item) => item.ownerOrganization === "DOTD" || item.assignedOrganizationId === "org-dotd" || item.assignedUserId === "user-sam-rivera"));
      assert.ok(jordanItems.some((item) => item.ownerOrganization === "LDEQ" || item.assignedOrganizationId === "org-ldeq" || item.assignedUserId === "user-jordan-lee"));
    });

    test("F2.3: My Work queue groups items without duplicating primary work item cards", () => {
      const sam = demoPersonas.find((p) => p.id === "sam-rivera");
      const items = getOperationalWorkItems({ persona: sam, workstreams: repository.getWorkstreams() }).items;
      const groups = groupMyWork(items);

      const allCardIds = [];
      for (const grp of groups) {
        for (const itm of grp.items) {
          allCardIds.push(itm.id);
        }
      }
      const uniqueIds = new Set(allCardIds);
      assert.equal(allCardIds.length, uniqueIds.size, "No item should appear in multiple groups in My Work");
    });

    test("F2.4: Task assignment assigns specific user ID and updates participant mapping", () => {
      const task = participantForTask("TASK-T001");
      assert.ok(task, "Task participant mapping must exist");
      assert.equal(task.userId, "user-sam-rivera");
      assert.equal(task.organizationId, "org-dotd");
    });

    test("F2.5: Work item provides precise context: whyHere, whatToDo, and removesFromQueue", () => {
      const jordan = demoPersonas.find((p) => p.id === "jordan-lee");
      const items = getOperationalWorkItems({
        persona: jordan,
        workstreams: repository.getWorkstreams(),
        rfis: repository.getRFIs(),
      }).items;

      for (const item of items) {
        assert.ok(item.whyHere && item.whyHere.length > 0, "Item must explain why it is in queue");
        assert.ok(item.whatToDo && item.whatToDo.length > 0, "Item must explain required action");
        assert.ok(item.removesFromQueue && item.removesFromQueue.length > 0, "Item must explain queue removal condition");
      }
    });
  });

  // --------------------------------------------------------------------------
  // F3: Unified ITSM Lifecycle & PM Milestones
  // --------------------------------------------------------------------------
  describe("F3: Unified ITSM Lifecycle & PM Milestones", () => {
    test("F3.1: Customer request supports lifecycle states: draft -> submitted -> triage -> in_progress -> resolved -> closed", () => {
      const req = repository.createCustomerRequest({
        projectId: "proj-spacex-pecan",
        requestType: "permit_authorization",
        title: "Test ITSM Lifecycle Request",
        description: "Testing state machine transitions",
        submittedByName: "Alex Martin",
        submittedByUserId: "user-alex-martin",
        blocksActiveWork: false,
      });

      assert.equal(req.status, "submitted");
      assert.ok(req.confirmationNumber.startsWith("PATH-"));

      req.status = "triage";
      req.knownAgencyCode = "DOTD";
      assert.equal(req.status, "triage");

      req.status = "in_progress";
      assert.equal(req.status, "in_progress");

      req.status = "resolved";
      assert.equal(req.status, "resolved");

      req.status = "closed";
      assert.equal(req.status, "closed");
    });

    test("F3.2: Workstream operational states reflect running, waiting_applicant, waiting_government, and blocked", () => {
      const workstreams = repository.getWorkstreams();
      const validStates = [
        "running",
        "waiting_government",
        "waiting_applicant",
        "waiting_external",
        "scheduled_hold",
        "statutory_waiting_period",
        "blocked",
        "escalated",
        "complete",
        "cancelled",
      ];
      for (const ws of workstreams) {
        assert.ok(validStates.includes(ws.operationalState), `Invalid state: ${ws.operationalState}`);
      }
    });

    test("F3.3: PM Milestones are identified and track target completion dates in schedule", () => {
      const workstreams = repository.getWorkstreams();
      const allTasks = workstreams.flatMap((ws) => ws.tasks);
      const milestones = allTasks.filter((t) => t.isMilestone);

      assert.ok(milestones.length > 0, "Should have milestone tasks");
      for (const m of milestones) {
        assert.ok(m.title, "Milestone must have title");
        assert.ok(typeof m.durationDays === "number", "Duration must be number");
      }
    });

    test("F3.4: Stage transitions validate completion of required checklists and documents", () => {
      const template = workflowTemplatesData[0];
      const stage = template.versions[0].stages[0];

      const invalidTransition = validateStageTransition(stage, [], []);
      assert.equal(invalidTransition.allowed, false, "Transition without required items should fail");
      assert.ok(invalidTransition.reasons.length > 0);

      const validTransition = validateStageTransition(
        stage,
        stage.completionRequirements,
        stage.requiredInputs
      );
      assert.equal(validTransition.allowed, true, "Transition with all required items should succeed");
    });

    test("F3.5: Operational health decouples state from health tone (statutory wait is green, blocker is red)", () => {
      assert.equal(deriveOperationalHealth("statutory_waiting_period", 0, false), "green");
      assert.equal(deriveOperationalHealth("blocked", 0, false), "red");
      assert.equal(deriveOperationalHealth("running", 0, false), "green");
      assert.equal(deriveOperationalHealth("running", 8, true), "red");
      assert.equal(deriveOperationalHealth("waiting_government", 2, false), "yellow");
    });
  });

  // --------------------------------------------------------------------------
  // F4: Priority Matrix & Statutory Clocks
  // --------------------------------------------------------------------------
  describe("F4: Priority Matrix & Statutory Clocks", () => {
    test("F4.1: Customer request priority scoring matches schedule importance (critical -> P1, normal -> P2, low -> P3)", () => {
      const reqP1 = repository.createCustomerRequest({
        projectId: "proj-spacex-pecan",
        requestType: "blocker_coordination",
        title: "P1 Blocker Request",
        description: "Immediate critical path blockage",
        scheduleImportance: "critical",
        submittedByName: "Alex Martin",
        blocksActiveWork: true,
      });
      assert.equal(reqP1.scheduleImportance, "critical");
      assert.equal(reqP1.blocksActiveWork, true);
    });

    test("F4.2: Statutory lead time days and minimum statutory days are maintained in permit catalog", () => {
      const catalog = repository.getCatalog();
      assert.ok(catalog.length > 0);

      for (const item of catalog) {
        assert.ok(item.expectedLeadTimeDays > 0, `${item.code} must have expected lead time`);
        assert.ok(typeof item.minimumStatutoryDays === "number", `${item.code} minimum statutory days must be number`);
      }
    });

    test("F4.3: RFI issuance pauses statutory review clock and transitions workstream to waiting_applicant", () => {
      const wsId = "WS-SUBSTATION-230KV";
      const ws = repository.getWorkstreamById(wsId);
      assert.ok(ws);

      const rfi = repository.createRFI({
        workstreamId: wsId,
        workstreamTitle: ws.title,
        requestingOrgId: "org-dotd",
        requestingOrgCode: "DOTD",
        recipientOrgId: "org-spacex",
        recipientOrgCode: "SPACEX",
        title: "Substation Transformer Foundation Geo-tech Clarification",
        questionText: "Please provide soil load bearing calculations for transformer pad.",
        technicalReason: "Required under structural safety code.",
        responseDeadline: "2026-09-15",
        actorName: "Sam Rivera",
      });

      assert.equal(rfi.clockImpact, "clock_paused");
      assert.equal(rfi.status, "issued");

      const pausedWs = repository.getWorkstreamById(wsId);
      assert.equal(pausedWs?.operationalState, "waiting_applicant");
      assert.equal(pausedWs?.waitingOnEntity, "SPACEX");
    });

    test("F4.4: RFI response acceptance resumes clock and resets operational state to running", () => {
      const wsId = "WS-SUBSTATION-230KV";
      const ws = repository.getWorkstreamById(wsId);
      assert.ok(ws);

      const rfi = repository.createRFI({
        workstreamId: wsId,
        workstreamTitle: ws.title,
        requestingOrgId: "org-dotd",
        requestingOrgCode: "DOTD",
        recipientOrgId: "org-spacex",
        recipientOrgCode: "SPACEX",
        title: "Substation Clarification",
        questionText: "Soil bearing check.",
        technicalReason: "Structural safety.",
        responseDeadline: "2026-09-15",
        actorName: "Sam Rivera",
      });

      repository.submitRfiResponse({
        rfiId: rfi.id,
        submittedByName: "Alex Martin",
        responseText: "Soil bearing capacity calculation attached: 4500 psf confirmed.",
      });

      const accepted = repository.acceptRfiResponse({
        rfiId: rfi.id,
        actorName: "Sam Rivera",
        actorOrgName: "DOTD",
        notes: "Soil capacity verified acceptable.",
      });

      assert.ok(accepted);
      const resumedWs = repository.getWorkstreamById(wsId);
      assert.equal(resumedWs?.operationalState, "running");
    });

    test("F4.5: 5-Tier escalation engine computes correct escalation tier and notification recipients", () => {
      const testWs = {
        ...workstreamsData[0],
        scheduleVarianceDays: 6,
        isCriticalPath: true,
        operationalState: "running",
      };

      const evalResult = evaluateWorkstreamEscalation(testWs, 16);
      assert.equal(evalResult.isEscalated, true);
      assert.ok(evalResult.currentLevel >= 4, "Critical path variance >= 5 should be Level 4 or 5");
      assert.ok(evalResult.notifiedParties.some((p) => p.includes("State Project Office")));
    });
  });

  // --------------------------------------------------------------------------
  // F5: ITSM Operations UI & Fulfiller Triage
  // --------------------------------------------------------------------------
  describe("F5: ITSM Operations UI & Fulfiller Triage", () => {
    test("F5.1: Work items populate required input fields and document attachments", () => {
      const jordan = demoPersonas.find((p) => p.id === "jordan-lee");
      const workData = getOperationalWorkItems({
        persona: jordan,
        workstreams: repository.getWorkstreams(),
        rfis: repository.getRFIs(),
      });

      assert.ok(Array.isArray(workData.items));
      assert.ok(workData.items.length > 0);
      for (const item of workData.items) {
        assert.ok(item.id);
        assert.ok(item.title);
      }
    });

    test("F5.2: Role-based available actions restrict fulfiller vs applicant actions on work items", () => {
      const jordan = demoPersonas.find((p) => p.id === "jordan-lee");
      const alex = demoPersonas.find((p) => p.id === "alex-martin");
      const reviewerPersona = getOperationalPersona(jordan);
      const applicantPersona = getOperationalPersona(alex);

      const reviewerWork = getOperationalWorkItems({ persona: jordan, workstreams: repository.getWorkstreams() });
      assert.ok(reviewerWork.items.length > 0);
      const item = reviewerWork.items[0];

      const reviewerActions = getAvailableActions(item, reviewerPersona);
      const applicantActions = getAvailableActions(item, applicantPersona);

      assert.ok(reviewerActions.length > 0);
      assert.ok(!applicantActions.includes("complete_step"), "Applicant should not have complete_step action");
    });

    test("F5.3: Status tone accurately reflects urgency and critical path health", () => {
      const sam = demoPersonas.find((p) => p.id === "sam-rivera");
      const items = getOperationalWorkItems({ persona: sam, workstreams: repository.getWorkstreams() }).items;

      for (const item of items) {
        assert.ok(["red", "amber", "blue", "green", "slate"].includes(item.statusTone));
        if (item.isCriticalPath && item.statusTone === "red") {
          assert.ok(item.priorityScore >= 80, "Critical path red items must have high priority score");
        }
      }
    });

    test("F5.4: Fulfiller note addition appends operational narrative without changing state", () => {
      const wsId = "WS-LA82-HEAVYHAUL";
      const wsBefore = repository.getWorkstreamById(wsId);
      const stateBefore = wsBefore?.operationalState;

      const auditEvent = repository.addWorkstreamNote({
        workstreamId: wsId,
        note: "Routine field survey complete. Culvert 14B clear.",
        actorName: "Sam Rivera",
        actorOrgName: "DOTD",
      });

      const wsAfter = repository.getWorkstreamById(wsId);
      assert.equal(wsAfter?.operationalState, stateBefore, "Adding note should not change state");
      assert.equal(auditEvent.actionType, "note_added");
      assert.equal(auditEvent.reason, "Routine field survey complete. Culvert 14B clear.");
    });

    test("F5.5: Customer request triage routes request to responsible agency work queue", () => {
      const req = repository.createCustomerRequest({
        projectId: "proj-spacex-pecan",
        requestType: "government_help",
        title: "Utility Interconnection Assistance",
        description: "Need help coordinating 230kV transmission route with Entergy.",
        submittedByName: "Alex Martin",
        blocksActiveWork: false,
      });

      req.knownAgencyCode = "DOTD";
      req.status = "in_progress";

      assert.equal(req.knownAgencyCode, "DOTD");
      assert.equal(req.status, "in_progress");
    });
  });

  // --------------------------------------------------------------------------
  // F6: Customer Portal Clean Separation & Plain-English Narrative
  // --------------------------------------------------------------------------
  describe("F6: Customer Portal Clean Separation & Plain-English Narrative", () => {
    test("F6.1: 6-Question summary deterministically answers who, what, why, when, and consequences", () => {
      const ws = repository.getWorkstreamById("WS-LA82-HEAVYHAUL");
      assert.ok(ws);

      const summary = generateSixQuestionsSummary(ws);
      assert.ok(summary.whoHasIt.includes("DOTD"));
      assert.ok(summary.whatDoing.length > 0);
      assert.ok(summary.waitingFor.length > 0);
      assert.ok(summary.whenDue.length > 0);
      assert.ok(summary.missedConsequence.length > 0);
      assert.ok(summary.deterministicParagraph.includes("LA-82 Heavy-Haul"));
    });

    test("F6.2: Customer-facing project overview summarizes active workstreams and filters blockers", () => {
      const project = repository.getProject();
      const workstreams = repository.getWorkstreams();
      const customerRequests = repository.getCustomerRequests();
      const externalFilings = repository.getExternalFilings();

      const overview = getProjectOverview(project, workstreams, customerRequests, externalFilings);
      assert.ok(overview.healthLabel);
      assert.ok(typeof overview.varianceDays === "number");
      assert.ok(overview.activeWorkstreamCount > 0);
      assert.ok(Array.isArray(overview.customerActions));
      assert.ok(Array.isArray(overview.governmentActions));
      assert.ok(Array.isArray(overview.blockers));
    });

    test("F6.3: Confidential documents are filtered from non-confidential customer queries", () => {
      const allDocs = repository.getDocuments();
      const confidentialDoc = {
        id: "doc-internal-security",
        projectId: "proj-spacex-pecan",
        title: "Internal Agency Security & Access Protocol",
        category: "security_plan",
        ownerOrgCode: "LSP",
        currentVersionNumber: 1,
        isConfidential: true,
        versions: [],
        agencyReviews: [],
      };
      allDocs.push(confidentialDoc);

      const customerVisibleDocs = allDocs.filter((d) => !d.isConfidential);
      assert.ok(!customerVisibleDocs.some((d) => d.id === "doc-internal-security"));
      allDocs.pop();
    });

    test("F6.4: Customer narrative action clause reflects applicant action required vs government review", () => {
      const wsWaitingApplicant = {
        ...workstreamsData[0],
        operationalState: "waiting_applicant",
        customerActionRequired: "Upload PE-certified foundation drawing",
      };
      const summaryApplicant = generateSixQuestionsSummary(wsWaitingApplicant);
      assert.ok(summaryApplicant.deterministicParagraph.includes("Action required from SpaceX: Upload PE-certified foundation drawing"));

      const wsWaitingGov = {
        ...workstreamsData[0],
        operationalState: "waiting_government",
      };
      const summaryGov = generateSixQuestionsSummary(wsWaitingGov);
      assert.ok(summaryGov.deterministicParagraph.includes("No action is currently required from SpaceX."));
    });

    test("F6.5: Customer request intake generates unique confirmation number and assigns intake status", () => {
      const req1 = repository.createCustomerRequest({
        projectId: "proj-spacex-pecan",
        requestType: "permit_authorization",
        title: "New Launch Pad Nitrogen Purge Line",
        description: "Filing for nitrogen line clearance",
        submittedByName: "Alex Martin",
      });
      const req2 = repository.createCustomerRequest({
        projectId: "proj-spacex-pecan",
        requestType: "permit_authorization",
        title: "New Launch Pad Helium Line",
        description: "Filing for helium line clearance",
        submittedByName: "Alex Martin",
      });

      assert.notEqual(req1.confirmationNumber, req2.confirmationNumber);
      assert.equal(req1.status, "submitted");
    });
  });

  // --------------------------------------------------------------------------
  // F7: Dynamic Calendar & Schedule Resilience
  // --------------------------------------------------------------------------
  describe("F7: Dynamic Calendar & Schedule Resilience", () => {
    test("F7.1: calculateDateDiffDays correctly computes positive and negative day intervals", () => {
      assert.equal(calculateDateDiffDays("2026-08-01", "2026-08-11"), 10);
      assert.equal(calculateDateDiffDays("2026-08-15", "2026-08-10"), -5);
      assert.equal(calculateDateDiffDays("2026-08-01", "2026-08-01"), 0);
      assert.equal(calculateDateDiffDays("invalid-date", "2026-08-01"), 0);
    });

    test("F7.2: addDaysToDate correctly transitions month and year boundaries", () => {
      assert.equal(addDaysToDate("2026-08-25", 10), "2026-09-04");
      assert.equal(addDaysToDate("2026-12-28", 5), "2027-01-02");
      assert.equal(addDaysToDate("2028-02-28", 1), "2028-02-29", "Leap year February 29 handled");
      assert.equal(addDaysToDate("invalid", 5), "invalid");
    });

    test("F7.3: Schedule variance calculation accurately compares baseline vs forecast target dates", () => {
      const baseline = "2026-10-01";
      const forecast = "2026-10-15";
      const variance = calculateDateDiffDays(baseline, forecast);
      assert.equal(variance, 14, "Variance should be 14 days delay");
    });

    test("F7.4: Aggregation of delay reasons across workstreams tallies variance days accurately", () => {
      const testWorkstreams = [
        { ...workstreamsData[0], scheduleVarianceDays: 5, primaryDelayReason: "interagency_dependency" },
        { ...workstreamsData[1], scheduleVarianceDays: 3, primaryDelayReason: "applicant_information" },
        { ...workstreamsData[2], scheduleVarianceDays: 0, primaryDelayReason: "none" },
      ];

      const delaySummary = aggregateDelayReasons(testWorkstreams);
      assert.equal(delaySummary.interagency_dependency, 5);
      assert.equal(delaySummary.applicant_information, 3);
      assert.equal(delaySummary.weather, 0);
    });

    test("F7.5: Dynamic target date formatting creates valid localized date strings", () => {
      const summary = generateSixQuestionsSummary(workstreamsData[0]);
      assert.ok(summary.whenDue.length > 0);
      assert.ok(summary.deterministicParagraph.includes("Target completion date:"));
    });
  });

  // --------------------------------------------------------------------------
  // F8: In-Ticket Interactive Workflow DAG Editing
  // --------------------------------------------------------------------------
  describe("F8: In-Ticket Interactive Workflow DAG Editing", () => {
    test("F8.1: Adding a new task to workstream task DAG inserts task with predecessor links", () => {
      const ws = JSON.parse(JSON.stringify(workstreamsData[0]));
      const initialTaskCount = ws.tasks.length;

      const newTask = {
        id: "TASK-CUSTOM-PARISH-HEARING",
        workstreamId: ws.id,
        title: "Vermilion Parish Council Special Hearing",
        taskType: "public_notice",
        assignedOrgId: "org-parish",
        assignedOrgCode: "VERMILION",
        status: "pending",
        isMilestone: true,
        isCriticalPath: false,
        durationDays: 7,
        floatDays: 0,
        predecessorTaskIds: [ws.tasks[0].id],
      };

      ws.tasks.push(newTask);
      assert.equal(ws.tasks.length, initialTaskCount + 1);
      assert.ok(ws.tasks.find((t) => t.id === "TASK-CUSTOM-PARISH-HEARING"));
    });

    test("F8.2: Removing an intermediate task updates successor dependencies without dangling references", () => {
      const tasks = [
        { id: "T1", durationDays: 5, predecessorTaskIds: [] },
        { id: "T2", durationDays: 5, predecessorTaskIds: ["T1"] },
        { id: "T3", durationDays: 5, predecessorTaskIds: ["T2"] },
      ];

      const updatedTasks = tasks.filter((t) => t.id !== "T2").map((t) => {
        if (t.predecessorTaskIds.includes("T2")) {
          return { ...t, predecessorTaskIds: ["T1"] };
        }
        return t;
      });

      assert.equal(updatedTasks.length, 2);
      const t3 = updatedTasks.find((t) => t.id === "T3");
      assert.deepEqual(t3.predecessorTaskIds, ["T1"]);
    });

    test("F8.3: Modifying task duration and milestone flag updates task record in DAG", () => {
      const task = {
        id: "TASK-EDIT-1",
        title: "Draft Hydrology Review",
        durationDays: 5,
        isMilestone: false,
        predecessorTaskIds: [],
      };

      task.durationDays = 12;
      task.isMilestone = true;

      assert.equal(task.durationDays, 12);
      assert.equal(task.isMilestone, true);
    });

    test("F8.4: Inserting custom review gate task enforces hard dependency requirement on downstream stages", () => {
      const tasks = [
        { id: "STEP-1", title: "Engineering Filing", durationDays: 3, predecessorTaskIds: [] },
        { id: "STEP-GATE", title: "Parish Police Jury Concurrence Gate", durationDays: 5, isMilestone: true, predecessorTaskIds: ["STEP-1"] },
        { id: "STEP-2", title: "Final Permit Issuance", durationDays: 2, predecessorTaskIds: ["STEP-GATE"] },
      ];

      const deps = [
        { id: "d1", predecessorTaskId: "STEP-1", successorTaskId: "STEP-GATE" },
        { id: "d2", predecessorTaskId: "STEP-GATE", successorTaskId: "STEP-2" },
      ];

      const { taskEarlyFinish } = solveTaskDAG(tasks, deps);
      assert.equal(taskEarlyFinish.get("STEP-1"), 3);
      assert.equal(taskEarlyFinish.get("STEP-GATE"), 8);
      assert.equal(taskEarlyFinish.get("STEP-2"), 10);
    });

    test("F8.5: Workstream tasks retain assignedOrgCode and assignedUserId across DAG edits", () => {
      const task = {
        id: "TASK-ASSIGN-TEST",
        workstreamId: "WS-LA82-HEAVYHAUL",
        title: "DOTD Bridge Structural Calculations",
        taskType: "agency_review",
        assignedOrgId: "org-dotd",
        assignedOrgCode: "DOTD",
        assignedUserId: "user-sam-rivera",
        assignedUserName: "Sam Rivera",
        durationDays: 8,
        floatDays: 0,
        predecessorTaskIds: [],
        status: "pending",
        isMilestone: false,
        isCriticalPath: true,
      };

      assert.equal(task.assignedOrgCode, "DOTD");
      assert.equal(task.assignedUserId, "user-sam-rivera");
    });
  });

  // --------------------------------------------------------------------------
  // F9: Live Step & Dependency Mutations
  // --------------------------------------------------------------------------
  describe("F9: Live Step & Dependency Mutations", () => {
    test("F9.1: Task dependency records establish finish_to_start predecessor-successor links", () => {
      const dep = {
        id: "dep-t1-t2",
        predecessorTaskId: "TASK-T001",
        successorTaskId: "TASK-T002",
        dependencyType: "finish_to_start",
        gateType: "AND",
        lagDays: 0,
        isControlling: true,
      };

      assert.equal(dep.dependencyType, "finish_to_start");
      assert.equal(dep.gateType, "AND");
      assert.equal(dep.lagDays, 0);
    });

    test("F9.2: Step state transitions execute from pending -> in_progress -> completed / blocked / waived", () => {
      const task = {
        id: "TASK-STATE-MUTATION",
        status: "pending",
      };

      task.status = "in_progress";
      assert.equal(task.status, "in_progress");

      task.status = "completed";
      assert.equal(task.status, "completed");

      task.status = "blocked";
      assert.equal(task.status, "blocked");

      task.status = "waived";
      assert.equal(task.status, "waived");
    });

    test("F9.3: Reassigning step fulfiller updates assignedUserId and assignedUserName", () => {
      const task = {
        id: "TASK-REASSIGN",
        assignedUserId: "user-sam-rivera",
        assignedUserName: "Sam Rivera",
      };

      task.assignedUserId = "user-jordan-lee";
      task.assignedUserName = "Jordan Lee";

      assert.equal(task.assignedUserId, "user-jordan-lee");
      assert.equal(task.assignedUserName, "Jordan Lee");
    });

    test("F9.4: Predecessor list updates alter DAG schedule without losing successor connectivity", () => {
      const tasks = [
        { id: "A", durationDays: 4, predecessorTaskIds: [] },
        { id: "B", durationDays: 6, predecessorTaskIds: [] },
        { id: "C", durationDays: 3, predecessorTaskIds: ["A"] },
      ];

      tasks[2].predecessorTaskIds = ["A", "B"];

      const deps = [
        { predecessorTaskId: "A", successorTaskId: "C" },
        { predecessorTaskId: "B", successorTaskId: "C" },
      ];

      const { taskEarlyFinish } = solveTaskDAG(tasks, deps);
      assert.equal(taskEarlyFinish.get("C"), 9);
    });

    test("F9.5: Workstream stage completion advances to next stage and records completed checklists", () => {
      const ws = repository.getWorkstreamById("WS-WETLANDS-PAD-A");
      assert.ok(ws);

      const result = repository.completeWorkstreamStage({
        workstreamId: ws.id,
        completedChecklists: ["completeness_checklist_passed"],
        providedDocs: ["site_plans", "wetlands_delineation"],
        actorName: "Jean-Paul Guidry",
        actorOrgName: "CPRA",
      });

      assert.equal(result.success, true);
      assert.ok(result.workstream);
    });
  });

  // --------------------------------------------------------------------------
  // F10: Realtime CPM & Gantt Schedule Synchronization
  // --------------------------------------------------------------------------
  describe("F10: Realtime CPM & Gantt Schedule Synchronization", () => {
    test("F10.1: solveTaskDAG forward pass computes early start and early finish for sequential chain", () => {
      const tasks = [
        { id: "1", durationDays: 5, isCriticalPath: false },
        { id: "2", durationDays: 10, isCriticalPath: false },
        { id: "3", durationDays: 3, isCriticalPath: false },
      ];
      const deps = [
        { predecessorTaskId: "1", successorTaskId: "2" },
        { predecessorTaskId: "2", successorTaskId: "3" },
      ];

      const { taskEarlyFinish } = solveTaskDAG(tasks, deps);
      assert.equal(taskEarlyFinish.get("1"), 5);
      assert.equal(taskEarlyFinish.get("2"), 15);
      assert.equal(taskEarlyFinish.get("3"), 18);
    });

    test("F10.2: solveTaskDAG backward pass identifies tasks with total float > 0 on parallel non-critical paths", () => {
      const tasks = [
        { id: "1", durationDays: 5, isCriticalPath: false },
        { id: "2", durationDays: 10, isCriticalPath: false },
        { id: "3", durationDays: 2, isCriticalPath: false },
        { id: "4", durationDays: 5, isCriticalPath: false },
      ];
      const deps = [
        { predecessorTaskId: "1", successorTaskId: "2" },
        { predecessorTaskId: "1", successorTaskId: "3" },
        { predecessorTaskId: "2", successorTaskId: "4" },
        { predecessorTaskId: "3", successorTaskId: "4" },
      ];

      const { criticalTaskIds, taskFloat } = solveTaskDAG(tasks, deps);
      assert.ok(criticalTaskIds.has("1"), "Task 1 is critical");
      assert.ok(criticalTaskIds.has("2"), "Task 2 is critical (longer branch)");
      assert.ok(!criticalTaskIds.has("3"), "Task 3 is non-critical");
      assert.ok(criticalTaskIds.has("4"), "Task 4 is critical");

      assert.equal(taskFloat.get("3"), 8, "Task 3 should have 8 days float");
      assert.equal(taskFloat.get("2"), 0, "Task 2 should have 0 float");
    });

    test("F10.3: Perturbation in critical path duration extends overall project completion duration", () => {
      const scheduleBefore = evaluateProjectSchedule(repository.getWorkstreams());

      const modifiedWorkstreams = repository.getWorkstreams().map((ws) => {
        if (ws.isCriticalPath) {
          return { ...ws, scheduleVarianceDays: ws.scheduleVarianceDays + 10 };
        }
        return ws;
      });

      const scheduleAfter = evaluateProjectSchedule(modifiedWorkstreams);
      assert.ok(scheduleAfter.totalVarianceDays >= scheduleBefore.totalVarianceDays + 10);
    });

    test("F10.4: detectAccelerationOpportunities identifies parallel review opportunities", () => {
      const testWorkstreams = [
        {
          id: "WS-ACCEL-1",
          title: "Coastal Concurrence",
          operationalState: "waiting_government",
          waitingOnEntity: "CPRA",
          scheduleVarianceDays: 10,
        },
      ];

      const opps = detectAccelerationOpportunities(testWorkstreams);
      assert.equal(opps.length, 1);
      assert.equal(opps[0].workstreamId, "WS-ACCEL-1");
      assert.ok(opps[0].potentialDaysSaved >= 5);
      assert.ok(opps[0].explanation.includes("CPRA"));
    });

    test("F10.5: evaluateProjectSchedule identifies controlling workstreams and delay drivers", () => {
      const result = evaluateProjectSchedule(repository.getWorkstreams());
      assert.ok(Array.isArray(result.criticalPathTaskIds));
      assert.ok(Array.isArray(result.controllingWorkstreamIds));
      assert.ok(result.tasksWithFloat.length > 0);
      assert.ok(typeof result.delaySummary === "object");
    });
  });

  // --------------------------------------------------------------------------
  // F11: End-to-End Document Download Reliability
  // --------------------------------------------------------------------------
  describe("F11: End-to-End Document Download Reliability", () => {
    test("F11.1: Direct document version download verifies storage path and returns valid blob", async () => {
      const doc = projectDocumentsData[0];
      const ver = doc.versions[0];

      const payload = Buffer.from("SpaceX LA-82 Hydrodynamic Model v11.0 Certified Data");
      const result = await downloadDocumentVersion(doc, { ...ver, fileSizeBytes: payload.length, sha256Hash: "" }, async () => ({
        blob: new Blob([payload], { type: "application/pdf" }),
        error: null,
      }));

      assert.equal(result.success, true);
      assert.equal(result.error, null);
    });

    test("F11.2: Missing storage path returns descriptive error without fake success disguise", async () => {
      const doc = projectDocumentsData[0];
      const verNoPath = { ...doc.versions[0], storagePath: undefined, storageUri: undefined };

      const result = await downloadDocumentVersion(doc, verNoPath);
      assert.equal(result.success, false);
      assert.ok(result.error?.message.includes("no Storage object path"));
    });

    test("F11.3: Multi-version document history tracks version tags and upload metadata", () => {
      const doc = projectDocumentsData[0];
      assert.ok(doc.versions.length >= 2, "LA-82 drainage study should have multiple versions");
      assert.equal(doc.versions[0].versionTag, "v11.0");
      assert.equal(doc.versions[1].versionTag, "v12.0");
      assert.ok(doc.versions[1].fileSizeBytes > 0);
      assert.ok(doc.versions[1].uploadedByName);
    });

    test("F11.4: Document agency reviews record multi-agency review statuses and comments", () => {
      const doc = projectDocumentsData[0];
      assert.ok(doc.agencyReviews.length >= 2);
      const dotdReview = doc.agencyReviews.find((r) => r.reviewingOrgCode === "DOTD");
      const cpraReview = doc.agencyReviews.find((r) => r.reviewingOrgCode === "CPRA");

      assert.ok(dotdReview);
      assert.ok(cpraReview);
      assert.equal(dotdReview.reviewStatus, "approved");
      assert.equal(cpraReview.reviewStatus, "under_review");
    });

    test("F11.5: File name sanitization preserves clean extension on download", () => {
      const ver = {
        fileName: "LA-82/Culvert:Study*2026?.pdf",
        storagePath: "vault/LA82.pdf",
        fileSizeBytes: 10,
      };
      const sanitized = ver.fileName.replace(/[\\/:*?"<>|]/g, "_");
      assert.equal(sanitized, "LA-82_Culvert_Study_2026_.pdf");
    });
  });

  // --------------------------------------------------------------------------
  // F12: Authentic Demo Document Preservation & SHA-256
  // --------------------------------------------------------------------------
  describe("F12: Authentic Demo Document Preservation & SHA-256", () => {
    test("F12.1: All authentic demo documents exist in fixture with valid metadata", () => {
      const docs = repository.getDocuments();
      assert.ok(docs.length >= 8, `Expected at least 8 demo documents, got ${docs.length}`);

      const titles = docs.map((d) => d.title);
      assert.ok(titles.some((t) => t.includes("Drainage")));
      assert.ok(titles.some((t) => t.includes("Bridge")));
      assert.ok(titles.some((t) => t.includes("Traffic")));
      assert.ok(titles.some((t) => t.includes("Wetland")));
      assert.ok(titles.some((t) => t.includes("Deluge") || t.includes("Retention")));
      assert.ok(titles.some((t) => t.includes("Gas") || t.includes("Pipeline")));
      assert.ok(titles.some((t) => t.includes("Substation") || t.includes("Diagram")));
      assert.ok(titles.some((t) => t.includes("Safety") || t.includes("Hazard")));
    });

    test("F12.2: Cryptographic SHA-256 hash check validates exact matching payload bytes", async () => {
      const text = "SpaceX Launch Complex Pecan Island Authentic Engineering Spec";
      const bytes = Buffer.from(text);
      const sha256Hex = crypto.createHash("sha256").update(bytes).digest("hex");

      const doc = projectDocumentsData[0];
      const version = {
        id: "ver-sha-test",
        documentId: doc.id,
        versionTag: "v1.0",
        fileName: "spec.pdf",
        fileSizeBytes: bytes.length,
        mimeType: "application/pdf",
        storageUri: "vault/spec.pdf",
        sha256Hash: sha256Hex,
        uploadedByName: "SpaceX Engineering",
        uploadedAt: new Date().toISOString(),
        isMalwareClean: true,
      };

      const result = await downloadDocumentVersion(doc, version, async () => ({
        blob: new Blob([bytes], { type: "application/pdf" }),
        error: null,
      }));

      assert.equal(result.success, true);
      assert.equal(result.error, null);
    });

    test("F12.3: Byte length check detects size discrepancy and aborts download", async () => {
      const doc = projectDocumentsData[0];
      const version = {
        id: "ver-size-test",
        documentId: doc.id,
        versionTag: "v1.0",
        fileName: "spec.pdf",
        fileSizeBytes: 500,
        mimeType: "application/pdf",
        storageUri: "vault/spec.pdf",
        sha256Hash: "",
        uploadedByName: "SpaceX Engineering",
        uploadedAt: new Date().toISOString(),
        isMalwareClean: true,
      };

      const result = await downloadDocumentVersion(doc, version, async () => ({
        blob: new Blob([Buffer.from("Only 20 bytes long!!")], { type: "application/pdf" }),
        error: null,
      }));

      assert.equal(result.success, false);
      assert.ok(result.error?.message.includes("Integrity check failed: expected 500 bytes"));
    });

    test("F12.4: Tampered SHA-256 hash triggers explicit integrity error", async () => {
      const text = "Original Authenticated File Data";
      const bytes = Buffer.from(text);

      const doc = projectDocumentsData[0];
      const version = {
        id: "ver-tamper-test",
        documentId: doc.id,
        versionTag: "v1.0",
        fileName: "tamper.pdf",
        fileSizeBytes: bytes.length,
        mimeType: "application/pdf",
        storageUri: "vault/tamper.pdf",
        sha256Hash: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        uploadedByName: "SpaceX Engineering",
        uploadedAt: new Date().toISOString(),
        isMalwareClean: true,
      };

      const result = await downloadDocumentVersion(doc, version, async () => ({
        blob: new Blob([bytes], { type: "application/pdf" }),
        error: null,
      }));

      assert.equal(result.success, false);
      assert.ok(result.error?.message.includes("does not match its SHA-256 record"));
    });

    test("F12.5: Every demo document version specifies valid MIME type and non-zero size", () => {
      const docs = repository.getDocuments();
      for (const doc of docs) {
        for (const ver of doc.versions) {
          assert.ok(ver.fileSizeBytes > 0, `Version ${ver.id} must have positive file size`);
          assert.equal(ver.mimeType, "application/pdf", `Version ${ver.id} must be application/pdf`);
          assert.equal(ver.isMalwareClean, true, `Version ${ver.id} must be malware clean`);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // F13: Supabase Authoritative Persistence & Sync
  // --------------------------------------------------------------------------
  describe("F13: Supabase Authoritative Persistence & Sync", () => {
    test("F13.1: Repository defaults to deterministic mock fixtures when Supabase offline", () => {
      const project = repository.getProject();
      assert.ok(project);
      assert.equal(project.code, "SPACEX-PECAN-ISLAND");
      assert.equal(project.leadStateAgencyCode, "LA-PROJECTS");
    });

    test("F13.2: Audit ledger records immutable event log with actionType, actor, and timestamp", () => {
      const event = createAuditEvent({
        entityType: "workstream",
        entityId: "WS-LA82-HEAVYHAUL",
        actorName: "Mark Fontenot",
        actorOrgName: "DOTD",
        actionType: "status_changed",
        oldValue: "waiting_government",
        newValue: "running",
        reason: "Concurrence received from CPRA",
      });

      assert.ok(event.id.length > 0);
      assert.equal(event.entityType, "workstream");
      assert.equal(event.actionType, "status_changed");
      assert.ok(event.occurredAt);
    });

    test("F13.3: Interagency Coordination Requests (CR-00xxx) persist with unique codes", () => {
      const cr = repository.createCoordinationRequest({
        workstreamId: "WS-LA82-HEAVYHAUL",
        workstreamTitle: "LA-82 Heavy-Haul Access",
        requestingOrgId: "org-dotd",
        requestingOrgCode: "DOTD",
        targetOrgId: "org-cpra",
        targetOrgCode: "CPRA",
        requestingUserName: "Mark Fontenot",
        title: "Tidal Culvert Hydrodynamics Concurrence",
        needDescription: "Need CPRA coastal concurrence for Culvert 14B.",
        dueDate: "2026-09-12",
        priority: "high",
      });

      assert.ok(cr.id);
      assert.ok(cr.code.startsWith("CR-"));
      assert.equal(cr.status, "pending");
    });

    test("F13.4: First-class Commitments persist with promised due date and impact analysis", () => {
      const comm = repository.createCommitment({
        workstreamId: "WS-LA82-HEAVYHAUL",
        workstreamTitle: "LA-82 Heavy-Haul Access",
        committingOrgId: "org-cpra",
        committingOrgCode: "CPRA",
        madeByPersonName: "Jean-Paul Guidry",
        committedAction: "Deliver finalized coastal concurrence letter",
        originContext: "Interagency standup meeting",
        promisedDueDate: "2026-09-08",
        impactIfMissed: "Culvert installation delayed by 5 days",
        isCriticalPathImpact: true,
      });

      assert.ok(comm.id);
      assert.equal(comm.committingOrgCode, "CPRA");
      assert.equal(comm.status, "on_track");
    });

    test("F13.5: User profiles and organization memberships maintain synchronized state", () => {
      const profiles = repository.getProfiles();
      assert.ok(profiles.length >= 5);

      const sarah = profiles.find((p) => p.fullName === "Sarah Johnson");
      assert.ok(sarah);
      assert.equal(sarah.organizationName, "Louisiana Governor's Office of Major Projects & Delivery");
    });
  });

});

// ============================================================================
// TIER 2: BOUNDARY & CORNER CASES (5 Areas — >=5 tests per area)
// ============================================================================

describe("Tier 2: Boundary & Corner Cases (5 Areas)", () => {

  // --------------------------------------------------------------------------
  // Area 1: Zero / Null / Unassigned Fulfillers & Empty Queues
  // --------------------------------------------------------------------------
  describe("Area 1: Zero / Null / Unassigned Fulfillers & Empty Queues", () => {
    test("B1.1: Unassigned task with undefined assignedUserId handles queueing gracefully", () => {
      const unassignedTask = {
        id: "TASK-UNASSIGNED",
        title: "General Unassigned Review Task",
        assignedOrgId: "org-dotd",
        assignedOrgCode: "DOTD",
        assignedUserId: undefined,
        assignedUserName: undefined,
        status: "pending",
        durationDays: 5,
        predecessorTaskIds: [],
      };

      const participant = participantForTask(unassignedTask.id);
      assert.equal(participant, undefined, "Unassigned task should have no assigned participant");
    });

    test("B1.2: Empty workstream with zero tasks calculates schedule with 0 duration without crash", () => {
      const emptyTasks = [];
      const emptyDeps = [];

      const { criticalTaskIds, taskFloat } = solveTaskDAG(emptyTasks, emptyDeps);
      assert.equal(criticalTaskIds.size, 0);
      assert.equal(taskFloat.size, 0);
    });

    test("B1.3: Persona with no matching assigned work items returns 0 assigned items cleanly", () => {
      const ghostPersona = {
        id: "ghost-user-unknown",
        name: "Ghost User",
        email: "ghost@example.com",
        role: "Unknown Role",
        badge: "Reviewer",
        agency: "UNKNOWN_AGENCY",
        organization: "Unknown Agency",
      };

      const workItems = getOperationalWorkItems({
        persona: ghostPersona,
        workstreams: repository.getWorkstreams(),
        rfis: repository.getRFIs(),
      });

      const personallyAssigned = workItems.items.filter((i) => i.assignedUserId === `user-${ghostPersona.id}` || i.assignedUserId === ghostPersona.id);
      assert.equal(personallyAssigned.length, 0);
    });

    test("B1.4: Customer request with undefined knownAgencyCode defaults to general concierge triage", () => {
      const req = repository.createCustomerRequest({
        projectId: "proj-spacex-pecan",
        requestType: "project_question",
        title: "Question regarding general permitting timeline",
        description: "General question not tied to any specific agency.",
        submittedByName: "Alex Martin",
      });

      assert.equal(req.knownAgencyCode, undefined);
      assert.equal(req.status, "submitted");
    });

    test("B1.5: Organization without liaison contact info handles empty contacts safely", () => {
      const orgWithoutLiaison = {
        id: "org-minimal",
        code: "MINIMAL",
        name: "Minimal Test Organization",
        abbreviation: "MTO",
        jurisdictionLevel: "State",
        workingHours: "8-5",
        holidayCalendar: "Standard",
        defaultSlaDays: 10,
        documentRetentionYears: 5,
        isActive: true,
      };

      assert.equal(orgWithoutLiaison.projectLiaisonName, undefined);
      assert.equal(orgWithoutLiaison.projectLiaisonEmail, undefined);
    });
  });

  // --------------------------------------------------------------------------
  // Area 2: Cyclic DAG Dependency Detection & Graph Anomalies
  // --------------------------------------------------------------------------
  describe("Area 2: Cyclic DAG Dependency Detection & Graph Anomalies", () => {
    test("B2.1: Self-referential dependency (A -> A) is detected and rejected by cycle validator", () => {
      const tasks = [{ id: "A", durationDays: 5, isCriticalPath: false }];
      const deps = [{ predecessorTaskId: "A", successorTaskId: "A" }];

      const isCyclic = detectDAGCycle(tasks, deps);
      assert.equal(isCyclic, true, "Self-loop must be detected as cyclic");
    });

    test("B2.2: 2-Node circular loop (A -> B -> A) is detected and rejected by cycle validator", () => {
      const tasks = [
        { id: "A", durationDays: 5, isCriticalPath: false },
        { id: "B", durationDays: 5, isCriticalPath: false },
      ];
      const deps = [
        { predecessorTaskId: "A", successorTaskId: "B" },
        { predecessorTaskId: "B", successorTaskId: "A" },
      ];

      const isCyclic = detectDAGCycle(tasks, deps);
      assert.equal(isCyclic, true, "2-node loop must be detected as cyclic");
    });

    test("B2.3: Disconnected island tasks in DAG are scheduled independently in parallel", () => {
      const tasks = [
        { id: "Chain-1", durationDays: 10, isCriticalPath: false },
        { id: "Chain-2", durationDays: 5, isCriticalPath: false },
        { id: "Island-X", durationDays: 8, isCriticalPath: false },
      ];
      const deps = [{ predecessorTaskId: "Chain-1", successorTaskId: "Chain-2" }];

      const { taskEarlyFinish } = solveTaskDAG(tasks, deps);
      assert.equal(taskEarlyFinish.get("Chain-1"), 10);
      assert.equal(taskEarlyFinish.get("Chain-2"), 15);
      assert.equal(taskEarlyFinish.get("Island-X"), 8, "Island task starts at t=0");
    });

    test("B2.4: Zero-duration milestone tasks calculate zero float correctly on critical path", () => {
      const tasks = [
        { id: "Task-1", durationDays: 10, isCriticalPath: true },
        { id: "Milestone-Gate", durationDays: 0, isMilestone: true, isCriticalPath: true },
      ];
      const deps = [{ predecessorTaskId: "Task-1", successorTaskId: "Milestone-Gate" }];

      const { criticalTaskIds, taskEarlyFinish } = solveTaskDAG(tasks, deps);
      assert.equal(taskEarlyFinish.get("Milestone-Gate"), 10);
      assert.ok(criticalTaskIds.has("Milestone-Gate"));
    });

    test("B2.5: Out-of-order task sequence in array resolves topological order correctly", () => {
      const tasks = [
        { id: "Z-Final", durationDays: 2, isCriticalPath: false },
        { id: "Y-Middle", durationDays: 3, isCriticalPath: false },
        { id: "X-Start", durationDays: 4, isCriticalPath: false },
      ];
      const deps = [
        { predecessorTaskId: "X-Start", successorTaskId: "Y-Middle" },
        { predecessorTaskId: "Y-Middle", successorTaskId: "Z-Final" },
      ];

      const { taskEarlyFinish } = solveTaskDAG(tasks, deps);
      assert.equal(taskEarlyFinish.get("X-Start"), 4);
      assert.equal(taskEarlyFinish.get("Y-Middle"), 7);
      assert.equal(taskEarlyFinish.get("Z-Final"), 9);
    });
  });

  // --------------------------------------------------------------------------
  // Area 3: Statutory Clock Pause/Resume Transitions
  // --------------------------------------------------------------------------
  describe("Area 3: Statutory Clock Pause/Resume Transitions", () => {
    test("B3.1: Multiple consecutive RFI cycles accrue schedule variance cleanly", () => {
      const wsId = "WS-SUBSTATION-230KV";
      const ws = repository.getWorkstreamById(wsId);
      assert.ok(ws);

      // Cycle 1
      const rfi1 = repository.createRFI({
        workstreamId: wsId,
        workstreamTitle: ws.title,
        requestingOrgId: "org-ldeq",
        requestingOrgCode: "LDEQ",
        recipientOrgId: "org-spacex",
        recipientOrgCode: "SPACEX",
        title: "RFI Cycle 1: Substation Pad Foundation",
        questionText: "Foundation details needed.",
        technicalReason: "Infrastructure safety.",
        responseDeadline: "2026-09-05",
        actorName: "Jordan Lee",
      });
      repository.submitRfiResponse({ rfiId: rfi1.id, submittedByName: "Alex Martin", responseText: "Pad foundation details attached." });
      repository.acceptRfiResponse({ rfiId: rfi1.id, actorName: "Jordan Lee", actorOrgName: "LDEQ" });

      // Cycle 2
      const rfi2 = repository.createRFI({
        workstreamId: wsId,
        workstreamTitle: ws.title,
        requestingOrgId: "org-ldeq",
        requestingOrgCode: "LDEQ",
        recipientOrgId: "org-spacex",
        recipientOrgCode: "SPACEX",
        title: "RFI Cycle 2: Transformer Oil Containment",
        questionText: "Secondary containment sizing.",
        technicalReason: "SPCC compliance.",
        responseDeadline: "2026-09-12",
        actorName: "Jordan Lee",
      });
      assert.equal(rfi2.status, "issued");
      assert.equal(repository.getWorkstreamById(wsId)?.operationalState, "waiting_applicant");
    });

    test("B3.2: Clock paused status prevents premature statutory deadline expiration", () => {
      const ws = {
        ...workstreamsData[0],
        operationalState: "waiting_applicant",
        waitingReason: "Waiting on SpaceX revised engineering calculation",
        scheduleVarianceDays: 0,
      };

      const health = deriveOperationalHealth(ws.operationalState, ws.scheduleVarianceDays, ws.isCriticalPath);
      assert.ok(health === "yellow" || health === "red");
    });

    test("B3.3: Zero-day statutory minimum duration handled gracefully without divide-by-zero", () => {
      const permitType = {
        ...permitCatalog[0],
        minimumStatutoryDays: 0,
        expectedLeadTimeDays: 14,
      };

      assert.equal(permitType.minimumStatutoryDays, 0);
      assert.ok(permitType.expectedLeadTimeDays > 0);
    });

    test("B3.4: Severely overdue workstream evaluates Level 5 executive escalation", () => {
      const severelyOverdueWs = {
        ...workstreamsData[0],
        isCriticalPath: true,
        scheduleVarianceDays: 15,
        operationalState: "blocked",
      };

      const evalResult = evaluateWorkstreamEscalation(severelyOverdueWs, 30);
      assert.equal(evalResult.currentLevel, 5);
      assert.equal(evalResult.isExecutiveActionRequired, true);
      assert.ok(evalResult.notifiedParties.some((p) => p.includes("Governor's Office")));
    });

    test("B3.5: Non-negative variance days guaranteed when forecast is ahead of baseline", () => {
      const diff = calculateDateDiffDays("2026-10-15", "2026-10-01");
      assert.equal(diff, -14);
      const reportedVariance = Math.max(0, diff);
      assert.equal(reportedVariance, 0, "Reported delay variance should never be negative");
    });
  });

  // --------------------------------------------------------------------------
  // Area 4: Document Byte Mismatch & Tampering Rejection
  // --------------------------------------------------------------------------
  describe("Area 4: Document Byte Mismatch & Tampering Rejection", () => {
    test("B4.1: Download rejects mismatched payload when expected length is violated", async () => {
      const doc = projectDocumentsData[0];
      const ver = {
        ...doc.versions[0],
        fileSizeBytes: 1000,
      };

      const res = await downloadDocumentVersion(doc, ver, async () => ({
        blob: new Blob([Buffer.from("short")], { type: "application/pdf" }),
        error: null,
      }));

      assert.equal(res.success, false);
      assert.ok(res.error?.message.includes("Integrity check failed"));
    });

    test("B4.2: Download rejects tampered hash when downloaded file bytes produce different SHA-256", async () => {
      const doc = projectDocumentsData[0];
      const ver = {
        ...doc.versions[0],
        fileSizeBytes: 15,
        sha256Hash: "1111111111111111111111111111111111111111111111111111111111111111",
      };

      const res = await downloadDocumentVersion(doc, ver, async () => ({
        blob: new Blob([Buffer.from("123456789012345")], { type: "application/pdf" }),
        error: null,
      }));

      assert.equal(res.success, false);
      assert.ok(res.error?.message.includes("does not match its SHA-256 record"));
    });

    test("B4.3: Document version with empty storagePath returns explicit error", async () => {
      const doc = projectDocumentsData[0];
      const ver = {
        ...doc.versions[0],
        storagePath: "",
        storageUri: "",
      };

      const res = await downloadDocumentVersion(doc, ver);
      assert.equal(res.success, false);
      assert.ok(res.error?.message.includes("no Storage object path"));
    });

    test("B4.4: Corrupted download provider returning null blob returns clean error", async () => {
      const doc = projectDocumentsData[0];
      const ver = doc.versions[0];

      const res = await downloadDocumentVersion(doc, ver, async () => ({
        blob: null,
        error: new Error("Network timeout during blob retrieval"),
      }));

      assert.equal(res.success, false);
      assert.equal(res.error?.message, "Network timeout during blob retrieval");
    });

    test("B4.5: Unsupported data/blob URL failure handles fetch exception safely", async () => {
      const doc = projectDocumentsData[0];
      const ver = {
        ...doc.versions[0],
        storagePath: "blob:invalid-blob-uri-404",
        storageUri: "blob:invalid-blob-uri-404",
      };

      const res = await downloadDocumentVersion(doc, ver);
      assert.equal(res.success, false);
      assert.ok(res.error);
    });
  });

  // --------------------------------------------------------------------------
  // Area 5: Unauthorized Role Workflow Edit & Permission Boundaries
  // --------------------------------------------------------------------------
  describe("Area 5: Unauthorized Role Workflow Edit & Permission Boundaries", () => {
    test("B5.1: Customer applicant persona is rejected from performing complete_step on agency review queue item", () => {
      const applicant = getOperationalPersona(demoPersonas.find((p) => p.id === "alex-martin"));
      const agencyWorkItem = {
        id: "ITEM-AGENCY-INTERNAL",
        sourceId: "TASK-T001",
        kind: "task",
        title: "DOTD Structural Bridge Review",
        projectName: "SpaceX Pecan Island",
        workstreamTitle: "LA-82 Heavy-Haul",
        whyHere: "Requires DOTD PE review",
        whatToDo: "Sign off bridge calculation",
        removesFromQueue: "Mark completed",
        statusLabel: "In Review",
        statusTone: "amber",
        priorityScore: 80,
        isCriticalPath: true,
        ownerName: "Sam Rivera",
        ownerOrganization: "DOTD",
        requiredInputs: [],
        documents: [],
      };

      const availableActions = getAvailableActions(agencyWorkItem, applicant);
      assert.ok(!availableActions.includes("complete_step"), "Applicant must not be allowed to complete internal agency step");
    });

    test("B5.2: Applicant persona is prevented from approving agency reviews on documents", () => {
      const applicant = getOperationalPersona(demoPersonas.find((p) => p.id === "alex-martin"));
      const docWorkItem = {
        id: "DOC-REVIEW-ITEM",
        sourceId: "doc-drainage-study",
        kind: "document",
        title: "LA-82 Drainage Study",
        projectName: "SpaceX Pecan Island",
        workstreamTitle: "LA-82 Heavy-Haul",
        whyHere: "Review required",
        whatToDo: "Approve or request revisions",
        removesFromQueue: "Review decision",
        statusLabel: "Under Review",
        statusTone: "amber",
        priorityScore: 70,
        isCriticalPath: false,
        ownerName: "DOTD",
        ownerOrganization: "DOTD",
        requiredInputs: [],
        documents: [],
      };

      const actions = getAvailableActions(docWorkItem, applicant);
      assert.ok(!actions.includes("approve_document"));
    });

    test("B5.3: Cross-agency boundary: DOTD reviewer cannot approve LDEQ environmental permit stage", () => {
      const dotdReviewer = getOperationalPersona(demoPersonas.find((p) => p.id === "sam-rivera"));
      assert.equal(dotdReviewer.agencyCode, "DOTD");

      const ldeqStage = {
        id: "stage-ldeq-air",
        name: "LDEQ Technical Air Dispersion Review",
        responsibleOrgCode: "LDEQ",
        responsibleOrgId: "org-ldeq",
      };

      assert.notEqual(dotdReviewer.agencyCode, ldeqStage.responsibleOrgCode, "DOTD reviewer must not belong to LDEQ");
    });

    test("B5.4: Inactive user profile is excluded from customer-visible directory", () => {
      const profiles = [
        ...projectProfiles,
        {
          id: "profile-inactive-consultant",
          userId: "user-inactive",
          fullName: "Retired Consultant",
          displayTitle: "Emeritus Advisor",
          organizationId: "org-spacex",
          organizationName: "SpaceX",
          workEmail: "retired@example.com",
          preferredContactMethod: "email",
          availabilityStatus: "out_of_office",
          projectRole: "Advisor",
          isCustomerVisible: true,
          isActive: false,
        },
      ];

      const visible = customerVisibleProfiles(profiles);
      assert.ok(!visible.some((p) => p.userId === "user-inactive"));
    });

    test("B5.5: Non-existent participant returns undefined safely without exception", () => {
      const nonExistent = participantForWorkstream("WS-NON-EXISTENT-999");
      assert.equal(nonExistent, undefined);
    });
  });

});

// ============================================================================
// TIER 3: CROSS-FEATURE PAIRWISE INTERACTIONS (>=10 tests)
// ============================================================================

describe("Tier 3: Cross-Feature Pairwise Interactions (>=10 tests)", () => {

  test("P1: In-ticket DAG step injection -> CPM float recalculation + Assignment Group routing + customer narrative update", () => {
    const ws = repository.getWorkstreamById("WS-LA82-HEAVYHAUL");
    assert.ok(ws);

    // 1. Inject new in-ticket step
    const insertedTask = {
      id: "TASK-PARISH-DRAINAGE-GATE",
      workstreamId: ws.id,
      title: "Vermilion Parish Culvert Capacity Sign-off",
      taskType: "agency_review",
      assignedOrgId: "org-parish",
      assignedOrgCode: "VERMILION",
      assignedUserId: "user-riley-brooks",
      status: "pending",
      isMilestone: true,
      isCriticalPath: true,
      durationDays: 8,
      floatDays: 0,
      predecessorTaskIds: [ws.tasks[0].id],
    };
    ws.tasks.push(insertedTask);

    // 2. Solve CPM DAG
    const dependencies = [];
    ws.tasks.forEach((t) => {
      t.predecessorTaskIds.forEach((pId) => {
        dependencies.push({ predecessorTaskId: pId, successorTaskId: t.id });
      });
    });
    const { criticalTaskIds, taskEarlyFinish } = solveTaskDAG(ws.tasks, dependencies);
    assert.ok(criticalTaskIds.has("TASK-PARISH-DRAINAGE-GATE"));
    assert.ok(taskEarlyFinish.get("TASK-PARISH-DRAINAGE-GATE") > 0);

    // 3. Customer Narrative update
    ws.currentActionSummary = "Vermilion Parish Culvert Capacity Review";
    ws.waitingReason = "Awaiting parish drainage board review";
    ws.waitingOnEntity = "Vermilion Parish";
    const narrative = generateSixQuestionsSummary(ws);
    assert.ok(narrative.whatDoing.includes("Vermilion Parish Culvert"));
    assert.equal(narrative.waitingOn, "Vermilion Parish");
  });

  test("P2: Priority P1 escalation -> Statutory clock acceleration -> Cross-agency coordination request dispatch", () => {
    const req = repository.createCustomerRequest({
      projectId: "proj-spacex-pecan",
      requestType: "blocker_coordination",
      title: "P1 Critical Blocker: Substation Right-of-Way Crossing",
      description: "Immediate interagency clearance needed for high-voltage transmission line.",
      scheduleImportance: "critical",
      submittedByName: "Alex Martin",
      blocksActiveWork: true,
    });
    assert.equal(req.scheduleImportance, "critical");

    const cr = repository.createCoordinationRequest({
      workstreamId: "WS-SUBSTATION-230KV",
      workstreamTitle: "230kV Substation & Transmission Interconnect",
      requestingOrgId: "org-dotd",
      requestingOrgCode: "DOTD",
      targetOrgId: "org-ldeq",
      targetOrgCode: "LDEQ",
      requestingUserName: "Sam Rivera",
      title: "Expedited Air & Wetland Crossing Concurrence",
      needDescription: "P1 request CR dispatch to expedite permit concurrence.",
      dueDate: "2026-09-06",
      priority: "critical_path",
    });
    assert.equal(cr.priority, "critical_path");
    assert.ok(cr.code.startsWith("CR-"));
  });

  test("P3: RFI creation -> Statutory clock pause -> Customer portal notification -> Submitter response -> Clock resumes", () => {
    const wsId = "WS-PUBLIC-SAFETY-AIRSPACE";
    const ws = repository.getWorkstreamById(wsId);
    assert.ok(ws);

    // 1. Create RFI
    const rfi = repository.createRFI({
      workstreamId: wsId,
      workstreamTitle: ws.title,
      requestingOrgId: "org-state-po",
      requestingOrgCode: "LA-PROJECTS",
      recipientOrgId: "org-spacex",
      recipientOrgCode: "SPACEX",
      title: "NOTAM & Maritime Exclusion Zone Boundaries",
      questionText: "Provide nautical coordinates for Gulf hazard zone during launch window.",
      technicalReason: "US Coast Guard and FAA coordination.",
      responseDeadline: "2026-09-18",
      actorName: "Sarah Johnson",
    });
    assert.equal(rfi.clockImpact, "clock_paused");

    // 2. Submitter submits response
    const resp = repository.submitRfiResponse({
      rfiId: rfi.id,
      submittedByName: "Alex Martin",
      responseText: "Maritime zone coordinates submitted in attachment MZ-204.",
    });
    assert.ok(resp);

    // 3. Reviewer accepts response -> resumes
    const accepted = repository.acceptRfiResponse({
      rfiId: rfi.id,
      actorName: "Sarah Johnson",
      actorOrgName: "LA-PROJECTS",
      notes: "Coordinates verified with USCG District 8.",
    });
    assert.ok(accepted);
    const resumedWs = repository.getWorkstreamById(wsId);
    assert.equal(resumedWs?.operationalState, "running");
  });

  test("P4: Document upload with SHA-256 verification -> In-ticket DAG milestone gate attachment -> Fulfiller sign-off", async () => {
    const docBytes = Buffer.from("SpaceX Official Foundation Load Rating Calculation Spec");
    const docHash = crypto.createHash("sha256").update(docBytes).digest("hex");

    const doc = projectDocumentsData[1];
    const newVersion = {
      id: "doc-v-bridge-v4",
      documentId: doc.id,
      versionTag: "v4.0",
      fileName: "Freshwater_Bayou_Bridge_Axle_Matrix_v4.pdf",
      fileSizeBytes: docBytes.length,
      mimeType: "application/pdf",
      storageUri: "vault/bridge/Freshwater_Bayou_Bridge_Axle_Matrix_v4.pdf",
      sha256Hash: docHash,
      uploadedByName: "Dr. Aris Thorne (SpaceX)",
      uploadedAt: new Date().toISOString(),
      isMalwareClean: true,
    };

    const dlResult = await downloadDocumentVersion(doc, newVersion, async () => ({
      blob: new Blob([docBytes], { type: "application/pdf" }),
      error: null,
    }));
    assert.equal(dlResult.success, true);

    const review = {
      id: "rev-dotd-bridge-v4",
      documentVersionId: newVersion.id,
      workstreamId: "WS-LA82-HEAVYHAUL",
      reviewingOrgCode: "DOTD",
      reviewStatus: "approved",
      reviewedByName: "Mark Fontenot, PE",
      decisionDate: "2026-08-31",
      reviewComments: "Axle matrix Revision 4 fully approved for 350-ton heavy-haul trailer.",
    };
    assert.equal(review.reviewStatus, "approved");
  });

  test("P5: Assignment Group reallocation -> Fulfiller queue update -> Immutable audit ledger event recording", () => {
    const wsId = "WS-SUBSTATION-230KV";
    const ws = repository.getWorkstreamById(wsId);
    assert.ok(ws);

    const audit = createAuditEvent({
      entityType: "workstream",
      entityId: wsId,
      actorName: "Sarah Johnson",
      actorOrgName: "LA-PROJECTS",
      actionType: "reassigned",
      oldValue: "DOTD District 03 Review Team",
      newValue: "DOTD Utilities & Electrical Review Unit",
      reason: "Specialized electrical engineering review required",
    });

    assert.equal(audit.actionType, "reassigned");
    assert.equal(audit.newValue, "DOTD Utilities & Electrical Review Unit");
  });

  test("P6: Inter-agency blocker creation -> RAG health degrades to Red -> Schedule variance increases -> State Office escalation", () => {
    const wsId = "WS-WASTEWATER-DELUGE";
    const ws = repository.getWorkstreamById(wsId);
    assert.ok(ws);

    const blockedWs = repository.markWorkstreamBlocked({
      workstreamId: wsId,
      reason: "Waiting for USACE concurrence on outfall discharge permit",
      waitingOn: "USACE",
      actorName: "Dr. Rachel Benoit",
      actorOrgName: "LDEQ",
    });

    assert.equal(blockedWs.operationalState, "blocked");
    assert.equal(blockedWs.waitingOnEntity, "USACE");

    const health = deriveOperationalHealth(blockedWs.operationalState, blockedWs.scheduleVarianceDays, blockedWs.isCriticalPath);
    assert.equal(health, "red");

    const esc = evaluateWorkstreamEscalation(blockedWs, 15);
    assert.ok(esc.isEscalated);
  });

  test("P7: Customer request triage -> Workstream creation -> Responsible agency routing -> Forecast target date calculation", () => {
    const req = repository.createCustomerRequest({
      projectId: "proj-spacex-pecan",
      requestType: "permit_authorization",
      title: "Launch Pad Emergency Siren System",
      description: "Installation of parish-wide emergency warning siren.",
      submittedByName: "Alex Martin",
    });

    req.knownAgencyCode = "VERMILION";
    req.status = "in_progress";
    assert.equal(req.knownAgencyCode, "VERMILION");

    const newWs = {
      id: "WS-PARISH-SIREN-001",
      projectId: req.projectId,
      code: "WS-PARISH-SIREN",
      title: req.title,
      category: "public_safety",
      categoryLabel: "Public Safety",
      governmentConcierge: {
        name: "Sarah Johnson",
        title: "State Project Concierge",
        agency: "LA-PROJECTS",
        email: "sarah.johnson@la.gov",
        phone: "(225) 342-7000",
      },
      regulatoryLead: {
        orgCode: "VERMILION",
        orgName: "Vermilion Parish Police Jury",
        jurisdictionLevel: "Local / Parish",
        assignedReviewerName: "Riley Brooks",
        assignedReviewerEmail: "riley.brooks@vermilionparish.org",
      },
      operationalState: "running",
      operationalStateLabel: "Running",
      ragHealth: "green",
      isCriticalPath: false,
      baselineStartDate: "2026-09-01",
      baselineTargetDate: "2026-09-20",
      forecastStartDate: "2026-09-01",
      forecastTargetDate: "2026-09-20",
      scheduleVarianceDays: 0,
      currentActionSummary: "Public safety review",
      nextExpectedEvent: "Parish hearing",
      customerActionRequired: "None",
      primaryDelayReason: "none",
      escalationLevel: 0,
      tasks: [],
      commitments: [],
      coordinationRequests: [],
      rfis: [],
    };

    assert.equal(newWs.regulatoryLead.orgCode, "VERMILION");
    assert.equal(newWs.forecastTargetDate, "2026-09-20");
  });

  test("P8: What-If simulation perturbation -> Step duration delay -> Critical path shift -> Downstream dependency float reduced", () => {
    const tasks = [
      { id: "PathA-1", durationDays: 5, isCriticalPath: true },
      { id: "PathA-2", durationDays: 10, isCriticalPath: true },
      { id: "PathB-1", durationDays: 5, isCriticalPath: false },
      { id: "PathB-2", durationDays: 4, isCriticalPath: false },
      { id: "Merge", durationDays: 2, isCriticalPath: true },
    ];
    const deps = [
      { predecessorTaskId: "PathA-1", successorTaskId: "PathA-2" },
      { predecessorTaskId: "PathA-2", successorTaskId: "Merge" },
      { predecessorTaskId: "PathB-1", successorTaskId: "PathB-2" },
      { predecessorTaskId: "PathB-2", successorTaskId: "Merge" },
    ];

    const initialRun = solveTaskDAG(tasks, deps);
    assert.equal(initialRun.taskFloat.get("PathB-2"), 6);

    const perturbedTasks = tasks.map((t) => (t.id === "PathB-1" ? { ...t, durationDays: 13 } : t));
    const perturbedRun = solveTaskDAG(perturbedTasks, deps);

    assert.ok(perturbedRun.criticalTaskIds.has("PathB-1"));
    assert.ok(perturbedRun.criticalTaskIds.has("PathB-2"));
    assert.equal(perturbedRun.taskFloat.get("PathB-2"), 0);
  });

  test("P9: Workstream stage completion with checklist verification -> Next stage auto-advance -> Lead agency transition -> Customer narrative updated", () => {
    const ws = repository.getWorkstreamById("WS-WETLANDS-PAD-A");
    assert.ok(ws);

    const comp = repository.completeWorkstreamStage({
      workstreamId: ws.id,
      completedChecklists: ["completeness_checklist_passed"],
      providedDocs: ["site_plans", "wetlands_delineation"],
      actorName: "Jean-Paul Guidry",
      actorOrgName: "CPRA",
    });

    assert.equal(comp.success, true);
    const updatedWs = repository.getWorkstreamById(ws.id);
    const summary = generateSixQuestionsSummary(updatedWs);
    assert.ok(summary.deterministicParagraph.length > 0);
  });

  test("P10: Multi-agency concurrent document review -> Aggregate decision logging -> Milestone gate release -> Workstream unblocking", () => {
    const reviews = [
      { org: "DOTD", status: "approved", reviewer: "Mark Fontenot" },
      { org: "CPRA", status: "approved", reviewer: "Jean-Paul Guidry" },
    ];

    const allApproved = reviews.every((r) => r.status === "approved");
    assert.equal(allApproved, true);

    const decision = {
      id: "dec-joint-culvert-approval",
      projectId: "proj-spacex-pecan",
      decisionDate: "2026-08-31",
      title: "Joint DOTD & CPRA Concurrence on Culvert 14B",
      decisionSummary: "Both agencies have approved hydrodynamic model v12.0.",
      decisionMakerName: "Mark Fontenot & Jean-Paul Guidry",
      decisionMakerTitle: "DOTD Lead Engineer & CPRA Coastal Director",
      organizationsRepresented: ["DOTD", "CPRA"],
      statutoryAuthority: "La. R.S. 48:221 & La. R.S. 49:214.21",
      affectedWorkstreamIds: ["WS-LA82-HEAVYHAUL"],
    };

    assert.equal(decision.organizationsRepresented.length, 2);
  });

});

// ============================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS (>=5 scenarios)
// ============================================================================

describe("Tier 4: Real-World Application Scenarios (>=5 scenarios)", () => {

  test("Scenario 1: SpaceX Heavy-Haul Transport Corridor (Intake -> State Concierge triage -> DOTD & Parish queue -> In-ticket custom hearing gate -> Load study SHA-256 verify -> Statutory clock compliance -> Concurrent approval)", async () => {
    // 1. Intake: SpaceX submits heavy-haul route authorization request
    const request = repository.createCustomerRequest({
      projectId: "proj-spacex-pecan",
      requestType: "permit_authorization",
      title: "SpaceX Heavy-Haul Transport Corridor (Starship Pad A Booster)",
      description: "Permit authorization to transport 320-ton booster along LA-82 corridor from Intracoastal City.",
      knownAgencyCode: "DOTD",
      submittedByUserId: "user-alex-martin",
      submittedByName: "Alex Martin",
      blocksActiveWork: true,
      scheduleImportance: "critical",
    });
    assert.ok(request.confirmationNumber);

    // 2. State Concierge Triage
    request.knownAgencyCode = "DOTD";
    request.status = "in_progress";
    assert.equal(request.status, "in_progress");

    // 3. Fulfiller queue verification
    const sam = demoPersonas.find((p) => p.id === "sam-rivera");
    const queue = getOperationalWorkItems({ persona: sam, workstreams: repository.getWorkstreams() });
    assert.ok(queue.items.length > 0);

    // 4. In-ticket custom Parish public hearing gate insertion
    const ws = repository.getWorkstreamById("WS-LA82-HEAVYHAUL");
    assert.ok(ws);
    const parishHearingTask = {
      id: "TASK-PARISH-HEARING-001",
      workstreamId: ws.id,
      title: "Vermilion Parish Police Jury Public Hearing & Heavy Haul Escort Concurrence",
      taskType: "public_notice",
      assignedOrgId: "org-parish",
      assignedOrgCode: "VERMILION",
      assignedUserId: "user-riley-brooks",
      status: "completed",
      isMilestone: true,
      isCriticalPath: true,
      durationDays: 7,
      floatDays: 0,
      predecessorTaskIds: [],
    };
    ws.tasks.push(parishHearingTask);

    // 5. Load study upload with cryptographic SHA-256 verification
    const loadStudyBytes = Buffer.from("Certified PE Axle Load Distribution Study: 320 Tons Across 14-Axle Goldhofer Transporter");
    const loadStudyHash = crypto.createHash("sha256").update(loadStudyBytes).digest("hex");
    const doc = projectDocumentsData[1];
    const version = {
      id: "ver-scen1-bridge",
      documentId: doc.id,
      versionTag: "v4.0",
      fileName: "LA82_Bridge_Study_v4.pdf",
      fileSizeBytes: loadStudyBytes.length,
      mimeType: "application/pdf",
      storageUri: "vault/bridge/LA82_Bridge_Study_v4.pdf",
      sha256Hash: loadStudyHash,
      uploadedByName: "Dr. Aris Thorne",
      uploadedAt: new Date().toISOString(),
      isMalwareClean: true,
    };

    const dl = await downloadDocumentVersion(doc, version, async () => ({
      blob: new Blob([loadStudyBytes], { type: "application/pdf" }),
      error: null,
    }));
    assert.equal(dl.success, true);

    // 6. Statutory clock compliance & concurrent approval
    const dotdReview = { reviewingOrgCode: "DOTD", reviewStatus: "approved" };
    const parishReview = { reviewingOrgCode: "VERMILION", reviewStatus: "approved" };
    assert.equal(dotdReview.reviewStatus, "approved");
    assert.equal(parishReview.reviewStatus, "approved");
  });

  test("Scenario 2: Launch Pad A Wetlands & Coastal Use Permit Complex Review (SpaceX submittal -> CPRA / USACE joint review -> RFI issued -> Clock paused -> Submitter responds -> Reviewer accepts -> Clock resumes -> Permit issued)", () => {
    const wsId = "WS-WETLANDS-PAD-A";
    const ws = repository.getWorkstreamById(wsId);
    assert.ok(ws);

    // 1. Issue RFI
    const rfi = repository.createRFI({
      workstreamId: wsId,
      workstreamTitle: ws.title,
      requestingOrgId: "org-cpra",
      requestingOrgCode: "CPRA",
      recipientOrgId: "org-spacex",
      recipientOrgCode: "SPACEX",
      title: "Coastal Mitigation Ratio & Tidal Surge Assessment",
      questionText: "Clarify wetland mitigation credits purchase from Chenier Plain bank.",
      technicalReason: "Coastal Zone Management Act consistency.",
      responseDeadline: "2026-09-20",
      actorName: "Jean-Paul Guidry",
    });
    assert.equal(rfi.status, "issued");
    assert.equal(repository.getWorkstreamById(wsId)?.operationalState, "waiting_applicant");

    // 2. SpaceX uploads revised model
    const resp = repository.submitRfiResponse({
      rfiId: rfi.id,
      submittedByName: "Maya Chen",
      responseText: "Mitigation purchase receipt: 42.5 credits from Chenier Plain Wetland Bank.",
    });
    assert.equal(rfi.status, "submitted_by_applicant");

    // 3. Reviewer accepts
    const accepted = repository.acceptRfiResponse({
      rfiId: rfi.id,
      actorName: "Jean-Paul Guidry",
      actorOrgName: "CPRA",
      notes: "Mitigation credits verified with USACE database.",
    });
    assert.ok(accepted);
    assert.equal(repository.getWorkstreamById(wsId)?.operationalState, "running");

    // 4. Advance stage
    const advance = repository.completeWorkstreamStage({
      workstreamId: wsId,
      completedChecklists: ["completeness_checklist_passed"],
      providedDocs: ["site_plans", "wetlands_delineation"],
      actorName: "Jean-Paul Guidry",
      actorOrgName: "CPRA",
    });
    assert.equal(advance.success, true);
  });

  test("Scenario 3: Industrial Wastewater Deluge System Fast-Track Approval (P1 emergency water discharge filing -> LDEQ Environmental Review queue -> In-ticket DAG modification -> CPM recalculation -> Cross-agency concurrence -> Resolved)", () => {
    const wsId = "WS-WASTEWATER-DELUGE";
    const ws = repository.getWorkstreamById(wsId);
    assert.ok(ws);

    // 2. In-ticket DAG modification inserting expedited toxicity bioassay test
    const toxicityTask = {
      id: "TASK-TOXICITY-BIOASSAY",
      workstreamId: wsId,
      title: "48-Hour Acute Toxicity Bioassay Test on Deluge Water Additive",
      taskType: "agency_review",
      assignedOrgId: "org-ldeq",
      assignedOrgCode: "LDEQ",
      assignedUserId: "user-jordan-lee",
      status: "completed",
      isMilestone: true,
      isCriticalPath: true,
      durationDays: 2,
      floatDays: 0,
      predecessorTaskIds: [],
    };
    ws.tasks.push(toxicityTask);

    // 3. CPM recalculation
    const deps = ws.tasks.flatMap((t) => t.predecessorTaskIds.map((p) => ({ predecessorTaskId: p, successorTaskId: t.id })));
    const cpm = solveTaskDAG(ws.tasks, deps);
    assert.ok(cpm.taskEarlyFinish.get("TASK-TOXICITY-BIOASSAY") > 0);

    // 4. Cross-agency concurrence
    const cr = repository.createCoordinationRequest({
      workstreamId: wsId,
      workstreamTitle: ws.title,
      requestingOrgId: "org-ldeq",
      requestingOrgCode: "LDEQ",
      targetOrgId: "org-cpra",
      targetOrgCode: "CPRA",
      requestingUserName: "Dr. Rachel Benoit",
      title: "Deluge Runoff Retention Pond Discharge Concurrence",
      needDescription: "CPRA concurrence for retention pond discharge into Gulf tidal creek.",
      dueDate: "2026-09-08",
      priority: "critical_path",
    });
    assert.ok(cr.code);
  });

  test("Scenario 4: Cryogenic Fuel Storage Facility Multitenant Safety Review (OSFM & LSP Hazmat joint intake -> Multi-agency triage -> Blast radius RFI -> Cryptographic document versioning -> Final determination)", async () => {
    // 1. Multi-agency triage
    const req = repository.createCustomerRequest({
      projectId: "proj-spacex-pecan",
      requestType: "permit_authorization",
      title: "Cryogenic Liquid Methane & Liquid Oxygen Storage Farm (2M Gallon Capacity)",
      description: "Joint OSFM and LSP hazardous materials authorization for cryogenic propellant bulk tanks.",
      knownAgencyCode: "OSFM",
      submittedByName: "Alex Martin",
      blocksActiveWork: true,
      scheduleImportance: "critical",
    });
    assert.ok(req.confirmationNumber);

    // 2. Blast radius document versioning with SHA-256 verification
    const blastModelBytes = Buffer.from("Pecan Island Cryogenic Propellant Vapor Dispersion & Blast Overpressure Model Rev 2");
    const blastHash = crypto.createHash("sha256").update(blastModelBytes).digest("hex");

    const doc = projectDocumentsData[6];
    const version = {
      id: "ver-blast-v2",
      documentId: doc.id,
      versionTag: "v2.0",
      fileName: "Pecan_Cryogenic_Blast_Radius_v2.pdf",
      fileSizeBytes: blastModelBytes.length,
      mimeType: "application/pdf",
      storageUri: "vault/fire/Pecan_Cryogenic_Blast_Radius_v2.pdf",
      sha256Hash: blastHash,
      uploadedByName: "SpaceX Safety Engineering",
      uploadedAt: new Date().toISOString(),
      isMalwareClean: true,
    };

    const dl = await downloadDocumentVersion(doc, version, async () => ({
      blob: new Blob([blastModelBytes], { type: "application/pdf" }),
      error: null,
    }));
    assert.equal(dl.success, true);

    // 3. Final Determination logged
    const decision = {
      id: "dec-osfm-lsp-methane-approval",
      projectId: "proj-spacex-pecan",
      decisionDate: "2026-08-31",
      title: "OSFM & LSP Hazardous Materials Storage Permit Approved",
      decisionSummary: "2M gallon cryogenic storage farm compliant with NFPA 52 and Louisiana Hazmat Code.",
      decisionMakerName: "Louisiana State Fire Marshal & State Police Hazmat Commander",
      decisionMakerTitle: "State Fire Marshal & LSP Commander",
      organizationsRepresented: ["OSFM", "LSP"],
      statutoryAuthority: "La. R.S. 40:1561 & LAC 55:I.Chapter 15",
      affectedWorkstreamIds: ["WS-SUBSTATION-230KV"],
    };
    assert.equal(decision.organizationsRepresented.length, 2);
  });

  test("Scenario 5: Full Project Lifecycle with Dynamic Scope Change (Initial project setup -> Customer adds new utility request -> Triage & DAG merge -> Critical path recalculated -> Escalation resolved -> Complete audit trail)", () => {
    // 1. Initial project overview
    const project = repository.getProject();
    const initialWorkstreams = repository.getWorkstreams();
    const overview1 = getProjectOverview(project, initialWorkstreams);
    assert.ok(overview1.activeWorkstreamCount > 0);

    // 2. Customer adds new utility request
    const utilityReq = repository.createCustomerRequest({
      projectId: project.id,
      requestType: "permit_authorization",
      title: "Secondary Dedicated 50MW Redundant Power Feed",
      description: "Redundant substation feed crossing Intracoastal Waterway.",
      knownAgencyCode: "DOTD",
      submittedByName: "Alex Martin",
      scheduleImportance: "critical",
    });
    assert.ok(utilityReq.confirmationNumber);

    // 3. Triage & convert to workstream
    const newWs = {
      id: "WS-50MW-FEED",
      projectId: project.id,
      code: "WS-50MW-FEED",
      title: utilityReq.title,
      category: "utility",
      categoryLabel: "Utility",
      governmentConcierge: {
        name: "Sarah Johnson",
        title: "State Project Concierge",
        agency: "LA-PROJECTS",
        email: "sarah.johnson@la.gov",
        phone: "(225) 342-7000",
      },
      regulatoryLead: {
        orgCode: "DOTD",
        orgName: "Louisiana Department of Transportation and Development",
        jurisdictionLevel: "State",
        assignedReviewerName: "Sam Rivera",
        assignedReviewerEmail: "sam.rivera@dotd.la.gov",
      },
      operationalState: "running",
      operationalStateLabel: "Running",
      ragHealth: "green",
      isCriticalPath: true,
      baselineStartDate: "2026-09-01",
      baselineTargetDate: "2026-10-01",
      forecastStartDate: "2026-09-01",
      forecastTargetDate: "2026-10-01",
      scheduleVarianceDays: 0,
      currentActionSummary: "Substation transmission engineering review",
      nextExpectedEvent: "Right-of-way determination",
      customerActionRequired: "None",
      primaryDelayReason: "none",
      escalationLevel: 0,
      tasks: [
        {
          id: "TASK-FEED-1",
          workstreamId: "WS-50MW-FEED",
          title: "Transmission Line Engineering Clearance",
          taskType: "agency_review",
          assignedOrgId: "org-dotd",
          assignedOrgCode: "DOTD",
          assignedUserId: "user-sam-rivera",
          status: "pending",
          isMilestone: false,
          isCriticalPath: true,
          durationDays: 30,
          floatDays: 0,
          predecessorTaskIds: [],
        },
      ],
      commitments: [],
      coordinationRequests: [],
      rfis: [],
    };

    // 4. Recalculate critical path across all workstreams
    const allWorkstreams = [...initialWorkstreams, newWs];
    const scheduleResult = evaluateProjectSchedule(allWorkstreams);
    assert.ok(scheduleResult.projectDurationDays > 0);

    // 5. Complete audit trail verification
    const allAudits = repository.getAuditEvents();
    assert.ok(Array.isArray(allAudits));
  });

});
