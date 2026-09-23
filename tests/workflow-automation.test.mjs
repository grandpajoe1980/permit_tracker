import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, ws: false },
});
after(async () => vite.close());

const stages = [
  { id: "s1", workflowVersionId: "v1", stageKey: "intake", name: "Intake", customerVisibilityLabel: "Received", sequenceOrder: 1, responsibleOrgId: "org", responsibleOrgCode: "ORG", targetDurationDays: 1, minimumStatutoryDays: 0, requiredInputs: [], completionRequirements: [], permittedTransitions: ["review", "special_review"], canRunInParallel: false, isMilestoneGate: false },
  { id: "s2", workflowVersionId: "v1", stageKey: "review", name: "Review", customerVisibilityLabel: "Review", sequenceOrder: 2, responsibleOrgId: "org", responsibleOrgCode: "ORG", targetDurationDays: 1, minimumStatutoryDays: 0, requiredInputs: [], completionRequirements: [], permittedTransitions: [], canRunInParallel: false, isMilestoneGate: false },
  { id: "s3", workflowVersionId: "v1", stageKey: "special_review", name: "Special review", customerVisibilityLabel: "Special review", sequenceOrder: 3, responsibleOrgId: "org", responsibleOrgCode: "ORG", targetDurationDays: 1, minimumStatutoryDays: 0, requiredInputs: [], completionRequirements: [], permittedTransitions: [], canRunInParallel: false, isMilestoneGate: false },
];

test("routing uses AND conditions, project context, deterministic priority, and first match", async () => {
  const { evaluateRoutingRules } = await vite.ssrLoadModule("/lib/workflow-rules.ts");
  const rules = [
    { id: "second", name: "Fallback", priority: 20, conditions: [{ source: "project", key: "projectType", operator: "equals", value: "industrial" }], destination: { workflowVersionId: "target", leadOrgCode: "ORG" } },
    { id: "first", name: "Hazardous intake", priority: 10, conditions: [
      { key: "hazardous", operator: "yes_no", value: true },
      { source: "project", key: "projectType", operator: "equals", value: "industrial" },
    ], destination: { workflowVersionId: "target", leadOrgCode: "ORG" } },
  ];

  assert.equal(evaluateRoutingRules(rules, { hazardous: true }, { projectType: "industrial" }).id, "first");
  assert.equal(evaluateRoutingRules(rules, { hazardous: false }, { projectType: "industrial" }).id, "second");
  assert.equal(evaluateRoutingRules(rules, { hazardous: true }, { projectType: "residential" }), null);
});

test("routing validation rejects review outcomes that are only available after intake", async () => {
  const { validateWorkflowAutomationConfig } = await vite.ssrLoadModule("/lib/workflow-rules.ts");
  const result = validateWorkflowAutomationConfig({
    stages,
    routingRules: [{ id: "review-based-route", name: "Review based", priority: 1, conditions: [
      { source: "review_outcome", key: "review_outcome", operator: "equals", value: "approved" },
    ], destination: { workflowVersionId: "target", leadOrgCode: "ORG" } }],
  });
  assert.ok(result.errors.some((error) => /cannot depend on a review outcome/.test(error)));
});

test("publish validation rejects malformed date values in equals and one_of conditions", async () => {
  const { validateWorkflowAutomationConfig } = await vite.ssrLoadModule("/lib/workflow-rules.ts");
  const dateQuestion = { key: "opened_on", label: "Opened on", type: "date", required: false };
  const base = {
    stages,
    intakeQuestions: [dateQuestion],
    routingRules: [],
    stageBranches: [],
  };
  const invalidEquals = validateWorkflowAutomationConfig({
    ...base,
    routingRules: [{ id: "bad-date-equals", name: "Bad date equals", priority: 1, conditions: [
      { key: "opened_on", operator: "equals", value: "2026-02-30" },
    ], destination: { workflowVersionId: "v2", leadOrgCode: "ORG" } }],
  });
  const invalidOneOf = validateWorkflowAutomationConfig({
    ...base,
    routingRules: [{ id: "bad-date-one-of", name: "Bad date list", priority: 1, conditions: [
      { key: "opened_on", operator: "one_of", values: ["2026-02-28", "2026-02-30"] },
    ], destination: { workflowVersionId: "v2", leadOrgCode: "ORG" } }],
  });

  assert.ok(invalidEquals.errors.some((error) => /2026-02-30.*not a valid date/.test(error)));
  assert.ok(invalidOneOf.errors.some((error) => /2026-02-30.*not a valid date/.test(error)));
});

