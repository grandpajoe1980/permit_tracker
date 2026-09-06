import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true } });
after(() => vite.close());
const { buildShellPath, parseShellPath } = await vite.ssrLoadModule("/lib/navigation.ts");
const { ADMIN_RESOURCES, isAdminResource } = await vite.ssrLoadModule("/lib/admin-resources.ts");
const source = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("catalog and admin deep links survive navigation round trips", () => {
  for (const route of ["catalog", "admin", "secondary"]) {
    assert.equal(parseShellPath(new URL(buildShellPath(route), "https://path.example")).route, route);
  }
});

test("explorer permits only the explicit resource allowlist", () => {
  for (const resource of Object.keys(ADMIN_RESOURCES)) assert.equal(isAdminResource(resource), true);
  for (const resource of ["auth.users", "__proto__", "constructor", "secrets", "tasks;drop table tasks"]) assert.equal(isAdminResource(resource), false);
  for (const resource of ["projects", "tasks", "organizations", "user_profiles", "assignment_groups", "workflow_versions", "audit_events"]) assert.ok(ADMIN_RESOURCES[resource]);
});

test("admin endpoint authenticates, checks membership, retains RLS, and is read only", async () => {
  const api = await source("app/api/admin/records/route.ts");
  assert.match(api, /auth\.getUser\(\)/);
  assert.match(api, /eq\("user_id", auth\.user\.id\)/);
  assert.match(api, /eq\("status", "active"\)/);
  assert.match(api, /system_admin.*organization_admin/);
  assert.match(api, /status: 401/);
  assert.match(api, /status: 403/);
  assert.match(api, /private, no-store/);
  assert.match(api, /Number\.isSafeInteger\(page\)/);
  assert.match(api, /range\(page \* 50, page \* 50 \+ 49\)/);
  assert.doesNotMatch(api, /service_role|\.update\(|\.delete\(|\.insert\(|export async function (POST|PATCH|DELETE)/);
});

test("visible home CTA precedes project content", async () => {
  const home = await source("components/path/customer/CustomerHome.tsx");
  assert.doesNotMatch(home, /sr-only/);
  assert.ok(home.indexOf("Submit a Request") < home.indexOf("{children}"));
  assert.match(home, /onClick=\{onSubmitRequest\}/);
  assert.match(home, /view=catalog/);
});

test("quick demo sign-in includes executive sponsor personas", async () => {
  const login = await source("components/path/LoginPage.tsx");
  const data = await source("lib/demo-data.ts");
  for (const name of ["Elon Musk", "Jeff Landry", "Susan Bourgeois"]) assert.match(data, new RegExp(`name: "${name}"`));
  assert.match(login, /max-h-\[52vh\] space-y-2 overflow-y-auto/);
  assert.match(login, /demoPersonas\.map/);
});

test("service starters carry a title into the existing persisted intake", async () => {
  const services = await source("components/path/customer/GovernmentServices.tsx");
  const page = await source("app/page.tsx");
  for (const title of ["Road expansion", "Mobile OMV", "Water testing"]) assert.ok(services.includes(title));
  assert.match(services, /Demo concept/);
  assert.match(services, /onRequest\(service.title, service.details\)/);
  assert.match(page, /openRequestCenter\("service"\); setRequestTitle\(title\)/);
  assert.match(page, /repository\.createCustomerRequestPersisted/);
  const overview = page.slice(page.indexOf("function renderCustomerOverview"), page.indexOf("function renderCustomerRequestCenter"));
  assert.doesNotMatch(overview, /<PermitCatalogPanel/);
});

test("explorer handles aborts, errors, pagination and read-only history", async () => {
  const explorer = await source("components/admin/AdminExplorer.tsx");
  assert.match(explorer, /controller.abort\(\)/);
  assert.match(explorer, /role="alert"/);
  assert.match(explorer, /Search this page/);
  assert.match(explorer, /Record details · read only/);
  assert.match(explorer, /Open existing work editor/);
  assert.match(explorer, /<Dialog open=\{Boolean\(selected\)\}/);
  assert.match(explorer, /max-h-\[85vh\] max-w-3xl overflow-y-auto/);
});

test("administrator directory shows real membership roles and protects self access", async () => {
  const directory = await source("components/admin/AdminDirectory.tsx");
  const adminUsers = await source("lib/admin-users.ts");
  assert.match(directory, /Search people and access/);
  assert.match(directory, /includes people without an active organization role/);
  assert.match(directory, /filteredUsers\.map/);
  assert.match(adminUsers, /return profiles/);
  assert.match(adminUsers, /activeMemberships\.filter/);
});

test("administrator directory manages searchable assignment groups and queue membership", async () => {
  const directory = await source("components/admin/AdminDirectory.tsx");
  const repository = await source("lib/repository.ts");
  assert.match(directory, /Teams & assignment groups/);
  assert.match(directory, /Search teams and assignment groups/);
  assert.match(directory, /Create team/);
  assert.match(directory, /Eligible members/);
  assert.match(directory, /manageAssignmentGroupPersisted/);
  assert.match(directory, /manageAssignmentGroupMembershipPersisted/);
  assert.match(repository, /async manageAssignmentGroupPersisted/);
  assert.match(repository, /async manageAssignmentGroupMembershipPersisted/);
  assert.match(repository, /mutateManageAssignmentGroup/);
  assert.match(repository, /mutateManageAssignmentGroupMembership/);
});
