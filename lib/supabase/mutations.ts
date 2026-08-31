import { getSupabaseBrowser } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AssignmentGroupRecord,
  AssignmentGroupMembershipRecord,
  AuditEventRecord,
  CommitmentRecord,
  CoordinationRequestRecord,
  CustomerRequestRecord,
  DocumentAgencyReviewRecord,
  DocumentVersionRecord,
  ExternalFilingRecord,
  NotificationRecord,
  OrganizationRecord,
  PermitTypeRecord,
  ProjectParticipantRecord,
  RFIRecord,
  RFIResponseRecord,
  UserProfileRecord,
  OrganizationMembershipRecord,
  WorkstreamRecord,
} from "../domain-models";
import { allowsFixtureData, requiresSupabase } from "../data-mode";
import { canonicalProjectReference } from "../project-identifiers";
import { calculateSHA256, uploadDocumentFile } from "./storage-primitives";

export interface MutationResult<T> {
  data: T | null;
  error: Error | null;
}

export async function mutateRegisterOrganization(params: {
  code: string;
  name: string;
  organizationType?: string;
  jurisdictionLevel?: string;
  abbreviation?: string;
  websiteUrl?: string;
  generalContactEmail?: string;
}): Promise<MutationResult<OrganizationRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_register_organization", {
    p_code: params.code,
    p_name: params.name,
    p_organization_type: params.organizationType ?? "agency",
    p_jurisdiction_level: params.jurisdictionLevel ?? "state",
    p_abbreviation: params.abbreviation ?? null,
    p_website_url: params.websiteUrl ?? null,
    p_general_contact_email: params.generalContactEmail ?? null,
  });
  if (error || !data) return { data: null, error: new Error(error?.message ?? "Organization registration was not confirmed by the database.") };
  const row = data as Record<string, unknown>;
  return {
    data: {
      id: String(row.id), code: String(row.code), name: String(row.name), abbreviation: params.abbreviation ?? String(row.code),
      jurisdictionLevel: (String(row.jurisdiction_level ?? "state") === "federal" ? "Federal" : String(row.jurisdiction_level ?? "state") === "local" ? "Local / Parish" : "State") as OrganizationRecord["jurisdictionLevel"],
      websiteUrl: params.websiteUrl, generalContactEmail: params.generalContactEmail, workingHours: "Agency schedule", holidayCalendar: "Agency holidays",
      defaultSlaDays: 30, documentRetentionYears: 7, isActive: Boolean(row.active ?? true),
    },
    error: null,
  };
}

export async function mutateCreatePermitType(params: {
  id: string;
  code: string;
  name: string;
  category: string;
  responsibleOrgCode: string;
  triggerExplanation: string;
  statutoryCitation: string;
  expectedLeadTimeDays?: number;
  minimumStatutoryDays?: number;
  officialFilingUrl?: string;
}): Promise<MutationResult<PermitTypeRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_create_permit_type", {
    p_id: params.id, p_code: params.code, p_name: params.name, p_category: params.category,
    p_responsible_org_code: params.responsibleOrgCode, p_trigger_explanation: params.triggerExplanation,
    p_statutory_citation: params.statutoryCitation, p_expected_lead_time_days: params.expectedLeadTimeDays ?? 30,
    p_minimum_statutory_days: params.minimumStatutoryDays ?? 0, p_official_filing_url: params.officialFilingUrl ?? null,
  });
  if (error || !data) return { data: null, error: new Error(error?.message ?? "Authorization registration was not confirmed by the database.") };
  const row = data as Record<string, unknown>;
  return {
    data: {
      id: String(row.id), code: String(row.code), name: String(row.name), category: (String(row.category) as PermitTypeRecord["category"]),
      responsibleOrgId: String(row.responsible_org_id), responsibleOrgCode: String(row.responsible_org_code),
      triggerExplanation: String(row.trigger_explanation), statutoryCitation: String(row.statutory_citation), officialFilingUrl: (row.official_filing_url as string) || undefined,
      expectedLeadTimeDays: Number(row.expected_lead_time_days ?? 30), minimumStatutoryDays: Number(row.minimum_statutory_days ?? 0),
      publicNoticeRequired: Boolean(row.public_notice_required), publicNoticeDays: Number(row.public_notice_days ?? 0), prerequisites: [], relatedPermitTypeIds: [],
      lastVerifiedAt: (row.last_verified_at as string) || undefined, verificationStatus: (String(row.verification_status ?? "verification_due") as PermitTypeRecord["verificationStatus"]), resources: [],
    },
    error: null,
  };
}

function customerRequestFromRow(row: Record<string, unknown>): CustomerRequestRecord {
  return {
    id: String(row.id),
    confirmationNumber: String(row.confirmation_number),
    projectId: String(row.project_id),
    requestType: String(row.request_type) as CustomerRequestRecord["requestType"],
    title: String(row.title),
    description: String(row.description),
    requestedOutcome: (row.requested_outcome as string) || undefined,
    locationOrAffectedArea: (row.location_or_affected_area as string) || undefined,
    desiredDate: (row.desired_date as string) || undefined,
    scheduleImportance: (row.schedule_importance as CustomerRequestRecord["scheduleImportance"]) || "normal",
    knownAgencyCode: (row.known_agency_code as string) || undefined,
    knownPermitTypeId: (row.known_permit_type_id as string) || undefined,
    submittedByUserId: (row.submitted_by_user_id as string) || undefined,
    submittedByName: String(row.submitted_by_name),
    relatedWorkstreamId: (row.related_workstream_id as string) || undefined,
    blocksActiveWork: Boolean(row.blocks_active_work),
    status: String(row.status) as CustomerRequestRecord["status"],
    attachmentDocumentVersionIds: (row.attachment_document_version_ids as string[]) || [],
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

// ====================================================================
// 1. AUDIT & NOTIFICATIONS
// ====================================================================

export async function insertAuditEvent(params: {
  entityType: string;
  entityId: string;
  actorName: string;
  actorOrgName: string;
  actionType: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  projectId?: string;
  actorId?: string;
}): Promise<MutationResult<AuditEventRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data: authData, error: authError } = await client.auth.getUser();
  const actorId = params.actorId ?? authData.user?.id;
  if (requiresSupabase() && (authError || !actorId)) {
    return { data: null, error: authError ?? new Error("An authenticated actor is required for audit events.") };
  }

  const now = new Date().toISOString();
  const payload = {
    entity_type: params.entityType,
    entity_id: params.entityId,
    actor_name: params.actorName,
    actor_org_name: params.actorOrgName,
    action_type: params.actionType,
    action: params.actionType,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
    reason: params.reason ?? null,
    project_id: params.projectId ?? "PRJ-PECAN-2026",
    actor_id: actorId ?? null,
    created_at: now,
  };

  const { data, error } = await client.from("audit_events").insert(payload).select().single();
  if (error) return { data: null, error: new Error(error.message) };

  return {
    data: {
      id: String(data.id),
      entityType: params.entityType,
      entityId: params.entityId,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: params.actionType,
      oldValue: params.oldValue,
      newValue: params.newValue,
      reason: params.reason,
      sourceChannel: "in_app",
      occurredAt: now,
    },
    error: null,
  };
}

export async function insertNotification(params: {
  userId: string;
  title: string;
  message: string;
  type: NotificationRecord["type"];
  linkUrl?: string;
  urgency?: NotificationRecord["urgency"];
  metadata?: Record<string, unknown>;
}): Promise<MutationResult<NotificationRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const now = new Date().toISOString();
  const payload = {
    user_id: params.userId,
    title: params.title,
    message: params.message,
    body: params.message,
    event_type: params.type,
    type: params.type,
    link_url: params.linkUrl ?? null,
    urgency: params.urgency ?? "info",
    metadata: params.metadata ?? {},
    channel: "in_app",
    delivery_status: "pending",
    is_read: false,
    created_at: now,
  };

  const { data, error } = await client.from("notifications").insert(payload).select().single();
  if (error) return { data: null, error: new Error(error.message) };

  return {
    data: {
      id: String(data.id),
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      linkUrl: params.linkUrl,
      urgency: params.urgency ?? "info",
      metadata: params.metadata,
      createdAt: now,
      isRead: false,
    },
    error: null,
  };
}

