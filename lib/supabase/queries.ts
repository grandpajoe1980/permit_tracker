import { getSupabaseBrowser } from "./client";
import {
  assignmentGroupMembershipRowToDomain,
  assignmentGroupRowToDomain,
  auditEventRowToDomain, commitmentRowToDomain, coordinationRequestRowToDomain,
  customerRequestRowToDomain, decisionRowToDomain, documentAgencyReviewRowToDomain,
  documentRowToDomain, documentVersionRowToDomain, externalFilingRowToDomain,
  meetingRowToDomain, notificationRowToDomain, organizationRowToDomain, permitTypeRowToDomain, workflowStageRowToDomain,
  projectParticipantRowToDomain, requirementResourceRowToDomain, rfiResponseRowToDomain,
  rfiRowToDomain, taskRowToDomain, userProfileRowToDomain, workstreamRowToDomain, organizationMembershipRowToDomain,
} from "./mappings";
import type {
  AssignmentGroupRecord,
  AssignmentGroupMembershipRecord,
  AuditEventRecord, CommitmentRecord, CoordinationRequestRecord, CustomerRequestRecord,
  DecisionRecord, DocumentRecord, ExternalFilingRecord, MeetingRecord, NotificationRecord,
  OrganizationRecord, PermitTypeRecord, ProjectParticipantRecord, ProjectRecord, RFIRecord, UserProfileRecord,
  WorkstreamRecord, WorkflowTemplateRecord, OrganizationMembershipRecord,
} from "../domain-models";
import { legacyProjectReferences } from "../project-identifiers";

type QueryClient = NonNullable<ReturnType<typeof getSupabaseBrowser>>;
type ProjectScope = { id: string; number: string; keys: string[] };

export type QueryDiagnostic = {
  operation: string;
  message: string;
};

let queryDiagnostics: QueryDiagnostic[] = [];

export function beginQueryDiagnostics(): void {
  queryDiagnostics = [];
}

export function takeQueryDiagnostics(): QueryDiagnostic[] {
  const diagnostics = queryDiagnostics;
  queryDiagnostics = [];
  return diagnostics;
}

function recordQueryFailure(operation: string, error: unknown): void {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object"
      ? (() => {
          const errorRecord = error as Record<string, unknown>;
          return [errorRecord.message, errorRecord.details, errorRecord.hint, errorRecord.code]
            .filter((value): value is string => typeof value === "string" && value.length > 0)
            .join(" | ") || "Unknown Supabase error";
        })()
      : String(error ?? "Unknown Supabase error");
  queryDiagnostics.push({ operation, message });
}

async function resolveProjectScope(client: QueryClient, projectId: string): Promise<ProjectScope | null> {
  const lookup = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId)
    ? client.from("projects").select("id, number").eq("id", projectId).maybeSingle()
    : client.from("projects").select("id, number").eq("number", projectId).maybeSingle();
  const { data, error } = await lookup;
  if (error) recordQueryFailure("resolve project", error);
  if (!data) return null;
  const id = String(data.id);
  const number = String(data.number ?? projectId);
  return { id, number, keys: Array.from(new Set([id, number, projectId, ...legacyProjectReferences(number)])) };
}

function noClient<T>(operation: string): T[] {
  recordQueryFailure(operation, "Supabase client unavailable or not configured");
  return [];
}

export async function fetchWorkstreams(projectId: string): Promise<WorkstreamRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch workstreams");
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const wsRes = await client.from("workstreams").select("*").eq("project_id", scope.id).order("code", { ascending: true });
  if (wsRes.error || !wsRes.data) {
    recordQueryFailure("fetch workstreams", wsRes.error ?? "No workstream data returned");
    return [];
  }
  const workstreamIds = wsRes.data.map((row) => String(row.id));
  const taskRes = workstreamIds.length
    ? await client.from("tasks").select("*").in("workstream_id", workstreamIds).order("task_code", { ascending: true })
    : { data: [], error: null };
  if (taskRes.error) recordQueryFailure("fetch tasks", taskRes.error);
  const tasks = (taskRes.data ?? []).map(taskRowToDomain);
  return wsRes.data.map((row) => {
    const ws = workstreamRowToDomain(row);
    ws.tasks = tasks.filter((task) => task.workstreamId === ws.id || task.workstreamId === ws.code);
    return ws;
  });
}

export async function fetchCustomerRequests(projectId: string): Promise<CustomerRequestRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch customer requests");
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const { data, error } = await client.from("customer_requests").select("*").in("project_id", scope.keys).order("created_at", { ascending: false });
  if (error || !data) {
    recordQueryFailure("fetch customer requests", error ?? "No customer request data returned");
    return [];
  }
  return data.map(customerRequestRowToDomain);
}

export async function fetchExternalFilings(projectId: string): Promise<ExternalFilingRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch external filings");
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const { data, error } = await client.from("external_filings").select("*").in("project_id", scope.keys).order("created_at", { ascending: false });
  if (error || !data) {
    recordQueryFailure("fetch external filings", error ?? "No external filing data returned");
    return [];
  }
  return data.map(externalFilingRowToDomain);
}

