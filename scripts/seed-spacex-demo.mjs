import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const users = [
  { email: "alex.martin@spacex.test", password: "SpaceX-MVP-2026!", name: "Alex Martin", role: "customer" },
  { email: "maya.chen@spacex.test", password: "SpaceX-MVP-2026!", name: "Maya Chen", role: "program" },
  { email: "jordan.lee@spacex.test", password: "SpaceX-MVP-2026!", name: "Jordan Lee", role: "environment" },
  { email: "sam.rivera@spacex.test", password: "SpaceX-MVP-2026!", name: "Sam Rivera", role: "infrastructure" },
  { email: "riley.brooks@spacex.test", password: "SpaceX-MVP-2026!", name: "Riley Brooks", role: "community" },
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

const authUsers = [];
for (const spec of users) {
  const listed = await one(supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }), "list users");
  let user = listed.users.find((candidate) => candidate.email?.toLowerCase() === spec.email);
  if (!user) user = (await one(supabase.auth.admin.createUser({ email: spec.email, password: spec.password, email_confirm: true, user_metadata: { full_name: spec.name } }), `create ${spec.email}`)).user;
  authUsers.push({ ...spec, id: user.id });
  await one(supabase.from("profiles").upsert({ id: user.id, email: spec.email, full_name: spec.name, customer_organization_id: spec.role === "customer" ? customer.id : null, status: "active" }), `profile ${spec.email}`);
  if (spec.role !== "customer") await one(supabase.from("organization_memberships").upsert({ user_id: user.id, organization_id: orgByCode[spec.role.toUpperCase()] ?? orgByCode.SPACEPORT, role: spec.role === "program" ? "supervisor" : "contributor", status: "active" }, { onConflict: "user_id,organization_id" }), `membership ${spec.email}`);
}

const submitter = authUsers.find((u) => u.role === "customer");
for (const [title, category, priority, status, stage, currentDay, totalDays] of requests) {
  const existing = await one(supabase.from("requests").select("id").eq("title", title).maybeSingle(), `find ${title}`);
  const payload = { project_id: project.id, submitter_id: submitter.id, owning_organization_id: orgByCode.SPACEPORT, request_type: category, category, title, description: `Illustrative SpaceX Louisiana program request for ${title.toLowerCase()}.`, status, current_stage: stage, priority: priority.toLowerCase(), applicant_name: "SpaceX Louisiana Program", organization_name: "Space Exploration Technologies Corp.", status_label: status === "action_required" ? "Action required" : status === "on_hold" ? "On hold" : status === "submitted" ? "Submitted" : "In review", current_day: currentDay, total_days: totalDays, submitted_at: new Date(Date.now() - 60 * 86400000).toISOString(), due_date: new Date(Date.now() + (totalDays - currentDay) * 86400000).toISOString().slice(0, 10), next_action: status === "action_required" ? "Upload the updated drainage and traffic-control plan." : "Monitor technical review milestones." };
  if (existing) await one(supabase.from("requests").update(payload).eq("id", existing.id), `update ${title}`);
  else await one(supabase.from("requests").insert(payload), `insert ${title}`);
}

console.log(JSON.stringify({ users: authUsers.map(({ email, role }) => ({ email, role })), requests: requests.length, project: project.id }));
