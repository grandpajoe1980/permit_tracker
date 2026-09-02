import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, mutations, repository, migration] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabase/mutations.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/repository.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260902181319_update_commitment_status.sql", import.meta.url), "utf8"),
]);

test("commitment completion uses the persisted update path and reports failures", () => {
  assert.match(page, /repository\.updateCommitmentStatusPersisted\(/);
  assert.match(page, /notes: actionNote\.trim\(\) \|\| undefined/);
  assert.match(page, /The commitment status was not confirmed by the database/);
  assert.doesNotMatch(page, /repository\.updateCommitmentStatus\(item\.sourceId, commitmentNewStatus, actorName\)/);
  assert.match(repository, /async updateCommitmentStatusPersisted\(/);
  assert.match(repository, /await this\.hydrateFromSupabase\(\)/);
  assert.match(mutations, /rpc\("rpc_update_commitment_status"/);
  assert.match(mutations, /p_commitment_id: params\.commitmentId/);
});

test("commitment status RPC is authenticated, project-scoped, and auditable", () => {
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /SET search_path = public, app_private/);
  assert.match(migration, /IF v_actor_id IS NULL/);
  assert.match(migration, /app_private\.has_project_access\(v_project_id\)/);
  assert.match(migration, /UPDATE public\.commitments/);
  assert.match(migration, /INSERT INTO public\.audit_events/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.rpc_update_commitment_status/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.rpc_update_commitment_status.*authenticated/);
});