async function workstreamIdsForProject(client: QueryClient, projectId: string): Promise<string[]> {
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const { data, error } = await client.from("workstreams").select("id").eq("project_id", scope.id);
  if (error) recordQueryFailure("resolve project workstreams", error);
  return (data ?? []).map((row) => String(row.id));
}

export async function fetchRFIs(projectId: string): Promise<RFIRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch RFIs");
  const ids = await workstreamIdsForProject(client, projectId);
  if (!ids.length) return [];
  const [rfiRes, respRes] = await Promise.all([
    client.from("rfis").select("*").in("workstream_id", ids).order("created_at", { ascending: false }),
    client.from("rfi_responses").select("*").order("submitted_date", { ascending: true }),
  ]);
  if (rfiRes.error || !rfiRes.data) {
    recordQueryFailure("fetch RFIs", rfiRes.error ?? "No RFI data returned");
    return [];
  }
  if (respRes.error) recordQueryFailure("fetch RFI responses", respRes.error);
  const responses = (respRes.data ?? []).map(rfiResponseRowToDomain);
  return rfiRes.data.map((row) => rfiRowToDomain(row, responses.filter((response) => response.rfiId === row.id || response.rfiId === row.code)));
}

export async function fetchCoordinationRequests(projectId: string): Promise<CoordinationRequestRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch coordination requests");
  const ids = await workstreamIdsForProject(client, projectId);
  if (!ids.length) return [];
  const { data, error } = await client.from("coordination_requests").select("*").in("workstream_id", ids).order("created_at", { ascending: false });
  if (error || !data) {
    recordQueryFailure("fetch coordination requests", error ?? "No coordination request data returned");
    return [];
  }
  return data.map(coordinationRequestRowToDomain);
}

export async function fetchCommitments(projectId: string): Promise<CommitmentRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch commitments");
  const ids = await workstreamIdsForProject(client, projectId);
  if (!ids.length) return [];
  const { data, error } = await client.from("commitments").select("*").in("workstream_id", ids).order("created_at", { ascending: false });
  if (error || !data) {
    recordQueryFailure("fetch commitments", error ?? "No commitment data returned");
    return [];
  }
  return data.map(commitmentRowToDomain);
}

export async function fetchDecisions(projectId: string): Promise<DecisionRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch decisions");
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const { data, error } = await client.from("decisions").select("*").eq("project_id", scope.id).order("decision_date", { ascending: false });
  if (error || !data) {
    recordQueryFailure("fetch decisions", error ?? "No decision data returned");
    return [];
  }
  return data.map(decisionRowToDomain);
}

export async function fetchMeetings(projectId: string): Promise<MeetingRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch meetings");
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const { data, error } = await client.from("meetings").select("*").eq("project_id", scope.id).order("meeting_date", { ascending: false });
  if (error || !data) {
    recordQueryFailure("fetch meetings", error ?? "No meeting data returned");
    return [];
  }
  return data.map(meetingRowToDomain);
}

export async function fetchDocuments(projectId: string): Promise<DocumentRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch documents");
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const { data: documents, error } = await client.from("documents").select("*").eq("project_id", scope.id).order("created_at", { ascending: false });
  if (error || !documents) {
    recordQueryFailure("fetch documents", error ?? "No document data returned");
    return [];
  }
  const documentIds = documents.map((row) => String(row.id));
  const [versionRes, reviewRes] = await Promise.all([
    documentIds.length ? client.from("document_versions").select("*").in("document_id", documentIds).order("version_number", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    documentIds.length ? client.from("document_agency_reviews").select("*").order("created_at", { ascending: true }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (versionRes.error) recordQueryFailure("fetch document versions", versionRes.error);
  if (reviewRes.error) recordQueryFailure("fetch document reviews", reviewRes.error);
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
  if (!client) return noClient("fetch user profiles");
  const { data, error } = await client.from("user_profiles").select("*").order("full_name", { ascending: true });
  if (error || !data) {
    recordQueryFailure("fetch user profiles", error ?? "No user profile data returned");
    return [];
  }
  return data.map(userProfileRowToDomain);
}

export async function fetchOrganizationMemberships(): Promise<OrganizationMembershipRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch organization memberships");
  const { data, error } = await client.from("organization_memberships").select("id, user_id, organization_id, role, status, effective_from, effective_to").order("created_at", { ascending: true });
  if (error || !data) {
    recordQueryFailure("fetch organization memberships", error ?? "No membership data returned");
    return [];
  }
  return data.map((row) => organizationMembershipRowToDomain(row));
}

export async function fetchProjectParticipants(projectId: string): Promise<ProjectParticipantRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch project participants");
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const { data, error } = await client.from("project_participants").select("*").eq("project_id", scope.id).order("created_at", { ascending: true });
  if (error || !data) {
    recordQueryFailure("fetch project participants", error ?? "No project participant data returned");
    return [];
  }
  return data.map(projectParticipantRowToDomain);
}

export async function fetchNotifications(userId?: string): Promise<NotificationRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch notifications");
  const authResult = userId ? null : await client.auth.getUser();
  if (authResult?.error) recordQueryFailure("resolve notification user", authResult.error);
  const resolvedUserId = userId ?? authResult?.data.user?.id;
  if (!resolvedUserId) return [];
  const { data, error } = await client
    .from("notifications")
    .select("*")
    .eq("recipient_id", resolvedUserId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) {
    recordQueryFailure("fetch notifications", error ?? "No notification data returned");
    return [];
  }
  return data.map(notificationRowToDomain);
}

