import type {
  AuditEventRecord,
  CommitmentRecord,
  CoordinationRequestRecord,
  DecisionRecord,
  DocumentAgencyReviewRecord,
  DocumentRecord,
  DocumentVersionRecord,
  MeetingRecord,
  NotificationRecord,
  PermitTypeRecord,
  ProjectRecord,
  RFIRecord,
  RFIResponseRecord,
  WorkstreamRecord,
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
import { createAuditEvent } from "./engines/audit-engine";
import { validateStageTransition } from "./engines/workflow-engine";

/**
 * In-memory persistence store pre-seeded from SpaceX Pecan Island Megaproject fixture.
 */
class ProjectDeliveryRepository {
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
    priority?: "normal" | "urgent" | "critical_path";
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
      priority: params.priority || "normal",
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
    if (updates.status === "concurred" || updates.status === "resolved") {
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
      storagePath: params.storagePath,
      sha256Hash: params.sha256Hash,
      fileSizeBytes: 14500000,
      uploadedAt: new Date().toISOString(),
      uploadedByName: params.uploadedByName,
      uploadedByOrgName: params.uploadedByOrgName,
      changeNotes: params.changeNotes,
      status: "under_review",
      agencyReviews: params.reviewingAgencyCodes.map((agencyCode) => ({
        id: `rev-${versionId}-${agencyCode.toLowerCase()}`,
        documentVersionId: versionId,
        reviewingOrgId: `org-${agencyCode.toLowerCase()}`,
        reviewingOrgCode: agencyCode,
        status: "under_review",
      })),
    };

    doc.versions.unshift(newVersion);
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
        const review = version.agencyReviews.find((r) => r.reviewingOrgCode === agencyCode);
        if (review) {
          review.status = decision;
          review.reviewedByUserName = actorName;
          review.reviewedAt = new Date().toISOString();
          review.comments = comments;

          // If all agency reviews are approved, promote document version status
          const allApproved = version.agencyReviews.every(
            (r) => r.status === "approved" || r.status === "approved_with_conditions"
          );
          if (allApproved) {
            version.status = "approved";
          } else if (decision === "revision_requested") {
            version.status = "superseded";
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
    return full;
  }
}

// Global singleton instance
export const repository = new ProjectDeliveryRepository();