// ====================================================================
// 2. CUSTOMER REQUESTS
// ====================================================================

export type CustomerRequestMutationParams = {
  id: string;
  confirmationNumber: string;
  projectId: string;
  requestType: CustomerRequestRecord["requestType"];
  title: string;
  description: string;
  requestedOutcome?: string;
  locationOrAffectedArea?: string;
  desiredDate?: string;
  scheduleImportance?: "low" | "normal" | "critical";
  knownAgencyCode?: string;
  knownPermitTypeId?: string;
  submittedByUserId?: string;
  submittedByName: string;
  relatedWorkstreamId?: string;
  blocksActiveWork: boolean;
  status: CustomerRequestRecord["status"];
  attachmentDocumentVersionIds?: string[];
};

export async function mutateCreateCustomerRequest(params: CustomerRequestMutationParams, requestClient?: SupabaseClient): Promise<MutationResult<CustomerRequestRecord>> {
  const client = requestClient ?? getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  let projectId = canonicalProjectReference(params.projectId);
  // The current schema uses UUID project ids, while the seeded legacy project
  // uses a stable text id. Only resolve the canonical project number; do not
  // reinterpret an already-resolved text id as a project number.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId) && projectId.toUpperCase().startsWith("PRJ-")) {
    const { data: project, error: projectError } = await client
      .from("projects")
      .select("id")
      .eq("number", projectId)
      .maybeSingle();
    if (projectError || !project) {
      return { data: null, error: new Error(projectError?.message ?? `Project ${projectId} was not found.`) };
    }
    projectId = String(project.id);
  }
  const { data: authData, error: authError } = await client.auth.getUser();
  if (requiresSupabase() && (authError || !authData.user)) {
    return { data: null, error: authError ?? new Error("Sign in before creating a customer request.") };
  }
  const submittedByUserId = authData.user?.id ?? params.submittedByUserId;

  // Try PostgreSQL RPC function first
  const rpcPayload = {
    p_id: params.id,
    p_confirmation_number: params.confirmationNumber,
    p_project_id: projectId,
    p_request_type: params.requestType,
    p_title: params.title,
    p_description: params.description,
    p_requested_outcome: params.requestedOutcome ?? null,
    p_location_or_affected_area: params.locationOrAffectedArea ?? null,
    p_desired_date: params.desiredDate ?? null,
    p_schedule_importance: params.scheduleImportance ?? "normal",
    p_known_agency_code: params.knownAgencyCode ?? null,
    p_known_permit_type_id: params.knownPermitTypeId ?? null,
    p_submitted_by_user_id: submittedByUserId ?? null,
    p_submitted_by_name: params.submittedByName,
    p_related_workstream_id: params.relatedWorkstreamId ?? null,
    p_blocks_active_work: params.blocksActiveWork,
    p_status: params.status,
    p_attachment_document_version_ids: params.attachmentDocumentVersionIds ?? [],
  };

  const { data: rpcData, error: rpcError } = await client.rpc("rpc_create_customer_request", rpcPayload);
  if (!rpcError && rpcData) {
    // The RPC owns the request, audit, and notification transaction. Do not
    // emit client-side duplicates after it commits.
    return { data: customerRequestFromRow(rpcData as Record<string, unknown>), error: null };
    /*
    await Promise.all([
      insertAuditEvent({
        entityType: "customer_request",
        entityId: params.confirmationNumber,
        actorName: params.submittedByName,
        actorOrgName: "Space Exploration Technologies Corp. (SpaceX)",
        actionType: "customer_request_submitted",
        newValue: `${params.requestType} · ${params.title}`,
        reason: params.description,
        projectId: params.projectId,
      }),
      insertNotification({
        userId: "user-sarah-johnson",
        title: `New customer request: ${params.title}`,
        message: `${params.submittedByName} submitted request ${params.confirmationNumber}`,
        type: "action_required",
        linkUrl: `/requests/${params.confirmationNumber}`,
        urgency: params.blocksActiveWork ? "critical" : "info",
        metadata: { confirmationNumber: params.confirmationNumber, requestType: params.requestType },
      }),
    ]);
    */

  }

  if (!allowsFixtureData()) {
    return { data: null, error: new Error(`Customer request transaction failed: ${rpcError?.message ?? "no row returned"}`) };
  }

  // Test/demo compatibility fallback. Production must use the atomic RPC.
  const now = new Date().toISOString();
  const insertPayload = {
    id: params.id,
    confirmation_number: params.confirmationNumber,
    project_id: params.projectId,
    request_type: params.requestType,
    title: params.title,
    description: params.description,
    requested_outcome: params.requestedOutcome ?? null,
    location_or_affected_area: params.locationOrAffectedArea ?? null,
    desired_date: params.desiredDate ?? null,
    schedule_importance: params.scheduleImportance ?? "normal",
    known_agency_code: params.knownAgencyCode ?? null,
    known_permit_type_id: params.knownPermitTypeId ?? null,
    submitted_by_user_id: params.submittedByUserId ?? null,
    submitted_by_name: params.submittedByName,
    related_workstream_id: params.relatedWorkstreamId ?? null,
    blocks_active_work: params.blocksActiveWork,
    status: params.status,
    attachment_document_version_ids: params.attachmentDocumentVersionIds ?? [],
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client.from("customer_requests").insert(insertPayload).select().single();
  if (error) return { data: null, error: new Error(error.message) };

  // Write audit event & notification
  await Promise.all([
    insertAuditEvent({
      entityType: "customer_request",
      entityId: params.confirmationNumber,
      actorName: params.submittedByName,
      actorOrgName: "Space Exploration Technologies Corp. (SpaceX)",
      actionType: "customer_request_submitted",
      newValue: `${params.requestType} · ${params.title}`,
      reason: params.description,
      projectId: params.projectId,
    }),
    params.status !== "draft"
      ? insertNotification({
          userId: "sarah.johnson@la.gov",
          title: `New customer request ${params.confirmationNumber}`,
          message: params.title,
          type: "action_required",
          linkUrl: `/requests/${params.confirmationNumber}`,
          urgency: params.blocksActiveWork ? "critical" : "high",
          metadata: { confirmationNumber: params.confirmationNumber, requestType: params.requestType },
        })
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    data: {
      id: String(data.id),
      confirmationNumber: String(data.confirmation_number),
      projectId: String(data.project_id),
      requestType: String(data.request_type) as CustomerRequestRecord["requestType"],
      title: String(data.title),
      description: String(data.description),
      requestedOutcome: params.requestedOutcome,
      locationOrAffectedArea: params.locationOrAffectedArea,
      desiredDate: params.desiredDate,
      scheduleImportance: params.scheduleImportance ?? "normal",
      knownAgencyCode: params.knownAgencyCode,
      knownPermitTypeId: params.knownPermitTypeId,
      submittedByUserId: params.submittedByUserId,
      submittedByName: params.submittedByName,
      relatedWorkstreamId: params.relatedWorkstreamId,
      blocksActiveWork: params.blocksActiveWork,
      status: params.status,
      attachmentDocumentVersionIds: params.attachmentDocumentVersionIds ?? [],
      createdAt: now,
      updatedAt: now,
    },
    error: null,
  };
}

/**
 * Upload a customer's first attachment and commit its document parent,
 * version, request, audit, and notification through one database RPC.
 */
export async function mutateCreateCustomerRequestWithDocument(
  params: CustomerRequestMutationParams & { file: File; documentType?: string },
  requestClient?: SupabaseClient,
): Promise<MutationResult<CustomerRequestRecord>> {
  const client = requestClient ?? getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  if (params.file.size <= 0) return { data: null, error: new Error("Choose a non-empty attachment.") };
  if (params.file.size > 25 * 1024 * 1024) return { data: null, error: new Error("Attachments must be 25 MB or smaller.") };

  const { data: authData, error: authError } = await client.auth.getUser();
  if (requiresSupabase() && (authError || !authData.user)) {
    return { data: null, error: authError ?? new Error("Sign in before uploading an attachment.") };
  }

  let projectId = canonicalProjectReference(params.projectId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectId) && projectId.toUpperCase().startsWith("PRJ-")) {
    const { data: project, error: projectError } = await client.from("projects").select("id").eq("number", projectId).maybeSingle();
    if (projectError || !project) return { data: null, error: new Error(projectError?.message ?? `Project ${projectId} was not found.`) };
    projectId = String(project.id);
  }

  const fileBuffer = await params.file.arrayBuffer();
  const sha256Hash = await calculateSHA256(fileBuffer);
  const documentId = crypto.randomUUID();
  const uploadId = crypto.randomUUID();
  const upload = await uploadDocumentFile(params.file, documentId, 1, uploadId);
  if (upload.error) return { data: null, error: upload.error };

  const versionId = `doc-v-${uploadId}`;
  const { data: rpcData, error: rpcError } = await client.rpc("rpc_create_customer_request_with_document", {
    p_request: {
      id: params.id,
      confirmationNumber: params.confirmationNumber,
      projectId,
      requestType: params.requestType,
      title: params.title,
      description: params.description,
      requestedOutcome: params.requestedOutcome ?? null,
      locationOrAffectedArea: params.locationOrAffectedArea ?? null,
      desiredDate: params.desiredDate ?? null,
      scheduleImportance: params.scheduleImportance ?? "normal",
      knownAgencyCode: params.knownAgencyCode ?? null,
      knownPermitTypeId: params.knownPermitTypeId ?? null,
      submittedByUserId: authData.user?.id ?? params.submittedByUserId ?? null,
      submittedByName: params.submittedByName,
      relatedWorkstreamId: params.relatedWorkstreamId ?? null,
      blocksActiveWork: params.blocksActiveWork,
      status: params.status,
    },
    p_document: {
      documentId,
      versionId,
      documentType: params.documentType ?? "customer_attachment",
      versionLabel: "v1.0",
      storagePath: upload.storagePath,
      fileName: params.file.name,
      mimeType: params.file.type || "application/octet-stream",
      fileSizeBytes: params.file.size,
      sha256Hash,
      uploadedByName: params.submittedByName,
      uploadedByOrgName: "Space Exploration Technologies Corp. (SpaceX)",
      changeNotes: "Initial customer intake attachment.",
    },
  });

  if (rpcError || !rpcData) {
    await client.storage.from("path-documents").remove([upload.storagePath]);
    return { data: null, error: new Error(`Customer request attachment transaction failed: ${rpcError?.message ?? "no row returned"}`) };
  }

  return { data: customerRequestFromRow(rpcData as Record<string, unknown>), error: null };
}