export async function fetchAuditEvents(projectId?: string): Promise<AuditEventRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch audit events");
  let query = client.from("audit_events").select("*").order("created_at", { ascending: false }).limit(100);
  if (projectId) {
    const scope = await resolveProjectScope(client, projectId);
    if (!scope) return [];
    query = query.in("project_id", scope.keys);
  }
  const { data, error } = await query;
  if (error || !data) {
    recordQueryFailure("fetch audit events", error ?? "No audit event data returned");
    return [];
  }
  return data.map(auditEventRowToDomain);
}

export async function fetchCatalog(): Promise<PermitTypeRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch permit catalog");
  const [permitRes, resourceRes] = await Promise.all([
    client.from("permit_types").select("*").order("code", { ascending: true }),
    client.from("requirement_resources").select("*").order("resource_name", { ascending: true }),
  ]);
  if (permitRes.error || !permitRes.data) {
    recordQueryFailure("fetch permit types", permitRes.error ?? "No permit type data returned");
    return [];
  }
  if (resourceRes.error) recordQueryFailure("fetch requirement resources", resourceRes.error);
  const resources = (resourceRes.data ?? []).map(requirementResourceRowToDomain);
  return permitRes.data.map((row) => permitTypeRowToDomain(row, resources.filter((resource) => resource.permitTypeId === row.id)));
}

export async function fetchOrganizations(): Promise<OrganizationRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch organizations");
  const { data, error } = await client.from("organizations").select("*").eq("active", true).order("code", { ascending: true });
  if (error || !data) {
    recordQueryFailure("fetch organizations", error ?? "No organization data returned");
    return [];
  }
  return data.map(organizationRowToDomain);
}

export async function fetchWorkflowTemplates(): Promise<WorkflowTemplateRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch workflow templates");
  const [definitionsRes, versionsRes, stagesRes] = await Promise.all([
    client.from("workflow_definitions").select("*").order("case_type", { ascending: true }),
    client.from("workflow_versions").select("*").order("version_number", { ascending: false }),
    client.from("workflow_version_stages").select("*").order("sequence_order", { ascending: true }),
  ]);
  if (definitionsRes.error || versionsRes.error || stagesRes.error || !definitionsRes.data || !versionsRes.data || !stagesRes.data) {
    recordQueryFailure(
      "fetch workflow templates",
      definitionsRes.error ?? versionsRes.error ?? stagesRes.error ?? "Incomplete workflow data returned",
    );
    return [];
  }
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

export async function fetchAssignmentGroups(orgCode?: string): Promise<AssignmentGroupRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch assignment groups");
  let query = client.from("assignment_groups").select("*").eq("active", true).order("name", { ascending: true });
  if (orgCode) {
    query = query.eq("org_code", orgCode);
  }
  const { data, error } = await query;
  if (error || !data) {
    recordQueryFailure("fetch assignment groups", error ?? "No assignment group data returned");
    return [];
  }
  return data.map(assignmentGroupRowToDomain);
}

export async function fetchAssignmentGroupMemberships(groupId?: string): Promise<AssignmentGroupMembershipRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch assignment group memberships");
  let query = client.from("assignment_group_memberships").select("*").order("created_at", { ascending: true });
  if (groupId) {
    query = query.eq("assignment_group_id", groupId);
  }
  const { data, error } = await query;
  if (error || !data) {
    recordQueryFailure("fetch assignment group memberships", error ?? "No assignment group membership data returned");
    return [];
  }
  return data.map(assignmentGroupMembershipRowToDomain);
}

export async function fetchFullProjectState(projectId = "PRJ-PECAN-2026"): Promise<Partial<ProjectRecord>> {
  const [workstreams, customerRequests, externalFilings, rfis, coordinationRequests, commitments, decisions, meetings, documents, participants, auditLedger] = await Promise.all([
    fetchWorkstreams(projectId), fetchCustomerRequests(projectId), fetchExternalFilings(projectId), fetchRFIs(projectId),
    fetchCoordinationRequests(projectId), fetchCommitments(projectId), fetchDecisions(projectId), fetchMeetings(projectId),
    fetchDocuments(projectId), fetchProjectParticipants(projectId), fetchAuditEvents(projectId),
  ]);
  return { workstreams, customerRequests, externalFilings, coordinationRequests, commitments, decisions, meetings, documents, auditLedger, participants };
}
