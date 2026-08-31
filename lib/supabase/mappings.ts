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
  OrganizationRecord,
  NotificationRecord,
  PermitTypeRecord,
  ProjectParticipantRecord,
  ProjectRecord,
  RequirementResourceRecord,
  RFIRecord,
  RFIResponseRecord,
  TaskRecord,
  UserProfileRecord,
  WorkstreamRecord,
} from "../domain-models";

type Row = Record<string, unknown>;

export function organizationRowToDomain(row: Row): OrganizationRecord {
  const contacts = obj<Record<string, string>>(row.contacts, {});
  const jurisdiction = str(row.jurisdiction_level, "state");
  return {
    id: str(row.id),
    code: str(row.code),
    name: str(row.name),
    abbreviation: contacts.abbreviation || str(row.code),
    jurisdictionLevel: (jurisdiction === "federal" ? "Federal" : jurisdiction === "local" ? "Local / Parish" : jurisdiction === "external_partner" ? "Applicant" : "State") as OrganizationRecord["jurisdictionLevel"],
    websiteUrl: contacts.websiteUrl || undefined,
    generalContactEmail: contacts.generalContactEmail || undefined,
    workingHours: contacts.workingHours || "Agency schedule",
    holidayCalendar: contacts.holidayCalendar || "Agency holidays",
    defaultSlaDays: Number(row.default_sla_days ?? contacts.defaultSlaDays ?? 30),
    documentRetentionYears: Number(row.document_retention_years ?? contacts.documentRetentionYears ?? 7),
    isActive: Boolean(row.active ?? true),
  };
}

function str(val: unknown, fallback = ""): string {
  if (typeof val === "string") return val;
  if (val != null) return String(val);
  return fallback;
}

function num(val: unknown, fallback = 0): number {
  if (typeof val === "number" && !Number.isNaN(val)) return val;
  if (typeof val === "string") {
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function bool(val: unknown, fallback = false): boolean {
  if (typeof val === "boolean") return val;
  if (val === "true" || val === 1 || val === "1") return true;
  if (val === "false" || val === 0 || val === "0") return false;
  return fallback;
}

function arr<T = unknown>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {}
  }
  return [];
}

function obj<T = Record<string, unknown>>(val: unknown, fallback = {}): T {
  if (val && typeof val === "object" && !Array.isArray(val)) return val as T;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as T;
    } catch {}
  }
  return fallback as T;
}

// ====================================================================
// 1. WORKSTREAMS
// ====================================================================

