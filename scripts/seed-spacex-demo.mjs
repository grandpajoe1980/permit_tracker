import fs from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2")];
      })
  );
}

const env = { ...readEnvFile(), ...process.env };
const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.LEGACY_SERVICE_ROLE_KEY || env.legacy_service_role_key;
if (!url || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function stableUuid(value) {
  const hex = createHash("sha256").update(value).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const users = [
  { email: "alex.martin@demo.permit.local", password: "SpaceX-Demo-2026!", name: "Alex Martin", role: "customer" },
  { email: "maya.chen@demo.permit.local", password: "SpaceX-Demo-2026!", name: "Maya Chen", role: "program" },
  { email: "jordan.lee@demo.permit.local", password: "Agency-Demo-2026!", name: "Jordan Lee", role: "environment" },
  { email: "sam.rivera@demo.permit.local", password: "Agency-Demo-2026!", name: "Sam Rivera", role: "infrastructure" },
  { email: "riley.brooks@demo.permit.local", password: "Agency-Demo-2026!", name: "Riley Brooks", role: "community" },
  { email: "joe.skaggs@demo.permit.local", password: "PATH-Demo-2026!", name: "Joe Skaggs", role: "admin" },
  { email: "sarah.johnson@demo.permit.local", password: "PATH-Demo-2026!", name: "Sarah Johnson", role: "state_office" },
  { email: "aris.thorne@demo.permit.local", password: "SpaceX-Demo-2026!", name: "Dr. Aris Thorne", role: "consultant" },
  { email: "elon.musk@demo.permit.local", password: "SpaceX-Demo-2026!", name: "Elon Musk", role: "space_exec" },
  { email: "gwynne.shotwell@demo.permit.local", password: "SpaceX-Demo-2026!", name: "Gwynne Shotwell", role: "space_exec" },
  { email: "bill.gerstenmaier@demo.permit.local", password: "SpaceX-Demo-2026!", name: "Bill Gerstenmaier", role: "space_build" },
  { email: "jeff.landry@demo.permit.local", password: "PATH-Demo-2026!", name: "Jeff Landry", role: "state_exec" },
  { email: "susan.bourgeois@demo.permit.local", password: "PATH-Demo-2026!", name: "Susan Bourgeois", role: "state_coordinator" },
];

const requests = [
  ["Airport apron and emergency airfield", "aviation infrastructure", "High", "in_review", "technical_review", 42, 180],
  ["Employee restaurant and food-service facility", "community facilities", "Normal", "submitted", "intake", 12, 120],
  ["Heavy-haul access road and drainage", "road infrastructure", "Critical", "action_required", "agency_coordination", 58, 210],
  ["Beach restoration and dune rebuild", "coastal restoration", "High", "in_review", "technical_review", 36, 240],
  ["Gulf access channel dredging", "ocean dredging", "Critical", "on_hold", "agency_coordination", 61, 300],
  ["Launch communications tower", "tower and communications", "Normal", "in_review", "construction_release", 74, 150],
  ["Starship manufacturing factory", "aerospace manufacturing", "High", "in_review", "technical_review", 49, 365],
  ["Water, power, and deluge utility campus", "utilities and water", "Critical", "submitted", "intake", 8, 270],
];

async function one(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

const customer = (await one(supabase.from("customer_organizations").select("id").eq("name", "SpaceX Louisiana").single(), "customer org"));
const project = (await one(supabase.from("projects").select("id").eq("number", "PRJ-PECAN-2026").single(), "project"));
await one(supabase.from("organizations").upsert([
  ["SPACEPORT", "SpaceX Project Delivery", "applicant", "external_partner"],
  ["LA-PROJECTS", "Louisiana Economic Development Space Coordination", "coordination", "state"],
  ["LED", "Louisiana Economic Development", "agency", "state"],
  ["LDEQ", "LDEQ Air, Water, Waste and Remediation Permits", "agency", "state"],
  ["DOTD", "DOTD Roads, Bridges and Aviation", "agency", "state"],
  ["CPRA", "CPRA Coastal Permitting", "agency", "state"],
  ["LDNR", "LDNR Energy and Pipeline Coordination", "agency", "state"],
  ["OSFM", "State Fire Marshal", "agency", "state"],
  ["LSP", "Louisiana State Police", "agency", "state"],
  ["VERMILION", "Local Parish Coordination", "agency", "local"],
  ["VERMILION-PARISH", "Local Parish Coordination", "agency", "local"],
  ["USACE", "U.S. Army Corps of Engineers Federal Coordination", "federal_agency", "federal"],
  ["FAA", "Federal Aviation Administration Coordination", "federal_agency", "federal"],
  ["EPA", "U.S. Environmental Protection Agency Coordination", "federal_agency", "federal"],
  ["USFWS", "U.S. Fish and Wildlife Service Consultation", "federal_agency", "federal"],
  ["NOAA", "National Oceanic and Atmospheric Administration Consultation", "federal_agency", "federal"],
  ["SHPO", "Louisiana State Historic Preservation Office Consultation", "agency", "state"],
  ["LDCE", "Louisiana Department of Conservation and Energy", "agency", "state"],
  ["LPSC", "Louisiana Public Service Commission Coordination", "agency", "state"],
  ["SLO", "Louisiana State Land Office Coordination", "agency", "state"],
  ["COASTAL_ENGINEERING", "Coastal Engineering Partners", "external_partner", "external_partner"],
  ["STATEPO", "Governor's Executive Review", "coordination", "state"],
].map(([code, name, organization_type, jurisdiction_level]) => ({ code, name, organization_type, jurisdiction_level, active: true })), { onConflict: "code" }), "ensure demo organizations");
const orgs = await one(supabase.from("organizations").select("id,code"), "organizations");
const orgByCode = Object.fromEntries(orgs.map((o) => [o.code, o.id]));
const membershipOrgByRole = { program: "SPACEPORT", environment: "LDEQ", infrastructure: "DOTD", community: "VERMILION", admin: "LED", state_office: "LA-PROJECTS", consultant: "COASTAL_ENGINEERING", space_exec: "SPACEPORT", space_build: "SPACEPORT", state_exec: "LA-PROJECTS", state_coordinator: "LED" };
const membershipRoleByUserRole = { program: "supervisor", admin: "system_admin", state_office: "supervisor", environment: "contributor", infrastructure: "contributor", community: "contributor", consultant: "contributor", space_exec: "supervisor", space_build: "contributor", state_exec: "supervisor", state_coordinator: "supervisor" };

const authUsers = [];
for (const spec of users) {
  const listed = await one(supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }), "list users");
  let user = listed.users.find((candidate) => candidate.email?.toLowerCase() === spec.email);
  if (!user) user = (await one(supabase.auth.admin.createUser({ email: spec.email, password: spec.password, email_confirm: true, user_metadata: { full_name: spec.name, demo_persona: true, fictional_notice: "Professional demonstration persona; not a real account." } }), `create ${spec.email}`)).user;
  authUsers.push({ ...spec, id: user.id });
  await one(supabase.from("profiles").upsert({ id: user.id, email: spec.email, full_name: spec.name, customer_organization_id: spec.role === "customer" ? customer.id : null, status: "active" }), `profile ${spec.email}`);
  if (spec.role !== "customer") {
    const organizationId = orgByCode[membershipOrgByRole[spec.role]];
    if (!organizationId) throw new Error(`Missing organization for ${spec.role}: ${membershipOrgByRole[spec.role]}`);
    await one(supabase.from("organization_memberships").upsert({ user_id: user.id, organization_id: organizationId, role: membershipRoleByUserRole[spec.role], status: "active" }, { onConflict: "user_id,organization_id" }), `membership ${spec.email}`);
  }
}

const profileByEmail = {
  "alex.martin@demo.permit.local": { title: "SpaceX Project Manager", unit: "Louisiana Launch Site Delivery", organizationId: "SPACEPORT", organizationName: "Space Exploration Technologies Corp. (SpaceX)", projectRole: "Customer project lead", visible: true },
  "maya.chen@demo.permit.local": { title: "SpaceX Regulatory Affairs Manager", unit: "Regulatory Affairs & Permitting", organizationId: "SPACEPORT", organizationName: "Space Exploration Technologies Corp. (SpaceX)", projectRole: "Customer regulatory lead", visible: true },
  "jordan.lee@demo.permit.local": { title: "Environmental Scientist 1", unit: "LDEQ / Air and Water Permits", organizationId: "LDEQ", organizationName: "Louisiana Department of Environmental Quality", projectRole: "Environmental review lead", visible: true },
  "sam.rivera@demo.permit.local": { title: "Civil Engineer 4", unit: "DOTD / Roads, Bridges, and Aviation", organizationId: "DOTD", organizationName: "Louisiana Department of Transportation and Development", projectRole: "Transportation and infrastructure lead", visible: true },
  "riley.brooks@demo.permit.local": { title: "Intergovernmental Affairs Coordinator", unit: "Local Parish Coordination", organizationId: "VERMILION", organizationName: "Local parish coordination office (demo)", projectRole: "Parish and community liaison", visible: true },
  "joe.skaggs@demo.permit.local": { title: "Workflow Administrator", unit: "PATH / Administration", organizationId: "LED", organizationName: "Louisiana Economic Development (demo)", projectRole: "PATH administrator", visible: false },
  "sarah.johnson@demo.permit.local": { title: "Interagency Coordinator", unit: "PATH / Louisiana Project Delivery Office", organizationId: "LA-PROJECTS", organizationName: "Louisiana Governor's Office of Major Projects & Delivery (demo)", projectRole: "State concierge and project manager", visible: true },
  "aris.thorne@demo.permit.local": { title: "Civil / Coastal Engineering Lead", unit: "Coastal Hydrology Practice", organizationId: "COASTAL_ENGINEERING", organizationName: "Gulf Coast Engineering Partners (demo)", projectRole: "Consultant representing SpaceX", visible: true },
  "elon.musk@demo.permit.local": { title: "SpaceX Executive / Project Sponsor", unit: "SpaceX Project Delivery", organizationId: "SPACEPORT", organizationName: "Space Exploration Technologies Corp. (SpaceX) (demo)", projectRole: "Applicant executive observer", visible: true },
  "gwynne.shotwell@demo.permit.local": { title: "SpaceX President / Operational Executive", unit: "SpaceX Project Delivery", organizationId: "SPACEPORT", organizationName: "Space Exploration Technologies Corp. (SpaceX) (demo)", projectRole: "Applicant executive", visible: true },
  "bill.gerstenmaier@demo.permit.local": { title: "SpaceX Build and Flight Reliability Executive", unit: "SpaceX Civil and Site Development", organizationId: "SPACEPORT", organizationName: "Space Exploration Technologies Corp. (SpaceX) (demo)", projectRole: "Applicant technical executive", visible: true },
  "jeff.landry@demo.permit.local": { title: "Louisiana Governor / Executive Sponsor", unit: "Governor's Executive Review", organizationId: "LA-PROJECTS", organizationName: "Governor's Executive Review (demo)", projectRole: "Executive observer / sponsor", visible: true },
  "susan.bourgeois@demo.permit.local": { title: "Louisiana Economic Development Secretary", unit: "Louisiana Economic Development Space Coordination", organizationId: "LED", organizationName: "Louisiana Economic Development (demo)", projectRole: "Executive coordinator", visible: true },
};
for (const user of authUsers) {
  const profile = profileByEmail[user.email];
  if (!profile) continue;
  const existingProfile = await one(supabase.from("user_profiles").select("id").eq("user_id", user.id).maybeSingle(), `find portal profile ${user.email}`);
  await one(supabase.from("user_profiles").upsert({ id: existingProfile?.id ?? stableUuid(`profile:${user.email}`), user_id: user.id, full_name: user.name, organization_id: profile.organizationId, organization_name: profile.organizationName, display_title: profile.title, organizational_unit: profile.unit, work_email: user.email, project_role: profile.projectRole, is_customer_visible: profile.visible, is_active: true }, { onConflict: "user_id" }), `portal profile ${user.email}`);
}

const userByEmail = Object.fromEntries(authUsers.map((user) => [user.email, user]));

// Keep the demo operationally useful after a normal seed run. Every record in
// this supplemental block has a stable identifier so rerunning the script
// updates the same persona, queue, workflow, workstream, and task records.
const assignmentGroupSpecs = [
  ["SPACEPORT", "SpaceX Regulatory Affairs", "Customer permit intake and applicant response queue", "maya.chen@demo.permit.local"],
  ["LDEQ", "LDEQ Air and Water Review", "Environmental, air, water, and waste permit review", "jordan.lee@demo.permit.local"],
  ["DOTD", "DOTD Transportation Review", "Road, bridge, heavy-haul, and aviation coordination", "sam.rivera@demo.permit.local"],
  ["CPRA", "CPRA Coastal Review", "Wetlands, coastal use, and restoration review", "sarah.johnson@demo.permit.local"],
  ["LA-PROJECTS", "Louisiana Project Delivery Office", "Cross-agency triage and escalation coordination", "sarah.johnson@demo.permit.local"],
  ["LED", "PATH Administration", "Workflow, registry, and permission administration", "joe.skaggs@demo.permit.local"],
];
const groupByKey = {};
for (const [orgCode, name, description, leadEmail] of assignmentGroupSpecs) {
  const id = stableUuid(`assignment-group:${orgCode}:${name}`);
  await one(supabase.from("assignment_groups").upsert({ id, org_code: orgCode, organization_id: orgByCode[orgCode], name, description, lead_user_id: userByEmail[leadEmail].id, active: true }, { onConflict: "id" }), `assignment group ${name}`);
  groupByKey[`${orgCode}:${name}`] = id;
}
const groupMemberships = [
  ["SPACEPORT:SpaceX Regulatory Affairs", "alex.martin@demo.permit.local", "member"],
  ["SPACEPORT:SpaceX Regulatory Affairs", "maya.chen@demo.permit.local", "lead"],
  ["SPACEPORT:SpaceX Regulatory Affairs", "gwynne.shotwell@demo.permit.local", "backup"],
  ["LDEQ:LDEQ Air and Water Review", "jordan.lee@demo.permit.local", "lead"],
  ["DOTD:DOTD Transportation Review", "sam.rivera@demo.permit.local", "lead"],
  ["CPRA:CPRA Coastal Review", "sarah.johnson@demo.permit.local", "lead"],
  ["LA-PROJECTS:Louisiana Project Delivery Office", "sarah.johnson@demo.permit.local", "lead"],
  ["LA-PROJECTS:Louisiana Project Delivery Office", "jeff.landry@demo.permit.local", "backup"],
  ["LED:PATH Administration", "joe.skaggs@demo.permit.local", "lead"],
];
for (const [groupKey, email, role] of groupMemberships) {
  await one(supabase.from("assignment_group_memberships").upsert({ id: stableUuid(`assignment-group-membership:${groupKey}:${email}`), assignment_group_id: groupByKey[groupKey], user_id: userByEmail[email].id, role }, { onConflict: "assignment_group_id,user_id" }), `group membership ${email}`);
}

let workflow = await one(supabase.from("workflow_definitions").select("id").eq("organization_id", orgByCode.SPACEPORT).eq("case_type", "spaceport_request").eq("version", 1).maybeSingle(), "find demo workflow");
if (!workflow) {
  workflow = await one(supabase.from("workflow_definitions").insert({ id: stableUuid("workflow:spaceport-request:v1"), organization_id: orgByCode.SPACEPORT, case_type: "spaceport_request", version: 1, active: true }).select("id").single(), "create demo workflow");
}
const workflowStages = [
  ["intake", "Request intake", 1, 5],
  ["technical_review", "Technical team review", 2, 30],
  ["agency_coordination", "Agency coordination", 3, 45],
  ["construction_release", "Construction release", 4, 30],
  ["monitoring", "Monitoring and closeout", 5, 60],
];
const workflowStageIds = {};
for (const [stageKey, label, sortOrder, serviceTargetDays] of workflowStages) {
  const stageId = stableUuid(`workflow-stage:spaceport-request:v1:${stageKey}`);
  await one(supabase.from("workflow_stages").upsert({ id: stageId, workflow_id: workflow.id, stage_key: stageKey, label, sort_order: sortOrder, service_target_days: serviceTargetDays, minimum_processing_days: 0, required_documents: [] }, { onConflict: "workflow_id,stage_key" }), `workflow stage ${stageKey}`);
  workflowStageIds[stageKey] = stageId;
}
const workflowVersionId = "workflow-version-spaceport-request-v1";
await one(supabase.from("workflow_versions").upsert({ id: workflowVersionId, workflow_id: workflow.id, version_number: 1, version_label: "v1", change_summary: "Self-contained SpaceX Louisiana demonstration workflow", is_active: true, lifecycle_status: "published", published_at: "2026-08-01T00:00:00Z", effective_date: "2026-08-01" }, { onConflict: "id" }), "demo workflow version");
for (const [stageKey, label, sequenceOrder, targetDurationDays] of workflowStages) {
  await one(supabase.from("workflow_version_stages").upsert({ id: `${workflowVersionId}-${stageKey}`, workflow_version_id: workflowVersionId, stage_key: stageKey, sequence_order: sequenceOrder, label, customer_visibility_label: label, responsible_org_code: stageKey === "technical_review" ? "SPACEPORT" : stageKey === "agency_coordination" ? "LA-PROJECTS" : "PATH", target_duration_days: targetDurationDays, minimum_statutory_days: 0, required_inputs: [], completion_requirements: [`Confirm ${label.toLowerCase()} evidence`], permitted_transitions: [], can_run_in_parallel: false, is_milestone_gate: stageKey !== "monitoring" }, { onConflict: "workflow_version_id,stage_key" }), `versioned workflow stage ${stageKey}`);
}

const airWorkstream = await one(supabase.from("workstreams").select("id").eq("code", "WS-AIR-TITLE-V").maybeSingle(), "find Title V workstream");
const airPermit = await one(supabase.from("permit_types").select("id").eq("code", "LDEQ-AIR-TITLEV").maybeSingle(), "find Title V permit");
if (!airWorkstream) {
  await one(supabase.from("workstreams").upsert({ id: "WS-AIR-TITLE-V", project_id: project.id, code: "WS-AIR-TITLE-V", title: "Liquefaction and combustion source air permit", category: "air", permit_type_id: airPermit?.id ?? null, current_stage_name: "Technical team review", operational_state: "running", operational_state_label: "Running (Technical team review)", rag_status: "yellow", rag_label: "At Risk", is_critical_path: true, baseline_target_date: "2026-11-30", forecast_target_date: "2026-12-20", schedule_variance_days: 20, remaining_float_days: 0, current_action_summary: "Resolve emissions inventory questions and complete the agency package.", assignment_group_id: groupByKey["LDEQ:LDEQ Air and Water Review"], assigned_to_user_id: userByEmail["jordan.lee@demo.permit.local"].id, assigned_org_code: "LDEQ", itsm_state: "in_progress", priority: "P1", clock_status: "active", workflow_version_id: workflowVersionId, current_stage_id: `${workflowVersionId}-technical_review`, active_blockers: [] }, { onConflict: "id" }), "Title V workstream");
}
const airTasks = [
  ["TASK-AIR-001", "Confirm emissions inventory and applicability memo", "completed", "SPACEPORT:SpaceX Regulatory Affairs", "alex.martin@demo.permit.local", true],
  ["TASK-AIR-002", "Resolve LDEQ technical review questions", "in_progress", "LDEQ:LDEQ Air and Water Review", "jordan.lee@demo.permit.local", true],
  ["TASK-AIR-003", "Upload revised control-technology support", "pending_customer", "SPACEPORT:SpaceX Regulatory Affairs", "maya.chen@demo.permit.local", false],
  ["TASK-AIR-004", "Issue final agency coordination package", "blocked", "LA-PROJECTS:Louisiana Project Delivery Office", "sarah.johnson@demo.permit.local", true],
  ["TASK-AIR-005", "Record construction-release decision", "submitted", "LED:PATH Administration", "joe.skaggs@demo.permit.local", false],
];
for (const [id, title, status, groupKey, assigneeEmail, critical] of airTasks) {
  await one(supabase.from("tasks").upsert({ id, workstream_id: "WS-AIR-TITLE-V", task_code: id, title, duration_days: 10, float_days: critical ? 0 : 5, early_start: "2026-08-01", early_finish: "2026-08-15", late_start: "2026-08-01", late_finish: "2026-08-20", is_critical_path: critical, status, assignment_group_id: groupByKey[groupKey], assigned_to_user_id: userByEmail[assigneeEmail].id, assigned_org_code: groupKey.split(":")[0], itsm_state: status === "completed" ? "resolved" : status, priority: critical ? "P1" : "P2", clock_status: status === "blocked" ? "paused" : "active" }, { onConflict: "id" }), `Title V task ${id}`);
}
for (const [predecessor, successor, controlling] of [["TASK-AIR-001", "TASK-AIR-002", true], ["TASK-AIR-002", "TASK-AIR-003", true], ["TASK-AIR-003", "TASK-AIR-004", true], ["TASK-AIR-004", "TASK-AIR-005", false]]) {
  await one(supabase.from("task_dependencies").upsert({ id: `dep-${predecessor}-${successor}`, predecessor_task_id: predecessor, successor_task_id: successor, dependency_type: "finish_to_start", gate_type: "statutory_mandatory", lag_days: 0, is_controlling: controlling }, { onConflict: "id" }), `dependency ${predecessor} ${successor}`);
}
await one(supabase.from("rfis").upsert({ id: "rfi-demo-title-v", code: "RFI-DEMO-TITLE-V", workstream_id: "WS-AIR-TITLE-V", workstream_title: "Liquefaction and combustion source air permit", requesting_org_id: orgByCode.LDEQ, requesting_org_code: "LDEQ", recipient_org_id: orgByCode.SPACEPORT, recipient_org_code: "SPACEPORT", title: "Confirm control-technology assumptions", question_text: "Please confirm the control-technology assumptions used in the revised Title V emissions inventory.", technical_reason: "The agency reviewer needs the assumptions before the technical review can resume.", required_document_types: ["emissions inventory", "control technology memo"], issued_date: "2026-08-28", response_deadline: "2026-09-12", clock_impact: "pauses_clock", schedule_impact_days: 12, status: "issued", is_consolidated_cycle: false }, { onConflict: "id" }), "Title V RFI");

const participantSpecs = [
  ["participant-alex", "alex.martin@demo.permit.local", "SPACEPORT", "lead", "customer", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-UTILITY-INTERCONNECT"], [], [], ["customer_updates"]],
  ["participant-maya", "maya.chen@demo.permit.local", "SPACEPORT", "reviewing", "customer", ["WS-WETLANDS-PAD-A", "WS-LA82-HEAVYHAUL", "WS-AIRSPACE-MARITIME"], [], ["customer_submissions"], ["rfis", "escalations"]],
  ["participant-jordan", "jordan.lee@demo.permit.local", "LDEQ", "reviewing", "project", ["WS-WETLANDS-PAD-A", "WS-WASTEWATER-DELUGE"], ["TASK-T003"], ["environmental_permits"], ["rfis", "document_reviews"]],
  ["participant-sam", "sam.rivera@demo.permit.local", "DOTD", "reviewing", "project", ["WS-LA82-HEAVYHAUL", "WS-SUBSTATION-230KV"], ["TASK-T001", "TASK-T002"], ["transportation_permits"], ["coordination_requests"]],
  ["participant-riley", "riley.brooks@demo.permit.local", "VERMILION", "consulting", "customer", ["WS-COMMUNITY-WATER", "WS-AIRSPACE-MARITIME"], [], ["public_hearings"], ["meetings", "public_notices"]],
  ["participant-sarah", "sarah.johnson@demo.permit.local", "LA-PROJECTS", "coordinating", "project", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-COMMUNITY-WATER"], [], ["cross_agency_triage"], ["all_project_exceptions"]],
  ["participant-joe", "joe.skaggs@demo.permit.local", "LED", "lead", "admin", [], [], ["administration", "escalations"], ["escalation_queue"]],
  ["participant-aris", "aris.thorne@demo.permit.local", "COASTAL_ENGINEERING", "consulting", "customer", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A"], [], ["technical_submissions"], ["document_requests"]],
  ["participant-elon", "elon.musk@demo.permit.local", "SPACEPORT", "notified", "customer", ["WS-LA82-HEAVYHAUL", "WS-AIR-TITLE-V"], [], ["executive_observer"], ["critical_path_notifications"]],
  ["participant-gwynne", "gwynne.shotwell@demo.permit.local", "SPACEPORT", "lead", "customer", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-UTILITY-INTERCONNECT"], [], ["executive_operations"], ["executive_updates"]],
  ["participant-bill", "bill.gerstenmaier@demo.permit.local", "SPACEPORT", "consulting", "customer", ["WS-LA82-HEAVYHAUL", "WS-SUBSTATION-230KV"], [], ["technical_executive_review"], ["reliability_updates"]],
  ["participant-jeff", "jeff.landry@demo.permit.local", "LA-PROJECTS", "notified", "project", [], [], ["executive_sponsor"], ["executive_observer"]],
  ["participant-susan", "susan.bourgeois@demo.permit.local", "LED", "coordinating", "project", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-AIR-TITLE-V"], [], ["space_coordination"], ["executive_coordination"]],
];
for (const [id, email, orgCode, participationRole, accessScope, workstreamIds, assignedTaskIds, reviewResponsibility, notificationResponsibility] of participantSpecs) {
  const user = userByEmail[email];
  await one(supabase.from("project_participants").upsert({
    id: stableUuid(id),
    project_id: project.id,
    organization_id: orgByCode[orgCode],
    participation_role: participationRole,
    access_scope: "project",
    user_id: user.id,
    organization_name: profileByEmail[email].organizationName,
    project_role: profileByEmail[email].projectRole,
    workstream_ids: workstreamIds,
    assigned_task_ids: assignedTaskIds,
    review_responsibility: reviewResponsibility,
    notification_responsibility: notificationResponsibility,
    visibility_scope: accessScope,
    is_active: true,
  }, { onConflict: "id" }), `participant ${email}`);
}

const sarah = userByEmail["sarah.johnson@demo.permit.local"];
const maya = userByEmail["maya.chen@demo.permit.local"];
const filings = [
  { id: "filing-usace-404-pecan", workstream_id: "WS-WETLANDS-PAD-A", permit_type_id: "cat-usace-404", authority_organization_id: orgByCode.USACE, authority_organization_name: "U.S. Army Corps of Engineers - New Orleans District", external_reference_number: "USACE-TEST-PECAN-404", external_record_url: "https://crms.usace.army.mil", external_status: "under_review", submitted_at: "2026-08-22T14:00:00Z", submitted_by_user_id: maya.id, last_status_verified_at: "2026-08-29T16:30:00Z", last_status_verified_by: sarah.id, authoritative_system_name: "USACE Regulatory Request System", official_portal_url: "https://crms.usace.army.mil", notes: "Manually updated from the agency record. PATH does not synchronize this filing." },
  { id: "filing-cpra-cup-pecan", workstream_id: "WS-WETLANDS-PAD-A", permit_type_id: "cat-cpra-cup", authority_organization_id: orgByCode.CPRA, authority_organization_name: "Coastal Protection and Restoration Authority", external_reference_number: "P20240182", external_status: "submitted", submitted_at: "2026-08-24T12:00:00Z", submitted_by_user_id: maya.id, last_status_verified_at: "2026-08-28T10:15:00Z", last_status_verified_by: sarah.id, authoritative_system_name: "SONRIS CPRA", official_portal_url: "https://sonris-cpra.dnr.state.la.us/cup-portal", notes: "Customer-provided reference; agency portal remains authoritative." },
];
for (const filing of filings) {
  await one(supabase.from("external_filings").upsert({ ...filing, project_id: project.id.toString(), filing_method: "EXTERNAL_PORTAL", receipt_document_version_ids: [] }, { onConflict: "id" }), `filing ${filing.id}`);
}

const submitter = authUsers.find((u) => u.role === "customer");
const seededRequestIds = [];
for (const [title, category, priority, status, stage, currentDay, totalDays] of requests) {
  const existing = await one(supabase.from("requests").select("id").eq("title", title).maybeSingle(), `find ${title}`);
  const payload = { id: existing?.id ?? stableUuid(`request:${title}`), project_id: project.id, submitter_id: submitter.id, owning_organization_id: orgByCode.SPACEPORT, request_type: category, category, title, description: `Illustrative SpaceX Louisiana program request for ${title.toLowerCase()}.`, status, current_stage: stage, priority: priority.toLowerCase(), applicant_name: "SpaceX Louisiana Program", organization_name: "Space Exploration Technologies Corp.", status_label: status === "action_required" ? "Action required" : status === "on_hold" ? "On hold" : status === "submitted" ? "Submitted" : "In review", current_day: currentDay, total_days: totalDays, submitted_at: "2026-07-04T12:00:00Z", due_date: "2027-01-15", next_action: status === "action_required" ? "Upload the updated drainage and traffic-control plan." : "Monitor technical review milestones." };
  if (existing) await one(supabase.from("requests").update(payload).eq("id", existing.id), `update ${title}`);
  else await one(supabase.from("requests").insert(payload), `insert ${title}`);
  seededRequestIds.push(payload.id);
}

const caseWorkflowStageByRequest = new Map([
  [seededRequestIds[0], "technical_review"],
  [seededRequestIds[1], "intake"],
  [seededRequestIds[2], "agency_coordination"],
  [seededRequestIds[3], "technical_review"],
  [seededRequestIds[4], "agency_coordination"],
  [seededRequestIds[5], "construction_release"],
  [seededRequestIds[6], "technical_review"],
  [seededRequestIds[7], "intake"],
]);
for (const requestId of seededRequestIds) {
  const stageKey = caseWorkflowStageByRequest.get(requestId) ?? "intake";
  await one(supabase.from("case_workflows").upsert({ id: stableUuid(`case-workflow:${requestId}`), request_id: requestId, workflow_id: workflow.id, stage_key: stageKey, clock_state: stageKey === "agency_coordination" ? "paused" : "running", minimum_completion_date: "2026-08-15", target_completion_date: "2027-01-15" }, { onConflict: "request_id" }), `case workflow ${requestId}`);
}
const requestAssignments = [
  [seededRequestIds[0], "SPACEPORT:SpaceX Regulatory Affairs", "maya.chen@demo.permit.local", "reviewer"],
  [seededRequestIds[2], "DOTD:DOTD Transportation Review", "sam.rivera@demo.permit.local", "reviewer"],
  [seededRequestIds[4], "CPRA:CPRA Coastal Review", "sarah.johnson@demo.permit.local", "coordinator"],
];
for (const [requestId, groupKey, email, assignmentRole] of requestAssignments) {
  await one(supabase.from("assignments").upsert({ id: stableUuid(`assignment:${requestId}:${email}`), request_id: requestId, assignee_user_id: userByEmail[email].id, assignee_organization_id: orgByCode[groupKey.split(":")[0]], assignment_role: assignmentRole, due_date: "2026-10-15", status: "active" }, { onConflict: "id" }), `request assignment ${requestId}`);
}
await one(supabase.from("notifications").upsert({ id: stableUuid("notification:maya:heavy-haul-action-required"), recipient_id: userByEmail["maya.chen@demo.permit.local"].id, request_id: seededRequestIds[2], event_type: "action_required", title: "Applicant response required", body: "Upload the updated drainage and traffic-control plan for the heavy-haul access request.", channel: "in_app", delivery_status: "pending", dedupe_key: "demo-heavy-haul-action-required" }, { onConflict: "id" }), "demo notification");
await one(supabase.from("audit_events").upsert({ id: stableUuid("audit:demo-heavy-haul-status"), actor_id: userByEmail["sarah.johnson@demo.permit.local"].id, organization_id: orgByCode["LA-PROJECTS"], action: "seeded_demo_status", resource_type: "request", resource_id: seededRequestIds[2], before_data: { status: "submitted" }, after_data: { status: "action_required" }, correlation_id: stableUuid("correlation:demo-heavy-haul"), created_at: "2026-08-29T16:30:00Z" }), "demo audit event");

console.log(JSON.stringify({ users: authUsers.map(({ email, role }) => ({ email, role, fictional: true })), assignmentGroups: assignmentGroupSpecs.length, workflowStages: workflowStages.length, workstream: "WS-AIR-TITLE-V", tasks: airTasks.length, participants: participantSpecs.length, externalFilings: filings.length, requests: requests.length, project: project.id }));