// ====================================================================
// 3. EXTERNAL FILINGS
// ====================================================================

export async function mutateCreateWorkstreamFromRequest(params: {
  requestId: string;
  code: string;
  title: string;
  category: string;
  permitTypeId?: string;
  leadOrgCode?: string;
  leadOrgName?: string;
  workflowVersionId?: string;
}): Promise<MutationResult<{ requestId: string; workstreamId: string; workstreamCode: string; workflowVersionId?: string }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_create_workstream_from_request", {
    p_request_id: params.requestId,
    p_code: params.code,
    p_title: params.title,
    p_category: params.category,
    p_permit_type_id: params.permitTypeId ?? null,
    p_lead_org_code: params.leadOrgCode ?? "STATEPO",
    p_lead_org_name: params.leadOrgName ?? "Louisiana Governor's Office of Major Projects & Delivery",
    p_workflow_version_id: params.workflowVersionId ?? null,
  });
  if (error || !data) return { data: null, error: new Error(error?.message ?? "Workstream creation was not confirmed by the database.") };
  const row = data as Record<string, unknown>;
  return {
    data: {
      requestId: String(row.requestId ?? row.request_id),
      workstreamId: String(row.workstreamId ?? row.workstream_id),
      workstreamCode: String(row.workstreamCode ?? row.workstream_code),
      workflowVersionId: row.workflowVersionId ? String(row.workflowVersionId) : undefined,
    },
    error: null,
  };
}

export async function mutateTriageCustomerRequest(params: {
  requestId: string;
  workstreams: Array<{
    code: string;
    title: string;
    category: string;
    permitTypeId?: string;
    leadOrgCode?: string;
    leadOrgName?: string;
    workflowVersionId?: string;
  }>;
}): Promise<MutationResult<{ requestId: string; workstreamIds: string[]; workstreamCodes: string[] }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_triage_customer_request", {
    p_request_id: params.requestId,
    p_workstreams: params.workstreams,
  });
  if (error || !data) return { data: null, error: new Error(error?.message ?? "Customer triage was not confirmed by the database.") };
  const row = data as Record<string, unknown>;
  return {
    data: {
      requestId: String(row.requestId ?? row.request_id),
      workstreamIds: Array.isArray(row.workstreamIds) ? row.workstreamIds.map(String) : [],
      workstreamCodes: Array.isArray(row.workstreamCodes) ? row.workstreamCodes.map(String) : [],
    },
    error: null,
  };
}

export async function mutateCreateExternalFiling(params: {
  id: string;
  projectId: string;
  workstreamId: string;
  permitTypeId?: string;
  authorityOrganizationId: string;
  authorityOrganizationName: string;
  filingMethod: ExternalFilingRecord["filingMethod"];
  officialPortalUrl?: string;
  externalReferenceNumber?: string;
  externalRecordUrl?: string;
  externalStatus: ExternalFilingRecord["externalStatus"];
  submittedAt?: string;
  submittedByUserId?: string;
  submittedByName?: string;
  notes?: string;
  receiptDocumentVersionIds?: string[];
}): Promise<MutationResult<ExternalFilingRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const now = new Date().toISOString();
  const payload = {
    id: params.id,
    project_id: params.projectId,
    workstream_id: params.workstreamId,
    permit_type_id: params.permitTypeId ?? null,
    authority_organization_id: params.authorityOrganizationId,
    authority_organization_name: params.authorityOrganizationName,
    filing_method: params.filingMethod,
    official_portal_url: params.officialPortalUrl ?? null,
    external_reference_number: params.externalReferenceNumber ?? null,
    external_record_url: params.externalRecordUrl ?? null,
    external_status: params.externalStatus,
    submitted_at: params.submittedAt ?? now,
    submitted_by_user_id: params.submittedByUserId ?? null,
    authoritative_system_name: params.authorityOrganizationName,
    notes: params.notes ?? null,
    receipt_document_version_ids: params.receiptDocumentVersionIds ?? [],
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await client.from("external_filings").insert(payload).select().single();
  if (error) return { data: null, error: new Error(error.message) };

  await insertAuditEvent({
    entityType: "external_filing",
    entityId: params.id,
    actorName: params.submittedByName ?? "PATH user",
    actorOrgName: params.authorityOrganizationName,
    actionType: "external_filing_recorded",
    newValue: params.externalReferenceNumber ?? "Reference pending",
    reason: params.notes ?? "Manual tracking record created.",
    projectId: params.projectId,
  });

  return {
    data: {
      id: String(data.id),
      projectId: params.projectId,
      workstreamId: params.workstreamId,
      permitTypeId: params.permitTypeId,
      authorityOrganizationId: params.authorityOrganizationId,
      authorityOrganizationName: params.authorityOrganizationName,
      filingMethod: params.filingMethod,
      officialPortalUrl: params.officialPortalUrl,
      externalReferenceNumber: params.externalReferenceNumber,
      externalRecordUrl: params.externalRecordUrl,
      externalStatus: params.externalStatus,
      submittedAt: params.submittedAt ?? now,
      submittedByUserId: params.submittedByUserId,
      submittedByName: params.submittedByName,
      notes: params.notes,
      receiptDocumentVersionIds: params.receiptDocumentVersionIds ?? [],
      createdAt: now,
      updatedAt: now,
    },
    error: null,
  };
}