export function workstreamRowToDomain(row: Row): WorkstreamRecord {
  const concierge = obj<{ name?: string; title?: string; agency?: string; email?: string; phone?: string }>(row.state_concierge, {});
  const lead = obj<{ orgCode?: string; orgName?: string; jurisdictionLevel?: string; assignedReviewerName?: string; assignedReviewerEmail?: string }>(row.regulatory_lead, {});
  const sixQ = obj<{ currentActionSummary?: string; nextExpectedEvent?: string; customerActionRequired?: string; primaryDelayReason?: string }>(row.six_questions, {});

  return {
    id: str(row.id),
    projectId: str(row.project_id),
    code: str(row.code),
    title: str(row.title),
    category: (str(row.category, "permit")) as WorkstreamRecord["category"],
    categoryLabel: str(row.category_label || (str(row.category).toUpperCase())),
    permitTypeId: str(row.permit_type_id) || undefined,
    permitTypeCode: str(row.permit_type_code) || undefined,
    workflowVersionId: str(row.workflow_version_id) || undefined,
    currentStageId: str(row.current_stage_id) || undefined,
    currentStageName: str(row.current_stage_name),
    governmentConcierge: {
      name: str(concierge.name, "Sarah Johnson"),
      title: str(concierge.title, "State Project Manager"),
      agency: str(concierge.agency, "Louisiana Governor's Office"),
      email: str(concierge.email, "sarah.johnson@la.gov"),
      phone: str(concierge.phone, "(225) 342-7000"),
    },
    regulatoryLead: {
      orgCode: str(lead.orgCode, "LDEQ"),
      orgName: str(lead.orgName, "Louisiana Department of Environmental Quality"),
      jurisdictionLevel: (str(lead.jurisdictionLevel, "State")) as WorkstreamRecord["regulatoryLead"]["jurisdictionLevel"],
      assignedReviewerName: str(lead.assignedReviewerName, "Jordan Lee"),
      assignedReviewerEmail: str(lead.assignedReviewerEmail, "jordan.lee@la.gov"),
    },
    assignedReviewerUserId: str(row.assigned_reviewer_user_id) || undefined,
    operationalState: (str(row.operational_state, "running")) as WorkstreamRecord["operationalState"],
    operationalStateLabel: str(row.operational_state_label, "Running"),
    ragHealth: (str(row.rag_status, "green")) as WorkstreamRecord["ragHealth"],
    isCriticalPath: bool(row.is_critical_path),
    baselineStartDate: str(row.baseline_start_date || row.created_at || new Date().toISOString().split("T")[0]),
    baselineTargetDate: str(row.baseline_target_date || new Date().toISOString().split("T")[0]),
    forecastStartDate: str(row.forecast_start_date || row.created_at || new Date().toISOString().split("T")[0]),
    forecastTargetDate: str(row.forecast_target_date || new Date().toISOString().split("T")[0]),
    actualStartDate: str(row.actual_start_date) || undefined,
    actualCompletionDate: str(row.actual_completion_date) || undefined,
    scheduleVarianceDays: num(row.schedule_variance_days),
    controllingDependencyTitle: str(row.controlling_dependency_title) || undefined,
    currentActionSummary: str(row.current_action_summary || sixQ.currentActionSummary || "Technical review in progress."),
    waitingReason: str(row.waiting_reason) || undefined,
    waitingOnEntity: str(row.waiting_on_entity) || undefined,
    nextExpectedEvent: str(sixQ.nextExpectedEvent || "Next scheduled milestone review."),
    customerActionRequired: str(sixQ.customerActionRequired || "No action currently required."),
    primaryDelayReason: (str(sixQ.primaryDelayReason || row.primary_delay_reason || "none")) as WorkstreamRecord["primaryDelayReason"],
    delayNotes: str(row.delay_notes) || undefined,
    escalationLevel: num(row.escalation_level, 0) as WorkstreamRecord["escalationLevel"],
    escalationTriggeredAt: str(row.escalation_triggered_at) || undefined,
    escalationSummary: str(row.escalation_summary) || undefined,
    tasks: [],
    commitments: [],
    coordinationRequests: [],
    rfis: [],
  };
}

export function domainToWorkstreamRow(domain: Partial<WorkstreamRecord>): Row {
  return {
    ...(domain.id && { id: domain.id }),
    ...(domain.projectId && { project_id: domain.projectId }),
    ...(domain.code && { code: domain.code }),
    ...(domain.title && { title: domain.title }),
    ...(domain.category && { category: domain.category }),
    ...(domain.permitTypeId && { permit_type_id: domain.permitTypeId }),
    ...(domain.currentStageName && { current_stage_name: domain.currentStageName }),
    ...(domain.operationalState && { operational_state: domain.operationalState }),
    ...(domain.operationalStateLabel && { operational_state_label: domain.operationalStateLabel }),
    ...(domain.ragHealth && { rag_status: domain.ragHealth, rag_label: domain.ragHealth === "red" ? "Blocked / Escalated" : domain.ragHealth === "yellow" ? "Action Needed" : "On Track" }),
    ...(domain.isCriticalPath !== undefined && { is_critical_path: domain.isCriticalPath }),
    ...(domain.baselineTargetDate && { baseline_target_date: domain.baselineTargetDate }),
    ...(domain.forecastTargetDate && { forecast_target_date: domain.forecastTargetDate }),
    ...(domain.scheduleVarianceDays !== undefined && { schedule_variance_days: domain.scheduleVarianceDays }),
    ...(domain.governmentConcierge && { state_concierge: domain.governmentConcierge }),
    ...(domain.regulatoryLead && { regulatory_lead: domain.regulatoryLead }),
    ...(domain.waitingReason !== undefined && { waiting_reason: domain.waitingReason }),
    ...(domain.waitingOnEntity !== undefined && { waiting_on_entity: domain.waitingOnEntity }),
    ...(domain.currentActionSummary && { current_action_summary: domain.currentActionSummary }),
    ...(domain.escalationLevel !== undefined && { escalation_level: domain.escalationLevel }),
    ...(domain.escalationTriggeredAt !== undefined && { escalation_triggered_at: domain.escalationTriggeredAt }),
    ...(domain.escalationSummary !== undefined && { escalation_summary: domain.escalationSummary }),
    ...(domain.actualCompletionDate !== undefined && { actual_completion_date: domain.actualCompletionDate }),
    updated_at: new Date().toISOString(),
  };
}

