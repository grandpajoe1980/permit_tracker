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
// SECTION 1: WORKFLOW ENGINE EMPIRICAL STRESS TESTS
// =========================================================================

test("Workflow Engine [Stress]: 6-Question Generator across all 10 Operational States", () => {
  const states = [
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

  const baseWorkstream = {
    id: "ws-stress-test",
    projectId: "proj-1",
    code: "WS-TEST",
    title: "Test Coastal Launch Pad Review",
    category: "permit",
    categoryLabel: "Environmental Permit",
    currentStageName: "Hydrology Review",
    governmentConcierge: {
      name: "Marcus Vance",
      title: "State Project Manager",
      agency: "Louisiana LED FastStart",
      email: "mvance@la.gov",
      phone: "(225) 555-0100",
    },
    regulatoryLead: {
      orgCode: "LDEQ",
      orgName: "Louisiana Department of Environmental Quality",
      jurisdictionLevel: "State",
      assignedReviewerName: "Dr. Evelyn Thibodeaux",
      assignedReviewerEmail: "evelyn.thibodeaux@la.gov",
    },
    operationalState: "running",
    operationalStateLabel: "Running",
    ragHealth: "green",
    isCriticalPath: false,
    baselineStartDate: "2026-08-01",
    baselineTargetDate: "2026-09-15",
    forecastStartDate: "2026-08-01",
    forecastTargetDate: "2026-09-15",
    scheduleVarianceDays: 0,
    currentActionSummary: "Reviewing storm surge barrier simulations",
    waitingReason: "Awaiting applicant soil samples",
    waitingOnEntity: "SpaceX Geo Team",
    nextExpectedEvent: "Hydrology Model Approval",
    customerActionRequired: "Submit updated soil survey",
    primaryDelayReason: "none",
    escalationLevel: 0,
    tasks: [],
    commitments: [],
    coordinationRequests: [],
    rfis: [],
  };

  for (const state of states) {
    const ws = { ...baseWorkstream, operationalState: state };
    const summary = generateSixQuestionsSummary(ws);

    // Invariant 1: All 7 SixQuestionsSummary fields must be non-empty strings
    assert.ok(summary.whoHasIt, `whoHasIt must be defined for state ${state}`);
    assert.ok(summary.whatDoing, `whatDoing must be defined for state ${state}`);
    assert.ok(summary.waitingFor, `waitingFor must be defined for state ${state}`);
    assert.ok(summary.waitingOn, `waitingOn must be defined for state ${state}`);
    assert.ok(summary.whenDue, `whenDue must be defined for state ${state}`);
    assert.ok(summary.missedConsequence, `missedConsequence must be defined for state ${state}`);
    assert.ok(summary.deterministicParagraph, `deterministicParagraph must be defined for state ${state}`);

    // Invariant 2: whoHasIt includes org name, org code, and reviewer
    assert.ok(summary.whoHasIt.includes("Louisiana Department of Environmental Quality"));
    assert.ok(summary.whoHasIt.includes("LDEQ"));
    assert.ok(summary.whoHasIt.includes("Dr. Evelyn Thibodeaux"));

    // Invariant 3: deterministicParagraph incorporates state-specific action clauses
    if (state === "waiting_applicant") {
      assert.ok(
        summary.deterministicParagraph.includes("Action required from SpaceX: Submit updated soil survey."),
        `Expected SpaceX action clause in paragraph for state ${state}`
      );
    } else if (state === "statutory_waiting_period") {
      assert.ok(
        summary.deterministicParagraph.includes("Mandatory statutory public notice period in progress. No additional applicant action required."),
        `Expected statutory waiting notice in paragraph for state ${state}`
      );
    } else {
      assert.ok(
        summary.deterministicParagraph.includes("No action is currently required from SpaceX."),
        `Expected default no-action clause for state ${state}`
      );
    }

    // Invariant 4: Concierge and Lead Agency details in narrative
    assert.ok(summary.deterministicParagraph.includes("Marcus Vance"));
    assert.ok(summary.deterministicParagraph.includes("mvance@la.gov"));
    assert.ok(summary.deterministicParagraph.includes("Hydrology Review"));
    assert.ok(summary.deterministicParagraph.includes("Reviewing storm surge barrier simulations"));
  }
});

test("Workflow Engine [Stress]: 6-Question Generator Critical Path & Delay Variations", () => {
  const baseWorkstream = {
    id: "ws-cp-stress",
    projectId: "proj-1",
    code: "WS-CP-TEST",
    title: "Launch Pad Heavy Haul Corridor",
    category: "road",
    categoryLabel: "DOTD Heavy Haul",
    currentStageName: "Structural Load Evaluation",
    governmentConcierge: {
      name: "Jean Boudreaux",
      title: "State Project Manager",
      agency: "DOTD",
      email: "jboudreaux@la.gov",
      phone: "(225) 555-0199",
    },
    regulatoryLead: {
      orgCode: "DOTD",
      orgName: "Louisiana Department of Transportation and Development",
      jurisdictionLevel: "State",
      assignedReviewerName: "Mark Landry",
      assignedReviewerEmail: "mlandry@la.gov",
    },
    operationalState: "blocked",
    operationalStateLabel: "Blocked",
    ragHealth: "red",
    isCriticalPath: true,
    baselineStartDate: "2026-08-01",
    baselineTargetDate: "2026-09-01",
    forecastStartDate: "2026-08-01",
    forecastTargetDate: "2026-09-14",
    scheduleVarianceDays: 13,
    currentActionSummary: "Bridge girder rating analysis",
    waitingReason: "Waiting for CPRA coastal concurrence",
    waitingOnEntity: "CPRA",
    nextExpectedEvent: "Bridge Concurrence Determination",
    customerActionRequired: "None",
    primaryDelayReason: "interagency_dependency",
    escalationLevel: 5,
    tasks: [],
    commitments: [],
    coordinationRequests: [],
    rfis: [],
  };

  // Case A: Critical path with +13 days variance
  const cpSummary = generateSixQuestionsSummary(baseWorkstream);
  assert.ok(
    cpSummary.missedConsequence.includes("Direct impact: Launch complex critical path slips by 13 day(s)"),
    `Critical path consequence must show exact slip days: ${cpSummary.missedConsequence}`
  );

  // Case B: Critical path with 0 days variance -> defaults to at least 1 day slip notice
  const zeroVarWs = { ...baseWorkstream, scheduleVarianceDays: 0 };
  const zeroVarSummary = generateSixQuestionsSummary(zeroVarWs);
  assert.ok(
    zeroVarSummary.missedConsequence.includes("Direct impact: Launch complex critical path slips by 1 day(s)"),
    `Zero variance on critical path should default to 1 day slip: ${zeroVarSummary.missedConsequence}`
  );

  // Case C: Non-critical path -> float buffer absorption
  const nonCpWs = { ...baseWorkstream, isCriticalPath: false, scheduleVarianceDays: 13 };
  const nonCpSummary = generateSixQuestionsSummary(nonCpWs);
  assert.equal(
    nonCpSummary.missedConsequence,
    "Absorbed by project schedule float buffer"
  );

  // Case D: Fallback for missing forecast date (uses baselineTargetDate)
  const noForecastWs = { ...baseWorkstream, forecastTargetDate: undefined };
  const noForecastSummary = generateSixQuestionsSummary(noForecastWs);
  assert.equal(noForecastSummary.whenDue, "2026-09-01");
  const expectedFormattedDate = new Date("2026-09-01").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  assert.ok(
    noForecastSummary.deterministicParagraph.includes(expectedFormattedDate),
    `Paragraph should include formatted date '${expectedFormattedDate}'`
  );

  // Case E: Fallback for missing action summary, waiting reason, and waiting entity
  const missingFieldsWs = {
    ...baseWorkstream,
    currentActionSummary: "",
    waitingReason: "",
    waitingOnEntity: "",
    operationalState: "waiting_applicant",
    customerActionRequired: "",
  };
  const missingFieldsSummary = generateSixQuestionsSummary(missingFieldsWs);
  assert.equal(missingFieldsSummary.whatDoing, "Technical review and statutory verification");
  assert.equal(missingFieldsSummary.waitingFor, "Internal agency engineering assessment");
  assert.equal(missingFieldsSummary.waitingOn, "SpaceX");
  assert.ok(
    missingFieldsSummary.deterministicParagraph.includes("Action required from SpaceX: Submit requested documentation.")
  );
});

test("Workflow Engine [Stress]: Stage Checklist Gate Validator Combinations", () => {
  const stage = {
    id: "stage-test-1",
    workflowVersionId: "wv-1",
    stageKey: "technical_review",
    name: "Technical Review Stage",
    customerVisibilityLabel: "Technical Review",
    sequenceOrder: 2,
    responsibleOrgId: "org-1",
    responsibleOrgCode: "USACE",
    targetDurationDays: 30,
    minimumStatutoryDays: 15,
    requiredInputs: ["wetland_delineation", "stormwater_model", "site_survey_dwg"],
    completionRequirements: ["engineer_signoff", "environmental_impact_passed", "agency_qa_approved"],
    permittedTransitions: ["public_notice", "rfi", "reject"],
    canRunInParallel: false,
    isMilestoneGate: true,
  };

  // Test 1: Complete satisfaction
  const r1 = validateStageTransition(
    stage,
    ["engineer_signoff", "environmental_impact_passed", "agency_qa_approved"],
    ["wetland_delineation", "stormwater_model", "site_survey_dwg"]
  );
  assert.equal(r1.allowed, true);
  assert.equal(r1.missingChecklists.length, 0);
  assert.equal(r1.missingDocs.length, 0);
  assert.equal(r1.reasons.length, 0);

  // Test 2: Superset inputs (extra checklist & extra docs)
  const r2 = validateStageTransition(
    stage,
    ["engineer_signoff", "environmental_impact_passed", "agency_qa_approved", "extra_check_1", "extra_check_2"],
    ["wetland_delineation", "stormwater_model", "site_survey_dwg", "extra_pdf_1"]
  );
  assert.equal(r2.allowed, true);
  assert.equal(r2.missingChecklists.length, 0);
  assert.equal(r2.missingDocs.length, 0);

  // Test 3: Missing only checklist items
  const r3 = validateStageTransition(
    stage,
    ["engineer_signoff"], // missing environmental_impact_passed, agency_qa_approved
    ["wetland_delineation", "stormwater_model", "site_survey_dwg"]
  );
  assert.equal(r3.allowed, false);
  assert.deepEqual(r3.missingChecklists, ["environmental_impact_passed", "agency_qa_approved"]);
  assert.equal(r3.missingDocs.length, 0);
  assert.equal(r3.reasons.length, 1);
  assert.ok(r3.reasons[0].includes("Unfulfilled checklist gates: environmental_impact_passed, agency_qa_approved"));

  // Test 4: Missing only required document inputs
  const r4 = validateStageTransition(
    stage,
    ["engineer_signoff", "environmental_impact_passed", "agency_qa_approved"],
    ["wetland_delineation"] // missing stormwater_model, site_survey_dwg
  );
  assert.equal(r4.allowed, false);
  assert.equal(r4.missingChecklists.length, 0);
  assert.deepEqual(r4.missingDocs, ["stormwater_model", "site_survey_dwg"]);
  assert.equal(r4.reasons.length, 1);
  assert.ok(r4.reasons[0].includes("Missing required document inputs: stormwater_model, site_survey_dwg"));

  // Test 5: Completely empty inputs
  const r5 = validateStageTransition(stage, [], []);
  assert.equal(r5.allowed, false);
  assert.equal(r5.missingChecklists.length, 3);
  assert.equal(r5.missingDocs.length, 3);
  assert.equal(r5.reasons.length, 2);

  // Test 6: Stage with empty requirements (auto-pass gate)
  const emptyStage = {
    ...stage,
    requiredInputs: [],
    completionRequirements: [],
  };
  const r6 = validateStageTransition(emptyStage, [], []);
  assert.equal(r6.allowed, true);
  assert.equal(r6.missingChecklists.length, 0);
  assert.equal(r6.missingDocs.length, 0);
  assert.equal(r6.reasons.length, 0);
});

test("Workflow Engine [Stress]: RAG Decoupling & Operational Health Matrix", () => {
  // Test exhaustively all combinations
  const testMatrix = [
    // [state, varianceDays, isCriticalPath, expectedHealth]
    ["blocked", 0, false, "red"],
    ["blocked", 0, true, "red"],
    ["blocked", 10, true, "red"],
    ["running", 6, false, "red"],
    ["running", 6, true, "red"],
    ["running", 100, false, "red"],
    ["statutory_waiting_period", 0, false, "green"],
    ["statutory_waiting_period", 0, true, "green"],
    ["statutory_waiting_period", 5, false, "green"],
    ["statutory_waiting_period", 6, false, "red"], // variance > 5 triggers red
    ["scheduled_hold", 0, false, "green"],
    ["scheduled_hold", 0, true, "green"],
    ["waiting_applicant", 0, false, "yellow"],
    ["waiting_applicant", 0, true, "red"],
    ["waiting_government", 0, false, "yellow"],
    ["waiting_government", 0, true, "red"],
    ["waiting_government", 3, false, "yellow"],
    ["waiting_government", 3, true, "red"],
    ["running", 3, false, "yellow"],
    ["running", 3, true, "red"],
    ["running", 0, false, "green"],
    ["running", 0, true, "green"],
    ["complete", 0, false, "green"],
    ["cancelled", 0, false, "green"],
  ];

  for (const [state, varianceDays, isCriticalPath, expected] of testMatrix) {
    const health = deriveOperationalHealth(state, varianceDays, isCriticalPath);
    assert.equal(
      health,
      expected,
      `deriveOperationalHealth(${state}, ${varianceDays}, ${isCriticalPath}) should return ${expected}, got ${health}`
    );
  }
});

// =========================================================================
// SECTION 2: AUDIT ENGINE EMPIRICAL STRESS TESTS
// =========================================================================

test("Audit Engine [Stress]: Immutable Ledger Generation & Uniqueness (1,000 Events)", () => {
  const generatedIds = new Set();
  const events = [];

  for (let i = 0; i < 1000; i++) {
    const event = createAuditEvent({
      entityType: i % 2 === 0 ? "workstream" : "commitment",
      entityId: `ENTITY-${i}`,
      actorName: `Reviewer ${i % 10}`,
      actorOrgName: i % 3 === 0 ? "DOTD" : i % 3 === 1 ? "LDEQ" : "SpaceX",
      actionType: i % 4 === 0 ? "status_changed" : i % 4 === 1 ? "rfi_issued" : "commitment_made",
      oldValue: `old-${i}`,
      newValue: `new-${i}`,
      reason: `Automated test action reason #${i}`,
      sourceChannel: i % 2 === 0 ? "api" : undefined, // tests default fallback
    });

    assert.ok(event.id.startsWith("AUDIT-"), `ID must start with AUDIT-: ${event.id}`);
    assert.ok(!generatedIds.has(event.id), `Duplicate ID detected: ${event.id}`);
    generatedIds.add(event.id);

    // Verify timestamp validity
    const parsedTime = Date.parse(event.occurredAt);
    assert.ok(!isNaN(parsedTime), `occurredAt must be a valid ISO string: ${event.occurredAt}`);

    // Verify source channel default
    if (i % 2 === 1) {
      assert.equal(event.sourceChannel, "web_app", "Default source channel must be web_app");
    } else {
      assert.equal(event.sourceChannel, "api");
    }

    events.push(event);
  }

  assert.equal(events.length, 1000);
  assert.equal(generatedIds.size, 1000);
});

test("Audit Engine [Stress]: Multi-Dimension Query Filters", () => {
  // Build a test set of 200 diverse events
  const events = [];
  for (let i = 0; i < 200; i++) {
    events.push({
      id: `AUDIT-${i}`,
      entityType: i < 100 ? "workstream" : "commitment",
      entityId: `E-${i}`,
      actorName: i % 2 === 0 ? "Alice Dupont" : "Bob Guidry",
      actorOrgName: i % 4 === 0 ? "DOTD" : i % 4 === 1 ? "CPRA" : i % 4 === 2 ? "LDEQ" : "SpaceX",
      actionType: i % 5 === 0 ? "escalation_triggered" : "document_uploaded",
      oldValue: "val-old",
      newValue: i % 10 === 0 ? "CRITICAL_STATE" : "NORMAL_STATE",
      reason: i === 42 ? "Special unique anomaly investigation" : "Routine step",
      sourceChannel: "web_app",
      occurredAt: new Date(Date.now() - i * 10000).toISOString(),
    });
  }

  // Filter 1: Empty / undefined query
  assert.equal(filterAuditTrail(events).length, 200);
  assert.equal(filterAuditEvents(events, {}).length, 200);

  // Filter 2: entityType
  const wsEvents = filterAuditTrail(events, { entityType: "workstream" });
  assert.equal(wsEvents.length, 100);
  assert.ok(wsEvents.every((e) => e.entityType === "workstream"));

  // Filter 3: entityId exact match
  const singleEvent = filterAuditTrail(events, { entityId: "E-42" });
  assert.equal(singleEvent.length, 1);
  assert.equal(singleEvent[0].id, "AUDIT-42");

  // Filter 4: actorOrgName
  const cpraEvents = filterAuditTrail(events, { actorOrgName: "CPRA" });
  assert.equal(cpraEvents.length, 50); // 200 / 4
  assert.ok(cpraEvents.every((e) => e.actorOrgName === "CPRA"));

  // Filter 5: Search term on actorName
  const aliceEvents = filterAuditTrail(events, { searchTerm: "alice" });
  assert.equal(aliceEvents.length, 100);

  // Filter 6: Search term on reason
  const uniqueAnomaly = filterAuditTrail(events, { searchTerm: "anomaly" });
  assert.equal(uniqueAnomaly.length, 1);
  assert.equal(uniqueAnomaly[0].id, "AUDIT-42");

  // Filter 7: Search term on newValue
  const criticalEvents = filterAuditTrail(events, { searchTerm: "critical_state" });
  assert.equal(criticalEvents.length, 20); // i % 10 === 0 for 200 items

  // Filter 8: Compound filter (entityType + actorOrgName + searchTerm)
  const compound = filterAuditTrail(events, {
    entityType: "workstream",
    actorOrgName: "DOTD",
    searchTerm: "Alice",
  });
  assert.ok(compound.length > 0);
  assert.ok(compound.every((e) => e.entityType === "workstream" && e.actorOrgName === "DOTD" && e.actorName.includes("Alice")));

  // Filter 9: Non-matching search term
  const noMatches = filterAuditTrail(events, { searchTerm: "NON_EXISTENT_QUERY_XYZ" });
  assert.equal(noMatches.length, 0);
});

test("Audit Engine [Stress]: 180-Day Resource Link Staleness Boundary Conditions", () => {
  const refDateStr = "2026-08-30T12:00:00Z";
  const refDate = new Date(refDateStr);

  const daysAgo = (d) => {
    const dt = new Date(refDate.getTime() - d * 24 * 60 * 60 * 1000);
    return dt.toISOString().split("T")[0];
  };

  const daysFuture = (d) => {
    const dt = new Date(refDate.getTime() + d * 24 * 60 * 60 * 1000);
    return dt.toISOString().split("T")[0];
  };

  const syntheticCatalog = [
    {
      id: "cat-boundary-test",
      code: "PERMIT-BOUNDARY",
      name: "Boundary Stress Permit",
      category: "permit",
      responsibleOrgId: "org-1",
      responsibleOrgCode: "LDEQ",
      triggerExplanation: "Testing boundary conditions",
      statutoryCitation: "La. R.S. 30:2001",
      expectedLeadTimeDays: 45,
      minimumStatutoryDays: 15,
      publicNoticeRequired: true,
      publicNoticeDays: 30,
      prerequisites: [],
      relatedPermitTypeIds: [],
      verificationStatus: "verified",
      resources: [
        // 0 days ago -> fresh
        {
          id: "r-0d",
          permitTypeId: "cat-boundary-test",
          resourceName: "Today Verified Resource",
          resourceType: "form_pdf",
          url: "https://example.com/0d.pdf",
          versionTag: "v1",
          verifiedAt: daysAgo(0),
          verifiedBy: "Tester",
          isStale: false,
        },
        // 120 days ago -> fresh (not due yet)
        {
          id: "r-120d",
          permitTypeId: "cat-boundary-test",
          resourceName: "120d Resource",
          resourceType: "guidance_doc",
          url: "https://example.com/120d.pdf",
          versionTag: "v1",
          verifiedAt: daysAgo(120),
          verifiedBy: "Tester",
          isStale: false,
        },
        // 121 days ago -> fresh, but triggers verification_due on permit
        {
          id: "r-121d",
          permitTypeId: "cat-boundary-test",
          resourceName: "121d Resource",
          resourceType: "guidance_doc",
          url: "https://example.com/121d.pdf",
          versionTag: "v1",
          verifiedAt: daysAgo(121),
          verifiedBy: "Tester",
          isStale: false,
        },
        // 180 days ago -> exact boundary, NOT stale (threshold is > 180)
        {
          id: "r-180d",
          permitTypeId: "cat-boundary-test",
          resourceName: "180d Exact Boundary Resource",
          resourceType: "portal_url",
          url: "https://example.com/180d.html",
          versionTag: "v1",
          verifiedAt: daysAgo(180),
          verifiedBy: "Tester",
          isStale: false,
        },
        // 181 days ago -> strictly STALE
        {
          id: "r-181d",
          permitTypeId: "cat-boundary-test",
          resourceName: "181d Stale Resource",
          resourceType: "checklist",
          url: "https://example.com/181d.pdf",
          versionTag: "v1",
          verifiedAt: daysAgo(181),
          verifiedBy: "Tester",
          isStale: false,
        },
        // 500 days ago -> deeply STALE
        {
          id: "r-500d",
          permitTypeId: "cat-boundary-test",
          resourceName: "500d Stale Resource",
          resourceType: "statute_link",
          url: "https://example.com/500d.html",
          versionTag: "v1",
          verifiedAt: daysAgo(500),
          verifiedBy: "Tester",
          isStale: false,
        },
        // Invalid date string -> STALE with 9999 days fallback
        {
          id: "r-invalid-date",
          permitTypeId: "cat-boundary-test",
          resourceName: "Invalid Date Resource",
          resourceType: "form_pdf",
          url: "https://example.com/invalid.pdf",
          versionTag: "v1",
          verifiedAt: "NOT_A_REAL_DATE",
          verifiedBy: "Tester",
          isStale: false,
        },
        // Future date (+30d) -> NOT stale (0 days since verification)
        {
          id: "r-future-date",
          permitTypeId: "cat-boundary-test",
          resourceName: "Future Date Resource",
          resourceType: "form_pdf",
          url: "https://example.com/future.pdf",
          versionTag: "v1",
          verifiedAt: daysFuture(30),
          verifiedBy: "Tester",
          isStale: false,
        },
      ],
    },
  ];

  const report = auditResourceStaleness(syntheticCatalog, refDateStr);

  assert.equal(report.totalPermitsAudited, 1);
  assert.equal(report.totalResourcesAudited, 8);
  // Stale items should be: r-181d, r-500d, r-invalid-date => 3 stale
  assert.equal(report.staleCount, 3, `Expected 3 stale items, got ${report.staleCount}`);
  assert.equal(report.freshCount, 5, `Expected 5 fresh items, got ${report.freshCount}`);
  assert.equal(report.flaggedResources.length, 3);

  const staleIds = report.flaggedResources.map((f) => f.resourceId);
  assert.ok(staleIds.includes("r-181d"));
  assert.ok(staleIds.includes("r-500d"));
  assert.ok(staleIds.includes("r-invalid-date"));

  // Check 180d exact resource is NOT stale
  assert.ok(!staleIds.includes("r-180d"), "Exact 180d resource should not be stale (condition is > 180)");

  // Check invalid date resource has 9999 days
  const invalidRes = report.flaggedResources.find((f) => f.resourceId === "r-invalid-date");
  assert.equal(invalidRes.daysSinceVerification, 9999);

  // Check permit verification status
  assert.equal(report.auditedCatalog[0].verificationStatus, "stale_over_180d");

  // Check graceful handling of invalid referenceDate
  const invalidRefReport = auditResourceStaleness(syntheticCatalog, "COMPLETELY_INVALID_DATE");
  assert.equal(invalidRefReport.totalResourcesAudited, 8);
  assert.ok(invalidRefReport.staleCount >= 0);
});

// =========================================================================
// SECTION 3: SCHEMA DEFINITION & DRIZZLE TABLES VALIDATION
// =========================================================================

test("Database Schema [Stress]: Complete 22-Entity + 5 Supporting Tables Structural Integrity", () => {
  const all27Tables = [
    // 1. Organizations & Users (4)
    "organizations",
    "organizationalUnits",
    "users",
    "organizationMemberships",
    // 2. Permit Catalog & Resources (2)
    "permitTypes",
    "requirementResources",
    // 3. Workflow Templates & Escalation (4)
    "workflowTemplates",
    "workflowVersions",
    "workflowStages",
    "escalationPolicies",
    // 4. Projects, Workstreams & Tasks (4)
    "projects",
    "workstreams",
    "tasks",
    "taskDependencies",
    // 5. Commitments (1)
    "commitments",
    // 6. Coordination Requests & RFIs (3)
    "coordinationRequests",
    "rfis",
    "rfiResponses",
    // 7. Documents & Reviews (3)
    "documents",
    "documentVersions",
    "documentAgencyReviews",
    // 8. Decisions, Meetings & Readiness (4)
    "decisions",
    "meetings",
    "readinessChecklists",
    "readinessItems",
    // 9. Audit & Notifications (2)
    "auditEvents",
    "notifications",
  ];

  assert.equal(all27Tables.length, 27, "Must validate all 27 tables");

  for (const tableName of all27Tables) {
    const table = schema[tableName];
    assert.ok(table, `Table ${tableName} must be exported by schema.ts`);
    
    const columns = Object.keys(table);
    assert.ok(columns.length > 0, `Table ${tableName} must have columns`);
    assert.ok(table.id, `Table ${tableName} must have an 'id' primary key column`);
  }

  // Specific column assertions for high-risk tables:
  
  // 1. Dual ownership columns in workstreams
  assert.ok(schema.workstreams.governmentConciergeUserId, "workstreams must have governmentConciergeUserId");
  assert.ok(schema.workstreams.regulatoryLeadOrgId, "workstreams must have regulatoryLeadOrgId");
  assert.ok(schema.workstreams.assignedReviewerUserId, "workstreams must have assignedReviewerUserId");
  
  // 2. 6-Question context sentence columns in workstreams
  assert.ok(schema.workstreams.currentActionSummary, "workstreams must have currentActionSummary");
  assert.ok(schema.workstreams.waitingReason, "workstreams must have waitingReason");
  assert.ok(schema.workstreams.waitingOnEntity, "workstreams must have waitingOnEntity");
  assert.ok(schema.workstreams.nextExpectedEvent, "workstreams must have nextExpectedEvent");
  assert.ok(schema.workstreams.customerActionRequired, "workstreams must have customerActionRequired");

  // 3. Document Vault SHA-256 hash in documentVersions
  assert.ok(schema.documentVersions.sha256Hash, "documentVersions must have sha256Hash");
  assert.ok(schema.documentVersions.versionTag, "documentVersions must have versionTag");
  assert.ok(schema.documentVersions.storageUri, "documentVersions must have storageUri");

  // 4. Concurrence request columns in coordinationRequests
  assert.ok(schema.coordinationRequests.code, "coordinationRequests must have code (CR-00xxx)");
  assert.ok(schema.coordinationRequests.blocksWorkstreamTitle, "coordinationRequests must have blocksWorkstreamTitle");

  // 5. Consolidated RFI columns in rfis
  assert.ok(schema.rfis.isConsolidatedCycle, "rfis must have isConsolidatedCycle");
  assert.ok(schema.rfis.consolidatedBatchId, "rfis must have consolidatedBatchId");

  // 6. Staleness columns in requirementResources
  assert.ok(schema.requirementResources.verifiedAt, "requirementResources must have verifiedAt");
  assert.ok(schema.requirementResources.isStale, "requirementResources must have isStale");

  // 7. Audit ledger columns in auditEvents
  assert.ok(schema.auditEvents.entityType, "auditEvents must have entityType");
  assert.ok(schema.auditEvents.entityId, "auditEvents must have entityId");
  assert.ok(schema.auditEvents.actionType, "auditEvents must have actionType");
  assert.ok(schema.auditEvents.sourceChannel, "auditEvents must have sourceChannel");
  assert.ok(schema.auditEvents.occurredAt, "auditEvents must have occurredAt");
});
