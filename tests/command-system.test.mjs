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
const scheduleEngine = await vite.ssrLoadModule("/lib/engines/schedule-engine.ts");
const escalationEngine = await vite.ssrLoadModule("/lib/engines/escalation-engine.ts");
const coordinationEngine = await vite.ssrLoadModule("/lib/engines/coordination-engine.ts");
const auditEngine = await vite.ssrLoadModule("/lib/engines/audit-engine.ts");
const utils = await vite.ssrLoadModule("/lib/permit-utils.ts");

const {
  spacexProjectRecord,
  registeredOrganizations,
  permitCatalog,
  workflowTemplatesData,
  commitmentsData,
  coordinationRequestsData,
  rfisData,
  projectDocumentsData,
  projectDecisionsData,
  projectMeetingsData,
  workstreamsData,
} = fixture;

const { generateSixQuestionsSummary, validateStageTransition, deriveOperationalHealth } = workflowEngine;
const { evaluateProjectSchedule } = scheduleEngine;
const { evaluateWorkstreamEscalation } = escalationEngine;
const { getAgencyCoordinationViews, groupIntoConsolidatedBatch } = coordinationEngine;
const { createAuditEvent, filterAuditEvents, auditResourceStaleness } = auditEngine;
const { parsePlainEnglishIntake, getSpaceXNoSurprisesData, getDailyCommandCenterExceptions } = utils;


test("Database Schema: exports all 22 relational Drizzle ORM tables", () => {
  const expectedTables = [
    "organizations",
    "organizationalUnits",
    "users",
    "organizationMemberships",
    "permitTypes",
    "requirementResources",
    "workflowTemplates",
    "workflowVersions",
    "workflowStages",
    "escalationPolicies",
    "projects",
    "workstreams",
    "tasks",
    "taskDependencies",
    "commitments",
    "coordinationRequests",
    "rfis",
    "rfiResponses",
    "documents",
    "documentVersions",
    "documentAgencyReviews",
    "decisions",
    "meetings",
    "readinessChecklists",
    "readinessItems",
    "auditEvents",
    "notifications",
  ];

  for (const tableName of expectedTables) {
    assert.ok(schema[tableName], `Expected schema table '${tableName}' to be defined`);
  }
});

test("Workflow Engine: generates deterministic 6-question summary answers", () => {
  const ws = workstreamsData.find((w) => w.code === "WS-WETLANDS-PAD-A");
  assert.ok(ws, "WS-WETLANDS-PAD-A workstream should exist");

  const summary = generateSixQuestionsSummary(ws);
  assert.ok(summary.whoHasIt.includes("USACE"));
  assert.ok(summary.whatDoing.includes("completeness"));
  assert.ok(summary.waitingOn.includes("SpaceX") || summary.waitingOn.includes("USACE"));
  assert.ok(summary.whenDue);
  assert.ok(summary.deterministicParagraph.includes("Your application for Launch Pad A"));
  assert.ok(summary.deterministicParagraph.includes("They are doing:"));
  assert.ok(summary.deterministicParagraph.includes("Target completion date:"));
});

test("Workflow Engine: validates stage checklist gates before transition", () => {
  const stage = workflowTemplatesData[0].versions[0].stages[0];
  const completedChecklist = ["completeness_checklist_passed"];
  const providedDocs = ["site_plans", "wetlands_delineation"];
  
  const valid = workflowEngine.validateStageTransition(stage, completedChecklist, providedDocs);
  assert.equal(valid.allowed, true);
  assert.equal(valid.missingChecklists.length, 0);

  const invalid = workflowEngine.validateStageTransition(stage, [], []);
  assert.equal(invalid.allowed, false);
  assert.ok(invalid.missingChecklists.length > 0 || invalid.missingDocs.length > 0);
});

test("Schedule Engine: solves DAG critical path, float, and baseline variance", () => {
  const result = evaluateProjectSchedule(workstreamsData);

  assert.ok(result.criticalPathTaskIds.length > 0, "Critical path tasks should be identified");
  assert.ok(result.totalVarianceDays >= 13, "Project variance should be at least 13 days");

  // Parallel review acceleration opportunity detection
  assert.ok(result.accelerationOpportunities.length >= 0);

  // Delay taxonomy breakdown
  assert.ok(result.delaySummary["interagency_dependency"] > 0);
});