// ====================================================================
// 2. TASKS
// ====================================================================

export function taskRowToDomain(row: Row): TaskRecord {
  return {
    id: str(row.id),
    workstreamId: str(row.workstream_id),
    stageId: str(row.stage_id) || undefined,
    title: str(row.title),
    description: str(row.description) || undefined,
    taskType: (str(row.task_type || "agency_review")) as TaskRecord["taskType"],
    assignedOrgId: str(row.assigned_org_id),
    assignedOrgCode: str(row.assigned_org_code || str(row.task_code).split("-")[0] || "DOTD"),
    assignedUserName: str(row.assigned_user_name) || undefined,
    assignedUserId: str(row.assigned_user_id) || undefined,
    status: (str(row.status, "pending")) as TaskRecord["status"],
    isMilestone: bool(row.is_milestone),
    isCriticalPath: bool(row.is_critical_path),
    baselineStartDate: str(row.baseline_start_date || row.early_start) || undefined,
    baselineDueDate: str(row.baseline_due_date || row.early_finish) || undefined,
    forecastStartDate: str(row.forecast_start_date || row.late_start) || undefined,
    forecastDueDate: str(row.forecast_due_date || row.late_finish) || undefined,
    actualCompletionDate: str(row.actual_completion_date) || undefined,
    durationDays: num(row.duration_days, 1),
    floatDays: num(row.float_days, 0),
    predecessorTaskIds: arr<string>(row.predecessors),
  };
}

// ====================================================================
// 3. COORDINATION REQUESTS (CR-00xxx)
// ====================================================================

export function coordinationRequestRowToDomain(row: Row): CoordinationRequestRecord {
  return {
    id: str(row.id),
    code: str(row.code),
    workstreamId: str(row.workstream_id),
    workstreamTitle: str(row.workstream_title),
    requestingOrgId: str(row.requesting_org_id),
    requestingOrgCode: str(row.requesting_org_code),
    targetOrgId: str(row.target_org_id),
    targetOrgCode: str(row.target_org_code),
    requestingUserName: str(row.requesting_user_name),
    assignedToUserName: str(row.assigned_to_user_name) || undefined,
    title: str(row.title),
    needDescription: str(row.need_description),
    requestedDate: str(row.requested_date),
    dueDate: str(row.due_date),
    responseDate: str(row.response_date) || undefined,
    concurredAt: str(row.concurred_at) || undefined,
    attachedDocumentVersionIds: arr<string>(row.attached_document_version_ids),
    blocksWorkstreamTitle: str(row.blocks_workstream_title || row.workstream_title),
    priority: (str(row.priority, "normal")) as CoordinationRequestRecord["priority"],
    status: (str(row.status, "pending")) as CoordinationRequestRecord["status"],
    responseSummary: str(row.response_summary) || undefined,
  };
}

