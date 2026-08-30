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

const schema = await vite.ssrLoadModule("/db/schema.ts");
const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const workflowEngine = await vite.ssrLoadModule("/lib/engines/workflow-engine.ts");
const auditEngine = await vite.ssrLoadModule("/lib/engines/audit-engine.ts");

const {
  generateSixQuestionsSummary,
  validateStageTransition,
  deriveOperationalHealth,
} = workflowEngine;

const {
  createAuditEvent,
  filterAuditTrail,
  filterAuditEvents,
  auditResourceStaleness,
} = auditEngine;

// =========================================================================
// SECTION 1: ADVERSARIAL FUZZING OF WORKFLOW ENGINE
// =========================================================================

test("Workflow Engine [Fuzz]: validateStageTransition with duplicate items, whitespace, and special characters", () => {
  const stage = {
    id: "stage-fuzz",
    workflowVersionId: "wv-fuzz",
    stageKey: "complex_gate",
    name: "Complex Gate Stage",
    customerVisibilityLabel: "Complex Gate",
    sequenceOrder: 1,
    responsibleOrgId: "org-fuzz",
    responsibleOrgCode: "LDEQ",
    targetDurationDays: 14,
    minimumStatutoryDays: 7,
    requiredInputs: ["input/special*item#1", "input_2", "input_3"],
    completionRequirements: ["req/special*check#1", "req_2"],
    permittedTransitions: ["next"],
    canRunInParallel: false,
    isMilestoneGate: false,
  };

  // Duplicates in completed checklist items
  const r1 = validateStageTransition(
    stage,
    ["req/special*check#1", "req/special*check#1", "req_2", "req_2"],
    ["input/special*item#1", "input_2", "input_3", "input_3"]
  );
  assert.equal(r1.allowed, true);
  assert.equal(r1.missingChecklists.length, 0);
  assert.equal(r1.missingDocs.length, 0);

  // Case sensitivity: requirements are case-sensitive
  const r2 = validateStageTransition(
    stage,
    ["REQ/SPECIAL*CHECK#1", "REQ_2"], // uppercase
    ["INPUT/SPECIAL*ITEM#1", "INPUT_2", "INPUT_3"]
  );
  assert.equal(r2.allowed, false);
  assert.equal(r2.missingChecklists.length, 2);
  assert.equal(r2.missingDocs.length, 3);
});

test("Workflow Engine [Fuzz]: 6-Question Narrative Structure Invariants on Fuzzed Workstreams", () => {
  // Generate 100 pseudo-random workstream configurations
  for (let i = 0; i < 100; i++) {
    const ws = {
      id: `ws-fuzz-${i}`,
      projectId: "proj-spacex",
      code: `WS-FUZZ-${i}`,
      title: `Fuzzed Workstream #${i}`,
      category: "permit",
      categoryLabel: "Fuzzed Category",
      currentStageName: i % 2 === 0 ? `Stage ${i}` : undefined,
      governmentConcierge: {
        name: `Concierge ${i}`,
        title: "State Lead",
        agency: "LED",
        email: `concierge${i}@la.gov`,
        phone: "555-0000",
      },
      regulatoryLead: {
        orgCode: `ORG_${i % 5}`,
        orgName: `Organization Number ${i % 5}`,
        jurisdictionLevel: "State",
        assignedReviewerName: `Reviewer ${i}`,
        assignedReviewerEmail: `reviewer${i}@state.la.gov`,
      },
      operationalState: i % 3 === 0 ? "waiting_applicant" : i % 3 === 1 ? "statutory_waiting_period" : "running",
      operationalStateLabel: "Running",
      ragHealth: "green",
      isCriticalPath: i % 2 === 0,
      baselineStartDate: "2026-08-01",
      baselineTargetDate: "2026-09-01",
      forecastStartDate: "2026-08-01",
      forecastTargetDate: "2026-09-10",
      scheduleVarianceDays: (i % 15) - 5, // -5 to +9
      currentActionSummary: `Action description ${i}`,
      waitingReason: i % 4 === 0 ? `Waiting reason ${i}` : undefined,
      waitingOnEntity: i % 4 === 0 ? `Entity ${i}` : undefined,
      nextExpectedEvent: `Event milestone ${i}`,
      customerActionRequired: i % 3 === 0 ? `Please upload document ${i}` : undefined,
      primaryDelayReason: "none",
      escalationLevel: (i % 6),
      tasks: [],
      commitments: [],
      coordinationRequests: [],
      rfis: [],
    };

    const summary = generateSixQuestionsSummary(ws);

    // Invariant: Non-empty outputs
    assert.ok(summary.whoHasIt.length > 0);
    assert.ok(summary.whatDoing.length > 0);
    assert.ok(summary.waitingFor.length > 0);
    assert.ok(summary.waitingOn.length > 0);
    assert.ok(summary.whenDue.length > 0);
    assert.ok(summary.missedConsequence.length > 0);
    assert.ok(summary.deterministicParagraph.length > 0);

    // Invariant: If critical path, missedConsequence includes "critical path"
    if (ws.isCriticalPath) {
      assert.ok(summary.missedConsequence.includes("critical path"));
    } else {
      assert.ok(summary.missedConsequence.includes("float buffer"));
    }

    // Invariant: Concierge email in narrative
    assert.ok(summary.deterministicParagraph.includes(ws.governmentConcierge.email));
  }
});

