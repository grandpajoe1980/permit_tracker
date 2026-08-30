import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { after } from "node:test";
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
  getOperationalPersona,
  getOperationalWorkItems,
  getAvailableActions,
} = await vite.ssrLoadModule("/lib/operational-ux.ts");
const { downloadDocumentVersion } = await vite.ssrLoadModule("/lib/document-download-utils.ts");

test("E2E Workflow: Submitter creates task/permit -> Gov Reviewer assigned work item in queue", () => {
  const submitterPersona = getOperationalPersona({
    id: "alex-martin",
    name: "Alex Martin",
    role: "SpaceX Regulatory Engineering",
    email: "alex.martin@spacex.com",
    badge: "Applicant",
    agency: "SPACEX",
    organization: "Space Exploration Technologies Corp. (SpaceX)",
  });

  const reviewerPersona = getOperationalPersona({
    id: "jordan-lee",
    name: "Jordan Lee",
    role: "LDEQ Lead Environmental Scientist",
    email: "jordan.lee@la.gov",
    badge: "Reviewer",
    agency: "LDEQ",
    organization: "Louisiana Department of Environmental Quality",
  });

  // 1. Submitter submits a new permit tracking request
  const createdRequest = repository.createCustomerRequest({
    projectId: "proj-spacex-pecan-island",
    requestType: "permit_authorization",
    title: "Air Quality Construction Permit Track",
    description: "Submitter filing for Pecan Island fuel storage air quality permit.",
    knownAgencyCode: "LDEQ",
    knownPermitTypeId: "cat-ldeq-air-part70",
    submittedByUserId: "alex-martin",
    submittedByName: "Alex Martin",
    blocksActiveWork: true,
  });

  assert.ok(createdRequest.id);
  assert.ok(createdRequest.confirmationNumber);

  // 2. Compute operational work items for government reviewer
  const reviewerData = getOperationalWorkItems({
    persona: {
      id: "jordan-lee",
      name: "Jordan Lee",
      role: "LDEQ Lead Environmental Scientist",
      email: "jordan.lee@la.gov",
      badge: "Reviewer",
      agency: "LDEQ",
    },
    workstreams: repository.getWorkstreams(),
    customerRequests: repository.getCustomerRequests(),
    rfis: repository.getRFIs(),
    coordinationRequests: repository.getCoordinationRequests(),
  });

  const matchingItem = reviewerData.items.find((item) => item.id === createdRequest.id);
  assert.ok(matchingItem, "Gov reviewer should have the customer request in their operational work queue");
  assert.equal(matchingItem.ownerOrganization, "LDEQ");
  assert.equal(matchingItem.statusTone, "red");

  // 3. Actions available for government reviewer
  const actions = getAvailableActions(matchingItem, reviewerPersona);
  assert.ok(actions.includes("complete_step"), "Reviewer can complete/accept step");
  assert.ok(actions.includes("request_information"), "Reviewer can request information (RFI)");
  assert.ok(actions.includes("mark_blocked"), "Reviewer can mark inter-agency blocker");
  assert.ok(actions.includes("escalate"), "Reviewer can escalate");
});

test("E2E Workflow: Reviewer requests info (RFI) -> Clock pauses -> Submitter responds -> Reviewer accepts & resumes", () => {
  const wsId = "WS-WASTEWATER-DELUGE";
  const ws = repository.getWorkstreamById(wsId);
  assert.ok(ws, "Workstream should exist");

  const submitterPersona = getOperationalPersona({
    id: "alex-martin",
    name: "Alex Martin",
    role: "SpaceX Regulatory Engineering",
    email: "alex.martin@spacex.com",
    badge: "Applicant",
    agency: "SPACEX",
    organization: "Space Exploration Technologies Corp. (SpaceX)",
  });

  const reviewerPersona = getOperationalPersona({
    id: "jordan-lee",
    name: "Jordan Lee",
    role: "LDEQ Lead Environmental Scientist",
    email: "jordan.lee@la.gov",
    badge: "Reviewer",
    agency: "LDEQ",
    organization: "Louisiana Department of Environmental Quality",
  });

  // Step 1: Reviewer creates RFI to SpaceX
  const rfi = repository.createRFI({
    workstreamId: wsId,
    workstreamTitle: ws.title,
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Clarification on Deluge Water Retention Basin Sizing",
    questionText: "Please provide the hydrology model for deluge basin 100-year storm retention.",
    technicalReason: "Required to verify compliance with Louisiana Water Quality Standards.",
    responseDeadline: "2026-09-10",
    actorName: "Jordan Lee",
  });

  assert.ok(rfi.id);
  assert.equal(rfi.status, "issued");

  // Verify workstream paused on applicant
  const pausedWs = repository.getWorkstreamById(wsId);
  assert.equal(pausedWs.operationalState, "waiting_applicant");
  assert.equal(pausedWs.waitingOnEntity, "SPACEX");

  // Step 2: Submitter sees RFI in their queue and has action to respond
  const submitterData = getOperationalWorkItems({
    persona: {
      id: "alex-martin",
      name: "Alex Martin",
      role: "SpaceX Regulatory Engineering",
      email: "alex.martin@spacex.com",
      badge: "Applicant",
      agency: "SPACEX",
      organization: "Space Exploration Technologies Corp. (SpaceX)",
    },
    rfis: repository.getRFIs(),
    workstreams: repository.getWorkstreams(),
  });

  const submitterRfiItem = submitterData.items.find(
    (item) => item.sourceId === rfi.id || item.id === rfi.code || item.title.includes("Deluge Water Retention")
  );
  assert.ok(submitterRfiItem, "Submitter should see the open RFI in their queue");
  const submitterActions = getAvailableActions(submitterRfiItem, submitterPersona);
  assert.ok(submitterActions.includes("respond"), "Submitter should have respond action");

  // Step 3: Submitter submits RFI response
  const response = repository.submitRfiResponse({
    rfiId: rfi.id,
    submittedByName: "Alex Martin",
    responseText: "Hydrology model attached in Package HM-204 showing 125% capacity for 100-year storm.",
    actorOrgName: "SpaceX",
  });
  assert.ok(response);
  assert.equal(rfi.status, "submitted_by_applicant");

  // Workstream updates to waiting on government reviewer
  const waitingGovWs = repository.getWorkstreamById(wsId);
  assert.equal(waitingGovWs.operationalState, "waiting_government");

  // Step 4: Gov Reviewer sees response in queue with accept action
  const reviewerDataAfterResponse = getOperationalWorkItems({
    persona: {
      id: "jordan-lee",
      name: "Jordan Lee",
      role: "LDEQ Lead Environmental Scientist",
      email: "jordan.lee@la.gov",
      badge: "Reviewer",
      agency: "LDEQ",
    },
    rfis: repository.getRFIs(),
    workstreams: repository.getWorkstreams(),
  });

  const reviewerRfiItem = reviewerDataAfterResponse.items.find(
    (item) => item.sourceId === rfi.id || item.id === rfi.code || item.title.includes("Deluge Water Retention")
  );
  assert.ok(reviewerRfiItem);
  const reviewerActions = getAvailableActions(reviewerRfiItem, reviewerPersona);
  assert.ok(reviewerActions.includes("accept_rfi_response"), "Reviewer can accept RFI response");

  // Step 5: Reviewer accepts response -> review resumes
  const accepted = repository.acceptRfiResponse({
    rfiId: rfi.id,
    actorName: "Jordan Lee",
    actorOrgName: "LDEQ",
    notes: "Hydrology model verified and accepted. Review clock resumed.",
  });
  assert.ok(accepted);
  assert.equal(rfi.status, "accepted");

  const resumedWs = repository.getWorkstreamById(wsId);
  assert.equal(resumedWs.operationalState, "running");
  assert.equal(resumedWs.waitingReason, undefined);
});

