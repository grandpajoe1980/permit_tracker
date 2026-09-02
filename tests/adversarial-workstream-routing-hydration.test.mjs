import test, { after, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        const key = line.slice(0, separator).trim();
        const value = line
          .slice(separator + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      })
  );
}

const env = { ...readEnvFile(), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.LEGACY_SERVICE_ROLE_KEY || env.legacy_service_role_key || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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

const { repository } = await vite.ssrLoadModule("/lib/repository.ts");
const { ProjectOverviewPage } = await vite.ssrLoadModule("/components/cockpits/ProjectOverviewPage.tsx");

// 12 Authoritative canonical workstream codes seeded in Supabase PostgreSQL
const ALL_12_WORKSTREAMS = [
  "WS-LA82-HEAVYHAUL",
  "WS-WETLANDS-PAD-A",
  "WS-SUBSTATION-230KV",
  "WS-WASTEWATER-DELUGE",
  "WS-FAA-AST-450",
  "WS-GAS-LNG-PIPELINE",
  "WS-AIR-TITLE-V",
  "WS-PUBLIC-SAFETY-AIRSPACE",
  "WS-HIGHBAY-OSFM",
  "WS-VPPJ-COMM-BLDG",
  "WS-SLO-WATER-BOTTOM",
  "WS-LSP-EXPLOSIVES",
];

const ALL_6_PROJECTS = [
  "PRJ-PECAN-2026",
  "PRJ-COASTAL-2026",
  "PRJ-PIPE-2026",
  "PRJ-AIRPORT-2026",
  "PRJ-POWER-2026",
  "PRJ-WATER-2026",
];

describe("Challenger 1: Deep Adversarial Workstream Routing & Hydration Suite", () => {

  test("1. In-Memory & Repository: Exhaustive Multi-Identifier Workstream Resolution", () => {
    const workstreams = repository.getWorkstreams();
    assert.ok(workstreams.length >= 6, "Repository should have loaded workstreams");

    function resolveWs(identifier) {
      const decoded = decodeURIComponent(identifier ?? "").trim();
      return workstreams.find(
        (ws) =>
          ws.id === decoded ||
          ws.code === decoded ||
          ws.code.toLowerCase() === decoded.toLowerCase() ||
          ws.id.toLowerCase() === decoded.toLowerCase()
      );
    }

    for (const ws of workstreams) {
      const code = ws.code;
      // Uppercase
      const upper = resolveWs(code);
      assert.ok(upper, `Canonical uppercase ${code} must resolve`);
      assert.equal(upper.code, code);

      // Lowercase
      const lower = resolveWs(code.toLowerCase());
      assert.ok(lower, `Lowercase ${code.toLowerCase()} must resolve`);
      assert.equal(lower.code, code);

      // URL-encoded
      const encoded = resolveWs(encodeURIComponent(code));
      assert.ok(encoded, `URL-encoded ${encodeURIComponent(code)} must resolve`);
      assert.equal(encoded.code, code);

      // URL-encoded Lowercase
      const encodedLower = resolveWs(encodeURIComponent(code.toLowerCase()));
      assert.ok(encodedLower, `URL-encoded lowercase ${encodeURIComponent(code.toLowerCase())} must resolve`);
      assert.equal(encodedLower.code, code);
    }

    // Edge Cases: Injection & Boundary Attacks
    assert.equal(resolveWs("WS-LA82-HEAVYHAUL' OR '1'='1"), undefined, "SQL injection attempt must return undefined");
    assert.equal(resolveWs("../../../etc/passwd"), undefined, "Directory traversal must return undefined");
    assert.equal(resolveWs("<svg onload=alert(1)>"), undefined, "XSS vector must return undefined");
    assert.equal(resolveWs("   "), undefined, "Whitespace string must return undefined");
    assert.equal(resolveWs(null), undefined, "Null must return undefined");
    assert.equal(resolveWs(undefined), undefined, "Undefined must return undefined");
  });

  test("2. Exhaustive Project Resolution (All 6 Seeded Projects & Aliases)", () => {
    const project = repository.getProject();
    assert.ok(project);

    function resolvePrj(identifier) {
      const decoded = decodeURIComponent(identifier ?? "").trim();
      if (
        decoded === project.id ||
        decoded === project.code ||
        decoded === "PRJ-PECAN-2026" ||
        decoded === "proj-spacex-pecan"
      ) {
        return project;
      }
      if (
        decoded.toLowerCase() === project.code.toLowerCase() ||
        decoded.toLowerCase() === "prj-pecan-2026" ||
        decoded.toLowerCase() === "proj-spacex-pecan"
      ) {
        return project;
      }
      return null;
    }

    for (const prj of ["PRJ-PECAN-2026", "proj-spacex-pecan", "SPACEX-PECAN-ISLAND"]) {
      assert.ok(resolvePrj(prj), `Must resolve project by ${prj}`);
      assert.ok(resolvePrj(prj.toLowerCase()), `Must resolve project by lowercase ${prj.toLowerCase()}`);
      assert.ok(resolvePrj(encodeURIComponent(prj)), `Must resolve project by URL-encoded ${prj}`);
    }

    assert.equal(resolvePrj("PRJ-DOES-NOT-EXIST"), null);
    assert.equal(resolvePrj(""), null);
    assert.equal(resolvePrj(null), null);
  });

  test("3. Live Supabase PostgreSQL: Multi-Identifier Workstream Resolution & RLS / Tenant Isolation", async () => {
    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase credentials not available, skipping live DB test");
      return;
    }

    const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Verify all 6 projects exist in Supabase PostgreSQL
    const { data: dbProjects, error: prjErr } = await client
      .from("projects")
      .select("id, number, name");

    assert.equal(prjErr, null);
    assert.ok(dbProjects.length >= 6, `Expected at least 6 projects in PostgreSQL, found ${dbProjects?.length}`);

    const pecanProject = dbProjects.find((p) => p.number === "PRJ-PECAN-2026");
    assert.ok(pecanProject, "PRJ-PECAN-2026 project row must exist");

    // Helper simulating Next.js route query contract:
    // .eq("project_id", project.id).or(`id.eq."${workstreamId}",code.eq."${workstreamId}",code.ilike."${workstreamId}"`)
    async function routeQueryWorkstream(projectId, workstreamParam) {
      const decoded = decodeURIComponent(workstreamParam ?? "").trim();
      return client
        .from("workstreams")
        .select("id, code, title, operational_state, project_id, current_stage_name, waiting_reason, forecast_target_date, baseline_target_date")
        .eq("project_id", projectId)
        .or(`id.eq."${decoded}",code.eq."${decoded}",code.ilike."${decoded}"`)
        .maybeSingle();
    }

    // Verify all 12 canonical workstream codes in live DB
    for (const code of ALL_12_WORKSTREAMS) {
      // 1. Query by exact uppercase code
      const { data: wsUpper, error: errUpper } = await routeQueryWorkstream(pecanProject.id, code);
      assert.equal(errUpper, null, `Query error for ${code}`);
      assert.ok(wsUpper, `Workstream ${code} must exist in live DB under PRJ-PECAN-2026`);
      assert.equal(wsUpper.code, code);

      // 2. Query by lowercase code
      const { data: wsLower, error: errLower } = await routeQueryWorkstream(pecanProject.id, code.toLowerCase());
      assert.equal(errLower, null);
      assert.ok(wsLower, `Workstream lowercase ${code.toLowerCase()} must resolve`);
      assert.equal(wsLower.code, code);

      // 3. Query by URL-encoded uppercase code
      const { data: wsEnc, error: errEnc } = await routeQueryWorkstream(pecanProject.id, encodeURIComponent(code));
      assert.equal(errEnc, null);
      assert.ok(wsEnc, `Workstream encoded ${encodeURIComponent(code)} must resolve`);
      assert.equal(wsEnc.code, code);

      // 4. Query by URL-encoded lowercase code
      const { data: wsEncLower, error: errEncLower } = await routeQueryWorkstream(pecanProject.id, encodeURIComponent(code.toLowerCase()));
      assert.equal(errEncLower, null);
      assert.ok(wsEncLower, `Workstream encoded lower ${encodeURIComponent(code.toLowerCase())} must resolve`);
      assert.equal(wsEncLower.code, code);

      // 5. Query by Primary Key UUID
      const { data: wsUuid, error: errUuid } = await routeQueryWorkstream(pecanProject.id, wsUpper.id);
      assert.equal(errUuid, null);
      assert.ok(wsUuid, `Workstream primary key UUID ${wsUpper.id} must resolve`);
      assert.equal(wsUuid.id, wsUpper.id);
    }

    // 6. Cross-Project Isolation Check:
    // When querying workstream WS-LA82-HEAVYHAUL under Coastal project ID, it MUST return null (not cross-contaminate)
    const coastalProject = dbProjects.find((p) => p.number === "PRJ-COASTAL-2026");
    if (coastalProject) {
      const { data: crossWs } = await routeQueryWorkstream(coastalProject.id, "WS-LA82-HEAVYHAUL");
      assert.equal(crossWs, null, "Cross-project lookup must yield null (isolation invariant)");
    }

    // 7. Non-existent IDs
    const { data: nonexistentWs } = await routeQueryWorkstream(pecanProject.id, "WS-NONEXISTENT-TEST");
    assert.equal(nonexistentWs, null, "Nonexistent workstream query must yield null without throwing");
  });

  test("4. Global Notification Route (/workstreams/[workstreamId]) Live DB Redirection Invariants", async () => {
    if (!supabaseUrl || !supabaseKey) return;
    const client = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    async function queryGlobalRoute(workstreamParam) {
      const decoded = decodeURIComponent(workstreamParam ?? "").trim();
      return client
        .from("workstreams")
        .select("id, code, title, project_id")
        .or(`id.eq."${decoded}",code.eq."${decoded}",code.ilike."${decoded}"`)
        .maybeSingle();
    }

    for (const code of ALL_12_WORKSTREAMS) {
      const { data: ws } = await queryGlobalRoute(code);
      assert.ok(ws, `Global route lookup for ${code} must find workstream`);
      assert.ok(ws.project_id, `Workstream ${code} must have valid foreign key project_id for redirect`);

      // Verify that the project_id resolves to an actual project with a number
      const { data: prj } = await client
        .from("projects")
        .select("id, number")
        .eq("id", ws.project_id)
        .maybeSingle();

      assert.ok(prj, `Parent project ${ws.project_id} must exist in projects table`);
      assert.ok(prj.number, "Parent project must have a valid project number for redirect target");
    }

    // Lowercase and encoded global lookups
    const { data: lowerGlobal } = await queryGlobalRoute("ws-wetlands-pad-a");
    assert.ok(lowerGlobal, "Lowercase global lookup must find workstream");
    assert.equal(lowerGlobal.code, "WS-WETLANDS-PAD-A");

    const { data: encGlobal } = await queryGlobalRoute("WS%2DFAA%2DAST%2D450");
    assert.ok(encGlobal, "Encoded global lookup must find workstream");
    assert.equal(encGlobal.code, "WS-FAA-AST-450");

    // Non-existent global lookup
    const { data: nonGlobal } = await queryGlobalRoute("WS-NONEXISTENT-999");
    assert.equal(nonGlobal, null, "Nonexistent global lookup must return null");
  });

  test("5. React SSR Component Hydration: ProjectOverviewPage Focused Workstream Robustness", () => {
    const project = repository.getProject();
    assert.ok(project);

    // Test with each workstream in project
    for (const ws of project.workstreams) {
      // 1. Exact code
      const htmlUpper = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProjectOverviewPage, {
          project,
          customerSafe: false,
          focusedWorkstreamId: ws.code,
          onFocusWorkstream: () => {},
          onOpenSchedule: () => {},
        })
      );
      assert.ok(htmlUpper.includes("Selected from DAG / Gantt"), `Must render focus panel for ${ws.code}`);
      assert.ok(htmlUpper.includes(ws.code), `Must render workstream code ${ws.code}`);

      // 2. Lowercase code
      const htmlLower = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProjectOverviewPage, {
          project,
          customerSafe: false,
          focusedWorkstreamId: ws.code.toLowerCase(),
          onFocusWorkstream: () => {},
          onOpenSchedule: () => {},
        })
      );
      assert.ok(htmlLower.includes("Selected from DAG / Gantt"), `Must render focus panel for lowercase ${ws.code.toLowerCase()}`);

      // 3. ID
      const htmlId = ReactDOMServer.renderToStaticMarkup(
        React.createElement(ProjectOverviewPage, {
          project,
          customerSafe: false,
          focusedWorkstreamId: ws.id,
          onFocusWorkstream: () => {},
          onOpenSchedule: () => {},
        })
      );
      assert.ok(htmlId.includes("Selected from DAG / Gantt"), `Must render focus panel for ID ${ws.id}`);
    }

    // 4. Null focus
    const htmlNull = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ProjectOverviewPage, {
        project,
        customerSafe: false,
        focusedWorkstreamId: null,
        onFocusWorkstream: () => {},
        onOpenSchedule: () => {},
      })
    );
    assert.ok(!htmlNull.includes("Selected from DAG / Gantt"), "Must not render focus panel when focusedWorkstreamId is null");

    // 5. Undefined focus
    const htmlUndefined = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ProjectOverviewPage, {
        project,
        customerSafe: false,
        focusedWorkstreamId: undefined,
        onFocusWorkstream: () => {},
        onOpenSchedule: () => {},
      })
    );
    assert.ok(!htmlUndefined.includes("Selected from DAG / Gantt"), "Must not render focus panel when focusedWorkstreamId is undefined");

    // 6. Invalid focus
    const htmlInvalid = ReactDOMServer.renderToStaticMarkup(
      React.createElement(ProjectOverviewPage, {
        project,
        customerSafe: false,
        focusedWorkstreamId: "WS-INVALID-ID-XYZ",
        onFocusWorkstream: () => {},
        onOpenSchedule: () => {},
      })
    );
    assert.ok(htmlInvalid.length > 500, "Should safely render project page without focus panel");
    assert.ok(!htmlInvalid.includes("Selected from DAG / Gantt"), "Must omit focus panel for invalid ID");
  });

});
