import { getSupabaseBrowser } from "./client";
import {
  auditEventRowToDomain,
  commitmentRowToDomain,
  coordinationRequestRowToDomain,
  customerRequestRowToDomain,
  decisionRowToDomain,
  documentAgencyReviewRowToDomain,
  documentRowToDomain,
  documentVersionRowToDomain,
  externalFilingRowToDomain,
  meetingRowToDomain,
  notificationRowToDomain,
  permitTypeRowToDomain,
  projectParticipantRowToDomain,
  requirementResourceRowToDomain,
  rfiResponseRowToDomain,
  rfiRowToDomain,
  taskRowToDomain,
  userProfileRowToDomain,
  workstreamRowToDomain,
} from "./mappings";
import type {
  AuditEventRecord,
  CommitmentRecord,
  CoordinationRequestRecord,
  CustomerRequestRecord,
  DecisionRecord,
  DocumentAgencyReviewRecord,
  DocumentRecord,
  DocumentVersionRecord,
  ExternalFilingRecord,
  MeetingRecord,
  NotificationRecord,
  PermitTypeRecord,
  ProjectParticipantRecord,
  ProjectRecord,
  RFIRecord,
  UserProfileRecord,
  WorkstreamRecord,
} from "../domain-models";

export async function fetchWorkstreams(projectId: string): Promise<WorkstreamRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];

  const [wsRes, taskRes] = await Promise.all([
    client.from("workstreams").select("*").order("code", { ascending: true }),
    client.from("tasks").select("*").order("task_code", { ascending: true }),
  ]);

  if (wsRes.error || !wsRes.data) return [];
  const tasks = (taskRes.data ?? []).map(taskRowToDomain);

  return wsRes.data.map((row) => {
    const ws = workstreamRowToDomain(row);
    ws.tasks = tasks.filter((t) => t.workstreamId === ws.id || t.workstreamId === ws.code);
    return ws;
  });
}

export async function fetchCustomerRequests(projectId: string): Promise<CustomerRequestRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("customer_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(customerRequestRowToDomain);
}

export async function fetchExternalFilings(projectId: string): Promise<ExternalFilingRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("external_filings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(externalFilingRowToDomain);
}

export async function fetchRFIs(projectId: string): Promise<RFIRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];

  const [rfiRes, respRes] = await Promise.all([
    client.from("rfis").select("*").order("created_at", { ascending: false }),
    client.from("rfi_responses").select("*").order("submitted_date", { ascending: true }),
  ]);

  if (rfiRes.error || !rfiRes.data) return [];
  const responses = (respRes.data ?? []).map(rfiResponseRowToDomain);

  return rfiRes.data.map((row) => {
    const rfiResponses = responses.filter((r) => r.rfiId === row.id || r.rfiId === row.code);
    return rfiRowToDomain(row, rfiResponses);
  });
}

export async function fetchCoordinationRequests(projectId: string): Promise<CoordinationRequestRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("coordination_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(coordinationRequestRowToDomain);
}

export async function fetchCommitments(projectId: string): Promise<CommitmentRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("commitments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(commitmentRowToDomain);
}

export async function fetchDecisions(projectId: string): Promise<DecisionRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("decisions")
    .select("*")
    .order("decision_date", { ascending: false });
  if (error || !data) return [];
  return data.map(decisionRowToDomain);
}

export async function fetchMeetings(projectId: string): Promise<MeetingRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false });
  if (error || !data) return [];
  return data.map(meetingRowToDomain);
}

export async function fetchDocuments(projectId: string): Promise<DocumentRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];

  const [docRes, verRes, revRes] = await Promise.all([
    client.from("documents").select("*").order("created_at", { ascending: false }),
    client.from("document_versions").select("*").order("version_number", { ascending: false }),
    client.from("document_agency_reviews").select("*").order("created_at", { ascending: true }),
  ]);

  if (docRes.error || !docRes.data) return [];
  const reviews = (revRes.data ?? []).map(documentAgencyReviewRowToDomain);
  const versions = (verRes.data ?? []).map((row) => {
    const versionReviews = reviews.filter((r) => r.documentVersionId === row.id);
    return documentVersionRowToDomain(row, versionReviews);
  });

  return docRes.data.map((row) => {
    const docVersions = versions.filter((v) => v.documentId === row.id || v.documentId === row.document_ref_id);
    docVersions.sort((left, right) => (right.versionNumber ?? 0) - (left.versionNumber ?? 0));
    const docReviews = reviews.filter((r) => docVersions.some((v) => v.id === r.documentVersionId));
    return documentRowToDomain(row, docVersions, docReviews);
  });
}

export async function fetchUserProfiles(): Promise<UserProfileRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("user_profiles")
    .select("*")
    .order("full_name", { ascending: true });
  if (error || !data) return [];
  return data.map(userProfileRowToDomain);
}

export async function fetchProjectParticipants(projectId: string): Promise<ProjectParticipantRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("project_participants")
    .select("*")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map(projectParticipantRowToDomain);
}

export async function fetchNotifications(userId?: string): Promise<NotificationRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  let query = client.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
  if (userId) {
    query = query.or(`user_id.eq.${userId},recipient_id.eq.${userId}`);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(notificationRowToDomain);
}

export async function fetchAuditEvents(projectId?: string): Promise<AuditEventRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];
  const { data, error } = await client
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map(auditEventRowToDomain);
}

export async function fetchCatalog(): Promise<PermitTypeRecord[]> {
  const client = getSupabaseBrowser();
  if (!client) return [];

  const [pRes, rRes] = await Promise.all([
    client.from("permit_types").select("*").order("code", { ascending: true }),
    client.from("requirement_resources").select("*").order("resource_name", { ascending: true }),
  ]);

  if (pRes.error || !pRes.data) return [];
  const resources = (rRes.data ?? []).map(requirementResourceRowToDomain);

  return pRes.data.map((row) => {
    const permitResources = resources.filter((r) => r.permitTypeId === row.id);
    return permitTypeRowToDomain(row, permitResources);
  });
}

export async function fetchFullProjectState(projectId = "PRJ-PECAN-2026"): Promise<Partial<ProjectRecord>> {
  const [
    workstreams,
    customerRequests,
    externalFilings,
    rfis,
    coordinationRequests,
    commitments,
    decisions,
    meetings,
    documents,
    profiles,
    participants,
    notifications,
    auditLedger,
    catalog,
  ] = await Promise.all([
    fetchWorkstreams(projectId),
    fetchCustomerRequests(projectId),
    fetchExternalFilings(projectId),
    fetchRFIs(projectId),
    fetchCoordinationRequests(projectId),
    fetchCommitments(projectId),
    fetchDecisions(projectId),
    fetchMeetings(projectId),
    fetchDocuments(projectId),
    fetchUserProfiles(),
    fetchProjectParticipants(projectId),
    fetchNotifications(),
    fetchAuditEvents(projectId),
    fetchCatalog(),
  ]);

  return {
    workstreams,
    customerRequests,
    externalFilings,
    coordinationRequests,
    commitments,
    decisions,
    meetings,
    documents,
    auditLedger,
    participants,
  };
}
