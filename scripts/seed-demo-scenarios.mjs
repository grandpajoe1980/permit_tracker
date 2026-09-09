import crypto from "node:crypto";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Rebuild the tagged, non-destructive demo scenarios used by the current PATH
 * development plan.
 *
 * Run after the baseline persona/workflow seed:
 *   npm run supabase:seed:spacex
 *   npm run supabase:seed:scenarios
 *
 * This script intentionally only upserts stable PATH-DEMO-* records. It never
 * deletes data and it never creates auth users or synthetic Storage metadata.
 * If the document seed has produced a real non-empty version, the response
 * scenarios reference that immutable version; otherwise they remain explicitly
 * attachment-ready with an empty attachment list.
 */

const SEED_TAG = "PATH-DEMO-SEED-2026-09-07";
const PROJECT_NUMBER = "PRJ-PECAN-2026";
const FIXED_NOW = "2026-09-07T12:00:00.000Z";

const STAGE_IDS = {
  intake: "workflow-version-spaceport-request-v1-intake",
  technicalReview: "workflow-version-spaceport-request-v1-technical_review",
  agencyCoordination: "workflow-version-spaceport-request-v1-agency_coordination",
  constructionRelease: "workflow-version-spaceport-request-v1-construction_release",
  monitoring: "workflow-version-spaceport-request-v1-monitoring",
};

const GROUP_SPECS = {
  spaceport: ["SPACEPORT", "SpaceX Regulatory Affairs"],
  ldeq: ["LDEQ", "LDEQ Air and Water Review"],
  dotd: ["DOTD", "DOTD Transportation Review"],
  cpra: ["CPRA", "CPRA Coastal Review"],
  path: ["LA-PROJECTS", "Louisiana Project Delivery Office"],
};

const PERSONA_EMAILS = {
  alex: "alex.martin@demo.permit.local",
  maya: "maya.chen@demo.permit.local",
  jordan: "jordan.lee@demo.permit.local",
  sam: "sam.rivera@demo.permit.local",
  sarah: "sarah.johnson@demo.permit.local",
  joe: "joe.skaggs@demo.permit.local",
};

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