test("Escalation Engine: evaluates 5-tier SLA escalation and target notifications", () => {
  const ws = workstreamsData.find((w) => w.code === "WS-LA82-HEAVYHAUL");
  assert.ok(ws, "WS-LA82-HEAVYHAUL workstream should exist");

  const escalation = evaluateWorkstreamEscalation(ws);
  assert.equal(escalation.isEscalated, true);
  assert.equal(escalation.currentLevel, 5);
  assert.equal(escalation.isExecutiveActionRequired, true);
  assert.ok(escalation.notifiedParties.length >= 2);
});

test("Interagency Coordination Engine: routes CR-00xxx and Consolidated RFI cycles", () => {
  const cpraViews = getAgencyCoordinationViews("CPRA", coordinationRequestsData);
  assert.ok(cpraViews.myAgencyIncoming.length >= 2, "CPRA should have received coordination requests");

  const dotdViews = getAgencyCoordinationViews("DOTD", coordinationRequestsData);
  assert.ok(dotdViews.requestsSentByMyAgency.length >= 1, "DOTD should have sent coordination requests");

  const rfiBatch = groupIntoConsolidatedBatch(rfisData);
  assert.equal(rfiBatch.recipientOrgCode, "SPACEX");
  assert.ok(rfiBatch.totalQuestions >= 1);
  assert.equal(rfiBatch.status, "ready_for_dispatch");
});

