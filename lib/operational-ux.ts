import type {
  CommitmentRecord,
  CoordinationRequestRecord,
  CustomerRequestRecord,
  DocumentRecord,
  ITSMState,
  OperationalRecordProjection,
  PriorityLevel,
  RFIRecord,
  WorkflowTemplateRecord,
  WorkstreamRecord,
} from "./domain-models";
import {
  mapCustomerRequestStatusToITSMState,
  mapOperationalStateToITSMState,
  type ClockStatus,
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
import { PROJECT_DISPLAY_NAME } from "./product-copy";
import { asOfDate } from "./time";

export type WorkspaceMode = "reviewer" | "agency" | "supervisor" | "state_office" | "customer" | "admin";

export type WorkItemKind = "workflow" | "task" | "rfi" | "coordination" | "document" | "commitment" | "determination" | "customer_request";

export type WorkActionId =
  | "complete_step"
  | "update_status"
  | "advance_stage"
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
  | "coordination_response"
  | "upload_documents";

export type QueueSectionId = "needs_action" | "due_soon" | "waiting" | "recently_completed";

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
  submittedByName?: string;
  submittedByUserId?: string;
  assignedUserId?: string;
  assignedOrganizationId?: string;
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  itsmState?: ITSMState;
  priority?: PriorityLevel;
  clockStatus?: ClockStatus;
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

const PROJECT_NAME = PROJECT_DISPLAY_NAME;
const AS_OF_DATE = asOfDate();

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

function isPendingRfiResponse(response: NonNullable<RFIRecord["responses"]>[number]) {
  const decision = response.reviewDecision?.toLowerCase();
  return Boolean(response.responseText.trim()) && decision !== "accepted" && decision !== "rejected";
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
  return ["manage_roles", "edit_workflow", "triage_intake" as PermissionKey, "submit_requests", "add_blockers", "resolve_blockers", "escalate_liaison", "reassign_agency"];
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
  const itsmState = workstream?.itsmState ?? mapOperationalStateToITSMState(status);
  const isWaiting = ["waiting_government", "waiting_applicant", "waiting_external", "scheduled_hold", "statutory_waiting_period"].includes(status);
  const isComplete = status === "complete" || request.status === "approved";
  const isBlocked = status === "blocked" || Boolean(request.blocker);
  const currentAction = workstream?.currentActionSummary ?? request.blocker?.unblockingAction ?? request.nextSteps[0]?.body ?? "Review the assigned materials and record your determination.";
  const participant = workstream ? participantForTask(request.id, workstream.id) : undefined;
  const assignedUserId = workstream?.assignedToUserId ?? workstream?.assignedReviewerUserId ?? participant?.userId;
  const personallyAssigned = Boolean(assignedUserId && (assignedUserId === persona.id || assignedUserId === `user-${persona.id}`));
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
  const owner = workstream?.assignedToUserName ?? workstream?.regulatoryLead.assignedReviewerName ?? request.owner.name;
  const ownerOrg = workstream?.assignmentGroupName ?? workstream?.regulatoryLead.orgName ?? request.owner.agency;
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
    assignmentGroupId: workstream?.assignmentGroupId,
    assignmentGroupName: workstream?.assignmentGroupName,
    itsmState,
    priority: workstream?.priority ?? (request.isCriticalPath ? "P1" : "P3"),
    clockStatus: workstream?.clockStatus,
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

function rfiToWorkItem(rfi: RFIRecord, persona: OperationalPersona, workstream?: WorkstreamRecord): OperationalWorkItem {
  const response = rfi.responses?.find(isPendingRfiResponse);
  const forCustomer = persona.isCustomer && sameAgency(rfi.recipientOrgCode, "SPACEX");
  const assignedReviewer = workstream?.regulatoryLead.assignedReviewerName
    ?? participantForWorkstream(rfi.workstreamId)?.projectRole;
  const responseSubmitted = Boolean(response);
  const isTerminal = ["accepted", "closed", "rejected", "withdrawn"].includes(rfi.status);
  const waitingForApplicant = !responseSubmitted && !isTerminal;

  const waitLabel = isTerminal
    ? undefined
    : forCustomer && waitingForApplicant
    ? "Waiting on SpaceX"
    : forCustomer && responseSubmitted
    ? "Waiting on reviewer"
    : responseSubmitted
    ? undefined
    : "Waiting on applicant";

  const waitingOn = isTerminal
    ? undefined
    : forCustomer
    ? "SpaceX Regulatory Engineering"
    : "RFI reviewer";

  const statusLabel = isTerminal
    ? rfi.status === "accepted"
      ? "Accepted"
      : rfi.status.replaceAll("_", " ")
    : responseSubmitted
    ? "Response ready"
    : rfi.status.replaceAll("_", " ");

  const statusTone = isTerminal
    ? rfi.status === "accepted"
      ? ("green" as const)
      : ("slate" as const)
    : responseSubmitted
    ? ("amber" as const)
    : forCustomer && waitingForApplicant
    ? ("red" as const)
    : ("blue" as const);

  const whatToDo = isTerminal
    ? `RFI is ${rfi.status}. Review satisfied; no further action required.`
    : forCustomer && waitingForApplicant
    ? `Respond with the requested information by ${humanDate(rfi.responseDeadline)}.`
    : forCustomer && responseSubmitted
    ? "No action required from you right now; the reviewing agency is checking your response."
    : responseSubmitted
    ? "Accept the response or request clarification before resuming the review."
    : "No action required from you right now; monitor the applicant response.";

  const removesFromQueue = isTerminal
    ? "This item is complete."
    : forCustomer && responseSubmitted
    ? "Wait for the reviewing agency to accept the response or request clarification."
    : forCustomer
    ? "Submit the response and required documents."
    : responseSubmitted
    ? "Accept the response, request clarification, or record the review decision."
    : "Wait for the applicant response; review it when submitted.";

  const whyHere = isTerminal
    ? `Visible as completed RFI record (${rfi.code}).`
    : forCustomer
    ? `Visible because ${rfi.requestingOrgCode} requested information from SpaceX.`
    : `Visible because ${rfi.requestingOrgCode} owns the review and ${responseSubmitted ? "a response is ready for your decision" : "the RFI affects your workstream"}.`;

  const customerVisibleSummary = isTerminal
    ? `RFI ${rfi.code} is ${rfi.status}.`
    : forCustomer
    ? `Action required from SpaceX: ${rfi.questionText}`
    : responseSubmitted
    ? "A response is available for reviewer acceptance."
    : "Waiting for the applicant response before review can continue.";

  return {
    id: rfi.code,
    sourceId: rfi.id,
    kind: "rfi",
    title: isTerminal
      ? `${rfi.code} (${statusLabel}) · ${rfi.title}`
      : forCustomer && waitingForApplicant
      ? `Action required · ${rfi.title}`
      : forCustomer && responseSubmitted
      ? `Response submitted · ${rfi.title}`
      : responseSubmitted
      ? `RFI response ready for review · ${rfi.title}`
      : rfi.title,
    projectName: PROJECT_NAME,
    workstreamId: rfi.workstreamId,
    workstreamTitle: rfi.workstreamTitle,
    whyHere,
    whatToDo,
    removesFromQueue,
    dueDate: rfi.responseDeadline,
    ageLabel: `${daysBetween(rfi.issuedDate)} days since issued`,
    waitLabel,
    scheduleImpact: isTerminal
      ? "Review satisfied · hold cleared"
      : rfi.clockImpact === "clock_paused"
      ? `Clock paused · ${rfi.scheduleImpactDays} days added to forecast`
      : "Review clock running",
    statusLabel,
    statusTone,
    priorityScore: isTerminal ? 10 : responseSubmitted ? 94 : forCustomer && waitingForApplicant ? 88 : 35,
    isCriticalPath: !isTerminal && rfi.clockImpact === "clock_paused",
    ownerName: forCustomer ? rfi.requestingOrgCode : assignedReviewer ?? "Assigned reviewer",
    ownerOrganization: rfi.requestingOrgCode,
    assignedUserId: workstream?.assignedToUserId ?? participantForWorkstream(rfi.workstreamId)?.userId,
    nextOwner: responseSubmitted ? assignedReviewer ?? rfi.requestingOrgCode : undefined,
    waitingOn,
    nextHandoff: isTerminal ? "Review resumed" : response ? "Resume the linked review" : "Applicant response",
    requiredInputs: rfi.requiredDocumentTypes,
    documents: (response?.attachedDocumentVersionIds ?? []).map((id) => ({ id, label: "Submitted response document" })),
    sourceRfi: rfi,
    sourceWorkstream: workstream,
    hasRfiResponse: Boolean(response),
    customerVisibleSummary,
    requiresCurrentUserAction: !isTerminal && ((forCustomer && waitingForApplicant) || Boolean(responseSubmitted && persona.workspace !== "customer")),
    requiresOrganizationAction: !isTerminal && ((forCustomer && waitingForApplicant) || sameAgency(rfi.requestingOrgCode, persona.agencyCode)),
    visibilityOnly: isTerminal || ((!forCustomer || !waitingForApplicant) && !responseSubmitted),
  };
}

function documentToWorkItem(document: DocumentRecord, persona: OperationalPersona): OperationalWorkItem[] {
  const currentVersion = document.versions.find((version) => version.versionTag.startsWith(`v${document.currentVersionNumber}`)) ?? document.versions[0];
  if (!currentVersion) return [];
  const pendingReviews = document.agencyReviews.filter((review) => review.documentVersionId === currentVersion.id && review.reviewStatus === "under_review");
  const visibleReviews = persona.isCustomer
    ? []
    : pendingReviews.filter((review) =>
        (persona.workspace === "reviewer" || persona.workspace === "agency")
          ? sameAgency(review.reviewingOrgCode, persona.agencyCode)
          : true
      );
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
    dueDate: undefined,
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
  if (persona.isCustomer || (persona.workspace === "reviewer" || persona.workspace === "agency") && !sameAgency(commitment.committingOrgCode, persona.agencyCode)) return null;
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
  const isTargetAgency = request.knownAgencyCode ? sameAgency(request.knownAgencyCode, persona.agencyCode) : false;
  const isTriage = request.status === "triage" || request.status === "submitted";
  const isAssignedToMe = Boolean(
    (request.assignedToUserId && request.assignedToUserId === persona.id) ||
    (workstream?.assignedToUserId && workstream.assignedToUserId === persona.id)
  );
  const isActionRequired = isSubmitter
    ? request.status === "draft" || request.status === "pending_customer" || request.itsmState === "pending_customer"
    : isAssignedToMe || (isSupervisorOrAdmin && isTriage);

  const tone = request.status === "resolved" || request.status === "closed"
    ? ("green" as const)
    : request.blocksActiveWork || request.scheduleImportance === "critical"
    ? ("red" as const)
    : request.status === "in_progress"
    ? ("blue" as const)
    : ("amber" as const);

  const assignedAgency = request.assignmentGroupName || request.knownAgencyCode || workstream?.assignmentGroupName || workstream?.regulatoryLead.orgCode || "State Project Office";
  const ownerName = request.assignedToUserName ?? workstream?.assignedToUserName ?? "Unassigned";

  return {
    id: request.id,
    sourceId: request.id,
    kind: "customer_request",
    title: request.title,
    projectName: PROJECT_NAME,
    workstreamId: request.relatedWorkstreamId ?? workstream?.id ?? undefined,
    workstreamTitle: workstream?.title ?? (request.knownAgencyCode ? `${request.knownAgencyCode} Request · ${request.title}` : `Customer Request · ${request.confirmationNumber}`),
    statusTone: tone,
    statusLabel: request.status.replaceAll("_", " ").toUpperCase(),
    whyHere: isSubmitter
      ? "You submitted this request to the Louisiana Project Delivery team."
      : isSupervisorOrAdmin
      ? `Customer intake request submitted by ${request.submittedByName || "SpaceX"} awaiting project office action.`
      : isAssignedToMe
      ? `Assigned to you for technical review.`
      : `Customer intake request awaiting triage by project office.`,
    whatToDo: isSubmitter
      ? request.status === "pending_customer" || request.status === "draft"
        ? "Provide the additional clarification requested by the project office."
        : "Awaiting government triage and assignment."
      : isTriage
      ? isSupervisorOrAdmin
        ? "Review the customer's request, accept into workflow, or request clarification."
        : "Awaiting project office triage and assignment."
      : isAssignedToMe
      ? "Complete the technical action and notify the customer."
      : "Assigned to agency team for technical action.",
    removesFromQueue: isSubmitter
      ? "Providing the requested information"
      : isSupervisorOrAdmin && isTriage
      ? "Accepting into workflow or completing the request"
      : "Completing assigned review action",
    dueDate: request.desiredDate,
    ageLabel: `Submitted ${request.createdAt ? new Date(request.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "recently"}`,
    scheduleImpact: request.blocksActiveWork ? "Blocks active SpaceX project work" : "Routine customer coordination",
    nextHandoff: isSubmitter ? "State Project Office Review" : `${assignedAgency} Technical Reviewer`,
    requiredInputs: request.attachmentDocumentVersionIds?.length ? ["Attached document versions verified"] : ["Customer description and requested outcome"],
    documents: [],
    customerVisibleSummary: request.description,
    submittedByName: request.submittedByName ?? "SpaceX Representative",
    submittedByUserId: request.submittedByUserId,
    assignedUserId: request.assignedToUserId ?? workstream?.assignedToUserId,
    assignmentGroupId: request.assignmentGroupId ?? workstream?.assignmentGroupId,
    assignmentGroupName: request.assignmentGroupName ?? workstream?.assignmentGroupName,
    itsmState: request.itsmState ?? mapCustomerRequestStatusToITSMState(request.status),
    priority: request.priority,
    clockStatus: request.clockStatus,
    requiresCurrentUserAction: isActionRequired,
    requiresOrganizationAction: isTargetAgency || isSupervisorOrAdmin,
    visibilityOnly: !isActionRequired,
    priorityScore: request.blocksActiveWork ? 95 : request.scheduleImportance === "critical" ? 85 : 60,
    isCriticalPath: request.blocksActiveWork || Boolean(workstream?.isCriticalPath),
    ownerOrganization: assignedAgency,
    ownerName,
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
  const personaUserIds = new Set([persona.id, `user-${persona.id}`]);
  const requests = options.requests ?? Object.values(pecanIslandRequests);
  const workstreams = options.workstreams ?? workstreamsData;
  const workstreamById = new Map(workstreams.map((workstream) => [workstream.id, workstream]));
  const items: OperationalWorkItem[] = [];

  if (persona.workspace !== "customer") {
    for (const request of requests) {
      const workstream = workstreamById.get(requestWorkstreamMap[request.id]);
      const item = requestToWorkItem(request, persona, workstream);
      const relevant = persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin"
        || (persona.workspace === "agency" && sameAgency(request.leadAgencyCode, persona.agencyCode))
        || Boolean(item.assignedUserId && personaUserIds.has(item.assignedUserId))
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
    const responseReadyForAssignedReviewer = rfi.responses?.some(isPendingRfiResponse) && personaUserIds.has(participantForWorkstream(rfi.workstreamId)?.userId ?? "");
    if (persona.workspace === "customer" || persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin" || sameAgency(rfi.requestingOrgCode, persona.agencyCode) || Boolean(responseReadyForAssignedReviewer)) {
      items.push(rfiToWorkItem(rfi, persona, workstreamById.get(rfi.workstreamId)));
    }
  }
  for (const document of options.documents ?? projectDocumentsData) items.push(...documentToWorkItem(document, persona));
  for (const commitment of options.commitments ?? commitmentsData) {
    const item = commitmentToWorkItem(commitment, persona);
    if (item && (persona.workspace !== "reviewer" || sameAgency(commitment.committingOrgCode, persona.agencyCode))) items.push(item);
  }
  // SpaceX team members (including the program supervisor persona) are still
  // customer-tenanted for request privacy. Government personas retain the
  // broader triage/agency projection below.
  const isCustomerTenant = persona.isCustomer || persona.organization.toUpperCase().includes("SPACEX");
  for (const customerRequest of options.customerRequests ?? []) {
    const ws = customerRequest.relatedWorkstreamId ? workstreamById.get(customerRequest.relatedWorkstreamId) : undefined;
    const isTarget = isCustomerTenant
      ? Boolean(customerRequest.submittedByUserId && personaUserIds.has(customerRequest.submittedByUserId))
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

export function isTerminalWorkItem(item: OperationalWorkItem): boolean {
  if (item.itsmState === "resolved" || item.itsmState === "closed") return true;
  if (item.sourceRfi && ["accepted", "closed", "rejected", "withdrawn"].includes(item.sourceRfi.status)) return true;
  if (item.sourceWorkstream && ["complete", "cancelled"].includes(item.sourceWorkstream.operationalState)) return true;
  if (item.sourceRequest && ["resolved", "closed"].includes(item.sourceRequest.status)) return true;
  if (item.sourceCoordination && ["concurred", "closed"].includes(item.sourceCoordination.status)) return true;
  return false;
}

export function groupMyWork(items: OperationalWorkItem[]): QueueGroup[] {
  const actionItems = items.filter((item) => item.kind !== "workflow" || !item.statusLabel.toLowerCase().includes("complete"));
  const sections: Array<[QueueSectionId, string, string]> = [
    ["needs_action", "Needs my action", "The work that can move forward when you act."],
    ["due_soon", "Due soon", "Upcoming work with a near-term date or schedule impact."],
    ["waiting", "Waiting on others", "The next move belongs to another person or agency."],
    ["recently_completed", "Recently completed", "Work that recently left your active queue."],
  ];
  const assigned = new Map<QueueSectionId, OperationalWorkItem[]>();
  for (const [id] of sections) assigned.set(id, []);
  for (const item of actionItems) {
    const isTerminal = isTerminalWorkItem(item);
    const isActionable = !isTerminal && requiresCurrentUserAction(item);
    const isWaiting = !isTerminal && !isActionable && (Boolean(item.waitingOn) || Boolean(item.waitLabel));
    const hasDueDate = !isTerminal && !isActionable && Boolean(item.dueDate);
    const bucket: QueueSectionId | null = isTerminal
      ? "recently_completed"
      : isActionable
      ? "needs_action"
      : isWaiting
      ? "waiting"
      : hasDueDate
      ? "due_soon"
      : null;
    if (bucket) assigned.get(bucket)?.push(item);
  }
  return sections.map(([id, label, description]) => ({ id, label, description, items: assigned.get(id) ?? [] }));
}

export type TeamWorkSectionId = "unassigned" | "assigned" | "waiting" | "completed";

export type TeamWorkGroup = {
  id: TeamWorkSectionId;
  label: string;
  description: string;
  items: OperationalWorkItem[];
};

export function groupTeamWork(items: OperationalWorkItem[]): TeamWorkGroup[] {
  const sections: Array<[TeamWorkSectionId, string, string]> = [
    ["unassigned", "Unassigned", "Work waiting for a team member to take ownership."],
    ["assigned", "Assigned", "Work actively owned by a team member."],
    ["waiting", "Waiting", "Work waiting on applicant or another agency."],
    ["completed", "Completed", "Work recently finished by the team."],
  ];
  const assigned = new Map<TeamWorkSectionId, OperationalWorkItem[]>();
  for (const [id] of sections) assigned.set(id, []);

  for (const item of items) {
    const isTerminal = isTerminalWorkItem(item);
    const hasAssignee = Boolean(item.assignedUserId);
    const isWaiting = !isTerminal && (Boolean(item.waitingOn) || Boolean(item.waitLabel));

    const bucket: TeamWorkSectionId = isTerminal
      ? "completed"
      : !hasAssignee
      ? "unassigned"
      : isWaiting
      ? "waiting"
      : "assigned";

    assigned.get(bucket)?.push(item);
  }

  return sections.map(([id, label, description]) => ({ id, label, description, items: assigned.get(id) ?? [] }));
}

export function requiresCurrentUserAction(item: OperationalWorkItem): boolean {
  if (isTerminalWorkItem(item)) return false;
  return Boolean(item.requiresCurrentUserAction);
}

export function toOperationalRecordProjection(item: OperationalWorkItem): OperationalRecordProjection {
  const isTerminal = isTerminalWorkItem(item);
  const rfiIds = item.sourceWorkstream?.rfis?.map((r) => r.id) ?? (item.sourceRfi ? [item.sourceRfi.id] : []);
  const responseIds = item.sourceRfi?.responses?.map((r) => r.id) ?? [];
  const docIds = item.documents.map((d) => d.id);
  const depIds = item.sourceWorkstream?.tasks?.flatMap((t) => t.predecessorTaskIds ?? []) ?? [];

  return {
    id: item.sourceId || item.id,
    kind: item.kind,
    code: item.sourceRfi?.code ?? item.sourceWorkstream?.code ?? item.id,
    title: item.title,
    projectId: item.sourceWorkstream?.projectId ?? (item.sourceRequest as (ServiceRequest & { projectId?: string }) | undefined)?.projectId,
    projectName: item.projectName,
    parentWorkstreamId: item.workstreamId,
    parentWorkstreamTitle: item.workstreamTitle,
    submitterId: item.submittedByUserId,
    submitterName: item.submittedByName,
    assignedUserId: item.assignedUserId,
    assigneeName: item.ownerName,
    assignmentGroupId: item.assignmentGroupId,
    assignmentGroupName: item.assignmentGroupName,
    owningAgencyCode: item.ownerOrganization,
    owningAgencyName: item.ownerOrganization,
    lifecycleState: item.itsmState ?? (isTerminal ? "resolved" : "in_progress"),
    rawStatus: item.statusLabel,
    health: item.statusTone === "red" ? "red" : item.statusTone === "amber" ? "yellow" : "green",
    clockState: item.clockStatus ?? (isTerminal ? "stopped" : "active"),
    waitingParty: isTerminal ? undefined : item.waitingOn,
    waitingReason: isTerminal ? undefined : item.waitLabel,
    currentStep: item.workstreamTitle,
    nextAction: item.whatToDo,
    relatedRfiIds: rfiIds,
    relatedResponseIds: responseIds,
    relatedDocumentIds: docIds,
    relatedDependencyIds: depIds,
    customerSafeSummary: item.customerVisibleSummary ?? item.whyHere,
  };
}

export function getAvailableActions(item: OperationalWorkItem, persona: OperationalPersona): WorkActionId[] {
  if (persona.isCustomer) {
    if (item.kind === "customer_request" && (item.itsmState === "pending_customer" || item.statusLabel.toLowerCase().includes("pending"))) {
      return ["respond"];
    }
    if (item.kind === "rfi" && (item.statusTone === "red" || item.statusLabel.toLowerCase().includes("waiting") || !item.hasRfiResponse)) {
      return ["respond", "upload_documents"];
    }
    return [];
  }

  const actions: WorkActionId[] = [];
  const isSupervisorOrAbove = persona.workspace === "supervisor" || persona.workspace === "state_office" || persona.workspace === "admin";

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
    // An agency-routed request can open an RFI even before a workstream is
    // linked. A truly unassigned intake only supports clarification until the
    // state office establishes the authoritative workstream relationship.
    const informationAction = item.workstreamId || item.requiresOrganizationAction || item.ownerOrganization !== "State Project Office"
      ? "request_information"
      : "request_clarification";
    actions.push("complete_step", "update_status", informationAction, "mark_blocked", "escalate", "transfer", "add_note");
  } else if (item.kind === "commitment") {
    // Commitments need the ability to mark fulfilled, update status, request info, and block
    if (item.statusTone !== "green") {
      actions.push("complete_step", "update_status", "mark_blocked");
      if (item.statusTone === "red" || item.statusLabel.toLowerCase().includes("miss") || item.statusLabel.toLowerCase().includes("risk")) {
        actions.push("escalate");
      }
    }
    actions.push("request_information", "add_note");
  } else if (item.kind === "coordination") {
    if (item.statusTone !== "green") {
      actions.push("coordination_response", "mark_blocked");
    }
    actions.push("request_information", "add_note");
  } else if (item.kind === "workflow" || item.kind === "task") {
    if (item.statusTone !== "green") {
      actions.push("complete_step", "update_status", "advance_stage", "request_information", "mark_blocked");
      if (item.statusTone === "red" || item.statusLabel.toLowerCase().includes("block") || item.statusLabel.toLowerCase().includes("wait")) {
        actions.push("clear_blocker");
      }
    }
    actions.push("escalate", "transfer", "add_note");
  }

  // Supervisor, state office, and admin always get transfer and escalate on non-green items
  if (isSupervisorOrAbove) {
    actions.push("transfer");
    if (item.statusTone !== "green") {
      actions.push("escalate");
      // State office and admin can always update status on anything
      actions.push("update_status");
    }
  }
  if (persona.permissions.includes("reassign_agency")) {
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

export function isAdministrator(persona: OperationalPersona | DemoPersona | null | undefined): boolean {
  if (!persona) return false;
  const p = persona as Record<string, unknown>;
  const role = String(p.role ?? "").toLowerCase();
  const roleId = String(p.roleId ?? "").toLowerCase();
  const workspace = String(p.workspace ?? "").toLowerCase();
  const perms = Array.isArray(p.permissions) ? (p.permissions as string[]) : [];
  return (
    role === "admin" ||
    roleId === "admin" ||
    workspace === "admin" ||
    role.includes("admin") ||
    perms.includes("admin") ||
    perms.includes("system_admin")
  );
}

export function canUserModifyItem(item: OperationalWorkItem, persona: OperationalPersona | DemoPersona | null | undefined): boolean {
  if (!persona) return false;
  if (isAdministrator(persona)) return true; // Admins can do anything and everything no matter what!

  const p = persona as Record<string, unknown>;
  const isCustomer = Boolean(p.isCustomer);
  const workspace = String(p.workspace ?? "").toLowerCase();
  const perms = Array.isArray(p.permissions) ? (p.permissions as string[]) : [];
  const agencyCode = String(p.agencyCode ?? p.agency ?? "").toUpperCase();
  const personaId = String(p.id ?? "");

  if (isCustomer) {
    const customerIds = new Set([String(p.id ?? ""), `user-${String(p.id ?? "")}`]);
    if (item.kind === "customer_request" && Boolean(item.submittedByUserId && customerIds.has(item.submittedByUserId))) return true;
    if (item.kind === "rfi" && (item.statusTone === "red" || item.statusLabel.toLowerCase().includes("waiting") || !item.hasRfiResponse)) {
      return true;
    }
    return false;
  }

  // Supervisors & State Project Office can modify government-side items
  if (workspace === "supervisor" || workspace === "state_office" || perms.includes("edit_workflow") || perms.includes("reassign_agency")) {
    return true;
  }

  // Direct assignment or agency match
  if (item.assignedUserId && (item.assignedUserId === personaId || item.assignedUserId === `user-${personaId}`)) {
    return true;
  }
  if (item.requiresCurrentUserAction) {
    return true;
  }
  if (item.requiresOrganizationAction && sameAgency(item.ownerOrganization, agencyCode)) {
    return true;
  }
  if (sameAgency(item.ownerOrganization, agencyCode)) {
    return true;
  }

  return false;
}

export function canUserPerformAction(item: OperationalWorkItem, action: WorkActionId, persona: OperationalPersona | DemoPersona | null | undefined): boolean {
  if (!persona) return false;
  if (isAdministrator(persona)) return true; // Admins can do anything and everything no matter what!

  if (!canUserModifyItem(item, persona)) {
    const p = persona as Record<string, unknown>;
    if (!p.isCustomer && action === "add_note") return true;
    return false;
  }

  const p = persona as Record<string, unknown>;
  const isCustomer = Boolean(p.isCustomer);
  if (isCustomer) {
    return action === "respond" || action === "upload_documents";
  }

  const opPersona = (persona as OperationalPersona).permissions ? (persona as OperationalPersona) : getOperationalPersona(persona as DemoPersona);
  const available = getAvailableActions(item, opPersona);
  return available.includes(action);
}

export function getCompletionRequirements(item: OperationalWorkItem, templates: WorkflowTemplateRecord[] = []) {
  const workstream = item.sourceWorkstream;
  const version = templates.flatMap((template) => template.versions)
    .find((candidate) => candidate.id === workstream?.workflowVersionId);
  const stage = version?.stages.find((candidate) => candidate.id === workstream?.currentStageId);
  const requirements = item.kind === "task"
    ? ["Assigned work reviewed", "Task result recorded"]
    : stage?.completionRequirements?.length ? stage.completionRequirements : ["Assigned work reviewed", "Reviewer determination recorded"];
  return requirements.map((label, index) => ({ id: `${item.id}-requirement-${index}`, key: label, label, complete: false }));
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
    // The transfer dialog resolves a persisted team/member before submit. Do not
    // invent a supervisor recipient here; the selected target is the source of
    // truth and is rendered by the dialog itself.
    return { recipients: [] };
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
