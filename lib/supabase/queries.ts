import { getSupabaseBrowser } from "./client";
import {
  auditEventRowToDomain, commitmentRowToDomain, coordinationRequestRowToDomain,
  customerRequestRowToDomain, decisionRowToDomain, documentAgencyReviewRowToDomain,
  documentRowToDomain, documentVersionRowToDomain, externalFilingRowToDomain,
  meetingRowToDomain, notificationRowToDomain, organizationRowToDomain, permitTypeRowToDomain, workflowStageRowToDomain,
  projectParticipantRowToDomain, requirementResourceRowToDomain, rfiResponseRowToDomain,
  rfiRowToDomain, taskRowToDomain, userProfileRowToDomain, workstreamRowToDomain, organizationMembershipRowToDomain,
} from "./mappings";
import type {
  AuditEventRecord, CommitmentRecord, CoordinationRequestRecord, CustomerRequestRecord,
  DecisionRecord, DocumentRecord, ExternalFilingRecord, MeetingRecord, NotificationRecord,
  OrganizationRecord, PermitTypeRecord, ProjectParticipantRecord, ProjectRecord, RFIRecord, UserProfileRecord,
  WorkstreamRecord, WorkflowTemplateRecord, OrganizationMembershipRecord,
} from "../domain-models";
import { legacyProjectReferences } from "../project-identifiers";

type QueryClient = NonNullable<ReturnType<typeof getSupabaseBrowser>>;
type ProjectScope = { id: string; number: string; keys: string[] };

async function resolveProjectScope(client: QueryClient, projectId: string): Promise<ProjectScope | null> {
  const lookup = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)
    ? client.from("projects").select("id, number").eq("id", projectId).maybeSingle()
    : client.from("projects").select("id, number").eq("number", projectId).maybeSingle();
  const { data } = await lookup;
  if (!data) return null;
  const id = String(data.id);
  const number = String(data.number ?? projectId);
  return { id, number, keys: Array.from(new Set([id, number, projectId, ...legacyProjectReferences(number)])) };
}

function noClient<T>(): T[] { return []; }

export async function fetchWorkstreams(projectId: string): Promise<WorkstreamRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return noClient();
  const wsRes = await client.from("workstreams").select("*").eq("project_id", scope.id).order("code", { ascending: true });
  if (wsRes.error || !wsRes.data) return noClient();
  const workstreamIds = wsRes.data.map((row) => String(row.id));
  const taskRes = workstreamIds.length
    ? await client.from("tasks").select("*").in("workstream_id", workstreamIds).order("task_code", { ascending: true })
    : { data: [], error: null };
  const tasks = (taskRes.data ?? []).map(taskRowToDomain);
  return wsRes.data.map((row) => {
    const ws = workstreamRowToDomain(row);
    ws.tasks = tasks.filter((task) => task.workstreamId === ws.id || task.workstreamId === ws.code);
    return ws;
  });
}

export async function fetchCustomerRequests(projectId: string): Promise<CustomerRequestRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return noClient();
  const { data, error } = await client.from("customer_requests").select("*").in("project_id", scope.keys).order("created_at", { ascending: false });
  return error || !data ? noClient() : data.map(customerRequestRowToDomain);
}

export async function fetchExternalFilings(projectId: string): Promise<ExternalFilingRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return noClient();
  const { data, error } = await client.from("external_filings").select("*").in("project_id", scope.keys).order("created_at", { ascending: false });
  return error || !data ? noClient() : data.map(externalFilingRowToDomain);
}

async function workstreamIdsForProject(client: QueryClient, projectId: string): Promise<string[]> {
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const { data } = await client.from("workstreams").select("id").eq("project_id", scope.id);
  return (data ?? []).map((row) => String(row.id));
}

export async function fetchRFIs(projectId: string): Promise<RFIRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const ids = await workstreamIdsForProject(client, projectId);
  if (!ids.length) return noClient();
  const [rfiRes, respRes] = await Promise.all([
    client.from("rfis").select("*").in("workstream_id", ids).order("created_at", { ascending: false }),
    client.from("rfi_responses").select("*").order("submitted_date", { ascending: true }),
  ]);
  if (rfiRes.error || !rfiRes.data) return noClient();
  const responses = (respRes.data ?? []).map(rfiResponseRowToDomain);
  return rfiRes.data.map((row) => rfiRowToDomain(row, responses.filter((response) => response.rfiId === row.id || response.rfiId === row.code)));
}

