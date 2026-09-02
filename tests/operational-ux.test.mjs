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

after(async () => vite.close());

const data = await vite.ssrLoadModule("/lib/demo-data.ts");
const ux = await vite.ssrLoadModule("/lib/operational-ux.ts");
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");

const reviewerPersona = data.demoPersonas.find((persona) => persona.id === "jordan-lee");
const supervisorPersona = data.demoPersonas.find((persona) => persona.id === "maya-chen");
const customerPersona = data.demoPersonas.find((persona) => persona.id === "alex-martin");

test("role-aware projection gives an environmental reviewer a focused My Work queue", () => {
  const result = ux.getOperationalWorkItems({ persona: reviewerPersona });
  assert.equal(result.persona.workspace, "reviewer");
  assert.equal(result.persona.agencyCode, "LDEQ");
  assert.ok(result.items.some((item) => item.sourceId === "TASK-T003"));
  assert.ok(result.items.some((item) => item.kind === "document"));
  assert.ok(result.items.every((item) => item.whyHere));
  assert.ok(result.items.every((item) => item.removesFromQueue));
});

test("My Work groups preserve priority and expose the requested operational sections", () => {
  const { items } = ux.getOperationalWorkItems({ persona: reviewerPersona });
  const groups = ux.groupMyWork(items);
  assert.deepEqual(groups.map((group) => group.id), ["needs_action", "due_soon", "waiting", "recently_completed"]);
  assert.ok(groups.find((group) => group.id === "needs_action").items.length > 0);
  const groupedIds = groups.flatMap((group) => group.items.map((item) => item.id));
  assert.equal(new Set(groupedIds).size, groupedIds.length);
  const ordered = items.map((item) => item.priorityScore);
  assert.deepEqual(ordered, [...ordered].sort((a, b) => b - a));
});

test("available actions are permission-aware and customer-safe", () => {
  const reviewer = ux.getOperationalWorkItems({ persona: reviewerPersona });
  const stage = reviewer.items.find((item) => item.sourceId === "TASK-T003");
  assert.ok(ux.getAvailableActions(stage, reviewer.persona).includes("complete_step"));
  assert.ok(ux.getAvailableActions(stage, reviewer.persona).includes("mark_blocked"));

  const customer = ux.getOperationalWorkItems({ persona: customerPersona });
  const rfi = customer.items.find((item) => item.kind === "rfi");
  assert.ok(rfi);
  assert.deepEqual(ux.getAvailableActions(rfi, customer.persona), ["respond", "upload_documents"]);
  assert.deepEqual(ux.getAvailableActions(stage, ux.getOperationalPersona(customerPersona)), []);
});

test("completion requirements and handoff preview are readable without internal workflow terms", () => {
  const { items } = ux.getOperationalWorkItems({ persona: reviewerPersona });
  const stage = items.find((item) => item.sourceId === "TASK-T003");
  const requirements = ux.getCompletionRequirements(stage);
  const preview = ux.getCompletionPreview(stage);
  assert.equal(requirements.length, 4);
  assert.ok(requirements.some((requirement) => /determination/i.test(requirement.label)));
  assert.ok(preview.effects.some((effect) => /assign the next action/i.test(effect)));
  assert.ok(preview.nextOwner);
});

test("blocked, information, and escalation previews resolve human recipients", () => {
  const { items, persona } = ux.getOperationalWorkItems({ persona: reviewerPersona });
  const item = items.find((entry) => entry.sourceId === "TASK-T001") ?? items[0];
  const blocked = ux.getRecipientPreview(item, "mark_blocked", persona);
  const rfi = ux.getRecipientPreview(item, "request_information", persona);
  const escalation = ux.getRecipientPreview(item, "escalate", persona);
  assert.ok(blocked.recipients.some((recipient) => /CPRA|concierge/i.test(recipient.organization)));
  assert.ok(rfi.recipients.some((recipient) => /SpaceX/i.test(recipient.organization)));
  assert.ok(escalation.recipients[0].name);
});