export function domainToCoordinationRequestRow(domain: Partial<CoordinationRequestRecord>): Row {
  return {
    ...(domain.id && { id: domain.id }),
    ...(domain.code && { code: domain.code }),
    ...(domain.workstreamId && { workstream_id: domain.workstreamId }),
    ...(domain.workstreamTitle && { workstream_title: domain.workstreamTitle }),
    ...(domain.requestingOrgId && { requesting_org_id: domain.requestingOrgId }),
    ...(domain.requestingOrgCode && { requesting_org_code: domain.requestingOrgCode }),
    ...(domain.targetOrgId && { target_org_id: domain.targetOrgId }),
    ...(domain.targetOrgCode && { target_org_code: domain.targetOrgCode }),
    ...(domain.requestingUserName && { requesting_user_name: domain.requestingUserName }),
    ...(domain.assignedToUserName !== undefined && { assigned_to_user_name: domain.assignedToUserName }),
    ...(domain.title && { title: domain.title }),
    ...(domain.needDescription && { need_description: domain.needDescription }),
    ...(domain.requestedDate && { requested_date: domain.requestedDate }),
    ...(domain.dueDate && { due_date: domain.dueDate }),
    ...(domain.responseDate !== undefined && { response_date: domain.responseDate }),
    ...(domain.concurredAt !== undefined && { concurred_at: domain.concurredAt }),
    ...(domain.attachedDocumentVersionIds && { attached_document_version_ids: domain.attachedDocumentVersionIds }),
    ...(domain.blocksWorkstreamTitle && { blocks_workstream_title: domain.blocksWorkstreamTitle }),
    ...(domain.priority && { priority: domain.priority }),
    ...(domain.status && { status: domain.status }),
    ...(domain.responseSummary !== undefined && { response_summary: domain.responseSummary }),
  };
}

// ====================================================================
// 4. RFIs & RESPONSES
// ====================================================================

export function rfiResponseRowToDomain(row: Row): RFIResponseRecord {
  return {
    id: str(row.id),
    rfiId: str(row.rfi_id),
    submittedByName: str(row.submitted_by_user_name || row.submitted_by_name),
    responseText: str(row.response_text),
    attachedDocumentVersionIds: arr<string>(row.attached_document_version_ids),
    submittedAt: str(row.submitted_date || row.created_at || new Date().toISOString()),
    reviewedByName: str(row.reviewed_by_name) || undefined,
    reviewDecision: (str(row.review_status || row.review_decision) || undefined) as RFIResponseRecord["reviewDecision"],
    reviewNotes: str(row.reviewer_feedback || row.review_notes) || undefined,
    reviewedAt: str(row.reviewed_at) || undefined,
  };
}

export function rfiRowToDomain(row: Row, responses: RFIResponseRecord[] = []): RFIRecord {
  return {
    id: str(row.id),
    code: str(row.code),
    workstreamId: str(row.workstream_id),
    workstreamTitle: str(row.workstream_title),
    requestingOrgId: str(row.requesting_org_id),
    requestingOrgCode: str(row.requesting_org_code),
    recipientOrgId: str(row.recipient_org_id),
    recipientOrgCode: str(row.recipient_org_code),
    title: str(row.title),
    questionText: str(row.question_text),
    technicalReason: str(row.technical_reason),
    requiredDocumentTypes: arr<string>(row.required_document_types),
    issuedDate: str(row.issued_date),
    responseDeadline: str(row.response_deadline),
    clockImpact: (str(row.clock_impact, "clock_paused")) as RFIRecord["clockImpact"],
    scheduleImpactDays: num(row.schedule_impact_days, 0),
    status: (str(row.status, "issued")) as RFIRecord["status"],
    isConsolidatedCycle: bool(row.is_consolidated_cycle),
    consolidatedBatchId: str(row.consolidated_batch_id) || undefined,
    leadReviewerApprovedAt: str(row.lead_reviewer_approved_at) || undefined,
    responses,
  };
}

export function domainToRfiRow(domain: Partial<RFIRecord>): Row {
  return {
    ...(domain.id && { id: domain.id }),
    ...(domain.code && { code: domain.code }),
    ...(domain.workstreamId && { workstream_id: domain.workstreamId }),
    ...(domain.workstreamTitle && { workstream_title: domain.workstreamTitle }),
    ...(domain.requestingOrgId && { requesting_org_id: domain.requestingOrgId }),
    ...(domain.requestingOrgCode && { requesting_org_code: domain.requestingOrgCode }),
    ...(domain.recipientOrgId && { recipient_org_id: domain.recipientOrgId }),
    ...(domain.recipientOrgCode && { recipient_org_code: domain.recipientOrgCode }),
    ...(domain.title && { title: domain.title }),
    ...(domain.questionText && { question_text: domain.questionText }),
    ...(domain.technicalReason && { technical_reason: domain.technicalReason }),
    ...(domain.requiredDocumentTypes && { required_document_types: domain.requiredDocumentTypes }),
    ...(domain.issuedDate && { issued_date: domain.issuedDate }),
    ...(domain.responseDeadline && { response_deadline: domain.responseDeadline }),
    ...(domain.clockImpact && { clock_impact: domain.clockImpact }),
    ...(domain.scheduleImpactDays !== undefined && { schedule_impact_days: domain.scheduleImpactDays }),
    ...(domain.status && { status: domain.status }),
    ...(domain.isConsolidatedCycle !== undefined && { is_consolidated_cycle: domain.isConsolidatedCycle }),
  };
}

