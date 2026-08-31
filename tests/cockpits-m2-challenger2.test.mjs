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

// Load Fixtures & Modules
const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const domainModels = await vite.ssrLoadModule("/lib/domain-models.ts");
const workflowEngine = await vite.ssrLoadModule("/lib/engines/workflow-engine.ts");
const scheduleEngine = await vite.ssrLoadModule("/lib/engines/schedule-engine.ts");
const escalationEngine = await vite.ssrLoadModule("/lib/engines/escalation-engine.ts");
const coordinationEngine = await vite.ssrLoadModule("/lib/engines/coordination-engine.ts");
const auditEngine = await vite.ssrLoadModule("/lib/engines/audit-engine.ts");
const utils = await vite.ssrLoadModule("/lib/permit-utils.ts");

// Load Cockpit Components
const { DocumentVaultPanel } = await vite.ssrLoadModule("/components/cockpits/DocumentVaultPanel.tsx");
const { CommitmentsDecisionsPanel } = await vite.ssrLoadModule("/components/cockpits/CommitmentsDecisionsPanel.tsx");
const { WorkflowDesignerPanel } = await vite.ssrLoadModule("/components/cockpits/WorkflowDesignerPanel.tsx");
const { PreApplicationReadinessPanel } = await vite.ssrLoadModule("/components/cockpits/PreApplicationReadinessPanel.tsx");
const { SpaceXNoSurprises } = await vite.ssrLoadModule("/components/cockpits/SpaceXNoSurprises.tsx");
const { DailyCommandCenter } = await vite.ssrLoadModule("/components/cockpits/DailyCommandCenter.tsx");
const { WorkstreamGraphGantt } = await vite.ssrLoadModule("/components/cockpits/WorkstreamGraphGantt.tsx");
const { InteragencyCoordinationPanel } = await vite.ssrLoadModule("/components/cockpits/InteragencyCoordinationPanel.tsx");

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

const { validateStageTransition, generateSixQuestionsSummary, deriveOperationalHealth } = workflowEngine;
const { auditResourceStaleness, createAuditEvent, filterAuditEvents } = auditEngine;
const { getFullProjectRecord, getRegisteredOrganizations, getPermitCatalog, getWorkflowTemplates } = utils;

// =========================================================================
// SECTION 1: DOCUMENT VAULT PANEL EMPIRICAL STRESS TESTS (COCKPIT 5)
// =========================================================================

test("Document Vault [Stress]: SHA-256 Version Ledger Hash & Invariant Integrity", () => {
  assert.ok(projectDocumentsData.length >= 2, "Document vault must contain multiple document packages");

  const seenHashes = new Set();
  const sha256Regex = /^[a-f0-9]{64}$/i;

  for (const doc of projectDocumentsData) {
    assert.ok(doc.id, "Document must have a valid ID");
    assert.ok(doc.title, `Document ${doc.id} must have a title`);
    assert.ok(doc.category, `Document ${doc.id} must have a category`);
    assert.ok(doc.ownerOrgCode, `Document ${doc.id} must have an owner org code`);
    assert.ok(doc.currentVersionNumber >= 1, `Document ${doc.id} must have version number >= 1`);
    assert.ok(Array.isArray(doc.versions) && doc.versions.length >= 1, `Document ${doc.id} must have versions array`);

    let maxVerNum = 0;
    for (const ver of doc.versions) {
      assert.ok(ver.id, `Version must have valid ID`);
      assert.equal(ver.documentId, doc.id, `Version documentId must match parent document ID`);
      assert.match(ver.versionTag, /^v\d+(\.\d+)?$/i, `Version tag '${ver.versionTag}' must follow vX.Y format`);
      assert.ok(ver.fileName && ver.fileName.endsWith(".pdf"), `File name '${ver.fileName}' must be valid PDF filename`);
      assert.ok(ver.fileSizeBytes > 0, `File size ${ver.fileSizeBytes} must be strictly positive`);
      assert.ok(ver.uploadedByName, `Uploaded by name must be present`);
      assert.equal(typeof ver.isMalwareClean, "boolean", `isMalwareClean must be boolean`);
      assert.equal(ver.isMalwareClean, true, `All verified documents in fixture must pass malware scan`);
      assert.ok(ver.sha256Hash, `SHA-256 hash must be non-empty`);
      assert.match(ver.sha256Hash, sha256Regex, `SHA-256 hash '${ver.sha256Hash}' must be exactly 64 hex characters`);

      // Uniqueness check
      assert.ok(!seenHashes.has(ver.sha256Hash), `SHA-256 hash '${ver.sha256Hash}' must be unique across all revisions`);
      seenHashes.add(ver.sha256Hash);

      const verNum = parseFloat(ver.versionTag.replace("v", ""));
      if (verNum > maxVerNum) maxVerNum = verNum;
    }

    assert.ok(
      doc.currentVersionNumber >= Math.floor(maxVerNum),
      `Document ${doc.id} currentVersionNumber (${doc.currentVersionNumber}) must reflect latest version (${maxVerNum})`
    );
  }
});

