import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, ws: false } });
const { summarizeProjectWorkstreams } = await vite.ssrLoadModule("/lib/project-portfolio.ts");
test.after(() => vite.close());

test("portfolio counts classify each visible project's workstream states without cross-project bleed", () => {
  const counts = summarizeProjectWorkstreams([
    { project_id: "p1", operational_state: "running" },
    { project_id: "p1", operational_state: "waiting_government" },
    { project_id: "p1", operational_state: "blocked" },
    { project_id: "p1", operational_state: "escalated" },
    { project_id: "p1", operational_state: "complete" },
    { project_id: "p1", operational_state: "cancelled" },
    { project_id: "p2", operational_state: "running" },
    { project_id: "hidden", operational_state: "blocked" },
  ], ["p1", "p2"]);
  assert.deepEqual(counts.p1, { open: 4, blocked: 2, waiting: 1, completed: 1 });
  assert.deepEqual(counts.p2, { open: 1, blocked: 0, waiting: 0, completed: 0 });
  assert.equal(Object.hasOwn(counts, "hidden"), false);
});

test("portfolio workload query is bounded to project IDs visible from the RLS-filtered list", async () => {
  const queries = await readFile(new URL("../lib/supabase/queries.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(queries, /from\("projects"\)\.select\("id, number, name, status, risk, target_date"\)/);
  assert.match(queries, /from\("workstreams"\)\.select\("project_id, operational_state"\)\.in\("project_id", projectIds\)/);
  assert.match(page, /Workstream snapshot · visible records/);
  assert.match(page, /Workload totals are unavailable/);
});
