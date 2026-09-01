// ==========================================
// LOUISIANA PROJECT DELIVERY COMMAND SYSTEM
// DOMAIN MODELS & ENUMS
// ==========================================

export type JurisdictionLevel =
  | "State"
  | "Federal"
  | "Local / Parish"
  | "Utility / Regional"
  | "Applicant";

export type RequestCategory =
  | "permit"
  | "road"
  | "utility"
  | "public_safety"
  | "workforce"
  | "community";

export type OperationalState =
  | "running"
  | "waiting_government"
  | "waiting_applicant"
  | "waiting_external"
  | "scheduled_hold"
  | "statutory_waiting_period"
  | "blocked"
  | "escalated"
  | "complete"
  | "cancelled";

export type RAGHealth = "green" | "yellow" | "red";

export type DelayReason =
  | "applicant_information"
  | "agency_workload"
  | "interagency_dependency"
  | "statutory_minimum"
  | "public_comment"
  | "engineering_change"
  | "environmental_discovery"
  | "legal_challenge"
  | "third_party_utility"
  | "weather"
  | "procurement"
  | "scheduling"
  | "none";

export type EscalationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type DependencyType = "finish_to_start" | "start_to_start" | "finish_to_finish";
export type GateType = "AND" | "OR";

export type CommitmentStatus = "on_track" | "at_risk" | "fulfilled" | "missed" | "waived";

export type CoordinationRequestStatus =
  | "pending"
  | "in_review"
  | "concurred"
  | "objection_raised"
  | "closed";

export type RFIStatus =
  | "staged_draft"
  | "issued"
  | "partially_answered"
  | "submitted_by_applicant"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type ClockImpact = "clock_paused" | "clock_running" | "clock_extended";

export type FilingMode = "PATH_SUPPORTED" | "EXTERNAL_PORTAL" | "EMAIL_PAPER_OTHER" | "TRACK_ONLY";

export type CustomerRequestType = "permit_authorization" | "government_help" | "project_question" | "blocker_coordination" | "escalation" | "concierge";

export type PersonaRole =
  | "spacex_pm"
  | "spacex_eng"
  | "agency_reviewer"
  | "agency_supervisor"
  | "state_pm"
  | "agency_admin"
  | "executive"
  | "auditor_legal";

// ==========================================
// ITSM LIFECYCLE, PRIORITY & STATUTORY CLOCKS
// ==========================================

export type ITSMState =
  | "draft"
  | "submitted"
  | "triaged"
  | "in_progress"
  | "pending_customer"
  | "pending_agency"
  | "blocked"
  | "resolved"
  | "closed";

export type PriorityLevel = "P1" | "P2" | "P3" | "P4";
export type TicketPriority = PriorityLevel;

export type UrgencyLevel = "low" | "medium" | "high" | "critical";
export type ImpactLevel = "low" | "medium" | "high" | "critical";

export type ClockStatus = "active" | "paused" | "stopped" | "extended";

export type AssignmentGroupRole = "member" | "lead" | "backup";

// ==========================================
// ASSIGNMENT GROUPS & FULFILLER QUEUES
// ==========================================