test("supervisor sees exception work while customer projection strips internal detail", () => {
  const supervisor = ux.getOperationalWorkItems({ persona: supervisorPersona });
  assert.equal(supervisor.persona.workspace, "supervisor");
  assert.ok(supervisor.items.some((item) => item.statusTone === "red" || item.statusTone === "amber"));
  const customer = ux.getOperationalWorkItems({ persona: customerPersona });
  const sanitized = ux.sanitizeCustomerItem(customer.items[0]);
  assert.ok(sanitized.customerVisibleSummary);
  assert.equal("whyHere" in sanitized, false);
  assert.equal("ownerName" in sanitized, false);
});

test("repository mutations persist, audit, and notify for the operational workflows", () => {
  const initialAudit = repository.getAuditEvents().length;
  const initialNotifications = repository.getNotifications().length;
  const rfi = repository.createRFI({
    workstreamId: "WS-WASTEWATER-DELUGE",
    workstreamTitle: "Industrial Wastewater & Launch Deluge Retention Basin",
    requestingOrgId: "org-ldeq",
    requestingOrgCode: "LDEQ",
    recipientOrgId: "org-spacex",
    recipientOrgCode: "SPACEX",
    title: "Hydrology clarification",
    questionText: "Please confirm the revised discharge sampling interval.",
    technicalReason: "Required for the technical determination.",
    responseDeadline: "2026-09-05",
    actorName: "Jordan Lee",
  });
  assert.equal(rfi.status, "issued");
  repository.dispatchNotification({ userId: "user-spacex", title: "RFI action", message: rfi.questionText, type: "action_required", urgency: "high" });
  const response = repository.submitRfiResponse({ rfiId: rfi.id, submittedByName: "Maya Chen", responseText: "Sampling interval confirmed.", actorOrgName: "SPACEX" });
  assert.ok(response);
  assert.ok(repository.acceptRfiResponse({ rfiId: rfi.id, actorName: "Jordan Lee", actorOrgName: "LDEQ" }));
  assert.equal(repository.getRFIs().find((entry) => entry.id === rfi.id)?.status, "accepted");
  assert.ok(repository.getAuditEvents().length >= initialAudit + 3);
  assert.ok(repository.getNotifications().length >= initialNotifications + 1);
});

test("repository supports structured agency blockers, escalation, transfer, and exact document version review", () => {
  const blocked = repository.markWorkstreamBlocked({
    workstreamId: "WS-LA82-HEAVYHAUL",
    reason: "CPRA concurrence is needed before the bridge release.",
    waitingOn: "CPRA",
    actorName: "Jordan Lee",
    actorOrgName: "LDEQ",
  });
  assert.equal(blocked?.operationalState, "blocked");
  assert.ok(repository.escalateWorkstream({ workstreamId: "WS-LA82-HEAVYHAUL", problemType: "Cross-agency assistance", actorName: "Jordan Lee", actorOrgName: "LDEQ" }));
  assert.ok(repository.transferWorkstream({ workstreamId: "WS-LA82-HEAVYHAUL", transferType: "Ask another reviewer", targetName: "Maya Chen", actorName: "Jordan Lee", actorOrgName: "LDEQ" }));
  const review = repository.reviewDocumentVersion({ versionId: "doc-v-drainage-v12", agencyCode: "CPRA", decision: "approved_with_conditions", actorName: "Jean-Paul Guidry", comments: "Concurrence recorded." });
  assert.equal(review?.reviewStatus, "approved");
  assert.equal(review?.status, "approved_with_conditions");
});

test("complete step is gated by the configured workflow engine", () => {
  const denied = repository.completeWorkstreamStage({
    workstreamId: "WS-LA82-HEAVYHAUL",
    completedChecklists: [],
    providedDocs: [],
    actorName: "Jordan Lee",
    actorOrgName: "LDEQ",
  });
  assert.equal(denied.success, false);
  assert.ok(denied.errors?.some((error) => /missing/i.test(error)));
  const completed = repository.completeWorkstreamStage({
    workstreamId: "WS-LA82-HEAVYHAUL",
    completedChecklists: ["completeness_checklist_passed", "drainage_concurrence_received", "ecological_signoff"],
    providedDocs: ["site_plans", "wetlands_delineation", "drainage_model", "mitigation_plan"],
    actorName: "Jordan Lee",
    actorOrgName: "LDEQ",
  });
  assert.equal(completed.success, true);
  assert.ok(completed.nextOwner);
});
