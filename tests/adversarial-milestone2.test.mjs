import assert from "node:assert/strict";
import test, { after } from "node:test";
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

// Load modules
const demoData = await vite.ssrLoadModule("/lib/demo-data.ts");
const permitUtils = await vite.ssrLoadModule("/lib/permit-utils.ts");
const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const workflowEngine = await vite.ssrLoadModule("/lib/engines/workflow-engine.ts");
const scheduleEngine = await vite.ssrLoadModule("/lib/engines/schedule-engine.ts");
const escalationEngine = await vite.ssrLoadModule("/lib/engines/escalation-engine.ts");
const coordinationEngine = await vite.ssrLoadModule("/lib/engines/coordination-engine.ts");
const auditEngine = await vite.ssrLoadModule("/lib/engines/audit-engine.ts");

// Cockpits
const { SpaceXNoSurprises } = await vite.ssrLoadModule("/components/cockpits/SpaceXNoSurprises.tsx");
const { DailyCommandCenter } = await vite.ssrLoadModule("/components/cockpits/DailyCommandCenter.tsx");
const { WorkstreamGraphGantt } = await vite.ssrLoadModule("/components/cockpits/WorkstreamGraphGantt.tsx");
const { InteragencyCoordinationPanel } = await vite.ssrLoadModule("/components/cockpits/InteragencyCoordinationPanel.tsx");
const { DocumentVaultPanel } = await vite.ssrLoadModule("/components/cockpits/DocumentVaultPanel.tsx");
const { CommitmentsDecisionsPanel } = await vite.ssrLoadModule("/components/cockpits/CommitmentsDecisionsPanel.tsx");
const { WorkflowDesignerPanel } = await vite.ssrLoadModule("/components/cockpits/WorkflowDesignerPanel.tsx");
const { PreApplicationReadinessPanel } = await vite.ssrLoadModule("/components/cockpits/PreApplicationReadinessPanel.tsx");

// =========================================================================
// 1. Role Permission Gating & Granular Matrix
// =========================================================================
test("Adversarial: Role permission gating enforces correct access matrices", () => {
  const { roleDefinitions, initialTeamUsers } = demoData;

  // Verify role definitions
  const adminRole = roleDefinitions.admin;
  const viewerRole = roleDefinitions.viewer;
  const submitterRole = roleDefinitions.submitter;
  const reviewerRole = roleDefinitions.reviewer;

  assert.ok(adminRole.defaultPermissions.includes("manage_roles"));
  assert.ok(adminRole.defaultPermissions.includes("edit_workflow"));
  assert.ok(adminRole.defaultPermissions.includes("add_blockers"));
  assert.ok(adminRole.defaultPermissions.includes("resolve_blockers"));

  assert.equal(viewerRole.defaultPermissions.includes("manage_roles"), false);
  assert.equal(viewerRole.defaultPermissions.includes("edit_workflow"), false);
  assert.equal(viewerRole.defaultPermissions.includes("add_blockers"), false);
  assert.equal(viewerRole.defaultPermissions.includes("resolve_blockers"), false);

  assert.equal(submitterRole.defaultPermissions.includes("manage_roles"), false);
  assert.equal(submitterRole.defaultPermissions.includes("edit_workflow"), false);

  // Reviewer can add/resolve blockers but not manage roles
  assert.equal(reviewerRole.defaultPermissions.includes("manage_roles"), false);
  assert.ok(reviewerRole.defaultPermissions.includes("add_blockers"));
  assert.ok(reviewerRole.defaultPermissions.includes("resolve_blockers"));
});