export interface AssignmentGroupRecord {
  id: string;
  orgCode: string;
  organizationId?: string;
  name: string;
  description: string;
  leadUserId?: string;
  leadUserName?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignmentGroupMembershipRecord {
  id: string;
  assignmentGroupId: string;
  userId: string;
  role: AssignmentGroupRole;
  userName?: string;
  userEmail?: string;
  userTitle?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==========================================
// STATUTORY CLOCK & PRIORITY MATRIX MODELS
// ==========================================

export interface ClockPauseRecord {
  pausedAt: string;
  resumedAt?: string;
  reason?: string;
  pausedByUserId?: string;
  pausedByName?: string;
  rfiId?: string;
  coordinationRequestId?: string;
  pauseDurationDays?: number;
}

export interface StatutoryClockState {
  clockStatus: ClockStatus;
  statutoryDays: number;
  elapsedDays: number;
  remainingDays: number;
  statutoryDeadline?: string;
  isPaused: boolean;
  pausedAt?: string;
  pausedReason?: string;
  resumedAt?: string;
  totalPausedDays: number;
  pauseHistory: ClockPauseRecord[];
}

export interface PriorityMatrixEntry {
  urgency: UrgencyLevel;
  impact: ImpactLevel;
  priority: PriorityLevel;
  targetResponseHours: number;
  targetResolutionDays: number;
}

export interface TicketRecord {
  id: string;
  ticketNumber: string;
  entityType: "customer_request" | "workstream" | "task";
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  category: RequestCategory;
  categoryLabel: string;

  applicantOrgCode: string;
  applicantOrgName: string;
  leadAgencyCode: string;
  leadAgencyName: string;
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  assignedToUserEmail?: string;

  itsmState: ITSMState;
  statusLabel: string;
  ragHealth: RAGHealth;
  priority: PriorityLevel;
  urgency: UrgencyLevel;
  impact: ImpactLevel;
  isCriticalPath: boolean;

  targetDueDate?: string;
  statutoryDeadline?: string;
  clockStatus: ClockStatus;
  clockPausedReason?: string;
  statutoryClock?: StatutoryClockState;

  createdAt: string;
  updatedAt: string;
  submittedByName?: string;
  submittedByUserId?: string;
}

// ==========================================
// CORE DOMAIN INTERFACES
// ==========================================

export interface OrganizationRecord {
  id: string;
  code: string;
  name: string;
  abbreviation: string;
  jurisdictionLevel: JurisdictionLevel;
  parentOrgId?: string;
  websiteUrl?: string;
  permitPortalUrl?: string;
  generalContactEmail?: string;
  projectLiaisonName?: string;
  projectLiaisonEmail?: string;
  projectLiaisonPhone?: string;
  executiveEscalationName?: string;
  executiveEscalationEmail?: string;
  workingHours: string;
  holidayCalendar: string;
  defaultSlaDays: number;
  statutoryAuthority?: string;
  geographicCoverage?: string;
  documentRetentionYears: number;
  externalSystemName?: string;
  isActive: boolean;
}

export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  title?: string;
  phone?: string;
  organizationId?: string;
  unitId?: string;
  isActive: boolean;
}

export interface UserProfileRecord {
  id: string;
  userId: string;
  fullName: string;
  displayTitle: string;
  organizationId: string;
  organizationName: string;
  organizationalUnit?: string;
  workEmail: string;
  officePhone?: string;
  mobilePhone?: string;
  officeLocation?: string;
  preferredContactMethod: "email" | "phone" | "text" | "teams";
  availabilityStatus: "available" | "limited" | "out_of_office";
  projectRole: string;
  avatarUrl?: string;
  isCustomerVisible: boolean;
  isActive: boolean;
}

export interface OrganizationMembershipRecord {
  id: string;
  userId: string;
  organizationId: string;
  role: "contributor" | "supervisor" | "organization_admin" | "system_admin";
  status: "active" | "pending" | "suspended" | "expired";
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface ProjectParticipantRecord {
  id: string;
  projectId: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  projectRole: string;
  workstreamIds: string[];
  assignedTaskIds: string[];
  reviewResponsibility: string[];
  notificationResponsibility: string[];
  visibilityScope: "customer" | "project" | "agency" | "admin";
  startsOn?: string;
  endsOn?: string;
  isActive: boolean;
}

export interface RequirementResourceRecord {
  id: string;
  permitTypeId: string;
  resourceName: string;
  resourceType: "form_pdf" | "portal_url" | "guidance_doc" | "checklist" | "statute_link";
  url: string;
  supersededUrl?: string;
  versionTag: string;
  effectiveDate?: string;
  verifiedAt: string;
  verifiedBy: string;
  instructions?: string;
  sourceAuthority?: string;
  isStale: boolean; // Flagged if verifiedAt > 180 days ago
}

export interface PermitTypeRecord {
  id: string;
  code: string;
  name: string;
  category: RequestCategory;
  responsibleOrgId: string;
  responsibleOrgCode: string;
  triggerExplanation: string;
  statutoryCitation: string;
  officialFilingUrl?: string;
  applicationFormUrl?: string;
  instructionsUrl?: string;
  expectedLeadTimeDays: number;
  minimumStatutoryDays: number;
  publicNoticeRequired: boolean;
  publicNoticeDays: number;
  prerequisites: string[];
  relatedPermitTypeIds: string[];
  lastVerifiedAt?: string;
  verificationStatus: "verified" | "verification_due" | "stale_over_180d";
  resources?: RequirementResourceRecord[];
  filingMode?: FilingMode;
  agencyContactName?: string;
  agencyContactEmail?: string;
  agencyContactPhone?: string;
}

export interface ExternalFilingRecord {
  id: string;
  projectId: string;
  workstreamId: string;
  permitTypeId?: string;
  authorityOrganizationId: string;
  authorityOrganizationName: string;
  filingMethod: FilingMode;
  officialPortalUrl?: string;
  externalReferenceNumber?: string;
  externalRecordUrl?: string;
  externalStatus: "not_started" | "draft" | "submitted" | "under_review" | "additional_information" | "approved" | "denied" | "closed";
  submittedAt?: string;
  submittedByUserId?: string;
  submittedByName?: string;
  lastStatusVerifiedAt?: string;
  lastStatusVerifiedBy?: string;
  authoritativeSystemName?: string;
  notes?: string;
  receiptDocumentVersionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRequestRecord {
  id: string;
  confirmationNumber: string;
  projectId: string;
  requestType: CustomerRequestType;
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
  status: "draft" | "submitted" | "triage" | "in_progress" | "resolved" | "closed" | ITSMState;
  attachmentDocumentVersionIds: string[];
  createdAt: string;
  updatedAt: string;

  // Milestone 1 ITSM & Assignment Extensions
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  itsmState?: ITSMState;
  priority?: PriorityLevel;
  urgency?: UrgencyLevel;
  impact?: ImpactLevel;
  statutoryDeadline?: string;
  clockStatus?: ClockStatus;
  clockPausedReason?: string;
  clockPausedAt?: string;
  clockTotalPausedSeconds?: number;
  statutoryClock?: StatutoryClockState;
}

export interface WorkflowStageRecord {
  id: string;
  workflowVersionId: string;
  stageKey: string;
  name: string;
  internalDescription?: string;
  customerVisibilityLabel: string;
  sequenceOrder: number;
  responsibleOrgId: string;
  responsibleOrgCode: string;
  responsibleUnitName?: string;
  targetDurationDays: number;
  minimumStatutoryDays: number;
  requiredInputs: string[];
  completionRequirements: string[];
  permittedTransitions: string[];
  canRunInParallel: boolean;
  isMilestoneGate: boolean;
  externalFilingUrl?: string;
  legalAuthorityCitation?: string;
}

export interface WorkflowVersionRecord {
  id: string;
  templateId: string;
  versionNumber: number;
  status: "draft" | "published" | "retired";
  effectiveDate?: string;
  publishedAt?: string;
  publishedByName?: string;
  changeSummary?: string;
  stages: WorkflowStageRecord[];
}

export interface WorkflowTemplateRecord {
  id: string;
  permitTypeId: string;
  name: string;
  description?: string;
  activeVersionNumber: number;
  versions: WorkflowVersionRecord[];
}

export interface CommitmentRecord {
  id: string;
  workstreamId: string;
  workstreamTitle?: string;
  committingOrgId: string;
  committingOrgCode: string;
  madeByPersonName: string;
  committedAction: string;
  originContext: string;
  committedDate: string;
  promisedDueDate: string;
  completedDate?: string;
  fulfilledDate?: string;
  status: CommitmentStatus;
  impactIfMissed: string;
  isCriticalPathImpact: boolean;
}

export interface TaskRecord {
  id: string;
  workstreamId: string;
  stageId?: string;
  title: string;
  description?: string;
  taskType: "agency_review" | "applicant_action" | "consultation" | "public_notice" | "inspection" | "determination";
  assignedOrgId: string;
  assignedOrgCode: string;
  assignedUserName?: string;
  assignedUserId?: string;
  status: "pending" | "in_progress" | "waiting" | "blocked" | "completed" | "waived";
  isMilestone: boolean;
  isCriticalPath: boolean;
  baselineStartDate?: string;
  baselineDueDate?: string;
  forecastStartDate?: string;
  forecastDueDate?: string;
  actualCompletionDate?: string;
  durationDays: number;
  floatDays: number;
  predecessorTaskIds: string[];