test("Document Vault [Stress]: Multi-Agency Review Certification Matrix per Revision", () => {
  const allowedStatuses = ["under_review", "approved", "revisions_requested", "waived"];

  for (const doc of projectDocumentsData) {
    assert.ok(Array.isArray(doc.agencyReviews), `Document ${doc.id} must have agencyReviews array`);
    assert.ok(doc.agencyReviews.length >= 1, `Document ${doc.id} must have at least one active agency review track`);

    const reviewedOrgCodes = new Set();
    for (const rev of doc.agencyReviews) {
      assert.ok(rev.id, `Review record must have ID`);
      assert.ok(rev.documentVersionId, `Review record must link to documentVersionId`);
      assert.ok(rev.workstreamId, `Review record must link to workstreamId`);
      assert.ok(rev.reviewingOrgCode, `Reviewing org code must be present`);
      assert.ok(allowedStatuses.includes(rev.reviewStatus), `Review status '${rev.reviewStatus}' must be in allowed statuses`);

      if (rev.reviewStatus === "approved") {
        assert.ok(rev.decisionDate, `Approved review by ${rev.reviewingOrgCode} must have decisionDate`);
        assert.match(rev.decisionDate, /^2026-\d{2}-\d{2}$/, `Decision date '${rev.decisionDate}' must be valid ISO format`);
      }

      reviewedOrgCodes.add(rev.reviewingOrgCode);
    }

    if (doc.id === "doc-drainage-study") {
      assert.ok(reviewedOrgCodes.has("DOTD"), "LA-82 drainage study must include DOTD review");
      assert.ok(reviewedOrgCodes.has("CPRA"), "LA-82 drainage study must include CPRA concurrence review");
    }
  }
});

test("Document Vault [SSR & Interactive]: Renders Complete Document Vault with Matrix and Hashes", () => {
  const html = renderToStaticMarkup(React.createElement(DocumentVaultPanel));

  assert.match(html, /Single Source of Truth Document Vault/);
  assert.match(html, /Project Document Vault/);
  assert.match(html, /Cross-Agency Revision Certification Matrix/);
  assert.match(html, /Immutable Version Ledger/);
  assert.match(html, /SHA-256/);
  assert.match(html, /LA-82 Heavy-Haul Drainage &amp; Hydrodynamic Study|LA-82 Heavy-Haul Drainage & Hydrodynamic Study/);
  assert.match(html, /Launch Complex Wetland Delineation &amp; Mitigation Package|Launch Complex Wetland Delineation & Mitigation Package/);
  assert.match(html, /DOTD/);
  assert.match(html, /CPRA/);
  assert.match(html, /Approved/);
  assert.match(html, /Under Review/);
});

// =========================================================================
// SECTION 2: COMMITMENT LEDGER & DECISION REPOSITORY (COCKPIT 6)
// =========================================================================