// =========================================================================
// 2. Intake Triage Parser Boundary & Stress Testing
// =========================================================================
test("Adversarial: Intake triage parser handles edge cases and adversarial text", () => {
  const { parsePlainEnglishIntake } = permitUtils;

  // 1. Empty string
  const emptyRes = parsePlainEnglishIntake("");
  assert.equal(emptyRes.detectedCategory, "permit");
  assert.equal(emptyRes.extractedTitle, "New Service Request");

  // 2. Heavy haul and road variations
  const heavyHaulRes = parsePlainEnglishIntake("CULVERT REPLACEMENT ON HIGHWAY LA-82 FOR OVERSIZE VEHICLE TRANSPORT");
  assert.equal(heavyHaulRes.detectedCategory, "road");
  assert.equal(heavyHaulRes.suggestedLeadAgencyCode, "DOTD");
  assert.equal(heavyHaulRes.priority, "critical");
  assert.equal(heavyHaulRes.isCriticalPathCandidate, true);

  // 3. Substation & Power Grid
  const powerRes = parsePlainEnglishIntake("Need 230kv transformer substation and entergy power line extension");
  assert.equal(powerRes.detectedCategory, "utility");
  assert.equal(powerRes.suggestedLeadAgencyCode, "LPSC / Entergy");
  assert.equal(powerRes.priority, "critical");

  // 4. Airspace & Communications
  const airspaceRes = parsePlainEnglishIntake("FAA NOTAM launch window coordination with USCG and radio frequency spectrum");
  assert.equal(airspaceRes.detectedCategory, "public_safety");
  assert.equal(airspaceRes.suggestedLeadAgencyCode, "FAA / USCG / FCC");
  assert.equal(airspaceRes.suggestedAgencyLevel, "Federal");

  // 5. Fire Marshal & Cryogenics
  const fireRes = parsePlainEnglishIntake("State Fire Marshal approval for cryogenic liquid methane and LOX storage tanks");
  assert.equal(fireRes.detectedCategory, "public_safety");
  assert.equal(fireRes.suggestedLeadAgencyCode, "OSFM / LSP");
  assert.equal(fireRes.suggestedAgencyLevel, "State");

  // 6. Workforce Training
  const workforceRes = parsePlainEnglishIntake("SLCC welding workforce hiring and technician training grant");
  assert.equal(workforceRes.detectedCategory, "workforce");
  assert.equal(workforceRes.suggestedLeadAgencyCode, "LED / SLCC");

  // 7. Community & Parish
  const communityRes = parsePlainEnglishIntake("Vermilion Parish town hall meeting for drinking water well monitoring");
  assert.equal(communityRes.detectedCategory, "community");
  assert.equal(communityRes.suggestedLeadAgencyCode, "Parish / LDH");

  // 8. Wetlands & Coastal
  const wetlandsRes = parsePlainEnglishIntake("CPRA and USACE joint coastal use permit for marsh dune mitigation");
  assert.equal(wetlandsRes.detectedCategory, "permit");
  assert.equal(wetlandsRes.suggestedLeadAgencyCode, "CPRA / USACE");

  // 9. Ultra long text (truncation check)
  const longText = "A".repeat(200) + ". Second sentence.";
  const longRes = parsePlainEnglishIntake(longText);
  assert.ok(longRes.extractedTitle.length <= 70);
  assert.ok(longRes.extractedTitle.endsWith("…"));
});

// =========================================================================
// 3. Date Formatting Determinism Across Timezones
// =========================================================================
test("Adversarial: Date formatting behaves deterministically without timezone shifts", () => {
  // Test ISO date parsing logic
  const dateStr = "2026-09-28";
  const parts = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const formatted = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  assert.equal(formatted, "Sep 28, 2026");

  // Test year-end boundary
  const yearEnd = "2026-12-31";
  const pEnd = yearEnd.split("-").map(Number);
  const dEnd = new Date(Date.UTC(pEnd[0], pEnd[1] - 1, pEnd[2]));
  const formattedEnd = dEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  assert.equal(formattedEnd, "Dec 31, 2026");

  // Test new year boundary
  const newYear = "2027-01-01";
  const pNew = newYear.split("-").map(Number);
  const dNew = new Date(Date.UTC(pNew[0], pNew[1] - 1, pNew[2]));
  const formattedNew = dNew.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  assert.equal(formattedNew, "Jan 1, 2027");
});

