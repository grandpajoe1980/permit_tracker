import { getSupabaseBrowser } from "./client";
import {
  assignmentGroupMembershipRowToDomain,
  assignmentGroupRowToDomain,
  auditEventRowToDomain, commitmentRowToDomain, coordinationRequestRowToDomain,
  customerRequestRowToDomain, decisionRowToDomain, documentAgencyReviewRowToDomain,
  documentRowToDomain, documentVersionRowToDomain, externalFilingRowToDomain,
  externalFilingStatusCheckRowToDomain,
  meetingRowToDomain, notificationRowToDomain, organizationRowToDomain, permitTypeRowToDomain, workflowStageRowToDomain,
  projectParticipantRowToDomain, requirementResourceRowToDomain, rfiResponseRowToDomain,
  rfiRowToDomain, stageRunRowToDomain, taskRowToDomain, userProfileRowToDomain, workstreamRowToDomain, organizationMembershipRowToDomain,
  workflowVersionRowToDomain,
} from "./mappings";
import type {
  AssignmentGroupRecord,
  AssignmentGroupMembershipRecord,
  AuditEventRecord, CommitmentRecord, CoordinationRequestRecord, CustomerRequestRecord,
  DecisionRecord, DocumentRecord, ExternalFilingRecord, MeetingRecord, NotificationRecord,
  OrganizationRecord, PermitTypeRecord, ProjectParticipantRecord, ProjectRecord, RFIRecord, UserProfileRecord,
  WorkstreamRecord, WorkflowTemplateRecord, OrganizationMembershipRecord,
} from "../domain-models";
import { isProjectUuid, legacyProjectReferences, normalizeProjectReference } from "../project-identifiers";
import { summarizeProjectWorkstreams, type ProjectWorkstreamCounts } from "../project-portfolio";

type QueryClient = NonNullable<ReturnType<typeof getSupabaseBrowser>>;
type ProjectScope = { id: string; number: string; keys: string[] };

export type ProjectSummary = {
  id: string;
  number: string;
  name: string;
  description: string | null;
  location: unknown;
  status: string;
  risk: string;
  startDate: string | null;
  targetDate: string | null;
  customerOrganizationId: string;
  leadOrganizationId: string;
};

export type AccessibleProject = {
  id: string;
  number: string;
  name: string;
  status: string;
  risk: string;
  targetDate: string | null;
  workstreamCounts?: ProjectWorkstreamCounts;
  projectType: string | null;
  leadOrganizationId: string | null;
  customerOrganizationId: string | null;
  customerOrganizationName: string | null;
};

/** Project rows are filtered by the signed-in caller's RLS policies. */
export async function fetchAccessibleProjects(queryClient?: QueryClient): Promise<AccessibleProject[]> {
  const client = queryClient ?? getSupabaseBrowser();
  if (!client) return noClient("list accessible projects");
  const { data, error } = await client.from("projects")
    .select("id, number, name, status, risk, target_date, project_type, lead_organization_id, customer_organization_id, customer_organizations(name)")
    .order("name", { ascending: true });
  if (error) {
    recordQueryFailure("list accessible projects", error);
    return [];
  }
  const visibleProjectIds = (data ?? []).map((project) => String(project.id));
  const workstreamResult = visibleProjectIds.length > 0
    ? await client.from("workstreams").select("project_id, operational_state").in("project_id", visibleProjectIds)
    : { data: [], error: null };
  if (workstreamResult.error) recordQueryFailure("summarize accessible project workstreams", workstreamResult.error);
  const workstreamCounts = workstreamResult.error ? undefined : summarizeProjectWorkstreams(workstreamResult.data ?? [], visibleProjectIds);
  return (data ?? []).map((project) => ({
    id: String(project.id),
    number: String(project.number),
    name: String(project.name),
    status: String(project.status ?? "active"),
    risk: String(project.risk ?? "normal"),
    targetDate: project.target_date == null ? null : String(project.target_date),
    workstreamCounts: workstreamCounts?.[String(project.id)],
    projectType: project.project_type == null ? null : String(project.project_type),
    leadOrganizationId: project.lead_organization_id == null ? null : String(project.lead_organization_id),
    customerOrganizationId: project.customer_organization_id == null ? null : String(project.customer_organization_id),
    customerOrganizationName: project.customer_organizations?.[0]?.name == null ? null : String(project.customer_organizations[0].name),
  }));
}

