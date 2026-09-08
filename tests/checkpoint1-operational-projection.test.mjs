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

const data = await vite.ssrLoadModule("/lib/demo-data.ts");
const ux = await vite.ssrLoadModule("/lib/operational-ux.ts");
const journeyModule = await vite.ssrLoadModule("/lib/workflow-journey.ts");
const mappings = await vite.ssrLoadModule("/lib/supabase/mappings.ts");

const jordan = data.demoPersonas.find((p) => p.id === "jordan-lee");
const alex = data.demoPersonas.find((p) => p.id === "alex-martin");
const sarah = data.demoPersonas.find((p) => p.id === "sarah-johnson");

test("Unlinked intake request has no fake workstream and displays Unassigned", () => {
  const rawRequest = {
    id: "PATH-DEMO-REQ-INTAKE",
    confirmation_number: "REQ-SPACEPORT-2026-0001",
    project_id: "00000000-0000-0000-0000-000000000001",
    request_type: "permit_authorization",
    title: "Air Quality Construction Authorization",
    description: "New launch pad emissions review",
    status: "submitted",
    submitted_by_user_id: "user-alex-martin",
    submitted_by_name: "Alex Martin",
  };

  const domain = mappings.customerRequestRowToDomain(rawRequest);
  assert.equal(domain.relatedWorkstreamId, undefined);
  assert.equal(domain.assignedToUserId, undefined);
  assert.equal(domain.assignedToUserName, undefined);
  assert.equal(domain.submittedByName, "Alex Martin");

  const jordanView = ux.getOperationalWorkItems({
    persona: jordan,
    customerRequests: [domain],
    workstreams: [],
    rfis: [],
  }).items;

  const intakeItem = jordanView.find((i) => i.sourceId === "PATH-DEMO-REQ-INTAKE");
  assert.ok(intakeItem, "Intake item is visible in Jordan's scope");
  assert.equal(intakeItem.workstreamId, undefined, "Must NOT have fake WS-CUSTOMER-INTAKE");
  assert.equal(intakeItem.ownerName, "Unassigned", "Must display Unassigned, NOT Alex Martin");
  assert.equal(intakeItem.submittedByName, "Alex Martin", "Exposes submittedByName separately");
  assert.equal(
    intakeItem.requiresCurrentUserAction,
    false,
    "Jordan (agency reviewer) does not have direct action on unassigned unrouted intake"
  );

  const sarahView = ux.getOperationalWorkItems({
    persona: sarah,
    customerRequests: [domain],
    workstreams: [],
    rfis: [],
  }).items.find((i) => i.sourceId === "PATH-DEMO-REQ-INTAKE");

  assert.ok(sarahView);
  assert.equal(sarahView.ownerName, "Unassigned");
  assert.equal(sarahView.requiresCurrentUserAction, true, "State office / admin has triage action");

  const projection = ux.toOperationalRecordProjection(intakeItem);
  assert.equal(projection.parentWorkstreamId, undefined);
  assert.equal(projection.assigneeName, "Unassigned");
  assert.equal(projection.submitterName, "Alex Martin");
});

test("Workstream hydration contains its linked RFIs and responses", () => {
  const rawWsRow = {
    id: "ws-test-1",
    code: "WS-TEST-1",
    title: "Test Air Permit",
    project_id: "00000000-0000-0000-0000-000000000001",
    operational_state: "running",
  };

  const linkedRfis = [
    {
      id: "rfi-1",
      code: "RFI-2026-001",
      title: "Stack height calculation",
      workstreamId: "ws-test-1",
      workstreamTitle: "Test Air Permit",
      requestingOrgCode: "LDEQ",
      recipientOrgCode: "SPACEX",
      questionText: "Please provide calculations",
      issuedDate: "2026-09-01",
      responseDeadline: "2026-09-15",
      status: "issued",
      clockImpact: "clock_paused",
      scheduleImpactDays: 14,
      requiredDocumentTypes: ["Calculation sheet"],
      responses: [
        {
          id: "resp-1",
          rfiId: "rfi-1",
          submittedDate: "2026-09-05",
          submittedByUserName: "Alex Martin",
          responseText: "Attached calculation",
          attachedDocumentVersionIds: ["doc-v-1"],
        },
      ],
    },
  ];

  const ws = mappings.workstreamRowToDomain(rawWsRow, { rfis: linkedRfis });
  assert.equal(ws.rfis.length, 1);
  assert.equal(ws.rfis[0].id, "rfi-1");
  assert.equal(ws.rfis[0].responses?.length, 1);
  assert.equal(ws.rfis[0].responses?.[0].id, "resp-1");
});