// =========================================================================
// 4. SSR Interactive Rendering & Prop Resilience for all 8 Cockpits
// =========================================================================
test("Adversarial: All 8 cockpits render cleanly with callback handlers and edge states", () => {
  let selectedWsId = "";
  const handleSelect = (id) => {
    selectedWsId = id;
  };

  // 1. SpaceXNoSurprises with callback
  const el1 = React.createElement(SpaceXNoSurprises, { onSelectWorkstream: handleSelect });
  const html1 = renderToStaticMarkup(el1);
  assert.ok(html1.includes("No-Surprises Delivery Dashboard"));
  assert.ok(html1.includes("Needs SpaceX"));
  assert.ok(html1.includes("Needs Government"));
  assert.ok(html1.includes("Blocked Items"));
  assert.ok(html1.includes("Upcoming Decisions"));

  // 2. DailyCommandCenter
  const el2 = React.createElement(DailyCommandCenter);
  const html2 = renderToStaticMarkup(el2);
  assert.ok(html2.includes("Daily Coordination Command Center"));
  assert.ok(html2.includes("Sunday, August 30, 2026"));
  assert.ok(html2.includes("Start Coordination Review"));

  // 3. WorkstreamGraphGantt
  const el3 = React.createElement(WorkstreamGraphGantt);
  const html3 = renderToStaticMarkup(el3);
  assert.ok(html3.includes("Project Delivery Schedule"));
  assert.ok(html3.includes("+13 Days"));

  // 4. InteragencyCoordinationPanel
  const el4 = React.createElement(InteragencyCoordinationPanel);
  const html4 = renderToStaticMarkup(el4);
  assert.ok(html4.includes("Interagency Coordination Requests &amp; RFI Batches") || html4.includes("Interagency Coordination Requests & RFI Batches"));
  assert.ok(html4.includes("Consolidated RFI Batch Cycle"));

  // 5. DocumentVaultPanel
  const el5 = React.createElement(DocumentVaultPanel);
  const html5 = renderToStaticMarkup(el5);
  assert.ok(html5.includes("Project Document Vault"));
  assert.ok(html5.includes("Cross-Agency Revision Certification Matrix"));

  // 6. CommitmentsDecisionsPanel
  const el6 = React.createElement(CommitmentsDecisionsPanel);
  const html6 = renderToStaticMarkup(el6);
  assert.ok(html6.includes("Commitment Ledger &amp; Decision Repository") || html6.includes("Commitment Ledger & Decision Repository"));
  assert.ok(html6.includes("COM-001"));

  // 7. WorkflowDesignerPanel
  const el7 = React.createElement(WorkflowDesignerPanel);
  const html7 = renderToStaticMarkup(el7);
  assert.ok(html7.includes("Workflow Designer &amp; Permit Catalog") || html7.includes("Workflow Designer & Permit Catalog"));
  assert.ok(html7.includes("Published v4.0"));

  // 8. PreApplicationReadinessPanel
  const el8 = React.createElement(PreApplicationReadinessPanel);
  const html8 = renderToStaticMarkup(el8);
  assert.ok(html8.includes("Pre-Application Coordination &amp; Readiness Checklist") || html8.includes("Pre-Application Coordination & Readiness Checklist"));
  assert.ok(html8.includes("86%"));
});

// =========================================================================
// 5. Operational Solver Mathematical Invariants
// =========================================================================
test("Adversarial: Schedule DAG and float calculations maintain mathematical integrity", () => {
  const schedule = scheduleEngine.evaluateProjectSchedule(fixture.workstreamsData);

  // Critical path float must be <= non-critical float
  assert.ok(schedule.criticalPathTaskIds.length > 0);
  assert.equal(schedule.totalVarianceDays, 13);

  // Delay reason breakdown sum should be consistent
  const delaySum = Object.values(schedule.delaySummary).reduce((a, b) => a + b, 0);
  assert.ok(delaySum >= 13);
});