// ====================================================================
// 5. DOCUMENTS, VERSIONS, & REVIEWS
// ====================================================================

export function documentAgencyReviewRowToDomain(row: Row): DocumentAgencyReviewRecord {
  return {
    id: str(row.id),
    documentVersionId: str(row.document_version_id),
    workstreamId: str(row.workstream_id),
    reviewingOrgId: str(row.reviewing_org_id) || undefined,
    reviewingOrgCode: str(row.reviewing_org_code),
    reviewStatus: (str(row.review_status || row.status, "under_review")) as DocumentAgencyReviewRecord["reviewStatus"],
    reviewedByName: str(row.reviewed_by_user_name || row.reviewed_by_name) || undefined,
    decisionDate: str(row.decision_date || row.reviewed_at) || undefined,
    reviewComments: str(row.comments || row.review_comments) || undefined,
    status: str(row.status || "under_review"),
    reviewedByUserName: str(row.reviewed_by_user_name || row.reviewed_by_name) || undefined,
    reviewedAt: str(row.reviewed_at) || undefined,
    comments: str(row.comments) || undefined,
  };
}

export function documentVersionRowToDomain(row: Row, reviews: DocumentAgencyReviewRecord[] = []): DocumentVersionRecord {
  return {
    id: str(row.id),
    documentId: str(row.document_id || row.document_ref_id),
    versionTag: str(row.version_label || row.version_tag || `v${row.version_number || 1}.0`),
    versionNumber: num(row.version_number, 1),
    versionLabel: str(row.version_label || `v${row.version_number || 1}.0`),
    fileName: str(row.file_name || str(row.storage_path).split("/").pop() || "document.pdf"),
    fileSizeBytes: num(row.file_size_bytes, 0),
    mimeType: str(row.mime_type, "application/pdf"),
    storagePath: str(row.storage_path),
    storageUri: str(row.storage_uri || row.storage_path),
    sha256Hash: str(row.sha256_hash),
    uploadedByName: str(row.uploaded_by_name),
    uploadedByOrgName: str(row.uploaded_by_org_name || "SpaceX"),
    changeNotes: str(row.change_notes || row.change_summary),
    changeSummary: str(row.change_notes || row.change_summary),
    isMalwareClean: bool(row.is_malware_clean, true),
    status: (str(row.status, "under_review")) as DocumentVersionRecord["status"],
    uploadedAt: str(row.uploaded_at || row.created_at || new Date().toISOString()),
    agencyReviews: reviews.length > 0 ? reviews : arr<DocumentAgencyReviewRecord>(row.agency_reviews),
  };
}

export function documentRowToDomain(
  row: Row,
  versions: DocumentVersionRecord[] = [],
  allReviews: DocumentAgencyReviewRecord[] = []
): DocumentRecord {
  const highestVersionNumber = versions.reduce(
    (highest, version) => Math.max(highest, version.versionNumber ?? 0),
    0,
  );
  const declaredVersionNumber = Math.max(
    num(row.current_version_number, 0),
    num(row.version, 0),
  );
  const currentVersionNumber = Math.max(highestVersionNumber, declaredVersionNumber, 1);
  const currentVersion = versions.find(
    (version) => (version.versionNumber ?? 0) === currentVersionNumber,
  ) ?? versions[0];

  return {
    id: str(row.id),
    projectId: str(row.project_id),
    title: str(row.title || row.document_type || "Project Document"),
    category: str(row.category || row.document_type || "Technical Spec"),
    ownerOrgCode: str(row.owner_org_code || "SPACEX"),
    currentVersionNumber,
    currentVersionId: currentVersion?.id,
    isConfidential: bool(row.is_confidential || (row.visibility === "restricted")),
    versions,
    agencyReviews: allReviews,
  };
}

