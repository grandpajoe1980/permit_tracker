import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false },
});

after(async () => vite.close());

const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
const ux = await vite.ssrLoadModule("/lib/operational-ux.ts");
const data = await vite.ssrLoadModule("/lib/demo-data.ts");
const descriptors = await vite.ssrLoadModule("/lib/action-descriptors.ts");

const jordan = data.demoPersonas.find((p) => p.id === "jordan-lee");
const alex = data.demoPersonas.find((p) => p.id === "alex-martin");
const sarah = data.demoPersonas.find((p) => p.id === "sarah-johnson");

test("Request clarification succeeds for an unlinked intake request", async () => {
  repository.resetE2EDemo();
  const createdReq = repository.createCustomerRequest({
    projectId: repository.getProject().id,
    requestType: "permit_authorization",
    title: "Unlinked Coastal Review",
    description: "Coastal review needing clarification",
    submittedByUserId: "user-alex-martin",
    submittedByName: "Alex Martin",
    scheduleImportance: "normal",
  });
  const testRequestId = createdReq.id;

  const requestBefore = repository.getCustomerRequests().find((r) => r.id === testRequestId);
  assert.ok(requestBefore);
  assert.equal(requestBefore.status, "submitted");
  assert.equal(requestBefore.relatedWorkstreamId, undefined);

  // Jordan (or Coordinator) requests clarification
  const clarifyRes = await repository.requestCustomerIntakeClarificationPersisted({
    requestId: testRequestId,
    notes: "Please provide wetlands delineation map and boundary coordinates.",
  });

  assert.ok(!clarifyRes.error, "Clarification request should succeed");
  assert.equal(clarifyRes.data?.status, "pending_customer");
  assert.equal(clarifyRes.data?.itsmState, "pending_customer");

  // Alex (customer) now sees this request in their actionable queue
  const alexQueue = ux.getOperationalWorkItems({
    persona: alex,
    customerRequests: repository.getCustomerRequests(),
    workstreams: repository.getWorkstreams(),
    rfis: repository.getRFIs(),
  }).items;

  const alexItem = alexQueue.find((i) => i.sourceId === testRequestId);
  assert.ok(alexItem, "Alex should see clarification request");
  assert.equal(alexItem.requiresCurrentUserAction, true, "Needs customer action to clarify");
});

test("Workstream RFI succeeds only for a real linked workstream", async () => {
  repository.resetE2EDemo();

  // Attempt to create RFI on fake non-existent workstream
  const fakeRes = await repository.createRFIPersisted({
    workstreamId: "WS-DOES-NOT-EXIST",
    workstreamTitle: "Nonexistent Workstream",
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Fake RFI",
    questionText: "Impossible question",
    technicalReason: "Should fail",
    responseDeadline: "2026-10-01",
    actorName: "Jordan Lee",
  });

  assert.ok(fakeRes.error, "Should return error for missing workstream");
  assert.match(fakeRes.error.message, /workstream not found/i);

  // Real workstream
  const realWs = repository.getWorkstreams()[0];
  assert.ok(realWs, "Real workstream exists");

  const realRes = await repository.createRFIPersisted({
    workstreamId: realWs.id,
    workstreamTitle: realWs.title,
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Emission calculations",
    questionText: "Please provide revised stack emission rate",
    technicalReason: "Required under Section 112",
    responseDeadline: "2026-10-15",
    actorName: "Jordan Lee",
  });

  assert.ok(!realRes.error, "Should succeed for valid workstream");
  assert.ok(realRes.data);
  assert.equal(realRes.data.workstreamId, realWs.id);
});

test("Retry does not create duplicate RFIs", async () => {
  repository.resetE2EDemo();
  const ws = repository.getWorkstreams()[0];

  const params = {
    workstreamId: ws.id,
    workstreamTitle: ws.title,
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Retry Test RFI",
    questionText: "Exact duplicate question for testing retry idempotency",
    technicalReason: "Testing retry",
    responseDeadline: "2026-10-20",
    actorName: "Jordan Lee",
  };

  const firstCall = await repository.createRFIPersisted(params);
  assert.ok(!firstCall.error);
  const firstId = firstCall.data?.id;
  const firstCode = firstCall.data?.code;

  // Retry with same params
  const secondCall = await repository.createRFIPersisted({
    ...params,
    id: firstId,
    code: firstCode,
  });

  assert.ok(!secondCall.error);
  assert.equal(secondCall.data?.id, firstId, "Must return existing RFI");
  assert.equal(secondCall.data?.code, firstCode, "Must return existing code");

  // Verify total count did not duplicate
  const matchingRfis = repository.getRFIs().filter((r) => r.id === firstId);
  assert.equal(matchingRfis.length, 1, "Must have exactly 1 RFI record");
});