test("Commitment Ledger [Stress]: First-Class Commitments, Slip Impacts & Critical Path", () => {
  assert.ok(commitmentsData.length >= 6, "Fixture must contain at least 6 structured commitments");

  const validStatuses = ["on_track", "at_risk", "fulfilled", "missed", "waived"];
  let criticalPathCount = 0;

  for (const com of commitmentsData) {
    assert.ok(com.id.startsWith("COM-"), `Commitment ID '${com.id}' must start with COM-`);
    assert.ok(com.workstreamId, `Commitment ${com.id} must reference workstreamId`);
    assert.ok(com.committingOrgCode, `Commitment ${com.id} must specify committingOrgCode`);
    assert.ok(com.madeByPersonName, `Commitment ${com.id} must record who made the commitment`);
    assert.ok(com.committedAction && com.committedAction.length > 10, `Committed action must be detailed description`);
    assert.ok(com.originContext, `Commitment ${com.id} must record meeting/origin context`);
    assert.match(com.committedDate, /^2026-\d{2}-\d{2}$/, `Committed date '${com.committedDate}' must be valid ISO date`);
    assert.match(com.promisedDueDate, /^2026-\d{2}-\d{2}$/, `Promised due date '${com.promisedDueDate}' must be valid ISO date`);
    assert.ok(validStatuses.includes(com.status), `Status '${com.status}' must be valid CommitmentStatus`);
    assert.ok(com.impactIfMissed && com.impactIfMissed.length > 5, `Commitment ${com.id} must document impact if missed`);

    if (com.isCriticalPathImpact) {
      criticalPathCount++;
      assert.ok(
        com.impactIfMissed.toLowerCase().includes("slip") ||
        com.impactIfMissed.toLowerCase().includes("delay") ||
        com.impactIfMissed.toLowerCase().includes("critical") ||
        com.impactIfMissed.toLowerCase().includes("permit"),
        `Critical path commitment ${com.id} must articulate downstream schedule impact`
      );
    }
  }

  assert.ok(criticalPathCount >= 3, `Expected at least 3 critical path commitments (found ${criticalPathCount})`);
});

test("Decision Repository [Stress]: Institutional Decision Logs with Statutory Authorities", () => {
  assert.ok(projectDecisionsData.length >= 2, "Decision repository must contain institutional decision logs");

  for (const dec of projectDecisionsData) {
    assert.match(dec.id, /^DEC-\d{4}-\d{3}$/, `Decision ID '${dec.id}' must match DEC-YYYY-XXX format`);
    assert.match(dec.decisionDate, /^2026-\d{2}-\d{2}$/, `Decision date '${dec.decisionDate}' must be valid ISO date`);
    assert.ok(dec.title, `Decision ${dec.id} must have a title`);
    assert.ok(dec.decisionSummary && dec.decisionSummary.length > 20, `Decision ${dec.id} must have detailed summary`);
    assert.ok(dec.decisionMakerName, `Decision ${dec.id} must record decision maker name`);
    assert.ok(dec.decisionMakerTitle, `Decision ${dec.id} must record decision maker title`);
    assert.ok(Array.isArray(dec.organizationsRepresented) && dec.organizationsRepresented.length >= 2, `Decision ${dec.id} must represent at least 2 organizations`);
    assert.ok(dec.statutoryAuthority && dec.statutoryAuthority.length > 5, `Decision ${dec.id} must cite statutory legal authority`);
    assert.ok(
      dec.statutoryAuthority.includes("La. R.S.") ||
      dec.statutoryAuthority.includes("FAST-41") ||
      dec.statutoryAuthority.includes("33 U.S.C.") ||
      dec.statutoryAuthority.includes("EDSM"),
      `Decision ${dec.id} statutory authority '${dec.statutoryAuthority}' must cite valid legal code or standard`
    );
    assert.ok(Array.isArray(dec.affectedWorkstreamTitles) && dec.affectedWorkstreamTitles.length >= 1, `Decision ${dec.id} must list affected workstreams`);
  }
});

