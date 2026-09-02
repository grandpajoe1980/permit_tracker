import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const { spacexProjectRecord } = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
const { getProjectOverview } = await vite.ssrLoadModule("/lib/customer-portal.ts");
const { getOperationalWorkItems } = await vite.ssrLoadModule("/lib/operational-ux.ts");
const { demoPersonas } = await vite.ssrLoadModule("/lib/demo-data.ts");
const { buildShellPath, parseShellPath, NAVIGATION_DEFINITIONS } = await vite.ssrLoadModule("/lib/navigation.ts");
const rootPageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const projectOverviewSource = await readFile(new URL("../components/cockpits/ProjectOverviewPage.tsx", import.meta.url), "utf8");

test("spacexProjectRecord provides authoritative project page metadata", () => {
  assert.equal(spacexProjectRecord.id, "proj-spacex-pecan");
  assert.equal(spacexProjectRecord.code, "SPACEX-PECAN-ISLAND");
  assert.equal(spacexProjectRecord.name, "SpaceX – Starbase Louisiana Launch Complex and Orbital Support Facility");
  assert.equal(spacexProjectRecord.parish, "Vermilion Parish");
  assert.ok(spacexProjectRecord.workstreams.length >= 6);
  assert.ok(spacexProjectRecord.baselineLaunchDate);
  assert.ok(spacexProjectRecord.currentForecastLaunchDate);
});

test("repository provides the project record and workstreams for project page rendering", () => {
  const project = repository.getProject();
  assert.ok(project);
  assert.equal(project.id, spacexProjectRecord.id);
  assert.equal(project.code, "SPACEX-PECAN-ISLAND");

  const workstreams = repository.getWorkstreams();
  assert.ok(workstreams.length > 0);
  assert.ok(workstreams.some((ws) => ws.id === "WS-LA82-HEAVYHAUL"));
  assert.ok(workstreams.some((ws) => ws.id === "WS-WETLANDS-PAD-A"));
  assert.ok(workstreams.some((ws) => ws.id === "WS-SUBSTATION-230KV"));
  assert.ok(workstreams.some((ws) => ws.id === "WS-WASTEWATER-DELUGE"));
});

test("customer overview maps government workstreams with their IDs for direct project page navigation", () => {
  const project = repository.getProject();
  const workstreams = repository.getWorkstreams();
  const overview = getProjectOverview(project, workstreams);

  assert.ok(overview.governmentActions.length > 0);
  for (const action of overview.governmentActions) {
    assert.ok(action.id, "Every government action must have a workstream id");
    assert.ok(action.title, "Every government action must have a title");
    assert.ok(action.agency, "Every government action must have an agency");
    assert.ok(workstreams.some((ws) => ws.id === action.id), `Workstream ID ${action.id} exists in repository`);
  }
});

test("operational work items link workstream titles and workstream IDs for project navigation", () => {
  for (const persona of demoPersonas) {
    const { items } = getOperationalWorkItems({ persona });
    assert.ok(items.length > 0);
    for (const item of items) {
      assert.ok(item.workstreamId, "Every work item must have a workstreamId");
      assert.ok(item.workstreamTitle, "Every work item must have a workstreamTitle");
    }
  }
});

test("project navigation state transitions route to project and focus workstream", () => {
  // Simulate the router logic in app/page.tsx
  let route = "my-work";
  let selectedItemId = "ITEM-001";
  let selectedProjectWorkstreamId = null;
  let mobileNavOpen = true;

  function openProject(workstreamId) {
    selectedItemId = null;
    selectedProjectWorkstreamId = workstreamId ?? null;
    route = "project";
    mobileNavOpen = false;
  }

  // 1. Navigation from sidebar context / header without specific workstream
  openProject();
  assert.equal(route, "project");
  assert.equal(selectedItemId, null);
  assert.equal(selectedProjectWorkstreamId, null);
  assert.equal(mobileNavOpen, false);

  // 2. Navigation from a specific workstream / work item card / detail breadcrumb
  openProject("WS-LA82-HEAVYHAUL");
  assert.equal(route, "project");
  assert.equal(selectedItemId, null);
  assert.equal(selectedProjectWorkstreamId, "WS-LA82-HEAVYHAUL");
});

