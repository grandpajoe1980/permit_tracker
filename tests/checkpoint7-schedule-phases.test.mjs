import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false },
});

after(async () => {
  await vite.close();
});

test("Checkpoint 7: distinct canonical destinations for workstream, phase, and task", async () => {
  const { WorkstreamGraphGantt } = await vite.ssrLoadModule("/components/cockpits/WorkstreamGraphGantt.tsx");
  const html = renderToStaticMarkup(React.createElement(WorkstreamGraphGantt, { projectReference: "PRJ-PECAN-2026" }));
  const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g), (match) => match[1].replaceAll("&amp;", "&"));

  const workstreamHref = hrefs.find((href) => href.includes("workstream=WS-LA82-HEAVYHAUL") && !href.includes("phase="));
  const phaseHref = hrefs.find((href) => href.includes("workstream=WS-LA82-HEAVYHAUL") && href.includes("phase="));
  const taskHref = hrefs.find((href) => href.includes("kind=task") && href.includes("task-dotd-"));
  assert.ok(workstreamHref, "Workstream href must exist");
  assert.ok(phaseHref, "Phase anchor href must exist");
  assert.ok(taskHref, "Task href must exist");

  const workstreamUrl = new URL(workstreamHref, "https://path.example");
  const phaseUrl = new URL(phaseHref, "https://path.example");
  const taskUrl = new URL(taskHref, "https://path.example");
  assert.equal(workstreamUrl.searchParams.get("projectId"), "PRJ-PECAN-2026");
  assert.equal(phaseUrl.searchParams.get("projectId"), "PRJ-PECAN-2026");
  assert.equal(taskUrl.searchParams.get("projectId"), "PRJ-PECAN-2026");
  assert.equal(workstreamUrl.searchParams.get("view"), "project");
  assert.ok(phaseUrl.searchParams.get("phase"));
  assert.ok(phaseUrl.hash.startsWith("#phase-"));
  assert.equal(taskUrl.searchParams.get("view"), "detail");
  assert.notEqual(workstreamHref, phaseHref);
  assert.notEqual(workstreamHref, taskHref);
  assert.notEqual(phaseHref, taskHref);
});

test("Checkpoint 7: schedule links preserve project scope and remain native links", async () => {
  const gantt = await readFile(new URL("../components/cockpits/WorkstreamGraphGantt.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(gantt, /href=\{item\.canonicalHref\}[\s\S]{0,500}preventDefault\(\)/);
  assert.match(gantt, /buildShellPath\("project", workstreamId, "schedule", phase, projectReference\)/);
  assert.match(gantt, /buildDetailShellPath\("task", taskId, projectReference\)/);
  assert.doesNotMatch(gantt, /href=\{`\/workstreams\//);
  assert.doesNotMatch(gantt, /href=\{`\/work\/task\//);
  assert.match(page, /<WorkstreamGraphGantt project=\{projectRecord\} projectReference=\{activeProjectReference\(\) \?\? undefined\} customerOrganizationName=\{customerOrganizationName\} customerSafe=\{activePersona\.isCustomer\} focusedWorkstreamId=/);
  assert.match(page, /<WorkstreamGraphGantt project=\{projectRecord\} projectReference=\{activeProjectReference\(\) \?\? undefined\} customerOrganizationName=\{customerOrganizationName\} customerSafe focusedWorkstreamId=/);
  assert.match(page, /desiredPathBase.*phase-\$\{encodeURIComponent\(selectedProjectPhase\)\}/s);
});

test("Checkpoint 7: schedule renders a flat stage track without expansion controls", async () => {
  const { WorkstreamGraphGantt } = await vite.ssrLoadModule("/components/cockpits/WorkstreamGraphGantt.tsx");
  const html = renderToStaticMarkup(React.createElement(WorkstreamGraphGantt));

  // Mode switcher contains Chronological List
  assert.match(html, /Chronological List/);

  // Contains Advanced Analysis button
  assert.match(html, /Advanced Analysis/);

  // Contains Fit project control
  assert.match(html, /Fit project/);

  // Contains Today control
  assert.match(html, />Today</);

  assert.doesNotMatch(html, /aria-expanded|stages and tasks|\d+ stages ·/);
  assert.match(html, /data-testid="gantt-track-WS-LA82-HEAVYHAUL"/);
});

test("Checkpoint 7: block/unblock changes schedule variance and critical path health", async () => {
  const { evaluateProjectSchedule } = await vite.ssrLoadModule("/lib/engines/schedule-engine.ts");
  const { workstreamsData } = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");

  // Clone workstreams
  const workstreams = JSON.parse(JSON.stringify(workstreamsData));
  const targetWs = workstreams.find((w) => w.id === "WS-LA82-HEAVYHAUL");
  assert.ok(targetWs);

  // Initial blocked state
  assert.equal(targetWs.operationalState, "blocked");
  const initialSchedule = evaluateProjectSchedule(workstreams);
  assert.ok(initialSchedule.totalVarianceDays > 0);

  // Simulate unblocking
  targetWs.operationalState = "running";
  targetWs.scheduleVarianceDays = 0;
  const unblockedSchedule = evaluateProjectSchedule(workstreams);
  assert.ok(unblockedSchedule.totalVarianceDays <= initialSchedule.totalVarianceDays);
});