export type AccessibleProjectChoice = Pick<ProjectSummary, "id" | "number" | "name" | "status" | "risk"> & {
  targetDate?: string | null;
  workstreamCounts?: ProjectWorkstreamCounts;
};

export type ProjectCreationOrganization = { id: string; code: string; name: string };
export type ProjectCreationCustomerOrganization = { id: string; name: string };
export type CreatedProject = {
  id: string;
  number: string;
  name: string;
  customerOrganizationId?: string;
  customerOrganizationName?: string;
};

export async function fetchProjectCreationOptions(): Promise<{
  organizations: ProjectCreationOrganization[];
  customerOrganizations: ProjectCreationCustomerOrganization[];
  error: string | null;
}> {
  const client = getSupabaseBrowser();
  if (!client) {
    const error = "Supabase is unavailable. Sign in with a configured PATH account to create a project.";
    recordQueryFailure("load project creation options", error);
    return { organizations: [], customerOrganizations: [], error };
  }

  const [organizations, customers] = await Promise.all([
    client.from("organizations").select("id, code, name").eq("active", true).order("name", { ascending: true }),
    client.from("customer_organizations").select("id, name").eq("active", true).order("name", { ascending: true }),
  ]);
  const queryError = organizations.error ?? customers.error;
  if (queryError) {
    recordQueryFailure("load project creation options", queryError);
    return { organizations: [], customerOrganizations: [], error: queryError.message };
  }

  return {
    organizations: (organizations.data ?? []).map((row) => ({ id: String(row.id), code: String(row.code), name: String(row.name) })),
    customerOrganizations: (customers.data ?? []).map((row) => ({ id: String(row.id), name: String(row.name) })),
    error: null,
  };
}

export async function createProjectForSystemAdmin(input: {
  number: string;
  name: string;
  customerOrganizationId: string | null;
  newCustomerOrganizationName: string;
  newCustomerOrganizationLegalName: string;
  customerUserEmailOrId: string;
  leadOrganizationId: string;
  participantOrganizationIds: string[];
}): Promise<{ data: CreatedProject | null; error: string | null }> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: "Supabase is unavailable. Try again after reconnecting." };

  const { data, error } = await client.rpc("rpc_create_project", {
    p_number: input.number,
    p_name: input.name,
    p_customer_organization_id: input.customerOrganizationId,
    p_lead_organization_id: input.leadOrganizationId,
    p_participant_organization_ids: input.participantOrganizationIds,
    p_new_customer_organization_name: input.newCustomerOrganizationName || null,
    p_new_customer_organization_legal_name: input.newCustomerOrganizationLegalName || null,
    p_customer_user_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.customerUserEmailOrId) ? input.customerUserEmailOrId : null,
    p_customer_user_email: input.customerUserEmailOrId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.customerUserEmailOrId) ? input.customerUserEmailOrId : null,
  });
  if (error) return { data: null, error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row || typeof row.id !== "string" || typeof row.number !== "string" || typeof row.name !== "string") {
    return { data: null, error: "The database did not return a confirmed project receipt." };
  }
  return {
    data: {
      id: row.id,
      number: row.number,
      name: row.name,
      customerOrganizationId: typeof row.customer_organization_id === "string" ? row.customer_organization_id : undefined,
      customerOrganizationName: typeof row.customer_organization_name === "string" ? row.customer_organization_name : undefined,
    },
    error: null,
  };
}

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
  const normalized = normalizeProjectReference(projectId);
  if (!normalized) {
    recordQueryFailure("resolve project", "A project reference is required.");
    return null;
  }
  const lookup = isProjectUuid(normalized)
    ? client.from("projects").select("id, number").eq("id", normalized).maybeSingle()
    : client.from("projects").select("id, number").eq("number", normalized).maybeSingle();
  const { data, error } = await lookup;
  if (error) recordQueryFailure("resolve project", error);
  if (!data) return null;
  const id = String(data.id);
  const number = String(data.number ?? normalized);
  return { id, number, keys: Array.from(new Set([id, number, normalized, ...legacyProjectReferences(number)])) };
}

