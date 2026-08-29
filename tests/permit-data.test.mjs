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
  server: { middlewareMode: true },
});

after(async () => {
  await vite.close();
});

const data = await vite.ssrLoadModule("/lib/demo-data.ts");
const utils = await vite.ssrLoadModule("/lib/permit-utils.ts");

test("contains the three complete, agency-scoped demo accounts", () => {
  assert.equal(data.DEMO_PASSWORD, "demo1234");
  assert.deepEqual(
    data.demoAccounts.map((account) => account.username),
    ["applicant.happypath", "applicant.suspended", "applicant.hearing"],
  );

  for (const account of data.demoAccounts) {
    assert.equal(account.agencyId, "ldeq");
    assert.ok(account.name);
    assert.ok(account.scenario);
    assert.ok(account.applicationIds.length > 0);
    assert.equal("password" in account, false);
  }
});

test("keeps only LDEQ enabled in the agency roster", () => {
  assert.deepEqual(
    data.agencies.slice(0, 2).map(({ id, enabled }) => ({ id, enabled })),
    [
      { id: "ldeq", enabled: true },
      { id: "conservation-energy", enabled: false },
    ],
  );
});

test("every demo account application resolves to a valid request", () => {
  const referencedIds = data.demoAccounts.flatMap((account) => account.applicationIds);
  assert.ok(referencedIds.length > 0);
  for (const id of referencedIds) {
    assert.ok(data.permits[id]);
  }
});

test("permits satisfy the required demo domain shape", () => {
  const allowedStatuses = new Set(["in-review", "action-needed", "hearing", "approved"]);
  const allowedStepStates = new Set(["done", "active", "blocked", "hearing", "future"]);
  const allowedJurisdictions = new Set(["Federal", "State", "Local / Parish", "Utility / Regional"]);

  for (const permit of Object.values(data.permits)) {
    assert.ok(permit.type);
    assert.ok(permit.applicant);
    assert.ok(permit.submitted);
    assert.ok(Number.isInteger(permit.currentDay));
    assert.ok(permit.currentDay >= 0 && permit.currentDay <= permit.totalDays);
    assert.ok(Number.isInteger(permit.totalDays) && permit.totalDays > 0);
    assert.ok(allowedStatuses.has(permit.status));
    assert.ok(permit.statusLabel);
    assert.ok(allowedJurisdictions.has(permit.agencyLevel));
    assert.ok(permit.contact.name && permit.contact.email && permit.contact.phone);
    assert.ok(permit.steps.length > 0);
    assert.ok(permit.nextSteps.length > 0);

    for (const step of permit.steps) {
      assert.ok(step.phase && step.title && step.meta);
      assert.ok(allowedStepStates.has(step.state));
    }
  }
});

test("status scenarios retain their expected timeline and alert invariants", () => {
  const standard = data.permits["TASK-T002"];
  const suspended = data.permits["TASK-T001"];
  const hearing = data.permits["TASK-T003"];

  assert.equal(standard.steps.filter((step) => step.state === "active").length, 1);
  assert.equal(standard.alert, undefined);
  assert.equal(suspended.steps.filter((step) => step.state === "blocked").length, 1);
  assert.equal(suspended.alert.tone, "warning");
  assert.equal(hearing.steps.filter((step) => step.state === "hearing").length, 1);
  assert.equal(hearing.alert.tone, "info");
  assert.match(hearing.alert.title, /July 15, 2024/);
  assert.match(suspended.alert.title, /June 15/);
});

test("computes bounded progress percentages", () => {
  assert.equal(utils.permitProgress(data.permits["TASK-T001"]), 59);
  assert.equal(utils.permitProgress(data.permits["TASK-T002"]), 47);
  assert.equal(utils.permitProgress(data.permits["TASK-T003"]), 61);
  assert.equal(utils.permitProgress({ currentDay: -2, totalDays: 10 }), 0);
  assert.equal(utils.permitProgress({ currentDay: 12, totalDays: 10 }), 100);
  assert.equal(utils.permitProgress({ currentDay: 1, totalDays: 0 }), 0);
});

test("normalizes credentials and rejects invalid or wrong-agency access", () => {
  const account = utils.authenticateDemoAccount(
    " Applicant.HappyPath ",
    "demo1234",
    "ldeq",
  );
  assert.equal(account?.username, "applicant.happypath");
  assert.equal(utils.authenticateDemoAccount("applicant.happypath", "wrong", "ldeq"), null);
  assert.equal(
    utils.authenticateDemoAccount(
      "applicant.happypath",
      "demo1234",
      "conservation-energy",
    ),
    null,
  );
  assert.equal(utils.authenticateDemoAccount("unknown", "demo1234", "ldeq"), null);
});

test("enforces demo account-to-permit ownership in lookup helpers", () => {
  const account = data.demoAccounts[0];
  assert.deepEqual(
    utils.getPermitsForAccount(account).map((permit) => permit.id),
    ["TASK-T003"],
  );
  assert.equal(utils.getPermitForAccount(account, "TASK-T003")?.id, "TASK-T003");
  assert.equal(utils.getPermitForAccount(account, "missing"), null);
  assert.deepEqual(utils.getPermitsForAccount(null), []);
});