export async function mutateUpdateExternalFiling(
  id: string,
  updates: Partial<Pick<ExternalFilingRecord, "externalReferenceNumber" | "externalRecordUrl" | "externalStatus" | "submittedAt" | "submittedByUserId" | "submittedByName" | "lastStatusVerifiedAt" | "lastStatusVerifiedBy" | "notes" | "receiptDocumentVersionIds">>,
  actorName: string,
  actorOrgName: string
): Promise<MutationResult<ExternalFilingRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    updated_at: now,
  };

  if (updates.externalReferenceNumber !== undefined) payload.external_reference_number = updates.externalReferenceNumber;
  if (updates.externalRecordUrl !== undefined) payload.external_record_url = updates.externalRecordUrl;
  if (updates.externalStatus !== undefined) payload.external_status = updates.externalStatus;
  if (updates.submittedAt !== undefined) payload.submitted_at = updates.submittedAt;
  if (updates.submittedByUserId !== undefined) payload.submitted_by_user_id = updates.submittedByUserId;
  if (updates.lastStatusVerifiedAt !== undefined) payload.last_status_verified_at = updates.lastStatusVerifiedAt;
  if (updates.lastStatusVerifiedBy !== undefined) payload.last_status_verified_by = updates.lastStatusVerifiedBy;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.receiptDocumentVersionIds !== undefined) payload.receipt_document_version_ids = updates.receiptDocumentVersionIds;

  const { data, error } = await client.from("external_filings").update(payload).eq("id", id).select().single();
  if (error) return { data: null, error: new Error(error.message) };

  await insertAuditEvent({
    entityType: "external_filing",
    entityId: id,
    actorName,
    actorOrgName,
    actionType: "external_filing_updated",
    newValue: updates.externalStatus ?? "Updated",
    reason: updates.notes ?? "External filing updated.",
  });

  return {
    data: {
      id: String(data.id),
      projectId: String(data.project_id),
      workstreamId: String(data.workstream_id),
      authorityOrganizationId: String(data.authority_organization_id),
      authorityOrganizationName: String(data.authority_organization_name),
      filingMethod: String(data.filing_method) as ExternalFilingRecord["filingMethod"],
      externalReferenceNumber: (data.external_reference_number as string) || undefined,
      externalRecordUrl: (data.external_record_url as string) || undefined,
      externalStatus: String(data.external_status) as ExternalFilingRecord["externalStatus"],
      notes: (data.notes as string) || undefined,
      receiptDocumentVersionIds: (data.receipt_document_version_ids as string[]) || [],
      createdAt: String(data.created_at),
      updatedAt: now,
    },
    error: null,
  };
}

// ====================================================================
// 4. RFIs & RESPONSES
// ====================================================================

export async function mutateCreateRFI(params: {
  id: string;
  code: string;
  workstreamId: string;
  workstreamTitle: string;
  requestingOrgId: string;
  requestingOrgCode: string;
  recipientOrgId: string;
  recipientOrgCode: string;
  title: string;
  questionText: string;
  technicalReason: string;
  requiredDocumentTypes?: string[];
  responseDeadline: string;
  clockImpact?: RFIRecord["clockImpact"];
  scheduleImpactDays?: number;
  actorName: string;
}): Promise<MutationResult<RFIRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const rpcPayload = {
    p_id: params.id,
    p_code: params.code,
    p_workstream_id: params.workstreamId,
    p_workstream_title: params.workstreamTitle,
    p_requesting_org_id: params.requestingOrgId,
    p_requesting_org_code: params.requestingOrgCode,
    p_recipient_org_id: params.recipientOrgId,
    p_recipient_org_code: params.recipientOrgCode,
    p_title: params.title,
    p_question_text: params.questionText,
    p_technical_reason: params.technicalReason,
    p_required_document_types: params.requiredDocumentTypes ?? [],
    p_response_deadline: params.responseDeadline,
    p_clock_impact: params.clockImpact ?? "pauses_clock",
    p_schedule_impact_days: params.scheduleImpactDays ?? 0,
    p_actor_name: params.actorName,
  };

  const { error: rpcError } = await client.rpc("rpc_create_rfi", rpcPayload);
  if (!rpcError) {
    return {
      data: {
        id: params.id,
        code: params.code,
        workstreamId: params.workstreamId,
        workstreamTitle: params.workstreamTitle,
        requestingOrgId: params.requestingOrgId,
        requestingOrgCode: params.requestingOrgCode,
        recipientOrgId: params.recipientOrgId,
        recipientOrgCode: params.recipientOrgCode,
        title: params.title,
        questionText: params.questionText,
        technicalReason: params.technicalReason,
        requiredDocumentTypes: params.requiredDocumentTypes ?? [],
        issuedDate: new Date().toISOString().split("T")[0],
        responseDeadline: params.responseDeadline,
        clockImpact: params.clockImpact ?? "clock_paused",
        scheduleImpactDays: params.scheduleImpactDays ?? 0,
        status: "issued",
        isConsolidatedCycle: false,
        responses: [],
      },
      error: null,
    };
  }

  if (!allowsFixtureData()) {
    return { data: null, error: new Error(`RFI transaction failed: ${rpcError.message}`) };
  }

  // Fallback
  const now = new Date().toISOString();
  const { data, error } = await client.from("rfis").insert({
    id: params.id,
    code: params.code,
    workstream_id: params.workstreamId,
    workstream_title: params.workstreamTitle,
    requesting_org_id: params.requestingOrgId,
    requesting_org_code: params.requestingOrgCode,
    recipient_org_id: params.recipientOrgId,
    recipient_org_code: params.recipientOrgCode,
    title: params.title,
    question_text: params.questionText,
    technical_reason: params.technicalReason,
    required_document_types: params.requiredDocumentTypes ?? [],
    issued_date: now.split("T")[0],
    response_deadline: params.responseDeadline,
    clock_impact: params.clockImpact ?? "pauses_clock",
    schedule_impact_days: params.scheduleImpactDays ?? 0,
    status: "issued",
    is_consolidated_cycle: false,
    created_at: now,
  }).select().single();

  if (error) return { data: null, error: new Error(error.message) };

  await Promise.all([
    client.from("workstreams").update({
      operational_state: "waiting_applicant",
      operational_state_label: "Waiting on Applicant (RFI Issued)",
      waiting_reason: `Waiting for response to ${params.code}.`,
      waiting_on_entity: params.recipientOrgCode,
      updated_at: now,
    }).or(`id.eq.${params.workstreamId},code.eq.${params.workstreamId}`),
    insertAuditEvent({
      entityType: "rfi",
      entityId: params.code,
      actorName: params.actorName,
      actorOrgName: params.requestingOrgCode,
      actionType: "rfi_issued",
      newValue: `Issued ${params.code} to ${params.recipientOrgCode}`,
      reason: params.questionText,
    }),
  ]);

  return {
    data: {
      id: String(data.id),
      code: String(data.code),
      workstreamId: params.workstreamId,
      workstreamTitle: params.workstreamTitle,
      requestingOrgId: params.requestingOrgId,
      requestingOrgCode: params.requestingOrgCode,
      recipientOrgId: params.recipientOrgId,
      recipientOrgCode: params.recipientOrgCode,
      title: params.title,
      questionText: params.questionText,
      technicalReason: params.technicalReason,
      requiredDocumentTypes: params.requiredDocumentTypes ?? [],
      issuedDate: now.split("T")[0],
      responseDeadline: params.responseDeadline,
      clockImpact: params.clockImpact ?? "clock_paused",
      scheduleImpactDays: params.scheduleImpactDays ?? 0,
      status: "issued",
      isConsolidatedCycle: false,
      responses: [],
    },
    error: null,
  };
}