  // Milestone 1 ITSM Extensions
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  itsmState?: ITSMState;
  priority?: PriorityLevel;
  statutoryDeadline?: string;
  clockStatus?: ClockStatus;
  clockPausedReason?: string;
  clockPausedAt?: string;
  clockTotalPausedSeconds?: number;
}

export interface TaskDependencyRecord {
  id: string;
  predecessorTaskId: string;
  successorTaskId: string;
  dependencyType: DependencyType;
  gateType: GateType;
  lagDays: number;
  isControlling: boolean;
}

export interface CoordinationRequestRecord {
  id: string;
  code: string; // e.g. "CR-00451"
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
  requestedDate: string;
  dueDate: string;
  responseDate?: string;
  attachedDocumentVersionIds: string[];
  blocksWorkstreamTitle: string;
  priority: "normal" | "high" | "critical_path";
  status: CoordinationRequestStatus;
  responseSummary?: string;
  concurredAt?: string;
}

export interface RFIRecord {
  id: string;
  code: string; // e.g. "RFI-2026-0042"
  workstreamId: string;
  workstreamTitle: string;
  requestingOrgId: string;
  requestingOrgCode: string;
  recipientOrgId: string;
  recipientOrgCode: string;
  title: string;
  questionText: string;
  technicalReason: string;
  requiredDocumentTypes: string[];
  issuedDate: string;
  responseDeadline: string;
  clockImpact: ClockImpact;
  scheduleImpactDays: number;
  status: RFIStatus;
  isConsolidatedCycle: boolean;
  consolidatedBatchId?: string;
  leadReviewerApprovedAt?: string;
  responses?: RFIResponseRecord[];
}

export interface RFIResponseRecord {
  id: string;
  rfiId: string;
  submittedByName: string;
  responseText: string;
  attachedDocumentVersionIds: string[];
  submittedAt: string;
  reviewedByName?: string;
  reviewDecision?: "accepted" | "clarification_needed" | "rejected";
  reviewNotes?: string;
  reviewedAt?: string;
}

export interface DocumentVersionRecord {
  id: string;
  documentId: string;
  versionTag: string; // e.g. "v8.0", "v9.0"
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  storageUri: string;
  sha256Hash: string;
  uploadedByName: string;
  changeSummary?: string;
  isMalwareClean: boolean;
  uploadedAt: string;
  versionNumber?: number;
  versionLabel?: string;
  storagePath?: string;
  uploadedByOrgName?: string;
  changeNotes?: string;
  status?: "under_review" | "approved" | "superseded";
  agencyReviews?: DocumentAgencyReviewRecord[];
}

export interface DocumentAgencyReviewRecord {
  id: string;
  documentVersionId: string;
  workstreamId: string;
  reviewingOrgId?: string;
  reviewingOrgCode: string;
  reviewStatus: "under_review" | "approved" | "revisions_requested" | "waived";
  reviewedByName?: string;
  decisionDate?: string;
  reviewComments?: string;
  status?: string;
  reviewedByUserName?: string;
  reviewedAt?: string;
  comments?: string;
}

export interface DocumentRecord {
  id: string;
  projectId: string;
  workstreamId?: string;
  workstreamTitle?: string;
  title: string;
  category: string;
  ownerOrgCode: string;
  currentVersionNumber: number;
  isConfidential: boolean;
  versions: DocumentVersionRecord[];
  agencyReviews: DocumentAgencyReviewRecord[];
  currentVersionId?: string;
}

export interface DecisionRecord {
  id: string;
  projectId: string;
  decisionDate: string;
  title: string;
  decisionSummary: string;
  decisionMakerName: string;
  decisionMakerTitle: string;
  organizationsRepresented: string[];
  statutoryAuthority: string;
  affectedWorkstreamIds: string[];
  affectedWorkstreamTitles: string[];
  referencedDocumentVersionIds: string[];
  requiredFollowUps?: string;
}

export interface MeetingRecord {
  id: string;
  projectId: string;
  title: string;
  meetingDate: string;
  locationOrLink: string;
  attendeeList: string[];
  meetingNotes: string;
  relatedWorkstreamIds: string[];
  actionItemsConverted: {
    tasksCreated: number;
    commitmentsCreated: number;
    decisionsLogged: number;
  };
}

export interface ReadinessItemRecord {
  id: string;
  checklistId: string;
  itemName: string;
  status: "ready" | "underway" | "missing" | "waived";
  assignedParty: string;
  notes?: string;
}

export interface ReadinessChecklistRecord {
  id: string;
  workstreamId: string;
  workstreamTitle: string;
  phase: string;
  overallReadinessPercent: number;
  targetFilingDate?: string;
  items: ReadinessItemRecord[];
}

export interface AuditEventRecord {
  id: string;
  entityType: string;
  entityId: string;
  actorName: string;
  actorOrgName: string;
  actionType: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  sourceChannel: string;
  occurredAt: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "action_required" | "mention" | "status_update" | "escalation" | "deadline_warning" | "completion" | "system";
  linkUrl?: string;
  urgency: "info" | "high" | "critical";
  metadata?: Record<string, unknown>;
  createdAt: string;
  isRead: boolean;
}

export interface WorkstreamRecord {
  id: string;
  projectId: string;
  code: string; // "WS-WETLANDS-PAD-A"
  title: string;
  category: RequestCategory;
  categoryLabel: string;
  permitTypeId?: string;
  permitTypeCode?: string;
  workflowVersionId?: string;
  currentStageId?: string;
  currentStageName?: string;
  
