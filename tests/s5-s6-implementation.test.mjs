import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [coordinationMigration, catalogMigration, mutations, catalog, adminRoute, shell, scenarioSeed, commandSeed] = await Promise.all([
  read("supabase/migrations/20260907200000_coordination_response_transaction.sql"),
  read("supabase/migrations/20260907201000_catalog_resource_provenance.sql"),
  read("lib/supabase/mutations.ts"),
  read("components/cockpits/PermitCatalogPanel.tsx"),
  read("app/admin/page.tsx"),
  read("app/page.tsx"),
  read("scripts/seed-demo-scenarios.mjs"),
  read("scripts/seed-command-system-supabase.mjs"),
]);

test("S5 coordination responses are server-owned, independently auditable, and notify the configured requesting team", () => {
  assert.match(coordinationMigration, /auth\.uid\(\)/);
  assert.match(coordinationMigration, /has_project_access\(v_workstream\.project_id\)/);
  assert.match(coordinationMigration, /is_org_member\(v_target_org_id\)/);
  assert.match(coordinationMigration, /notificationRecipientCount/);
  assert.match(coordinationMigration, /dedupe_key/);
  assert.match(coordinationMigration, /dependencyCleared.*false/s);
  assert.doesNotMatch(coordinationMigration, /operational_state\s*=/);
  assert.match(coordinationMigration, /revoke all on function public\.rpc_update_coordination_request/);
  assert.match(coordinationMigration, /grant execute on function public\.rpc_update_coordination_request.*authenticated/s);
  assert.match(mutations, /rpc\("rpc_update_coordination_request"/);
  assert.match(mutations, /allowsFixtureData\(\)/);
});

test("S6 catalog resources expose provenance and distinguish official, demo, unavailable, and file links", () => {
  assert.match(catalog, /resourceClassification/);
  assert.match(catalog, /sourceAuthority/);
  assert.match(catalog, /Internal demo guide/);
  assert.match(catalog, /Download file/);
  assert.match(catalog, /Verification overdue/);
  assert.match(catalog, /No link is configured/);
  assert.doesNotMatch(catalog, /Download internal demo form guide/);
  assert.match(catalogMigration, /effective_date/);
  assert.match(catalogMigration, /source_authority/);
  assert.match(catalogMigration, /resource_classification/);
  assert.match(catalogMigration, /alter column url drop not null/);
  assert.match(commandSeed, /resource_classification/);
});

test("S6 admin entry points name every administration surface and keep the read boundary", () => {
  assert.match(adminRoute, /Agency Registry/);
  assert.match(adminRoute, /Users, roles &amp; memberships/);
  assert.match(adminRoute, /Record inspector/);
  assert.match(adminRoute, /organization_memberships/);
  assert.match(adminRoute, /AdminExplorer/);
  assert.match(shell, /id="admin-directory"/);
  assert.match(shell, /id="agency-registry"/);
  assert.match(scenarioSeed, /PATH-DEMO-SEED-2026-09-07/);
  assert.doesNotMatch(scenarioSeed, /\.delete\(|\.remove\(|DROP\s+TABLE|TRUNCATE/i);
});