export async function mutateSubmitRFIResponse(params: {
  id: string;
  rfiId: string;
  rfiCode: string;
  submittedByName: string;
  responseText: string;
  actorOrgName: string;
  attachedDocumentVersionIds?: string[];
}): Promise<MutationResult<RFIResponseRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const rpcPayload = {
    p_id: params.id,
    p_rfi_id: params.rfiId,
    p_submitted_by_user_name: params.submittedByName,
    p_response_text: params.responseText,
    p_actor_org_name: params.actorOrgName,
    p_attached_document_version_ids: params.attachedDocumentVersionIds ?? [],
  };

  const { error: rpcError } = await client.rpc("rpc_submit_rfi_response", rpcPayload);
  if (!rpcError) {
    return {
      data: {
        id: params.id,
        rfiId: params.rfiId,
        submittedByName: params.submittedByName,
        responseText: params.responseText,
        attachedDocumentVersionIds: params.attachedDocumentVersionIds ?? [],
        submittedAt: new Date().toISOString(),
      },
      error: null,
    };
  }

  if (!allowsFixtureData()) {
    return { data: null, error: new Error(`RFI response transaction failed: ${rpcError.message}`) };
  }

  // Fallback
  const now = new Date().toISOString();
  const { data, error } = await client.from("rfi_responses").insert({
    id: params.id,
    rfi_id: params.rfiId,
    submitted_by_user_name: params.submittedByName,
    response_text: params.responseText,
    attached_document_version_ids: params.attachedDocumentVersionIds ?? [],
    submitted_date: now.split("T")[0],
    review_status: "under_review",
    created_at: now,
  }).select().single();

  if (error) return { data: null, error: new Error(error.message) };

  await Promise.all([
    client.from("rfis").update({ status: "submitted_by_applicant" }).or(`id.eq.${params.rfiId},code.eq.${params.rfiId}`),
    insertAuditEvent({
      entityType: "rfi_response",
      entityId: params.rfiCode,
      actorName: params.submittedByName,
      actorOrgName: params.actorOrgName,
      actionType: "rfi_response_submitted",
      newValue: `Response submitted`,
      reason: params.responseText,
    }),
  ]);

  return {
    data: {
      id: String(data.id),
      rfiId: params.rfiId,
      submittedByName: params.submittedByName,
      responseText: params.responseText,
      attachedDocumentVersionIds: params.attachedDocumentVersionIds ?? [],
      submittedAt: now,
    },
    error: null,
  };
}

export async function mutateAcceptRFIResponse(params: {
  rfiId: string;
  rfiCode: string;
  workstreamId: string;
  actorName: string;
  actorOrgName: string;
  notes?: string;
}): Promise<MutationResult<{ success: boolean }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const rpcPayload = {
    p_rfi_id: params.rfiId,
    p_actor_name: params.actorName,
    p_actor_org_name: params.actorOrgName,
    p_notes: params.notes ?? "Response accepted and linked review resumed.",
  };

  const { error: rpcError } = await client.rpc("rpc_accept_rfi_response", rpcPayload);
  if (!rpcError) {
    return { data: { success: true }, error: null };
  }

  if (!allowsFixtureData()) {
    return { data: null, error: new Error(`RFI acceptance transaction failed: ${rpcError.message}`) };
  }

  // Fallback
  const now = new Date().toISOString();
  await Promise.all([
    client.from("rfi_responses").update({ review_status: "accepted", reviewer_feedback: params.notes ?? "Accepted" }).eq("rfi_id", params.rfiId),
    client.from("rfis").update({ status: "accepted" }).or(`id.eq.${params.rfiId},code.eq.${params.rfiId}`),
    client.from("workstreams").update({
      operational_state: "running",
      operational_state_label: "Running (Response Accepted)",
      waiting_reason: null,
      waiting_on_entity: null,
      updated_at: now,
    }).or(`id.eq.${params.workstreamId},code.eq.${params.workstreamId}`),
    insertAuditEvent({
      entityType: "rfi",
      entityId: params.rfiCode,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "rfi_response_accepted",
      oldValue: "submitted_by_applicant",
      newValue: "accepted",
      reason: params.notes ?? "Response accepted and linked review resumed.",
    }),
  ]);

  return { data: { success: true }, error: null };
}

// ====================================================================
// 5. WORKSTREAMS (BLOCKED, STAGE, ESCALATE, TRANSFER, NOTE)
// ====================================================================

export async function mutateClearWorkstreamBlocker(params: {
  workstreamId: string;
  resolutionNotes?: string;
  actorName: string;
  actorOrgName: string;
}): Promise<MutationResult<{ success: boolean }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_clear_workstream_blocker", {
    p_workstream_id: params.workstreamId,
    p_resolution_notes: params.resolutionNotes ?? "",
    p_actor_name: params.actorName,
    p_actor_org_name: params.actorOrgName,
  });
  if (error || !data) return { data: null, error: new Error(error?.message ?? "The blocker clear was not confirmed by the database.") };
  return { data: { success: true }, error: null };
}

export async function mutateMarkWorkstreamBlocked(params: {
  workstreamId: string;
  workstreamCode: string;
  reason: string;
  waitingOn: string;
  actorName: string;
  actorOrgName: string;
  pauseClock?: boolean;
}): Promise<MutationResult<WorkstreamRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const now = new Date().toISOString();
  const operationalState = params.pauseClock ? "waiting_government" : "blocked";
  const operationalStateLabel = params.pauseClock ? "Waiting on Government (Clock Paused)" : "Blocked (Action Required)";

  const { data: rpcData, error: rpcError } = await client.rpc("rpc_mark_workstream_blocked", {
    p_workstream_id: params.workstreamId,
    p_reason: params.reason,
    p_waiting_on: params.waitingOn,
    p_pause_clock: params.pauseClock ?? false,
    p_actor_name: params.actorName,
    p_actor_org_name: params.actorOrgName,
  });
  if (!rpcError && rpcData) return { data: rpcData as unknown as WorkstreamRecord, error: null };
  if (!allowsFixtureData()) return { data: null, error: new Error(`Blocker transaction failed: ${rpcError?.message ?? "no row returned"}`) };

  const { data, error } = await client
    .from("workstreams")
    .update({
      operational_state: operationalState,
      operational_state_label: operationalStateLabel,
      waiting_reason: params.reason,
      waiting_on_entity: params.waitingOn,
      updated_at: now,
    })
    .or(`id.eq.${params.workstreamId},code.eq.${params.workstreamId}`)
    .select()
    .single();

  if (error) return { data: null, error: new Error(error.message) };

  await insertAuditEvent({
    entityType: "workstream",
    entityId: params.workstreamCode,
    actorName: params.actorName,
    actorOrgName: params.actorOrgName,
    actionType: "blocked",
    newValue: operationalState,
    reason: `${params.reason} · Waiting on ${params.waitingOn}`,
  });

  return { data: data as unknown as WorkstreamRecord, error: null };
}