export async function fetchCoordinationRequests(projectId: string): Promise<CoordinationRequestRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const ids = await workstreamIdsForProject(client, projectId);
  if (!ids.length) return noClient();
  const { data, error } = await client.from("coordination_requests").select("*").in("workstream_id", ids).order("created_at", { ascending: false });
  return error || !data ? noClient() : data.map(coordinationRequestRowToDomain);
}

export async function fetchCommitments(projectId: string): Promise<CommitmentRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const ids = await workstreamIdsForProject(client, projectId);
  if (!ids.length) return noClient();
  const { data, error } = await client.from("commitments").select("*").in("workstream_id", ids).order("created_at", { ascending: false });
  return error || !data ? noClient() : data.map(commitmentRowToDomain);
}

export async function fetchDecisions(projectId: string): Promise<DecisionRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return noClient();
  const { data, error } = await client.from("decisions").select("*").eq("project_id", scope.id).order("decision_date", { ascending: false });
  return error || !data ? noClient() : data.map(decisionRowToDomain);
}

export async function fetchMeetings(projectId: string): Promise<MeetingRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return noClient();
  const { data, error } = await client.from("meetings").select("*").eq("project_id", scope.id).order("meeting_date", { ascending: false });
  return error || !data ? noClient() : data.map(meetingRowToDomain);
}

export async function fetchDocuments(projectId: string): Promise<DocumentRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return noClient();
  const { data: documents, error } = await client.from("documents").select("*").eq("project_id", scope.id).order("created_at", { ascending: false });
  if (error || !documents) return noClient();
  const documentIds = documents.map((row) => String(row.id));
  const [versionRes, reviewRes] = await Promise.all([
    documentIds.length ? client.from("document_versions").select("*").in("document_id", documentIds).order("version_number", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    documentIds.length ? client.from("document_agency_reviews").select("*").order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  const reviews = (reviewRes.data ?? []).map(documentAgencyReviewRowToDomain);
  const versions = (versionRes.data ?? []).map((row) => documentVersionRowToDomain(row, reviews.filter((review) => review.documentVersionId === row.id)));
  return documents.map((row) => {
    const docVersions = versions.filter((version) => version.documentId === row.id || version.documentId === row.document_ref_id).sort((left, right) => (right.versionNumber ?? 0) - (left.versionNumber ?? 0));
    const docReviews = reviews.filter((review) => docVersions.some((version) => version.id === review.documentVersionId));
    return documentRowToDomain(row, docVersions, docReviews);
  });
}

export async function fetchUserProfiles(): Promise<UserProfileRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const { data, error } = await client.from("user_profiles").select("*").order("full_name", { ascending: true });
  return error || !data ? noClient() : data.map(userProfileRowToDomain);
}

export async function fetchOrganizationMemberships(): Promise<OrganizationMembershipRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const { data, error } = await client.from("organization_memberships").select("id, user_id, organization_id, role, status, effective_from, effective_to").order("created_at", { ascending: true });
  return error || !data ? noClient() : data.map((row) => organizationMembershipRowToDomain(row));
}

export async function fetchProjectParticipants(projectId: string): Promise<ProjectParticipantRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return noClient();
  const { data, error } = await client.from("project_participants").select("*").eq("project_id", scope.id).order("created_at", { ascending: true });
  return error || !data ? noClient() : data.map(projectParticipantRowToDomain);
}

export async function fetchNotifications(userId?: string): Promise<NotificationRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const resolvedUserId = userId ?? (await client.auth.getUser()).data.user?.id;
  if (!resolvedUserId) return noClient();
  const email = (await client.auth.getUser()).data.user?.email;
  const targets = [resolvedUserId, email].filter(Boolean).join(",");
  const { data, error } = await client.from("notifications").select("*").or(`user_id.in.(${targets}),recipient_id.eq.${resolvedUserId}`).order("created_at", { ascending: false }).limit(50);
  return error || !data ? noClient() : data.map(notificationRowToDomain);
}