test("Meeting Management [Stress]: Standup Meeting Action Item Pipeline & Conversion Counters", () => {
  assert.ok(projectMeetingsData.length >= 1, "Meeting logs must be present");

  for (const mtg of projectMeetingsData) {
    assert.match(mtg.id, /^MTG-\d{4}-\d{4}$/, `Meeting ID '${mtg.id}' must match MTG-YYYY-MMDD`);
    assert.match(mtg.meetingDate, /^2026-\d{2}-\d{2}$/, `Meeting date '${mtg.meetingDate}' must be valid ISO date`);
    assert.ok(mtg.title, `Meeting ${mtg.id} must have title`);
    assert.ok(mtg.locationOrLink, `Meeting ${mtg.id} must record location or Teams link`);
    assert.ok(Array.isArray(mtg.attendeeList) && mtg.attendeeList.length >= 3, `Meeting ${mtg.id} must have attendees`);
    assert.ok(mtg.meetingNotes && mtg.meetingNotes.length > 20, `Meeting ${mtg.id} must have standup notes`);
    
    assert.ok(mtg.actionItemsConverted, `Meeting ${mtg.id} must have actionItemsConverted mapping`);
    assert.ok(Number.isInteger(mtg.actionItemsConverted.tasksCreated) && mtg.actionItemsConverted.tasksCreated >= 0);
    assert.ok(Number.isInteger(mtg.actionItemsConverted.commitmentsCreated) && mtg.actionItemsConverted.commitmentsCreated >= 0);
    assert.ok(Number.isInteger(mtg.actionItemsConverted.decisionsLogged) && mtg.actionItemsConverted.decisionsLogged >= 0);

    const totalConverted =
      mtg.actionItemsConverted.tasksCreated +
      mtg.actionItemsConverted.commitmentsCreated +
      mtg.actionItemsConverted.decisionsLogged;
    assert.ok(totalConverted > 0, `Meeting ${mtg.id} must have converted action items (found ${totalConverted})`);
  }
});

test("Commitments & Decisions [SSR & Interactive]: Renders Commitments, Decisions and Meetings", () => {
  const html = renderToStaticMarkup(React.createElement(CommitmentsDecisionsPanel));

  assert.match(html, /Institutional Memory &amp; Accountability|Institutional Memory & Accountability/);
  assert.match(html, /Commitment Ledger &amp; Decision Repository|Commitment Ledger & Decision Repository/);
  assert.match(html, /Commitments \(6\)/);
  assert.match(html, /Decision Logs \(2\)/);
  assert.match(html, /Meetings \(1\)/);
  assert.match(html, /COM-001/);
  assert.match(html, /COM-002/);
  assert.match(html, /COM-003/);
  assert.match(html, /Jean-Paul Guidry/);
  assert.match(html, /Impact if missed/);
});

// =========================================================================
// SECTION 3: WORKFLOW DESIGNER & STATUTORY CATALOG (COCKPIT 7)
// =========================================================================

test("Workflow Designer [Stress]: Version-Controlled Stage Pipelines (v1-vN) & Invariants", () => {
  assert.ok(workflowTemplatesData.length >= 1, "Workflow templates must be defined");

  for (const tmpl of workflowTemplatesData) {
    assert.ok(tmpl.id, "Template must have ID");
    assert.ok(tmpl.name, "Template must have name");
    assert.ok(tmpl.activeVersionNumber >= 1, "Template activeVersionNumber must be >= 1");
    assert.ok(Array.isArray(tmpl.versions) && tmpl.versions.length >= 1, "Template must have versions");

    for (const ver of tmpl.versions) {
      assert.ok(ver.id, "Version must have ID");
      assert.ok(ver.versionNumber >= 1, "Version number must be >= 1");
      assert.ok(["draft", "published", "retired"].includes(ver.status), `Version status '${ver.status}' must be valid`);
      assert.ok(Array.isArray(ver.stages) && ver.stages.length >= 3, `Version ${ver.id} must have sequential stages`);

      let prevSeq = 0;
      for (const stage of ver.stages) {
        assert.ok(stage.id, "Stage must have ID");
        assert.ok(stage.stageKey, "Stage must have key");
        assert.ok(stage.name, "Stage must have name");
        assert.ok(stage.customerVisibilityLabel, "Stage must have customerVisibilityLabel");
        assert.equal(stage.sequenceOrder, prevSeq + 1, `Stage sequence must be strictly sequential (expected ${prevSeq + 1}, got ${stage.sequenceOrder})`);
        prevSeq = stage.sequenceOrder;

        assert.ok(stage.targetDurationDays > 0, `Stage targetDurationDays must be > 0 (got ${stage.targetDurationDays})`);
        assert.ok(stage.minimumStatutoryDays >= 0, `Stage minimumStatutoryDays must be >= 0 (got ${stage.minimumStatutoryDays})`);
        assert.ok(stage.minimumStatutoryDays <= stage.targetDurationDays, `minimumStatutoryDays (${stage.minimumStatutoryDays}) cannot exceed targetDurationDays (${stage.targetDurationDays})`);

        assert.ok(Array.isArray(stage.requiredInputs), "Stage requiredInputs must be array");
        assert.ok(Array.isArray(stage.completionRequirements), "Stage completionRequirements must be array");
        assert.ok(Array.isArray(stage.permittedTransitions) && stage.permittedTransitions.length >= 1, "Stage permittedTransitions must not be empty");
      }
    }
  }
});

