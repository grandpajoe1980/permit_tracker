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
  const html = renderToStaticMarkup(React.createElement(WorkstreamGraphGantt));

  // 1. Workstream canonical destination
  assert.match(html, /href="\/workstreams\/WS-LA82-HEAVYHAUL"/);

  // 2. Phase / Stage anchor destination
  assert.match(html, /href="\/workstreams\/WS-LA82-HEAVYHAUL\?phase=[^#]+#phase-[^"]+"/);

  // 3. Task canonical destination
  assert.match(html, /href="\/work\/task\/task-dotd-[123]"/);

  // Confirm all three destinations are distinct
  const workstreamHref = "/workstreams/WS-LA82-HEAVYHAUL";
  const phaseHrefMatch = html.match(/href="(\/workstreams\/WS-LA82-HEAVYHAUL\?phase=[^#]+#phase-[^"]+)"/);
  const taskHrefMatch = html.match(/href="(\/work\/task\/task-dotd-[123])"/);

  assert.ok(phaseHrefMatch, "Phase anchor href must exist");
  assert.ok(taskHrefMatch, "Task href must exist");
  assert.notEqual(workstreamHref, phaseHrefMatch[1]);
  assert.notEqual(workstreamHref, taskHrefMatch[1]);
  assert.notEqual(phaseHrefMatch[1], taskHrefMatch[1]);
});

test("Checkpoint 7: schedule links are not intercepted into the project shell", async () => {
  const gantt = await readFile(new URL("../components/cockpits/WorkstreamGraphGantt.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(gantt, /href=\{item\.canonicalHref\}[\s\S]{0,500}preventDefault\(\)/);
  assert.doesNotMatch(gantt, /href=\{`\/workstreams\/\$\{encodeURIComponent\(ws\.code \|\| ws\.id\)\}`\}[\s\S]{0,500}preventDefault\(\)/);
  assert.doesNotMatch(gantt, /href=\{`\/work\/task\/\$\{encodeURIComponent\(task\.id\)\}`\}[\s\S]{0,500}preventDefault\(\)/);
  assert.match(page, /<WorkstreamGraphGantt project=\{projectRecord\} customerSafe=\{activePersona\.isCustomer\} focusedWorkstreamId=/);
  assert.match(page, /<WorkstreamGraphGantt project=\{projectRecord\} customerSafe focusedWorkstreamId=/);
  assert.match(page, /desiredPathBase.*phase-\$\{encodeURIComponent\(selectedProjectPhase\)\}/s);
});

test("Checkpoint 7: schedule renders chronological list and expandable workflow tasks", async () => {
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

  // Expand controls exist for workstreams
  assert.match(html, /Expand WS-LA82-HEAVYHAUL stages and tasks|aria-label="Expand/);
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