export async function mutateCompleteWorkstreamStage(params: {
  workstreamId: string;
  workstreamCode: string;
  nextStageName?: string;
  completedChecklists: string[];
  providedDocs?: string[];
  actorName: string;
  actorOrgName: string;
}): Promise<MutationResult<{ nextStageName: string }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const now = new Date().toISOString();
  const nextStage = params.nextStageName ?? "Complete & Ready for Final Determination";
  const isComplete = !params.nextStageName || params.nextStageName.toLowerCase().includes("complete");

  const { data: rpcData, error: rpcError } = await client.rpc("rpc_complete_workstream_stage", {
    p_workstream_id: params.workstreamId,
    p_completed_checklists: params.completedChecklists,
    p_provided_document_categories: params.providedDocs ?? [],
    p_actor_name: params.actorName,
    p_completion_notes: `Completed configured stage requirements: ${params.completedChecklists.join(", ")}`,
  });
  if (!rpcError && rpcData) {
    const result = rpcData as Record<string, unknown>;
    return { data: { nextStageName: String(result.nextStageName ?? nextStage) }, error: null };
  }
  if (!allowsFixtureData()) {
    return { data: null, error: new Error(`Workflow transition transaction failed: ${rpcError?.message ?? "no row returned"}`) };
  }

  const { error } = await client
    .from("workstreams")
    .update({
      current_stage_name: nextStage,
      operational_state: isComplete ? "complete" : "running",
      operational_state_label: isComplete ? "Complete" : `Running (${nextStage})`,
      waiting_reason: null,
      waiting_on_entity: null,
      actual_completion_date: isComplete ? now.split("T")[0] : null,
      updated_at: now,
    })
    .or(`id.eq.${params.workstreamId},code.eq.${params.workstreamId}`);

  if (error) return { data: null, error: new Error(error.message) };

  await Promise.all([
    insertAuditEvent({
      entityType: "workstream",
      entityId: params.workstreamCode,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "workflow_transition",
      newValue: nextStage,
      reason: `Completed configured stage requirements: ${params.completedChecklists.join(", ")}`,
    }),
    insertNotification({
      userId: "sarah.johnson@la.gov",
      title: `${params.workstreamCode} moved forward`,
      message: isComplete ? "The workstream is complete." : `The next action is ${nextStage}.`,
      type: "completion",
      linkUrl: `/workstreams/${params.workstreamCode}`,
      urgency: "info",
    }),
  ]);

  return { data: { nextStageName: nextStage }, error: null };
}

export async function mutateEscalateWorkstream(params: {
  workstreamId: string;
  workstreamCode: string;
  currentLevel: number;
  problemType: string;
  actorName: string;
  actorOrgName: string;
}): Promise<MutationResult<{ newLevel: number }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const now = new Date().toISOString();
  const nextLevel = Math.min(5, Math.max(1, params.currentLevel + 1));

  const { data: rpcData, error: rpcError } = await client.rpc("rpc_escalate_workstream", {
    p_workstream_id: params.workstreamId,
    p_problem_type: params.problemType,
    p_actor_name: params.actorName,
    p_actor_org_name: params.actorOrgName,
  });
  if (!rpcError && rpcData) {
    const row = rpcData as Record<string, unknown>;
    return { data: { newLevel: Number(row.newLevel ?? row.new_level ?? nextLevel) }, error: null };
  }
  if (!allowsFixtureData()) return { data: null, error: new Error(`Escalation transaction failed: ${rpcError?.message ?? "no row returned"}`) };

  const { error } = await client
    .from("workstreams")
    .update({
      operational_state: "escalated",
      operational_state_label: "Escalated for Help",
      escalation_level: nextLevel,
      escalation_triggered_at: now,
      escalation_summary: params.problemType,
      updated_at: now,
    })
    .or(`id.eq.${params.workstreamId},code.eq.${params.workstreamId}`);

  if (error) return { data: null, error: new Error(error.message) };

  const sideEffects = await Promise.all([
    insertAuditEvent({
      entityType: "workstream",
      entityId: params.workstreamCode,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "escalated",
      newValue: `Escalation ${nextLevel}: ${params.problemType}`,
      reason: params.problemType,
    }),
    insertNotification({
      userId: "maya.chen@spacex.com",
      title: `Help requested on ${params.workstreamCode}`,
      message: `${params.actorName} requested ${params.problemType}.`,
      type: "escalation",
      linkUrl: `/workstreams/${params.workstreamCode}`,
      urgency: "high",
    }),
  ]);

  const sideEffectError = sideEffects.find((result) => result.error)?.error;
  if (sideEffectError) return { data: null, error: sideEffectError };
  return { data: { newLevel: nextLevel }, error: null };
}

export async function mutateTransferWorkstream(params: {
  workstreamId: string;
  workstreamCode: string;
  transferType: string;
  targetName: string;
  actorName: string;
  actorOrgName: string;
  note?: string;
}): Promise<MutationResult<{ success: boolean }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data: rpcData, error: rpcError } = await client.rpc("rpc_transfer_workstream", {
    p_workstream_id: params.workstreamId,
    p_transfer_type: params.transferType,
    p_target_name: params.targetName,
    p_note: params.note ?? "",
    p_actor_name: params.actorName,
    p_actor_org_name: params.actorOrgName,
  });
  if (!rpcError && rpcData) return { data: { success: true }, error: null };
  if (!allowsFixtureData()) return { data: null, error: new Error(`Transfer transaction failed: ${rpcError?.message ?? "no row returned"}`) };
  const sideEffects = await Promise.all([
    insertAuditEvent({
      entityType: "workstream",
      entityId: params.workstreamCode,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "transfer_requested",
      newValue: `${params.transferType} → ${params.targetName}`,
      reason: params.note || "Help requested from supervisor.",
    }),
    insertNotification({
      userId: "maya.chen@spacex.com",
      title: `Transfer request for ${params.workstreamCode}`,
      message: `${params.actorName} requested ${params.transferType}.`,
      type: "action_required",
      linkUrl: `/workstreams/${params.workstreamCode}`,
      urgency: "high",
    }),
  ]);

  const sideEffectError = sideEffects.find((result) => result.error)?.error;
  if (sideEffectError) return { data: null, error: sideEffectError };
  return { data: { success: true }, error: null };
}

export async function mutateAddWorkstreamNote(params: {
  workstreamId: string;
  workstreamCode: string;
  note: string;
  actorName: string;
  actorOrgName: string;
}): Promise<MutationResult<{ success: boolean }>> {
  const result = await insertAuditEvent({
    entityType: "workstream",
    entityId: params.workstreamCode,
    actorName: params.actorName,
    actorOrgName: params.actorOrgName,
    actionType: "note_added",
    reason: params.note,
  });
  if (result.error) return { data: null, error: result.error };
  return { data: { success: true }, error: null };
}

// ====================================================================
// 6. COORDINATION REQUESTS & COMMITMENTS
// ====================================================================

