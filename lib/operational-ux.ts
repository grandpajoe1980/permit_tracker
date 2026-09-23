Warning: truncated output (original token count: 14817)
Total output lines: 1156

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
  sourceCustomerRequest?: CustomerRequestRecord;
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
    whatToDo: isCustomer ? "No SpaceX action is currently required." : incoming ? r…6817 tokens truncated…ojection(item: OperationalWorkItem): OperationalRecordProjection {
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
    projectId: item.sourceWorkstream?.projectId ?? item.sourceCustomerRequest?.projectId ?? (item.sourceRequest as (ServiceRequest & { projectId?: string }) | undefined)?.projectId,
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

/** Mirrors the database transition gate so staff see why a stage cannot move forward. */
export function getWorkflowCompletionBlockReason(item: OperationalWorkItem): string | undefined {
  if (item.kind !== "workflow") return undefined;

  const workstream = item.sourceWorkstream;
  if (!workstream) return undefined;
  const openRfi = workstream.rfis.find((rfi) => !["accepted", "closed", "withdrawn"].includes(rfi.status.toLowerCase()));
  if (openRfi) {
    return `${openRfi.code} is still open. The applicant must respond, then the requesting agency must accept the response before this stage can move forward.`;
  }

  const blockerTitles = (workstream.activeBlockers ?? [])
    .map((blocker) => blocker.title?.trim())
    .filter((title): title is string => Boolean(title));
  if ((workstream.activeBlockers?.length ?? 0) > 0) {
    const detail = blockerTitles.length > 0 ? `: ${blockerTitles.join(", ")}` : "";
    const dependencyNoun = blockerTitles.length === 1 ? "dependency" : "dependencies";
    return `Resolve the blocking ${dependencyNoun}${detail} before moving this stage forward.`;
  }

  const state = workstream.operationalState;
  if (state === "waiting_applicant") {
    return workstream.waitingReason
      ? `${workstream.waitingReason} The response must be received and accepted before this stage can move forward.`
      : "This stage is waiting on the applicant. The response must be received and accepted before it can move forward.";
  }
  if (state === "waiting_government" || state === "waiting_external" || state === "blocked") {
    const waitingOn = workstream.waitingOnEntity ? ` from ${workstream.waitingOnEntity}` : "";
    const waitingReason = workstream.waitingReason ? ` ${workstream.waitingReason}` : "";
    return `This stage is on hold${waitingOn}.${waitingReason} Resolve the hold before moving it forward.`;
  }
  return undefined;
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
    if (item.workstreamId && (item.statusTone === "red" || item.statusLabel.toLowerCase().includes("block") || item.statusLabel.toLowerCase().includes("wait"))) {
      actions.push("clear_blocker");
    }
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
      const completionBlocked = item.kind === "workflow" && Boolean(getWorkflowCompletionBlockReason(item));
      const completionActions: WorkActionId[] = completionBlocked ? [] : ["complete_step", "advance_stage"];
      actions.push(...completionActions, "update_status", "request_information", "mark_blocked");
      const workstreamState = item.sourceWorkstream?.operationalState;
      const hasOpenRfi = item.kind === "workflow" && Boolean(item.sourceWorkstream?.rfis.some((rfi) => !["accepted", "closed", "withdrawn"].includes(rfi.status.toLowerCase())));
      const canClearPersistedHold = ["blocked", "waiting_government", "waiting_external"].includes(workstreamState ?? "") && !hasOpenRfi;
      if (canClearPersistedHold && (item.statusTone === "red" || item.statusLabel.toLowerCase().includes("block") || item.statusLabel.toLowerCase().includes("wait"))) {
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
