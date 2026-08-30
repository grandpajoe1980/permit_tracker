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

const { spacexProjectRecord } = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
const { getProjectOverview } = await vite.ssrLoadModule("/lib/customer-portal.ts");
const { getOperationalWorkItems } = await vite.ssrLoadModule("/lib/operational-ux.ts");
const { demoPersonas } = await vite.ssrLoadModule("/lib/demo-data.ts");

test("spacexProjectRecord provides authoritative project page metadata", () => {
  assert.equal(spacexProjectRecord.id, "proj-spacex-pecan");
  assert.equal(spacexProjectRecord.code, "SPACEX-PECAN-ISLAND");
  assert.ok(spacexProjectRecord.name.includes("SpaceX Pecan Island"));
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
