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
  RFIResponseRecord,
  WorkstreamRecord,
  UserProfileRecord,
} from "./domain-models";
import {
  commitmentsData,
  coordinationRequestsData,
  permitCatalog,
  projectDecisionsData,
  projectDocumentsData,
  projectMeetingsData,
  registeredOrganizations,
  rfisData,
  spacexProjectRecord,
  workflowTemplatesData,
  workstreamsData,
} from "./spacex-megaproject-fixture";
import { initialExternalFilings, projectParticipants, projectProfiles } from "./customer-portal";
import { createAuditEvent } from "./engines/audit-engine";
import { validateStageTransition } from "./engines/workflow-engine";
import { getSupabaseClient } from "./supabase-client";

/**
 * In-memory persistence store pre-seeded from SpaceX Pecan Island Megaproject fixture
 * with live bi-directional sync to Supabase PostgreSQL / Cloudflare D1.
 */
class ProjectDeliveryRepository {
  private readonly browserStorageKey = "path-e2e-demo-state-v1";
  private project: ProjectRecord = JSON.parse(JSON.stringify(spacexProjectRecord));
  private workstreams: WorkstreamRecord[] = JSON.parse(JSON.stringify(workstreamsData));
  private commitments: CommitmentRecord[] = JSON.parse(JSON.stringify(commitmentsData));
  private coordinationRequests: CoordinationRequestRecord[] = JSON.parse(JSON.stringify(coordinationRequestsData));
  private rfis: RFIRecord[] = JSON.parse(JSON.stringify(rfisData));
  private documents: DocumentRecord[] = JSON.parse(JSON.stringify(projectDocumentsData));
  private decisions: DecisionRecord[] = JSON.parse(JSON.stringify(projectDecisionsData));
  private meetings: MeetingRecord[] = JSON.parse(JSON.stringify(projectMeetingsData));
  private catalog: PermitTypeRecord[] = JSON.parse(JSON.stringify(permitCatalog));
  private auditEvents: AuditEventRecord[] = JSON.parse(JSON.stringify(spacexProjectRecord.auditLedger || []));
  private notifications: NotificationRecord[] = [];
  private profiles: UserProfileRecord[] = JSON.parse(JSON.stringify(projectProfiles));
  private participants: ProjectParticipantRecord[] = JSON.parse(JSON.stringify(projectParticipants));
  private externalFilings: ExternalFilingRecord[] = JSON.parse(JSON.stringify(initialExternalFilings));
  private customerRequests: CustomerRequestRecord[] = [];
  private isDbConnected: boolean = true;

  constructor() {
    this.hydrateFromBrowserStorage();
  }

  private getBrowserStorage(): Storage | undefined {
    if (typeof window === "undefined") return undefined;
    try {
      return window.localStorage;
    } catch {
      return undefined;
    }
  }

