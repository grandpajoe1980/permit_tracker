import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, layout, css, readme, portalMigration, hardeningMigration, policyMigration, actionMigration, actionNotificationMigration, workflowRlsMigration, identifierModule, mutations, dataMode, projectRoute, workstreamRoute, requestRoute, seedScript, commandSeedScript, repository] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830120000_customer_portal_delivery.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830150635_harden_command_system_rls_and_seed_portal_support.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830152028_consolidate_customer_request_update_policy.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830214000_workstream_action_transactions.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830220000_workstream_action_notifications.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830222000_scope_workflow_metadata_rls.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/project-identifiers.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabase/mutations.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/data-mode.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/projects/[projectNumber]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/projects/[projectNumber]/workstreams/[workstreamId]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/requests/[confirmationNumber]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../scripts/seed-spacex-demo.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/seed-command-system-supabase.mjs", import.meta.url), "utf8"),
  readFile(new URL("../lib/repository.ts", import.meta.url), "utf8"),
]);

test("uses the typed domain module without duplicating fixtures in the UI", () => {
  assert.match(page, /^"use client";/);
  assert.match(page, /from "@\/lib\/demo-data"/);
  assert.match(page, /from "@\/lib\/permit-utils"/);
  assert.doesNotMatch(page, /applicant\.happypath/);
});

test("preserves stable journey labels and semantic controls", () => {
  assert.match(page, /SpaceX Louisiana/i);
  assert.match(page, /Sign in to Critical Path/i);
  assert.match(page, /Critical Path/i);
  assert.match(page, /id="login-submit"/);
  assert.match(page, /id="demo-login-trigger"/);
  assert.match(page, /id="login-error" role="alert"/);
  assert.match(page, /id="intake-submit-btn"/);
  assert.match(page, /createRequestForUser/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /Agency Workload/i);
  assert.match(page, /Inter-Agency Escalation Path/i);
  assert.match(page, /Gantt/i);
  assert.match(page, /Statutory/i);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|onclick\s*=/);
});

test("ships final product metadata without starter preview markers", () => {
  assert.match(layout, /Critical Path/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
});

test("includes responsive, focus, reduced-motion, and print protections", () => {
  assert.match(css, /\.skip-link:focus/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /@media print/);
});

test("documents the public-demo boundary and production security gap", () => {
  assert.match(readme, /proof of concept|demo/i);
  assert.match(readme, /not a security boundary|statutory|coordination/i);
});

test("ships the customer schema, RLS hardening, and service-role seed contract", () => {
  assert.match(portalMigration, /CREATE TABLE IF NOT EXISTS public\.user_profiles/i);
  assert.match(portalMigration, /CREATE TABLE IF NOT EXISTS public\.external_filings/i);
  assert.match(portalMigration, /CREATE TABLE IF NOT EXISTS public\.customer_requests/i);
  assert.match(hardeningMigration, /drop policy if exists.*Public full access policy/i);
  assert.match(hardeningMigration, /revoke all on table.*from anon/i);
  assert.match(hardeningMigration, /app_private\.is_system_admin/i);
  assert.match(policyMigration, /create policy customer_requests_update/i);
  assert.doesNotMatch(seedScript, /import ["']dotenv\/config["']/);
  assert.match(seedScript, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(seedScript, /system_admin/);
  assert.doesNotMatch(commandSeedScript, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.match(commandSeedScript, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("keeps production mutations and routes server-confirmed", () => {
  assert.match(dataMode, /export function requiresSupabase/);
  assert.match(dataMode, /return getAppDataMode\(\) === "production"/);
  assert.match(page, /createWorkstreamFromRequestPersisted/);
  assert.match(page, /clearWorkstreamBlockerPersisted/);
  assert.doesNotMatch(page, /triggerFileDownload/);
  assert.match(actionMigration, /rpc_mark_workstream_blocked/);
  assert.match(actionMigration, /rpc_escalate_workstream/);
  assert.match(actionMigration, /rpc_transfer_workstream/);
  assert.match(actionNotificationMigration, /audit_events_workstream_action_notification/);
  assert.match(actionNotificationMigration, /recipient_id, user_id, title, message, body/);
  assert.match(workflowRlsMigration, /workflow_transitions_select_project/);
  assert.match(workflowRlsMigration, /workflow_checklist_items_select_project/);
  assert.match(workflowRlsMigration, /app_private\.has_project_access/);
  assert.doesNotMatch(workflowRlsMigration, /using\s*\(true\)/i);
  assert.doesNotMatch(repository, /void\s+(?:mutate|insertNotification)/);
  assert.doesNotMatch(page, /repository\.dispatchNotification\(\{ userId: "user-sarah-johnson"/);
  assert.match(identifierModule, /canonicalProjectReference/);
  assert.match(mutations, /canonicalProjectReference\(params\.projectId\)/);
  assert.match(projectRoute, /createRequestSupabaseClient/);
  assert.match(workstreamRoute, /\.eq\("project_id", project\.id\)/);
  assert.match(requestRoute, /createRequestSupabaseClient/);
});