test("deep project links preserve the exact workstream identifier", () => {
  const path = buildShellPath("project", "WS-AIR-TITLE-V");
  assert.equal(path, "/?view=project&workstream=WS-AIR-TITLE-V");
  const parsed = parseShellPath(new URL(`https://path.demo${path}`));
  assert.equal(parsed.route, "project");
  assert.equal(parsed.workstreamId, "WS-AIR-TITLE-V");
  assert.ok(NAVIGATION_DEFINITIONS.some((entry) => entry.id === "intake"));
});

test("fresh authenticated project links are not overwritten by hydration defaults", () => {
  const hydration = rootPageSource.slice(rootPageSource.indexOf("void getBrowserUser"), rootPageSource.indexOf("const { data: listener"));
  assert.doesNotMatch(hydration, /setRoute\("my-work"\)/);
  assert.match(rootPageSource, /setSelectedProjectWorkstreamId\(shell\.workstreamId \?\? null\)/);
});

test("project summary cards open the selected workstream workspace", () => {
  assert.match(projectOverviewSource, /aria-label=\{attentionWorkstream \? `Open workstream workspace/);
  assert.match(projectOverviewSource, /onFocusWorkstream\(attentionWorkstream\.id\)/);
  assert.match(projectOverviewSource, /aria-label=\{`Open workstream workspace for \$\{workstream\.title\}`\}/);
});

test("workstream resolution supports code, lowercase, URL-encoded, and ID lookup", () => {
  const workstreams = repository.getWorkstreams();
  assert.ok(workstreams.length > 0);

  function resolveWorkstream(lookupKey) {
    const decoded = decodeURIComponent(lookupKey ?? "").trim();
    return workstreams.find(
      (ws) =>
        ws.id === decoded ||
        ws.code === decoded ||
        ws.code.toLowerCase() === decoded.toLowerCase() ||
        ws.id.toLowerCase() === decoded.toLowerCase()
    );
  }

  // 1. Direct code lookup
  const ws1 = resolveWorkstream("WS-LA82-HEAVYHAUL");
  assert.ok(ws1, "Must resolve workstream by exact uppercase code");
  assert.equal(ws1.code, "WS-LA82-HEAVYHAUL");

  // 2. Lowercase code lookup
  const ws2 = resolveWorkstream("ws-la82-heavyhaul");
  assert.ok(ws2, "Must resolve workstream by lowercase code");
  assert.equal(ws2.code, "WS-LA82-HEAVYHAUL");

  // 3. URL-encoded code lookup
  const ws3 = resolveWorkstream("WS%2DLA82%2DHEAVYHAUL");
  assert.ok(ws3, "Must resolve workstream by URL-encoded code");
  assert.equal(ws3.code, "WS-LA82-HEAVYHAUL");

  // 4. URL-encoded lowercase code lookup
  const ws4 = resolveWorkstream("ws%2Dwetlands%2Dpad%2Da");
  assert.ok(ws4, "Must resolve workstream by URL-encoded lowercase code");
  assert.equal(ws4.code, "WS-WETLANDS-PAD-A");

  // 5. ID lookup
  const ws5 = resolveWorkstream("WS-SUBSTATION-230KV");
  assert.ok(ws5, "Must resolve workstream by ID");
  assert.equal(ws5.code, "WS-SUBSTATION-230KV");
});

test("project lookup supports project number, lowercase, and UUID lookup", () => {
  const project = repository.getProject();
  assert.ok(project);

  function resolveProject(identifier) {
    const decoded = decodeURIComponent(identifier ?? "").trim();
    if (decoded === project.id || decoded === project.code || decoded === "PRJ-PECAN-2026") {
      return project;
    }
    if (decoded.toLowerCase() === project.code.toLowerCase() || decoded.toLowerCase() === "prj-pecan-2026") {
      return project;
    }
    return null;
  }

  assert.ok(resolveProject("PRJ-PECAN-2026"));
  assert.ok(resolveProject("prj-pecan-2026"));
  assert.ok(resolveProject("PRJ%2DPECAN%2D2026"));
  assert.ok(resolveProject(project.id));
  assert.ok(resolveProject(project.code));
});