export async function mutateCreateCoordinationRequest(params: {
  id: string;
  code: string;
  workstreamId: string;
  workstreamTitle: string;
  requestingOrgId: string;
  requestingOrgCode: string;
  targetOrgId: string;
  targetOrgCode: string;
  requestingUserName: string;
  assignedToUserName?: string;
  title: string;
  needDescription: string;
  dueDate: string;
  attachedDocumentVersionIds?: string[];
  priority?: "normal" | "high" | "critical_path";
}): Promise<MutationResult<CoordinationRequestRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data: rpcData, error: rpcError } = await client.rpc("rpc_create_coordination_request", {
    p_id: params.id,
    p_code: params.code,
    p_workstream_id: params.workstreamId,
    p_workstream_title: params.workstreamTitle,
    p_requesting_org_id: params.requestingOrgId,
    p_requesting_org_code: params.requestingOrgCode,
    p_target_org_id: params.targetOrgId,
    p_target_org_code: params.targetOrgCode,
    p_requesting_user_name: params.requestingUserName,
    p_assigned_to_user_name: params.assignedToUserName ?? null,
    p_title: params.title,
    p_need_description: params.needDescription,
    p_due_date: params.dueDate,
    p_attached_document_version_ids: params.attachedDocumentVersionIds ?? [],
    p_priority: params.priority ?? "normal",
  });
  if (!rpcError && rpcData) {
    const row = rpcData as Record<string, unknown>;
    return {
      data: {
        id: String(row.id),
        code: String(row.code),
        workstreamId: String(row.workstream_id ?? row.workstreamId),
        workstreamTitle: String(row.workstream_title ?? row.workstreamTitle),
        requestingOrgId: String(row.requesting_org_id ?? row.requestingOrgId),
        requestingOrgCode: String(row.requesting_org_code ?? row.requestingOrgCode),
        targetOrgId: String(row.target_org_id ?? row.targetOrgId),
        targetOrgCode: String(row.target_org_code ?? row.targetOrgCode),
        requestingUserName: String(row.requesting_user_name ?? row.requestingUserName),
        assignedToUserName: (row.assigned_to_user_name ?? row.assignedToUserName) as string | undefined,
        title: String(row.title),
        needDescription: String(row.need_description ?? row.needDescription),
        requestedDate: String(row.requested_date ?? row.requestedDate),
        dueDate: String(row.due_date ?? row.dueDate),
        attachedDocumentVersionIds: (row.attached_document_version_ids ?? row.attachedDocumentVersionIds ?? []) as string[],
        blocksWorkstreamTitle: String(row.blocks_workstream_title ?? row.blocksWorkstreamTitle),
        priority: String(row.priority) as CoordinationRequestRecord["priority"],
        status: String(row.status) as CoordinationRequestRecord["status"],
      },
      error: null,
    };
  }
  if (!allowsFixtureData()) return { data: null, error: new Error(`Coordination request transaction failed: ${rpcError?.message ?? "no row returned"}`) };

  const now = new Date().toISOString();
  const payload = {
    id: params.id,
    code: params.code,
    workstream_id: params.workstreamId,
    workstream_title: params.workstreamTitle,
    requesting_org_id: params.requestingOrgId,
    requesting_org_code: params.requestingOrgCode,
    target_org_id: params.targetOrgId,
    target_org_code: params.targetOrgCode,
    requesting_user_name: params.requestingUserName,
    assigned_to_user_name: params.assignedToUserName ?? null,
    title: params.title,
    need_description: params.needDescription,
    requested_date: now.split("T")[0],
    due_date: params.dueDate,
    attached_document_version_ids: params.attachedDocumentVersionIds ?? [],
    blocks_workstream_title: params.workstreamTitle,
    priority: params.priority ?? "normal",
    status: "pending",
    created_at: now,
  };

  const { data, error } = await client.from("coordination_requests").insert(payload).select().single();
  if (error) return { data: null, error: new Error(error.message) };

  await insertAuditEvent({
    entityType: "coordination_request",
    entityId: params.code,
    actorName: params.requestingUserName,
    actorOrgName: params.requestingOrgCode,
    actionType: "created",
    newValue: `Created ${params.code}: ${params.title} targeting ${params.targetOrgCode}`,
    reason: params.needDescription,
  });

  return {
    data: {
      id: String(data.id),
      code: String(data.code),
      workstreamId: params.workstreamId,
      workstreamTitle: params.workstreamTitle,
      requestingOrgId: params.requestingOrgId,
      requestingOrgCode: params.requestingOrgCode,
      targetOrgId: params.targetOrgId,
      targetOrgCode: params.targetOrgCode,
      requestingUserName: params.requestingUserName,
      assignedToUserName: params.assignedToUserName,
      title: params.title,
      needDescription: params.needDescription,
      requestedDate: now.split("T")[0],
      dueDate: params.dueDate,
      attachedDocumentVersionIds: params.attachedDocumentVersionIds ?? [],
      blocksWorkstreamTitle: params.workstreamTitle,
      priority: params.priority ?? "normal",
      status: "pending",
    },
    error: null,
  };
}

export async function mutateCreateCommitment(params: {
  id: string;
  workstreamId: string;
  workstreamTitle: string;
  committingOrgId: string;
  committingOrgCode: string;
  madeByPersonName: string;
  committedAction: string;
  originContext: string;
  promisedDueDate: string;
  impactIfMissed: string;
  isCriticalPathImpact?: boolean;
}): Promise<MutationResult<CommitmentRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const now = new Date().toISOString();
  const payload = {
    id: params.id,
    workstream_id: params.workstreamId,
    workstream_title: params.workstreamTitle,
    committing_org_id: params.committingOrgId,
    committing_org_code: params.committingOrgCode,
    made_by_person_name: params.madeByPersonName,
    committed_action: params.committedAction,
    origin_context: params.originContext,
    committed_date: now.split("T")[0],
    promised_due_date: params.promisedDueDate,
    status: "on_track",
    impact_if_missed: params.impactIfMissed,
    is_critical_path_impact: Boolean(params.isCriticalPathImpact),
    created_at: now,
  };

  const { data, error } = await client.from("commitments").insert(payload).select().single();
  if (error) return { data: null, error: new Error(error.message) };

  await insertAuditEvent({
    entityType: "commitment",
    entityId: params.id,
    actorName: params.madeByPersonName,
    actorOrgName: params.committingOrgCode,
    actionType: "committed",
    newValue: `Promised action: ${params.committedAction} by ${params.promisedDueDate}`,
    reason: params.originContext,
  });

  return {
    data: {
      id: String(data.id),
      workstreamId: params.workstreamId,
      workstreamTitle: params.workstreamTitle,
      committingOrgId: params.committingOrgId,
      committingOrgCode: params.committingOrgCode,
      madeByPersonName: params.madeByPersonName,
      committedAction: params.committedAction,
      originContext: params.originContext,
      committedDate: now.split("T")[0],
      promisedDueDate: params.promisedDueDate,
      status: "on_track",
      impactIfMissed: params.impactIfMissed,
      isCriticalPathImpact: Boolean(params.isCriticalPathImpact),
    },
    error: null,
  };
}

// ====================================================================
// 7. USER PROFILES & PARTICIPANTS (SELF-SERVICE & ADMIN)
// ====================================================================

export async function mutateUpdateUserProfile(params: {
  userId: string;
  updates: Partial<Pick<UserProfileRecord, "fullName" | "displayTitle" | "organizationName" | "organizationalUnit" | "workEmail" | "officePhone" | "mobilePhone" | "officeLocation" | "preferredContactMethod" | "availabilityStatus" | "projectRole" | "avatarUrl" | "isCustomerVisible" | "isActive">>;
  actorUserId: string;
  actorName: string;
  isAdmin?: boolean;
}): Promise<MutationResult<{ success: boolean }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (params.updates.displayTitle !== undefined) payload.display_title = params.updates.displayTitle;
  if (params.updates.organizationalUnit !== undefined) payload.organizational_unit = params.updates.organizationalUnit;
  if (params.updates.workEmail !== undefined) payload.work_email = params.updates.workEmail;
  if (params.updates.officePhone !== undefined) payload.office_phone = params.updates.officePhone;
  if (params.updates.mobilePhone !== undefined) payload.mobile_phone = params.updates.mobilePhone;
  if (params.updates.officeLocation !== undefined) payload.office_location = params.updates.officeLocation;
  if (params.updates.preferredContactMethod !== undefined) payload.preferred_contact_method = params.updates.preferredContactMethod;
  if (params.updates.availabilityStatus !== undefined) payload.availability_status = params.updates.availabilityStatus;
  if (params.updates.avatarUrl !== undefined) payload.avatar_url = params.updates.avatarUrl;

  if (params.isAdmin) {
    if (params.updates.fullName !== undefined) payload.full_name = params.updates.fullName;
    if (params.updates.organizationName !== undefined) payload.organization_name = params.updates.organizationName;
    if (params.updates.projectRole !== undefined) payload.project_role = params.updates.projectRole;
    if (params.updates.isCustomerVisible !== undefined) payload.is_customer_visible = params.updates.isCustomerVisible;
    if (params.updates.isActive !== undefined) payload.is_active = params.updates.isActive;
  }

  const { error } = await client
    .from("user_profiles")
    .update(payload)
    .or(`user_id.eq.${params.userId},id.eq.${params.userId}`);

  if (error) return { data: null, error: new Error(error.message) };

  await insertAuditEvent({
    entityType: "profile",
    entityId: params.userId,
    actorName: params.actorName,
    actorOrgName: "PATH",
    actionType: "profile_updated",
    newValue: Object.keys(params.updates).join(", "),
    reason: params.actorUserId === params.userId ? "Self-service profile update" : "Administrator profile update",
  });

  return { data: { success: true }, error: null };
}

