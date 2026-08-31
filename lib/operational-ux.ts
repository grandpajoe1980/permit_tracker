import type {
  CommitmentRecord,
  CoordinationRequestRecord,
  CustomerRequestRecord,
  DocumentRecord,
  RFIRecord,
  WorkflowTemplateRecord,
  WorkstreamRecord,
} from "./domain-models";
import {
  demoPersonas,
  type DemoPersona,
  pecanIslandRequests,
  type PermitRecord,
  type PermissionKey,
  type RoleId,
  type ServiceRequest,
} from "./demo-data";
import {
  commitmentsData,
  coordinationRequestsData,
  projectDocumentsData,
  rfisData,
  workstreamsData,
  workflowTemplatesData,
} from "./spacex-megaproject-fixture";
import { participantForTask, participantForWorkstream, projectProfiles } from "./customer-portal";

export type WorkspaceMode = "reviewer" | "agency" | "supervisor" | "state_office" | "customer" | "admin";

export type WorkItemKind = "workflow" | "task" | "rfi" | "coordination" | "document" | "commitment" | "determination" | "customer_request";

export type WorkActionId =
  | "complete_step"
  | "request_information"
  | "mark_blocked"
  | "clear_blocker"
  | "transfer"
  | "escalate"
  | "add_note"
  | "approve_document"
  | "approve_with_comments"
  | "request_revision"
  | "accept_rfi_response"
  | "request_clarification"
  | "respond"
  | "upload_documents";

export type QueueSectionId = "needs_action" | "due_today" | "overdue" | "waiting" | "upcoming" | "recently_completed";

export type OperationalPersona = {
  id: string;
  name: string;
  email: string;
  roleId: RoleId;
  roleLabel: string;
  organization: string;
  agencyCode: string;
  workspace: WorkspaceMode;
  permissions: PermissionKey[];
  isCustomer: boolean;
};

export type OperationalWorkItem = {
  id: string;
  sourceId: string;
  kind: WorkItemKind;
  title: string;
  projectName: string;
  workstreamId?: string;
  workstreamTitle: string;
  whyHere: string;
  whatToDo: string;
  removesFromQueue: string;
  dueDate?: string;
  ageLabel: string;
  waitLabel?: string;
  scheduleImpact: string;
  statusLabel: string;
  statusTone: "red" | "amber" | "blue" | "green" | "slate";
  priorityScore: number;
  isCriticalPath: boolean;
  ownerName: string;
  ownerOrganization: string;
  waitingOn?: string;
  nextOwner?: string;
  nextHandoff?: string;
  requiredInputs: string[];
  documents: Array<{ id: string; label: string; version?: string }>;
  sourceRequest?: PermitRecord;
  sourceWorkstream?: WorkstreamRecord;
  sourceRfi?: RFIRecord;
  sourceCoordination?: CoordinationRequestRecord;
  sourceDocument?: DocumentRecord;
  exactDocumentVersionId?: string;
  exactDocumentVersionLabel?: string;
  hasRfiResponse?: boolean;
  customerVisibleSummary?: string;
  assignedUserId?: string;
  assignedOrganizationId?: string;
  requiresCurrentUserAction?: boolean;
  requiresOrganizationAction?: boolean;
  visibilityOnly?: boolean;
};

export type QueueGroup = {
  id: QueueSectionId;
  label: string;
  description: string;
  items: OperationalWorkItem[];
};

export type RecipientPreview = {
  recipients: Array<{ label: string; name: string; organization: string }>;
  customerMessage?: string;
};

const PROJECT_NAME = "SpaceX Pecan Island Launch Complex";
const AS_OF_DATE = "2026-08-30";

const requestWorkstreamMap: Record<string, string> = {
  "TASK-T001": "WS-LA82-HEAVYHAUL",
  "TASK-T002": "WS-SUBSTATION-230KV",
  "TASK-T003": "WS-WASTEWATER-DELUGE",
  "TASK-T004": "WS-HIGHBAY-OSFM",
  "TASK-T005": "WS-PUBLIC-SAFETY-AIRSPACE",
  "TASK-T006": "WS-WETLANDS-PAD-A",
  "TASK-T007": "WS-WORKFORCE-CONSORTIUM",
  "TASK-T008": "WS-GAS-LNG-PIPELINE",
  "TASK-T009": "WS-PARISH-WATER-MONITORING",
};

const roleLabels: Record<WorkspaceMode, string> = {
  reviewer: "Environmental Reviewer",
  agency: "Agency Contributor",
  supervisor: "Agency Supervisor",
  state_office: "State Project Office",
  customer: "SpaceX Project Team",
  admin: "PATH Administrator",
};

