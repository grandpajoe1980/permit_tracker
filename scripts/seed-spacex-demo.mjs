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
  { email: "alex.martin@spacex.com", password: "SpaceX-MVP-2026!", name: "Alex Martin", role: "customer" },
  { email: "maya.chen@spacex.com", password: "SpaceX-MVP-2026!", name: "Maya Chen", role: "program" },
  { email: "jordan.lee@la.gov", password: "SpaceX-MVP-2026!", name: "Jordan Lee", role: "environment" },
  { email: "sam.rivera@la.gov", password: "SpaceX-MVP-2026!", name: "Sam Rivera", role: "infrastructure" },
  { email: "riley.brooks@vermilionparish.org", password: "SpaceX-MVP-2026!", name: "Riley Brooks", role: "community" },
  { email: "joe.skaggs@la.gov", password: "PATH-MVP-2026!", name: "Joe Skaggs", role: "admin" },
  { email: "sarah.johnson@la.gov", password: "PATH-MVP-2026!", name: "Sarah Johnson", role: "state_office" },
  { email: "aris.thorne@gulfcoast-engineering.example", password: "SpaceX-MVP-2026!", name: "Dr. Aris Thorne", role: "consultant" },
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
const orgs = await one(supabase.from("organizations").select("id,code"), "organizations");
const orgByCode = Object.fromEntries(orgs.map((o) => [o.code, o.id]));
const membershipOrgByRole = { program: "SPACEPORT", environment: "LDEQ", infrastructure: "DOTD", community: "VERMILION", admin: "LED", state_office: "STATEPO", consultant: "COASTAL_ENGINEERING" };
const membershipRoleByUserRole = { program: "supervisor", admin: "system_admin", state_office: "supervisor", environment: "contributor", infrastructure: "contributor", community: "contributor", consultant: "contributor" };

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
  "alex.martin@spacex.com": { title: "SpaceX Project Manager", unit: "Louisiana Launch Site Delivery", organizationId: "SPACEX", organizationName: "Space Exploration Technologies Corp. (SpaceX)", projectRole: "Customer project lead", visible: true },
  "maya.chen@spacex.com": { title: "SpaceX Regulatory Affairs Manager", unit: "Regulatory Affairs & Permitting", organizationId: "SPACEX", organizationName: "Space Exploration Technologies Corp. (SpaceX)", projectRole: "Customer regulatory lead", visible: true },
  "jordan.lee@la.gov": { title: "Environmental Scientist 1", unit: "Office of Environmental Services / Water Quality Permits", organizationId: "LDEQ", organizationName: "Louisiana Department of Environmental Quality", projectRole: "Environmental review lead", visible: true },
  "sam.rivera@la.gov": { title: "Civil Engineer 4", unit: "District 03 / Aviation and Bridge Design", organizationId: "DOTD", organizationName: "Louisiana Department of Transportation and Development", projectRole: "Transportation and infrastructure lead", visible: true },
  "riley.brooks@vermilionparish.org": { title: "Intergovernmental Affairs Coordinator", unit: "Parish Administration / Community Relations", organizationId: "VERMILION", organizationName: "Vermilion Parish Police Jury", projectRole: "Parish and community liaison", visible: true },
  "joe.skaggs@la.gov": { title: "Space Czar", unit: "PATH / Louisiana Project Delivery Administration", organizationId: "LED", organizationName: "Louisiana Economic Development (LED)", projectRole: "PATH administrator", visible: false },
  "sarah.johnson@la.gov": { title: "State Project Manager", unit: "PATH / Louisiana Project Delivery Office", organizationId: "STATEPO", organizationName: "Louisiana Governor's Office of Major Projects & Delivery", projectRole: "State concierge and project manager", visible: true },
  "aris.thorne@gulfcoast-engineering.example": { title: "Civil / Coastal Engineering Lead", unit: "Coastal Hydrology Practice", organizationId: "COASTAL_ENGINEERING", organizationName: "Gulf Coast Engineering Partners", projectRole: "Consultant representing SpaceX", visible: true },
};
for (const user of authUsers) {
  const profile = profileByEmail[user.email];
  if (!profile) continue;
  await one(supabase.from("user_profiles").upsert({ id: `profile-${user.email.split("@")[0].replaceAll(".", "-")}`, user_id: user.id, full_name: user.name, organization_id: profile.organizationId, organization_name: profile.organizationName, display_title: profile.title, organizational_unit: profile.unit, work_email: user.email, project_role: profile.projectRole, is_customer_visible: profile.visible, is_active: true }, { onConflict: "user_id" }), `portal profile ${user.email}`);
}

const userByEmail = Object.fromEntries(authUsers.map((user) => [user.email, user]));
const participantSpecs = [
  ["participant-alex", "alex.martin@spacex.com", "SPACEX", "lead", "customer", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-UTILITY-INTERCONNECT"], [], [], ["customer_updates"]],
  ["participant-maya", "maya.chen@spacex.com", "SPACEX", "reviewing", "customer", ["WS-WETLANDS-PAD-A", "WS-LA82-HEAVYHAUL", "WS-AIRSPACE-MARITIME"], [], ["customer_submissions"], ["rfis", "escalations"]],
  ["participant-jordan", "jordan.lee@la.gov", "LDEQ", "reviewing", "project", ["WS-WETLANDS-PAD-A", "WS-WASTEWATER-DELUGE"], ["TASK-T003"], ["environmental_permits"], ["rfis", "document_reviews"]],
  ["participant-sam", "sam.rivera@la.gov", "DOTD", "reviewing", "project", ["WS-LA82-HEAVYHAUL", "WS-SUBSTATION-230KV"], ["TASK-T001", "TASK-T002"], ["transportation_permits"], ["coordination_requests"]],
  ["participant-riley", "riley.brooks@vermilionparish.org", "VERMILION", "consulting", "customer", ["WS-COMMUNITY-WATER", "WS-AIRSPACE-MARITIME"], [], ["public_hearings"], ["meetings", "public_notices"]],
  ["participant-sarah", "sarah.johnson@la.gov", "STATEPO", "coordinating", "project", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-COMMUNITY-WATER"], [], ["cross_agency_triage"], ["all_project_exceptions"]],
  ["participant-joe", "joe.skaggs@la.gov", "LED", "lead", "admin", [], [], ["administration", "escalations"], ["escalation_queue"]],
  ["participant-aris", "aris.thorne@gulfcoast-engineering.example", "COASTAL_ENGINEERING", "consulting", "customer", ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A"], [], ["technical_submissions"], ["document_requests"]],
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
