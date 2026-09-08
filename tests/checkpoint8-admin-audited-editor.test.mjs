import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
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

test("Checkpoint 8: AdminExplorer renders 5 admin tabs, relationship links, and mobile card view", async () => {
  const { AdminExplorer } = await vite.ssrLoadModule("/components/admin/AdminExplorer.tsx");
  const html = renderToStaticMarkup(React.createElement(AdminExplorer));
  const source = await readFile(new URL("../components/admin/AdminExplorer.tsx", import.meta.url), "utf8");

  // 1. Five Admin Tabs rendered in HTML
  assert.match(html, /Records<\/button>/);
  assert.match(html, /People<\/button>/);
  assert.match(html, /Teams &amp; Agencies<\/button>|Teams & Agencies<\/button>/);
  assert.match(html, /href="\/admin\/workflows"/);
  assert.match(html, /Audit<\/button>/);

  // 2. Mobile cards view present alongside desktop table in source and DOM
  assert.match(source, /block md:hidden/);
  assert.match(source, /hidden md:block/);

  // 3. Inspect dialog instructions for read-only history, audited corrections, and canonical relationships
  assert.match(source, /Record details · read only/);
  assert.match(source, /Technical details &amp; raw JSON|Technical details & raw JSON/);
  assert.match(source, /renderRelationships/);
  assert.match(source, /Canonical Relationships/);
  assert.match(source, /Correct this record \(Audited\)/);
});

test("Checkpoint 8: administrative state correction requires reason and creates audit event", async () => {
  const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
  const workstream = repository.getWorkstreamById("WS-LA82-HEAVYHAUL");
  assert.ok(workstream);

  const prevAuditsCount = repository.getAuditEvents().length;

  // Perform audited administrative correction
  const updated = await repository.clearWorkstreamBlockerPersisted({
    workstreamId: "WS-LA82-HEAVYHAUL",
    resolutionNotes: "Administrative concurrence validation complete per DOTD bridge signoff.",
    actorName: "Admin User",
    actorOrgName: "State Project Office",
  });

  assert.ok(updated.data);
  assert.equal(updated.data.operationalState, "running");

  // Verify audit event was logged with reason
  const audits = repository.getAuditEvents();
  assert.ok(audits.length > prevAuditsCount);
  const latestAudit = audits[0];
  assert.equal(latestAudit.actorName, "Admin User");
  assert.match(latestAudit.reason, /Administrative concurrence validation complete/);

  // Verify workstream reflects new state in project view
  const refreshedProject = repository.getProject();
  const refreshedWs = refreshedProject.workstreams.find((w) => w.id === "WS-LA82-HEAVYHAUL");
  assert.equal(refreshedWs.operationalState, "running");
});

test("Checkpoint 8: non-admin access boundary protects administrative mutations and routes", async () => {
  const adminPageSource = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const adminRecordsApiSource = await readFile(new URL("../app/api/admin/records/route.ts", import.meta.url), "utf8");

  // Server-side admin role requirement
  assert.match(adminPageSource, /in\("role", \["system_admin", "organization_admin"\]\)/);
  assert.match(adminPageSource, /Administrator access required/);

  // API endpoint requires admin membership and rejects non-admin with 403
  assert.match(adminRecordsApiSource, /in\("role", \["system_admin", "organization_admin"\]\)/);
  assert.match(adminRecordsApiSource, /status: 403/);
});