export async function mutateSetOrganizationMemberRole(params: {
  userId: string;
  organizationId: string;
  role: OrganizationMembershipRecord["role"];
}): Promise<MutationResult<OrganizationMembershipRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };
  const { data, error } = await client.rpc("rpc_set_organization_member_role", {
    p_user_id: params.userId,
    p_organization_id: params.organizationId,
    p_role: params.role,
  });
  if (error || !data) return { data: null, error: new Error(error?.message ?? "Organization role change was not confirmed by the database.") };
  const row = data as Record<string, unknown>;
  return {
    data: {
      id: String(row.id),
      userId: String(row.user_id),
      organizationId: String(row.organization_id),
      role: String(row.role) as OrganizationMembershipRecord["role"],
      status: String(row.status) as OrganizationMembershipRecord["status"],
      effectiveFrom: String(row.effective_from),
      effectiveTo: row.effective_to ? String(row.effective_to) : undefined,
    },
    error: null,
  };
}

export async function mutateUpdateProjectParticipant(params: {
  participantId: string;
  updates: Partial<Pick<ProjectParticipantRecord, "organizationId" | "organizationName" | "projectRole" | "workstreamIds" | "assignedTaskIds" | "reviewResponsibility" | "notificationResponsibility" | "visibilityScope" | "startsOn" | "endsOn" | "isActive">>;
  actorName: string;
}): Promise<MutationResult<{ success: boolean }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const payload: Record<string, unknown> = {};
  if (params.updates.organizationId !== undefined) payload.organization_id = params.updates.organizationId;
  if (params.updates.organizationName !== undefined) payload.organization_name = params.updates.organizationName;
  if (params.updates.projectRole !== undefined) payload.project_role = params.updates.projectRole;
  if (params.updates.workstreamIds !== undefined) payload.workstream_ids = params.updates.workstreamIds;
  if (params.updates.assignedTaskIds !== undefined) payload.assigned_task_ids = params.updates.assignedTaskIds;
  if (params.updates.reviewResponsibility !== undefined) payload.review_responsibility = params.updates.reviewResponsibility;
  if (params.updates.notificationResponsibility !== undefined) payload.notification_responsibility = params.updates.notificationResponsibility;
  if (params.updates.visibilityScope !== undefined) payload.visibility_scope = params.updates.visibilityScope;
  if (params.updates.isActive !== undefined) payload.is_active = params.updates.isActive;

  const { error } = await client.from("project_participants").update(payload).eq("id", params.participantId);
  if (error) return { data: null, error: new Error(error.message) };

  await insertAuditEvent({
    entityType: "project_participant",
    entityId: params.participantId,
    actorName: params.actorName,
    actorOrgName: "PATH",
    actionType: "participant_updated",
    newValue: Object.keys(params.updates).join(", "),
    reason: "Administrator updated project participation controls",
  });

  return { data: { success: true }, error: null };
}

// ==========================================
// ITSM TICKET & ASSIGNMENT MUTATIONS (RPC WRAPPERS)
// ==========================================

export async function mutateAssignTicket(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  assignmentGroupId?: string;
  assignedToUserId?: string;
  assignmentNotes?: string;
  reason?: string;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data, error } = await client.rpc("rpc_assign_ticket", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_assignment_group_id: params.assignmentGroupId ?? null,
    p_assigned_to_user_id: params.assignedToUserId ?? null,
    p_assignment_notes: params.assignmentNotes ?? params.reason ?? null,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Ticket assignment was not confirmed by the database.") };
  }
  return { data, error: null };
}

export async function mutateUpdateTicketITSMState(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  targetState?: string;
  newState?: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
  pauseReason?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const targetState = params.newState ?? params.targetState;
  if (!targetState) {
    return { data: null, error: new Error("Target state is required for ITSM state update") };
  }

  const { data, error } = await client.rpc("rpc_update_ticket_itsm_state", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_new_state: targetState,
    p_reason: params.reason ?? null,
    p_pause_reason: params.pauseReason ?? null,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "ITSM state update was not confirmed by the database.") };
  }
  return { data, error: null };
}

export async function mutateSetTicketPriority(params: {
  ticketType: "workstream" | "customer_request" | "task";
  ticketId: string;
  priority: string;
  actorUserId?: string;
  actorName?: string;
  reason?: string;
}): Promise<MutationResult<any>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const { data, error } = await client.rpc("rpc_set_ticket_priority", {
    p_ticket_id: params.ticketId,
    p_ticket_type: params.ticketType,
    p_priority: params.priority,
    p_reason: params.reason ?? null,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Priority update was not confirmed by the database.") };
  }
  return { data, error: null };
}

export async function mutateManageAssignmentGroup(params: {
  action?: "create" | "update" | "deactivate";
  id?: string;
  groupId?: string;
  orgCode?: string;
  name?: string;
  description?: string;
  leadUserId?: string;
  active?: boolean;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<AssignmentGroupRecord>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const targetId = params.id ?? params.groupId ?? null;
  const isActive = params.active !== undefined ? params.active : params.action !== "deactivate";

  const { data, error } = await client.rpc("rpc_manage_assignment_group", {
    p_id: targetId,
    p_org_code: params.orgCode ?? null,
    p_name: params.name ?? null,
    p_description: params.description ?? null,
    p_lead_user_id: params.leadUserId ?? null,
    p_active: isActive,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Assignment group operation was not confirmed by the database.") };
  }

  const row = data as Record<string, unknown>;
  const record: AssignmentGroupRecord = {
    id: String(row.id ?? targetId ?? ""),
    orgCode: String(row.orgCode ?? params.orgCode ?? ""),
    organizationId: row.organizationId ? String(row.organizationId) : undefined,
    name: String(row.name ?? params.name ?? ""),
    description: String(row.description ?? params.description ?? ""),
    leadUserId: row.leadUserId ? String(row.leadUserId) : (params.leadUserId ?? undefined),
    active: row.active !== undefined ? Boolean(row.active) : isActive,
    createdAt: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };

  return { data: record, error: null };
}

export async function mutateManageAssignmentGroupMembership(params: {
  action?: "add" | "remove" | "update_role" | "upsert" | "delete";
  assignmentGroupId?: string;
  groupId?: string;
  userId: string;
  role?: "member" | "lead" | "backup" | string;
  membershipId?: string;
  actorUserId?: string;
  actorName?: string;
}): Promise<MutationResult<AssignmentGroupMembershipRecord | { success: boolean; action: string }>> {
  const client = getSupabaseBrowser();
  if (!client) return { data: null, error: new Error("Supabase client unavailable") };

  const assignmentGroupId = params.assignmentGroupId ?? params.groupId;
  if (!assignmentGroupId) {
    return { data: null, error: new Error("Assignment group ID is required for membership management") };
  }

  const isDelete = params.action === "remove" || params.action === "delete";
  const actionPayload = isDelete ? "delete" : "upsert";

  const { data, error } = await client.rpc("rpc_manage_assignment_group_membership", {
    p_assignment_group_id: assignmentGroupId,
    p_user_id: params.userId,
    p_role: params.role ?? "member",
    p_action: actionPayload,
  });

  if (error || !data) {
    return { data: null, error: new Error(error?.message ?? "Assignment group membership operation was not confirmed by the database.") };
  }

  if (isDelete) {
    return { data: { success: true, action: "deleted" }, error: null };
  }

  const row = data as Record<string, unknown>;
  const record: AssignmentGroupMembershipRecord = {
    id: String(row.id ?? params.membershipId ?? `${assignmentGroupId}-${params.userId}`),
    assignmentGroupId: String(row.assignmentGroupId ?? assignmentGroupId),
    userId: String(row.userId ?? params.userId),
    role: (String(row.role ?? params.role ?? "member") as "member" | "lead" | "backup"),
    createdAt: String(row.createdAt ?? row.updatedAt ?? new Date().toISOString()),
    updatedAt: String(row.updatedAt ?? new Date().toISOString()),
  };

  return { data: record, error: null };
}