  // Accountable ownership model
  governmentConcierge: {
    name: string;
    title: string;
    agency: string;
    email: string;
    phone: string;
  };
  regulatoryLead: {
    orgCode: string;
    orgName: string;
    jurisdictionLevel: JurisdictionLevel;
    assignedReviewerName: string;
    assignedReviewerEmail: string;
  };
  assignedReviewerUserId?: string;
  
  // State & Health decoupling
  operationalState: OperationalState;
  operationalStateLabel: string;
  ragHealth: RAGHealth;
  isCriticalPath: boolean;
  
  // Schedule dates & Variance
  baselineStartDate: string;
  baselineTargetDate: string;
  forecastStartDate: string;
  forecastTargetDate: string;
  actualStartDate?: string;
  actualCompletionDate?: string;
  scheduleVarianceDays: number;
  controllingDependencyTitle?: string;
  
  // The 6 Core Questions Deterministic Fields
  currentActionSummary: string;
  waitingReason?: string;
  waitingOnEntity?: string;
  nextExpectedEvent: string;
  customerActionRequired: string;
  
  // Delay accounting
  primaryDelayReason: DelayReason;
  delayNotes?: string;
  
  // Escalation policy
  escalationLevel: EscalationLevel;
  escalationTriggeredAt?: string;
  escalationSummary?: string;
  