test("automation validation rejects tied, unreachable, contradictory, and cyclic rules", async () => {
  const { validateWorkflowAutomationConfig } = await vite.ssrLoadModule("/lib/workflow-rules.ts");
  const base = {
    stages,
    intakeQuestions: [{ key: "hazardous", label: "Hazardous material?", type: "yes_no", required: true }],
    routingRules: [
      { id: "all", name: "All requests", priority: 1, conditions: [], destination: { workflowVersionId: "v2", leadOrgCode: "ORG" } },
      { id: "later", name: "Hazardous", priority: 1, conditions: [{ key: "hazardous", operator: "yes_no", value: true }], destination: { workflowVersionId: "v2", leadOrgCode: "ORG" } },
    ],
    stageBranches: [
      { id: "cycle-a", fromStageKey: "intake", toStageKey: "special_review", conditions: [] },
      { id: "cycle-b", fromStageKey: "special_review", toStageKey: "intake", conditions: [] },
    ],
  };
  const result = validateWorkflowAutomationConfig(base);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /priority already used/.test(error)));
  assert.ok(result.errors.some((error) => /unreachable because earlier rule/.test(error)));
  assert.ok(result.errors.some((error) => /cycle involving/.test(error)));
});

test("required conditional intake questions apply only while visible", async () => {
  const { validateWorkflowIntakeAnswers, getVisibleWorkflowIntakeQuestions } = await vite.ssrLoadModule("/lib/workflow-intake.ts");
  const questions = [
    { key: "has_site_plan", label: "Do you have a site plan?", type: "yes_no", required: true },
    { key: "site_plan_date", label: "Site plan date", type: "date", required: true, visibleWhen: [{ key: "has_site_plan", operator: "yes_no", value: true }] },
  ];

  assert.deepEqual(validateWorkflowIntakeAnswers(questions, { has_site_plan: false }), []);
  assert.deepEqual(getVisibleWorkflowIntakeQuestions(questions, { has_site_plan: false }).map((question) => question.key), ["has_site_plan"]);
  assert.deepEqual(validateWorkflowIntakeAnswers(questions, { has_site_plan: true }), ["Site plan date is required."]);
});

test("intake validation enforces answer types, configured choices, and real calendar dates", async () => {
  const { validateWorkflowIntakeAnswers } = await vite.ssrLoadModule("/lib/workflow-intake.ts");
  const questions = [
    { key: "description", label: "Description", type: "text", required: false },
    { key: "permit_type", label: "Permit type", type: "single_choice", required: true, options: ["Building", "Electrical"] },
    { key: "received_on", label: "Received date", type: "date", required: true },
  ];

  assert.deepEqual(validateWorkflowIntakeAnswers(questions, {
    description: true,
    permit_type: "Plumbing",
    received_on: "2026-02-30",
  }), [
    "Description must be answered with text.",
    "Choose one of the listed options for Permit type.",
    "Received date must be a valid date in YYYY-MM-DD format.",
  ]);
  assert.deepEqual(validateWorkflowIntakeAnswers(questions, { permit_type: "", received_on: "" }), [
    "Permit type is required.",
    "Received date is required.",
  ]);
});

test("published branching evaluates first match using pinned answers and review outcome", async () => {
  const { evaluateWorkflowStageBranch } = await vite.ssrLoadModule("/lib/workflow-rules.ts");
  const branches = [
    { id: "approved", fromStageKey: "intake", toStageKey: "review", priority: 2, conditions: [{ source: "review_outcome", key: "review_outcome", operator: "equals", value: "approved" }] },
    { id: "hazard", fromStageKey: "intake", toStageKey: "special_review", priority: 1, conditions: [{ key: "hazardous", operator: "yes_no", value: true }] },
  ];

  assert.equal(evaluateWorkflowStageBranch({ branches, stageKey: "intake", answers: { hazardous: true }, reviewOutcome: "approved" }).id, "hazard");
  assert.equal(evaluateWorkflowStageBranch({ branches, stageKey: "intake", answers: {}, reviewOutcome: "approved" }).id, "approved");
  assert.equal(evaluateWorkflowStageBranch({ branches, stageKey: "intake", answers: {}, reviewOutcome: null }), null);
});

