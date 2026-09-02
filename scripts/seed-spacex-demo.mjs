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
  ["COASTAL_ENGINEERING", "Coastal Engineering Partners", "external_partner", "external_partner"],
  ["STATEPO", "Governor's Executive Review", "coordination", "state"],
].map(([code, name, organization_type, jurisdiction_level]) => ({ code, name, organization_type, jurisdiction_level, active: true })), { onConflict: "code" }), "ensure demo organizations");
const orgs = await one(supabase.from("organizations").select("id,code"), "organizations");
const orgByCode = Object.fromEntries(orgs.map((o) => [o.code, o.id]));
const membershipOrgByRole = { program: "SPACEPORT", environment: "LDEQ", infrastructure: "DOTD", community: "VERMILION", admin: "LED", state_office: "LA-PROJECTS", consultant: "COASTAL_ENGINEERING", space_exec: "SPACEX", space_build: "SPACEX", state_exec: "LA-PROJECTS", state_coordinator: "LED" };
const membershipRoleByUserRole = { program: "supervisor", admin: "system_admin", state_office: "supervisor", environment: "contributor", infrastructure: "contributor", community: "contributor", consultant: "contributor", space_exec: "supervisor", space_build: "contributor", state_exec: "supervisor", state_coordinator: "supervisor" };

const authUsers = [];
for (const spec of users) {
  const listed = await one(supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }), "list users");
  let user = listed.users.find((candidate) => candidate.email?.toLowerCase() === spec.email);
  if (!user) user = (await one(supabase.auth.admin.createUser({ email: spec.email, password: spec.password, email_confirm: true, user_metadata: { full_name: spec.name } }), `create ${spec.email}`)).user;
  authUsers.push({ ...spec, id: user.id });
  await one(supabase.from("profiles").upsert({ id: user.id, email: spec.email, full_name: spec.name, customer_organization_id: spec.role === "customer" ? customer.id : null, status: "active" }), `profile ${spec.email}`);
  if (spec.role !== "customer") {
    const organizationId = orgByCode[membershipOrgByRole[spec.role]];
    if (!organizationId) throw new Error(`Missing organization for ${spec.role}: ${membershipOrgByRole[spec.role]}`);
    await one(supabase.from("organization_memberships").upsert({ user_id: user.id, organization_id: organizationId, role: membershipRoleByUserRole[spec.role], status: "active" }, { onConflict: "user_id,organization_id" }), `membership ${spec.email}`);
  }
}