function includesAny(value: string, terms: string[]) {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function normalizeAgencyCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function sameAgency(left: string, right: string) {
  const a = normalizeAgencyCode(left);
  const b = normalizeAgencyCode(right);
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

function humanDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(start: string | undefined, end = AS_OF_DATE) {
  if (!start) return 0;
  const first = new Date(`${start}T12:00:00`).valueOf();
  const last = new Date(`${end}T12:00:00`).valueOf();
  if (Number.isNaN(first) || Number.isNaN(last)) return 0;
  return Math.max(0, Math.floor((last - first) / 86_400_000));
}

function dateRelation(value: string | undefined) {
  if (!value) return "none" as const;
  const date = new Date(`${value}T12:00:00`).valueOf();
  const asOf = new Date(`${AS_OF_DATE}T12:00:00`).valueOf();
  if (Number.isNaN(date)) return "none" as const;
  if (date < asOf) return "overdue" as const;
  if (date === asOf) return "today" as const;
  return "future" as const;
}

function roleForPersona(persona: DemoPersona | null): WorkspaceMode {
  if (!persona) return "agency";
  const role = persona?.role?.toLowerCase() ?? "";
  const badge = persona?.badge?.toLowerCase() ?? "";
  // Check supervisor/admin roles first — a SpaceX supervisor is still a supervisor
  if (badge === "administrator" || includesAny(role, ["path administrator", "program administrator"])) return "admin";
  if (badge === "supervisor" || includesAny(role, ["supervisor"])) return "supervisor";
  // Now check for customer/applicant/SpaceX submitter
  if (persona.organization?.toUpperCase().includes("SPACEX") || (persona as { agency?: string }).agency?.toUpperCase() === "SPACEX" || badge === "applicant" || badge === "customer" || includesAny(role, ["applicant", "customer", "submitter", "spacex"])) return "customer";
  if (includesAny(role, ["state project", "executive"])) return "state_office";
  if (includesAny(role, ["reviewer", "environmental"])) return "reviewer";
  if (includesAny(role, ["infrastructure", "community", "agency"])) return "agency";
  return "agency";
}

function permissionsForWorkspace(workspace: WorkspaceMode): PermissionKey[] {
  if (workspace === "customer") return ["submit_requests", "escalate_liaison"];
  if (workspace === "reviewer") return ["edit_workflow", "add_blockers", "resolve_blockers", "escalate_liaison"];
  if (workspace === "agency") return ["edit_workflow", "add_blockers", "resolve_blockers", "escalate_liaison"];
  return ["manage_roles", "edit_workflow", "submit_requests", "add_blockers", "resolve_blockers", "escalate_liaison", "reassign_agency"];
}

export function getOperationalPersona(persona: DemoPersona | null): OperationalPersona {
  const workspace = roleForPersona(persona);
  const name = persona?.name ?? "PATH Demo User";
  const email = persona?.email ?? "demo@path.local";
  const normalizedRole = persona?.role.toLowerCase() ?? "";
  const agencyCode = includesAny(normalizedRole, ["environmental", "reviewer"])
    ? "LDEQ"
    : includesAny(normalizedRole, ["infrastructure"])
      ? "DOTD"
      : includesAny(normalizedRole, ["community"])
        ? "VERMILION PARISH"
        : workspace === "customer"
          ? "SPACEX"
          : "LA-PROJECTS";

  const teamMember = Boolean(persona?.organization);
  const roleId: RoleId = workspace === "customer" ? "submitter" : workspace === "reviewer" ? "reviewer" : workspace === "agency" ? "infrastructure" : "admin";
  return {
    id: persona?.id ?? "demo-user",
    name,
    email,
    roleId,
    roleLabel: roleLabels[workspace],
    organization: persona?.organization ?? (workspace === "customer" ? "Space Exploration Technologies Corp. (SpaceX)" : workspace === "state_office" ? "Louisiana Governor's Office of Major Projects & Delivery" : teamMember ? "Louisiana Project Delivery Team" : "PATH Demo Workspace"),
    agencyCode,
    workspace,
    permissions: permissionsForWorkspace(workspace),
    isCustomer: workspace === "customer",
  };
}

function requestToWorkItem(request: ServiceRequest, persona: OperationalPersona, workstream?: WorkstreamRecord): OperationalWorkItem {
  const sourceDueDate = workstream?.forecastTargetDate ?? request.targetDate;
  const status = workstream?.operationalState ?? (request.blocker ? "blocked" : request.status === "approved" ? "complete" : "running");
  const isWaiting = ["waiting_government", "waiting_applicant", "waiting_external", "scheduled_hold", "statutory_waiting_period"].includes(status);
  const isComplete = status === "complete" || request.status === "approved";
  const isBlocked = status === "blocked" || Boolean(request.blocker);
  const currentAction = workstream?.currentActionSummary ?? request.blocker?.unblockingAction ?? request.nextSteps[0]?.body ?? "Review the assigned materials and record your determination.";
  const participant = workstream ? participantForTask(request.id, workstream.id) : undefined;
  const assignedUserId = workstream?.assignedReviewerUserId ?? participant?.userId;
  const currentUserId = persona.id.startsWith("user-") ? persona.id : `user-${persona.id}`;
  const personallyAssigned = Boolean(assignedUserId && assignedUserId === currentUserId);
  const sameOwner = personallyAssigned || includesAny(request.owner.name, [persona.name, persona.name.split(" ")[0]]);
  const whyHere = persona.isCustomer
    ? "Visible because it is part of the SpaceX project status shared with your team."
    : persona.workspace === "supervisor" || persona.workspace === "state_office"
      ? isBlocked
        ? "In your exception queue because the current owner is blocked or at risk."
        : "In your operational queue so you can keep the next handoff moving."
      : sameOwner
        ? `Assigned to you because you are the ${request.leadAgencyCode} technical reviewer for the current workflow stage.`
        : `Visible in the ${request.leadAgencyCode} agency queue because your team is a participant in this workstream.`;
  const owner = workstream?.regulatoryLead.assignedReviewerName ?? request.owner.name;
  const ownerOrg = workstream?.regulatoryLead.orgName ?? request.owner.agency;
  const dueRelation = dateRelation(sourceDueDate);
  const priorityScore = isBlocked && request.isCriticalPath ? 100 : dueRelation === "overdue" && request.isCriticalPath ? 90 : dueRelation === "today" ? 80 : isBlocked ? 70 : request.isCriticalPath ? 50 : isComplete ? 10 : 30;
  const requestDocuments = request.id === "TASK-T001" ? [{ id: "doc-v-drainage-v12", label: "LA-82 drainage model", version: "v12.0" }] : request.id === "TASK-T006" ? [{ id: "doc-v-wetland-v4", label: "Wetland delineation package", version: "v4.1" }] : [];
  const customerSummary = isWaiting || isBlocked
    ? `${request.leadAgency} is coordinating the next step. No SpaceX action is currently required unless a request appears in your action queue.`
    : `${request.leadAgency} is progressing ${request.title}.`;
  return {
    id: request.id,
    sourceId: request.id,
    kind: "workflow",
    title: workstream?.currentStageName ?? request.title,
    projectName: PROJECT_NAME,
    workstreamId: workstream?.id ?? requestWorkstreamMap[request.id],
    workstreamTitle: request.title,
    whyHere,
    whatToDo: persona.isCustomer ? "View the latest authorized project status." : currentAction,
    removesFromQueue: persona.isCustomer ? "No action is required unless SpaceX receives a specific request." : "Complete the step, transfer the assignment, or place it in an approved waiting state.",
    dueDate: sourceDueDate,
    ageLabel: workstream ? `${daysBetween(workstream.forecastStartDate)} days in current stage` : `${request.currentDay} of ${request.totalDays} review days`,
    waitLabel: workstream?.waitingReason ?? request.blocker?.blockedSince,
    scheduleImpact: request.isCriticalPath ? `Critical path · ${workstream?.scheduleVarianceDays ? `${workstream.scheduleVarianceDays} day variance` : "launch date driver"}` : "Within schedule float",
    statusLabel: workstream?.operationalStateLabel ?? request.statusLabel,
    statusTone: isComplete ? "green" : isBlocked ? "red" : isWaiting ? "amber" : request.ragStatus === "yellow" ? "amber" : "blue",
    priorityScore,
    isCriticalPath: request.isCriticalPath,
    ownerName: owner,
    ownerOrganization: ownerOrg,
    waitingOn: workstream?.waitingOnEntity ?? (isBlocked ? request.blocker?.title : undefined),
    nextOwner: workstream?.nextExpectedEvent ?? request.nextSteps[0]?.responsibleParty,
    nextHandoff: workstream ? `Next handoff: ${workstream.nextExpectedEvent}` : request.nextSteps[0]?.title,
    requiredInputs: workstream?.tasks.filter((task) => task.status !== "completed").slice(0, 3).map((task) => task.title) ?? ["Review the assigned record", "Record your determination", "Add a handoff note"],
    documents: requestDocuments,
    sourceRequest: request,
    sourceWorkstream: workstream,
    customerVisibleSummary: customerSummary,
    assignedUserId,
    assignedOrganizationId: participant?.organizationId,
    requiresCurrentUserAction: persona.isCustomer ? Boolean(workstream?.customerActionRequired && workstream.customerActionRequired.toLowerCase() !== "none") : personallyAssigned,
    requiresOrganizationAction: sameAgency(request.leadAgencyCode, persona.agencyCode),
    visibilityOnly: persona.isCustomer ? !Boolean(workstream?.customerActionRequired && workstream.customerActionRequired.toLowerCase() !== "none") : !personallyAssigned,
  };
}

function coordinationToWorkItem(request: CoordinationRequestRecord, persona: OperationalPersona): OperationalWorkItem {
  const incoming = sameAgency(request.targetOrgCode, persona.agencyCode);
  const ownAgency = sameAgency(request.requestingOrgCode, persona.agencyCode);
  const isCustomer = persona.isCustomer;
  const dueRelation = dateRelation(request.dueDate);
  return {
    id: request.code,
    sourceId: request.id,
    kind: "coordination",
    title: request.title,
    projectName: PROJECT_NAME,
    workstreamId: request.workstreamId,
    workstreamTitle: request.workstreamTitle,
    whyHere: isCustomer ? "Visible as a high-level project dependency; internal agency routing is hidden." : incoming ? `Received by ${request.targetOrgCode} because that agency is expected to provide the concurrence.` : ownAgency ? `In your agency's sent requests because ${request.targetOrgCode} is holding the next dependency.` : "In your supervisor's dependency queue because it affects the project handoff.",
    whatToDo: isCustomer ? "No SpaceX action is currently required." : incoming ? request.needDescription : `Monitor ${request.targetOrgCode}'s response and follow up if the due date is at risk.`,
    removesFromQueue: incoming ? "Respond, assign the request, or record a concurrence/objection." : "The target agency responds or the request is formally closed.",
    dueDate: request.dueDate,
    ageLabel: `${daysBetween(request.requestedDate)} days open`,
    waitLabel: `Waiting on ${request.targetOrgCode}`,
    scheduleImpact: request.priority === "critical_path" ? "Critical path · blocks the next agency release" : "Interagency dependency",
    statusLabel: request.status.replaceAll("_", " "),
    statusTone: request.status === "closed" || request.status === "concurred" ? "green" : request.priority === "critical_path" ? "red" : dueRelation === "overdue" ? "amber" : "blue",
    priorityScore: request.priority === "critical_path" ? 96 : dueRelation === "overdue" ? 68 : 42,
    isCriticalPath: request.priority === "critical_path",
    ownerName: request.assignedToUserName ?? request.targetOrgCode,
    ownerOrganization: request.targetOrgCode,
    waitingOn: request.targetOrgCode,
    nextHandoff: `Response from ${request.targetOrgCode}`,
    requiredInputs: ["Concurrence, objection, or status update", "Response summary"],
    documents: request.attachedDocumentVersionIds.map((id) => ({ id, label: "Attached supporting version" })),
    sourceCoordination: request,
    customerVisibleSummary: "Government agencies are coordinating this dependency. No SpaceX action is currently required.",
    assignedUserId: request.assignedToUserName ? participantForWorkstream(request.workstreamId)?.userId : undefined,
    requiresCurrentUserAction: incoming && Boolean(request.assignedToUserName && request.assignedToUserName.includes(persona.name)),
    requiresOrganizationAction: incoming,
    visibilityOnly: !incoming,
  };
}

function rfiToWorkItem(rfi: RFIRecord, persona: OperationalPersona): OperationalWorkItem {
  const response = rfi.responses?.find((entry) => !entry.reviewDecision);
  const forCustomer = persona.isCustomer && sameAgency(rfi.recipientOrgCode, "SPACEX");
  return {
    id: rfi.code,
    sourceId: rfi.id,
    kind: "rfi",
    title: forCustomer ? `Action required · ${rfi.title}` : response ? `RFI response ready for review · ${rfi.title}` : rfi.title,
    projectName: PROJECT_NAME,
    workstreamId: rfi.workstreamId,
    workstreamTitle: rfi.workstreamTitle,
    whyHere: forCustomer ? `Visible because ${rfi.requestingOrgCode} requested information from SpaceX.` : `Visible because ${rfi.requestingOrgCode} owns the review and ${response ? "a response is ready for your decision" : "the RFI affects your workstream"}.`,
    whatToDo: forCustomer ? `Respond with the requested information by ${humanDate(rfi.responseDeadline)}.` : response ? "Accept the response or request clarification before resuming the review." : "Monitor the applicant response and accept it when received.",
    removesFromQueue: forCustomer ? "Submit the response and required documents." : "Accept the response, request clarification, or record the review decision.",
    dueDate: rfi.responseDeadline,
    ageLabel: `${daysBetween(rfi.issuedDate)} days since issued`,
    waitLabel: forCustomer ? "Waiting on SpaceX" : "Response received",
    scheduleImpact: rfi.clockImpact === "clock_paused" ? `Clock paused · ${rfi.scheduleImpactDays} days added to forecast` : "Review clock running",
    statusLabel: response ? "Response ready" : rfi.status.replaceAll("_", " "),
    statusTone: response ? "amber" : forCustomer ? "red" : "blue",
    priorityScore: response ? 94 : forCustomer ? 88 : 35,
    isCriticalPath: rfi.clockImpact === "clock_paused",
    ownerName: forCustomer ? rfi.requestingOrgCode : "Assigned reviewer",
    ownerOrganization: rfi.requestingOrgCode,
    waitingOn: forCustomer ? "SpaceX Regulatory Engineering" : "RFI reviewer",
    nextHandoff: response ? "Resume the linked review" : "Response acceptance",
    requiredInputs: rfi.requiredDocumentTypes,
    documents: (response?.attachedDocumentVersionIds ?? []).map((id) => ({ id, label: "Submitted response document" })),
    sourceRfi: rfi,
    hasRfiResponse: Boolean(response),
    customerVisibleSummary: forCustomer ? `Action required from SpaceX: ${rfi.questionText}` : "A response is available for reviewer acceptance.",
    requiresCurrentUserAction: forCustomer || Boolean(response && persona.workspace !== "customer"),
    requiresOrganizationAction: forCustomer || sameAgency(rfi.requestingOrgCode, persona.agencyCode),
    visibilityOnly: !forCustomer && !response,
  };
}

function documentToWorkItem(document: DocumentRecord, persona: OperationalPersona): OperationalWorkItem[] {
  const currentVersion = document.versions.find((version) => version.versionTag.startsWith(`v${document.currentVersionNumber}`)) ?? document.versions[0];
  if (!currentVersion) return [];
  const pendingReviews = document.agencyReviews.filter((review) => review.documentVersionId === currentVersion.id && review.reviewStatus === "under_review");
  const visibleReviews = persona.isCustomer ? [] : pendingReviews.filter((review) => persona.workspace !== "reviewer" || sameAgency(review.reviewingOrgCode, persona.agencyCode));
  return visibleReviews.map((review) => ({
    id: `${document.id}:${currentVersion.id}:${review.reviewingOrgCode}`,
    sourceId: currentVersion.id,
    kind: "document" as const,
    title: `Review ${currentVersion.versionTag} · ${document.title}`,
    projectName: PROJECT_NAME,
    workstreamId: review.workstreamId,
    workstreamTitle: review.workstreamId,
    whyHere: `You are reviewing ${currentVersion.versionTag} because ${review.reviewingOrgCode} signoff is required for this exact version.`,
    whatToDo: "Review this revision and approve, approve with comments, or request a revision.",
    removesFromQueue: "Record a decision against this exact document version.",
    dueDate: AS_OF_DATE,
    ageLabel: `${daysBetween(currentVersion.uploadedAt.slice(0, 10))} days since upload`,
    scheduleImpact: "Document gate · downstream review waits for this decision",
    statusLabel: "Awaiting signoff",
    statusTone: "amber" as const,
    priorityScore: 86,
    isCriticalPath: true,
    ownerName: currentVersion.uploadedByName,
    ownerOrganization: currentVersion.uploadedByName.includes("SpaceX") ? "SPACEX" : document.ownerOrgCode,
    nextHandoff: "All required agencies sign off, then the workflow can advance",
    requiredInputs: ["Review exact revision", "Decision comment"],
    documents: [{ id: currentVersion.id, label: document.title, version: currentVersion.versionTag }],
    sourceDocument: document,
    exactDocumentVersionId: currentVersion.id,
    exactDocumentVersionLabel: currentVersion.versionTag,
    customerVisibleSummary: `${document.title} ${currentVersion.versionTag} is under authorized agency review.`,
    requiresCurrentUserAction: persona.workspace !== "customer" && pendingReviews.some((review) => sameAgency(review.reviewingOrgCode, persona.agencyCode)),
    requiresOrganizationAction: persona.workspace !== "customer" && pendingReviews.some((review) => sameAgency(review.reviewingOrgCode, persona.agencyCode)),
    visibilityOnly: false,
  }));
}

function commitmentToWorkItem(commitment: CommitmentRecord, persona: OperationalPersona): OperationalWorkItem | null {
  if (persona.isCustomer || persona.workspace === "reviewer" && !sameAgency(commitment.committingOrgCode, persona.agencyCode)) return null;
  return {
    id: commitment.id,
    sourceId: commitment.id,
    kind: "commitment",
    title: commitment.committedAction,
    projectName: PROJECT_NAME,
    workstreamId: commitment.workstreamId,
    workstreamTitle: commitment.workstreamTitle ?? commitment.workstreamId,
    whyHere: `In your queue because ${commitment.committingOrgCode} committed to this action.` ,
    whatToDo: "Confirm delivery or update the commitment status before the promised date.",
    removesFromQueue: "Mark fulfilled, waived, or formally record why the date needs attention.",
    dueDate: commitment.promisedDueDate,
    ageLabel: `${daysBetween(commitment.committedDate)} days since commitment`,
    scheduleImpact: commitment.isCriticalPathImpact ? `Critical path · ${commitment.impactIfMissed}` : commitment.impactIfMissed,
    statusLabel: commitment.status.replaceAll("_", " "),
    statusTone: commitment.status === "missed" ? "red" : commitment.status === "at_risk" ? "amber" : commitment.status === "fulfilled" ? "green" : "blue",
    priorityScore: commitment.isCriticalPathImpact ? 78 : 35,
    isCriticalPath: commitment.isCriticalPathImpact,
    ownerName: commitment.madeByPersonName,
    ownerOrganization: commitment.committingOrgCode,
    requiredInputs: ["Commitment update", "Delivery note"],
    documents: [],
  };
}

function customerRequestToWorkItem(
  request: CustomerRequestRecord,
  persona: OperationalPersona,
  workstream?: WorkstreamRecord
): OperationalWorkItem {
  const isSubmitter = persona.isCustomer;
  const isSupervisorOrAdmin = persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin";
  const isTargetAgency = request.knownAgencyCode ? sameAgency(request.knownAgencyCode, persona.agencyCode) : true;
  const isTriage = request.status === "triage" || request.status === "submitted";
  const isActionRequired = isSubmitter
    ? request.status === "draft"
    : isTriage || request.status === "in_progress";

  const tone = request.status === "resolved" || request.status === "closed"
    ? "green" as const
    : request.blocksActiveWork || request.scheduleImportance === "critical"
    ? "red" as const
    : request.status === "in_progress"
    ? "blue" as const
    : "amber" as const;

  const assignedAgency = request.knownAgencyCode || workstream?.regulatoryLead.orgCode || "State Project Office";

  return {
    id: request.id,
    sourceId: request.id,
    kind: "customer_request",
    title: request.title,
    projectName: "SpaceX Pecan Island Launch Complex",
    workstreamId: request.relatedWorkstreamId ?? workstream?.id ?? "WS-CUSTOMER-INTAKE",
    workstreamTitle: workstream?.title ?? (request.knownAgencyCode ? `${request.knownAgencyCode} Request · ${request.title}` : `Customer Request · ${request.confirmationNumber}`),
    statusTone: tone,
    statusLabel: request.status.replaceAll("_", " ").toUpperCase(),
    whyHere: isSubmitter
      ? "You submitted this request to the Louisiana Project Delivery team."
      : isSupervisorOrAdmin
      ? `Customer intake request submitted by ${request.submittedByName || "SpaceX"} awaiting project office action.`
      : `Customer intake request routed to ${assignedAgency} for technical action.`,
    whatToDo: isSubmitter
      ? request.status === "draft"
        ? "Provide the additional information requested by the project concierge."
        : "Awaiting government triage and assignment."
      : isTriage
      ? "Review the customer's request, accept into workflow, or request clarification."
      : "Complete the technical action and notify the customer.",
    removesFromQueue: isSubmitter ? "Providing the requested information" : "Accepting into workflow or completing the request",
    dueDate: request.desiredDate ?? new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
    ageLabel: `Submitted ${request.createdAt ? new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "recently"}`,
    scheduleImpact: request.blocksActiveWork ? "Blocks active SpaceX project work" : "Routine customer coordination",
    nextHandoff: isSubmitter ? "State Project Office Review" : `${assignedAgency} Technical Reviewer`,
    requiredInputs: request.attachmentDocumentVersionIds?.length ? ["Attached document versions verified"] : ["Customer description and requested outcome"],
    documents: [],
    customerVisibleSummary: request.description,
    requiresCurrentUserAction: isActionRequired && (isSubmitter || isSupervisorOrAdmin || isTargetAgency),
    requiresOrganizationAction: isTargetAgency || isSupervisorOrAdmin,
    visibilityOnly: false,
    priorityScore: request.blocksActiveWork ? 95 : request.scheduleImportance === "critical" ? 85 : 60,
    isCriticalPath: request.blocksActiveWork || Boolean(workstream?.isCriticalPath),
    ownerOrganization: assignedAgency,
    ownerName: request.submittedByName ?? "State Project Concierge",
  };
}

export function getOperationalWorkItems(options: {
  persona: DemoPersona | null;
  requests?: ServiceRequest[];
  workstreams?: WorkstreamRecord[];
  coordinationRequests?: CoordinationRequestRecord[];
  rfis?: RFIRecord[];
  documents?: DocumentRecord[];
  commitments?: CommitmentRecord[];
  customerRequests?: CustomerRequestRecord[];
}): { persona: OperationalPersona; items: OperationalWorkItem[] } {
  const persona = getOperationalPersona(options.persona);
  const requests = options.requests ?? Object.values(pecanIslandRequests);
  const workstreams = options.workstreams ?? workstreamsData;
  const workstreamById = new Map(workstreams.map((workstream) => [workstream.id, workstream]));
  const items: OperationalWorkItem[] = [];

  if (persona.workspace !== "customer") {
    for (const request of requests) {
      const workstream = workstreamById.get(requestWorkstreamMap[request.id]);
      const item = requestToWorkItem(request, persona, workstream);
      const relevant = persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin"
        || persona.workspace === "agency"
        || item.assignedUserId === `user-${persona.id}`
        || includesAny(request.owner.name, [persona.name, persona.name.split(" ")[0]]);
      if (relevant) items.push(item);
    }
  } else {
    for (const request of requests) items.push(requestToWorkItem(request, persona, workstreamById.get(requestWorkstreamMap[request.id])));
  }

  for (const request of options.coordinationRequests ?? coordinationRequestsData) {
    if (persona.workspace === "customer" || persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin" || sameAgency(request.targetOrgCode, persona.agencyCode) || sameAgency(request.requestingOrgCode, persona.agencyCode)) {
      items.push(coordinationToWorkItem(request, persona));
    }
  }
  for (const rfi of options.rfis ?? rfisData) {
    const responseReadyForAssignedReviewer = rfi.responses?.some((response) => !response.reviewDecision) && persona.id === (participantForWorkstream(rfi.workstreamId)?.userId ?? "");
    if (persona.workspace === "customer" || persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin" || sameAgency(rfi.requestingOrgCode, persona.agencyCode) || Boolean(responseReadyForAssignedReviewer)) {
      items.push(rfiToWorkItem(rfi, persona));
    }
  }
  for (const document of options.documents ?? projectDocumentsData) items.push(...documentToWorkItem(document, persona));
  for (const commitment of options.commitments ?? commitmentsData) {
    const item = commitmentToWorkItem(commitment, persona);
    if (item && (persona.workspace !== "reviewer" || sameAgency(commitment.committingOrgCode, persona.agencyCode))) items.push(item);
  }
  for (const customerRequest of options.customerRequests ?? []) {
    const ws = customerRequest.relatedWorkstreamId ? workstreamById.get(customerRequest.relatedWorkstreamId) : undefined;
    const isTarget = persona.workspace === "customer"
      ? customerRequest.submittedByUserId === persona.id || persona.isCustomer
      : persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin" || (customerRequest.knownAgencyCode && sameAgency(customerRequest.knownAgencyCode, persona.agencyCode)) || !customerRequest.knownAgencyCode;
    if (isTarget) {
      items.push(customerRequestToWorkItem(customerRequest, persona, ws));
    }
  }

  const deduped = new Map<string, OperationalWorkItem>();
  for (const item of items) {
    if (item.id.startsWith("hidden-")) continue;
    const existing = deduped.get(item.id);
    if (!existing || item.priorityScore > existing.priorityScore) deduped.set(item.id, item);
  }
  return { persona, items: Array.from(deduped.values()).sort((a, b) => b.priorityScore - a.priorityScore || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")) };
}

export function groupMyWork(items: OperationalWorkItem[]): QueueGroup[] {
  const actionItems = items.filter((item) => item.kind !== "workflow" || !item.statusLabel.toLowerCase().includes("complete"));
  const sections: Array<[QueueSectionId, string, string]> = [
    ["needs_action", "Needs my action", "The work that can move forward when you act."],
    ["due_today", "Due today", "Commitments and decisions due before the end of today."],
    ["overdue", "Overdue", "Past the expected date and needing a recovery decision."],
    ["waiting", "Waiting on others", "The next move belongs to another person or agency."],
    ["upcoming", "Upcoming", "Next actions with time remaining."],
    ["recently_completed", "Recently completed", "Work that recently left your active queue."],
  ];
  const assigned = new Map<QueueSectionId, OperationalWorkItem[]>();
  for (const [id] of sections) assigned.set(id, []);
  for (const item of actionItems) {
    const isActionable = item.requiresCurrentUserAction ?? (item.statusTone === "red" || item.priorityScore >= 70 && !item.waitLabel?.toLowerCase().includes("waiting"));
    const isWaiting = !isActionable && (Boolean(item.waitingOn) || Boolean(item.waitLabel));
    const bucket: QueueSectionId = dateRelation(item.dueDate) === "overdue" && item.statusTone !== "green" ? "overdue" : dateRelation(item.dueDate) === "today" ? "due_today" : isActionable ? "needs_action" : isWaiting ? "waiting" : item.statusTone === "green" ? "recently_completed" : "upcoming";
    assigned.get(bucket)?.push(item);
  }
  return sections.map(([id, label, description]) => ({ id, label, description, items: (assigned.get(id) ?? []).slice(0, 6) }));
}

export function getAvailableActions(item: OperationalWorkItem, persona: OperationalPersona): WorkActionId[] {
  if (persona.isCustomer) {
    if (item.kind === "rfi" && (item.statusTone === "red" || item.statusLabel.toLowerCase().includes("waiting") || !item.hasRfiResponse)) {
      return ["respond", "upload_documents"];
    }
    return [];
  }

  const actions: WorkActionId[] = [];
  if (item.kind === "document") {
    if (persona.permissions.includes("edit_workflow") || persona.workspace === "reviewer" || persona.workspace === "agency" || persona.workspace === "supervisor") {
      actions.push("approve_document", "approve_with_comments", "request_revision", "add_note");
    }
  } else if (item.kind === "rfi") {
    if (item.hasRfiResponse || item.statusLabel.toLowerCase().includes("submitted")) {
      actions.push("accept_rfi_response", "request_clarification", "add_note");
    } else {
      actions.push("request_information", "add_note");
    }
  } else if (item.kind === "customer_request") {
    actions.push("complete_step", "request_information", "mark_blocked", "escalate", "transfer", "add_note");
  } else if (item.kind === "coordination") {
    actions.push("request_information", "add_note");
  } else if (item.kind === "workflow" || item.kind === "task") {
    if (item.statusTone !== "green") {
      actions.push("complete_step", "request_information", "mark_blocked");
      if (item.statusTone === "red" || item.statusLabel.toLowerCase().includes("block") || item.statusLabel.toLowerCase().includes("wait")) {
        actions.push("clear_blocker");
      }
    }
    actions.push("escalate", "transfer", "add_note");
  }

  if (persona.permissions.includes("reassign_agency") || persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin") {
    actions.push("transfer");
  }
  if (persona.permissions.includes("escalate_liaison") && item.statusTone !== "green") {
    actions.push("escalate");
  }
  if (!persona.isCustomer) {
    actions.push("add_note");
  }

  return Array.from(new Set(actions));
}

export function getCompletionRequirements(item: OperationalWorkItem) {
  const template = workflowTemplatesData.find((candidate) => candidate.permitTypeId === item.sourceWorkstream?.permitTypeId) as WorkflowTemplateRecord | undefined;
  const stage = template?.versions.find((version) => version.versionNumber === template.activeVersionNumber)?.stages.find((candidate) => candidate.id === item.sourceWorkstream?.currentStageId || item.sourceWorkstream?.currentStageName?.toLowerCase().includes(candidate.name.toLowerCase().split(" ")[0]));
  const requirements = stage?.completionRequirements?.length ? stage.completionRequirements : ["Assigned work reviewed", "Required documents present", "Open dependencies acknowledged", "Reviewer determination recorded"];
  return requirements.map((label, index) => ({ id: `${item.id}-requirement-${index}`, label, complete: index < 3 || item.statusTone === "green" }));
}

export function getCompletionPreview(item: OperationalWorkItem) {
  const nextOwner = item.sourceWorkstream?.nextExpectedEvent ?? item.nextOwner ?? "the next configured workflow owner";
  return {
    effects: [
      "close your assignment",
      `advance ${item.workstreamTitle} to the next configured stage`,
      `assign the next action to ${nextOwner}`,
      "notify the resolved project participants",
      item.isCriticalPath ? "recalculate the critical-path schedule" : "refresh the workstream status",
    ],
    nextOwner,
  };
}

export function getRecipientPreview(item: OperationalWorkItem, action: WorkActionId, persona: OperationalPersona): RecipientPreview {
  const concierge = projectProfiles.find((profile) => profile.projectRole.toLowerCase().includes("concierge"));
  const targetAgency = item.sourceCoordination?.targetOrgCode ?? item.sourceWorkstream?.waitingOnEntity ?? "responsible agency";
  if (action === "mark_blocked") {
    return {
      recipients: [
        { label: "Target agency", name: `${targetAgency} project liaison`, organization: `${targetAgency} coordination team` },
        { label: "Project concierge", name: concierge?.fullName ?? "State Project Office", organization: concierge ? `${concierge.organizationName} · Concierge` : "Louisiana State Project Office · Concierge" },
      ],
      customerMessage: `${item.ownerOrganization} is waiting on ${targetAgency}. No SpaceX action is currently required unless a request appears in your action queue.`,
    };
  }
  if (action === "request_information") {
    return {
      recipients: [
        { label: "Action owner", name: "SpaceX Regulatory Engineering", organization: "SpaceX" },
        { label: "Project concierge", name: concierge?.fullName ?? "State Project Office", organization: concierge?.organizationName ?? "Louisiana State Project Office" },
      ],
      customerMessage: "A document request will appear in the SpaceX action queue.",
    };
  }
  if (action === "escalate") {
    const tier = item.sourceRequest?.escalationPath.find((entry) => entry.status !== "idle") ?? item.sourceRequest?.escalationPath[0];
    return {
      recipients: [{ label: "Next escalation", name: tier?.contactName ?? concierge?.fullName ?? "State Project Office", organization: tier?.agency ?? concierge?.organizationName ?? "Louisiana Project Office" }],
    };
  }
  if (action === "transfer") {
    return { recipients: [{ label: "Supervisor", name: concierge?.fullName ?? "State Project Office", organization: concierge?.organizationName ?? "Louisiana Project Office" }] };
  }
  return { recipients: [{ label: "Action owner", name: item.ownerName, organization: item.ownerOrganization }] };
}

export function sanitizeCustomerItem(item: OperationalWorkItem): Pick<OperationalWorkItem, "id" | "title" | "workstreamTitle" | "statusLabel" | "dueDate" | "whatToDo" | "customerVisibleSummary" | "scheduleImpact"> {
  return {
    id: item.id,
    title: item.title,
    workstreamTitle: item.workstreamTitle,
    statusLabel: item.statusLabel,
    dueDate: item.dueDate,
    whatToDo: item.customerVisibleSummary ?? item.whatToDo,
    customerVisibleSummary: item.customerVisibleSummary,
    scheduleImpact: item.scheduleImpact,
  };
}

export function getPersonaFromEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return demoPersonas.find((persona) => persona.email.toLowerCase() === normalized || persona.legacyEmails?.some((alias) => alias.toLowerCase() === normalized)) ?? null;
}

export { requestWorkstreamMap, AS_OF_DATE };