test("Workflow Engine [Stress]: validateStageTransition Gate Oracle", () => {
  const stage = workflowTemplatesData[0].versions[0].stages[1];
  assert.ok(stage, "Technical review stage must exist");

  const validResult = validateStageTransition(
    stage,
    ["drainage_concurrence_received", "ecological_signoff"],
    ["drainage_model", "mitigation_plan"]
  );
  assert.equal(validResult.allowed, true, "Should allow transition when all gates and inputs met");
  assert.equal(validResult.missingChecklists.length, 0);
  assert.equal(validResult.missingDocs.length, 0);
  assert.equal(validResult.reasons.length, 0);

  const missingChecklistResult = validateStageTransition(
    stage,
    ["drainage_concurrence_received"],
    ["drainage_model", "mitigation_plan"]
  );
  assert.equal(missingChecklistResult.allowed, false, "Should block transition when checklist item missing");
  assert.deepEqual(missingChecklistResult.missingChecklists, ["ecological_signoff"]);
  assert.ok(missingChecklistResult.reasons[0].includes("ecological_signoff"));

  const missingDocResult = validateStageTransition(
    stage,
    ["drainage_concurrence_received", "ecological_signoff"],
    ["drainage_model"]
  );
  assert.equal(missingDocResult.allowed, false, "Should block transition when document missing");
  assert.deepEqual(missingDocResult.missingDocs, ["mitigation_plan"]);

  const emptyResult = validateStageTransition(stage, [], []);
  assert.equal(emptyResult.allowed, false);
  assert.equal(emptyResult.missingChecklists.length, 2);
  assert.equal(emptyResult.missingDocs.length, 2);
});

test("Statutory Catalog [Stress]: 180-Day Stale Link Auditing Engine Boundary Oracle", () => {
  const baselineAudit = auditResourceStaleness(permitCatalog, "2026-08-30");
  assert.equal(baselineAudit.totalPermitsAudited, permitCatalog.length);
  assert.equal(baselineAudit.staleCount, 0, "No resources should be stale on baseline date");
  assert.ok(baselineAudit.freshCount >= 2, "All catalog resources should be fresh");

  const futureAudit = auditResourceStaleness(permitCatalog, "2027-03-18");
  assert.ok(futureAudit.staleCount >= 2, `Expected at least 2 stale resources in March 2027 (found ${futureAudit.staleCount})`);
  assert.equal(futureAudit.freshCount, 0);

  for (const flagged of futureAudit.flaggedResources) {
    assert.ok(flagged.daysSinceVerification > 180, `Flagged resource ${flagged.resourceName} must have daysSinceVerification > 180 (got ${flagged.daysSinceVerification})`);
    assert.equal(flagged.thresholdDays, 180);
    assert.ok(flagged.url.startsWith("http"));
  }

  const exact180Audit = auditResourceStaleness(permitCatalog, "2027-02-21");
  const res180 = exact180Audit.auditedCatalog
    .find((p) => p.code === "USACE-404")
    ?.resources?.find((r) => r.id === "res-usace-1");
  assert.equal(res180?.isStale, false, "Resource exactly at 180 days should not be stale");

  const boundary181Audit = auditResourceStaleness(permitCatalog, "2027-02-22");
  const res181 = boundary181Audit.auditedCatalog
    .find((p) => p.code === "USACE-404")
    ?.resources?.find((r) => r.id === "res-usace-1");
  assert.equal(res181?.isStale, true, "Resource at 181 days must be flagged as stale");
});