function stableUuid(key) {
  const bytes = crypto.createHash("sha256").update(`${SEED_TAG}:${key}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function requireValue(value, message) {
  if (value === undefined || value === null || value === "") throw new Error(message);
  return value;
}

async function unwrap(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

async function upsert(client, table, rows, operation, onConflict = "id") {
  if (!rows.length) return;
  await unwrap(
    await client.from(table).upsert(rows, { onConflict, ignoreDuplicates: false }),
    operation,
  );
}

async function main() {
  const env = { ...readEnvFile(), ...process.env };
  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? env.legacy_service_role_key;
  if (!url || !serviceKey) throw new Error("Supabase service credentials are unavailable.");

  const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const project = await unwrap(
    await client.from("projects").select("id, number, name").eq("number", PROJECT_NUMBER).single(),
    `find project ${PROJECT_NUMBER}`,
  );

  const organizationCodes = ["SPACEPORT", "LDEQ", "DOTD", "CPRA", "LA-PROJECTS", "STATEPO"];
  const organizations = await unwrap(
    await client.from("organizations").select("id, code, name").in("code", organizationCodes),
    "find demo organizations",
  );
  const organizationByCode = Object.fromEntries(organizations.map((organization) => [organization.code, organization]));
  for (const code of organizationCodes) requireValue(organizationByCode[code], `Missing baseline organization ${code}`);

  const authUsers = await unwrap(
    await client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    "list demo auth users",
  );
  const userByEmail = Object.fromEntries((authUsers?.users ?? []).map((user) => [user.email, user]));
  const user = (persona) => requireValue(userByEmail[PERSONA_EMAILS[persona]], `Missing baseline persona ${PERSONA_EMAILS[persona]}`);

  const groupRows = await unwrap(
    await client.from("assignment_groups").select("id, org_code, name, active").eq("active", true).in("org_code", Object.values(GROUP_SPECS).map(([code]) => code)),
    "find baseline assignment groups",
  );
  const group = (persona) => {
    const [orgCode, name] = GROUP_SPECS[persona];
    const match = groupRows.find((row) => row.org_code === orgCode && row.name === name);
    return requireValue(match, `Missing baseline assignment group ${orgCode}/${name}`);
  };

  const permitResult = await client.from("permit_types").select("id").eq("code", "LDEQ-AIR-TITLEV").limit(1);
  if (permitResult.error) throw new Error(`find optional Title V permit type: ${permitResult.error.message}`);
  const titleVPermitId = permitResult.data?.[0]?.id ?? null;

  const attachmentResult = await client
    .from("document_versions")
    .select("id, file_name, storage_path, file_size_bytes, sha256_hash")
    .eq("file_name", "launch-flight-safety-hazard-demo-v1.pdf")
    .gt("file_size_bytes", 0)
    .not("sha256_hash", "is", null)
    .limit(1);
  if (attachmentResult.error) throw new Error(`find optional demo document version: ${attachmentResult.error.message}`);
  const attachmentVersionId = attachmentResult.data?.[0]?.id ? String(attachmentResult.data[0].id) : null;
  const attachmentIds = attachmentVersionId ? [attachmentVersionId] : [];

  const projectId = String(project.id);
  const orgId = (code) => String(organizationByCode[code].id);
  const groupId = (key) => String(group(key).id);
  const actorName = (persona) => user(persona).user_metadata?.full_name ?? {
    alex: "Alex Martin",
    maya: "Maya Chen",
    jordan: "Jordan Lee",
    sam: "Sam Rivera",
    sarah: "Sarah Johnson",
    joe: "Joe Skaggs",
  }[persona];

  // The current authenticated Sarah Johnson demo persona belongs to STATEPO.
  // Keep that organization-level project access idempotent and scoped to the
  // tagged demo project so the intake queue is testable through real RLS.
  const existingStatepoParticipant = await unwrap(
    await client
      .from("project_participants")
      .select("id")
      .eq("project_id", project.id)
      .eq("organization_id", orgId("STATEPO"))
      .limit(1)
      .maybeSingle(),
    "find STATEPO project access",
  );
  if (!existingStatepoParticipant) {
    await unwrap(
      await client.from("project_participants").insert({
        project_id: project.id,
        organization_id: orgId("STATEPO"),
        participation_role: "coordinating",
        access_scope: "project",
        organization_name: organizationByCode.STATEPO.name,
        project_role: "State Project Office",
        visibility_scope: "project",
        is_active: true,
      }),
      "ensure STATEPO project access",
    );
  }

  const workstreams = [
    {
      id: "PATH-DEMO-WS-AIR",
      project_id: project.id,
      code: "PATH-DEMO-WS-AIR",
      title: "Demo — Air permit response and technical review",
      category: "air",
      permit_type_id: titleVPermitId,
      current_stage_name: "Technical team review",
      operational_state: "waiting_applicant",
      operational_state_label: "Waiting on applicant response",
      rag_status: "yellow",
      rag_label: "Action Needed",
      is_critical_path: true,
      baseline_target_date: "2026-09-15",
      forecast_target_date: "2026-10-01",
      schedule_variance_days: 16,
      remaining_float_days: 0,
      state_concierge: { name: actorName("sarah"), title: "State project coordinator", agency: "Louisiana Project Delivery Office", email: PERSONA_EMAILS.sarah },
      regulatory_lead: { orgCode: "LDEQ", orgName: organizationByCode.LDEQ.name, jurisdictionLevel: "State", assignedReviewerName: actorName("jordan"), assignedReviewerEmail: PERSONA_EMAILS.jordan },
      six_questions: { currentActionSummary: "Review the applicant's revised emissions inventory.", nextExpectedEvent: "Applicant response to PATH-DEMO-RFI-WAITING", customerActionRequired: "Upload the control-technology memo.", primaryDelayReason: "customer_response" },
      waiting_reason: "A response is required before technical review can resume.",
      waiting_on_entity: "SPACEPORT",
      current_action_summary: "Review the applicant's revised emissions inventory.",
      escalation_level: 0,
      escalation_triggered_at: null,
      escalation_summary: "",
      stage_history: [
        { stageKey: "intake", label: "Request intake", status: "complete", completedAt: "2026-08-25" },
        { stageKey: "technical_review", label: "Technical team review", status: "active", startedAt: "2026-08-26" },
      ],
      active_blockers: [{ id: "PATH-DEMO-BLOCKER-AIR", title: "Applicant response to RFI", severity: "medium", source: "PATH-DEMO-RFI-WAITING" }],
      created_at: "2026-08-25T12:00:00.000Z",
      updated_at: FIXED_NOW,
      workflow_version_id: "workflow-version-spaceport-request-v1",
      current_stage_id: STAGE_IDS.technicalReview,
      current_stage_started_at: "2026-08-26T12:00:00.000Z",
      assigned_owner_user_id: user("jordan").id,
      assigned_owner_org_code: "LDEQ",
      assignment_group_id: groupId("ldeq"),
      assigned_to_user_id: user("jordan").id,
      assigned_org_code: "LDEQ",
      itsm_state: "pending_customer",
      priority: "P1",
      statutory_deadline: "2026-10-15T00:00:00.000Z",
      clock_status: "paused",
      clock_paused_reason: "Waiting for applicant response",
      clock_paused_at: "2026-09-02T12:00:00.000Z",
      clock_total_paused_seconds: 432000,
      customer_request_id: "PATH-DEMO-REQ-RFI",
    },
    {
      id: "PATH-DEMO-WS-COAST",
      project_id: project.id,
      code: "PATH-DEMO-WS-COAST",
      title: "Demo — Coastal concurrence and dependency clearance",
      category: "coastal",
      permit_type_id: null,
      current_stage_name: "Agency coordination",
      operational_state: "blocked",
      operational_state_label: "Response recorded — dependency still blocked",
      rag_status: "red",
      rag_label: "Blocked / Escalated",
      is_critical_path: true,
      baseline_target_date: "2026-09-20",
      forecast_target_date: "2026-10-10",
      schedule_variance_days: 20,
      remaining_float_days: 0,
      state_concierge: { name: actorName("sarah"), title: "State project coordinator", agency: "Louisiana Project Delivery Office", email: PERSONA_EMAILS.sarah },
      regulatory_lead: { orgCode: "CPRA", orgName: organizationByCode.CPRA.name, jurisdictionLevel: "State", assignedReviewerName: actorName("sarah"), assignedReviewerEmail: PERSONA_EMAILS.sarah },
      six_questions: { currentActionSummary: "Review the CPRA response and decide whether the dependency can be cleared.", nextExpectedEvent: "Coordinator dependency-clearance decision", customerActionRequired: "No customer action required right now.", primaryDelayReason: "agency_dependency" },
      waiting_reason: "CPRA responded, but the originating team has not cleared the dependency.",
      waiting_on_entity: "CPRA",
      current_action_summary: "Review the CPRA response and decide whether the dependency can be cleared.",
      escalation_level: 1,
      escalation_triggered_at: "2026-09-05T12:00:00.000Z",
      escalation_summary: "Response received; dependency remains visibly unresolved.",
      stage_history: [
        { stageKey: "intake", label: "Request intake", status: "complete", completedAt: "2026-08-22" },
        { stageKey: "technical_review", label: "Technical team review", status: "complete", completedAt: "2026-08-30" },
        { stageKey: "agency_coordination", label: "Agency coordination", status: "active", startedAt: "2026-09-01" },
      ],
      active_blockers: [{ id: "PATH-DEMO-BLOCKER-COAST", title: "Dependency clearance decision", severity: "high", source: "PATH-DEMO-COORD-RESPONDED" }],
      created_at: "2026-08-22T12:00:00.000Z",
      updated_at: FIXED_NOW,
      workflow_version_id: "workflow-version-spaceport-request-v1",
      current_stage_id: STAGE_IDS.agencyCoordination,
      current_stage_started_at: "2026-09-01T12:00:00.000Z",
      assigned_owner_user_id: user("sarah").id,
      assigned_owner_org_code: "LA-PROJECTS",
      assignment_group_id: groupId("path"),
      assigned_to_user_id: user("sarah").id,
      assigned_org_code: "LA-PROJECTS",
      itsm_state: "blocked",
      priority: "P1",
      statutory_deadline: "2026-10-20T00:00:00.000Z",
      clock_status: "paused",
      clock_paused_reason: "Agency response received; dependency clearance pending",
      clock_paused_at: "2026-09-05T12:00:00.000Z",
      clock_total_paused_seconds: 172800,
      customer_request_id: "PATH-DEMO-REQ-COORD",
    },
    {
      id: "PATH-DEMO-WS-UTILITY",
      project_id: project.id,
      code: "PATH-DEMO-WS-UTILITY",
      title: "Demo — Utility interconnection parallel review",
      category: "infrastructure",
      permit_type_id: null,
      current_stage_name: "Technical team review",
      operational_state: "running",
      operational_state_label: "Running — parallel technical reviews",
      rag_status: "green",
      rag_label: "On Track",
      is_critical_path: false,
      baseline_target_date: "2026-10-05",
      forecast_target_date: "2026-10-05",
      schedule_variance_days: 0,
      remaining_float_days: 12,
      state_concierge: { name: actorName("sarah"), title: "State project coordinator", agency: "Louisiana Project Delivery Office", email: PERSONA_EMAILS.sarah },
      regulatory_lead: { orgCode: "DOTD", orgName: organizationByCode.DOTD.name, jurisdictionLevel: "State", assignedReviewerName: actorName("sam"), assignedReviewerEmail: PERSONA_EMAILS.sam },
      six_questions: { currentActionSummary: "Run the utility and transportation technical reviews in parallel.", nextExpectedEvent: "Technical review checkpoint", customerActionRequired: "No action currently required.", primaryDelayReason: "none" },
      waiting_reason: null,
      waiting_on_entity: null,
      current_action_summary: "Run the utility and transportation technical reviews in parallel.",
      escalation_level: 0,
      escalation_triggered_at: null,
      escalation_summary: "",
      stage_history: [
        { stageKey: "intake", label: "Request intake", status: "complete", completedAt: "2026-08-28" },
        { stageKey: "technical_review", label: "Technical team review", status: "active", startedAt: "2026-09-02", parallel: true },
        { stageKey: "agency_coordination", label: "Agency coordination", status: "active", startedAt: "2026-09-03", parallel: true },
      ],
      active_blockers: [],
      created_at: "2026-08-28T12:00:00.000Z",
      updated_at: FIXED_NOW,
      workflow_version_id: "workflow-version-spaceport-request-v1",
      current_stage_id: STAGE_IDS.technicalReview,
      current_stage_started_at: "2026-09-02T12:00:00.000Z",
      assigned_owner_user_id: user("sam").id,
      assigned_owner_org_code: "DOTD",
      assignment_group_id: groupId("dotd"),
      assigned_to_user_id: user("sam").id,
      assigned_org_code: "DOTD",
      itsm_state: "in_progress",
      priority: "P2",
      statutory_deadline: null,
      clock_status: "active",
      clock_paused_reason: null,
      clock_paused_at: null,
      clock_total_paused_seconds: 0,
      customer_request_id: "PATH-DEMO-REQ-ACTIVE",
    },
    {
      id: "PATH-DEMO-WS-COMPLETE",
      project_id: project.id,
      code: "PATH-DEMO-WS-COMPLETE",
      title: "Demo — Completed drainage authorization",
      category: "water",
      permit_type_id: null,
      current_stage_name: "Monitoring and closeout",
      operational_state: "complete",
      operational_state_label: "Complete",
      rag_status: "green",
      rag_label: "On Track",
      is_critical_path: false,
      baseline_target_date: "2026-08-25",
      forecast_target_date: "2026-08-25",
      schedule_variance_days: 0,
      remaining_float_days: 0,
      state_concierge: { name: actorName("sarah"), title: "State project coordinator", agency: "Louisiana Project Delivery Office", email: PERSONA_EMAILS.sarah },
      regulatory_lead: { orgCode: "LDEQ", orgName: organizationByCode.LDEQ.name, jurisdictionLevel: "State", assignedReviewerName: actorName("jordan"), assignedReviewerEmail: PERSONA_EMAILS.jordan },
      six_questions: { currentActionSummary: "Monitor closeout record and preserve the completion history.", nextExpectedEvent: "Closeout archive review", customerActionRequired: "No action currently required.", primaryDelayReason: "none" },
      waiting_reason: null,
      waiting_on_entity: null,
      current_action_summary: "Monitor closeout record and preserve the completion history.",
      escalation_level: 0,
      escalation_triggered_at: null,
      escalation_summary: "",
      stage_history: [
        { stageKey: "intake", label: "Request intake", status: "complete", completedAt: "2026-08-10" },
        { stageKey: "technical_review", label: "Technical team review", status: "complete", completedAt: "2026-08-15" },
        { stageKey: "agency_coordination", label: "Agency coordination", status: "complete", completedAt: "2026-08-20" },
        { stageKey: "construction_release", label: "Construction release", status: "complete", completedAt: "2026-08-23" },
        { stageKey: "monitoring", label: "Monitoring and closeout", status: "complete", completedAt: "2026-08-25" },
      ],
      active_blockers: [],
      created_at: "2026-08-10T12:00:00.000Z",
      updated_at: FIXED_NOW,
      actual_completion_date: "2026-08-25",
      workflow_version_id: "workflow-version-spaceport-request-v1",
      current_stage_id: STAGE_IDS.monitoring,
      current_stage_started_at: "2026-08-23T12:00:00.000Z",
      assigned_owner_user_id: user("jordan").id,
      assigned_owner_org_code: "LDEQ",
      assignment_group_id: groupId("ldeq"),
      assigned_to_user_id: user("jordan").id,
      assigned_org_code: "LDEQ",
      itsm_state: "resolved",
      priority: "P3",
      statutory_deadline: null,
      clock_status: "stopped",
      clock_paused_reason: null,
      clock_paused_at: null,
      clock_total_paused_seconds: 0,
      customer_request_id: "PATH-DEMO-REQ-COMPLETE",
    },
  ];
  await upsert(client, "workstreams", workstreams, "upsert tagged demo workstreams");

  const tasks = [
    { id: "PATH-DEMO-T-AIR-001", workstream_id: "PATH-DEMO-WS-AIR", task_code: "PATH-DEMO-T-AIR-001", title: "Confirm emissions inventory assumptions", duration_days: 5, float_days: 0, early_start: "2026-08-26", early_finish: "2026-08-30", late_start: "2026-08-26", late_finish: "2026-08-30", is_critical_path: true, status: "completed", predecessors: [], created_at: "2026-08-26T12:00:00.000Z", assignment_group_id: groupId("spaceport"), assigned_to_user_id: user("alex").id, assigned_org_code: "SPACEPORT", itsm_state: "resolved", priority: "P1", statutory_deadline: null, clock_status: "stopped", clock_paused_reason: null, clock_paused_at: null, clock_total_paused_seconds: 0, stage_id: STAGE_IDS.technicalReview, is_stage_action: true, description: "Applicant baseline package is complete.", assigned_user_name: actorName("alex"), actual_completion_date: "2026-08-30" },
    { id: "PATH-DEMO-T-AIR-002", workstream_id: "PATH-DEMO-WS-AIR", task_code: "PATH-DEMO-T-AIR-002", title: "Resolve technical review questions", duration_days: 8, float_days: 0, early_start: "2026-08-31", early_finish: "2026-09-08", late_start: "2026-08-31", late_finish: "2026-09-08", is_critical_path: true, status: "pending_customer", predecessors: ["PATH-DEMO-T-AIR-001"], created_at: "2026-08-31T12:00:00.000Z", assignment_group_id: groupId("ldeq"), assigned_to_user_id: user("jordan").id, assigned_org_code: "LDEQ", itsm_state: "pending_customer", priority: "P1", statutory_deadline: "2026-10-15T00:00:00.000Z", clock_status: "paused", clock_paused_reason: "Waiting for applicant response", clock_paused_at: "2026-09-02T12:00:00.000Z", clock_total_paused_seconds: 432000, stage_id: STAGE_IDS.technicalReview, is_stage_action: true, description: "Reviewer is waiting on the applicant RFI response.", assigned_user_name: actorName("jordan"), actual_completion_date: null },
    { id: "PATH-DEMO-T-COAST-001", workstream_id: "PATH-DEMO-WS-COAST", task_code: "PATH-DEMO-T-COAST-001", title: "Review CPRA response and clear dependency", duration_days: 4, float_days: 0, early_start: "2026-09-05", early_finish: "2026-09-08", late_start: "2026-09-05", late_finish: "2026-09-08", is_critical_path: true, status: "blocked", predecessors: [], created_at: "2026-09-05T12:00:00.000Z", assignment_group_id: groupId("path"), assigned_to_user_id: user("sarah").id, assigned_org_code: "LA-PROJECTS", itsm_state: "blocked", priority: "P1", statutory_deadline: "2026-10-20T00:00:00.000Z", clock_status: "paused", clock_paused_reason: "Dependency clearance pending", clock_paused_at: "2026-09-05T12:00:00.000Z", clock_total_paused_seconds: 172800, stage_id: STAGE_IDS.agencyCoordination, is_stage_action: true, description: "A response exists, but the dependency is not yet cleared.", assigned_user_name: actorName("sarah"), actual_completion_date: null },
    { id: "PATH-DEMO-T-UTILITY-001", workstream_id: "PATH-DEMO-WS-UTILITY", task_code: "PATH-DEMO-T-UTILITY-001", title: "Review utility interconnection package", duration_days: 7, float_days: 6, early_start: "2026-09-02", early_finish: "2026-09-08", late_start: "2026-09-08", late_finish: "2026-09-14", is_critical_path: false, status: "in_progress", predecessors: [], created_at: "2026-09-02T12:00:00.000Z", assignment_group_id: groupId("dotd"), assigned_to_user_id: user("sam").id, assigned_org_code: "DOTD", itsm_state: "in_progress", priority: "P2", statutory_deadline: null, clock_status: "active", clock_paused_reason: null, clock_paused_at: null, clock_total_paused_seconds: 0, stage_id: STAGE_IDS.technicalReview, is_stage_action: true, description: "Technical review is active in parallel with agency coordination.", assigned_user_name: actorName("sam"), actual_completion_date: null },
    { id: "PATH-DEMO-T-UTILITY-002", workstream_id: "PATH-DEMO-WS-UTILITY", task_code: "PATH-DEMO-T-UTILITY-002", title: "Prepare transportation concurrency note", duration_days: 5, float_days: 8, early_start: "2026-09-03", early_finish: "2026-09-07", late_start: "2026-09-09", late_finish: "2026-09-15", is_critical_path: false, status: "submitted", predecessors: [], created_at: "2026-09-03T12:00:00.000Z", assignment_group_id: groupId("dotd"), assigned_to_user_id: user("sam").id, assigned_org_code: "DOTD", itsm_state: "submitted", priority: "P2", statutory_deadline: null, clock_status: "active", clock_paused_reason: null, clock_paused_at: null, clock_total_paused_seconds: 0, stage_id: STAGE_IDS.agencyCoordination, is_stage_action: true, description: "Parallel agency coordination input is ready for review.", assigned_user_name: actorName("sam"), actual_completion_date: null },
    { id: "PATH-DEMO-T-COMPLETE-001", workstream_id: "PATH-DEMO-WS-COMPLETE", task_code: "PATH-DEMO-T-COMPLETE-001", title: "Archive completed drainage authorization", duration_days: 2, float_days: 0, early_start: "2026-08-24", early_finish: "2026-08-25", late_start: "2026-08-24", late_finish: "2026-08-25", is_critical_path: false, status: "completed", predecessors: [], created_at: "2026-08-24T12:00:00.000Z", assignment_group_id: groupId("ldeq"), assigned_to_user_id: user("jordan").id, assigned_org_code: "LDEQ", itsm_state: "resolved", priority: "P3", statutory_deadline: null, clock_status: "stopped", clock_paused_reason: null, clock_total_paused_seconds: 0, stage_id: STAGE_IDS.monitoring, is_stage_action: true, description: "Completion history is retained for the project story.", assigned_user_name: actorName("jordan"), actual_completion_date: "2026-08-25" },
  ];
  await upsert(client, "tasks", tasks, "upsert tagged demo tasks");

  // Keep the workflow journey grounded in durable execution history.  These
  // rows intentionally cover the demo's past/now/parallel/complete stories;
  // future stages remain unstarted rather than receiving invented dates.
  const stageRuns = [
    { id: stableUuid("stage-run:air:intake"), workstream_id: "PATH-DEMO-WS-AIR", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.intake, stage_key: "intake", status: "completed", started_at: "2026-08-25T12:00:00.000Z", completed_at: "2026-08-25T12:00:00.000Z", completed_by: user("alex").id, completion_notes: "Intake packet accepted for technical review.", created_at: "2026-08-25T12:00:00.000Z" },
    { id: stableUuid("stage-run:air:technical-review"), workstream_id: "PATH-DEMO-WS-AIR", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.technicalReview, stage_key: "technical_review", status: "active", started_at: "2026-08-26T12:00:00.000Z", completed_at: null, completed_by: null, completion_notes: null, created_at: "2026-08-26T12:00:00.000Z" },
    { id: stableUuid("stage-run:coast:intake"), workstream_id: "PATH-DEMO-WS-COAST", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.intake, stage_key: "intake", status: "completed", started_at: "2026-08-22T12:00:00.000Z", completed_at: "2026-08-22T12:00:00.000Z", completed_by: user("alex").id, completion_notes: "Coastal request intake completed.", created_at: "2026-08-22T12:00:00.000Z" },
    { id: stableUuid("stage-run:coast:technical-review"), workstream_id: "PATH-DEMO-WS-COAST", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.technicalReview, stage_key: "technical_review", status: "completed", started_at: "2026-08-26T12:00:00.000Z", completed_at: "2026-08-30T12:00:00.000Z", completed_by: user("sam").id, completion_notes: "Technical review completed before agency coordination.", created_at: "2026-08-26T12:00:00.000Z" },
    { id: stableUuid("stage-run:coast:agency-coordination"), workstream_id: "PATH-DEMO-WS-COAST", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.agencyCoordination, stage_key: "agency_coordination", status: "active", started_at: "2026-09-01T12:00:00.000Z", completed_at: null, completed_by: null, completion_notes: null, created_at: "2026-09-01T12:00:00.000Z" },
    { id: stableUuid("stage-run:utility:intake"), workstream_id: "PATH-DEMO-WS-UTILITY", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.intake, stage_key: "intake", status: "completed", started_at: "2026-08-28T12:00:00.000Z", completed_at: "2026-08-28T12:00:00.000Z", completed_by: user("alex").id, completion_notes: "Utility review intake completed.", created_at: "2026-08-28T12:00:00.000Z" },
    { id: stableUuid("stage-run:utility:technical-review"), workstream_id: "PATH-DEMO-WS-UTILITY", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.technicalReview, stage_key: "technical_review", status: "active", started_at: "2026-09-02T12:00:00.000Z", completed_at: null, completed_by: null, completion_notes: null, created_at: "2026-09-02T12:00:00.000Z" },
    { id: stableUuid("stage-run:utility:agency-coordination"), workstream_id: "PATH-DEMO-WS-UTILITY", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.agencyCoordination, stage_key: "agency_coordination", status: "active", started_at: "2026-09-03T12:00:00.000Z", completed_at: null, completed_by: null, completion_notes: null, created_at: "2026-09-03T12:00:00.000Z" },
    { id: stableUuid("stage-run:complete:intake"), workstream_id: "PATH-DEMO-WS-COMPLETE", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.intake, stage_key: "intake", status: "completed", started_at: "2026-08-10T12:00:00.000Z", completed_at: "2026-08-10T12:00:00.000Z", completed_by: user("jordan").id, completion_notes: "Completed authorization intake retained.", created_at: "2026-08-10T12:00:00.000Z" },
    { id: stableUuid("stage-run:complete:technical-review"), workstream_id: "PATH-DEMO-WS-COMPLETE", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.technicalReview, stage_key: "technical_review", status: "completed", started_at: "2026-08-11T12:00:00.000Z", completed_at: "2026-08-15T12:00:00.000Z", completed_by: user("jordan").id, completion_notes: "Technical review completed.", created_at: "2026-08-11T12:00:00.000Z" },
    { id: stableUuid("stage-run:complete:agency-coordination"), workstream_id: "PATH-DEMO-WS-COMPLETE", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.agencyCoordination, stage_key: "agency_coordination", status: "completed", started_at: "2026-08-16T12:00:00.000Z", completed_at: "2026-08-20T12:00:00.000Z", completed_by: user("jordan").id, completion_notes: "Agency coordination completed.", created_at: "2026-08-16T12:00:00.000Z" },
    { id: stableUuid("stage-run:complete:construction-release"), workstream_id: "PATH-DEMO-WS-COMPLETE", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.constructionRelease, stage_key: "construction_release", status: "completed", started_at: "2026-08-21T12:00:00.000Z", completed_at: "2026-08-23T12:00:00.000Z", completed_by: user("jordan").id, completion_notes: "Construction release conditions recorded.", created_at: "2026-08-21T12:00:00.000Z" },
    { id: stableUuid("stage-run:complete:monitoring"), workstream_id: "PATH-DEMO-WS-COMPLETE", workflow_version_id: "workflow-version-spaceport-request-v1", stage_id: STAGE_IDS.monitoring, stage_key: "monitoring", status: "completed", started_at: "2026-08-24T12:00:00.000Z", completed_at: "2026-08-25T12:00:00.000Z", completed_by: user("jordan").id, completion_notes: "Monitoring and closeout archived.", created_at: "2026-08-24T12:00:00.000Z" },
  ];
  await upsert(client, "stage_runs", stageRuns, "upsert tagged demo stage runs");

  const dependencies = [
    { id: "PATH-DEMO-DEP-AIR-001-002", predecessor_task_id: "PATH-DEMO-T-AIR-001", successor_task_id: "PATH-DEMO-T-AIR-002", dependency_type: "finish_to_start", gate_type: "statutory_mandatory", lag_days: 0, is_controlling: true, created_at: FIXED_NOW },
    { id: "PATH-DEMO-DEP-COAST-RESPONSE", predecessor_task_id: "PATH-DEMO-T-COAST-001", successor_task_id: "PATH-DEMO-T-UTILITY-001", dependency_type: "finish_to_start", gate_type: "coordination_gate", lag_days: 0, is_controlling: false, created_at: FIXED_NOW },
  ];
  await upsert(client, "task_dependencies", dependencies, "upsert tagged demo task dependencies");

  const customerRequests = [
    { id: "PATH-DEMO-REQ-INTAKE", confirmation_number: "PATH-2026-DEMO-INTAKE", project_id: projectId, request_type: "permit_authorization", title: "Request a review path for a utility expansion", description: "Demo request awaiting deliberate coordinator routing. No workstream is linked until the route is confirmed.", requested_outcome: "Identify the correct agencies and next step.", location_or_affected_area: "Launch Complex utility corridor", desired_date: null, schedule_importance: "normal", known_agency_code: "LDEQ", known_permit_type_id: titleVPermitId, submitted_by_user_id: user("alex").id, submitted_by_name: actorName("alex"), related_workstream_id: null, blocks_active_work: false, status: "submitted", attachment_document_version_ids: [], created_at: "2026-09-06T12:00:00.000Z", updated_at: FIXED_NOW, assignment_group_id: null, assigned_to_user_id: null, itsm_state: "submitted", priority: "P3", statutory_deadline: null, clock_status: "active", clock_paused_reason: null, clock_paused_at: null, clock_total_paused_seconds: 0, triaged_at: null, triaged_by_user_id: null, triage_notes: null, triaged_workstream_ids: [] },
    { id: "PATH-DEMO-REQ-ACTIVE", confirmation_number: "PATH-2026-DEMO-ACTIVE", project_id: projectId, request_type: "government_help", title: "Coordinate a utility interconnection review", description: "Demo request linked to an active workstream with parallel technical steps.", requested_outcome: "Confirm the review owners and next handoff.", location_or_affected_area: "230kV service corridor", desired_date: "2026-10-05", schedule_importance: "important", known_agency_code: "DOTD", known_permit_type_id: null, submitted_by_user_id: user("alex").id, submitted_by_name: actorName("alex"), related_workstream_id: "PATH-DEMO-WS-UTILITY", blocks_active_work: true, status: "in_progress", attachment_document_version_ids: [], created_at: "2026-09-01T12:00:00.000Z", updated_at: FIXED_NOW, assignment_group_id: groupId("dotd"), assigned_to_user_id: user("sam").id, itsm_state: "triaged", priority: "P2", statutory_deadline: null, clock_status: "active", clock_paused_reason: null, clock_paused_at: null, clock_total_paused_seconds: 0, triaged_at: "2026-09-02T12:00:00.000Z", triaged_by_user_id: user("sarah").id, triage_notes: "Confirmed parallel DOTD review and utility workstream.", triaged_workstream_ids: ["PATH-DEMO-WS-UTILITY"] },
    { id: "PATH-DEMO-REQ-RFI", confirmation_number: "PATH-2026-DEMO-RFI", project_id: projectId, request_type: "project_question", title: "Respond to an air-permit information request", description: "Demo request waiting for an applicant response to an issued RFI.", requested_outcome: "Submit the requested control-technology memo.", location_or_affected_area: "Air permit package", desired_date: null, schedule_importance: "important", known_agency_code: "LDEQ", known_permit_type_id: titleVPermitId, submitted_by_user_id: user("alex").id, submitted_by_name: actorName("alex"), related_workstream_id: "PATH-DEMO-WS-AIR", blocks_active_work: true, status: "pending_customer", attachment_document_version_ids: [], created_at: "2026-09-02T12:00:00.000Z", updated_at: FIXED_NOW, assignment_group_id: groupId("spaceport"), assigned_to_user_id: user("maya").id, itsm_state: "pending_customer", priority: "P1", statutory_deadline: "2026-10-15T00:00:00.000Z", clock_status: "paused", clock_paused_reason: "Waiting for applicant response", clock_paused_at: "2026-09-02T12:00:00.000Z", clock_total_paused_seconds: 432000, triaged_at: "2026-09-02T12:00:00.000Z", triaged_by_user_id: user("sarah").id, triage_notes: "Routed to LDEQ and SpaceX response queue.", triaged_workstream_ids: ["PATH-DEMO-WS-AIR"] },
    { id: "PATH-DEMO-REQ-COORD", confirmation_number: "PATH-2026-DEMO-COORD", project_id: projectId, request_type: "blocker_coordination", title: "Resolve a coastal concurrence dependency", description: "Demo request whose agency response exists but whose dependency still needs an explicit clear action.", requested_outcome: "Review the response and record whether the dependency is resolved.", location_or_affected_area: "Coastal authorization area", desired_date: null, schedule_importance: "critical", known_agency_code: "CPRA", known_permit_type_id: null, submitted_by_user_id: user("alex").id, submitted_by_name: actorName("alex"), related_workstream_id: "PATH-DEMO-WS-COAST", blocks_active_work: true, status: "blocked", attachment_document_version_ids: [], created_at: "2026-08-29T12:00:00.000Z", updated_at: FIXED_NOW, assignment_group_id: groupId("path"), assigned_to_user_id: user("sarah").id, itsm_state: "blocked", priority: "P1", statutory_deadline: "2026-10-20T00:00:00.000Z", clock_status: "paused", clock_paused_reason: "Dependency clearance pending", clock_paused_at: "2026-09-05T12:00:00.000Z", clock_total_paused_seconds: 172800, triaged_at: "2026-08-30T12:00:00.000Z", triaged_by_user_id: user("sarah").id, triage_notes: "Routed to the project delivery office for cross-agency coordination.", triaged_workstream_ids: ["PATH-DEMO-WS-COAST"] },
    { id: "PATH-DEMO-REQ-COMPLETE", confirmation_number: "PATH-2026-DEMO-COMPLETE", project_id: projectId, request_type: "permit_authorization", title: "Completed drainage authorization request", description: "Demo request with a completed workstream and preserved completion history.", requested_outcome: "Retain the closeout record.", location_or_affected_area: "Drainage authorization area", desired_date: "2026-08-25", schedule_importance: "normal", known_agency_code: "LDEQ", known_permit_type_id: null, submitted_by_user_id: user("alex").id, submitted_by_name: actorName("alex"), related_workstream_id: "PATH-DEMO-WS-COMPLETE", blocks_active_work: false, status: "resolved", attachment_document_version_ids: attachmentIds, created_at: "2026-08-10T12:00:00.000Z", updated_at: FIXED_NOW, assignment_group_id: groupId("ldeq"), assigned_to_user_id: user("jordan").id, itsm_state: "resolved", priority: "P3", statutory_deadline: null, clock_status: "stopped", clock_paused_reason: null, clock_paused_at: null, clock_total_paused_seconds: 0, triaged_at: "2026-08-11T12:00:00.000Z", triaged_by_user_id: user("sarah").id, triage_notes: "Completed demo route.", triaged_workstream_ids: ["PATH-DEMO-WS-COMPLETE"] },
  ];
  await upsert(client, "customer_requests", customerRequests, "upsert tagged demo customer requests");

  const rfis = [
    { id: "PATH-DEMO-RFI-WAITING", code: "PATH-DEMO-RFI-WAITING", workstream_id: "PATH-DEMO-WS-AIR", workstream_title: "Demo — Air permit response and technical review", requesting_org_id: orgId("LDEQ"), requesting_org_code: "LDEQ", recipient_org_id: orgId("SPACEPORT"), recipient_org_code: "SPACEPORT", title: "Confirm control-technology assumptions", question_text: "Please confirm the control-technology assumptions used in the revised emissions inventory.", technical_reason: "The reviewer needs the assumptions before the technical review can resume.", required_document_types: ["control technology memo", "revised emissions inventory"], issued_date: "2026-09-02", response_deadline: "2026-09-18", clock_impact: "pauses_clock", schedule_impact_days: 10, status: "issued", is_consolidated_cycle: false, consolidated_batch_id: null, lead_reviewer_approved_at: null, created_at: "2026-09-02T12:00:00.000Z" },
    { id: "PATH-DEMO-RFI-REVIEW", code: "PATH-DEMO-RFI-REVIEW", workstream_id: "PATH-DEMO-WS-UTILITY", workstream_title: "Demo — Utility interconnection parallel review", requesting_org_id: orgId("DOTD"), requesting_org_code: "DOTD", recipient_org_id: orgId("SPACEPORT"), recipient_org_code: "SPACEPORT", title: "Review the submitted utility note", question_text: "Please review the submitted utility concurrency note and confirm whether the assumptions are acceptable.", technical_reason: "The reviewer must accept or clarify the submitted response.", required_document_types: ["utility concurrency note"], issued_date: "2026-09-03", response_deadline: "2026-09-17", clock_impact: "pauses_clock", schedule_impact_days: 0, status: "submitted_by_applicant", is_consolidated_cycle: false, consolidated_batch_id: null, lead_reviewer_approved_at: null, created_at: "2026-09-03T12:00:00.000Z" },
    { id: "PATH-DEMO-RFI-ACCEPTED", code: "PATH-DEMO-RFI-ACCEPTED", workstream_id: "PATH-DEMO-WS-COMPLETE", workstream_title: "Demo — Completed drainage authorization", requesting_org_id: orgId("LDEQ"), requesting_org_code: "LDEQ", recipient_org_id: orgId("SPACEPORT"), recipient_org_code: "SPACEPORT", title: "Accept the closeout response", question_text: "Confirm that the closeout response is complete for the archived drainage authorization.", technical_reason: "The reviewer accepted the final response for the completed scenario.", required_document_types: ["closeout record"], issued_date: "2026-08-18", response_deadline: "2026-08-22", clock_impact: "none", schedule_impact_days: 0, status: "accepted", is_consolidated_cycle: false, consolidated_batch_id: null, lead_reviewer_approved_at: "2026-08-23T12:00:00.000Z", created_at: "2026-08-18T12:00:00.000Z" },
  ];
  await upsert(client, "rfis", rfis, "upsert tagged demo RFIs");

  const rfiResponses = [
    { id: "PATH-DEMO-RFI-RESPONSE-REVIEW", rfi_id: "PATH-DEMO-RFI-REVIEW", submitted_by_user_name: actorName("alex"), response_text: "The utility concurrency note is attached for reviewer confirmation.", attached_document_version_ids: attachmentIds, submitted_date: "2026-09-04", review_status: "under_review", reviewer_feedback: null, created_at: "2026-09-04T12:00:00.000Z", submitted_by_user_id: user("alex").id },
    { id: "PATH-DEMO-RFI-RESPONSE-ACCEPTED", rfi_id: "PATH-DEMO-RFI-ACCEPTED", submitted_by_user_name: actorName("maya"), response_text: "The closeout record confirms the completed authorization conditions.", attached_document_version_ids: attachmentIds, submitted_date: "2026-08-22", review_status: "accepted", reviewer_feedback: "Accepted for the demo closeout path.", created_at: "2026-08-22T12:00:00.000Z", submitted_by_user_id: user("maya").id },
  ];
  await upsert(client, "rfi_responses", rfiResponses, "upsert tagged demo RFI responses");

  const coordinationRequests = [
    { id: "PATH-DEMO-COORD-WAITING", code: "PATH-DEMO-COORD-WAITING", workstream_id: "PATH-DEMO-WS-UTILITY", workstream_title: "Demo — Utility interconnection parallel review", requesting_org_id: orgId("LA-PROJECTS"), requesting_org_code: "LA-PROJECTS", target_org_id: orgId("DOTD"), target_org_code: "DOTD", requesting_user_name: actorName("sarah"), assigned_to_user_name: null, title: "Confirm transportation concurrency assumptions", need_description: "The project office needs the receiving team to confirm the assumptions used in the parallel review.", requested_date: "2026-09-03", due_date: "2026-09-12", response_date: null, concurred_at: null, attached_document_version_ids: [], blocks_workstream_title: "Demo — Utility interconnection parallel review", priority: "normal", status: "pending", response_summary: null, created_at: "2026-09-03T12:00:00.000Z" },
    { id: "PATH-DEMO-COORD-RESPONDED", code: "PATH-DEMO-COORD-RESPONDED", workstream_id: "PATH-DEMO-WS-COAST", workstream_title: "Demo — Coastal concurrence and dependency clearance", requesting_org_id: orgId("LA-PROJECTS"), requesting_org_code: "LA-PROJECTS", target_org_id: orgId("CPRA"), target_org_code: "CPRA", requesting_user_name: actorName("sarah"), assigned_to_user_name: null, title: "Confirm coastal concurrence conditions", need_description: "Confirm whether the coastal conditions can be accepted for the next handoff.", requested_date: "2026-09-01", due_date: "2026-09-05", response_date: "2026-09-05", concurred_at: null, attached_document_version_ids: attachmentIds, blocks_workstream_title: "Demo — Coastal concurrence and dependency clearance", priority: "high", status: "objection_raised", response_summary: "Response recorded: CPRA requested one additional condition review. The originating work remains blocked until the dependency is explicitly cleared.", created_at: "2026-09-01T12:00:00.000Z" },
    { id: "PATH-DEMO-COORD-RESOLVED", code: "PATH-DEMO-COORD-RESOLVED", workstream_id: "PATH-DEMO-WS-COMPLETE", workstream_title: "Demo — Completed drainage authorization", requesting_org_id: orgId("LA-PROJECTS"), requesting_org_code: "LA-PROJECTS", target_org_id: orgId("LDEQ"), target_org_code: "LDEQ", requesting_user_name: actorName("sarah"), assigned_to_user_name: actorName("jordan"), title: "Confirm drainage closeout", need_description: "Confirm that the completed drainage authorization can move to archive.", requested_date: "2026-08-23", due_date: "2026-08-25", response_date: "2026-08-25", concurred_at: "2026-08-25T12:00:00.000Z", attached_document_version_ids: attachmentIds, blocks_workstream_title: "Demo — Completed drainage authorization", priority: "normal", status: "concurred", response_summary: "Concurred and dependency resolved for the completed scenario.", created_at: "2026-08-23T12:00:00.000Z" },
  ];
  await upsert(client, "coordination_requests", coordinationRequests, "upsert tagged demo coordination requests");

  const externalFilings = [
    { id: "PATH-DEMO-FILING-AIR", project_id: projectId, workstream_id: "PATH-DEMO-WS-AIR", permit_type_id: titleVPermitId, authority_organization_id: orgId("LDEQ"), authority_organization_name: organizationByCode.LDEQ.name, filing_method: "EXTERNAL_PORTAL", official_portal_url: null, external_reference_number: null, external_record_url: null, external_status: "not_started", submitted_at: null, submitted_by_user_id: null, last_status_verified_at: null, last_status_verified_by: null, authoritative_system_name: "Not connected in demo", notes: "No filing has been submitted. This row intentionally preserves an unsent, recoverable state.", receipt_document_version_ids: [], created_at: "2026-09-02T12:00:00.000Z", updated_at: FIXED_NOW },
  ];
  await upsert(client, "external_filings", externalFilings, "upsert tagged demo external filing");

  const notifications = [
    { id: stableUuid("notification:rfi-waiting:maya"), recipient_id: user("maya").id, request_id: null, event_type: "rfi_issued", title: "Applicant response requested", body: "PATH-DEMO-RFI-WAITING is waiting for the applicant response. No reviewer action is required until the response arrives.", channel: "in_app", delivery_status: "pending", dedupe_key: `${SEED_TAG}:rfi-waiting:maya`, created_at: "2026-09-02T12:05:00.000Z", user_id: String(user("maya").id), message: "Applicant response requested for the demo air review.", type: "rfi", link_url: "/work/workstream/PATH-DEMO-WS-AIR", urgency: "high", metadata: { seedTag: SEED_TAG, scenario: "rfi-waiting" }, is_read: false, recipient_user_id: user("maya").id, related_entity_id: "PATH-DEMO-RFI-WAITING" },
    { id: stableUuid("notification:rfi-review:jordan"), recipient_id: user("jordan").id, request_id: null, event_type: "rfi_response_submitted", title: "RFI response waiting for review", body: "PATH-DEMO-RFI-REVIEW has a submitted response waiting for reviewer acceptance or clarification.", channel: "in_app", delivery_status: "pending", dedupe_key: `${SEED_TAG}:rfi-review:jordan`, created_at: "2026-09-04T12:05:00.000Z", user_id: String(user("jordan").id), message: "RFI response waiting for review.", type: "rfi", link_url: "/work/workstream/PATH-DEMO-WS-UTILITY", urgency: "normal", metadata: { seedTag: SEED_TAG, scenario: "rfi-review" }, is_read: false, recipient_user_id: user("jordan").id, related_entity_id: "PATH-DEMO-RFI-REVIEW" },
    { id: stableUuid("notification:coordination:sarah"), recipient_id: user("sarah").id, request_id: null, event_type: "coordination_response_recorded", title: "Coordination response needs a decision", body: "PATH-DEMO-COORD-RESPONDED has a response, but the dependency remains blocked until it is explicitly cleared.", channel: "in_app", delivery_status: "pending", dedupe_key: `${SEED_TAG}:coordination:sarah`, created_at: "2026-09-05T12:05:00.000Z", user_id: String(user("sarah").id), message: "Coordination response recorded; dependency still blocked.", type: "coordination", link_url: "/work/workstream/PATH-DEMO-WS-COAST", urgency: "high", metadata: { seedTag: SEED_TAG, scenario: "coordination-responded" }, is_read: false, recipient_user_id: user("sarah").id, related_entity_id: "PATH-DEMO-COORD-RESPONDED" },
  ];
  // Notifications may already have been created by an application workflow
  // with a different row id.  The tagged dedupe key is the durable identity
  // for these non-destructive demo records, so reruns must converge that row
  // instead of colliding with notifications_dedupe_key_key.
  await upsert(client, "notifications", notifications, "upsert tagged demo notifications", "dedupe_key");

  const audits = [
    { id: stableUuid("audit:request-intake"), actor_id: user("alex").id, organization_id: organizationByCode.SPACEPORT.id, action: "seeded_demo_scenario", resource_type: "customer_request", resource_id: null, before_data: null, after_data: { seedTag: SEED_TAG, state: "submitted", confirmationNumber: "PATH-2026-DEMO-INTAKE" }, correlation_id: stableUuid("correlation:request-intake"), created_at: "2026-09-06T12:00:00.000Z", actor_name: actorName("alex"), actor_org_name: organizationByCode.SPACEPORT.name, entity_type: "customer_request", entity_id: "PATH-DEMO-REQ-INTAKE", action_type: "demo_seeded", old_value: null, new_value: "submitted", reason: "Tagged request intentionally remains unlinked until routing confirmation.", project_id: projectId, occurred_at: "2026-09-06T12:00:00.000Z" },
    { id: stableUuid("audit:triage-active"), actor_id: user("sarah").id, organization_id: organizationByCode["LA-PROJECTS"].id, action: "seeded_demo_scenario", resource_type: "customer_request", resource_id: null, before_data: { status: "submitted" }, after_data: { seedTag: SEED_TAG, status: "in_progress", workstreams: ["PATH-DEMO-WS-UTILITY"] }, correlation_id: stableUuid("correlation:triage-active"), created_at: "2026-09-02T12:00:00.000Z", actor_name: actorName("sarah"), actor_org_name: organizationByCode["LA-PROJECTS"].name, entity_type: "customer_request", entity_id: "PATH-DEMO-REQ-ACTIVE", action_type: "demo_seeded", old_value: "submitted", new_value: "in_progress", reason: "Tagged request demonstrates confirmed routing and assignment.", project_id: projectId, occurred_at: "2026-09-02T12:00:00.000Z" },
    { id: stableUuid("audit:rfi-response"), actor_id: user("alex").id, organization_id: organizationByCode.SPACEPORT.id, action: "seeded_demo_scenario", resource_type: "rfi_response", resource_id: null, before_data: null, after_data: { seedTag: SEED_TAG, reviewStatus: "under_review", attachedDocumentVersionIds: attachmentIds }, correlation_id: stableUuid("correlation:rfi-response"), created_at: "2026-09-04T12:00:00.000Z", actor_name: actorName("alex"), actor_org_name: organizationByCode.SPACEPORT.name, entity_type: "rfi_response", entity_id: "PATH-DEMO-RFI-RESPONSE-REVIEW", action_type: "demo_seeded", old_value: null, new_value: "under_review", reason: attachmentVersionId ? "Tagged response references an existing non-empty immutable document version." : "Tagged response is attachment-ready; no non-empty demo document version was found.", project_id: projectId, occurred_at: "2026-09-04T12:00:00.000Z" },
    { id: stableUuid("audit:coordination-response"), actor_id: user("sarah").id, organization_id: organizationByCode["LA-PROJECTS"].id, action: "seeded_demo_scenario", resource_type: "coordination_request", resource_id: null, before_data: { status: "pending" }, after_data: { seedTag: SEED_TAG, status: "objection_raised", dependencyResolved: false }, correlation_id: stableUuid("correlation:coordination-response"), created_at: "2026-09-05T12:00:00.000Z", actor_name: actorName("sarah"), actor_org_name: organizationByCode["LA-PROJECTS"].name, entity_type: "coordination_request", entity_id: "PATH-DEMO-COORD-RESPONDED", action_type: "demo_seeded", old_value: "pending", new_value: "objection_raised", reason: "Response and dependency clearance remain separate demo states.", project_id: projectId, occurred_at: "2026-09-05T12:00:00.000Z" },
  ];
  await upsert(client, "audit_events", audits, "upsert tagged demo audit events");

  console.log(JSON.stringify({
    seedTag: SEED_TAG,
    project: { id: project.id, number: project.number, name: project.name },
    attachmentVersionId,
    counts: {
      workstreams: workstreams.length,
      tasks: tasks.length,
      dependencies: dependencies.length,
      customerRequests: customerRequests.length,
      rfis: rfis.length,
      rfiResponses: rfiResponses.length,
      coordinationRequests: coordinationRequests.length,
      externalFilings: externalFilings.length,
      stageRuns: stageRuns.length,
      notifications: notifications.length,
      auditEvents: audits.length,
    },
    stablePrefixes: ["PATH-DEMO-WS-", "PATH-DEMO-T-", "PATH-DEMO-REQ-", "PATH-DEMO-RFI-", "PATH-DEMO-COORD-", "PATH-DEMO-FILING-"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