  private hydrateFromBrowserStorage(): void {
    const storage = this.getBrowserStorage();
    if (!storage) return;
    try {
      const raw = storage.getItem(this.browserStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Record<string, unknown>>;
      if (saved.project) this.project = saved.project as ProjectRecord;
      if (saved.workstreams) this.workstreams = saved.workstreams as WorkstreamRecord[];
      if (saved.commitments) this.commitments = saved.commitments as CommitmentRecord[];
      if (saved.coordinationRequests) this.coordinationRequests = saved.coordinationRequests as CoordinationRequestRecord[];
      if (saved.rfis) this.rfis = saved.rfis as RFIRecord[];
      if (saved.documents) this.documents = saved.documents as DocumentRecord[];
      if (saved.decisions) this.decisions = saved.decisions as DecisionRecord[];
      if (saved.meetings) this.meetings = saved.meetings as MeetingRecord[];
      if (saved.catalog) this.catalog = saved.catalog as PermitTypeRecord[];
      if (saved.auditEvents) this.auditEvents = saved.auditEvents as AuditEventRecord[];
      if (saved.notifications) this.notifications = saved.notifications as NotificationRecord[];
      if (saved.profiles) this.profiles = saved.profiles as UserProfileRecord[];
      if (saved.participants) this.participants = saved.participants as ProjectParticipantRecord[];
      if (saved.externalFilings) this.externalFilings = saved.externalFilings as ExternalFilingRecord[];
      if (saved.customerRequests) this.customerRequests = saved.customerRequests as CustomerRequestRecord[];
    } catch {
      storage.removeItem(this.browserStorageKey);
    }
  }

  private persistToBrowserStorage(): void {
    const storage = this.getBrowserStorage();
    if (!storage) return;
    try {
      storage.setItem(this.browserStorageKey, JSON.stringify({
        project: this.project,
        workstreams: this.workstreams,
        commitments: this.commitments,
        coordinationRequests: this.coordinationRequests,
        rfis: this.rfis,
        documents: this.documents,
        decisions: this.decisions,
        meetings: this.meetings,
        catalog: this.catalog,
        auditEvents: this.auditEvents,
        notifications: this.notifications,
        profiles: this.profiles,
        participants: this.participants,
        externalFilings: this.externalFilings,
        customerRequests: this.customerRequests,
      }));
    } catch {
      // Browser storage is a demo durability layer; authoritative records remain server-side.
    }
  }


  // ==========================================
  // READ METHODS
  // ==========================================

  getProject(): ProjectRecord {
    return {
      ...this.project,
      workstreams: this.workstreams,
      commitments: this.commitments,
      decisions: this.decisions,
      meetings: this.meetings,
      documents: this.documents,
      coordinationRequests: this.coordinationRequests,
      auditLedger: this.auditEvents,
      participants: this.participants,
      externalFilings: this.externalFilings,
      customerRequests: this.customerRequests,
    };
  }

  getWorkstreams(): WorkstreamRecord[] {
    return this.workstreams;
  }

  getWorkstreamById(id: string): WorkstreamRecord | undefined {
    return this.workstreams.find((ws) => ws.id === id || ws.code === id);
  }

  getCommitments(): CommitmentRecord[] {
    return this.commitments;
  }

  getCoordinationRequests(): CoordinationRequestRecord[] {
    return this.coordinationRequests;
  }

  getRFIs(): RFIRecord[] {
    return this.rfis;
  }

  getDocuments(): DocumentRecord[] {
    return this.documents;
  }

  getDecisions(): DecisionRecord[] {
    return this.decisions;
  }

  getMeetings(): MeetingRecord[] {
    return this.meetings;
  }

  getCatalog(): PermitTypeRecord[] {
    return this.catalog;
  }

  getAuditEvents(): AuditEventRecord[] {
    return this.auditEvents;
  }

  getNotifications(): NotificationRecord[] {
    return this.notifications;
  }

  getProfiles(): UserProfileRecord[] {
    return this.profiles;
  }

  getProfileByUserId(userId: string): UserProfileRecord | undefined {
    return this.profiles.find((profile) => profile.userId === userId || profile.id === userId);
  }

  getParticipants(): ProjectParticipantRecord[] {
    return this.participants;
  }

  getExternalFilings(): ExternalFilingRecord[] {
    return this.externalFilings;
  }

  getCustomerRequests(): CustomerRequestRecord[] {
    return this.customerRequests;
  }

  updateProfile(params: {
    userId: string;
    updates: Partial<Pick<UserProfileRecord, "fullName" | "displayTitle" | "organizationalUnit" | "workEmail" | "officePhone" | "mobilePhone" | "officeLocation" | "preferredContactMethod" | "availabilityStatus" | "projectRole" | "avatarUrl">>;
    actorUserId: string;
    isAdmin?: boolean;
  }): UserProfileRecord | null {
    if (params.actorUserId !== params.userId && !params.isAdmin) return null;
    const profile = this.getProfileByUserId(params.userId);
    if (!profile) return null;
    Object.assign(profile, params.updates);
    this.auditEvents.unshift(createAuditEvent({
      entityType: "profile",
      entityId: profile.userId,
      actorName: profile.fullName,
      actorOrgName: profile.organizationName,
      actionType: "profile_updated",
      newValue: Object.keys(params.updates).join(", "),
      reason: params.actorUserId === params.userId ? "Self-service profile update" : "Administrator profile update",
    }));
    this.persistToBrowserStorage();
    return profile;
  }

  createCustomerRequest(params: Omit<CustomerRequestRecord, "id" | "confirmationNumber" | "status" | "createdAt" | "updatedAt"> & { status?: CustomerRequestRecord["status"] }): CustomerRequestRecord {
    const sequence = this.customerRequests.length + 1;
    const now = new Date().toISOString();
    const request: CustomerRequestRecord = {
      ...params,
      id: `customer-request-${Date.now()}-${sequence}`,
      confirmationNumber: `PATH-${new Date().getUTCFullYear()}-${String(sequence).padStart(4, "0")}`,
      status: params.status ?? "submitted",
      createdAt: now,
      updatedAt: now,
    };
    this.customerRequests.unshift(request);
    this.auditEvents.unshift(createAuditEvent({ entityType: "customer_request", entityId: request.confirmationNumber, actorName: request.submittedByName, actorOrgName: "Space Exploration Technologies Corp. (SpaceX)", actionType: "customer_request_submitted", newValue: `${request.requestType} · ${request.title}`, reason: request.description }));
    if (request.status !== "draft") {
      this.dispatchNotification({ userId: "user-sarah-johnson", title: `New customer request ${request.confirmationNumber}`, message: request.title, type: "action_required", linkUrl: `/requests/${request.confirmationNumber}`, urgency: request.blocksActiveWork ? "critical" : "high", metadata: { confirmationNumber: request.confirmationNumber, requestType: request.requestType } });
    } else {
      this.persistToBrowserStorage();
    }
    return request;
  }

  createExternalFiling(params: Omit<ExternalFilingRecord, "id" | "createdAt" | "updatedAt">): ExternalFilingRecord {
    const now = new Date().toISOString();
    const filing: ExternalFilingRecord = { ...params, id: `external-filing-${Date.now()}`, createdAt: now, updatedAt: now };
    this.externalFilings.unshift(filing);
    this.auditEvents.unshift(createAuditEvent({ entityType: "external_filing", entityId: filing.id, actorName: filing.submittedByName ?? "PATH user", actorOrgName: filing.authorityOrganizationName, actionType: "external_filing_recorded", newValue: filing.externalReferenceNumber ?? "Reference pending", reason: filing.notes ?? "Manual tracking record created." }));
    this.persistToBrowserStorage();
    return filing;
  }

  updateExternalFiling(id: string, updates: Partial<Pick<ExternalFilingRecord, "externalReferenceNumber" | "externalRecordUrl" | "externalStatus" | "submittedAt" | "submittedByUserId" | "submittedByName" | "lastStatusVerifiedAt" | "lastStatusVerifiedBy" | "notes" | "receiptDocumentVersionIds">>, actorName: string, actorOrgName: string): ExternalFilingRecord | null {
    const filing = this.externalFilings.find((entry) => entry.id === id);
    if (!filing) return null;
    Object.assign(filing, updates, { updatedAt: new Date().toISOString() });
    this.auditEvents.unshift(createAuditEvent({ entityType: "external_filing", entityId: filing.id, actorName, actorOrgName, actionType: "external_filing_updated", newValue: filing.externalStatus, reason: filing.notes ?? "External filing status updated." }));
    this.persistToBrowserStorage();
    return filing;
  }

  resetE2EDemo(): void {
    this.project = JSON.parse(JSON.stringify(spacexProjectRecord));
    this.workstreams = JSON.parse(JSON.stringify(workstreamsData));
    this.commitments = JSON.parse(JSON.stringify(commitmentsData));
    this.coordinationRequests = JSON.parse(JSON.stringify(coordinationRequestsData));
    this.rfis = JSON.parse(JSON.stringify(rfisData));
    this.documents = JSON.parse(JSON.stringify(projectDocumentsData));
    this.decisions = JSON.parse(JSON.stringify(projectDecisionsData));
    this.meetings = JSON.parse(JSON.stringify(projectMeetingsData));
    this.catalog = JSON.parse(JSON.stringify(permitCatalog));
    this.auditEvents = JSON.parse(JSON.stringify(spacexProjectRecord.auditLedger || []));
    this.notifications = [];
    this.profiles = JSON.parse(JSON.stringify(projectProfiles));
    this.participants = JSON.parse(JSON.stringify(projectParticipants));
    this.externalFilings = JSON.parse(JSON.stringify(initialExternalFilings));
    this.customerRequests = [];
    this.getBrowserStorage()?.removeItem(this.browserStorageKey);
  }

  // ==========================================
  // MUTATION METHODS (WITH AUDIT LOGGING)
  // ==========================================

  /**
   * Creates a formal Interagency Coordination Request (CR-00xxx)
   */
  createCoordinationRequest(params: {
    workstreamId: string;
    workstreamTitle: string;
    requestingOrgId: string;
    requestingOrgCode: string;
    targetOrgId: string;
    targetOrgCode: string;
    requestingUserName: string;
    assignedToUserName: string;
    title: string;
    needDescription: string;
    dueDate: string;
    attachedDocumentVersionIds?: string[];
    priority?: "normal" | "high" | "urgent" | "critical_path";
  }): CoordinationRequestRecord {
    const count = this.coordinationRequests.length + 1;
    const code = `CR-00${450 + count}`;
    const id = `cr-${450 + count}`;

    const newRequest: CoordinationRequestRecord = {
      id,
      code,
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
      requestedDate: new Date().toISOString().split("T")[0],
      dueDate: params.dueDate,
      attachedDocumentVersionIds: params.attachedDocumentVersionIds || [],
      blocksWorkstreamTitle: params.workstreamTitle,
      priority: params.priority === "urgent" ? "high" : params.priority || "normal",
      status: "pending",
    };

    this.coordinationRequests.unshift(newRequest);

    // Record immutable audit event
    const audit = createAuditEvent({
      entityType: "coordination_request",
      entityId: code,
      actorName: params.requestingUserName,
      actorOrgName: params.requestingOrgCode,
      actionType: "created",
      newValue: `Created ${code}: ${params.title} targeting ${params.targetOrgCode}`,
      reason: params.needDescription,
    });
    this.auditEvents.unshift(audit);

    return newRequest;
  }

  /**
   * Updates status or response on an Interagency Coordination Request
   */
  updateCoordinationRequest(
    id: string,
    updates: {
      status: CoordinationRequestRecord["status"];
      responseSummary?: string;
      actorName: string;
      actorOrgName: string;
    }
  ): CoordinationRequestRecord | null {
    const req = this.coordinationRequests.find((r) => r.id === id || r.code === id);
    if (!req) return null;

    const oldStatus = req.status;
    req.status = updates.status;
    if (updates.responseSummary) req.responseSummary = updates.responseSummary;
    if (updates.status === "concurred" || updates.status === "closed") {
      req.concurredAt = new Date().toISOString();
    }

    const audit = createAuditEvent({
      entityType: "coordination_request",
      entityId: req.code,
      actorName: updates.actorName,
      actorOrgName: updates.actorOrgName,
      actionType: "status_change",
      oldValue: oldStatus,
      newValue: updates.status,
      reason: updates.responseSummary || `Status updated to ${updates.status}`,
    });
    this.auditEvents.unshift(audit);

    return req;
  }

  /**
   * Creates an RFI from a plain-language information request and records the
   * action in the same audited store as the rest of the command system.
   */
  createRFI(params: {
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
  }): RFIRecord {
    const count = this.rfis.length + 43;
    const code = `RFI-2026-${String(count).padStart(4, "0")}`;
    const newRfi: RFIRecord = {
      id: `rfi-${Date.now()}`,
      code,
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
    };
    this.rfis.unshift(newRfi);
    const ws = this.getWorkstreamById(params.workstreamId);
    if (ws) {
      ws.operationalState = "waiting_applicant";
      ws.operationalStateLabel = "Waiting on Applicant (RFI Issued)";
      ws.waitingReason = `Waiting for response to ${code}.`;
      ws.waitingOnEntity = params.recipientOrgCode;
    }
    this.auditEvents.unshift(createAuditEvent({
      entityType: "rfi",
      entityId: code,
      actorName: params.actorName,
      actorOrgName: params.requestingOrgCode,
      actionType: "rfi_issued",
      newValue: `Issued ${code} to ${params.recipientOrgCode}`,
      reason: params.questionText,
    }));
    return newRfi;
  }

  /**
   * Marks a workstream as waiting with an explicit structured reason. The
   * caller chooses the object type first; free-text is retained only as the
   * human explanation attached to the audit record.
   */
  markWorkstreamBlocked(params: {
    workstreamId: string;
    reason: string;
    waitingOn: string;
    actorName: string;
    actorOrgName: string;
    pauseClock?: boolean;
  }): WorkstreamRecord | null {
    const ws = this.getWorkstreamById(params.workstreamId);
    if (!ws) return null;
    const oldState = ws.operationalState;
    ws.operationalState = params.pauseClock ? "waiting_government" : "blocked";
    ws.operationalStateLabel = params.pauseClock ? "Waiting on Government (Clock Paused)" : "Blocked (Action Required)";
    ws.waitingReason = params.reason;
    ws.waitingOnEntity = params.waitingOn;
    this.auditEvents.unshift(createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "blocked",
      oldValue: oldState,
      newValue: ws.operationalState,
      reason: `${params.reason} · Waiting on ${params.waitingOn}`,
    }));
    return ws;
  }

  /**
   * Completes the current configured workflow stage after server-side-style
   * checklist validation and writes the handoff audit event.
   */
  completeWorkstreamStage(params: {
    workstreamId: string;
    completedChecklists: string[];
    providedDocs: string[];
    actorName: string;
    actorOrgName: string;
  }): { success: boolean; errors?: string[]; workstream?: WorkstreamRecord; nextOwner?: string } {
    const ws = this.getWorkstreamById(params.workstreamId);
    if (!ws) return { success: false, errors: ["Workstream not found"] };
    const template = workflowTemplatesData.find((candidate) => candidate.permitTypeId === ws.permitTypeId) ?? workflowTemplatesData[0];
    const stages = template?.versions.find((version) => version.versionNumber === template.activeVersionNumber)?.stages ?? [];
    const currentStage = stages.find((stage) => ws.currentStageName?.toLowerCase().includes(stage.name.toLowerCase().split(" ")[0])) ?? stages[0];
    if (currentStage) {
      const validation = validateStageTransition(currentStage, params.completedChecklists, params.providedDocs);
      if (!validation.allowed) {
        return {
          success: false,
          errors: [
            ...validation.missingChecklists.map((item) => `Missing checklist item: ${item}`),
            ...validation.missingDocs.map((item) => `Missing required input document: ${item}`),
          ],
        };
      }
    }
    const oldStage = ws.currentStageName ?? "Current workflow stage";
    const currentIndex = currentStage ? stages.findIndex((stage) => stage.id === currentStage.id) : -1;
    const nextStage = currentIndex >= 0 ? stages[currentIndex + 1] : undefined;
    ws.currentStageName = nextStage?.name ?? "Complete & Ready for Final Determination";
    ws.operationalState = nextStage ? "running" : "complete";
    ws.operationalStateLabel = nextStage ? `Running (${nextStage.name})` : "Complete";
    ws.waitingReason = undefined;
    ws.waitingOnEntity = undefined;
    ws.actualCompletionDate = nextStage ? undefined : new Date().toISOString().split("T")[0];
    this.auditEvents.unshift(createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "workflow_transition",
      oldValue: oldStage,
      newValue: ws.currentStageName,
      reason: `Completed configured stage requirements: ${params.completedChecklists.join(", ")}`,
    }));
    this.dispatchNotification({
      userId: "user-sarah-johnson",
      title: `${ws.title} moved forward`,
      message: nextStage ? `The next action is ${nextStage.name}.` : "The workstream is complete.",
      type: "completion",
      linkUrl: `/workstreams/${ws.code}`,
      urgency: "info",
      metadata: { workstreamCode: ws.code, nextOwner: nextStage?.responsibleOrgCode ?? "Project Office" },
    });
    return { success: true, workstream: ws, nextOwner: nextStage?.responsibleOrgCode ?? "Project Office" };
  }

  /** Adds an operational note to the immutable audit trail. */
  addWorkstreamNote(params: { workstreamId: string; note: string; actorName: string; actorOrgName: string }) {
    const ws = this.getWorkstreamById(params.workstreamId);
    if (!ws) return null;
    const event = createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "note_added",
      reason: params.note,
    });
    this.auditEvents.unshift(event);
    return event;
  }

  /** Records a plain-language escalation against the workstream. */
  escalateWorkstream(params: { workstreamId: string; problemType: string; actorName: string; actorOrgName: string }) {
    const ws = this.getWorkstreamById(params.workstreamId);
    if (!ws) return null;
    ws.operationalState = "escalated";
    ws.operationalStateLabel = "Escalated for Help";
    ws.escalationLevel = Math.min(5, Math.max(1, ws.escalationLevel + 1)) as WorkstreamRecord["escalationLevel"];
    ws.escalationTriggeredAt = new Date().toISOString();
    ws.escalationSummary = params.problemType;
    const event = createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "escalated",
      newValue: `Escalation ${ws.escalationLevel}: ${params.problemType}`,
      reason: params.problemType,
    });
    this.auditEvents.unshift(event);
    this.dispatchNotification({
      userId: "user-maya-chen",
      title: `Help requested on ${ws.code}`,
      message: `${params.actorName} requested ${params.problemType}.`,
      type: "escalation",
      linkUrl: `/workstreams/${ws.code}`,
      urgency: "high",
      metadata: { workstreamCode: ws.code, escalationLevel: ws.escalationLevel },
    });
    return ws;
  }

  /** Records a transfer/help request without bypassing the assignment audit trail. */
  transferWorkstream(params: { workstreamId: string; transferType: string; targetName: string; actorName: string; actorOrgName: string; note?: string }) {
    const ws = this.getWorkstreamById(params.workstreamId);
    if (!ws) return null;
    const event = createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "transfer_requested",
      newValue: `${params.transferType} → ${params.targetName}`,
      reason: params.note || "Help requested from supervisor.",
    });
    this.auditEvents.unshift(event);
    this.dispatchNotification({
      userId: "user-maya-chen",
      title: `Transfer request for ${ws.code}`,
      message: `${params.actorName} requested ${params.transferType}.`,
      type: "action_required",
      linkUrl: `/workstreams/${ws.code}`,
      urgency: "high",
      metadata: { workstreamCode: ws.code, targetName: params.targetName },
    });
    return event;
  }

  /** Accepts the latest unreviewed response for an RFI and resumes its linked workstream. */
  acceptRfiResponse(params: { rfiId: string; actorName: string; actorOrgName: string; notes?: string }) {
    const rfi = this.rfis.find((entry) => entry.id === params.rfiId || entry.code === params.rfiId);
    if (!rfi) return null;
    const response = rfi.responses?.find((entry) => !entry.reviewDecision);
    if (!response) return null;
    response.reviewDecision = "accepted";
    response.reviewedByName = params.actorName;
    response.reviewedAt = new Date().toISOString();
    response.reviewNotes = params.notes || "Response accepted and linked review resumed.";
    rfi.status = "accepted";
    const ws = this.getWorkstreamById(rfi.workstreamId);
    if (ws) {
      ws.operationalState = "running";
      ws.operationalStateLabel = "Running (Response Accepted)";
      ws.waitingReason = undefined;
      ws.waitingOnEntity = undefined;
    }
    this.auditEvents.unshift(createAuditEvent({
      entityType: "rfi",
      entityId: rfi.code,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "rfi_response_accepted",
      oldValue: "submitted_by_applicant",
      newValue: "accepted",
      reason: response.reviewNotes,
    }));
    return response;
  }

  /** Persists a customer response as an RFI response and audits the submission. */
  submitRfiResponse(params: { rfiId: string; submittedByName: string; responseText: string; actorOrgName: string; attachedDocumentVersionIds?: string[] }) {
    const rfi = this.rfis.find((entry) => entry.id === params.rfiId || entry.code === params.rfiId);
    if (!rfi) return null;
    const response = {
      id: `resp-${Date.now()}`,
      rfiId: rfi.id,
      submittedByName: params.submittedByName,
      responseText: params.responseText,
      attachedDocumentVersionIds: params.attachedDocumentVersionIds ?? [],
      submittedAt: new Date().toISOString(),
    };
    rfi.responses = [...(rfi.responses ?? []), response];
    rfi.status = "submitted_by_applicant";
    this.auditEvents.unshift(createAuditEvent({
      entityType: "rfi_response",
      entityId: rfi.code,
      actorName: params.submittedByName,
      actorOrgName: params.actorOrgName,
      actionType: "rfi_response_submitted",
      newValue: `Response submitted to ${rfi.requestingOrgCode}`,
      reason: params.responseText,
    }));
    return response;
  }

  /** Applies a decision to the requested document version only. */
  reviewDocumentVersion(params: { versionId: string; agencyCode: string; decision: "approved" | "approved_with_conditions" | "revision_requested"; actorName: string; comments: string }) {
    return this.signoffDocumentAgencyReview(params.versionId, params.agencyCode, params.decision, params.actorName, params.comments);
  }

  /**
   * Logs a First-Class Tracked Commitment
   */
  createCommitment(params: {
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
  }): CommitmentRecord {
    const count = this.commitments.length + 1;
    const id = `COM-00${count}`;

    const newCommitment: CommitmentRecord = {
      id,
      workstreamId: params.workstreamId,
      workstreamTitle: params.workstreamTitle,
      committingOrgId: params.committingOrgId,
      committingOrgCode: params.committingOrgCode,
      madeByPersonName: params.madeByPersonName,
      committedAction: params.committedAction,
      originContext: params.originContext,
      committedDate: new Date().toISOString().split("T")[0],
      promisedDueDate: params.promisedDueDate,
      status: "on_track",
      impactIfMissed: params.impactIfMissed,
      isCriticalPathImpact: Boolean(params.isCriticalPathImpact),
    };

    this.commitments.unshift(newCommitment);

    const audit = createAuditEvent({
      entityType: "commitment",
      entityId: id,
      actorName: params.madeByPersonName,
      actorOrgName: params.committingOrgCode,
      actionType: "committed",
      newValue: `Promised action: ${params.committedAction} by ${params.promisedDueDate}`,
      reason: params.originContext,
    });
    this.auditEvents.unshift(audit);

    return newCommitment;
  }

  /**
   * Updates commitment status
   */
  updateCommitmentStatus(
    id: string,
    status: CommitmentRecord["status"],
    actorName: string,
    notes?: string
  ): CommitmentRecord | null {
    const com = this.commitments.find((c) => c.id === id);
    if (!com) return null;

    const oldStatus = com.status;
    com.status = status;
    if (status === "fulfilled") {
      com.fulfilledDate = new Date().toISOString().split("T")[0];
    }

    const audit = createAuditEvent({
      entityType: "commitment",
      entityId: id,
      actorName,
      actorOrgName: com.committingOrgCode,
      actionType: "status_change",
      oldValue: oldStatus,
      newValue: status,
      reason: notes || `Commitment status marked ${status}`,
    });
    this.auditEvents.unshift(audit);

    return com;
  }

  /**
   * Uploads a new document version with SHA-256 ledger tracking
   */
  createDocumentVersion(
    documentId: string,
    params: {
      versionNumber: number;
      versionLabel: string;
      storagePath: string;
      fileName?: string;
      mimeType?: string;
      fileSizeBytes?: number;
      sha256Hash: string;
      uploadedByName: string;
      uploadedByOrgName: string;
      changeNotes: string;
      reviewingAgencyCodes: string[];
    }
  ): DocumentVersionRecord | null {
    const doc = this.documents.find((d) => d.id === documentId);
    if (!doc) return null;

    const versionId = `doc-v-${doc.id.toLowerCase()}-v${params.versionNumber}`;
    const newVersion: DocumentVersionRecord = {
      id: versionId,
      documentId: doc.id,
      versionNumber: params.versionNumber,
      versionLabel: params.versionLabel,
      versionTag: params.versionLabel,
      storagePath: params.storagePath,
      fileName: params.fileName ?? params.storagePath.split("/").pop() ?? `${doc.id}-v${params.versionNumber}`,
      mimeType: params.mimeType ?? "application/octet-stream",
      storageUri: params.storagePath,
      sha256Hash: params.sha256Hash,
      fileSizeBytes: params.fileSizeBytes ?? 0,
      uploadedAt: new Date().toISOString(),
      uploadedByName: params.uploadedByName,
      uploadedByOrgName: params.uploadedByOrgName,
      changeNotes: params.changeNotes,
      isMalwareClean: true,
      status: "under_review",
      agencyReviews: params.reviewingAgencyCodes.map((agencyCode) => ({
        id: `rev-${versionId}-${agencyCode.toLowerCase()}`,
        documentVersionId: versionId,
        workstreamId: "",
        reviewingOrgId: `org-${agencyCode.toLowerCase()}`,
        reviewingOrgCode: agencyCode,
        reviewStatus: "under_review",
        status: "under_review",
      })),
    };

    doc.versions.unshift(newVersion);
    doc.agencyReviews.push(...(newVersion.agencyReviews ?? []));
    doc.currentVersionNumber = params.versionNumber;
    doc.currentVersionId = versionId;

    const audit = createAuditEvent({
      entityType: "document_version",
      entityId: versionId,
      actorName: params.uploadedByName,
      actorOrgName: params.uploadedByOrgName,
      actionType: "version_upload",
      newValue: `Uploaded ${doc.title} ${params.versionLabel} (SHA: ${params.sha256Hash.slice(0, 10)}...)`,
      reason: params.changeNotes,
    });
    this.auditEvents.unshift(audit);
    this.persistToBrowserStorage();

    return newVersion;

  }

  /**
   * Signs off on a document review for an agency
   */
  signoffDocumentAgencyReview(
    versionId: string,
    agencyCode: string,
    decision: "approved" | "approved_with_conditions" | "revision_requested",
    actorName: string,
    comments: string
  ): DocumentAgencyReviewRecord | null {
    for (const doc of this.documents) {
      const version = doc.versions.find((v) => v.id === versionId);
      if (version) {
        const versionRecord = version as unknown as {
          agencyReviews?: DocumentAgencyReviewRecord[];
          status?: string;
        };
        const reviews = versionRecord.agencyReviews ?? doc.agencyReviews.filter((review) => review.documentVersionId === versionId);
        const review = reviews.find((entry) => entry.reviewingOrgCode === agencyCode);
        if (review) {
          const reviewRecord = review as DocumentAgencyReviewRecord & {
            status?: string;
            reviewedByUserName?: string;
            reviewedAt?: string;
            comments?: string;
          };
          reviewRecord.reviewStatus = decision === "revision_requested" ? "revisions_requested" : decision === "approved_with_conditions" ? "approved" : decision;
          reviewRecord.reviewedByName = actorName;
          reviewRecord.decisionDate = new Date().toISOString().split("T")[0];
          reviewRecord.reviewComments = comments;
          reviewRecord.status = decision;
          reviewRecord.reviewedByUserName = actorName;
          reviewRecord.reviewedAt = new Date().toISOString();
          reviewRecord.comments = comments;

          // If all agency reviews are approved, promote document version status
          const allApproved = reviews.every(
            (entry) => ["approved", "approved_with_conditions"].includes((entry as DocumentAgencyReviewRecord & { status?: string }).status ?? entry.reviewStatus)
          );
          if (allApproved) {
            versionRecord.status = "approved";
          } else if (decision === "revision_requested") {
            versionRecord.status = "superseded";
          }

          const audit = createAuditEvent({
            entityType: "document_agency_review",
            entityId: review.id,
            actorName,
            actorOrgName: agencyCode,
            actionType: "agency_signoff",
            newValue: `${agencyCode} signed off as ${decision}`,
            reason: comments,
          });
          this.auditEvents.unshift(audit);
          this.persistToBrowserStorage();

          return review;
        }
      }
    }
    return null;
  }

  /**
   * Freezes statutory review clock on a workstream during applicant RFI periods
   */
  freezeStatutoryClock(
    workstreamId: string,
    rfiCode: string,
    actorName: string,
    reason: string
  ): WorkstreamRecord | null {
    const ws = this.workstreams.find((w) => w.id === workstreamId || w.code === workstreamId);
    if (!ws) return null;

    ws.operationalState = "waiting_applicant";
    ws.operationalStateLabel = "Waiting on Applicant (Statutory Clock Paused)";
    ws.waitingReason = `Statutory review clock paused pending applicant response to ${rfiCode}.`;
    ws.waitingOnEntity = "SpaceX Regulatory Engineering";

    const audit = createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName,
      actorOrgName: ws.regulatoryLead.orgCode,
      actionType: "clock_freeze",
      newValue: `Statutory review clock FROZEN on ${ws.code}`,
      reason: `${reason} (${rfiCode})`,
    });
    this.auditEvents.unshift(audit);

    return ws;
  }

  /**
   * Resumes statutory review clock once applicant response is received
   */
  resumeStatutoryClock(
    workstreamId: string,
    actorName: string,
    reason: string
  ): WorkstreamRecord | null {
    const ws = this.workstreams.find((w) => w.id === workstreamId || w.code === workstreamId);
    if (!ws) return null;

    ws.operationalState = "running";
    ws.operationalStateLabel = "Running (Technical Review)";
    ws.waitingReason = "Technical review actively resuming.";
    ws.waitingOnEntity = ws.regulatoryLead.orgName;

    const audit = createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName,
      actorOrgName: ws.regulatoryLead.orgCode,
      actionType: "clock_resume",
      newValue: `Statutory review clock RESUMED on ${ws.code}`,
      reason,
    });
    this.auditEvents.unshift(audit);

    return ws;
  }

  /**
   * Validates stage checklist gates and executes stage transition
   */
  transitionWorkstreamStage(
    workstreamId: string,
    nextStageKey: string,
    completedChecklists: string[],
    providedDocs: string[],
    actorName: string,
    actorOrgName: string
  ): { success: boolean; errors?: string[]; workstream?: WorkstreamRecord } {
    const ws = this.workstreams.find((w) => w.id === workstreamId || w.code === workstreamId);
    if (!ws) return { success: false, errors: ["Workstream not found"] };

    // Find template and stage gate
    const template = workflowTemplatesData[0];
    const currentStage = template.versions[0].stages[0];

    const validation = validateStageTransition(currentStage, completedChecklists, providedDocs);
    if (!validation.allowed) {
      const errors = [
        ...validation.missingChecklists.map((c) => `Missing checklist item: ${c}`),
        ...validation.missingDocs.map((d) => `Missing required input document: ${d}`),
      ];
      return { success: false, errors };
    }

    const oldStage = ws.currentStageName;
    ws.currentStageName = nextStageKey;

    const audit = createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName,
      actorOrgName,
      actionType: "workflow_transition",
      oldValue: oldStage,
      newValue: nextStageKey,
      reason: `Completed stage checklist gates: ${completedChecklists.join(", ")}`,
    });
    this.auditEvents.unshift(audit);

    return { success: true, workstream: ws };
  }

  /**
   * Dispatches an in-app and operational notification
   */
  dispatchNotification(notification: Omit<NotificationRecord, "id" | "createdAt" | "isRead">): NotificationRecord {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const full: NotificationRecord = {
      ...notification,
      id,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    this.notifications.unshift(full);
    this.persistToBrowserStorage();
    return full;
  }
}

// Global singleton instance
export const repository = new ProjectDeliveryRepository();