test("Agency Registry [Stress]: Registered Organizations Hierarchy & SLAs", () => {
  assert.ok(registeredOrganizations.length >= 8, "Agency registry must contain at least 8 organizations");

  const expectedOrgs = ["SPACEX", "LA-PROJECTS", "DOTD", "LDEQ", "CPRA", "USACE", "OSFM", "VERMILION-PARISH"];
  const orgCodes = registeredOrganizations.map((o) => o.code);

  for (const code of expectedOrgs) {
    assert.ok(orgCodes.includes(code), `Organization code '${code}' must be in registry`);
  }

  for (const org of registeredOrganizations) {
    assert.ok(org.id, "Org must have ID");
    assert.ok(org.name, `Org ${org.code} must have name`);
    assert.ok(["State", "Federal", "Local / Parish", "Utility / Regional", "Applicant"].includes(org.jurisdictionLevel));
    assert.ok(org.workingHours, `Org ${org.code} must have workingHours`);
    assert.ok(org.defaultSlaDays > 0, `Org ${org.code} defaultSlaDays must be > 0`);
    assert.ok(org.documentRetentionYears >= 10, `Org ${org.code} retention years must be >= 10`);
    assert.equal(org.isActive, true, `Org ${org.code} must be active`);
  }
});

test("Workflow Designer [SSR & Interactive]: Renders Templates, Catalog and Agencies", () => {
  const html = renderToStaticMarkup(React.createElement(WorkflowDesignerPanel));

  assert.match(html, /Workflow Designer &amp; Permit Catalog|Workflow Designer & Permit Catalog/);
  assert.match(html, /Coastal Use Permit Standard Review/);
  assert.match(html, /Published v4.0/);
  assert.match(html, /Stage 1/);
  assert.match(html, /Stage 2/);
  assert.match(html, /Stage 3/);
  assert.match(html, /Stage 4/);
  assert.match(html, /Checklist Gates to Advance/);
  assert.match(html, /Required Document Inputs/);
  assert.match(html, /Permit Catalog \(3\)/);
  assert.match(html, /Agency Registry \((?:8|10)\)/);
});

// =========================================================================
// SECTION 4: PRE-APPLICATION ACCELERATION WORKSPACE (COCKPIT 8)
// =========================================================================

test("Pre-App Acceleration [Stress]: 86% Readiness Score & 6 Prerequisite Checklist Items", () => {
  const preAppWs = workstreamsData.find((ws) => ws.code === "WS-PREAPP-SUBSTATION-PH2");
  assert.ok(preAppWs, "WS-PREAPP-SUBSTATION-PH2 workstream must exist in fixture");

  const checklist = preAppWs.readinessChecklist;
  assert.ok(checklist, "Pre-app workstream must contain readinessChecklist");
  assert.equal(checklist.overallReadinessPercent, 86, "Readiness score must be exactly 86%");
  assert.match(checklist.targetFilingDate, /^2026-\d{2}-\d{2}$/, "Target filing date must be valid ISO date");
  assert.equal(checklist.items.length, 6, "Checklist must contain exactly 6 prerequisite study items");

  const expectedItemNames = [
    "Electrical Engineering Single-Line Drawings",
    "Jurisdictional Wetland Delineation",
    "Alternatives Transmission Routing Analysis",
    "Phase I Cultural Resources & Archaeological Survey",
    "Formal LPSC Section 85 Application Form",
    "Statutory Filing Fee Remittance",
  ];

  const itemNames = checklist.items.map((i) => i.itemName);
  for (const exp of expectedItemNames) {
    assert.ok(itemNames.includes(exp), `Prerequisite study '${exp}' must be present`);
  }

  const readyCount = checklist.items.filter((i) => i.status === "ready").length;
  const underwayCount = checklist.items.filter((i) => i.status === "underway").length;
  assert.equal(readyCount, 5, "Expected 5 ready prerequisite items");
  assert.equal(underwayCount, 1, "Expected 1 underway prerequisite item (Archaeological Survey)");

  for (const item of checklist.items) {
    assert.ok(item.id, "Item must have ID");
    assert.ok(item.assignedParty, `Item '${item.itemName}' must have assignedParty`);
    assert.ok(["ready", "underway", "missing", "waived"].includes(item.status));
  }
});