  // Nested execution data
  tasks: TaskRecord[];
  commitments: CommitmentRecord[];
  coordinationRequests: CoordinationRequestRecord[];
  rfis: RFIRecord[];
  readinessChecklist?: ReadinessChecklistRecord;

  // Milestone 1 ITSM & Assignment Extensions
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  assignedOrgCode?: string;
  itsmState?: ITSMState;
  priority?: PriorityLevel;
  statutoryDeadline?: string;
  clockStatus?: ClockStatus;
  clockPausedReason?: string;
  clockPausedAt?: string;
  clockTotalPausedSeconds?: number;
  statutoryClock?: StatutoryClockState;
}

export interface ProjectRecord {
  id: string;
  code: string;
  name: string;
  applicantOrgCode: string;
  leadStateAgencyCode: string;
  stateProjectManagerName: string;
  customerProgramManagerName: string;
  locationDescription: string;
  parish: string;
  baselineLaunchDate: string;
  currentForecastLaunchDate: string;
  scheduleVarianceDays: number;
  overallRagHealth: RAGHealth;
  workstreams: WorkstreamRecord[];
  commitments: CommitmentRecord[];
  decisions: DecisionRecord[];
  meetings: MeetingRecord[];
  documents: DocumentRecord[];
  coordinationRequests: CoordinationRequestRecord[];
  auditLedger: AuditEventRecord[];
  participants?: ProjectParticipantRecord[];
  externalFilings?: ExternalFilingRecord[];
  customerRequests?: CustomerRequestRecord[];
}

// ==========================================
// VALIDATION, PARSING & CALCULATION HELPERS
// ==========================================

export const VALID_ITSM_STATES: readonly ITSMState[] = [
  "draft",
  "submitted",
  "triaged",
  "in_progress",
  "pending_customer",
  "pending_agency",
  "blocked",
  "resolved",
  "closed",
] as const;

export const VALID_PRIORITIES: readonly PriorityLevel[] = ["P1", "P2", "P3", "P4"] as const;

export const VALID_CLOCK_STATUSES: readonly ClockStatus[] = ["active", "paused", "stopped", "extended"] as const;

export function isITSMState(value: unknown): value is ITSMState {
  return typeof value === "string" && VALID_ITSM_STATES.includes(value as ITSMState);
}

export function isPriorityLevel(value: unknown): value is PriorityLevel {
  return typeof value === "string" && VALID_PRIORITIES.includes(value as PriorityLevel);
}

export function isClockStatus(value: unknown): value is ClockStatus {
  return typeof value === "string" && VALID_CLOCK_STATUSES.includes(value as ClockStatus);
}

export function parseITSMState(value: unknown, defaultState: ITSMState = "submitted"): ITSMState {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isITSMState(trimmed)) return trimmed;
    const normalized = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
    if (isITSMState(normalized)) return normalized;
    if (normalized === "triage") return "triaged";
    if (normalized === "complete" || normalized === "completed") return "resolved";
  }
  return isITSMState(defaultState) ? defaultState : "submitted";
}

export function parsePriorityLevel(value: unknown, defaultPriority: PriorityLevel = "P3"): PriorityLevel {
  if (isPriorityLevel(value)) return value;
  if (typeof value === "string") {
    const upper = value.toUpperCase().trim();
    if (upper === "CRITICAL" || upper === "P1") return "P1";
    if (upper === "HIGH" || upper === "P2") return "P2";
    if (upper === "MEDIUM" || upper === "NORMAL" || upper === "P3") return "P3";
    if (upper === "LOW" || upper === "P4") return "P4";
  }
  return defaultPriority;
}

export function calculatePriority(
  urgency: UrgencyLevel = "medium",
  impact: ImpactLevel = "medium",
  fallback: PriorityLevel = "P3"
): PriorityLevel {
  const u = urgency.toLowerCase();
  const i = impact.toLowerCase();

  if (u === "critical" && (i === "critical" || i === "high")) return "P1";
  if (u === "high" && i === "critical") return "P1";
  if (u === "critical" && i === "medium") return "P2";
  if (u === "high" && i === "high") return "P2";
  if (u === "medium" && i === "critical") return "P2";
  if (u === "low" && i === "critical") return "P3";
  if (u === "medium" && i === "high") return "P3";
  if (u === "high" && i === "medium") return "P3";
  if (u === "medium" && i === "medium") return "P3";
  if (u === "low" && (i === "high" || i === "medium")) return "P4";
  if (u === "high" && i === "low") return "P4";
  if (u === "medium" && i === "low") return "P4";
  if (u === "low" && i === "low") return "P4";

  return fallback;
}

export function calculateStatutoryClock(options: {
  statutoryDays: number;
  startDate: string;
  asOfDate?: string;
  clockStatus?: ClockStatus;
  isPaused?: boolean;
  pauseHistory?: ClockPauseRecord[];
  currentPausedAt?: string;
  currentPausedReason?: string;
}): StatutoryClockState {
  const {
    statutoryDays,
    startDate,
    asOfDate = new Date().toISOString().split("T")[0],
    clockStatus = options.isPaused ? "paused" : "active",
    isPaused = clockStatus === "paused",
    pauseHistory = [],
    currentPausedAt,
    currentPausedReason,
  } = options;

  let totalPausedDays = 0;
  for (const record of pauseHistory) {
    if (record.pauseDurationDays) {
      totalPausedDays += record.pauseDurationDays;
    } else if (record.pausedAt && record.resumedAt) {
      const pStart = new Date(record.pausedAt).getTime();
      const pEnd = new Date(record.resumedAt).getTime();
      const days = Math.max(0, Math.round((pEnd - pStart) / (1000 * 60 * 60 * 24)));
      totalPausedDays += days;
    }
  }

  if (isPaused && currentPausedAt) {
    const pStart = new Date(currentPausedAt).getTime();
    const nowTime = new Date(asOfDate).getTime();
    const currentPauseDays = Math.max(0, Math.round((nowTime - pStart) / (1000 * 60 * 60 * 24)));
    totalPausedDays += currentPauseDays;
  }

  const start = new Date(startDate).getTime();
  const current = new Date(asOfDate).getTime();
  const rawElapsedDays = Math.max(0, Math.round((current - start) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, rawElapsedDays - totalPausedDays);
  const remainingDays = Math.max(0, statutoryDays - elapsedDays);

  const deadlineDate = new Date(start + (statutoryDays + totalPausedDays) * 24 * 60 * 60 * 1000);
  const statutoryDeadline = deadlineDate.toISOString().split("T")[0];

  return {
    clockStatus,
    statutoryDays,
    elapsedDays,
    remainingDays,
    statutoryDeadline,
    isPaused,
    pausedAt: currentPausedAt,
    pausedReason: currentPausedReason,
    totalPausedDays,
    pauseHistory,
  };
}

export function mapOperationalStateToITSMState(opState: OperationalState, hasBlocker = false): ITSMState {
  if (hasBlocker || opState === "blocked") return "blocked";
  switch (opState) {
    case "complete":
      return "resolved";
    case "cancelled":
      return "closed";
    case "waiting_applicant":
      return "pending_customer";
    case "waiting_government":
    case "waiting_external":
    case "statutory_waiting_period":
    case "scheduled_hold":
      return "pending_agency";
    case "escalated":
    case "running":
    default:
      return "in_progress";
  }
}

export function mapITSMStateToOperationalState(itsmState: ITSMState): OperationalState {
  switch (itsmState) {
    case "draft":
    case "submitted":
    case "triaged":
      return "waiting_government";
    case "in_progress":
      return "running";
    case "pending_customer":
      return "waiting_applicant";
    case "pending_agency":
      return "waiting_government";
    case "blocked":
      return "blocked";
    case "resolved":
    case "closed":
      return "complete";
    default:
      return "running";
  }
}

export function mapCustomerRequestStatusToITSMState(status: string): ITSMState {
  switch (status) {
    case "draft":
      return "draft";
    case "submitted":
      return "submitted";
    case "triage":
      return "triaged";
    case "in_progress":
      return "in_progress";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
    default:
      return "submitted";
  }
}