test("Accepted RFI is terminal and not waiting", () => {
  const acceptedRfi = {
    id: "rfi-accepted",
    code: "RFI-2026-ACCEPTED",
    title: "Emissions Model Acceptance",
    workstreamId: "ws-test-1",
    workstreamTitle: "Test Air Permit",
    requestingOrgCode: "LDEQ",
    recipientOrgCode: "SPACEX",
    questionText: "Emissions model parameters",
    issuedDate: "2026-08-15",
    responseDeadline: "2026-08-30",
    status: "accepted",
    clockImpact: "clock_running",
    scheduleImpactDays: 0,
    requiredDocumentTypes: [],
    responses: [
      {
        id: "resp-acc",
        rfiId: "rfi-accepted",
        submittedDate: "2026-08-25",
        submittedByUserName: "Alex Martin",
        responseText: "Accepted response",
        reviewDecision: "accepted",
      },
    ],
  };

  const workItems = ux.getOperationalWorkItems({
    persona: jordan,
    rfis: [acceptedRfi],
    workstreams: [],
  }).items;

  const item = workItems.find((i) => i.id === "RFI-2026-ACCEPTED");
  assert.ok(item, "Item must exist");
  assert.equal(item.waitLabel, undefined, "Terminal RFI must have NO wait label");
  assert.equal(item.waitingOn, undefined, "Terminal RFI must have NO waiting party");
  assert.equal(item.requiresCurrentUserAction, false, "Accepted RFI is not awaiting action");
  assert.equal(ux.isTerminalWorkItem(item), true, "Identified as terminal");

  const groups = ux.groupMyWork([item]);
  const waitingGroup = groups.find((g) => g.id === "waiting");
  const completedGroup = groups.find((g) => g.id === "recently_completed");

  assert.equal(waitingGroup?.items.length, 0, "Terminal RFI must NOT be in waiting group");
  assert.equal(completedGroup?.items.length, 1, "Terminal RFI must be in recently_completed group");
});

test("Completed work with no stage runs remains complete and reports unavailable history", () => {
  const completedWs = {
    id: "ws-comp-1",
    title: "Completed Utility Workstream",
    operationalState: "complete",
    operationalStateLabel: "Complete",
    stages: [
      {
        id: "st-1",
        workflowVersionId: "v1",
        stageKey: "intake",
        name: "Intake",
        customerVisibilityLabel: "Intake",
        sequenceOrder: 1,
        responsibleOrgId: "LDEQ",
        requiredInputs: [],
        canRunInParallel: false,
        isMilestoneGate: false,
      },
      {
        id: "st-2",
        workflowVersionId: "v1",
        stageKey: "review",
        name: "Technical Review",
        customerVisibilityLabel: "Technical Review",
        sequenceOrder: 2,
        responsibleOrgId: "LDEQ",
        requiredInputs: [],
        canRunInParallel: false,
        isMilestoneGate: false,
      },
    ],
    stageRuns: [],
  };

  const journey = journeyModule.buildWorkflowJourney(completedWs);
  assert.equal(journey.summary, "Step history not recorded");
});

test("Multiple outstanding RFIs/dependencies remain independently visible", () => {
  const rfi1 = {
    id: "rfi-101",
    code: "RFI-101",
    title: "Question 1",
    workstreamId: "ws-multi",
    workstreamTitle: "Multi RFI Permit",
    requestingOrgCode: "LDEQ",
    recipientOrgCode: "SPACEX",
    questionText: "Question 1",
    issuedDate: "2026-09-01",
    responseDeadline: "2026-09-10",
    status: "issued",
    clockImpact: "clock_paused",
    scheduleImpactDays: 5,
    requiredDocumentTypes: [],
  };

  const rfi2 = {
    id: "rfi-102",
    code: "RFI-102",
    title: "Question 2",
    workstreamId: "ws-multi",
    workstreamTitle: "Multi RFI Permit",
    requestingOrgCode: "LDEQ",
    recipientOrgCode: "SPACEX",
    questionText: "Question 2",
    issuedDate: "2026-09-02",
    responseDeadline: "2026-09-12",
    status: "issued",
    clockImpact: "clock_paused",
    scheduleImpactDays: 7,
    requiredDocumentTypes: [],
  };

  const alexView = ux.getOperationalWorkItems({
    persona: alex,
    rfis: [rfi1, rfi2],
    workstreams: [],
  }).items;

  const item1 = alexView.find((i) => i.id === "RFI-101");
  const item2 = alexView.find((i) => i.id === "RFI-102");

  assert.ok(item1, "RFI-101 visible");
  assert.ok(item2, "RFI-102 visible");
  assert.notEqual(item1.id, item2.id);
  assert.equal(item1.requiresCurrentUserAction, true);
  assert.equal(item2.requiresCurrentUserAction, true);
});