test("submission RPCs persist selected version and answers, return manual reasons, and route atomically", async () => {
  const migrationFiles = (await import("node:fs/promises")).readdir(new URL("../supabase/migrations/", import.meta.url));
  const names = await migrationFiles;
  const migrationName = names.find((name) => name.endsWith("_path_workflow_automation_rules.sql"));
  assert.ok(migrationName, "workflow automation migration exists");
  const migration = await readFile(new URL(`../supabase/migrations/${migrationName}`, import.meta.url), "utf8");

  assert.match(migration, /drop function public\.rpc_create_customer_request\(/);
  assert.match(migration, /p_intake_workflow_version_id text default null/);
  assert.match(migration, /p_intake_answers jsonb default '\{\}'::jsonb/);
  assert.match(migration, /perform app_private\.assert_intake_answers\(v_version_id, coalesce\(p_intake_answers/);
  assert.match(migration, /intake_workflow_version_id, intake_answers, auto_route_receipt/);
  assert.match(migration, /app_private\.resolve_intake_workflow_version\(/);
  assert.match(migration, /workflow_owner_matches_project\(definition\.organization_id, p_project_id\)/);
  assert.match(migration, /reason', 'no_matching_rule'/);
  assert.match(migration, /auto_routed_rule_id = v_rule->>'id'/);
  assert.match(migration, /workflow_condition_is_valid\(condition, v_version\.intake_questions, false\)/);
  const validatorStart = migration.indexOf("create or replace function app_private.validate_workflow_automation(");
  const validatorEnd = migration.indexOf("\n$$;", validatorStart);
  const validator = migration.slice(validatorStart, validatorEnd);
  assert.equal((validator.match(/as candidate\(value\) where jsonb_typeof\(candidate\.value\) <> 'string'/g) ?? []).length, 3);
  assert.doesNotMatch(validator, /jsonb_array_elements\([^;]*\bend value where/);
  assert.match(migration, /not app_private\.workflow_date_is_valid\(p_condition->>'value'\)/);
  assert.match(migration, /not app_private\.workflow_date_is_valid\(candidate\.value #>> '\{\}'\)/);
  assert.match(migration, /workflow_date_is_valid\(rule->'destination'->>'targetDate'\)/);
  assert.match(migration, /insert into public\.workstreams \(/);
  assert.match(migration, /customer_request_auto_routed/);
  assert.match(migration, /rpc_create_customer_request\([\s\S]*p_intake_workflow_version_id => p_request->>'intakeWorkflowVersionId'/);
  assert.match(migration, /v_existing\.intake_answers is distinct from coalesce\(p_intake_answers/);
});

test("stage transitions use the workstream's pinned version and record configured notice audiences", async () => {
  const migrationNames = await (await import("node:fs/promises")).readdir(new URL("../supabase/migrations/", import.meta.url));
  const name = migrationNames.find((entry) => entry.endsWith("_path_workflow_automation_rules.sql"));
  const migration = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  assert.match(migration, /where id = v_workstream\.workflow_version_id/);
  assert.match(migration, /branch\.value->'conditions', v_intake_answers, p_review_outcome, v_project_context/);
  assert.match(migration, /order by app_private\.workflow_rule_priority\(branch\.value->>'priority'\), branch\.ordinality/);
  assert.match(migration, /completed_by, completion_notes, review_outcome/);
  assert.match(migration, /coalesce\(template\.value->>'audience', 'both'\) in \('customer', 'both'\)/);
  assert.match(migration, /coalesce\(template\.value->>'audience', 'both'\) in \('team', 'both'\)/);
  const completionStart = migration.indexOf("create function app_private.complete_workstream_stage(");
  const completion = migration.slice(completionStart);
  assert.match(completion, /membership\.assignment_group_id = v_notice_assignment_group_id/);
  assert.match(completion, /select distinct membership\.user_id[\s\S]+from public\.assignment_group_memberships membership[\s\S]+where membership\.assignment_group_id = v_notice_assignment_group_id/);
  assert.match(completion, /where not v_notice_configured\s+and v_has_next_stage/);
  assert.match(completion, /join public\.organizations organization[\s\S]+membership\.role in \('supervisor', 'organization_admin', 'system_admin'\)/);
  assert.match(migration, /returns jsonb language sql security definer set search_path = '' as \$\$/);
});

test("workflow hydration scopes RLS-protected reads to the selected project", async () => {
  const queries = await readFile(new URL("../lib/supabase/queries.ts", import.meta.url), "utf8");
  assert.match(queries, /fetchWorkflowTemplates\(projectReference\?: string\)/);
  assert.match(queries, /in\("organization_id", organizationIds\)/);
  assert.match(queries, /in\("workflow_id", workflowIds\)/);
  assert.match(queries, /in\("workflow_version_id", versionIds\)/);
});

test("routing resolves a retired selected destination through its active definition version", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260923203228_route_destination_current_version.sql", import.meta.url), "utf8");
  const baseMigration = await readFile(new URL("../supabase/migrations/20260923195537_path_workflow_automation_rules.sql", import.meta.url), "utf8");
  assert.match(migration, /where selected\.id = v_destination->>'workflowVersionId'/);
  assert.match(migration, /where workflow_id = v_target_definition\.id\s+and lifecycle_status = 'published' and is_active\s+order by version_number desc\s+limit 1/);
  assert.match(migration, /automatic route target workflow definition is unavailable/);
  assert.match(migration, /automatic route target workflow definition has no active published version/);
  assert.match(migration, /'destinationWorkflowVersionId', v_target_version\.id/);
  assert.match(baseMigration, /v_target_version\.id, v_stage\.id/);
  assert.match(baseMigration, /'workflowVersionId', v_target_version\.id\)::text/);
});
