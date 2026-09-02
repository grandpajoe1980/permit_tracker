import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const adminRoute = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
const catalog = await readFile(new URL("../components/cockpits/PermitCatalogPanel.tsx", import.meta.url), "utf8");

test("administration has a server-side membership boundary and a labeled entry point", () => {
  assert.match(adminRoute, /organization_memberships/);
  assert.match(adminRoute, /system_admin.*organization_admin/);
  assert.match(adminRoute, /PATH administration/);
  assert.match(page, /Administration/);
});

test("the public Permit Catalog contains resources, not configuration tabs", () => {
  assert.doesNotMatch(catalog, /WorkflowDesignerPanel|Agency Registry|activeTab/);
  assert.match(catalog, /Start this request/);
  assert.match(catalog, /Open internal demo submission guide/);
});