// =========================================================================
// SECTION 2: ADVERSARIAL FUZZING OF AUDIT ENGINE
// =========================================================================

test("Audit Engine [Fuzz]: filterAuditTrail with regex metacharacters in searchTerm", () => {
  const events = [
    {
      id: "ev-1",
      entityType: "workstream",
      entityId: "ws-1",
      actorName: "John (Smith) [Admin]",
      actorOrgName: "DOTD",
      actionType: "status_changed",
      oldValue: "val.1",
      newValue: "val+2",
      reason: "Updated with regex symbols: ^.*$[a-z]?",
      sourceChannel: "web_app",
      occurredAt: new Date().toISOString(),
    },
    {
      id: "ev-2",
      entityType: "workstream",
      entityId: "ws-2",
      actorName: "Regular User",
      actorOrgName: "LDEQ",
      actionType: "normal_action",
      oldValue: "a",
      newValue: "b",
      reason: "Nothing special",
      sourceChannel: "web_app",
      occurredAt: new Date().toISOString(),
    },
  ];

  // Search with regex characters: '(' '[' '*' '?' '^' '$'
  const rParen = filterAuditTrail(events, { searchTerm: "(smith)" });
  assert.equal(rParen.length, 1);
  assert.equal(rParen[0].id, "ev-1");

  const rBracket = filterAuditTrail(events, { searchTerm: "[admin]" });
  assert.equal(rBracket.length, 1);
  assert.equal(rBracket[0].id, "ev-1");

  const rSymbols = filterAuditTrail(events, { searchTerm: "^.*$" });
  assert.equal(rSymbols.length, 1);
  assert.equal(rSymbols[0].id, "ev-1");

  const rPlus = filterAuditTrail(events, { searchTerm: "val+2" });
  assert.equal(rPlus.length, 1);
  assert.equal(rPlus[0].id, "ev-1");
});