test("exports demo personas covering SpaceX roles and applicant scenarios", () => {
  assert.ok(Array.isArray(data.demoPersonas));
  assert.ok(data.demoPersonas.length >= 8);

  for (const persona of data.demoPersonas) {
    assert.ok(persona.id);
    assert.ok(persona.name);
    assert.ok(persona.role);
    assert.ok(persona.roleDescription);
    assert.ok(persona.email);
    assert.ok(persona.badge);
    assert.ok(persona.scenario);
  }

  const supervisor = utils.findDemoPersona("maya.chen@spacex.test");
  assert.ok(supervisor);
  assert.equal(supervisor.name, "Maya Chen");
  assert.equal(supervisor.role, "Program Supervisor");

  const supervisorPermits = utils.getPermitsForPersona(supervisor);
  assert.ok(supervisorPermits.length > 0);

  const applicant = utils.findDemoPersona("applicant.suspended");
  assert.ok(applicant);
  const applicantPermits = utils.getPermitsForPersona(applicant);
  assert.equal(applicantPermits.length, 1);
  assert.equal(applicantPermits[0].id, "TASK-T001");
});

test("Pecan Island demo dataset contains clean TASK-T00x IDs, blockers, Gantt data, and jurisdictions", () => {
  assert.ok(Array.isArray(data.pecanIslandRequests));
  assert.equal(data.pecanIslandRequests.length, 9);

  const categories = new Set(data.pecanIslandRequests.map((r) => r.category));
  assert.ok(categories.has("road"));
  assert.ok(categories.has("utility"));
  assert.ok(categories.has("permit"));
  assert.ok(categories.has("public_safety"));
  assert.ok(categories.has("workforce"));
  assert.ok(categories.has("community"));

  const blockedReq = data.pecanIslandRequests.find((r) => r.id === "TASK-T001");
  assert.ok(blockedReq);
  assert.equal(blockedReq.ragStatus, "red");
  assert.equal(blockedReq.isCriticalPath, true);
  assert.equal(blockedReq.agencyLevel, "State");
  assert.ok(blockedReq.blocker);
  assert.ok(blockedReq.blocker.unblockingAction);
  assert.ok(blockedReq.gantt);
  assert.ok(blockedReq.gantt.phases.length > 0);
  assert.ok(blockedReq.escalationPath.length >= 3);
  assert.equal(blockedReq.escalationPath[0].status, "engaged");
  assert.equal(blockedReq.escalationPath[1].status, "escalated");

  const federalReq = data.pecanIslandRequests.find((r) => r.id === "TASK-T005");
  assert.ok(federalReq);
  assert.equal(federalReq.agencyLevel, "Federal");
});

test("RAG summary and workload aggregators compute correct counts", () => {
  const summary = utils.calculateRAGSummary(data.pecanIslandRequests);
  assert.equal(summary.total, 9);
  assert.ok(summary.red >= 1);
  assert.ok(summary.yellow >= 1);
  assert.ok(summary.green >= 1);
  assert.ok(summary.criticalPathCount >= 3);

  const workload = utils.getAgencyWorkload(data.pecanIslandRequests);
  assert.ok(workload.length >= 4);
  assert.ok(workload.some((w) => w.agencyCode === "DOTD"));
  assert.ok(workload.some((w) => w.agencyCode === "LDEQ"));

  const deadlines = utils.getUpcomingDeadlines(data.pecanIslandRequests);
  assert.ok(deadlines.length > 0);
  assert.ok(deadlines[0].targetDate);
});

test("plain-English intake parser correctly detects categories, agencies, and jurisdiction levels", () => {
  const roadIntake = utils.parsePlainEnglishIntake("We need heavy haul bridge reinforcement on LA-82 for oversized booster trailers.");
  assert.equal(roadIntake.detectedCategory, "road");
  assert.equal(roadIntake.suggestedLeadAgencyCode, "DOTD");
  assert.equal(roadIntake.suggestedAgencyLevel, "State");
  assert.equal(roadIntake.isCriticalPathCandidate, true);

  const utilityIntake = utils.parsePlainEnglishIntake("Need high-voltage 230kV substation power interconnection for cryogenic chillers.");
  assert.equal(utilityIntake.detectedCategory, "utility");
  assert.equal(utilityIntake.suggestedLeadAgencyCode, "LPSC / Entergy");
  assert.equal(utilityIntake.suggestedAgencyLevel, "Utility / Regional");

  const safetyIntake = utils.parsePlainEnglishIntake("Airspace NOTAM and FCC radio communications clearance for launch corridor.");
  assert.equal(safetyIntake.detectedCategory, "public_safety");
  assert.equal(safetyIntake.suggestedAgencyLevel, "Federal");

  const workforceIntake = utils.parsePlainEnglishIntake("Customized aerospace welding and technician training program with SLCC.");
  assert.equal(workforceIntake.detectedCategory, "workforce");

  const communityIntake = utils.parsePlainEnglishIntake("Local resident water well monitoring and parish town hall coordination.");
  assert.equal(communityIntake.detectedCategory, "community");
});