// ====================================================================
// 6. COMMITMENTS
// ====================================================================

export function commitmentRowToDomain(row: Row): CommitmentRecord {
  return {
    id: str(row.id),
    workstreamId: str(row.workstream_id),
    workstreamTitle: str(row.workstream_title) || undefined,
    committingOrgId: str(row.committing_org_id),
    committingOrgCode: str(row.committing_org_code),
    madeByPersonName: str(row.made_by_person_name),
    committedAction: str(row.committed_action),
    originContext: str(row.origin_context),
    committedDate: str(row.committed_date),
    promisedDueDate: str(row.promised_due_date),
    fulfilledDate: str(row.fulfilled_date) || undefined,
    status: (str(row.status, "on_track")) as CommitmentRecord["status"],
    impactIfMissed: str(row.impact_if_missed),
    isCriticalPathImpact: bool(row.is_critical_path_impact),
  };
}

export function domainToCommitmentRow(domain: Partial<CommitmentRecord>): Row {
  return {
    ...(domain.id && { id: domain.id }),
    ...(domain.workstreamId && { workstream_id: domain.workstreamId }),
    ...(domain.workstreamTitle && { workstream_title: domain.workstreamTitle }),
    ...(domain.committingOrgId && { committing_org_id: domain.committingOrgId }),
    ...(domain.committingOrgCode && { committing_org_code: domain.committingOrgCode }),
    ...(domain.madeByPersonName && { made_by_person_name: domain.madeByPersonName }),
    ...(domain.committedAction && { committed_action: domain.committedAction }),
    ...(domain.originContext && { origin_context: domain.originContext }),
    ...(domain.committedDate && { committed_date: domain.committedDate }),
    ...(domain.promisedDueDate && { promised_due_date: domain.promisedDueDate }),
    ...(domain.fulfilledDate !== undefined && { fulfilled_date: domain.fulfilledDate }),
    ...(domain.status && { status: domain.status }),
    ...(domain.impactIfMissed && { impact_if_missed: domain.impactIfMissed }),
    ...(domain.isCriticalPathImpact !== undefined && { is_critical_path_impact: domain.isCriticalPathImpact }),
  };
}

// ====================================================================
// 7. DECISIONS & MEETINGS
// ====================================================================

export function decisionRowToDomain(row: Row): DecisionRecord {
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    decisionDate: str(row.decision_date),
    title: str(row.title),
    decisionSummary: str(row.decision_summary),
    decisionMakerName: str(row.decision_maker_name),
    decisionMakerTitle: str(row.decision_maker_title),
    organizationsRepresented: arr<string>(row.organizations_represented),
    statutoryAuthority: str(row.statutory_authority),
    affectedWorkstreamIds: arr<string>(row.affected_workstream_ids),
    affectedWorkstreamTitles: arr<string>(row.affected_workstream_titles),
    referencedDocumentVersionIds: arr<string>(row.referenced_document_version_ids),
    requiredFollowUps: str(row.required_follow_ups) || undefined,
  };
}

export function meetingRowToDomain(row: Row): MeetingRecord {
  const converted = obj<{ tasksCreated?: number; commitmentsCreated?: number; decisionsLogged?: number }>(row.action_items_converted, {});
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    title: str(row.title),
    meetingDate: str(row.meeting_date),
    locationOrLink: str(row.location_or_link),
    attendeeList: arr<string>(row.attendee_list),
    meetingNotes: str(row.meeting_notes),
    relatedWorkstreamIds: arr<string>(row.related_workstream_ids),
    actionItemsConverted: {
      tasksCreated: num(converted.tasksCreated, 0),
      commitmentsCreated: num(converted.commitmentsCreated, 0),
      decisionsLogged: num(converted.decisionsLogged, 0),
    },
  };
}

// ====================================================================
// 8. USER PROFILES & PROJECT PARTICIPANTS
// ====================================================================