test("Audit Engine [Fuzz]: auditResourceStaleness with large scale and missing nested arrays", () => {
  // Permit with undefined resources
  const permitNoRes = {
    id: "p-no-res",
    code: "NO-RES",
    name: "Permit Without Resources Field",
    category: "permit",
    responsibleOrgId: "org-1",
    responsibleOrgCode: "LDEQ",
    triggerExplanation: "Testing missing resources field",
    statutoryCitation: "La. R.S. 30:2001",
    expectedLeadTimeDays: 30,
    minimumStatutoryDays: 0,
    publicNoticeRequired: false,
    publicNoticeDays: 0,
    prerequisites: [],
    relatedPermitTypeIds: [],
    verificationStatus: "verified",
    lastVerifiedAt: "2025-01-01", // > 180 days ago
    // resources field omitted
  };

  // Permit with 500 fresh resources
  const freshResources = Array.from({ length: 500 }, (_, idx) => ({
    id: `res-fresh-${idx}`,
    permitTypeId: "p-large",
    resourceName: `Resource #${idx}`,
    resourceType: "form_pdf",
    url: `https://example.com/res/${idx}`,
    versionTag: "v1.0",
    verifiedAt: "2026-08-20",
    verifiedBy: "Auditor",
    isStale: false,
  }));

  const permitLarge = {
    id: "p-large",
    code: "LARGE-PERMIT",
    name: "Large Permit With 500 Resources",
    category: "permit",
    responsibleOrgId: "org-1",
    responsibleOrgCode: "LDEQ",
    triggerExplanation: "Testing large resources count",
    statutoryCitation: "La. R.S. 30:2001",
    expectedLeadTimeDays: 30,
    minimumStatutoryDays: 0,
    publicNoticeRequired: false,
    publicNoticeDays: 0,
    prerequisites: [],
    relatedPermitTypeIds: [],
    verificationStatus: "verified",
    lastVerifiedAt: "2026-08-20",
    resources: freshResources,
  };

  const report = auditResourceStaleness([permitNoRes, permitLarge], "2026-08-30");

  assert.equal(report.totalPermitsAudited, 2);
  assert.equal(report.totalResourcesAudited, 500);
  assert.equal(report.staleCount, 0);
  assert.equal(report.freshCount, 500);
  // permitNoRes has lastVerifiedAt in 2025 (>180d), so its permit status becomes stale_over_180d
  assert.equal(report.auditedCatalog[0].verificationStatus, "stale_over_180d");
  assert.equal(report.auditedCatalog[1].verificationStatus, "verified");
});

// =========================================================================
// SECTION 3: DRIZZLE SCHEMA FOREIGN KEY & CONSTRAINT VALIDATION
// =========================================================================

test("Database Schema [Fuzz]: Verify Drizzle Table Foreign Keys and Modes", () => {
  // Check that all tables have table name configured
  const tableNames = Object.keys(schema).filter((k) => schema[k] && typeof schema[k] === "object" && schema[k].id);
  assert.ok(tableNames.length >= 27, `Found ${tableNames.length} tables, expected at least 27`);

  // Verify all foreign key reference definitions exist without throwing
  assert.ok(schema.organizationalUnits.organizationId);
  assert.ok(schema.users.organizationId);
  assert.ok(schema.organizationMemberships.userId);
  assert.ok(schema.organizationMemberships.organizationId);
  assert.ok(schema.permitTypes.responsibleOrgId);
  assert.ok(schema.requirementResources.permitTypeId);
  assert.ok(schema.workflowTemplates.permitTypeId);
  assert.ok(schema.workflowVersions.templateId);
  assert.ok(schema.workflowStages.workflowVersionId);
  assert.ok(schema.workflowStages.responsibleOrgId);
  assert.ok(schema.escalationPolicies.organizationId);
  assert.ok(schema.projects.applicantOrgId);
  assert.ok(schema.projects.leadStateAgencyId);
  assert.ok(schema.workstreams.projectId);
  assert.ok(schema.workstreams.regulatoryLeadOrgId);
  assert.ok(schema.tasks.workstreamId);
  assert.ok(schema.tasks.assignedOrgId);
  assert.ok(schema.taskDependencies.predecessorTaskId);
  assert.ok(schema.taskDependencies.successorTaskId);
  assert.ok(schema.commitments.workstreamId);
  assert.ok(schema.commitments.committingOrgId);
  assert.ok(schema.coordinationRequests.workstreamId);
  assert.ok(schema.coordinationRequests.requestingOrgId);
  assert.ok(schema.coordinationRequests.targetOrgId);
  assert.ok(schema.rfis.workstreamId);
  assert.ok(schema.rfis.requestingOrgId);
  assert.ok(schema.rfis.recipientOrgId);
  assert.ok(schema.rfiResponses.rfiId);
  assert.ok(schema.documents.projectId);
  assert.ok(schema.documents.ownerOrgId);
  assert.ok(schema.documentVersions.documentId);
  assert.ok(schema.documentAgencyReviews.documentVersionId);
  assert.ok(schema.documentAgencyReviews.workstreamId);
  assert.ok(schema.documentAgencyReviews.reviewingOrgId);
  assert.ok(schema.decisions.projectId);
  assert.ok(schema.meetings.projectId);
  assert.ok(schema.readinessChecklists.workstreamId);
  assert.ok(schema.readinessItems.checklistId);
  assert.ok(schema.auditEvents.entityType);
  assert.ok(schema.notifications.title);
});
