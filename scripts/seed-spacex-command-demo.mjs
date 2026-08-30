/**
 * Deterministic development-only seed for the real PATH command schema.
 * It intentionally requires an explicit opt-in and a service key; migrations
 * never create demo users or data in a production environment.
 */
import { createClient } from "@supabase/supabase-js";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

if (process.env.PATH_ALLOW_DEMO_SEED !== "true" || process.env.NODE_ENV === "production") {
  throw new Error("Refusing demo seed. Set PATH_ALLOW_DEMO_SEED=true outside production.");
}
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true } });
const fixture = await vite.ssrLoadModule("/lib/spacex-megaproject-fixture.ts");
const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const one = async (query, label) => { const { data, error } = await query; if (error) throw new Error(`${label}: ${error.message}`); return data; };

try {
  const { registeredOrganizations, spacexProjectRecord, workstreamsData, commitmentsData, coordinationRequestsData, rfisData, projectDocumentsData, projectDecisionsData, projectMeetingsData } = fixture;
  await one(db.from("organizations").upsert(registeredOrganizations.map(o => ({ code: o.code, name: o.name, jurisdiction_level: o.jurisdictionLevel === "Applicant" ? "external_partner" : o.jurisdictionLevel === "Federal" ? "federal" : o.jurisdictionLevel === "Local / Parish" ? "local" : "state", active: true })), { onConflict: "code" }), "organizations");
  const orgRows = await one(db.from("organizations").select("id,code"), "organization lookup");
  const orgId = Object.fromEntries(orgRows.map(row => [row.code, row.id]));
  const customer = await one(db.from("customer_organizations").upsert({ name: "SpaceX Louisiana", legal_name: "Space Exploration Technologies Corp. — Louisiana Program" }, { onConflict: "name" }).select("id").single(), "customer organization");
  const project = await one(db.from("projects").upsert({ number: spacexProjectRecord.code, name: spacexProjectRecord.name, customer_organization_id: customer.id, lead_organization_id: orgId["LA-PROJECTS"], status: "active", risk: "at_risk", baseline_launch_date: spacexProjectRecord.baselineLaunchDate, forecast_launch_date: spacexProjectRecord.currentForecastLaunchDate }, { onConflict: "number" }).select("id").single(), "project");
  await one(db.from("project_participants").upsert(registeredOrganizations.map(o => ({ project_id: project.id, organization_id: orgId[o.code], participation_role: o.code === "LA-PROJECTS" ? "lead" : "reviewing", access_scope: "project" })), { onConflict: "project_id,organization_id" }), "project participants");
  const workstreamRows = workstreamsData.map(ws => ({ project_id: project.id, code: ws.code, title: ws.title, lead_organization_id: orgId[ws.regulatoryLead.orgCode], state: ws.operationalState, current_action: ws.currentActionSummary, waiting_on_type: "other", waiting_reason: ws.waitingReason || ws.currentActionSummary, next_action_due_at: `${ws.forecastTargetDate}T00:00:00Z`, missed_date_consequence: ws.delayNotes || "Escalation under project delivery policy.", baseline_target_date: ws.baselineTargetDate, forecast_target_date: ws.forecastTargetDate, actual_completion_date: ws.actualCompletionDate || null, is_critical_path: ws.isCriticalPath }));
  await one(db.from("workstreams").upsert(workstreamRows, { onConflict: "project_id,code" }), "workstreams");
  const persistedWorkstreams = await one(db.from("workstreams").select("id,code").eq("project_id", project.id), "workstream lookup");
  const wsId = Object.fromEntries(persistedWorkstreams.map(row => [row.code, row.id]));
  const tasks = workstreamsData.flatMap(ws => (ws.tasks || []).map(task => ({ workstream_id: wsId[ws.code], title: task.title, assigned_organization_id: orgId[task.assignedOrgCode], status: task.status, baseline_start_date: task.baselineStartDate || null, baseline_due_date: task.baselineDueDate || null, forecast_start_date: task.forecastStartDate || null, forecast_due_date: task.forecastDueDate || null, actual_completion_date: task.actualCompletionDate || null, duration_days: task.durationDays || 1 })));
  await one(db.from("tasks").upsert(tasks, { onConflict: "workstream_id,title" }), "tasks");
  await one(db.from("commitments").upsert(commitmentsData.map(c => ({ workstream_id: wsId[c.workstreamId], organization_id: orgId[c.committingOrgCode], action: c.committedAction, origin_context: c.originContext, promised_date: c.committedDate, due_date: c.promisedDueDate, status: c.status, impact_if_missed: c.impactIfMissed, critical_path_impact: c.isCriticalPathImpact })), { onConflict: "id" }), "commitments");
  await one(db.from("coordination_requests").upsert(coordinationRequestsData.map(c => ({ code: c.code, workstream_id: wsId[c.workstreamId], requesting_organization_id: orgId[c.requestingOrgCode], target_organization_id: orgId[c.targetOrgCode], title: c.title, need_description: c.needDescription, due_date: c.dueDate, response_summary: c.responseSummary || null, status: c.status, priority: c.priority })), { onConflict: "code" }), "coordination requests");
  await one(db.from("rfis").upsert(rfisData.map(r => ({ code: r.code, workstream_id: wsId[r.workstreamId], requesting_organization_id: orgId[r.requestingOrgCode], recipient_organization_id: orgId[r.recipientOrgCode], title: r.title, status: r.status === "staged_draft" ? "staged" : r.status === "partially_answered" ? "partial_response" : r.status === "submitted_by_applicant" ? "submitted" : r.status, clock_impact: r.clockImpact === "clock_paused" ? "pause" : r.clockImpact === "clock_extended" ? "extend" : "run", due_date: r.responseDeadline })), { onConflict: "code" }), "rfis");
  for (const doc of projectDocumentsData) {
    const persisted = await one(db.from("documents").upsert({ external_seed_key: doc.id, project_id: project.id, owner_organization_id: orgId[doc.ownerOrgCode], title: doc.title, classification: doc.isConfidential ? "restricted" : "participant", retention_category: "project-record" }, { onConflict: "external_seed_key" }).select("id").single(), `document ${doc.title}`);
    await one(db.from("document_versions").upsert(doc.versions.map((version, index) => ({ document_id: persisted.id, version_number: index + 1, file_name: version.fileName, mime_type: version.mimeType, file_size_bytes: version.fileSizeBytes, storage_path: version.storageUri, sha256: version.sha256Hash, scan_status: version.isMalwareClean ? "clean" : "pending" })), { onConflict: "storage_path" }), `document versions ${doc.title}`);
  }
  await one(db.from("decisions").upsert(projectDecisionsData.map(d => ({ external_seed_key: d.id, project_id: project.id, title: d.title, decision: d.decisionSummary, authority: d.statutoryAuthority, decided_at: `${d.decisionDate}T12:00:00Z` })), { onConflict: "external_seed_key" }), "decisions");
  await one(db.from("meetings").upsert(projectMeetingsData.map(m => ({ external_seed_key: m.id, project_id: project.id, title: m.title, occurred_at: `${m.meetingDate}T12:00:00Z`, notes: m.meetingNotes })), { onConflict: "external_seed_key" }), "meetings");
  console.log(JSON.stringify({ project: spacexProjectRecord.code, organizations: registeredOrganizations.length, workstreams: workstreamsData.length, commitments: commitmentsData.length, coordinationRequests: coordinationRequestsData.length, rfis: rfisData.length }));
} finally { await vite.close(); }