export function userProfileRowToDomain(row: Row): UserProfileRecord {
  return {
    id: str(row.id),
    userId: str(row.user_id),
    fullName: str(row.full_name),
    displayTitle: str(row.display_title),
    organizationId: str(row.organization_id),
    organizationName: str(row.organization_name),
    organizationalUnit: str(row.organizational_unit) || undefined,
    workEmail: str(row.work_email),
    officePhone: str(row.office_phone) || undefined,
    mobilePhone: str(row.mobile_phone) || undefined,
    officeLocation: str(row.office_location) || undefined,
    preferredContactMethod: (str(row.preferred_contact_method, "email")) as UserProfileRecord["preferredContactMethod"],
    availabilityStatus: (str(row.availability_status, "available")) as UserProfileRecord["availabilityStatus"],
    projectRole: str(row.project_role),
    avatarUrl: str(row.avatar_url) || undefined,
    isCustomerVisible: bool(row.is_customer_visible, true),
    isActive: bool(row.is_active, true),
  };
}

export function projectParticipantRowToDomain(row: Row): ProjectParticipantRecord {
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    userId: str(row.user_id),
    organizationId: str(row.organization_id),
    organizationName: str(row.organization_name),
    projectRole: str(row.project_role || row.participation_role),
    workstreamIds: arr<string>(row.workstream_ids),
    assignedTaskIds: arr<string>(row.assigned_task_ids),
    reviewResponsibility: arr<string>(row.review_responsibility),
    notificationResponsibility: arr<string>(row.notification_responsibility),
    visibilityScope: (str(row.visibility_scope || row.access_scope, "project")) as ProjectParticipantRecord["visibilityScope"],
    startsOn: str(row.starts_on) || undefined,
    endsOn: str(row.ends_on || row.expires_at) || undefined,
    isActive: bool(row.is_active, true),
  };
}

// ====================================================================
// 9. EXTERNAL FILINGS & CUSTOMER REQUESTS
// ====================================================================

export function externalFilingRowToDomain(row: Row): ExternalFilingRecord {
  return {
    id: str(row.id),
    projectId: str(row.project_id),
    workstreamId: str(row.workstream_id),
    permitTypeId: str(row.permit_type_id) || undefined,
    authorityOrganizationId: str(row.authority_organization_id),
    authorityOrganizationName: str(row.authority_organization_name),
    filingMethod: (str(row.filing_method, "EXTERNAL_PORTAL")) as ExternalFilingRecord["filingMethod"],
    officialPortalUrl: str(row.official_portal_url) || undefined,
    externalReferenceNumber: str(row.external_reference_number) || undefined,
    externalRecordUrl: str(row.external_record_url) || undefined,
    externalStatus: (str(row.external_status, "not_started")) as ExternalFilingRecord["externalStatus"],
    submittedAt: str(row.submitted_at) || undefined,
    submittedByUserId: str(row.submitted_by_user_id) || undefined,
    submittedByName: str(row.submitted_by_name) || undefined,
    lastStatusVerifiedAt: str(row.last_status_verified_at) || undefined,
    lastStatusVerifiedBy: str(row.last_status_verified_by) || undefined,
    authoritativeSystemName: str(row.authoritative_system_name) || undefined,
    notes: str(row.notes) || undefined,
    receiptDocumentVersionIds: arr<string>(row.receipt_document_version_ids),
    createdAt: str(row.created_at || new Date().toISOString()),
    updatedAt: str(row.updated_at || new Date().toISOString()),
  };
}

export function customerRequestRowToDomain(row: Row): CustomerRequestRecord {
  return {
    id: str(row.id),
    confirmationNumber: str(row.confirmation_number),
    projectId: str(row.project_id),
    requestType: (str(row.request_type, "permit_authorization")) as CustomerRequestRecord["requestType"],
    title: str(row.title),
    description: str(row.description),
    requestedOutcome: str(row.requested_outcome) || undefined,
    locationOrAffectedArea: str(row.location_or_affected_area) || undefined,
    desiredDate: str(row.desired_date) || undefined,
    scheduleImportance: (str(row.schedule_importance, "normal")) as CustomerRequestRecord["scheduleImportance"],
    knownAgencyCode: str(row.known_agency_code) || undefined,
    knownPermitTypeId: str(row.known_permit_type_id) || undefined,
    submittedByUserId: str(row.submitted_by_user_id) || undefined,
    submittedByName: str(row.submitted_by_name, "SpaceX Representative"),
    relatedWorkstreamId: str(row.related_workstream_id) || undefined,
    blocksActiveWork: bool(row.blocks_active_work),
    status: (str(row.status, "submitted")) as CustomerRequestRecord["status"],
    attachmentDocumentVersionIds: arr<string>(row.attachment_document_version_ids),
    createdAt: str(row.created_at || new Date().toISOString()),
    updatedAt: str(row.updated_at || new Date().toISOString()),
  };
}