const profileByEmail = {
  "alex.martin@demo.permit.local": { title: "SpaceX Project Manager", unit: "Louisiana Launch Site Delivery", organizationId: "SPACEX", organizationName: "Space Exploration Technologies Corp. (SpaceX)", projectRole: "Customer project lead", visible: true },
  "maya.chen@demo.permit.local": { title: "SpaceX Regulatory Affairs Manager", unit: "Regulatory Affairs & Permitting", organizationId: "SPACEX", organizationName: "Space Exploration Technologies Corp. (SpaceX)", projectRole: "Customer regulatory lead", visible: true },
  "jordan.lee@demo.permit.local": { title: "Environmental Scientist 1", unit: "LDEQ / Air and Water Permits", organizationId: "LDEQ", organizationName: "Louisiana Department of Environmental Quality", projectRole: "Environmental review lead", visible: true },
  "sam.rivera@demo.permit.local": { title: "Civil Engineer 4", unit: "DOTD / Roads, Bridges, and Aviation", organizationId: "DOTD", organizationName: "Louisiana Department of Transportation and Development", projectRole: "Transportation and infrastructure lead", visible: true },
  "riley.brooks@demo.permit.local": { title: "Intergovernmental Affairs Coordinator", unit: "Local Parish Coordination", organizationId: "VERMILION", organizationName: "Local parish coordination office (demo)", projectRole: "Parish and community liaison", visible: true },
  "joe.skaggs@demo.permit.local": { title: "Workflow Administrator", unit: "PATH / Administration", organizationId: "LED", organizationName: "Louisiana Economic Development (demo)", projectRole: "PATH administrator", visible: false },
  "sarah.johnson@demo.permit.local": { title: "Interagency Coordinator", unit: "PATH / Louisiana Project Delivery Office", organizationId: "LA-PROJECTS", organizationName: "Louisiana Governor's Office of Major Projects & Delivery (demo)", projectRole: "State concierge and project manager", visible: true },
  "aris.thorne@demo.permit.local": { title: "Civil / Coastal Engineering Lead", unit: "Coastal Hydrology Practice", organizationId: "COASTAL_ENGINEERING", organizationName: "Gulf Coast Engineering Partners (demo)", projectRole: "Consultant representing SpaceX", visible: true },
  "elon.musk@demo.permit.local": { title: "SpaceX Executive / Project Sponsor", unit: "SpaceX Project Delivery", organizationId: "SPACEX", organizationName: "Space Exploration Technologies Corp. (SpaceX) (demo)", projectRole: "Applicant executive observer", visible: true },
  "gwynne.shotwell@demo.permit.local": { title: "SpaceX President / Operational Executive", unit: "SpaceX Project Delivery", organizationId: "SPACEX", organizationName: "Space Exploration Technologies Corp. (SpaceX) (demo)", projectRole: "Applicant executive", visible: true },
  "bill.gerstenmaier@demo.permit.local": { title: "SpaceX Build and Flight Reliability Executive", unit: "SpaceX Civil and Site Development", organizationId: "SPACEX", organizationName: "Space Exploration Technologies Corp. (SpaceX) (demo)", projectRole: "Applicant technical executive", visible: true },
  "jeff.landry@demo.permit.local": { title: "Louisiana Governor / Executive Sponsor", unit: "Governor's Executive Review", organizationId: "LA-PROJECTS", organizationName: "Governor's Executive Review (demo)", projectRole: "Executive observer / sponsor", visible: true },
  "susan.bourgeois@demo.permit.local": { title: "Louisiana Economic Development Secretary", unit: "Louisiana Economic Development Space Coordination", organizationId: "LED", organizationName: "Louisiana Economic Development (demo)", projectRole: "Executive coordinator", visible: true },
};
for (const user of authUsers) {
  const profile = profileByEmail[user.email];
  if (!profile) continue;
  await one(supabase.from("user_profiles").upsert({ id: `profile-${user.email.split("@")[0].replaceAll(".", "-")}`, user_id: user.id, full_name: user.name, organization_id: profile.organizationId, organization_name: profile.organizationName, display_title: profile.title, organizational_unit: profile.unit, work_email: user.email, project_role: profile.projectRole, is_customer_visible: profile.visible, is_active: true }, { onConflict: "user_id" }), `portal profile ${user.email}`);
}