export async function fetchProjectSummary(projectId: string, queryClient?: QueryClient): Promise<ProjectSummary | null> {
  const client = queryClient ?? getSupabaseBrowser();
  if (!client) {
    recordQueryFailure("fetch project", "Supabase client unavailable or not configured");
    return null;
  }
  const normalized = normalizeProjectReference(projectId);
  if (!normalized) {
    recordQueryFailure("fetch project", "A project reference is required.");
    return null;
  }
  const columns = "id, number, name, description, location, status, risk, start_date, target_date, customer_organization_id, lead_organization_id";
  const lookup = isProjectUuid(normalized)
    ? client.from("projects").select(columns).eq("id", normalized).maybeSingle()
    : client.from("projects").select(columns).eq("number", normalized).maybeSingle();
  const { data, error } = await lookup;
  if (error) recordQueryFailure("fetch project", error);
  if (!data) {
    if (!error) recordQueryFailure("fetch project", "Project is unavailable to this account.");
    return null;
  }
  return {
    id: String(data.id),
    number: String(data.number),
    name: String(data.name),
    description: data.description == null ? null : String(data.description),
    location: data.location,
    status: String(data.status ?? "active"),
    risk: String(data.risk ?? "normal"),
    startDate: data.start_date == null ? null : String(data.start_date),
    targetDate: data.target_date == null ? null : String(data.target_date),
    customerOrganizationId: String(data.customer_organization_id),
    leadOrganizationId: String(data.lead_organization_id),
  };
}