// ====================================================================
// 10. AUDIT EVENTS & NOTIFICATIONS
// ====================================================================

export function auditEventRowToDomain(row: Row): AuditEventRecord {
  return {
    id: str(row.id),
    entityType: str(row.entity_type || row.resource_type || "project"),
    entityId: str(row.entity_id || row.resource_id || "PRJ-PECAN-2026"),
    actorName: str(row.actor_name || "PATH user"),
    actorOrgName: str(row.actor_org_name || "PATH"),
    actionType: str(row.action_type || row.action || "action"),
    oldValue: str(row.old_value) || undefined,
    newValue: str(row.new_value) || undefined,
    reason: str(row.reason) || undefined,
    sourceChannel: "in_app",
    occurredAt: str(row.created_at || new Date().toISOString()),
  };
}

export function notificationRowToDomain(row: Row): NotificationRecord {
  return {
    id: str(row.id),
    userId: str(row.user_id || row.recipient_id),
    title: str(row.title),
    message: str(row.message || row.body),
    type: (str(row.type || row.event_type, "status_update")) as NotificationRecord["type"],
    linkUrl: str(row.link_url) || undefined,
    urgency: (str(row.urgency, "info")) as NotificationRecord["urgency"],
    metadata: obj<Record<string, unknown>>(row.metadata, {}),
    createdAt: str(row.created_at || new Date().toISOString()),
    isRead: bool(row.is_read || (row.delivery_status === "read")),
  };
}

// ====================================================================
// 11. PERMIT TYPES & REQUIREMENT RESOURCES
// ====================================================================

export function requirementResourceRowToDomain(row: Row): RequirementResourceRecord {
  return {
    id: str(row.id),
    permitTypeId: str(row.permit_type_id),
    resourceName: str(row.resource_name),
    resourceType: (str(row.resource_type, "portal_url")) as RequirementResourceRecord["resourceType"],
    url: str(row.url),
    versionTag: str(row.version_tag, "Current"),
    verifiedAt: str(row.verified_at || new Date().toISOString()),
    verifiedBy: str(row.verified_by, "PATH Team"),
    isStale: bool(row.is_stale),
  };
}

export function permitTypeRowToDomain(row: Row, resources: RequirementResourceRecord[] = []): PermitTypeRecord {
  return {
    id: str(row.id),
    code: str(row.code),
    name: str(row.name),
    category: (str(row.category, "permit")) as PermitTypeRecord["category"],
    responsibleOrgId: str(row.responsible_org_id),
    responsibleOrgCode: str(row.responsible_org_code),
    triggerExplanation: str(row.trigger_explanation),
    statutoryCitation: str(row.statutory_citation),
    officialFilingUrl: str(row.official_filing_url) || undefined,
    applicationFormUrl: str(row.application_form_url) || undefined,
    instructionsUrl: str(row.instructions_url) || undefined,
    expectedLeadTimeDays: num(row.expected_lead_time_days, 30),
    minimumStatutoryDays: num(row.minimum_statutory_days, 10),
    publicNoticeRequired: bool(row.public_notice_required),
    publicNoticeDays: num(row.public_notice_days, 0),
    prerequisites: arr<string>(row.prerequisites),
    relatedPermitTypeIds: arr<string>(row.related_permit_type_ids),
    lastVerifiedAt: str(row.last_verified_at) || undefined,
    verificationStatus: (str(row.verification_status, "verified")) as PermitTypeRecord["verificationStatus"],
    resources,
  };
}