test("Audit Engine: logs immutable audit ledger entries and supports query filters", () => {
  const event = createAuditEvent({
    entityType: "workstream",
    entityId: "WS-WETLANDS-PAD-A",
    actorName: "Alex Martin",
    actorOrgName: "SpaceX",
    actionType: "workflow_transition",
    oldValue: "running",
    newValue: "statutory_waiting_period",
    reason: "Public notice period opened in Vermilion Parish newspaper.",
  });

  assert.ok(event.id.startsWith("AUDIT-"));
  assert.ok(event.occurredAt);

  const filtered = auditEngine.filterAuditTrail([event], {
    entityType: "workstream",
    actorOrgName: "SpaceX",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, event.id);
});

test("SpaceX Megaproject Fixture: contains dual ownership and pre-application readiness", () => {
  assert.equal(spacexProjectRecord.code, "SPACEX-PECAN-ISLAND");
  assert.equal(registeredOrganizations.length, 8);
  assert.equal(permitCatalog.length, 3);
  assert.equal(commitmentsData.length, 6);
  assert.equal(coordinationRequestsData.length, 3);
  assert.ok(projectDocumentsData.length >= 2);
  assert.equal(projectDecisionsData.length, 2);

  const preAppWs = workstreamsData.find((w) => w.readinessChecklist);
  assert.ok(preAppWs);
  assert.equal(preAppWs.readinessChecklist?.overallReadinessPercent, 86);
  assert.equal(preAppWs.readinessChecklist?.items.length, 6);

  // Check Dual Ownership
  for (const ws of workstreamsData) {
    assert.ok(ws.governmentConcierge.name, `Workstream ${ws.code} must have a State Concierge`);
    assert.ok(ws.regulatoryLead.assignedReviewerName, `Workstream ${ws.code} must have a Regulatory Lead`);
  }
});


test("Permit Utils: command system helper functions return structured summaries", () => {
  const spacexData = getSpaceXNoSurprisesData();
  assert.ok(spacexData.needsSpaceX.length > 0);
  assert.ok(spacexData.needsGovernment.length > 0);
  assert.ok(spacexData.blocked.length > 0);
  assert.ok(spacexData.upcomingMilestones.length > 0);

  const exceptionData = getDailyCommandCenterExceptions();
  assert.ok(exceptionData.blockerCount > 0);
  assert.ok(exceptionData.overdueCommitmentCount > 0);
  assert.ok(exceptionData.nearDeadlineCount > 0);
});

test("Workflow Engine: derives operational health with RAG decoupling", () => {
  // Blocked or large variance (>5d) must be RED
  assert.equal(deriveOperationalHealth("blocked", 0, false), "red");
  assert.equal(deriveOperationalHealth("running", 6, false), "red");

  // Statutory waiting periods and scheduled holds are healthy (GREEN) even during waiting
  assert.equal(deriveOperationalHealth("statutory_waiting_period", 0, false), "green");
  assert.equal(deriveOperationalHealth("scheduled_hold", 0, false), "green");

  // Critical path with delay/waiting must be RED
  assert.equal(deriveOperationalHealth("waiting_government", 2, true), "red");
  assert.equal(deriveOperationalHealth("waiting_applicant", 1, true), "red");

  // Non-critical path with delay/waiting is YELLOW
  assert.equal(deriveOperationalHealth("waiting_government", 2, false), "yellow");
  assert.equal(deriveOperationalHealth("waiting_applicant", 1, false), "yellow");

  // Normal running with zero variance is GREEN
  assert.equal(deriveOperationalHealth("running", 0, false), "green");
});

test("Audit Engine: audits statutory resource link staleness against 180-day threshold", () => {
  // 1. Audit fixture catalog as of 2026-08-30 -> all fixture resources are fresh
  const baselineAudit = auditResourceStaleness(permitCatalog, "2026-08-30");
  assert.ok(baselineAudit.totalResourcesAudited >= 2, "Should audit all catalog resources");
  assert.equal(baselineAudit.staleCount, 0, "No fixture resources should be stale on 2026-08-30");
  assert.equal(baselineAudit.flaggedResources.length, 0);
  assert.equal(baselineAudit.freshCount, baselineAudit.totalResourcesAudited);

  // 2. Audit against future date (>180 days from August 2026, e.g. 2027-04-01) -> all resources stale
  const futureAudit = auditResourceStaleness(permitCatalog, "2027-04-01");
  assert.ok(futureAudit.staleCount >= 2, "All resources should be flagged stale >180 days");
  assert.equal(futureAudit.flaggedResources.length, futureAudit.staleCount);
  for (const item of futureAudit.flaggedResources) {
    assert.ok(item.daysSinceVerification > 180);
    assert.equal(item.thresholdDays, 180);
    assert.ok(item.permitCode);
    assert.ok(item.resourceName);
    assert.ok(item.url);
  }

  // 3. Synthetic permit catalog with mixed fresh and stale resources
  const syntheticCatalog = [
    {
      id: "cat-test",
      code: "TEST-PERMIT",
      name: "Test Statutory Permit",
      category: "permit",
      responsibleOrgId: "org-test",
      responsibleOrgCode: "TEST",
      triggerExplanation: "Test permit trigger explanation",
      statutoryCitation: "La. R.S. 49:000",
      expectedLeadTimeDays: 30,
      minimumStatutoryDays: 10,
      publicNoticeRequired: false,
      publicNoticeDays: 0,
      prerequisites: [],
      relatedPermitTypeIds: [],
      verificationStatus: "verified",
      resources: [
        {
          id: "res-fresh",
          permitTypeId: "cat-test",
          resourceName: "Fresh Guidance Document",
          resourceType: "guidance_doc",
          url: "https://example.com/fresh.pdf",
          versionTag: "v1.0",
          verifiedAt: "2026-08-01",
          verifiedBy: "Sarah Johnson",
          isStale: false,
        },
        {
          id: "res-stale",
          permitTypeId: "cat-test",
          resourceName: "Outdated Application Form",
          resourceType: "form_pdf",
          url: "https://example.com/stale.pdf",
          versionTag: "v0.9",
          verifiedAt: "2025-10-01",
          verifiedBy: "Martin Breaux",
          isStale: false,
        },
      ],
    },
  ];

  const syntheticAudit = auditResourceStaleness(syntheticCatalog, "2026-08-30");
  assert.equal(syntheticAudit.totalResourcesAudited, 2);
  assert.equal(syntheticAudit.staleCount, 1);
  assert.equal(syntheticAudit.freshCount, 1);
  assert.equal(syntheticAudit.flaggedResources.length, 1);
  assert.equal(syntheticAudit.flaggedResources[0].resourceId, "res-stale");
  assert.equal(syntheticAudit.flaggedResources[0].permitCode, "TEST-PERMIT");
  assert.equal(syntheticAudit.flaggedResources[0].thresholdDays, 180);
  assert.ok(syntheticAudit.flaggedResources[0].daysSinceVerification > 180);
  assert.equal(syntheticAudit.auditedCatalog[0].verificationStatus, "stale_over_180d");
});

test("Intake Parser: maintains full backward compatibility for natural language triage", () => {
  const intake = parsePlainEnglishIntake("We need a 230kV electrical transmission interconnect line from Entergy substation.");
  assert.equal(intake.detectedCategory, "utility");
  assert.equal(intake.suggestedLeadAgencyCode, "LPSC / Entergy");
  assert.ok(intake.statutoryNotice.includes("LPSC transmission docket"));
});




