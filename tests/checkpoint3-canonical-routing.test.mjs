import assert from "node:assert/strict";
import test, { after } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

const {
  NAVIGATION_DEFINITIONS,
  buildCanonicalEntityPath,
  resolveCanonicalEntityRef,
  buildWorkItemPath,
  parseWorkItemPath,
  parseShellPath,
} = await vite.ssrLoadModule("/lib/navigation.ts");
const { WorkItemPage } = await vite.ssrLoadModule("/components/path/work/WorkItemPage.tsx");
const { EntityLink } = await vite.ssrLoadModule("/components/path/EntityLink.tsx");
const { repository } = await vite.ssrLoadModule("/lib/repository.ts");

test("EntityRef and buildCanonicalEntityPath cover all typed entity kinds", () => {
  const cases = [
    { entity: { kind: "project", id: "proj-spacex-pecan", code: "PRJ-PECAN-2026" }, expected: "/projects/PRJ-PECAN-2026" },
    { entity: { kind: "workstream", id: "WS-LA82-HEAVYHAUL", code: "WS-LA82-HEAVYHAUL" }, expected: "/workstreams/WS-LA82-HEAVYHAUL" },
    { entity: { kind: "task", id: "TASK-001" }, expected: "/work/task/TASK-001" },
    { entity: { kind: "customer_request", id: "req-123", code: "PATH-2026-0001" }, expected: "/requests/PATH-2026-0001" },
    { entity: { kind: "rfi", id: "rfi-456", code: "RFI-2026-0044" }, expected: "/work/rfi/RFI-2026-0044" },
    { entity: { kind: "coordination", id: "cr-789", code: "CR-00451" }, expected: "/work/coordination/CR-00451" },
    { entity: { kind: "commitment", id: "COM-001", code: "COM-001" }, expected: "/work/commitment/COM-001" },
    { entity: { kind: "determination", id: "det-101" }, expected: "/work/determination/det-101" },
    { entity: { kind: "document", id: "doc-drainage-plan" }, expected: "/work/document/doc-drainage-plan" },
    { entity: { kind: "document_version", id: "doc-ver-seed-drainage-20260907" }, expected: "/work/document/doc-ver-seed-drainage-20260907" },
    { entity: { kind: "person", id: "user-sarah-johnson" }, expected: "/?view=profile&userId=user-sarah-johnson" },
    { entity: { kind: "organization", id: "org-ldeq" }, expected: "/?view=contacts&orgId=org-ldeq" },
    { entity: { kind: "group", id: "grp-triage" }, expected: "/?view=admin&tab=groups&groupId=grp-triage" },
    { entity: { kind: "workflow", id: "tmpl-environmental-review" }, expected: "/admin/workflows?template=tmpl-environmental-review" },
  ];

  for (const { entity, expected } of cases) {
    const actual = buildCanonicalEntityPath(entity);
    assert.equal(actual, expected, `Canonical path for ${entity.kind} should match`);
  }
});

test("resolveCanonicalEntityRef resolves canonical and legacy routes", () => {
  // Project
  const proj = resolveCanonicalEntityRef("/projects/PRJ-PECAN-2026");
  assert.ok(proj);
  assert.equal(proj.kind, "project");
  assert.equal(proj.code, "PRJ-PECAN-2026");

  // Project Workstream
  const projWs = resolveCanonicalEntityRef("/projects/PRJ-PECAN-2026/workstreams/WS-LA82-HEAVYHAUL");
  assert.ok(projWs);
  assert.equal(projWs.kind, "workstream");
  assert.equal(projWs.id, "WS-LA82-HEAVYHAUL");
  assert.equal(projWs.secondaryId, "PRJ-PECAN-2026");

  // Standalone Workstream
  const ws = resolveCanonicalEntityRef("/workstreams/WS-LA82-HEAVYHAUL");
  assert.ok(ws);
  assert.equal(ws.kind, "workstream");
  assert.equal(ws.id, "WS-LA82-HEAVYHAUL");

  // Customer Request
  const req = resolveCanonicalEntityRef("/requests/PATH-2026-0001");
  assert.ok(req);
  assert.equal(req.kind, "customer_request");
  assert.equal(req.code, "PATH-2026-0001");

  // Work item route
  const rfi = resolveCanonicalEntityRef("/work/rfi/RFI-2026-0044");
  assert.ok(rfi);
  assert.equal(rfi.kind, "rfi");
  assert.equal(rfi.id, "RFI-2026-0044");

  // Shell query: detail view
  const detail = resolveCanonicalEntityRef("https://path.local/?view=detail&kind=rfi&id=RFI-2026-0044");
  assert.ok(detail);
  assert.equal(detail.kind, "rfi");
  assert.equal(detail.id, "RFI-2026-0044");

  // Shell query: profile view
  const profile = resolveCanonicalEntityRef("https://path.local/?view=profile&userId=user-sarah-johnson");
  assert.ok(profile);
  assert.equal(profile.kind, "person");
  assert.equal(profile.id, "user-sarah-johnson");

  // Admin workflows
  const wf = resolveCanonicalEntityRef("https://path.local/admin/workflows?template=tmpl-123");
  assert.ok(wf);
  assert.equal(wf.kind, "workflow");
  assert.equal(wf.id, "tmpl-123");
});