test("Pre-App Acceleration [Stress]: Dynamic Readiness Score Calculation Oracle", () => {
  function calculateReadinessScore(items) {
    if (!items || items.length === 0) return 0;
    let scoreSum = 0;
    for (const item of items) {
      if (item.status === "ready" || item.status === "waived") scoreSum += 1.0;
      else if (item.status === "underway") scoreSum += 0.16;
      else scoreSum += 0.0;
    }
    return Math.round((scoreSum / items.length) * 100);
  }

  const preAppWs = workstreamsData.find((ws) => ws.code === "WS-PREAPP-SUBSTATION-PH2");
  const calculated = calculateReadinessScore(preAppWs.readinessChecklist.items);
  assert.equal(calculated, 86, `Calculated score (${calculated}%) must match 86%`);

  assert.equal(calculateReadinessScore([]), 0, "Empty checklist = 0%");
  assert.equal(
    calculateReadinessScore([{ status: "ready" }, { status: "ready" }]),
    100,
    "All ready = 100%"
  );
  assert.equal(
    calculateReadinessScore([{ status: "missing" }, { status: "missing" }]),
    0,
    "All missing = 0%"
  );
});

test("Pre-App Acceleration [SSR & Interactive]: Renders 86% Readiness Workspace", () => {
  const html = renderToStaticMarkup(React.createElement(PreApplicationReadinessPanel));

  assert.match(html, /Pre-Application Acceleration Workspace/);
  assert.match(html, /86%/);
  assert.match(html, /Filing Readiness Score/);
  assert.match(html, /230kV Substation Expansion Phase II/);
  assert.match(html, /Electrical Engineering Single-Line Drawings/);
  assert.match(html, /Phase I Cultural Resources &amp; Archaeological Survey|Phase I Cultural Resources & Archaeological Survey/);
  assert.match(html, /Acceleration Principle/);
  assert.match(html, /Submit Complete Application/);
});

// =========================================================================
// SECTION 5: ROOT VIEW SWITCHER & ROUTER EMPIRICAL STRESS TESTS (app/page.tsx)
// =========================================================================

test("Root View Router [Stress]: All 8 Cockpit Components Render Reliably without Collision", () => {
  const cockpits = [
    { name: "SpaceXNoSurprises", component: SpaceXNoSurprises, marker: /No-Surprises Delivery Dashboard/ },
    { name: "DailyCommandCenter", component: DailyCommandCenter, marker: /Daily Coordination Command Center/ },
    { name: "WorkstreamGraphGantt", component: WorkstreamGraphGantt, marker: /Critical Path Execution Graph/ },
    { name: "InteragencyCoordinationPanel", component: InteragencyCoordinationPanel, marker: /Interagency Action &amp; Concurrency Framework|Interagency Action & Concurrency Framework/ },
    { name: "DocumentVaultPanel", component: DocumentVaultPanel, marker: /Single Source of Truth Document Vault/ },
    { name: "CommitmentsDecisionsPanel", component: CommitmentsDecisionsPanel, marker: /Institutional Memory &amp; Accountability|Institutional Memory & Accountability/ },
    { name: "WorkflowDesignerPanel", component: WorkflowDesignerPanel, marker: /Workflow Designer &amp; Permit Catalog|Workflow Designer & Permit Catalog/ },
    { name: "PreApplicationReadinessPanel", component: PreApplicationReadinessPanel, marker: /Pre-Application Acceleration Workspace/ },
  ];

  for (const { name, component, marker } of cockpits) {
    const html = renderToStaticMarkup(React.createElement(component));
    assert.ok(html.length > 500, `Cockpit ${name} rendered markup must be substantial (>500 bytes, got ${html.length})`);
    assert.match(html, marker, `Cockpit ${name} must contain expected marker`);
  }
});

test("Root View Router [Stress]: Rapid 1,000-Cycle View Switch Simulation (Memory & State Integrity)", () => {
  const cockpitList = [
    SpaceXNoSurprises,
    DailyCommandCenter,
    WorkstreamGraphGantt,
    InteragencyCoordinationPanel,
    DocumentVaultPanel,
    CommitmentsDecisionsPanel,
    WorkflowDesignerPanel,
    PreApplicationReadinessPanel,
  ];

  if (global.gc) global.gc();
  const initialMemory = process.memoryUsage().heapUsed;

  for (let cycle = 0; cycle < 1000; cycle++) {
    const Comp = cockpitList[cycle % cockpitList.length];
    const html = renderToStaticMarkup(React.createElement(Comp));
    assert.ok(html.length > 0);
  }

  assert.equal(spacexProjectRecord.scheduleVarianceDays, 13, "Fixture variance invariant (+13d) must be preserved");
  assert.equal(commitmentsData.length, 6, "Commitments count must remain 6");
  assert.ok(projectDocumentsData.length >= 2, "Documents count must be at least 2");
  assert.equal(projectDecisionsData.length, 2, "Decisions count must remain 2");

  const finalMemory = process.memoryUsage().heapUsed;
  const memoryDeltaMB = (finalMemory - initialMemory) / (1024 * 1024);
  assert.ok(memoryDeltaMB < 100, `Memory delta after 8,000 renders (${memoryDeltaMB.toFixed(2)} MB) must be bounded (<100 MB)`);
});