test("Customer sees the correct request, responds, and reviewer sees exact response/documents", async () => {
  repository.resetE2EDemo();
  const ws = repository.getWorkstreams()[0];

  const rfiRes = await repository.createRFIPersisted({
    workstreamId: ws.id,
    workstreamTitle: ws.title,
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Exact Document Version Test RFI",
    questionText: "Please upload revised drawing package",
    technicalReason: "Plan approval",
    responseDeadline: "2026-10-30",
    actorName: "Jordan Lee",
  });

  const rfi = rfiRes.data;
  assert.ok(rfi);

  // Alex responds with exact document version
  const exactDocVersionId = "doc-ver-seed-drainage-20260907";
  const resp = repository.submitRfiResponse({
    rfiId: rfi.id,
    submittedByName: "Alex Martin",
    actorOrgName: "SPACEX",
    responseText: "Submitted drawing package per requested specs.",
    attachedDocumentVersionIds: [exactDocVersionId],
  });

  assert.ok(resp);
  assert.deepEqual(resp.attachedDocumentVersionIds, [exactDocVersionId]);

  // Jordan views RFI in queue
  const jordanQueue = ux.getOperationalWorkItems({
    persona: jordan,
    rfis: repository.getRFIs(),
    workstreams: repository.getWorkstreams(),
  }).items;

  const rfiItem = jordanQueue.find((i) => i.id === rfi.code);
  assert.ok(rfiItem);
  assert.equal(rfiItem.hasRfiResponse, true);
  assert.equal(rfiItem.documents.length, 1);
  assert.equal(rfiItem.documents[0].id, exactDocVersionId);
});

test("Accepting one RFI does not clear unrelated holds", async () => {
  repository.resetE2EDemo();
  const ws = repository.getWorkstreams()[0];

  // Create RFI 1
  const rfi1 = repository.createRFI({
    workstreamId: ws.id,
    workstreamTitle: ws.title,
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Hold RFI 1",
    questionText: "Question 1",
    technicalReason: "Reason 1",
    responseDeadline: "2026-10-01",
    actorName: "Jordan Lee",
  });

  // Create RFI 2 on same workstream
  const rfi2 = repository.createRFI({
    workstreamId: ws.id,
    workstreamTitle: ws.title,
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Hold RFI 2",
    questionText: "Question 2",
    technicalReason: "Reason 2",
    responseDeadline: "2026-10-05",
    actorName: "Jordan Lee",
  });

  // Submit response for RFI 1 only
  repository.submitRfiResponse({
    rfiId: rfi1.id,
    submittedByName: "Alex Martin",
    responseText: "Response 1",
    actorOrgName: "SPACEX",
  });

  // Jordan accepts RFI 1
  const acceptRes = repository.acceptRfiResponse({
    rfiId: rfi1.id,
    actorName: "Jordan Lee",
    actorOrgName: "LDEQ",
  });

  assert.ok(acceptRes);
  assert.equal(rfi1.status, "accepted");

  // RFI 2 is still issued and unaccepted
  assert.equal(rfi2.status, "issued");

  // The workstream hold must NOT have been cleared because RFI 2 is still outstanding!
  const wsAfter = repository.getWorkstreamById(ws.id);
  assert.ok(wsAfter);
  assert.equal(wsAfter.operationalState, "waiting_applicant", "Workstream must remain waiting because RFI 2 is outstanding");
  assert.match(wsAfter.waitingReason ?? "", new RegExp(rfi2.code), "Waiting reason must point to RFI 2");
});

test("Action descriptors provide coherent eligibility and reasons", () => {
  const dummyItem = {
    id: "test-req",
    sourceId: "test-req",
    kind: "customer_request",
    title: "Test Intake",
    projectName: "Starbase",
    workstreamTitle: "Unassigned",
    statusTone: "amber",
    statusLabel: "SUBMITTED",
    whyHere: "Awaiting triage",
    whatToDo: "Triage into workflow",
    removesFromQueue: "Triage",
    ageLabel: "1d ago",
    scheduleImpact: "None",
    priorityScore: 50,
    isCriticalPath: false,
    ownerName: "Unassigned",
    ownerOrganization: "State Project Office",
    requiredInputs: [],
    documents: [],
    requiresCurrentUserAction: false,
  };

  const jordanDescriptor = descriptors.getActionDescriptor("request_clarification", dummyItem, jordan);
  assert.equal(jordanDescriptor.eligible, false, "Agency reviewer cannot request intake clarification");
  assert.ok(jordanDescriptor.disabledReason, "Explains why action is disabled");

  const sarahDescriptor = descriptors.getActionDescriptor("request_clarification", dummyItem, sarah);
  assert.equal(sarahDescriptor.eligible, true, "State office can request intake clarification");
  assert.equal(sarahDescriptor.isPrimary, true);

  const rfiDescriptor = descriptors.getActionDescriptor("request_information", dummyItem, sarah);
  assert.equal(rfiDescriptor.eligible, false, "Cannot create workstream RFI without linked workstream");
  assert.match(rfiDescriptor.disabledReason ?? "", /requires a linked workstream/i);
});