export async function fetchAuditEvents(projectId?: string): Promise<AuditEventRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  let query = client.from("audit_events").select("*").order("created_at", { ascending: false }).limit(100);
  if (projectId) {
    const scope = await resolveProjectScope(client, projectId);
    if (!scope) return noClient();
    query = query.in("project_id", scope.keys);
  }
  const { data, error } = await query;
  return error || !data ? noClient() : data.map(auditEventRowToDomain);
}

export async function fetchCatalog(): Promise<PermitTypeRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const [permitRes, resourceRes] = await Promise.all([
    client.from("permit_types").select("*").order("code", { ascending: true }),
    client.from("requirement_resources").select("*").order("resource_name", { ascending: true }),
  ]);
  if (permitRes.error || !permitRes.data) return noClient();
  const resources = (resourceRes.data ?? []).map(requirementResourceRowToDomain);
  return permitRes.data.map((row) => permitTypeRowToDomain(row, resources.filter((resource) => resource.permitTypeId === row.id)));
}

export async function fetchOrganizations(): Promise<OrganizationRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const { data, error } = await client.from("organizations").select("*").eq("active", true).order("code", { ascending: true });
  return error || !data ? noClient() : data.map(organizationRowToDomain);
}

export async function fetchWorkflowTemplates(): Promise<WorkflowTemplateRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient();
  const [definitionsRes, versionsRes, stagesRes] = await Promise.all([
    client.from("workflow_definitions").select("*").order("case_type", { ascending: true }),
    client.from("workflow_versions").select("*").order("version_number", { ascending: false }),
    client.from("workflow_version_stages").select("*").order("sequence_order", { ascending: true }),
  ]);
  if (definitionsRes.error || versionsRes.error || stagesRes.error || !definitionsRes.data || !versionsRes.data || !stagesRes.data) return noClient();
  return definitionsRes.data.map((definition) => {
    const definitionId = String(definition.id);
    const versions = versionsRes.data
      .filter((version) => String(version.workflow_id) === definitionId)
      .map((version) => {
        const versionId = String(version.id);
        return {
          id: versionId,
          templateId: definitionId,
          versionNumber: Number(version.version_number ?? 1),
          status: (String(version.lifecycle_status ?? (version.is_active ? "published" : "retired"))) as "draft" | "published" | "retired",
          effectiveDate: version.effective_date ? String(version.effective_date) : undefined,
          publishedAt: version.published_at ? String(version.published_at) : undefined,
          changeSummary: version.change_summary ? String(version.change_summary) : undefined,
          stages: stagesRes.data.filter((stage) => String(stage.workflow_version_id) === versionId).map(workflowStageRowToDomain),
        };
      });
    const activeVersion = versions.find((version) => version.status === "published") ?? versions[0];
    return {
      id: definitionId,
      permitTypeId: String(definition.case_type ?? definitionId),
      name: String(definition.name ?? definition.case_type ?? "Workflow"),
      description: definition.description ? String(definition.description) : undefined,
      activeVersionNumber: activeVersion?.versionNumber ?? 1,
      versions,
    };
  });
}

export async function fetchFullProjectState(projectId = "PRJ-PECAN-2026"): Promise<Partial<ProjectRecord>> {
  const [workstreams, customerRequests, externalFilings, rfis, coordinationRequests, commitments, decisions, meetings, documents, participants, auditLedger] = await Promise.all([
    fetchWorkstreams(projectId), fetchCustomerRequests(projectId), fetchExternalFilings(projectId), fetchRFIs(projectId),
    fetchCoordinationRequests(projectId), fetchCommitments(projectId), fetchDecisions(projectId), fetchMeetings(projectId),
    fetchDocuments(projectId), fetchProjectParticipants(projectId), fetchAuditEvents(projectId),
  ]);
  return { workstreams, customerRequests, externalFilings, coordinationRequests, commitments, decisions, meetings, documents, auditLedger, participants };
}
