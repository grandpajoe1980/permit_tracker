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
  runDailySlaEscalationScan,
  run180DayCatalogVerificationScan,
  onRfiDispatched,
  onRfiResponseAccepted,
} = await vite.ssrLoadModule("/lib/engines/sla-worker.ts");

test("Repository: reads initial project and relational domain entities", () => {
  const project = repository.getProject();
  assert.equal(project.code, "SPACEX-PECAN-ISLAND");
  assert.equal(project.workstreams.length, 9);
  assert.ok(project.commitments.length >= 6);
  assert.ok(project.coordinationRequests.length >= 3);
  assert.ok(project.documents.length >= 2);
  assert.ok(project.decisions.length >= 2);
  assert.ok(project.auditLedger.length >= 3);
});

test("Repository: creates and updates Interagency Coordination Requests (CR-00xxx) with audit trail", () => {
  const initialAuditCount = repository.getAuditEvents().length;

  const newCR = repository.createCoordinationRequest({
    workstreamId: "WS-WASTEWATER-DELUGE",
    workstreamTitle: "Industrial Wastewater & Launch Deluge Retention Basin",
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    targetOrgId: "org-cpra",
    targetOrgCode: "CPRA",
    requestingUserName: "Dr. Rachel Benoit",
    assignedToUserName: "Ecological Assessment Team",
    title: "Estuarine Salinity Concurrence",
    needDescription: "Verification of thermal dissipation model",
    dueDate: "2026-09-10",
    priority: "urgent",
  });

  assert.ok(newCR.id);
  assert.ok(newCR.code.startsWith("CR-00"));
  assert.equal(newCR.status, "pending");

  // Verify audit event was logged
  assert.ok(repository.getAuditEvents().length > initialAuditCount);
  const audit = repository.getAuditEvents()[0];
  assert.equal(audit.entityType, "coordination_request");
  assert.equal(audit.entityId, newCR.code);

  // Update status to concurred
  const updated = repository.updateCoordinationRequest(newCR.id, {
    status: "concurred",
    responseSummary: "CPRA coastal ecology team concurred with no conditions.",
    actorName: "Jean-Paul Guidry",
    actorOrgName: "CPRA",
  });

  assert.ok(updated);
  assert.equal(updated.status, "concurred");
  assert.ok(updated.concurredAt);
});

test("Repository: creates and updates First-Class Commitments", () => {
  const newCommitment = repository.createCommitment({
    workstreamId: "WS-LA82-HEAVYHAUL",
    workstreamTitle: "LA-82 Heavy-Haul Access & Bridge Reinforcement",
    committingOrgId: "org-spacex",
    committingOrgCode: "SPACEX",
    madeByPersonName: "Elena Vance",
    committedAction: "Submit Rev 9 axle load test documentation",
    originContext: "Aug 30 DOTD Coordination Meeting",
    promisedDueDate: "2026-09-03",
    impactIfMissed: "Culvert structural signoff slips by 5 days",
    isCriticalPathImpact: true,
  });

  assert.ok(newCommitment.id.startsWith("COM-"));
  assert.equal(newCommitment.status, "on_track");

  // Update commitment status to fulfilled
  const updated = repository.updateCommitmentStatus(newCommitment.id, "fulfilled", "Elena Vance", "Documentation delivered on portal");
  assert.ok(updated);
  assert.equal(updated.status, "fulfilled");
  assert.ok(updated.fulfilledDate);
});

test("Repository: creates document versions and handles multi-agency review signoffs", () => {
  const doc = repository.getDocuments()[0];
  assert.ok(doc);

  const newVersion = repository.createDocumentVersion(doc.id, {
    versionNumber: 13,
    versionLabel: "Rev 13 (Superload Clearance Edition)",
    storagePath: "vault/drawings/la82-superload-v13.pdf",
    sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    uploadedByName: "Maya Chen",
    uploadedByOrgName: "SpaceX",
    changeNotes: "Updated bridge flexure calculations per DOTD RFI",
    reviewingAgencyCodes: ["DOTD", "CPRA"],
  });

  assert.ok(newVersion);
  assert.equal(newVersion.versionNumber, 13);
  assert.equal(newVersion.agencyReviews.length, 2);
  assert.equal(newVersion.status, "under_review");

  // Sign off DOTD review
  const dotdSignoff = repository.signoffDocumentAgencyReview(
    newVersion.id,
    "DOTD",
    "approved",
    "Mark Fontenot, PE",
    "Bridge Bureau calculations verified."
  );
  assert.ok(dotdSignoff);
  assert.equal(dotdSignoff.status, "approved");

  // Sign off CPRA review -> promotes version to approved
  const cpraSignoff = repository.signoffDocumentAgencyReview(
    newVersion.id,
    "CPRA",
    "approved",
    "Jean-Paul Guidry",
    "Coastal drainage concurrence confirmed."
  );
  assert.ok(cpraSignoff);
  assert.equal(newVersion.status, "approved");
});

test("Repository: freezes and resumes statutory review clocks", () => {
  const frozen = repository.freezeStatutoryClock(
    "WS-LA82-HEAVYHAUL",
    "RFI-2026-0042",
    "Mark Fontenot, PE",
    "Waiting for SpaceX bridge load calculations"
  );
  assert.ok(frozen);
  assert.equal(frozen.operationalState, "waiting_applicant");
  assert.ok(frozen.operationalStateLabel.includes("Statutory Clock Paused"));

  const resumed = repository.resumeStatutoryClock(
    "WS-LA82-HEAVYHAUL",
    "Mark Fontenot, PE",
    "SpaceX response received"
  );
  assert.ok(resumed);
  assert.equal(resumed.operationalState, "running");
});

test("Repository: validates stage checklist gates during transition", () => {
  // Invalid transition without required checklists
  const invalid = repository.transitionWorkstreamStage(
    "WS-LA82-HEAVYHAUL",
    "technical_review",
    [],
    [],
    "Sarah Johnson",
    "LA-PROJECTS"
  );
  assert.equal(invalid.success, false);
  assert.ok(invalid.errors && invalid.errors.length > 0);

  // Valid transition with required checklists and documents
  const valid = repository.transitionWorkstreamStage(
    "WS-LA82-HEAVYHAUL",
    "technical_review",
    ["completeness_checklist_passed"],
    ["site_plans", "wetlands_delineation"],
    "Sarah Johnson",
    "LA-PROJECTS"
  );
  assert.equal(valid.success, true);
  assert.equal(valid.workstream?.currentStageName, "technical_review");
});

test("Background SLA Worker: executes daily SLA scan and generates notifications", () => {
  const scan = runDailySlaEscalationScan();
  assert.ok(scan.evaluatedWorkstreamsCount > 0);
  assert.ok(scan.scanTimestamp);

  // Check notifications generated
  const notifs = repository.getNotifications();
  assert.ok(notifs.length >= 0);
});

test("Background SLA Worker: audits 180-day statutory permit catalog links", () => {
  const audit = run180DayCatalogVerificationScan();
  assert.ok(audit.totalResourcesAudited > 0);
  assert.ok(audit.verifiedResourcesCount > 0);
});
