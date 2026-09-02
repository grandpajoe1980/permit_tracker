import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [page, layout, css, readme, productCopy, navigation, portalMigration, hardeningMigration, policyMigration, actionMigration, actionNotificationMigration, workflowRlsMigration, catalogAdminMigration, triageMigration, versionedCompletionMigration, requestActorMigration, attachmentMigration, workflowAdminScopeMigration, roleMigration, dependencyMigration, identifierModule, mutations, dataMode, projectRoute, workstreamRoute, requestRoute, requestApi, workflowPanel, seedScript, commandSeedScript, repository, rlsScript] = await Promise.all([
  readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../README.md", import.meta.url), "utf8"),
  readFile(new URL("../lib/product-copy.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/navigation.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830120000_customer_portal_delivery.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830150635_harden_command_system_rls_and_seed_portal_support.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830152028_consolidate_customer_request_update_policy.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830214000_workstream_action_transactions.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830220000_workstream_action_notifications.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830222000_scope_workflow_metadata_rls.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830223000_catalog_admin_transactions.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830225000_atomic_multi_workstream_triage.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830231000_pin_legacy_workflows_and_enforce_versioned_completion.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830232000_secure_customer_request_actor.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830233000_customer_request_first_attachment.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830234000_scope_workflow_admin_by_organization.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830235000_persist_organization_member_roles.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260830240000_enforce_mandatory_task_dependencies.sql", import.meta.url), "utf8"),
  readFile(new URL("../lib/project-identifiers.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/supabase/mutations.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/data-mode.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/projects/[projectNumber]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/projects/[projectNumber]/workstreams/[workstreamId]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/requests/[confirmationNumber]/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/api/requests/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../components/cockpits/WorkflowDesignerPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../scripts/seed-spacex-demo.mjs", import.meta.url), "utf8"),
  readFile(new URL("../scripts/seed-command-system-supabase.mjs", import.meta.url), "utf8"),
  readFile(new URL("../lib/repository.ts", import.meta.url), "utf8"),
  readFile(new URL("../scripts/test-supabase-rls-isolation.mjs", import.meta.url), "utf8"),
]);
const workflowQueries = await readFile(new URL("../lib/supabase/queries.ts", import.meta.url), "utf8");
const loginPage = await readFile(new URL("../components/path/LoginPage.tsx", import.meta.url), "utf8");

test("uses the typed domain module without duplicating fixtures in the UI", () => {
  assert.match(page, /^"use client";/);
  assert.match(page, /from "@\/lib\/demo-data"/);
  assert.match(page, /from "@\/lib\/permit-utils"/);
  assert.doesNotMatch(page, /applicant\.happypath/);
});