test("profile is a recognized, reloadable route in navigation definitions and shell parser", () => {
  const profileDef = NAVIGATION_DEFINITIONS.find((d) => d.id === "profile");
  assert.ok(profileDef, "profile must exist in NAVIGATION_DEFINITIONS");
  assert.equal(profileDef.id, "profile");
  assert.equal(profileDef.scope, "system");

  const parsed = parseShellPath(new URL("https://path.local/?view=profile"));
  assert.equal(parsed.route, "profile", "parseShellPath must preserve profile route");

  const parsedWithUser = parseShellPath(new URL("https://path.local/?view=profile&userId=user-alex-martin"));
  assert.equal(parsedWithUser.route, "profile");
  assert.equal(parsedWithUser.userId, "user-alex-martin");
});

test("parseWorkItemPath supports case-insensitive kind matching", () => {
  const upper = parseWorkItemPath("/work/RFI/RFI-2026-0044");
  assert.ok(upper);
  assert.equal(upper.kind, "rfi");
  assert.equal(upper.id, "RFI-2026-0044");

  const lower = parseWorkItemPath("/work/workflow/ws-la82-heavyhaul");
  assert.ok(lower);
  assert.equal(lower.kind, "workflow");
  assert.equal(lower.id, "ws-la82-heavyhaul");
});

test("WorkItemPage renders shared record shell with breadcrumbs, responsibility, and tabs", () => {
  const dummyItem = {
    id: "rfi-test-101",
    sourceId: "rfi-test-101",
    kind: "rfi",
    title: "Stormwater Drainage Capacity Clarification",
    projectName: "SpaceX Starbase Louisiana",
    workstreamId: "WS-WASTEWATER-DELUGE",
    workstreamTitle: "Industrial Wastewater & Launch Deluge",
    statusTone: "amber",
    statusLabel: "ISSUED",
    whyHere: "Reviewer requested drainage calculations",
    whatToDo: "Upload revised hydraulic calculations package",
    removesFromQueue: "Applicant submission",
    ageLabel: "2d ago",
    scheduleImpact: "+0 days",
    priorityScore: 70,
    isCriticalPath: true,
    ownerName: "Maya Chen",
    ownerOrganization: "SpaceX Regulatory",
    requiredInputs: ["Hydraulic calculation model", "Peak storm run-off map"],
    documents: [
      { id: "doc-ver-drainage-1", title: "Site Drainage Plan", category: "engineering" },
    ],
    requiresCurrentUserAction: true,
  };

  const dummyEvents = [
    { id: "evt-1", actorName: "Jordan Lee", actionType: "rfi_issued", occurredAt: "2026-09-01T10:00:00Z", reason: "Clarification needed" },
  ];

  const html = renderToStaticMarkup(
    React.createElement(
      WorkItemPage,
      {
        item: dummyItem,
        events: dummyEvents,
        saving: false,
      },
      React.createElement("div", { "data-testid": "child-content" }, "Inner Detail Content")
    )
  );

  // Verifies shared record shell elements:
  assert.match(html, /Record breadcrumb/i);
  assert.match(html, /SpaceX Starbase Louisiana/);
  assert.match(html, /Industrial Wastewater &amp; Launch Deluge/);
  assert.match(html, /Stormwater Drainage Capacity Clarification/);
  assert.match(html, /Current responsibility/);
  assert.match(html, /Maya Chen/);
  assert.match(html, /SpaceX Regulatory/);
  assert.match(html, /Overview/);
  assert.match(html, /Documents \(1\)/);
  assert.match(html, /Activity \(1\)/);
  assert.match(html, /Inner Detail Content/);
});

test("EntityLink renders semantic link with canonical destination", () => {
  const linkHtml = renderToStaticMarkup(
    React.createElement(EntityLink, {
      entity: { kind: "workstream", id: "WS-LA82-HEAVYHAUL", title: "LA 82 Heavy-Haul Corridor" },
      showIcon: true,
    })
  );

  assert.match(linkHtml, /href="\/workstreams\/WS-LA82-HEAVYHAUL"/);
  assert.match(linkHtml, /data-entity-kind="workstream"/);
  assert.match(linkHtml, /LA 82 Heavy-Haul Corridor/);
  assert.match(linkHtml, /\[workstream\]/);
});
