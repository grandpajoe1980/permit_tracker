import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const mayaMigration = readFileSync(resolve(root, "supabase/migrations/20260909200000_sync_maya_auth_identity.sql"), "utf8");
const personaMigration = readFileSync(resolve(root, "supabase/migrations/20260909201000_merge_demo_persona_identities.sql"), "utf8");

test("canonical authenticated Maya identity owns active authorization records", () => {
  assert.match(mayaMigration, /lower\(email\) = 'maya\.chen@spacex\.com'/i);
  assert.match(mayaMigration, /lower\(email\) = 'maya\.chen@demo\.permit\.local'/i);
  assert.match(mayaMigration, /assignment_group_memberships/);
  assert.match(mayaMigration, /organization_memberships/);
  assert.match(mayaMigration, /user_profiles/);
  assert.match(mayaMigration, /workstreams SET assigned_to_user_id = v_canonical_id/);
  assert.match(mayaMigration, /RAISE EXCEPTION 'Maya identity repair did not preserve/);
});

test("known demo aliases merge into the authenticated persona accounts", () => {
  assert.match(personaMigration, /alex\.martin@demo\.permit\.local/);
  assert.match(personaMigration, /maya\.chen@spacex\.test/);
  assert.match(personaMigration, /sarah\.johnson@demo\.permit\.local/);
  assert.match(personaMigration, /public\.notifications SET recipient_user_id/);
  assert.match(personaMigration, /public\.audit_events SET actor_id/);
  assert.match(personaMigration, /canonical Sarah identity is missing/);
});
