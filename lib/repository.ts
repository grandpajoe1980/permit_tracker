import type {
  AssignmentGroupRecord,
  AssignmentGroupMembershipRecord,
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
  RFIRecord,
  RFIResponseRecord,
  WorkflowTemplateRecord,
  WorkstreamRecord,
  UserProfileRecord,
  OrganizationMembershipRecord,
  ITSMState,
  PriorityLevel,
  ClockStatus,
  StatutoryClockState,
  TaskRecord,
} from "./domain-models";
import {
  isITSMState,
  isPriorityLevel,
  isClockStatus,
  parseITSMState,
  parsePriorityLevel,
  calculatePriority,
  calculateStatutoryClock,
  mapOperationalStateToITSMState,
  mapITSMStateToOperationalState,
  mapCustomerRequestStatusToITSMState,
} from "./domain-models";
import {
  assignmentGroupsData,
  assignmentGroupMembershipsData,
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
import {
  fetchAssignmentGroups,
  fetchAssignmentGroupMemberships,
  fetchAuditEvents,
  fetchCatalog,
  fetchCommitments,
  fetchCoordinationRequests,
  fetchCustomerRequests,
  fetchDecisions,
  fetchDocuments,
  fetchExternalFilings,
  fetchMeetings,
  fetchNotifications,
  fetchOrganizations,
  fetchProjectParticipants,
  fetchOrganizationMemberships,
  fetchRFIs,
  fetchUserProfiles,
  fetchWorkflowTemplates,
  fetchWorkstreams,
} from "./supabase/queries";
import {
  insertAuditEvent,
  mutateAcceptRFIResponse,
  mutateAddWorkstreamNote,
  mutateAssignTicket,
  mutateClearWorkstreamBlocker,
  mutateCompleteWorkstreamStage,
  mutateCreateCommitment,
  mutateCreateCoordinationRequest,
  mutateCreateCustomerRequest,
  mutateCreateCustomerRequestWithDocument,
  mutateCreateExternalFiling,
  mutateCreateRFI,
  mutateCreateWorkstreamFromRequest,
  mutateEscalateWorkstream,
  mutateManageAssignmentGroup,
  mutateManageAssignmentGroupMembership,
  mutateMarkWorkstreamBlocked,
  mutateSetOrganizationMemberRole,
  mutateSetTicketPriority,
  mutateSubmitRFIResponse,
  mutateTriageCustomerRequest,
  mutateTransferWorkstream,
  mutateUpdateExternalFiling,
  mutateUpdateProjectParticipant,
  mutateUpdateTicketITSMState,
  mutateUpdateUserProfile,
  mutateUpdateTask,
  mutateCompleteTask,
} from "./supabase/mutations";
import { mutateReviewDocumentVersion, mutateUploadDocumentVersion } from "./supabase/storage";
import { isSupabaseConfigured } from "./supabase/client";
import { allowsFixtureData } from "./data-mode";

type MutableTicket = {
  id: string;
  title?: string;
  code?: string;
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  assignedOrgCode?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  itsmState?: ITSMState;
  priority?: PriorityLevel;
  clockStatus?: ClockStatus;
  clockPausedAt?: string;
  clockPausedReason?: string;
  clockTotalPausedSeconds?: number;
  operationalState?: WorkstreamRecord["operationalState"];
  ragHealth?: WorkstreamRecord["ragHealth"];
  actualCompletionDate?: string;
  status?: CustomerRequestRecord["status"] | TaskRecord["status"];
};

/**
 * PATH Authoritative Service & Repository Layer
 * Backed by canonical Supabase PostgreSQL and Supabase Storage.
 * Retains deterministic in-memory fixtures for unit tests and offline demo mode.
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
  private organizations: OrganizationRecord[] = JSON.parse(JSON.stringify(registeredOrganizations));
  private profiles: UserProfileRecord[] = JSON.parse(JSON.stringify(projectProfiles));
  private memberships: OrganizationMembershipRecord[] = [];
  private participants: ProjectParticipantRecord[] = JSON.parse(JSON.stringify(projectParticipants));
  private externalFilings: ExternalFilingRecord[] = JSON.parse(JSON.stringify(initialExternalFilings));
  private customerRequests: CustomerRequestRecord[] = [];
  private workflowTemplates: WorkflowTemplateRecord[] = JSON.parse(JSON.stringify(workflowTemplatesData));
  private assignmentGroups: AssignmentGroupRecord[] = JSON.parse(JSON.stringify(assignmentGroupsData));
  private assignmentGroupMemberships: AssignmentGroupMembershipRecord[] = JSON.parse(JSON.stringify(assignmentGroupMembershipsData));
  private isHydratedFromDb = false;

  constructor() {
    // Initial construction uses deterministic baseline
  }

  /**
   * Hydrates all authorized project state directly from Supabase PostgreSQL.
   */
  async hydrateFromSupabase(projectId = "PRJ-PECAN-2026"): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
      const [
        ws,
        custReqs,
        extFilings,
        rfisList,
        coordReqs,
        comms,
        decs,
        mtgs,
        docs,
        profs,
        memberships,
        parts,
        notifs,
        audits,
        cat,
        orgs,
        workflowTemplates,
        groups,
        groupMemberships,
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
        fetchOrganizationMemberships(),
        fetchProjectParticipants(projectId),
        fetchNotifications(),
        fetchAuditEvents(projectId),
        fetchCatalog(),
        fetchOrganizations(),
        fetchWorkflowTemplates(),
        fetchAssignmentGroups(),
        fetchAssignmentGroupMemberships(),
      ]);

      const keepFixtures = allowsFixtureData();
      const groupById = new Map(groups.map((group) => [group.id, group]));
      const enrichedWorkstreams = ws.map((workstream) => ({
        ...workstream,
        assignmentGroupName: workstream.assignmentGroupName ?? (workstream.assignmentGroupId ? groupById.get(workstream.assignmentGroupId)?.name : undefined),
        tasks: workstream.tasks.map((task) => ({
          ...task,
          assignmentGroupName: task.assignmentGroupName ?? (task.assignmentGroupId ? groupById.get(task.assignmentGroupId)?.name : undefined),
        })),
      }));
      const enrichedCustomerRequests = custReqs.map((request) => ({
        ...request,
        assignmentGroupName: request.assignmentGroupName ?? (request.assignmentGroupId ? groupById.get(request.assignmentGroupId)?.name : undefined),
      }));
      if (!keepFixtures || ws.length > 0) this.workstreams = enrichedWorkstreams;
      if (!keepFixtures || custReqs.length > 0) this.customerRequests = enrichedCustomerRequests;
      if (!keepFixtures || extFilings.length > 0) this.externalFilings = extFilings;
      if (!keepFixtures || rfisList.length > 0) this.rfis = rfisList;
      if (!keepFixtures || coordReqs.length > 0) this.coordinationRequests = coordReqs;
      if (!keepFixtures || comms.length > 0) this.commitments = comms;
      if (!keepFixtures || decs.length > 0) this.decisions = decs;
      if (!keepFixtures || mtgs.length > 0) this.meetings = mtgs;
      if (!keepFixtures || docs.length > 0) this.documents = docs;
      if (!keepFixtures || profs.length > 0) this.profiles = profs;
      if (!keepFixtures || memberships.length > 0) this.memberships = memberships;
      if (!keepFixtures || parts.length > 0) this.participants = parts;
      if (!keepFixtures || notifs.length > 0) this.notifications = notifs;
      if (!keepFixtures || audits.length > 0) this.auditEvents = audits;
      if (!keepFixtures || cat.length > 0) this.catalog = cat;
      if (!keepFixtures || orgs.length > 0) this.organizations = orgs;
      if (!keepFixtures || workflowTemplates.length > 0) this.workflowTemplates = workflowTemplates;
      if (!keepFixtures || groups.length > 0) this.assignmentGroups = groups;
      if (!keepFixtures || groupMemberships.length > 0) this.assignmentGroupMemberships = groupMemberships;

      this.isHydratedFromDb = true;
      return true;
    } catch (err) {
      console.warn("Failed to hydrate from Supabase:", err);
      return false;
    }
  }

  isDbConnected(): boolean {
    return isSupabaseConfigured() && this.isHydratedFromDb;
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

  getDocumentsByWorkstreamId(workstreamId: string): DocumentRecord[] {
    return this.documents.filter((doc) => {
      if (doc.workstreamId === workstreamId) return true;
      if (doc.agencyReviews?.some((rev) => rev.workstreamId === workstreamId)) return true;
      return false;
    });
  }

  searchDocuments(query: string, options?: { workstreamId?: string; category?: string; status?: string }): DocumentRecord[] {
    const q = query.toLowerCase().trim();
    return this.documents.filter((doc) => {
      if (options?.workstreamId && doc.workstreamId !== options.workstreamId && !doc.agencyReviews?.some((r) => r.workstreamId === options.workstreamId)) {
        return false;
      }
      if (options?.category && doc.category !== options.category) {
        return false;
      }
      if (!q) return true;
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchCategory = doc.category.toLowerCase().includes(q);
      const matchOwner = doc.ownerOrgCode.toLowerCase().includes(q);
      const matchWs = (doc.workstreamTitle || "").toLowerCase().includes(q);
      const matchVersion = doc.versions.some(
        (v) =>
          v.fileName.toLowerCase().includes(q) ||
          v.versionTag.toLowerCase().includes(q) ||
          v.sha256Hash.toLowerCase().includes(q) ||
          (v.uploadedByName || "").toLowerCase().includes(q) ||
          (v.changeSummary || "").toLowerCase().includes(q)
      );
      return matchTitle || matchCategory || matchOwner || matchWs || matchVersion;
    });
  }

  createDocument(params: {
    projectId: string;
    workstreamId?: string;
    workstreamTitle?: string;
    title: string;
    category: string;
    ownerOrgCode: string;
    isConfidential?: boolean;
    initialVersion?: {
      versionTag: string;
      fileName: string;
      fileSizeBytes: number;
      mimeType: string;
      storageUri: string;
      sha256Hash: string;
      uploadedByName: string;
      changeSummary?: string;
    };
    reviewingAgencyCodes?: string[];
  }): DocumentRecord {
    const id = `doc-${Date.now()}`;
    const newDoc: DocumentRecord = {
      id,
      projectId: params.projectId,
      workstreamId: params.workstreamId,
      workstreamTitle: params.workstreamTitle,
      title: params.title,
      category: params.category,
      ownerOrgCode: params.ownerOrgCode,
      currentVersionNumber: 1,
      isConfidential: Boolean(params.isConfidential),
      versions: [],
      agencyReviews: [],
    };

    if (params.initialVersion) {
      const vId = `doc-v-${id}-v1`;
      const version: DocumentVersionRecord = {
        id: vId,
        documentId: id,
        versionNumber: 1,
        versionLabel: params.initialVersion.versionTag || "v1.0",
        versionTag: params.initialVersion.versionTag || "v1.0",
        fileName: params.initialVersion.fileName,
        fileSizeBytes: params.initialVersion.fileSizeBytes,
        mimeType: params.initialVersion.mimeType,
        storageUri: params.initialVersion.storageUri,
        storagePath: params.initialVersion.storageUri,
        sha256Hash: params.initialVersion.sha256Hash,
        uploadedByName: params.initialVersion.uploadedByName,
        uploadedAt: new Date().toISOString(),
        changeSummary: params.initialVersion.changeSummary || "Initial document package upload",
        isMalwareClean: true,
        status: "under_review",
      };
      newDoc.versions.push(version);
      newDoc.currentVersionId = vId;

      if (params.reviewingAgencyCodes) {
        newDoc.agencyReviews = params.reviewingAgencyCodes.map((code) => ({
          id: `rev-${vId}-${code.toLowerCase()}`,
          documentVersionId: vId,
          workstreamId: params.workstreamId || "",
          reviewingOrgCode: code,
          reviewStatus: "under_review",
        }));
      }
    }

    this.documents.unshift(newDoc);

    this.auditEvents.unshift(
      createAuditEvent({
        entityType: "document",
        entityId: id,
        actorName: params.initialVersion?.uploadedByName || params.ownerOrgCode,
        actorOrgName: params.ownerOrgCode,
        actionType: "document_created",
        newValue: `Created document: ${params.title}`,
        reason: "Document package registered in PATH Vault.",
      })
    );

    return newDoc;
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

  getOrganizations(): OrganizationRecord[] {
    return this.organizations;
  }

  getWorkflowTemplates(): WorkflowTemplateRecord[] {
    return this.workflowTemplates;
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

  getOrganizationMemberships(): OrganizationMembershipRecord[] {
    return this.memberships;
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

  getAssignmentGroups(orgCode?: string): AssignmentGroupRecord[] {
    if (orgCode) {
      return this.assignmentGroups.filter((g) => g.orgCode.toUpperCase() === orgCode.toUpperCase());
    }
    return this.assignmentGroups;
  }

  getAssignmentGroupById(groupId: string): AssignmentGroupRecord | undefined {
    return this.assignmentGroups.find((g) => g.id === groupId);
  }

  getAssignmentGroupMemberships(groupId?: string): AssignmentGroupMembershipRecord[] {
    if (groupId) {
      return this.assignmentGroupMemberships.filter((m) => m.assignmentGroupId === groupId);
    }
    return this.assignmentGroupMemberships;
  }

  getAssignmentGroupMembers(groupId: string): AssignmentGroupMembershipRecord[] {
    return this.getAssignmentGroupMemberships(groupId);
  }

  getTicketsByAssignmentGroup(groupId: string): {
    workstreams: WorkstreamRecord[];
    customerRequests: CustomerRequestRecord[];
    tasks: TaskRecord[];
  } {
    const workstreams = this.workstreams.filter((w) => w.assignmentGroupId === groupId);
    const customerRequests = this.customerRequests.filter((c) => c.assignmentGroupId === groupId);
    const tasks: TaskRecord[] = [];
    for (const ws of this.workstreams) {
      for (const t of ws.tasks || []) {
        if (t.assignmentGroupId === groupId) {
          tasks.push(t);
        }
      }
    }
    return { workstreams, customerRequests, tasks };
  }

  getTicketsByFulfiller(userId: string): {
    workstreams: WorkstreamRecord[];
    customerRequests: CustomerRequestRecord[];
    tasks: TaskRecord[];
  } {
    const workstreams = this.workstreams.filter((w) => w.assignedToUserId === userId);
    const customerRequests = this.customerRequests.filter((c) => c.assignedToUserId === userId);
    const tasks: TaskRecord[] = [];
    for (const ws of this.workstreams) {
      for (const t of ws.tasks || []) {
        if (t.assignedUserId === userId) {
          tasks.push(t);
        }
      }
    }
    return { workstreams, customerRequests, tasks };
  }

  private findTicket(ticketType: "workstream" | "customer_request" | "task", ticketId: string): MutableTicket | undefined {
    if (ticketType === "workstream") {
      return this.workstreams.find((w) => w.id === ticketId || w.code === ticketId);
    } else if (ticketType === "customer_request") {
      return this.customerRequests.find((c) => c.id === ticketId || c.confirmationNumber === ticketId);
    } else if (ticketType === "task") {
      for (const ws of this.workstreams) {
        const t = ws.tasks?.find((task) => task.id === ticketId);
        if (t) return t;
      }
    }
    return undefined;
  }

  async setOrganizationMemberRolePersisted(params: {
    userId: string;
    organizationId: string;
    role: OrganizationMembershipRecord["role"];
  }): Promise<{ data: OrganizationMembershipRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) return { data: null, error: new Error("Supabase is required for organization role changes.") };
    const result = await mutateSetOrganizationMemberRole(params);
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("Organization role change was not confirmed by the database.") };
    const memberships = await fetchOrganizationMemberships();
    this.memberships = memberships;
    return { data: memberships.find((membership) => membership.id === result.data?.id) ?? result.data, error: null };
  }

  // ==========================================
  // AUTHORITATIVE MUTATION METHODS
  // ==========================================

  updateProfile(params: {
    userId: string;
    updates: Partial<Pick<UserProfileRecord, "fullName" | "displayTitle" | "organizationName" | "organizationalUnit" | "workEmail" | "officePhone" | "mobilePhone" | "officeLocation" | "preferredContactMethod" | "availabilityStatus" | "projectRole" | "avatarUrl" | "isCustomerVisible" | "isActive">>;
    actorUserId: string;
    actorName?: string;
    isAdmin?: boolean;
  }): UserProfileRecord | null {
    if (params.actorUserId !== params.userId && !params.isAdmin) return null;
    const profile = this.getProfileByUserId(params.userId);
    if (!profile) return null;

    const selfServiceFields = ["displayTitle", "organizationalUnit", "workEmail", "officePhone", "mobilePhone", "officeLocation", "preferredContactMethod", "availabilityStatus", "avatarUrl"] as const;
    const updates = params.isAdmin
      ? params.updates
      : Object.fromEntries(selfServiceFields.filter((field) => field in params.updates).map((field) => [field, params.updates[field]]));

    Object.assign(profile, updates);

    const actor = this.getProfileByUserId(params.actorUserId);
    const actorName = params.actorName ?? actor?.fullName ?? profile.fullName;

    const auditEvent = createAuditEvent({
      entityType: "profile",
      entityId: profile.userId,
      actorName,
      actorOrgName: actor?.organizationName ?? profile.organizationName,
      actionType: "profile_updated",
      newValue: Object.keys(updates).join(", "),
      reason: params.actorUserId === params.userId ? "Self-service profile update" : "Administrator profile update",
    });
    this.auditEvents.unshift(auditEvent);

    return profile;
  }

  async updateProfilePersisted(params: {
    userId: string;
    updates: Partial<Pick<UserProfileRecord, "fullName" | "displayTitle" | "organizationName" | "organizationalUnit" | "workEmail" | "officePhone" | "mobilePhone" | "officeLocation" | "preferredContactMethod" | "availabilityStatus" | "projectRole" | "avatarUrl" | "isCustomerVisible" | "isActive">>;
    actorUserId: string;
    actorName?: string;
    isAdmin?: boolean;
  }): Promise<{ data: UserProfileRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      const profile = this.updateProfile(params);
      return profile ? { data: profile, error: null } : { data: null, error: new Error("Profile update is not authorized.") };
    }
    if (params.actorUserId !== params.userId && !params.isAdmin) return { data: null, error: new Error("Only the profile owner or an authorized administrator can update this profile.") };
    const actor = this.getProfileByUserId(params.actorUserId);
    const result = await mutateUpdateUserProfile({
      userId: params.userId,
      updates: params.updates,
      actorUserId: params.actorUserId,
      actorName: params.actorName ?? actor?.fullName ?? "PATH user",
      isAdmin: params.isAdmin,
    });
    if (result.error) return { data: null, error: result.error };
    const profiles = await fetchUserProfiles();
    const saved = profiles.find((profile) => profile.userId === params.userId || profile.id === params.userId);
    if (!saved) return { data: null, error: new Error("Profile update was not confirmed by the database.") };
    this.profiles = profiles;
    return { data: saved, error: null };
  }

  async updateParticipantPersisted(params: {
    participantId: string;
    updates: Partial<Pick<ProjectParticipantRecord, "organizationId" | "organizationName" | "projectRole" | "workstreamIds" | "assignedTaskIds" | "reviewResponsibility" | "notificationResponsibility" | "visibilityScope" | "startsOn" | "endsOn" | "isActive">>;
    actorUserId: string;
    actorName?: string;
    isAdmin?: boolean;
  }): Promise<{ data: ProjectParticipantRecord | null; error: Error | null }> {
    if (!params.isAdmin) return { data: null, error: new Error("Administrator access is required to update project participation.") };
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      const participant = this.updateParticipant(params);
      return participant ? { data: participant, error: null } : { data: null, error: new Error("Participant update is not authorized.") };
    }
    const participant = this.participants.find((entry) => entry.id === params.participantId);
    if (!participant) return { data: null, error: new Error("Participant not found.") };
    const actor = this.getProfileByUserId(params.actorUserId);
    const result = await mutateUpdateProjectParticipant({
      participantId: participant.id,
      updates: params.updates,
      actorName: params.actorName ?? actor?.fullName ?? "PATH administrator",
    });
    if (result.error) return { data: null, error: result.error };
    const participants = await fetchProjectParticipants(participant.projectId);
    const saved = participants.find((entry) => entry.id === participant.id);
    if (!saved) return { data: null, error: new Error("Participant update was not confirmed by the database.") };
    this.participants = this.participants.map((entry) => entry.id === saved.id ? saved : entry);
    return { data: saved, error: null };
  }

  updateParticipant(params: {
    participantId: string;
    updates: Partial<Pick<ProjectParticipantRecord, "organizationId" | "organizationName" | "projectRole" | "workstreamIds" | "assignedTaskIds" | "reviewResponsibility" | "notificationResponsibility" | "visibilityScope" | "startsOn" | "endsOn" | "isActive">>;
    actorUserId: string;
    actorName?: string;
    isAdmin?: boolean;
  }): ProjectParticipantRecord | null {
    if (!params.isAdmin) return null;
    const participant = this.participants.find((entry) => entry.id === params.participantId);
    if (!participant) return null;

    Object.assign(participant, params.updates);

    const actor = this.getProfileByUserId(params.actorUserId);
    const actorName = params.actorName ?? actor?.fullName ?? "PATH administrator";

    const auditEvent = createAuditEvent({
      entityType: "project_participant",
      entityId: participant.id,
      actorName,
      actorOrgName: actor?.organizationName ?? "PATH",
      actionType: "participant_updated",
      newValue: Object.keys(params.updates).join(", "),
      reason: "Administrator updated project participation controls",
    });
    this.auditEvents.unshift(auditEvent);

    return participant;
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

    const auditEvent = createAuditEvent({
      entityType: "customer_request",
      entityId: request.confirmationNumber,
      actorName: request.submittedByName,
      actorOrgName: "Space Exploration Technologies Corp. (SpaceX)",
      actionType: "customer_request_submitted",
      newValue: `${request.requestType} · ${request.title}`,
      reason: request.description,
    });
    this.auditEvents.unshift(auditEvent);

    if (request.status !== "draft") {
      this.dispatchNotification({
        userId: "user-sarah-johnson",
        title: `New customer request ${request.confirmationNumber}`,
        message: request.title,
        type: "action_required",
        linkUrl: `/requests/${request.confirmationNumber}`,
        urgency: request.blocksActiveWork ? "critical" : "high",
        metadata: { confirmationNumber: request.confirmationNumber, requestType: request.requestType },
      });
    }

    return request;
  }

  /** Production mutation: commit first, then expose the authoritative row. */
  async createCustomerRequestPersisted(
    params: Omit<CustomerRequestRecord, "id" | "confirmationNumber" | "status" | "createdAt" | "updatedAt"> & { status?: CustomerRequestRecord["status"]; attachmentFile?: File }
  ): Promise<{ data: CustomerRequestRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      return { data: this.createCustomerRequest(params), error: null };
    }
    const now = new Date().toISOString();
    const requestId = `customer-request-${crypto.randomUUID()}`;
    const confirmationNumber = `PATH-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const requestParams = {
      id: requestId,
      confirmationNumber,
      projectId: params.projectId,
      requestType: params.requestType,
      title: params.title,
      description: params.description,
      requestedOutcome: params.requestedOutcome,
      locationOrAffectedArea: params.locationOrAffectedArea,
      desiredDate: params.desiredDate,
      scheduleImportance: params.scheduleImportance,
      knownAgencyCode: params.knownAgencyCode,
      knownPermitTypeId: params.knownPermitTypeId,
      submittedByUserId: params.submittedByUserId,
      submittedByName: params.submittedByName,
      relatedWorkstreamId: params.relatedWorkstreamId,
      blocksActiveWork: params.blocksActiveWork,
      status: params.status ?? "submitted",
      attachmentDocumentVersionIds: params.attachmentDocumentVersionIds,
    };
    const result = params.attachmentFile
      ? await mutateCreateCustomerRequestWithDocument({ ...requestParams, file: params.attachmentFile })
      : await mutateCreateCustomerRequest(requestParams);
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("Customer request was not persisted.") };
    const request = { ...result.data, id: String(result.data.id), createdAt: result.data.createdAt || now, updatedAt: result.data.updatedAt || now };
    this.customerRequests = [request, ...this.customerRequests.filter((entry) => entry.id !== request.id)];
    return { data: request, error: null };
  }

  async createWorkstreamFromRequestPersisted(params: {
    requestId: string;
    code: string;
    title: string;
    category: string;
    permitTypeId?: string;
    leadOrgCode?: string;
    leadOrgName?: string;
    workflowVersionId?: string;
  }): Promise<{ data: { requestId: string; workstreamId: string; workstreamCode: string; workflowVersionId?: string } | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      return allowsFixtureData()
        ? { data: null, error: new Error("Workstream triage requires a configured Supabase administrator session.") }
        : { data: null, error: new Error("Supabase is required in production mode.") };
    }
    const result = await mutateCreateWorkstreamFromRequest(params);
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("Workstream creation was not confirmed by the database.") };
    await this.hydrateFromSupabase();
    return { data: result.data, error: null };
  }

  async triageCustomerRequestPersisted(params: {
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
  }): Promise<{ data: { requestId: string; workstreamIds: string[]; workstreamCodes: string[] } | null; error: Error | null }> {
    if (!isSupabaseConfigured()) return { data: null, error: new Error("Supabase is required for atomic customer triage.") };
    const result = await mutateTriageCustomerRequest(params);
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("Customer triage was not confirmed by the database.") };
    await this.hydrateFromSupabase();
    return { data: result.data, error: null };
  }

  createExternalFiling(params: Omit<ExternalFilingRecord, "id" | "createdAt" | "updatedAt">): ExternalFilingRecord {
    const now = new Date().toISOString();
    const filing: ExternalFilingRecord = {
      ...params,
      id: `external-filing-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };

    this.externalFilings.unshift(filing);

    const auditEvent = createAuditEvent({
      entityType: "external_filing",
      entityId: filing.id,
      actorName: filing.submittedByName ?? "PATH user",
      actorOrgName: filing.authorityOrganizationName,
      actionType: "external_filing_recorded",
      newValue: filing.externalReferenceNumber ?? "Reference pending",
      reason: filing.notes ?? "Manual tracking record created.",
    });
    this.auditEvents.unshift(auditEvent);

    return filing;
  }

  async createExternalFilingPersisted(params: Omit<ExternalFilingRecord, "id" | "createdAt" | "updatedAt">): Promise<{ data: ExternalFilingRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      return { data: this.createExternalFiling(params), error: null };
    }
    const filing = { ...params, id: `external-filing-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const result = await mutateCreateExternalFiling(filing);
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("External filing was not persisted.") };
    this.externalFilings = [result.data, ...this.externalFilings.filter((entry) => entry.id !== result.data?.id)];
    return result;
  }

  updateExternalFiling(
    id: string,
    updates: Partial<Pick<ExternalFilingRecord, "externalReferenceNumber" | "externalRecordUrl" | "externalStatus" | "submittedAt" | "submittedByUserId" | "submittedByName" | "lastStatusVerifiedAt" | "lastStatusVerifiedBy" | "notes" | "receiptDocumentVersionIds">>,
    actorName: string,
    actorOrgName: string
  ): ExternalFilingRecord | null {
    const filing = this.externalFilings.find((entry) => entry.id === id);
    if (!filing) return null;

    Object.assign(filing, updates, { updatedAt: new Date().toISOString() });

    const auditEvent = createAuditEvent({
      entityType: "external_filing",
      entityId: filing.id,
      actorName,
      actorOrgName,
      actionType: "external_filing_updated",
      newValue: filing.externalStatus,
      reason: filing.notes ?? "External filing status updated.",
    });
    this.auditEvents.unshift(auditEvent);

    return filing;
  }

  createCoordinationRequest(params: {
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

  async createRFIPersisted(params: {
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
  }): Promise<{ data: RFIRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      return { data: this.createRFI(params), error: null };
    }
    const workstream = this.getWorkstreamById(params.workstreamId);
    if (!workstream) return { data: null, error: new Error("Workstream not found.") };
    const result = await mutateCreateRFI({
      ...params,
      id: `rfi-${crypto.randomUUID()}`,
      code: `RFI-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      workstreamId: workstream.id,
    });
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("RFI creation was not confirmed by the database.") };
    await this.hydrateFromSupabase();
    return { data: result.data, error: null };
  }

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

  async markWorkstreamBlockedPersisted(params: {
    workstreamId: string;
    reason: string;
    waitingOn: string;
    actorName: string;
    actorOrgName: string;
    pauseClock?: boolean;
  }): Promise<{ data: WorkstreamRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      return { data: this.markWorkstreamBlocked(params), error: null };
    }
    const workstream = this.getWorkstreamById(params.workstreamId);
    if (!workstream) return { data: null, error: new Error("Workstream not found.") };
    const result = await mutateMarkWorkstreamBlocked({ ...params, workstreamId: workstream.id, workstreamCode: workstream.code });
    if (result.error) return { data: null, error: result.error };
    await this.hydrateFromSupabase();
    return { data: result.data, error: null };
  }

  async clearWorkstreamBlockerPersisted(params: {
    workstreamId: string;
    resolutionNotes?: string;
    actorName: string;
    actorOrgName: string;
  }): Promise<{ data: WorkstreamRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      return { data: this.clearWorkstreamBlocker(params), error: null };
    }
    const workstream = this.getWorkstreamById(params.workstreamId);
    if (!workstream) return { data: null, error: new Error("Workstream not found.") };
    const result = await mutateClearWorkstreamBlocker({ ...params, workstreamId: workstream.id });
    if (result.error) return { data: null, error: result.error };
    await this.hydrateFromSupabase();
    return { data: this.getWorkstreamById(workstream.id) ?? null, error: null };
  }

  clearWorkstreamBlocker(params: {
    workstreamId: string;
    resolutionNotes?: string;
    actorName: string;
    actorOrgName: string;
  }): WorkstreamRecord | null {
    const ws = this.getWorkstreamById(params.workstreamId);
    if (!ws) return null;

    const oldState = ws.operationalState;
    ws.operationalState = "running";
    ws.operationalStateLabel = ws.currentStageName ? `Running (${ws.currentStageName})` : "Running";
    const oldReason = ws.waitingReason;
    ws.waitingReason = undefined;
    ws.waitingOnEntity = undefined;

    this.auditEvents.unshift(createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
      actionType: "resumed",
      oldValue: oldState,
      newValue: "running",
      reason: params.resolutionNotes || `Blocker cleared (${oldReason || "concurrence received"}). Review clock resumed.`,
    }));

    this.dispatchNotification({
      userId: "user-sarah-johnson",
      title: `${ws.title} resumed`,
      message: `Blocker cleared by ${params.actorName}. Work is running.`,
      type: "status_update",
      linkUrl: `/workstreams/${ws.code}`,
      urgency: "info",
      metadata: { workstreamCode: ws.code },
    });

    return ws;
  }

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
      const validation = validateStageTransition(
        currentStage,
        params.completedChecklists,
        params.providedDocs
      );
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
    ws.currentStageId = nextStage?.id ?? ws.currentStageId;
    ws.operationalState = nextStage ? "running" : "complete";
    ws.operationalStateLabel = nextStage ? `Running (${nextStage.name})` : "Complete";
    ws.waitingReason = undefined;
    ws.waitingOnEntity = undefined;
    ws.actualCompletionDate = nextStage ? undefined : new Date().toISOString().split("T")[0];

    // Transition lead agency if the next stage belongs to a different agency
    if (nextStage && nextStage.responsibleOrgCode && nextStage.responsibleOrgCode !== ws.regulatoryLead.orgCode) {
      ws.regulatoryLead.orgCode = nextStage.responsibleOrgCode;
      ws.regulatoryLead.orgName =
        nextStage.responsibleOrgCode === "CPRA"
          ? "Coastal Protection and Restoration Authority"
          : nextStage.responsibleOrgCode === "DOTD"
          ? "Louisiana Department of Transportation and Development"
          : nextStage.responsibleOrgCode === "LDEQ"
          ? "Louisiana Department of Environmental Quality"
          : nextStage.responsibleOrgCode === "USACE"
          ? "US Army Corps of Engineers (New Orleans District)"
          : nextStage.responsibleOrgCode === "LDWF"
          ? "Louisiana Department of Wildlife and Fisheries"
          : `${nextStage.responsibleOrgCode} Regulatory Division`;

      ws.regulatoryLead.assignedReviewerName =
        nextStage.responsibleOrgCode === "CPRA"
          ? "Jean-Paul Guidry"
          : nextStage.responsibleOrgCode === "DOTD"
          ? "Mark Fontenot, PE"
          : nextStage.responsibleOrgCode === "LDEQ"
          ? "Jordan Lee"
          : nextStage.responsibleOrgCode === "USACE"
          ? "Martin Breaux"
          : nextStage.responsibleOrgCode === "LDWF"
          ? "Dr. Camille LeBlanc"
          : "Assigned Agency Reviewer";
    }

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
      message: nextStage ? `The next action is ${nextStage.name} (${ws.regulatoryLead.orgCode}).` : "The workstream is complete.",
      type: "completion",
      linkUrl: `/workstreams/${ws.code}`,
      urgency: "info",
      metadata: { workstreamCode: ws.code, nextOwner: nextStage?.responsibleOrgCode ?? "Project Office" },
    });

    return { success: true, workstream: ws, nextOwner: nextStage?.responsibleOrgCode ?? "Project Office" };
  }

  async completeWorkstreamStagePersisted(params: {
    workstreamId: string;
    completedChecklists: string[];
    providedDocs?: string[];
    actorName: string;
    actorOrgName: string;
  }): Promise<{ success: boolean; error: Error | null; nextStageName?: string }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { success: false, error: new Error("Supabase is required in production mode.") };
      const result = this.completeWorkstreamStage({ ...params, providedDocs: [] });
      return { success: result.success, error: result.success ? null : new Error(result.errors?.join(" ") ?? "Transition rejected."), nextStageName: result.workstream?.currentStageName };
    }
    const workstream = this.getWorkstreamById(params.workstreamId);
    if (!workstream) return { success: false, error: new Error("Workstream not found.") };
    const result = await mutateCompleteWorkstreamStage({
      ...params,
      workstreamId: workstream.id,
      workstreamCode: workstream.code,
    });
    if (result.error || !result.data) return { success: false, error: result.error ?? new Error("The workflow transition was not confirmed by the database.") };
    await this.hydrateFromSupabase();
    return { success: true, error: null, nextStageName: result.data.nextStageName };
  }

  updateTask(params: {
    taskId: string;
    updates: Partial<Pick<TaskRecord, "title" | "description" | "status" | "assignedOrgCode" | "assignedUserId" | "assignedUserName" | "isCriticalPath" | "durationDays" | "floatDays" | "actualCompletionDate">>;
    actorName?: string;
    actorOrgName?: string;
  }): TaskRecord | null {
    for (const ws of this.workstreams) {
      const task = ws.tasks?.find((t) => t.id === params.taskId);
      if (task) {
        Object.assign(task, params.updates);
        if (params.actorName) {
          this.auditEvents.unshift(
            createAuditEvent({
              entityType: "task",
              entityId: task.id,
              actorName: params.actorName,
              actorOrgName: params.actorOrgName ?? ws.regulatoryLead?.orgCode ?? "PATH",
              actionType: "task_updated",
              newValue: params.updates.status ?? "Updated",
              reason: "Task record updated.",
            })
          );
        }
        return task;
      }
    }
    return null;
  }

  async updateTaskPersisted(params: {
    taskId: string;
    updates: Partial<Pick<TaskRecord, "title" | "description" | "status" | "assignedOrgCode" | "assignedUserId" | "assignedUserName" | "isCriticalPath" | "durationDays" | "floatDays" | "actualCompletionDate">>;
    actorName?: string;
    actorOrgName?: string;
  }): Promise<{ data: TaskRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      const task = this.updateTask(params);
      return { data: task, error: task ? null : new Error("Task not found.") };
    }
    const result = await mutateUpdateTask(params);
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("Task update was not confirmed by the database.") };
    await this.hydrateFromSupabase();
    return { data: result.data, error: null };
  }

  completeTask(params: { taskId: string; actorName?: string; actorOrgName?: string }): TaskRecord | null {
    return this.updateTask({
      taskId: params.taskId,
      updates: {
        status: "completed",
        actualCompletionDate: new Date().toISOString().split("T")[0],
      },
      actorName: params.actorName,
      actorOrgName: params.actorOrgName,
    });
  }

  async completeTaskPersisted(params: { taskId: string; actorName?: string; actorOrgName?: string }): Promise<{ data: TaskRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      const task = this.completeTask(params);
      return { data: task, error: task ? null : new Error("Task not found.") };
    }
    const result = await mutateCompleteTask(params);
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("Task completion was not confirmed by the database.") };
    await this.hydrateFromSupabase();
    return { data: result.data, error: null };
  }

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

  updateWorkstreamOperationalState(workstreamId: string, newState: string, actorName: string) {
    const ws = this.getWorkstreamById(workstreamId);
    if (!ws) return null;

    const oldState = ws.operationalState;
    const oldLabel = ws.operationalStateLabel;
    ws.operationalState = newState as WorkstreamRecord["operationalState"];
    ws.operationalStateLabel = newState === "running" ? "In Progress" : newState === "waiting_government" ? "On Hold" : newState === "complete" ? "Completed" : newState === "pending_concurrence" ? "Pending Review" : newState;

    const event = createAuditEvent({
      entityType: "workstream",
      entityId: ws.code,
      actorName,
      actorOrgName: ws.regulatoryLead?.orgName ?? "State Project Office",
      actionType: "status_change",
      oldValue: oldLabel ?? oldState,
      newValue: ws.operationalStateLabel,
      reason: `Workstream operational state changed from "${oldLabel ?? oldState}" to "${ws.operationalStateLabel}" by ${actorName}.`,
    });
    this.auditEvents.unshift(event);

    return event;
  }

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

  async escalateWorkstreamPersisted(params: { workstreamId: string; problemType: string; actorName: string; actorOrgName: string }): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { success: false, error: new Error("Supabase is required in production mode.") };
      return { success: Boolean(this.escalateWorkstream(params)), error: null };
    }
    const workstream = this.getWorkstreamById(params.workstreamId);
    if (!workstream) return { success: false, error: new Error("Workstream not found.") };
    const result = await mutateEscalateWorkstream({ ...params, workstreamId: workstream.id, workstreamCode: workstream.code, currentLevel: workstream.escalationLevel });
    if (result.error) return { success: false, error: result.error };
    await this.hydrateFromSupabase();
    return { success: true, error: null };
  }

  async transferWorkstreamPersisted(params: { workstreamId: string; transferType: string; targetName: string; actorName: string; actorOrgName: string; note?: string }): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { success: false, error: new Error("Supabase is required in production mode.") };
      return { success: Boolean(this.transferWorkstream(params)), error: null };
    }
    const workstream = this.getWorkstreamById(params.workstreamId);
    if (!workstream) return { success: false, error: new Error("Workstream not found.") };
    const result = await mutateTransferWorkstream({ ...params, workstreamId: workstream.id, workstreamCode: workstream.code });
    if (result.error) return { success: false, error: result.error };
    await this.hydrateFromSupabase();
    return { success: true, error: null };
  }

  async addWorkstreamNotePersisted(params: { workstreamId: string; note: string; actorName: string; actorOrgName: string }): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { success: false, error: new Error("Supabase is required in production mode.") };
      return { success: Boolean(this.addWorkstreamNote(params)), error: null };
    }
    const workstream = this.getWorkstreamById(params.workstreamId);
    if (!workstream) return { success: false, error: new Error("Workstream not found.") };
    const result = await mutateAddWorkstreamNote({ ...params, workstreamId: workstream.id, workstreamCode: workstream.code });
    if (result.error) return { success: false, error: result.error };
    await this.hydrateFromSupabase();
    return { success: true, error: null };
  }

  async createCoordinationRequestPersisted(params: Parameters<ProjectDeliveryRepository["createCoordinationRequest"]>[0]): Promise<{ data: CoordinationRequestRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      return { data: this.createCoordinationRequest(params), error: null };
    }
    const workstream = this.getWorkstreamById(params.workstreamId);
    if (!workstream) return { data: null, error: new Error("Workstream not found.") };
    const count = this.coordinationRequests.length + 1;
    const result = await mutateCreateCoordinationRequest({
      id: `cr-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      code: `CR-${String(450 + count).padStart(5, "0")}`,
      ...params,
      workstreamId: workstream.id,
      priority: params.priority === "urgent" ? "high" : params.priority,
    });
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("Coordination request was not persisted.") };
    this.coordinationRequests = [result.data, ...this.coordinationRequests.filter((entry) => entry.id !== result.data?.id)];
    return result;
  }

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

  async acceptRfiResponsePersisted(params: { rfiId: string; actorName: string; actorOrgName: string; notes?: string }): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { success: false, error: new Error("Supabase is required in production mode.") };
      return { success: Boolean(this.acceptRfiResponse(params)), error: null };
    }
    const rfi = this.rfis.find((entry) => entry.id === params.rfiId || entry.code === params.rfiId);
    if (!rfi) return { success: false, error: new Error("RFI not found.") };
    const result = await mutateAcceptRFIResponse({ ...params, rfiId: rfi.id, rfiCode: rfi.code, workstreamId: rfi.workstreamId });
    if (result.error) return { success: false, error: result.error };
    await this.hydrateFromSupabase();
    return { success: true, error: null };
  }

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

    const ws = this.getWorkstreamById(rfi.workstreamId);
    if (ws) {
      ws.operationalState = "waiting_government";
      ws.operationalStateLabel = `Waiting on ${rfi.requestingOrgCode} Review`;
      ws.waitingReason = "SpaceX response submitted; awaiting reviewer acceptance";
      ws.waitingOnEntity = rfi.requestingOrgCode;
    }

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

  async submitRfiResponsePersisted(params: { rfiId: string; submittedByName: string; responseText: string; actorOrgName: string; attachedDocumentVersionIds?: string[] }): Promise<{ data: RFIResponseRecord | null; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { data: null, error: new Error("Supabase is required in production mode.") };
      return { data: this.submitRfiResponse(params), error: null };
    }
    const rfi = this.rfis.find((entry) => entry.id === params.rfiId || entry.code === params.rfiId);
    if (!rfi) return { data: null, error: new Error("RFI not found.") };
    const result = await mutateSubmitRFIResponse({
      id: `resp-${crypto.randomUUID()}`,
      rfiCode: rfi.code,
      submittedByName: params.submittedByName,
      responseText: params.responseText,
      actorOrgName: params.actorOrgName,
      attachedDocumentVersionIds: params.attachedDocumentVersionIds,
      rfiId: rfi.id,
    });
    if (result.error || !result.data) return { data: null, error: result.error ?? new Error("RFI response was not confirmed by the database.") };
    await this.hydrateFromSupabase();
    return { data: result.data, error: null };
  }

  reviewDocumentVersion(params: { versionId: string; agencyCode: string; decision: "approved" | "approved_with_conditions" | "revision_requested"; actorName: string; comments: string }) {
    return this.signoffDocumentAgencyReview(params.versionId, params.agencyCode, params.decision, params.actorName, params.comments);
  }

  async reviewDocumentVersionPersisted(params: { versionId: string; agencyCode: string; decision: "approved" | "approved_with_conditions" | "revision_requested"; actorName: string; comments: string }): Promise<{ success: boolean; error: Error | null }> {
    if (!isSupabaseConfigured()) {
      if (!allowsFixtureData()) return { success: false, error: new Error("Supabase is required in production mode.") };
      return { success: Boolean(this.reviewDocumentVersion(params)), error: null };
    }
    const result = await mutateReviewDocumentVersion(params);
    if (result.error) return { success: false, error: result.error };
    await this.hydrateFromSupabase();
    return { success: true, error: null };
  }

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

  createDocumentVersion(
    documentId: string,
    params: {
      id?: string;
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

    const versionId = params.id ?? `doc-v-${doc.id.toLowerCase()}-v${params.versionNumber}`;
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

    return newVersion;
  }

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

          return review;
        }
      }
    }
    return null;
  }

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

  dispatchNotification(notification: Omit<NotificationRecord, "id" | "createdAt" | "isRead">): NotificationRecord {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const full: NotificationRecord = {
      ...notification,
      id,
      createdAt: new Date().toISOString(),
      isRead: false,
      urgency: "info",
    };
    this.notifications.unshift(full);

    return full;
  }

  // ==========================================
  // ITSM TICKET & ASSIGNMENT MUTATIONS
  // ==========================================

  assignTicket(options: {
    ticketType: "workstream" | "customer_request" | "task";
    ticketId: string;
    assignmentGroupId?: string;
    assignedToUserId?: string;
    actorName?: string;
    actorUserId?: string;
    reason?: string;
  }): { success: boolean; ticket: MutableTicket | null } {
    const ticket = this.findTicket(options.ticketType, options.ticketId);
    if (!ticket) {
      return { success: false, ticket: null };
    }

    const prevGroup = ticket.assignmentGroupId;
    const prevFulfiller = ticket.assignedToUserId;

    if (options.assignmentGroupId !== undefined) {
      ticket.assignmentGroupId = options.assignmentGroupId;
      const grp = this.assignmentGroups.find((g) => g.id === options.assignmentGroupId);
      if (grp) {
        ticket.assignmentGroupName = grp.name;
        ticket.assignedOrgCode = grp.orgCode;
      }
    }

    if (options.assignedToUserId !== undefined) {
      ticket.assignedToUserId = options.assignedToUserId;
      const profile = this.profiles.find((p) => p.userId === options.assignedToUserId || p.id === options.assignedToUserId);
      if (profile) {
        ticket.assignedToUserName = profile.fullName;
        if (options.ticketType === "task") {
          ticket.assignedUserName = profile.fullName;
          ticket.assignedUserId = options.assignedToUserId;
        }
      }
    }

    const isReassignment =
      (prevGroup && options.assignmentGroupId && prevGroup !== options.assignmentGroupId) ||
      (prevFulfiller && options.assignedToUserId && prevFulfiller !== options.assignedToUserId);

    const actor = options.actorUserId ? this.getProfileByUserId(options.actorUserId) : undefined;
    const actorName = options.actorName || actor?.fullName || "System User";
    const actorOrg = actor?.organizationName || "PATH";

    const auditEvent = createAuditEvent({
      entityType: options.ticketType,
      entityId: options.ticketId,
      actorName,
      actorOrgName: actorOrg,
      actionType: isReassignment ? "ticket_reassigned" : "ticket_assigned",
      oldValue: prevGroup || prevFulfiller ? `Group: ${prevGroup || "none"}, User: ${prevFulfiller || "none"}` : undefined,
      newValue: `Group: ${ticket.assignmentGroupId || "none"}, User: ${ticket.assignedToUserId || "none"}`,
      reason: options.reason || "Ticket assigned",
    });
    this.auditEvents.unshift(auditEvent);

    if (options.assignedToUserId) {
      const notif: NotificationRecord = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: options.assignedToUserId,
        title: "Ticket Assigned to You",
        message: `${options.ticketType.replace("_", " ").toUpperCase()} ${ticket.title || ticket.code || options.ticketId} has been assigned to you.`,
        type: "assignment",
        linkUrl: `/workstreams/${ticket.id || ticket.code}`,
        isRead: false,
        urgency: "info",
        createdAt: new Date().toISOString(),
      };
      this.notifications.unshift(notif);
    }

    return { success: true, ticket };
  }

  assignTicketToGroup(
    ticketType: "workstream" | "customer_request" | "task",
    ticketId: string,
    assignmentGroupId: string,
    actorName?: string,
    reason?: string
  ) {
    return this.assignTicket({ ticketType, ticketId, assignmentGroupId, actorName, reason });
  }

  assignTicketToFulfiller(
    ticketType: "workstream" | "customer_request" | "task",
    ticketId: string,
    assignedToUserId: string,
    actorName?: string,
    reason?: string
  ) {
    return this.assignTicket({ ticketType, ticketId, assignedToUserId, actorName, reason });
  }

  updateTicketITSMState(options: {
    ticketType: "workstream" | "customer_request" | "task";
    ticketId: string;
    targetState: ITSMState;
    actorName?: string;
    actorUserId?: string;
    reason?: string;
    pauseReason?: string;
  }): { success: boolean; ticket: MutableTicket | null } {
    const ticket = this.findTicket(options.ticketType, options.ticketId);
    if (!ticket) {
      return { success: false, ticket: null };
    }

    const previousState = ticket.itsmState || "submitted";
    const newState = parseITSMState(options.targetState);
    ticket.itsmState = newState;

    // Clock state transition calculation
    if (newState === "pending_customer" || newState === "pending_agency" || newState === "blocked") {
      if (ticket.clockStatus !== "paused") {
        ticket.clockStatus = "paused";
        ticket.clockPausedAt = new Date().toISOString();
        ticket.clockPausedReason = options.pauseReason || options.reason || `Clock paused due to state: ${newState}`;
      }
    } else if (newState === "resolved" || newState === "closed") {
      if (ticket.clockStatus === "paused" && ticket.clockPausedAt) {
        const pStart = new Date(ticket.clockPausedAt).getTime();
        const diffSeconds = Math.max(0, Math.round((Date.now() - pStart) / 1000));
        ticket.clockTotalPausedSeconds = (ticket.clockTotalPausedSeconds || 0) + diffSeconds;
      }
      ticket.clockStatus = "stopped";
      ticket.clockPausedAt = undefined;
      ticket.clockPausedReason = undefined;
    } else {
      // in_progress, triaged, draft
      if (ticket.clockStatus === "paused" && ticket.clockPausedAt) {
        const pStart = new Date(ticket.clockPausedAt).getTime();
        const diffSeconds = Math.max(0, Math.round((Date.now() - pStart) / 1000));
        ticket.clockTotalPausedSeconds = (ticket.clockTotalPausedSeconds || 0) + diffSeconds;
        ticket.clockPausedAt = undefined;
        ticket.clockPausedReason = undefined;
      }
      ticket.clockStatus = "active";
    }

    // Bi-directional synchronizations
    if (options.ticketType === "workstream") {
      ticket.operationalState = mapITSMStateToOperationalState(newState);
      if (newState === "blocked") {
        ticket.ragHealth = "red";
      } else if (newState === "resolved" || newState === "closed") {
        ticket.actualCompletionDate = new Date().toISOString().split("T")[0];
      }
    } else if (options.ticketType === "customer_request") {
      if (newState === "triaged") ticket.status = "triage";
      else if (newState === "in_progress") ticket.status = "in_progress";
      else if (newState === "resolved") ticket.status = "resolved";
      else if (newState === "closed") ticket.status = "closed";
    }

    const actor = options.actorUserId ? this.getProfileByUserId(options.actorUserId) : undefined;
    const actorName = options.actorName || actor?.fullName || "System User";
    const actorOrg = actor?.organizationName || "PATH";

    const auditEvent = createAuditEvent({
      entityType: options.ticketType,
      entityId: options.ticketId,
      actorName,
      actorOrgName: actorOrg,
      actionType: "itsm_state_changed",
      oldValue: previousState,
      newValue: newState,
      reason: options.reason || (options.pauseReason ? `Pause reason: ${options.pauseReason}` : "ITSM state transition"),
    });
    this.auditEvents.unshift(auditEvent);

    return { success: true, ticket };
  }

  updateStatutoryClock(options: {
    ticketType: "workstream" | "customer_request" | "task";
    ticketId: string;
    clockStatus: ClockStatus;
    pauseReason?: string;
    actorName?: string;
  }): { success: boolean; ticket: MutableTicket | null } {
    const ticket = this.findTicket(options.ticketType, options.ticketId);
    if (!ticket) return { success: false, ticket: null };

    const oldStatus = ticket.clockStatus;
    ticket.clockStatus = options.clockStatus;

    if (options.clockStatus === "paused") {
      ticket.clockPausedAt = new Date().toISOString();
      ticket.clockPausedReason = options.pauseReason || "Manual clock pause";
    } else if (options.clockStatus === "active" && oldStatus === "paused" && ticket.clockPausedAt) {
      const pStart = new Date(ticket.clockPausedAt).getTime();
      const diffSeconds = Math.max(0, Math.round((Date.now() - pStart) / 1000));
      ticket.clockTotalPausedSeconds = (ticket.clockTotalPausedSeconds || 0) + diffSeconds;
      ticket.clockPausedAt = undefined;
      ticket.clockPausedReason = undefined;
    }

    const auditEvent = createAuditEvent({
      entityType: options.ticketType,
      entityId: options.ticketId,
      actorName: options.actorName || "System User",
      actorOrgName: "PATH",
      actionType: "clock_status_changed",
      oldValue: oldStatus,
      newValue: options.clockStatus,
      reason: options.pauseReason || "Statutory clock adjustment",
    });
    this.auditEvents.unshift(auditEvent);

    return { success: true, ticket };
  }

  setTicketPriority(options: {
    ticketType: "workstream" | "customer_request" | "task";
    ticketId: string;
    priority: PriorityLevel;
    actorName?: string;
    actorUserId?: string;
    reason?: string;
  }): { success: boolean; ticket: MutableTicket | null } {
    const ticket = this.findTicket(options.ticketType, options.ticketId);
    if (!ticket) return { success: false, ticket: null };

    const oldPriority = ticket.priority;
    const newPriority = parsePriorityLevel(options.priority);
    ticket.priority = newPriority;

    const actor = options.actorUserId ? this.getProfileByUserId(options.actorUserId) : undefined;
    const actorName = options.actorName || actor?.fullName || "System User";

    const auditEvent = createAuditEvent({
      entityType: options.ticketType,
      entityId: options.ticketId,
      actorName,
      actorOrgName: actor?.organizationName || "PATH",
      actionType: "priority_changed",
      oldValue: oldPriority,
      newValue: newPriority,
      reason: options.reason || "Priority matrix calculation / adjustment",
    });
    this.auditEvents.unshift(auditEvent);

    return { success: true, ticket };
  }

  createAssignmentGroup(group: Omit<AssignmentGroupRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): AssignmentGroupRecord {
    const newGroup: AssignmentGroupRecord = {
      id: group.id || `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      orgCode: group.orgCode,
      organizationId: group.organizationId,
      name: group.name,
      description: group.description,
      leadUserId: group.leadUserId,
      leadUserName: group.leadUserName,
      active: group.active !== undefined ? group.active : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.assignmentGroups.push(newGroup);

    const auditEvent = createAuditEvent({
      entityType: "assignment_group",
      entityId: newGroup.id,
      actorName: "System Admin",
      actorOrgName: group.orgCode,
      actionType: "group_created",
      newValue: newGroup.name,
      reason: "New assignment group registered",
    });
    this.auditEvents.unshift(auditEvent);

    return newGroup;
  }

  addAssignmentGroupMember(membership: Omit<AssignmentGroupMembershipRecord, "id" | "createdAt" | "updatedAt"> & { id?: string }): AssignmentGroupMembershipRecord {
    const newMembership: AssignmentGroupMembershipRecord = {
      id: membership.id || `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      assignmentGroupId: membership.assignmentGroupId,
      userId: membership.userId,
      role: membership.role || "member",
      userName: membership.userName,
      userEmail: membership.userEmail,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.assignmentGroupMemberships.push(newMembership);
    return newMembership;
  }

  async assignTicketPersisted(options: {
    ticketType: "workstream" | "customer_request" | "task";
    ticketId: string;
    assignmentGroupId?: string;
    assignedToUserId?: string;
    actorName?: string;
    actorUserId?: string;
    reason?: string;
  }): Promise<{ data: unknown; error: Error | null }> {
    if (isSupabaseConfigured()) {
      const dbResult = await mutateAssignTicket(options);
      if (dbResult.error) {
        return { data: null, error: dbResult.error };
      }
      const memoryResult = this.assignTicket(options);
      if (!memoryResult.success) {
        await this.hydrateFromSupabase();
        return { data: dbResult.data, error: null };
      }
      return { data: memoryResult.ticket, error: null };
    }

    if (!allowsFixtureData()) {
      return { data: null, error: new Error("Supabase is required in production mode.") };
    }
    const memoryResult = this.assignTicket(options);
    return memoryResult.success
      ? { data: memoryResult.ticket, error: null }
      : { data: null, error: new Error("Ticket not found") };
  }

  async updateTicketITSMStatePersisted(options: {
    ticketType: "workstream" | "customer_request" | "task";
    ticketId: string;
    targetState: ITSMState;
    actorName?: string;
    actorUserId?: string;
    reason?: string;
    pauseReason?: string;
  }): Promise<{ data: unknown; error: Error | null }> {
    if (isSupabaseConfigured()) {
      const dbResult = await mutateUpdateTicketITSMState(options);
      if (dbResult.error) {
        return { data: null, error: dbResult.error };
      }
      const memoryResult = this.updateTicketITSMState(options);
      if (!memoryResult.success) {
        await this.hydrateFromSupabase();
        return { data: dbResult.data, error: null };
      }
      return { data: memoryResult.ticket, error: null };
    }

    if (!allowsFixtureData()) {
      return { data: null, error: new Error("Supabase is required in production mode.") };
    }
    const memoryResult = this.updateTicketITSMState(options);
    return memoryResult.success
      ? { data: memoryResult.ticket, error: null }
      : { data: null, error: new Error("Ticket not found") };
  }

  async setTicketPriorityPersisted(options: {
    ticketType: "workstream" | "customer_request" | "task";
    ticketId: string;
    priority: PriorityLevel;
    actorName?: string;
    actorUserId?: string;
    reason?: string;
  }): Promise<{ data: unknown; error: Error | null }> {
    if (isSupabaseConfigured()) {
      const dbResult = await mutateSetTicketPriority(options);
      if (dbResult.error) {
        return { data: null, error: dbResult.error };
      }
      const memoryResult = this.setTicketPriority(options);
      if (!memoryResult.success) {
        await this.hydrateFromSupabase();
        return { data: dbResult.data, error: null };
      }
      return { data: memoryResult.ticket, error: null };
    }

    if (!allowsFixtureData()) {
      return { data: null, error: new Error("Supabase is required in production mode.") };
    }
    const memoryResult = this.setTicketPriority(options);
    return memoryResult.success
      ? { data: memoryResult.ticket, error: null }
      : { data: null, error: new Error("Ticket not found") };
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
    this.assignmentGroups = JSON.parse(JSON.stringify(assignmentGroupsData));
    this.assignmentGroupMemberships = JSON.parse(JSON.stringify(assignmentGroupMembershipsData));
  }
}

// Global singleton instance
export const repository = new ProjectDeliveryRepository();