test("preserves stable journey labels and semantic controls", () => {
  assert.match(page, /PROGRAM_SUBTITLE/);
  assert.match(page, /Critical Path/i);
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
  assert.match(layout, /PROGRAM_SUBTITLE/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
});

test("centralizes PATH product and project display copy", () => {
  assert.match(productCopy, /PRODUCT_NAME\s*=\s*[\"']PATH[\"']/);
  assert.match(productCopy, /PROGRAM_SUBTITLE\s*=\s*[\"']Starbase Louisiana/);
  assert.match(productCopy, /PROJECT_DISPLAY_NAME\s*=\s*[\"']SpaceX/);
});

test("defines canonical shell and work-item navigation contracts", () => {
  assert.match(navigation, /buildWorkItemPath/);
  assert.match(navigation, /\/work\//);
  assert.match(navigation, /parseWorkItemPath/);
  assert.match(page, /window\.history\.pushState/);
  assert.match(page, /window\.addEventListener\("popstate"/);
  assert.match(page, /requestedWorkItemPath/);
});

test("keeps the login surface focused and preserves demo access", () => {
  assert.match(loginPage, /Sign in to \{PRODUCT_NAME\}/);
  assert.match(loginPage, /id="login-submit"/);
  assert.match(loginPage, /id="demo-login-trigger"/);
  assert.match(loginPage, /Quick Demo Sign-In/);
  assert.match(loginPage, /id="login-error" role="alert"/);
  assert.doesNotMatch(loginPage, /PATH tells you what to do next|Your default landing page|See work assigned to you/);
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
  assert.match(page, /triageCustomerRequestPersisted/);
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
  assert.match(catalogAdminMigration, /rpc_register_organization/);
  assert.match(catalogAdminMigration, /rpc_create_permit_type/);
  assert.match(catalogAdminMigration, /require_workflow_admin/);
  assert.match(triageMigration, /rpc_triage_customer_request/);
  assert.match(triageMigration, /triaged_workstream_ids/);
  assert.match(triageMigration, /insert into public\.tasks/);
  assert.match(mutations, /mutateTriageCustomerRequest/);
  assert.match(repository, /triageCustomerRequestPersisted/);
  assert.match(page, /getWorkflowTemplates/);
  assert.match(workflowQueries, /fetchWorkflowTemplates/);
  assert.match(workflowQueries, /workflow_version_stages/);
  assert.match(workflowPanel, /workflow-template-select/);
  assert.match(workflowPanel, /setSelectedTemplateId/);
  assert.match(versionedCompletionMigration, /workflow_version_stages/);
  assert.match(versionedCompletionMigration, /workflow_checklist_items/);
  assert.match(versionedCompletionMigration, /stage_runs/);
  assert.match(versionedCompletionMigration, /workflow_handoff/);
  assert.match(requestActorMigration, /auth\.uid\(\)/);
  assert.match(requestActorMigration, /has_project_access/);
  assert.match(requestActorMigration, /v_actor_name/);
  assert.match(requestActorMigration, /attachments must belong to the selected project/);
  assert.match(requestActorMigration, /idempotency key/);
  assert.match(attachmentMigration, /rpc_create_customer_request_with_document/);
  assert.match(attachmentMigration, /insert into public\.documents/);
  assert.match(attachmentMigration, /insert into public\.document_versions/);
  assert.match(attachmentMigration, /public\.rpc_create_customer_request/);
  assert.match(attachmentMigration, /idempotency key for the whole combined operation/);
  assert.match(attachmentMigration, /exists \(select 1 from public\.customer_requests where id = p_request ->> 'id'\)/);
  assert.match(mutations, /mutateCreateCustomerRequestWithDocument/);
  assert.match(mutations, /uploadDocumentFile/);
  assert.doesNotMatch(mutations, /legacy non-atomic side-effect path/);
  assert.match(repository, /attachmentFile/);
  assert.match(workflowAdminScopeMigration, /is_organization_admin/);
  assert.match(workflowAdminScopeMigration, /require_workflow_admin\(v_organization_id\)/);
  assert.match(workflowAdminScopeMigration, /workflow_version_stages_select_admin/);
  assert.match(workflowAdminScopeMigration, /organization_admin/);
  assert.match(roleMigration, /rpc_set_organization_member_role/);
  assert.match(roleMigration, /only a system administrator can assign system_admin/);
  assert.match(dependencyMigration, /enforce_mandatory_task_dependencies/);
  assert.match(dependencyMigration, /statutory_mandatory/);
  assert.match(dependencyMigration, /mandatory task dependency remains incomplete/);
  assert.match(mutations, /mutateSetOrganizationMemberRole/);
  assert.match(repository, /setOrganizationMemberRolePersisted/);
  assert.match(page, /teamUsersFromMemberships/);
  assert.match(page, /membershipRoleForRoleId/);
  assert.match(mutations, /mutateRegisterOrganization/);
  assert.match(mutations, /mutateCreatePermitType/);
  assert.match(rlsScript, /disposable RLS isolation probe/);
  assert.match(rlsScript, /unauthorizedStorageUploadRejected/);
  assert.match(rlsScript, /assert\.deepEqual\(authenticatedProject\.data, \[\]/);
  assert.doesNotMatch(repository, /void\s+(?:mutate|insertNotification)/);
  assert.doesNotMatch(page, /repository\.dispatchNotification\(\{ userId: "user-sarah-johnson"/);
  assert.match(identifierModule, /canonicalProjectReference/);
  assert.match(mutations, /canonicalProjectReference\(params\.projectId\)/);
  assert.match(projectRoute, /createRequestSupabaseClient/);
  assert.match(workstreamRoute, /\.eq\("project_id", project\.id\)/);
  assert.match(requestRoute, /createRequestSupabaseClient/);
  assert.match(requestApi, /\.eq\("id", requested\)/);
  assert.match(requestApi, /\.eq\("number", requested\)/);
});
