import assert from "node:assert/strict";
import test, { after } from "node:test";
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

const { fetchCustomerRequests } = await vite.ssrLoadModule("/lib/supabase/queries.ts");
const { normalizeProjectReference, projectReferenceFromUrl } = await vite.ssrLoadModule("/lib/project-identifiers.ts");
const { buildShellPath, parseShellPath } = await vite.ssrLoadModule("/lib/navigation.ts");

const projects = [
  { id: "10000000-0000-4000-8000-000000000001", number: "PRJ-ALPHA-2040" },
  { id: "20000000-0000-4000-8000-000000000002", number: "PRJ-BRAVO-2040" },
];
const requests = [
  { id: "request-alpha", project_id: projects[0].id, confirmation_number: "PATH-A-1", request_type: "permit_authorization", title: "Alpha request", description: "Alpha only" },
  { id: "request-bravo", project_id: projects[1].id, confirmation_number: "PATH-B-1", request_type: "permit_authorization", title: "Bravo request", description: "Bravo only" },
];

function createScopedQueryClient() {
  return {
    from(table) {
      const filters = [];
      const query = {
        select() { return this; },
        eq(column, value) { filters.push({ kind: "eq", column, value }); return this; },
        in(column, values) { filters.push({ kind: "in", column, values }); return this; },
        order() {
          if (table === "projects") return Promise.resolve({ data: [], error: null });
          let rows = table === "customer_requests" ? requests : [];
          for (const filter of filters) {
            rows = rows.filter((row) => filter.kind === "eq"
              ? row[filter.column] === filter.value
              : filter.values.includes(row[filter.column]));
          }
          return Promise.resolve({ data: rows, error: null });
        },
        async maybeSingle() {
          const filter = filters.find((entry) => entry.kind === "eq");
          const data = projects.find((project) => project[filter?.column] === filter?.value) ?? null;
          return { data, error: null };
        },
      };
      return query;
    },
  };
}

test("explicit project scope isolates request hydration across two projects", async () => {
  const client = createScopedQueryClient();
  const alpha = await fetchCustomerRequests("PRJ-ALPHA-2040", client);
  const bravo = await fetchCustomerRequests("PRJ-BRAVO-2040", client);
  const unavailable = await fetchCustomerRequests("PRJ-NOT-AUTHORIZED", client);

  assert.deepEqual(alpha.map((request) => request.id), ["request-alpha"]);
  assert.deepEqual(bravo.map((request) => request.id), ["request-bravo"]);
  assert.deepEqual(unavailable, []);
  assert.ok(alpha.every((request) => request.projectId === projects[0].id));
  assert.ok(bravo.every((request) => request.projectId === projects[1].id));
});

test("project references stay explicit in login URLs and app navigation", () => {
  assert.equal(normalizeProjectReference(null), null);
  assert.equal(normalizeProjectReference("  PRJ-ALPHA-2040  "), "PRJ-ALPHA-2040");
  assert.equal(normalizeProjectReference("proj-spacex-pecan"), "PRJ-PECAN-2026");

  const path = buildShellPath("project", "WS-A", "schedule", undefined, "PRJ-ALPHA-2040");
  const url = new URL(path, "https://path.example");
  assert.equal(projectReferenceFromUrl(url), "PRJ-ALPHA-2040");
  assert.equal(parseShellPath(url).projectId, "PRJ-ALPHA-2040");
});