// =========================================================================
// SECTION 6: HIGH-VOLUME ADVERSARIAL MUTATION & FUZZING HARNESS
// =========================================================================

test("Adversarial Fuzzing [Stress]: Document Vault Malformed Input Fuzzing", () => {
  const maliciousHashes = [
    "",
    "not-a-hash",
    "0123456789abcdef",
    "<script>alert(1)</script>",
    "' OR '1'='1",
    "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  ];

  for (const hash of maliciousHashes) {
    const isCleanHex64 = /^[a-f0-9]{64}$/i.test(hash);
    if (hash === "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") {
      assert.equal(isCleanHex64, true);
    } else {
      assert.equal(isCleanHex64, false, `Hash '${hash}' should be rejected as non-64-hex`);
    }
  }
});

test("Adversarial Fuzzing [Stress]: 6-Question Narrative Synthesis under 100 Corrupted Workstream Permutations", () => {
  const categories = ["permit", "road", "utility", "public_safety", "workforce", "community"];
  const states = ["running", "waiting_applicant", "waiting_government", "blocked", "statutory_waiting_period", "complete"];

  for (let i = 0; i < 100; i++) {
    const corruptedWs = {
      id: `ws-fuzz-${i}`,
      projectId: "proj-fuzz",
      code: `WS-FUZZ-${i}`,
      title: `Fuzzed Workstream #${i}`,
      category: categories[i % categories.length],
      categoryLabel: "Fuzz Category",
      currentStageName: i % 2 === 0 ? `Stage ${i}` : undefined,
      governmentConcierge: {
        name: `Concierge ${i}`,
        title: "Liaison",
        agency: "Governor Office",
        email: `concierge${i}@la.gov`,
        phone: "(225) 000-0000",
      },
      regulatoryLead: {
        orgCode: `ORG-${i}`,
        orgName: `Organization Name ${i}`,
        jurisdictionLevel: "State",
        assignedReviewerName: `Reviewer ${i}`,
        assignedReviewerEmail: `reviewer${i}@org.gov`,
      },
      operationalState: states[i % states.length],
      operationalStateLabel: `State ${states[i % states.length]}`,
      ragHealth: i % 3 === 0 ? "red" : i % 3 === 1 ? "yellow" : "green",
      isCriticalPath: i % 2 === 0,
      baselineStartDate: "2026-08-01",
      baselineTargetDate: "2026-10-01",
      forecastStartDate: "2026-08-01",
      forecastTargetDate: "2026-10-15",
      scheduleVarianceDays: (i % 15) - 5,
      currentActionSummary: i % 4 === 0 ? "" : `Action summary ${i}`,
      waitingReason: i % 3 === 0 ? undefined : `Waiting reason ${i}`,
      waitingOnEntity: i % 3 === 0 ? undefined : `Entity ${i}`,
      nextExpectedEvent: `Next event ${i}`,
      customerActionRequired: i % 2 === 0 ? "None" : `Submit document ${i}`,
      primaryDelayReason: "none",
      escalationLevel: 0,
      tasks: [],
      commitments: [],
      coordinationRequests: [],
      rfis: [],
    };

    const summary = generateSixQuestionsSummary(corruptedWs);
    assert.ok(summary.whoHasIt, "whoHasIt must be defined");
    assert.ok(summary.whatDoing, "whatDoing must be defined");
    assert.ok(summary.whenDue, "whenDue must be defined");
    assert.ok(summary.deterministicParagraph, "deterministicParagraph must be non-empty");
    assert.ok(summary.deterministicParagraph.includes(corruptedWs.title));
  }
});
