import assert from "node:assert/strict";
import test, { after } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
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
const { buildShellPath, parseShellPath } = await vite.ssrLoadModule("/lib/navigation.ts");
const { buildWorkstreamTruth } = await vite.ssrLoadModule("/lib/workstream-truth.ts");
const { WorkstreamTruthSummary } = await vite.ssrLoadModule("/components/cockpits/WorkstreamTruthSummary.tsx");
const appSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const copiedWorkstreamRoute = await readFile(new URL("../app/projects/[projectNumber]/workstreams/[workstreamId]/page.tsx", import.meta.url), "utf8");

test("project section URLs preserve the focused workstream and selected tab", () => {
  const path = buildShellPath("project", "WS-LA82-HEAVYHAUL", "schedule");
  assert.equal(path, "/?view=project&workstream=WS-LA82-HEAVYHAUL&tool=schedule");
  const parsed = parseShellPath(new URL(`https://path.demo${path}`));
  assert.deepEqual(parsed, { route: "project", workstreamId: "WS-LA82-HEAVYHAUL", tool: "schedule", workKind: undefined, workItemId: undefined, requestId: undefined, returnTo: undefined });

  const legacy = parseShellPath(new URL("https://path.demo/?view=secondary&tool=vault"));
  assert.equal(legacy.route, "secondary");
  assert.equal(legacy.tool, "vault");
});

test("one workstream truth projection supplies the core story without inventing dates", () => {
  const workstream = repository.getWorkstreamById("WS-LA82-HEAVYHAUL");
  assert.ok(workstream);
  const truth = buildWorkstreamTruth(workstream, repository.getWorkflowTemplates());
  assert.ok(truth.stage);
  assert.ok(truth.ownerOrganization);
  assert.ok(truth.hold);
  assert.equal(truth.baselineDate, workstream.baselineTargetDate);
  assert.equal(truth.forecastDate, workstream.forecastTargetDate);
  assert.equal(truth.nextAction, workstream.currentActionSummary);

  const staffMarkup = renderToStaticMarkup(React.createElement(WorkstreamTruthSummary, { workstream, templates: repository.getWorkflowTemplates() }));
  const customerMarkup = renderToStaticMarkup(React.createElement(WorkstreamTruthSummary, { workstream, templates: repository.getWorkflowTemplates(), customerSafe: true }));
  for (const value of [truth.stage, truth.hold, truth.nextAction, truth.baselineDate, truth.forecastDate]) {
    const displayValue = value?.length === 10
      ? new Date(`${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : value;
    const escaped = String(displayValue ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(staffMarkup, new RegExp(escaped));
    assert.match(customerMarkup, new RegExp(escaped));
  }
  assert.match(staffMarkup, /Canonical workstream story/);
  assert.match(customerMarkup, /Canonical workstream story/);
});

test("queue, detail, and project render the shared story and old copied URLs enter Project", () => {
  assert.match(appSource, /<WorkstreamTruthSummary workstream=\{item\.sourceWorkstream\}/);
  assert.match(appSource, /<WorkstreamTruthSummary workstream=\{linkedWorkstream\}/);
  assert.match(appSource, /function renderProjectWorkspace\(section: ProjectSection\)/);
  assert.match(appSource, /projectSection/);
  assert.match(copiedWorkstreamRoute, /redirect\(buildShellPath\("project", workstream\.id\)\)/);
});