test("E2E Workflow: Inter-agency blocker & coordination -> Clear blocker restores running state", () => {
  const wsId = "WS-LA82-HEAVYHAUL";
  const ws = repository.getWorkstreamById(wsId);
  assert.ok(ws);

  // Reviewer marks blocked on USACE concurrence
  const blockedWs = repository.markWorkstreamBlocked({
    workstreamId: wsId,
    reason: "Waiting for USACE concurrence on culvert load ratings",
    waitingOn: "USACE",
    actorName: "Mark Fontenot",
    actorOrgName: "DOTD",
    pauseClock: false,
  });

  assert.equal(blockedWs.operationalState, "blocked");
  assert.equal(blockedWs.waitingOnEntity, "USACE");

  // Clear blocker
  const unblockedWs = repository.clearWorkstreamBlocker({
    workstreamId: wsId,
    resolutionNotes: "USACE bridge and culvert load concurrence received on Aug 30.",
    actorName: "Mark Fontenot",
    actorOrgName: "DOTD",
  });

  assert.equal(unblockedWs.operationalState, "running");
  assert.equal(unblockedWs.waitingReason, undefined);
  assert.equal(unblockedWs.waitingOnEntity, undefined);
});

test("E2E Workflow: Reviewer completes stage -> Advances to next stage and transitions lead agency", () => {
  const wsId = "WS-WETLANDS-PAD-A";
  const ws = repository.getWorkstreamById(wsId);
  assert.ok(ws);

  const initialStage = ws.currentStageName;

  // Complete stage
  const result = repository.completeWorkstreamStage({
    workstreamId: wsId,
    completedChecklists: ["completeness_checklist_passed"],
    providedDocs: ["site_plans", "wetlands_delineation"],
    actorName: "Jean-Paul Guidry",
    actorOrgName: "CPRA",
  });

  assert.equal(result.success, true);
  assert.ok(result.workstream);
  assert.notEqual(result.workstream.currentStageName, initialStage, "Stage should advance");
});

test("E2E Workflow: Document download verifies SHA-256 and handles downloads cleanly", async () => {
  const bytes = Buffer.from("SpaceX Pecan Island Official Certified Engineering Document");
  const sha256Hash = crypto.createHash("sha256").update(bytes).digest("hex");

  const version = {
    id: "ver-test-001",
    documentId: "doc-test-001",
    versionTag: "v1.0",
    versionNumber: 1,
    versionLabel: "v1.0",
    fileName: "pecan-island-site-plan.pdf",
    fileSizeBytes: bytes.length,
    mimeType: "application/pdf",
    storagePath: "vault/pecan-island-site-plan.pdf",
    storageUri: "vault/pecan-island-site-plan.pdf",
    sha256Hash,
    uploadedByName: "SpaceX Engineering",
    uploadedAt: new Date().toISOString(),
    isMalwareClean: true,
  };

  const document = {
    id: "doc-test-001",
    projectId: "proj-spacex-pecan-island",
    title: "Pecan Island Launch Complex Master Site Plan",
    category: "engineering_drawing",
    ownerOrgCode: "SPACEX",
    currentVersionNumber: 1,
    currentVersionId: version.id,
    isConfidential: false,
    versions: [version],
    agencyReviews: [],
  };

  const result = await downloadDocumentVersion(document, version, async () => ({
    blob: new Blob([bytes], { type: "application/pdf" }),
    error: null,
  }));

  assert.equal(result.success, true);
  assert.equal(result.error, null);
});
