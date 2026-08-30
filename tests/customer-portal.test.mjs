import assert from "node:assert/strict";
import test, { after, beforeEach } from "node:test";
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

const portal = await vite.ssrLoadModule("/lib/customer-portal.ts");
const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const repositoryModule = await vite.ssrLoadModule("/lib/repository.ts");
const demo = await vite.ssrLoadModule("/lib/demo-data.ts");
const ux = await vite.ssrLoadModule("/lib/operational-ux.ts");

const { repository } = repositoryModule;

beforeEach(() => repository.resetE2EDemo());

test("project contacts use realistic organizations, state emails, and customer visibility", () => {
  const joe = portal.projectProfiles.find((profile) => profile.fullName === "Joe Skaggs");
  const consultant = portal.projectProfiles.find((profile) => profile.fullName === "Dr. Aris Thorne");
  assert.equal(joe?.workEmail, "joe.skaggs@la.gov");
  assert.equal(joe?.isCustomerVisible, false);
  assert.match(consultant?.projectRole ?? "", /representing SpaceX/i);
  assert.ok(portal.customerVisibleProfiles().every((profile) => profile.fullName !== "Joe Skaggs"));
});

test("customer overview derives schedule, blockers, actions, and upcoming events", () => {
  const project = repository.getProject();
  const overview = portal.getProjectOverview(project, repository.getWorkstreams(), repository.getCustomerRequests(), repository.getExternalFilings());
  assert.equal(overview.project.code, "SPACEX-PECAN-ISLAND");
  assert.ok(overview.baseline);
  assert.ok(overview.forecast);
  assert.ok(overview.nextMilestone.title);
  assert.ok(overview.governmentActions.length > 0);
  assert.ok(overview.customerActions.length > 0);
  assert.ok(overview.upcomingEvents.length > 0);
});

test("customer requests produce confirmation, audit, and government notification", () => {
  const request = repository.createCustomerRequest({
    projectId: "proj-spacex-pecan",
    requestType: "escalation",
    title: "Critical path coordination help",
    description: "CPRA concurrence is needed before the launch road package can proceed.",
    requestedOutcome: "State project office intervention",
    locationOrAffectedArea: "Pecan Island launch road",
    scheduleImportance: "critical",
    knownAgencyCode: "CPRA",
    submittedByUserId: "user-alex-martin",
    submittedByName: "Alex Martin",
    relatedWorkstreamId: "WS-LA82-HEAVYHAUL",
    blocksActiveWork: true,
    attachmentDocumentVersionIds: [],
  });
  assert.match(request.confirmationNumber, /^PATH-\d{4}-0001$/);
  assert.equal(repository.getCustomerRequests()[0].requestType, "escalation");
  assert.ok(repository.getAuditEvents().some((event) => event.entityId === request.confirmationNumber && event.actionType === "customer_request_submitted"));
  assert.ok(repository.getNotifications().some((notification) => notification.metadata?.confirmationNumber === request.confirmationNumber));
});

test("draft customer requests are tracked without notifying government triage", () => {
  const draft = repository.createCustomerRequest({
    projectId: "proj-spacex-pecan",
    requestType: "concierge",
    title: "Help me identify the right permit",
    description: "I need help understanding which authorization applies.",
    submittedByUserId: "user-alex-martin",
    submittedByName: "Alex Martin",
    blocksActiveWork: false,
    attachmentDocumentVersionIds: [],
    status: "draft",
  });
  assert.equal(draft.status, "draft");
  assert.equal(repository.getNotifications().length, 0);
  assert.equal(repository.getCustomerRequests().length, 1);
});

test("profile edits enforce self-service authorization and preserve role ownership", () => {
  const updated = repository.updateProfile({
    userId: "user-alex-martin",
    actorUserId: "user-alex-martin",
    updates: { officePhone: "(337) 555-0199", availabilityStatus: "limited" },
  });
  assert.equal(updated?.officePhone, "(337) 555-0199");
  assert.equal(repository.updateProfile({ userId: "user-alex-martin", actorUserId: "user-jordan-lee", updates: { projectRole: "Administrator" } }), null);
  assert.equal(repository.getProfileByUserId("user-alex-martin")?.projectRole, "Customer project lead");
  assert.ok(repository.getAuditEvents().some((event) => event.actionType === "profile_updated"));
});

test("external filings and document versions retain authoritative metadata", () => {
  const filing = repository.createExternalFiling({
    projectId: "proj-spacex-pecan",
    workstreamId: "WS-WETLANDS-PAD-A",
    permitTypeId: "cat-usace-404",
    authorityOrganizationId: "org-usace",
    authorityOrganizationName: "U.S. Army Corps of Engineers",
    filingMethod: "EXTERNAL_PORTAL",
    officialPortalUrl: "https://crms.usace.army.mil",
    externalReferenceNumber: "USACE-E2E-001",
    externalStatus: "under_review",
    authoritativeSystemName: "USACE Regulatory Request System",
    receiptDocumentVersionIds: [],
  });
  assert.equal(repository.updateExternalFiling(filing.id, { externalStatus: "approved" }, "Sarah Johnson", "Louisiana State Project Office")?.externalStatus, "approved");
  const document = repository.getDocuments()[0];
  const version = repository.createDocumentVersion(document.id, {
    versionNumber: document.currentVersionNumber + 1,
    versionLabel: "v9.0",
    storagePath: "data:text/plain;base64,UEFUSA==",
    fileName: "e2e-revision.txt",
    mimeType: "text/plain",
    fileSizeBytes: 4,
    sha256Hash: "a".repeat(64),
    uploadedByName: "Alex Martin",
    uploadedByOrgName: portal.CUSTOMER_ORGANIZATION_NAME,
    changeNotes: "E2E revision",
    reviewingAgencyCodes: ["DOTD", "CPRA"],
  });
  assert.equal(version?.fileName, "e2e-revision.txt");
  assert.equal(version?.agencyReviews?.length, 2);
  assert.equal(repository.getDocuments()[0].currentVersionId, version?.id);
});

test("My Work primary buckets are mutually exclusive and assignment is structured", () => {
  const reviewer = demo.demoPersonas.find((persona) => persona.id === "jordan-lee");
  const { items } = ux.getOperationalWorkItems({ persona: reviewer });
  const groups = ux.groupMyWork(items);
  const ids = groups.flatMap((group) => group.items.map((item) => item.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(items.some((item) => item.assignedUserId || item.assignedOrganizationId));
  assert.equal(items.some((item) => item.sourceId === "TASK-T003" && item.assignedUserId === "user-jordan-lee"), true);
});

test("reset restores deterministic demo state", () => {
  repository.createCustomerRequest({
    projectId: "proj-spacex-pecan",
    requestType: "government_help",
    title: "Reset me",
    description: "Temporary E2E request",
    submittedByUserId: "user-alex-martin",
    submittedByName: "Alex Martin",
    blocksActiveWork: false,
    attachmentDocumentVersionIds: [],
  });
  repository.resetE2EDemo();
  assert.equal(repository.getCustomerRequests().length, 0);
  assert.equal(repository.getExternalFilings().length, 2);
  assert.equal(repository.getDocuments().reduce((total, document) => total + document.versions.length, 0), fixture.projectDocumentsData.reduce((total, document) => total + document.versions.length, 0));
});