/** Lists only project rows visible through the caller's existing RLS policies. */
export async function fetchAccessibleProjectChoices(queryClient?: QueryClient): Promise<AccessibleProjectChoice[]> {
  const client = queryClient ?? getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client.from("projects").select("id, number, name, status, risk, target_date").order("name", { ascending: true });
  if (error || !data) {
    console.warn("Could not load the RLS-visible project list:", error ?? "No accessible project data returned");
    return [];
  }
  const projectIds = data.map((row) => String(row.id));
  const workstreamRes = projectIds.length
    ? await client.from("workstreams").select("project_id, operational_state").in("project_id", projectIds)
    : { data: [], error: null };
  if (workstreamRes.error) console.warn("Portfolio workload totals are unavailable:", workstreamRes.error);
  const workstreamCounts = workstreamRes.error ? {} : summarizeProjectWorkstreams(workstreamRes.data ?? [], projectIds);
  return data.map((row) => ({
    id: String(row.id),
    number: String(row.number),
    name: String(row.name),
    status: String(row.status ?? "active"),
    risk: String(row.risk ?? "normal"),
    targetDate: row.target_date == null ? null : String(row.target_date),
    workstreamCounts: workstreamCounts[String(row.id)],
  }));
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
  const [taskRes, rfiRes, respRes, stageRunRes] = await Promise.all([
    workstreamIds.length
      ? client.from("tasks").select("*").in("workstream_id", workstreamIds).order("task_code", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    workstreamIds.length
      ? client.from("rfis").select("*").in("workstream_id", workstreamIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    client.from("rfi_responses").select("*").order("submitted_date", { ascending: true }),
    workstreamIds.length
      ? client.from("stage_runs").select("*").in("workstream_id", workstreamIds).order("created_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (taskRes.error) recordQueryFailure("fetch tasks", taskRes.error);
  if (rfiRes.error) recordQueryFailure("fetch rfis", rfiRes.error);
  if (respRes.error) recordQueryFailure("fetch rfi responses", respRes.error);
  if (stageRunRes.error) recordQueryFailure("fetch stage runs", stageRunRes.error);

  const tasks = (taskRes.data ?? []).map(taskRowToDomain);
  const responses = (respRes.data ?? []).map(rfiResponseRowToDomain);
  const stageRuns = (stageRunRes.data ?? []).map(stageRunRowToDomain);
  const rfis = (rfiRes.data ?? []).map((row) =>
    rfiRowToDomain(row, responses.filter((response) => response.rfiId === row.id || response.rfiId === row.code))
  );

  return wsRes.data.map((row) => {
    const wsTasks = tasks.filter((task) => task.workstreamId === String(row.id) || task.workstreamId === String(row.code));
    const wsRfis = rfis.filter((rfi) => rfi.workstreamId === String(row.id) || rfi.workstreamId === String(row.code));
    const wsStageRuns = stageRuns.filter((stageRun) => stageRun.workstreamId === String(row.id) || stageRun.workstreamId === String(row.code));
    return workstreamRowToDomain(row, { tasks: wsTasks, stageRuns: wsStageRuns, rfis: wsRfis });
  });
}

export async function fetchCustomerRequests(projectId: string, queryClient?: QueryClient): Promise<CustomerRequestRecord[]> {
  const client = queryClient ?? getSupabaseBrowser();
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
  const [filingRes, checkRes] = await Promise.all([
    client.from("external_filings").select("*").in("project_id", scope.keys).order("created_at", { ascending: false }),
    client.from("external_filing_status_checks").select("*").in("project_id", scope.keys).order("verified_at", { ascending: false }),
  ]);
  if (filingRes.error || !filingRes.data) {
    recordQueryFailure("fetch external filings", filingRes.error ?? "No external filing data returned");
    return [];
  }
  if (checkRes.error) recordQueryFailure("fetch external filing status checks", checkRes.error);
  const checks = (checkRes.data ?? []).map(externalFilingStatusCheckRowToDomain);
  return filingRes.data.map((row) => {
    const filing = externalFilingRowToDomain(row);
    filing.statusChecks = checks.filter((check) => check.externalFilingId === filing.id);
    return filing;
  });
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
  if (authResult?.error && !authResult.error.message.toLowerCase().includes("session missing")) {
    recordQueryFailure("resolve notification user", authResult.error);
  }
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

export async function fetchAuditEvents(projectId: string): Promise<AuditEventRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch audit events");
  const scope = await resolveProjectScope(client, projectId);
  if (!scope) return [];
  const query = client.from("audit_events").select("*").in("project_id", scope.keys).order("created_at", { ascending: false }).limit(100);
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

export async function fetchWorkflowTemplates(projectReference?: string): Promise<WorkflowTemplateRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return noClient("fetch workflow templates");

  // Scope template hydration before reading versions and stages. The RLS
  // policies remain authoritative, while this avoids scanning every workflow
  // row and evaluating the project visibility policy for unrelated tenants.
  let organizationIds: string[] | null = null;
  if (projectReference) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectReference);
    const projectQuery = client.from("projects").select("id, lead_organization_id");
    const { data: project, error: projectError } = await (isUuid
      ? projectQuery.eq("id", projectReference)
      : projectQuery.eq("number", projectReference)).maybeSingle();
    if (projectError || !project) {
      recordQueryFailure("resolve project workflow visibility", projectError ?? "Project was not visible to the signed-in user");
      return [];
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    const { data: participants, error: participantsError } = await client.from("project_participants")
      .select("organization_id, is_active, starts_on, ends_on, expires_at")
      .eq("project_id", project.id)
      .eq("is_active", true);
    if (participantsError) {
      recordQueryFailure("resolve project workflow participants", participantsError);
      return [];
    }
    organizationIds = [...new Set([
      String(project.lead_organization_id),
      ...(participants ?? [])
        .filter((participant) => (!participant.starts_on || String(participant.starts_on) <= today)
          && (!participant.ends_on || String(participant.ends_on) >= today)
          && (!participant.expires_at || String(participant.expires_at) > now))
        .map((participant) => String(participant.organization_id)),
    ].filter(Boolean))];
    if (organizationIds.length === 0) return [];
  }

  let definitionsQuery = client.from("workflow_definitions").select("*").order("case_type", { ascending: true });
  if (organizationIds) definitionsQuery = definitionsQuery.in("organization_id", organizationIds);
  const definitionsRes = await definitionsQuery;
  if (definitionsRes.error || !definitionsRes.data) {
    recordQueryFailure("fetch workflow definitions", definitionsRes.error ?? "No workflow definition data returned");
    return [];
  }
  if (definitionsRes.data.length === 0) return [];

  const workflowIds = definitionsRes.data.map((definition) => String(definition.id));
  const versionsRes = await client.from("workflow_versions").select("*")
    .in("workflow_id", workflowIds)
    .order("version_number", { ascending: false });
  if (versionsRes.error || !versionsRes.data) {
    recordQueryFailure("fetch workflow versions", versionsRes.error ?? "No workflow version data returned");
    return [];
  }
  if (versionsRes.data.length === 0) {
    return definitionsRes.data.map((definition) => ({
      id: String(definition.id),
      organizationId: definition.organization_id == null ? undefined : String(definition.organization_id),
      permitTypeId: String(definition.case_type ?? definition.id),
      name: String(definition.name ?? definition.case_type ?? "Workflow"),
      description: definition.description ? String(definition.description) : undefined,
      activeVersionNumber: 1,
      versions: [],
    }));
  }
  const versionIds = versionsRes.data.map((version) => String(version.id));
  const stagesRes = await client.from("workflow_version_stages").select("*")
    .in("workflow_version_id", versionIds)
    .order("sequence_order", { ascending: true });
  if (stagesRes.error || !stagesRes.data) {
    recordQueryFailure("fetch workflow stages", stagesRes.error ?? "No workflow stage data returned");
    return [];
  }
  return definitionsRes.data.map((definition) => {
    const definitionId = String(definition.id);
    const versions = versionsRes.data
      .filter((version) => String(version.workflow_id) === definitionId)
      .map((version) => {
        const versionId = String(version.id);
        const stages = stagesRes.data.filter((stage) => String(stage.workflow_version_id) === versionId).map(workflowStageRowToDomain);
        return workflowVersionRowToDomain(version, stages);
      });
    const activeVersion = versions.find((version) => version.status === "published") ?? versions[0];
    return {
      id: definitionId,
      organizationId: definition.organization_id == null ? undefined : String(definition.organization_id),
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

export async function fetchFullProjectState(projectId: string): Promise<Partial<ProjectRecord>> {
  const [workstreams, customerRequests, externalFilings, rfis, coordinationRequests, commitments, decisions, meetings, documents, participants, auditLedger] = await Promise.all([
    fetchWorkstreams(projectId), fetchCustomerRequests(projectId), fetchExternalFilings(projectId), fetchRFIs(projectId),
    fetchCoordinationRequests(projectId), fetchCommitments(projectId), fetchDecisions(projectId), fetchMeetings(projectId),
    fetchDocuments(projectId), fetchProjectParticipants(projectId), fetchAuditEvents(projectId),
  ]);
  return { workstreams, customerRequests, externalFilings, coordinationRequests, commitments, decisions, meetings, documents, auditLedger, participants };
}
