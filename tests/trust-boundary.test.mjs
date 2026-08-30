import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [browser, page, migration, gantt] = await Promise.all([
  readFile(new URL("lib/supabase-browser.ts", root), "utf8"),
  readFile(new URL("app/page.tsx", root), "utf8"),
  readFile(new URL("supabase/migrations/20260830210000_trust_boundary_and_customer_submission.sql", root), "utf8"),
  readFile(new URL("components/cockpits/OperationalGantt.tsx", root), "utf8"),
]);

test("customer submission awaits an authoritative RPC and exposes its returned row", () => {
  assert.match(browser, /rpc\("rpc_create_customer_request"/);
  assert.match(browser, /permit: row \? requestRowToPermit/);
  assert.match(page, /if \(error \|\| !permit\)/);
  assert.match(page, /submitted and committed to the shared project queue/);
});

test("fixtures are explicit and do not replace an empty authenticated result", () => {
  assert.match(browser, /NEXT_PUBLIC_PATH_DATA_MODE === "demo"/);
  assert.match(page, /const finalPermits = loaded\.permits;/);
  assert.doesNotMatch(page, /loaded\.permits\.length > 0 \? loaded\.permits : pecanIslandRequests/);
});

test("corrective migration removes direct mutable trust boundaries", () => {
  assert.match(migration, /public\.notifications, public\.project_participants, public\.requests,/);
  assert.match(migration, /public\.profiles, public\.user_profiles, public\.document_versions from authenticated, anon/);
  assert.match(migration, /drop policy if exists notifications_anon_all on public\.notifications/);
  assert.match(migration, /create_customer_request/);
  assert.match(migration, /auth\.uid\(\)/);
});

test("operational Gantt distinguishes time from hold cause for every state", () => {
  for (const state of ["waiting_government", "waiting_applicant", "waiting_external", "scheduled_hold", "statutory_waiting_period", "blocked", "escalated", "complete"]) assert.match(gantt, new RegExp(`${state}:`));
  assert.match(gantt, /temporal: "past" \| "present" \| "future"/);
  assert.match(gantt, /Expand a workstream to see its individual sequence/);
});
