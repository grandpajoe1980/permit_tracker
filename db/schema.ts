import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ==========================================
// 1. ORGANIZATIONS, JURISDICTIONS & HIERARCHY
// ==========================================

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. 'DOTD', 'LDEQ', 'CPRA', 'USACE'
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  jurisdictionLevel: text("jurisdiction_level", {
    enum: ["State", "Federal", "Local / Parish", "Utility / Regional", "Applicant"],
  }).notNull(),
  parentOrgId: text("parent_org_id"),
  websiteUrl: text("website_url"),
  permitPortalUrl: text("permit_portal_url"),
  generalContactEmail: text("general_contact_email"),
  projectLiaisonName: text("project_liaison_name"),
  projectLiaisonEmail: text("project_liaison_email"),
  projectLiaisonPhone: text("project_liaison_phone"),
  executiveEscalationName: text("executive_escalation_name"),
  executiveEscalationEmail: text("executive_escalation_email"),
  workingHours: text("working_hours").default("Mon-Fri 8:00 AM - 4:30 PM CST"),
  holidayCalendar: text("holiday_calendar").default("Louisiana State Legal Holidays"),
  defaultSlaDays: integer("default_sla_days").default(30),
  statutoryAuthority: text("statutory_authority"),
  geographicCoverage: text("geographic_coverage"),
  documentRetentionYears: integer("document_retention_years").default(10),
  externalSystemName: text("external_system_name"),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const organizationalUnits = sqliteTable("organizational_units", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(), // e.g. "District 03", "Industrial Wastewater Unit", "Structures Review Team"
  code: text("code").notNull(),
  parentUnitId: text("parent_unit_id"),
  leadName: text("lead_name"),
  leadEmail: text("lead_email"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  title: text("title"),
  phone: text("phone"),
  organizationId: text("organization_id").references(() => organizations.id),
  unitId: text("unit_id").references(() => organizationalUnits.id),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const organizationMemberships = sqliteTable("organization_memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  roleTitle: text("role_title").notNull(), // e.g. "DOTD Bridge Reviewer", "CPRA Coastal Permitting Lead"
  capabilityScope: text("capability_scope").notNull(), // JSON array of capabilities: ["review_docs", "create_rfi", "approve_engineering"]
  jurisdictionScope: text("jurisdiction_scope"), // e.g. "District 03 - Vermilion & Iberia"
  isPrimary: integer("is_primary", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 2. PERMIT / AUTHORIZATION CATALOG & RESOURCES
// ==========================================

export const permitTypes = sqliteTable("permit_types", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "USACE-404", "LDEQ-LPDES", "CPRA-CUP", "DOTD-HEAVYHAUL"
  name: text("name").notNull(), // e.g. "USACE Section 404 Wetland Authorization"
  category: text("category").notNull(), // "permit", "road", "utility", "public_safety", "workforce", "community"
  responsibleOrgId: text("responsible_org_id")
    .notNull()
    .references(() => organizations.id),
  triggerExplanation: text("trigger_explanation").notNull(),
  statutoryCitation: text("statutory_citation").notNull(), // e.g. "33 U.S.C. § 1344; LAC 33:IX"
  officialFilingUrl: text("official_filing_url"),
  applicationFormUrl: text("application_form_url"),
  instructionsUrl: text("instructions_url"),
  expectedLeadTimeDays: integer("expected_lead_time_days").notNull(),
  minimumStatutoryDays: integer("minimum_statutory_days").default(0).notNull(),
  publicNoticeRequired: integer("public_notice_required", { mode: "boolean" }).default(false).notNull(),
  publicNoticeDays: integer("public_notice_days").default(0).notNull(),
  prerequisites: text("prerequisites"), // JSON array of string requirements
  relatedPermitTypeIds: text("related_permit_type_ids"), // JSON array of related permit codes
  lastVerifiedAt: text("last_verified_at"),
  lastVerifiedByUserId: text("last_verified_by_user_id").references(() => users.id),
  verificationStatus: text("verification_status", {
    enum: ["verified", "verification_due", "stale_over_180d"],
  }).default("verified").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const requirementResources = sqliteTable("requirement_resources", {
  id: text("id").primaryKey(),
  permitTypeId: text("permit_type_id")
    .notNull()
    .references(() => permitTypes.id),
  resourceName: text("resource_name").notNull(), // e.g. "Form ENG 4345 Application Package"
  resourceType: text("resource_type", {
    enum: ["form_pdf", "portal_url", "guidance_doc", "checklist", "statute_link"],
  }).notNull(),
  url: text("url").notNull(),
  supersededUrl: text("superseded_url"),
  versionTag: text("version_tag").default("v1.0").notNull(),
  effectiveDate: text("effective_date"),
  verifiedAt: text("verified_at").notNull(),
  verifiedBy: text("verified_by").notNull(),
  instructions: text("instructions"),
  sourceAuthority: text("source_authority"),
  isStale: integer("is_stale", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 3. WORKFLOW TEMPLATES, VERSIONS & STAGES
// ==========================================

export const workflowTemplates = sqliteTable("workflow_templates", {
  id: text("id").primaryKey(),
  permitTypeId: text("permit_type_id")
    .notNull()
    .references(() => permitTypes.id),
  name: text("name").notNull(), // e.g. "Coastal Use Permit Standard Review"
  description: text("description"),
  activeVersionNumber: integer("active_version_number").default(1).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const workflowVersions = sqliteTable("workflow_versions", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => workflowTemplates.id),
  versionNumber: integer("version_number").notNull(),
  status: text("status", { enum: ["draft", "published", "retired"] }).notNull(),
  effectiveDate: text("effective_date"),
  publishedAt: text("published_at"),
  publishedByUserId: text("published_by_user_id").references(() => users.id),
  changeSummary: text("change_summary"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const workflowStages = sqliteTable("workflow_stages", {
  id: text("id").primaryKey(),
  workflowVersionId: text("workflow_version_id")
    .notNull()
    .references(() => workflowVersions.id),
  stageKey: text("stage_key").notNull(), // e.g. "intake", "completeness_review", "technical_review", "public_notice", "decision", "issued"
  name: text("name").notNull(),
  internalDescription: text("internal_description"),
  customerVisibilityLabel: text("customer_visibility_label").notNull(), // e.g. "Technical Review"
  sequenceOrder: integer("sequence_order").notNull(),
  responsibleOrgId: text("responsible_org_id")
    .notNull()
    .references(() => organizations.id),
  responsibleUnitId: text("responsible_unit_id").references(() => organizationalUnits.id),
  targetDurationDays: integer("target_duration_days").notNull(),
  minimumStatutoryDays: integer("minimum_statutory_days").default(0).notNull(),
  requiredInputs: text("required_inputs"), // JSON array: ["site_plans", "wetlands_delineation", "mitigation_proposal"]
  completionRequirements: text("completion_requirements"), // JSON array: ["completeness_checklist_passed", "engineering_signoff"]
  permittedTransitions: text("permitted_transitions"), // JSON array: ["complete", "rfi", "reject", "return_to_applicant"]
  canRunInParallel: integer("can_run_in_parallel", { mode: "boolean" }).default(false).notNull(),
  isMilestoneGate: integer("is_milestone_gate", { mode: "boolean" }).default(false).notNull(),
  externalFilingUrl: text("external_filing_url"),
  legalAuthorityCitation: text("legal_authority_citation"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const escalationPolicies = sqliteTable("escalation_policies", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  warningThresholdPercent: integer("warning_threshold_percent").default(75).notNull(), // Day 8 of 10
  supervisorEscalationDays: integer("supervisor_escalation_days").default(10).notNull(),
  liaisonEscalationDays: integer("liaison_escalation_days").default(12).notNull(),
  stateProjectOfficeDays: integer("state_project_office_days").default(15).notNull(),
  criticalPathVarianceTriggerDays: integer("critical_path_variance_trigger_days").default(5).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 4. PROJECTS, WORKSTREAMS & EXECUTION GRAPH
// ==========================================

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "SPACEX-PECAN-ISLAND"
  name: text("name").notNull(), // "SpaceX Pecan Island Launch Complex"
  applicantOrgId: text("applicant_org_id")
    .notNull()
    .references(() => organizations.id),
  leadStateAgencyId: text("lead_state_agency_id")
    .notNull()
    .references(() => organizations.id),
  stateProjectManagerId: text("state_project_manager_id").references(() => users.id),
  customerProgramManagerId: text("customer_program_manager_id").references(() => users.id),
  locationDescription: text("location_description").notNull(),
  parish: text("parish").notNull(), // "Vermilion Parish"
  baselineLaunchDate: text("baseline_launch_date").notNull(),
  currentForecastLaunchDate: text("current_forecast_launch_date").notNull(),
  scheduleVarianceDays: integer("schedule_variance_days").default(0).notNull(),
  overallRagHealth: text("overall_rag_health", { enum: ["green", "yellow", "red"] }).default("green").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const workstreams = sqliteTable("workstreams", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  code: text("code").notNull(), // e.g. "WS-WETLANDS-PAD-A", "WS-LA82-HEAVYHAUL"
  title: text("title").notNull(),
  category: text("category").notNull(), // "permit", "road", "utility", "public_safety", "workforce", "community"
  permitTypeId: text("permit_type_id").references(() => permitTypes.id),
  workflowVersionId: text("workflow_version_id").references(() => workflowVersions.id),
  currentStageId: text("current_stage_id").references(() => workflowStages.id),
  
  // Dual ownership model:
  governmentConciergeUserId: text("government_concierge_user_id").references(() => users.id), // State-side coordinator
  regulatoryLeadOrgId: text("regulatory_lead_org_id")
    .notNull()
    .references(() => organizations.id), // e.g. USACE or DOTD
  assignedReviewerUserId: text("assigned_reviewer_user_id").references(() => users.id),
  
  // State & Health decoupling
  operationalState: text("operational_state", {
    enum: [
      "running",
      "waiting_government",
      "waiting_applicant",
      "waiting_external",
      "scheduled_hold",
      "statutory_waiting_period",
      "blocked",
      "escalated",
      "complete",
      "cancelled",
    ],
  }).default("running").notNull(),
  ragHealth: text("rag_health", { enum: ["green", "yellow", "red"] }).default("green").notNull(),
  isCriticalPath: integer("is_critical_path", { mode: "boolean" }).default(false).notNull(),
  
  // Schedule dates
  baselineStartDate: text("baseline_start_date").notNull(),
  baselineTargetDate: text("baseline_target_date").notNull(),
  forecastStartDate: text("forecast_start_date").notNull(),
  forecastTargetDate: text("forecast_target_date").notNull(),
  actualStartDate: text("actual_start_date"),
  actualCompletionDate: text("actual_completion_date"),
  scheduleVarianceDays: integer("schedule_variance_days").default(0).notNull(),
  controllingDependencyId: text("controlling_dependency_id"),
  
  // Deterministic 6-question fields
  currentActionSummary: text("current_action_summary").notNull(), // "Completeness & hydrology review"
  waitingReason: text("waiting_reason"), // e.g. "Waiting on CPRA drainage concurrence model"
  waitingOnEntity: text("waiting_on_entity"), // "CPRA Coastal Permits"
  nextExpectedEvent: text("next_expected_event").notNull(), // "Completeness determination"
  customerActionRequired: text("customer_action_required"), // "None" or "Submit bridge load calculation"
  
  // Delay accounting
  primaryDelayReason: text("primary_delay_reason", {
    enum: [
      "applicant_information",
      "agency_workload",
      "interagency_dependency",
      "statutory_minimum",
      "public_comment",
      "engineering_change",
      "environmental_discovery",
      "legal_challenge",
      "third_party_utility",
      "weather",
      "procurement",
      "scheduling",
      "none",
    ],
  }).default("none"),
  delayNotes: text("delay_notes"),
  
  // Escalation status
  escalationLevel: integer("escalation_level").default(0).notNull(), // 0 = none, 1 = warning, 2 = supervisor, 3 = liaison, 4 = state office, 5 = exec
  escalationTriggeredAt: text("escalation_triggered_at"),
  escalationSummary: text("escalation_summary"),

  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  workstreamId: text("workstream_id")
    .notNull()
    .references(() => workstreams.id),
  stageId: text("stage_id").references(() => workflowStages.id),
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type", {
    enum: ["agency_review", "applicant_action", "consultation", "public_notice", "inspection", "determination"],
  }).notNull(),
  assignedOrgId: text("assigned_org_id")
    .notNull()
    .references(() => organizations.id),
  assignedUserId: text("assigned_user_id").references(() => users.id),
  status: text("status", {
    enum: ["pending", "in_progress", "waiting", "blocked", "completed", "waived"],
  }).default("pending").notNull(),
  isMilestone: integer("is_milestone", { mode: "boolean" }).default(false).notNull(),
  isCriticalPath: integer("is_critical_path", { mode: "boolean" }).default(false).notNull(),
  baselineStartDate: text("baseline_start_date"),
  baselineDueDate: text("baseline_due_date"),
  forecastStartDate: text("forecast_start_date"),
  forecastDueDate: text("forecast_due_date"),
  actualCompletionDate: text("actual_completion_date"),
  durationDays: integer("duration_days").default(5).notNull(),
  floatDays: integer("float_days").default(0).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const taskDependencies = sqliteTable("task_dependencies", {
  id: text("id").primaryKey(),
  predecessorTaskId: text("predecessor_task_id")
    .notNull()
    .references(() => tasks.id),
  successorTaskId: text("successor_task_id")
    .notNull()
    .references(() => tasks.id),
  dependencyType: text("dependency_type", {
    enum: ["finish_to_start", "start_to_start", "finish_to_finish"],
  }).default("finish_to_start").notNull(),
  gateType: text("gate_type", { enum: ["AND", "OR"] }).default("AND").notNull(),
  lagDays: integer("lag_days").default(0).notNull(),
  isControlling: integer("is_controlling", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 5. FIRST-CLASS COMMITMENT OBJECT
// ==========================================

export const commitments = sqliteTable("commitments", {
  id: text("id").primaryKey(),
  workstreamId: text("workstream_id")
    .notNull()
    .references(() => workstreams.id),
  committingOrgId: text("committing_org_id")
    .notNull()
    .references(() => organizations.id),
  madeByUserId: text("made_by_user_id").references(() => users.id),
  madeByPersonName: text("made_by_person_name").notNull(),
  committedAction: text("committed_action").notNull(), // e.g. "Return consolidated drainage technical comments"
  originContext: text("origin_context").notNull(), // e.g. "Aug 29 Interagency Coordination Meeting"
  committedDate: text("committed_date").notNull(),
  promisedDueDate: text("promised_due_date").notNull(),
  completedDate: text("completed_date"),
  status: text("status", { enum: ["on_track", "at_risk", "fulfilled", "missed", "waived"] })
    .default("on_track")
    .notNull(),
  impactIfMissed: text("impact_if_missed").notNull(), // e.g. "LDEQ permit submission slips 7 calendar days"
  isCriticalPathImpact: integer("is_critical_path_impact", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 6. INTERAGENCY COORDINATION REQUESTS (CR-00xxx) & RFIs
// ==========================================

export const coordinationRequests = sqliteTable("coordination_requests", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "CR-00451"
  workstreamId: text("workstream_id")
    .notNull()
    .references(() => workstreams.id),
  requestingOrgId: text("requesting_org_id")
    .notNull()
    .references(() => organizations.id),
  targetOrgId: text("target_org_id")
    .notNull()
    .references(() => organizations.id),
  requestingUserId: text("requesting_user_id").references(() => users.id),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id),
  title: text("title").notNull(), // "Drainage & Hydrology Concurrence"
  needDescription: text("need_description").notNull(),
  requestedDate: text("requested_date").notNull(),
  dueDate: text("due_date").notNull(),
  responseDate: text("response_date"),
  attachedDocumentVersionIds: text("attached_document_version_ids"), // JSON array
  blocksWorkstreamTitle: text("blocks_workstream_title").notNull(), // "DOTD Heavy-Haul Bridge Improvement"
  priority: text("priority", { enum: ["normal", "high", "critical_path"] }).default("normal").notNull(),
  status: text("status", { enum: ["pending", "in_review", "concurred", "objection_raised", "closed"] })
    .default("pending")
    .notNull(),
  responseSummary: text("response_summary"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const rfis = sqliteTable("rfis", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // e.g. "RFI-2026-0042"
  workstreamId: text("workstream_id")
    .notNull()
    .references(() => workstreams.id),
  requestingOrgId: text("requesting_org_id")
    .notNull()
    .references(() => organizations.id),
  recipientOrgId: text("recipient_org_id")
    .notNull()
    .references(() => organizations.id),
  title: text("title").notNull(),
  questionText: text("question_text").notNull(),
  technicalReason: text("technical_reason").notNull(),
  requiredDocumentTypes: text("required_document_types"), // JSON array
  issuedDate: text("issued_date").notNull(),
  responseDeadline: text("response_deadline").notNull(),
  clockImpact: text("clock_impact", { enum: ["clock_paused", "clock_running", "clock_extended"] }).notNull(),
  scheduleImpactDays: integer("schedule_impact_days").default(0).notNull(),
  status: text("status", {
    enum: ["staged_draft", "issued", "partially_answered", "submitted_by_applicant", "accepted", "rejected", "withdrawn"],
  }).default("issued").notNull(),
  isConsolidatedCycle: integer("is_consolidated_cycle", { mode: "boolean" }).default(false).notNull(),
  consolidatedBatchId: text("consolidated_batch_id"),
  leadReviewerApprovedAt: text("lead_reviewer_approved_at"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const rfiResponses = sqliteTable("rfi_responses", {
  id: text("id").primaryKey(),
  rfiId: text("rfi_id")
    .notNull()
    .references(() => rfis.id),
  submittedByUserId: text("submitted_by_user_id").references(() => users.id),
  responseText: text("response_text").notNull(),
  attachedDocumentVersionIds: text("attached_document_version_ids"),
  submittedAt: text("submitted_at").notNull(),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewDecision: text("review_decision", { enum: ["accepted", "clarification_needed", "rejected"] }),
  reviewNotes: text("review_notes"),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 7. PROJECT DOCUMENT VAULT & REVISIONING
// ==========================================

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(), // e.g. "Drainage & Hydrology Study"
  category: text("category").notNull(), // "engineering_drawing", "environmental_study", "application_package", "permit_determination"
  ownerOrgId: text("owner_org_id")
    .notNull()
    .references(() => organizations.id),
  currentVersionNumber: integer("current_version_number").default(1).notNull(),
  isConfidential: integer("is_confidential", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const documentVersions = sqliteTable("document_versions", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id),
  versionTag: text("version_tag").notNull(), // e.g. "v8.0", "v9.0"
  fileName: text("file_name").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  mimeType: text("mime_type").notNull(),
  storageUri: text("storage_uri").notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  uploadedByUserId: text("uploaded_by_user_id").references(() => users.id),
  changeSummary: text("change_summary"),
  isMalwareClean: integer("is_malware_clean", { mode: "boolean" }).default(true).notNull(),
  uploadedAt: text("uploaded_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const documentAgencyReviews = sqliteTable("document_agency_reviews", {
  id: text("id").primaryKey(),
  documentVersionId: text("document_version_id")
    .notNull()
    .references(() => documentVersions.id),
  workstreamId: text("workstream_id")
    .notNull()
    .references(() => workstreams.id),
  reviewingOrgId: text("reviewing_org_id")
    .notNull()
    .references(() => organizations.id),
  reviewStatus: text("review_status", { enum: ["under_review", "approved", "revisions_requested", "waived"] }).notNull(),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  decisionDate: text("decision_date"),
  reviewComments: text("review_comments"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 8. DECISIONS, MEETINGS & PRE-APPLICATION
// ==========================================

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  decisionDate: text("decision_date").notNull(),
  title: text("title").notNull(), // e.g. "CPRA and USACE Concurrent Review Determination"
  decisionSummary: text("decision_summary").notNull(),
  decisionMakerName: text("decision_maker_name").notNull(),
  decisionMakerTitle: text("decision_maker_title").notNull(),
  organizationsRepresented: text("organizations_represented").notNull(), // JSON array: ["DOTD", "CPRA", "USACE", "Governor's Office"]
  statutoryAuthority: text("statutory_authority").notNull(),
  affectedWorkstreamIds: text("affected_workstream_ids").notNull(), // JSON array
  referencedDocumentVersionIds: text("referenced_document_version_ids"),
  requiredFollowUps: text("required_follow_ups"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  title: text("title").notNull(), // e.g. "Weekly Interagency Delivery Standup"
  meetingDate: text("meeting_date").notNull(),
  locationOrLink: text("location_or_link").notNull(),
  attendeeList: text("attendee_list").notNull(), // JSON array of names/orgs
  meetingNotes: text("meeting_notes").notNull(),
  relatedWorkstreamIds: text("related_workstream_ids"), // JSON array
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const readinessChecklists = sqliteTable("readiness_checklists", {
  id: text("id").primaryKey(),
  workstreamId: text("workstream_id")
    .notNull()
    .references(() => workstreams.id),
  phase: text("phase").default("pre_application").notNull(),
  overallReadinessPercent: integer("overall_readiness_percent").notNull(),
  targetFilingDate: text("target_filing_date"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const readinessItems = sqliteTable("readiness_items", {
  id: text("id").primaryKey(),
  checklistId: text("checklist_id")
    .notNull()
    .references(() => readinessChecklists.id),
  itemName: text("item_name").notNull(), // e.g. "Engineering Drawings", "Wetland Delineation", "Alternatives Analysis"
  status: text("status", { enum: ["ready", "underway", "missing", "waived"] }).notNull(),
  assignedParty: text("assigned_party").notNull(), // "SpaceX" or "Consultant" or "Agency"
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

// ==========================================
// 9. IMMUTABLE AUDIT EVENT LEDGER & NOTIFICATIONS
// ==========================================

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // "workstream", "task", "rfi", "commitment", "decision", "workflow_version", "document"
  entityId: text("entity_id").notNull(),
  actorUserId: text("actor_user_id"),
  actorName: text("actor_name").notNull(),
  actorOrgName: text("actor_org_name").notNull(),
  actionType: text("action_type").notNull(), // "status_changed", "assigned", "rfi_issued", "commitment_made", "escalated", "workflow_modified"
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  sourceChannel: text("source_channel").default("web_app").notNull(),
  occurredAt: text("occurred_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientUserId: text("recipient_user_id").references(() => users.id),
  recipientOrgId: text("recipient_org_id").references(() => organizations.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  urgency: text("urgency", { enum: ["info", "action_required", "critical_blocker"] }).default("info").notNull(),
  relatedEntityId: text("related_entity_id"),
  isRead: integer("is_read", { mode: "boolean" }).default(false).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

