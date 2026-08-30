import test, { after } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
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

const { generateGovernorWeeklyBriefing, getPublicTransparencyData } = await vite.ssrLoadModule(
  "/lib/engines/report-engine.ts"
);
const { getFullProjectRecord } = await vite.ssrLoadModule("/lib/permit-utils.ts");
const { ExecutiveBriefingReport } = await vite.ssrLoadModule(
  "/components/cockpits/ExecutiveBriefingReport.tsx"
);
const { PublicTransparencyPortal } = await vite.ssrLoadModule(
  "/components/cockpits/PublicTransparencyPortal.tsx"
);

test("Report Engine: generates Governor's Weekly Megaproject Briefing", () => {
  const project = getFullProjectRecord();
  const briefing = generateGovernorWeeklyBriefing(
    project,
    project.workstreams,
    project.commitments,
    project.decisions,
    project.coordinationRequests
  );

  assert.equal(briefing.applicantName, "Space Exploration Technologies Corp. (SpaceX)");
  assert.equal(briefing.parish, "Vermilion Parish");
  assert.ok(briefing.scheduleVarianceDays > 0);
  assert.ok(briefing.criticalPathBottlenecks.length > 0);
  assert.ok(briefing.highStakesDecisions.length > 0);
  assert.ok(briefing.interagencyConcurrenceStatus.totalRequests > 0);
  assert.ok(briefing.keyMilestonesNext14Days.length > 0);
});

test("Report Engine: returns structured Vermilion Parish public transparency data", () => {
  const data = getPublicTransparencyData();

  assert.equal(data.parishName, "Vermilion Parish, Louisiana");
  assert.equal(data.activePublicNotices.length, 3);
  assert.ok(data.environmentalSafeguards.length >= 3);
  assert.ok(data.communityBenefits.length >= 3);
  assert.ok(data.upcomingTownHalls.length >= 2);

  // Verify statutory notices have citations and days remaining
  const cpraNotice = data.activePublicNotices.find((n) => n.permitCode === "CPRA-CUP-2026-088");
  assert.ok(cpraNotice);
  assert.ok(cpraNotice.statutoryCitation.includes("La. R.S. 49:214.21"));
  assert.equal(cpraNotice.daysRemaining, 10);
});

test("Cockpit SSR: renders ExecutiveBriefingReport cleanly", () => {
  const html = renderToString(React.createElement(ExecutiveBriefingReport));
  assert.ok(html.includes("Governor&#x27;s Weekly Megaproject Briefing") || html.includes("Governor's Weekly Megaproject Briefing"));
  assert.ok(html.includes("Space Exploration Technologies Corp. (SpaceX)"));
  assert.ok(html.includes("Critical Path Bottlenecks &amp; Slippage") || html.includes("Critical Path Bottlenecks"));
  assert.ok(html.includes("Print / Export PDF Briefing"));
});

test("Cockpit SSR: renders PublicTransparencyPortal cleanly", () => {
  const html = renderToString(React.createElement(PublicTransparencyPortal));
  assert.ok(html.includes("Vermilion Parish Public Transparency &amp; Citizen Portal") || html.includes("Vermilion Parish Public Transparency"));
  assert.ok(html.includes("Active Statutory Public Notice Periods"));
  assert.ok(html.includes("Submit Official Public Comment"));
  assert.ok(html.includes("Chicot Aquifer Drinking Water Protection"));
});