const userByEmail = Object.fromEntries(authUsers.map((user) => [user.email, user]));
const participantSpecs = [
  ["participant-alex", "alex.martin@demo.permit.local", "SPACEX", "lead", "customer", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-UTILITY-INTERCONNECT"], [], [], ["customer_updates"]],
  ["participant-maya", "maya.chen@demo.permit.local", "SPACEX", "reviewing", "customer", ["WS-WETLANDS-PAD-A", "WS-LA82-HEAVYHAUL", "WS-AIRSPACE-MARITIME"], [], ["customer_submissions"], ["rfis", "escalations"]],
  ["participant-jordan", "jordan.lee@demo.permit.local", "LDEQ", "reviewing", "project", ["WS-WETLANDS-PAD-A", "WS-WASTEWATER-DELUGE"], ["TASK-T003"], ["environmental_permits"], ["rfis", "document_reviews"]],
  ["participant-sam", "sam.rivera@demo.permit.local", "DOTD", "reviewing", "project", ["WS-LA82-HEAVYHAUL", "WS-SUBSTATION-230KV"], ["TASK-T001", "TASK-T002"], ["transportation_permits"], ["coordination_requests"]],
  ["participant-riley", "riley.brooks@demo.permit.local", "VERMILION", "consulting", "customer", ["WS-COMMUNITY-WATER", "WS-AIRSPACE-MARITIME"], [], ["public_hearings"], ["meetings", "public_notices"]],
  ["participant-sarah", "sarah.johnson@demo.permit.local", "LA-PROJECTS", "coordinating", "project", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-COMMUNITY-WATER"], [], ["cross_agency_triage"], ["all_project_exceptions"]],
  ["participant-joe", "joe.skaggs@demo.permit.local", "LED", "lead", "admin", [], [], ["administration", "escalations"], ["escalation_queue"]],
  ["participant-aris", "aris.thorne@demo.permit.local", "COASTAL_ENGINEERING", "consulting", "customer", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A"], [], ["technical_submissions"], ["document_requests"]],
  ["participant-elon", "elon.musk@demo.permit.local", "SPACEX", "notified", "customer", ["WS-LA82-HEAVYHAUL", "WS-AIR-TITLE-V"], [], ["executive_observer"], ["critical_path_notifications"]],
  ["participant-gwynne", "gwynne.shotwell@demo.permit.local", "SPACEX", "lead", "customer", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-UTILITY-INTERCONNECT"], [], ["executive_operations"], ["executive_updates"]],
  ["participant-bill", "bill.gerstenmaier@demo.permit.local", "SPACEX", "consulting", "customer", ["WS-LA82-HEAVYHAUL", "WS-SUBSTATION-230KV"], [], ["technical_executive_review"], ["reliability_updates"]],
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

const sarah = userByEmail["sarah.johnson@la.gov"];
const maya = userByEmail["maya.chen@spacex.com"];
const filings = [
  { id: "filing-usace-404-pecan", workstream_id: "WS-WETLANDS-PAD-A", permit_type_id: "cat-usace-404", authority_organization_id: orgByCode.USACE, authority_organization_name: "U.S. Army Corps of Engineers - New Orleans District", external_reference_number: "USACE-TEST-PECAN-404", external_record_url: "https://crms.usace.army.mil", external_status: "under_review", submitted_at: "2026-08-22T14:00:00Z", submitted_by_user_id: maya.id, last_status_verified_at: "2026-08-29T16:30:00Z", last_status_verified_by: sarah.id, authoritative_system_name: "USACE Regulatory Request System", official_portal_url: "https://crms.usace.army.mil", notes: "Manually updated from the agency record. PATH does not synchronize this filing." },
  { id: "filing-cpra-cup-pecan", workstream_id: "WS-WETLANDS-PAD-A", permit_type_id: "cat-cpra-cup", authority_organization_id: orgByCode.CPRA, authority_organization_name: "Coastal Protection and Restoration Authority", external_reference_number: "P20240182", external_status: "submitted", submitted_at: "2026-08-24T12:00:00Z", submitted_by_user_id: maya.id, last_status_verified_at: "2026-08-28T10:15:00Z", last_status_verified_by: sarah.id, authoritative_system_name: "SONRIS CPRA", official_portal_url: "https://sonris-cpra.dnr.state.la.us/cup-portal", notes: "Customer-provided reference; agency portal remains authoritative." },
];
for (const filing of filings) {
  await one(supabase.from("external_filings").upsert({ ...filing, project_id: project.id.toString(), filing_method: "EXTERNAL_PORTAL", receipt_document_version_ids: [] }, { onConflict: "id" }), `filing ${filing.id}`);
}

const submitter = authUsers.find((u) => u.role === "customer");
for (const [title, category, priority, status, stage, currentDay, totalDays] of requests) {
  const existing = await one(supabase.from("requests").select("id").eq("title", title).maybeSingle(), `find ${title}`);
  const payload = { project_id: project.id, submitter_id: submitter.id, owning_organization_id: orgByCode.SPACEPORT, request_type: category, category, title, description: `Illustrative SpaceX Louisiana program request for ${title.toLowerCase()}.`, status, current_stage: stage, priority: priority.toLowerCase(), applicant_name: "SpaceX Louisiana Program", organization_name: "Space Exploration Technologies Corp.", status_label: status === "action_required" ? "Action required" : status === "on_hold" ? "On hold" : status === "submitted" ? "Submitted" : "In review", current_day: currentDay, total_days: totalDays, submitted_at: new Date(Date.now() - 60 * 86400000).toISOString(), due_date: new Date(Date.now() + (totalDays - currentDay) * 86400000).toISOString().slice(0, 10), next_action: status === "action_required" ? "Upload the updated drainage and traffic-control plan." : "Monitor technical review milestones." };
  if (existing) await one(supabase.from("requests").update(payload).eq("id", existing.id), `update ${title}`);
  else await one(supabase.from("requests").insert(payload), `insert ${title}`);
}

console.log(JSON.stringify({ users: authUsers.map(({ email, role }) => ({ email, role })), participants: participantSpecs.length, externalFilings: filings.length, requests: requests.length, project: project.id }));
