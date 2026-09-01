# Data Model, Persistence, Multi-Tenancy & ITSM/PM Architecture Analysis

**Author:** `survey_explorer_1` (Role: Data Model & Persistence Explorer)  
**Date:** 2026-08-31  
**Project:** Louisiana Project Delivery Command System (PATH Permit Application Tracker)  
**Corpus/Repo:** `/Users/joe/Repos/Permit/permit_tracker`  

---

## Executive Summary

The PATH platform features a rich, multi-layered data model combining statutory regulatory permitting workflows, interagency coordination, document cryptographic auditing, and project delivery command cockpits. 

The architecture is centered around **Supabase PostgreSQL** as the authoritative production persistence runtime (supported by 29 SQL migrations, PostgreSQL RPC transaction functions, and Row-Level Security policies), backed by a deterministic in-memory fixture and offline fallback repository (`ProjectDeliveryRepository`) for local/demo/test execution.

While the existing domain models and database migrations provide strong primitives for megaproject tracking (such as 9 workstreams for the SpaceX Pecan Island launch complex, interagency coordination requests, RFIs, and SHA-256 document versioning), significant structural gaps exist when evaluated against enterprise ITSM (IT Service Management) and interactive project management requirements. Specifically:
1. **Assignment Groups & Fulfiller Queues**: No first-class relational entity exists for assignment groups (e.g. Structural Review, Environmental Compliance, Maritime Clearances, Parish Permitting). Work is assigned at the agency level or directly to individual users.
2. **In-Ticket Dynamic Workflow DAG Modification**: Workflow editing is currently confined to global draft templates (`WorkflowDesignerPanel`), rather than allowing authorized state workers/fulfillers to dynamically modify, reorder, add/remove milestones, and update step assignees directly on an active ticket/workstream instance.
3. **ITSM Lifecycle State Unification**: Multiple disparate state enumerations exist (`CustomerRequestRecord.status`, `WorkstreamRecord.operationalState`, `ServiceRequest.status`, `requests.status`), requiring consolidation into standard ITSM lifecycle states (`Draft`, `Submitted/New`, `Triaged`, `In Progress`, `Pending Customer/Info`, `Pending Agency Concurrence`, `Blocked/Suspended`, `Resolved`, `Closed/Issued`).
4. **Document Preview & Download Reliability**: Strong SHA-256 and Storage bucket plumbing exists, but download operations across customer and agency views require guaranteed end-to-end blob/stream resolution with fallback mechanisms.

---

## 1. Existing Database Migrations, SQL Schemas & Supabase Setup

### 1.1 Supabase Client and Server Setup
- **Browser Client (`lib/supabase/client.ts`)**: Uses `@supabase/ssr` `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Server Client (`lib/supabase/server.ts`)**: Uses `createRequestSupabaseClient` with request cookie context so that PostgreSQL RLS policies evaluate `auth.uid()` against the authenticated session.
- **Service Role Client (`lib/supabase/client.ts`)**: Reserved exclusively for server-side seed, health checks, and elevated maintenance operations.
- **Data Mode Enforcement (`lib/data-mode.ts`)**: Controls whether mock fixtures are allowed (`allowsFixtureData()`) or whether production strictness is required (`requiresSupabase()`).

### 1.2 Migration Inventory & Relational Schema Topology
The repository contains 29 SQL migrations in `supabase/migrations/`:

| Migration File | Key Tables / Objects Created or Altered | Architectural Purpose |
|---|---|---|
| `20260828170355_initial_path_mvp.sql` | `organizations`, `customer_organizations`, `profiles`, `organization_memberships`, `projects`, `project_participants`, `workflow_definitions`, `workflow_stages`, `requests`, `case_workflows`, `assignments`, `documents`, `notifications`, `audit_events` | Initial MVP schema; tenant boundary helpers in `app_private` schema (`is_org_member`, `is_customer_org_member`, `can_access_project`). |
| `20260828190000_spacex_louisiana_workspace.sql` | Workspace seed & tenant setup | Initial seed for SpaceX Louisiana customer org and reviewing state agencies. |
| `20260830071223_command_system_relational_schema.sql` | `permit_types`, `requirement_resources`, `workflow_versions`, `workstreams`, `tasks`, `task_dependencies`, `coordination_requests`, `rfis`, `rfi_responses`, `document_versions`, `document_agency_reviews`, `commitments`, `decisions`, `meetings` | Core command system domain schema establishing workstreams, tasks (DAG nodes), task dependencies (DAG edges), RFIs, and commitments. |
| `20260830120000_customer_portal_delivery.sql` | `user_profiles`, `external_filings`, `customer_requests` | Customer intake request entities and external agency portal tracking. |
| `20260830150635_harden_command_system_rls_and_seed_portal_support.sql` | RLS hardening policies | Tightened write policies and user profile access boundaries. |
| `20260830180000_supabase_authoritative_persistence.sql` | Storage bucket `path-documents`, column expansions, RPC functions | Authoritative persistence migration with atomic RPCs: `rpc_create_customer_request`, `rpc_create_rfi`, `rpc_submit_rfi_response`, `rpc_accept_rfi_response`, `rpc_create_document_version`, `rpc_review_document_version`. |
| `20260830200000_workflow_execution_engine.sql` | `workflow_transitions`, `stage_runs`, `workflow_checklist_items`, `rpc_complete_workstream_stage` | Workstream workflow pinning, durable stage runs ledger, and server-side transition gates. |
| `20260830203000_workflow_designer_transactions.sql` | `workflow_version_stages`, draft RPCs | Immutable published workflows with draft authoring RPCs: `rpc_create_workflow_draft`, `rpc_update_workflow_draft_stage`, `rpc_validate_workflow_draft`, `rpc_publish_workflow_version`. |
| `20260830210000` & `20260830225000` | Triage RPCs | `rpc_create_workstream_from_request`, `rpc_triage_customer_request`. |
| `20260830213000` & `20260830214000` | Operational RPCs | `rpc_create_coordination_request`, `rpc_create_commitment`, `rpc_mark_workstream_blocked`, `rpc_clear_workstream_blocker`, `rpc_escalate_workstream`, `rpc_transfer_workstream`, `rpc_add_workstream_note`. |
| `20260830233000_customer_request_first_attachment.sql` | `rpc_create_customer_request_with_document` | Atomic transaction combining customer intake request, Storage upload, document parent, document version, audit event, and triage notification. |
| `20260830234000_scope_workflow_admin_by_organization.sql` | Organization-scoped admin functions | Restricts workflow administration to authorized agency administrators (`app_private.is_organization_admin`). |
| `20260830235000_persist_organization_member_roles.sql` | `rpc_set_organization_member_role` | Authenticated, audited role assignment function for organization administrators. |
| `20260830240000_enforce_mandatory_task_dependencies.sql` | Task dependency checks | Enforces DAG dependencies prior to task completion. |

### 1.3 Row-Level Security (RLS) & Security Functions
- All public tables have RLS enabled.
- Tenant isolation is enforced via helper functions in the `app_private` schema:
  - `app_private.is_system_admin()`: Verifies system administrator membership or metadata.
  - `app_private.is_org_member(p_org_id)`: Checks active membership in `organization_memberships`.
  - `app_private.is_organization_admin(p_org_id)`: Checks `role = 'organization_admin'` for the target agency.
  - `app_private.is_customer_org_member(p_customer_org_id)`: Verifies customer profile linkage.
  - `app_private.can_access_project(p_project_id)`: Checks customer membership, lead agency membership, or active `project_participants` record.
  - `app_private.can_access_request(p_request_id)`: Restricts request access to submitter, owning agency members, or project participants.
- Private Storage bucket `path-documents` is secured with RLS policies allowing authenticated users to upload, select, and update files under managed paths.

---

## 2. TypeScript Data Models and Interfaces

The TypeScript interfaces are primarily defined in `lib/domain-models.ts`, `lib/demo-data.ts`, `lib/operational-ux.ts`, and `db/schema.ts`.

### 2.1 Core Relational Entities (`lib/domain-models.ts`)
- **Organizations & Tenancy**:
  - `OrganizationRecord`: Represents state/federal agencies, local authorities, and applicant organizations (`id`, `code`, `name`, `jurisdictionLevel`, `projectLiaisonName`, `defaultSlaDays`, `statutoryAuthority`, etc.).
  - `UserProfileRecord`: Contact card and project role info (`userId`, `fullName`, `displayTitle`, `organizationId`, `organizationalUnit`, `workEmail`, `preferredContactMethod`, `isCustomerVisible`).
  - `OrganizationMembershipRecord`: Agency role assignment (`userId`, `organizationId`, `role`: `'contributor' | 'supervisor' | 'organization_admin' | 'system_admin'`, `status`, `effectiveFrom`).
  - `ProjectParticipantRecord`: Project-scoped participation and visibility controls (`projectId`, `userId`, `organizationId`, `projectRole`, `workstreamIds`, `assignedTaskIds`, `visibilityScope`: `'customer' | 'project' | 'agency' | 'admin'`).
- **Catalog & Workflows**:
  - `PermitTypeRecord`: Statutory permit catalog definition (`code`, `name`, `category`, `responsibleOrgCode`, `expectedLeadTimeDays`, `minimumStatutoryDays`, `publicNoticeRequired`, `statutoryCitation`, `filingMode`).
  - `WorkflowTemplateRecord`, `WorkflowVersionRecord`, `WorkflowStageRecord`: Hierarchical workflow versioning. Each stage has `stageKey`, `sequenceOrder`, `responsibleOrgCode`, `targetDurationDays`, `minimumStatutoryDays`, `requiredInputs`, `completionRequirements`, `permittedTransitions`, `canRunInParallel`, `isMilestoneGate`.
- **Workstreams, Tasks & Dependencies**:
  - `WorkstreamRecord`: Primary execution work item. Contains dual ownership (`governmentConcierge`, `regulatoryLead`), deterministic 6-question state fields (`currentActionSummary`, `waitingReason`, `waitingOnEntity`, `nextExpectedEvent`, `customerActionRequired`), schedule metrics (`baselineStartDate`, `baselineTargetDate`, `forecastStartDate`, `forecastTargetDate`, `scheduleVarianceDays`), health (`operationalState`, `ragHealth`, `isCriticalPath`), and embedded child arrays (`tasks`, `commitments`, `coordinationRequests`, `rfis`).
  - `TaskRecord`: Discrete DAG execution task (`taskType`, `assignedOrgCode`, `assignedUserId`, `status`: `'pending' | 'in_progress' | 'waiting' | 'blocked' | 'completed' | 'waived'`, `durationDays`, `floatDays`, `isCriticalPath`, `isMilestone`).
  - `TaskDependencyRecord`: Predecessor/successor edge (`dependencyType`: `'finish_to_start' | 'start_to_start' | 'finish_to_finish'`, `gateType`: `'AND' | 'OR'`, `lagDays`, `isControlling`).
- **Interagency Coordination & Accountability**:
  - `CoordinationRequestRecord` (`CR-00xxx`): Formal interagency request (`requestingOrgCode`, `targetOrgCode`, `title`, `needDescription`, `requestedDate`, `dueDate`, `priority`, `status`: `'pending' | 'in_review' | 'concurred' | 'objection_raised' | 'closed'`).
  - `RFIRecord` (`RFI-2026-xxxx`): Formal applicant request for information (`clockImpact`: `'clock_paused' | 'clock_running' | 'clock_extended'`, `status`: `'staged_draft' | 'issued' | 'submitted_by_applicant' | 'accepted' | 'rejected' | 'withdrawn'`).
  - `CommitmentRecord` (`COM-00xx`): First-class promise object (`committingOrgCode`, `madeByPersonName`, `committedAction`, `originContext`, `committedDate`, `promisedDueDate`, `status`: `'on_track' | 'at_risk' | 'fulfilled' | 'missed' | 'waived'`).
- **Documents & Cryptographic Auditing**:
  - `DocumentRecord` & `DocumentVersionRecord`: Multi-version document vault (`versionTag`, `fileName`, `fileSizeBytes`, `mimeType`, `storageUri`, `sha256Hash`, `uploadedByName`, `isMalwareClean`).
  - `DocumentAgencyReviewRecord`: Multi-agency signoff matrix per document version (`reviewingOrgCode`, `reviewStatus`: `'under_review' | 'approved' | 'revisions_requested' | 'waived'`).
  - `AuditEventRecord`: Immutable append-only audit trail (`entityType`, `entityId`, `actorName`, `actorOrgName`, `actionType`, `oldValue`, `newValue`, `reason`, `occurredAt`).
  - `NotificationRecord`: High-priority operational alerts and task notifications (`userId`, `title`, `message`, `type`, `urgency`, `linkUrl`, `isRead`).

---

## 3. Mock Data, State Stores, Repositories & Parity Analysis

### 3.1 Architecture of `ProjectDeliveryRepository` (`lib/repository.ts`)
- Implemented as a singleton repository class holding in-memory arrays for all domain entities, initialized from `spacex-megaproject-fixture.ts`, `customer-portal.ts`, and `demo-data.ts`.
- **Hydration Engine (`hydrateFromSupabase()`)**:
  - Calls 17 parallel query fetchers from `lib/supabase/queries.ts` (`fetchWorkstreams`, `fetchCustomerRequests`, `fetchExternalFilings`, `fetchRFIs`, `fetchCoordinationRequests`, `fetchCommitments`, `fetchDecisions`, `fetchMeetings`, `fetchDocuments`, `fetchUserProfiles`, `fetchOrganizationMemberships`, `fetchProjectParticipants`, `fetchNotifications`, `fetchAuditEvents`, `fetchCatalog`, `fetchOrganizations`, `fetchWorkflowTemplates`).
  - When connected to Supabase and rows are returned, it replaces in-memory mock data with live database records.
- **Dual Mutation Execution (`*Persisted` methods)**:
  - Each operational mutation checks `isSupabaseConfigured()`.
  - If Supabase is configured, it executes the PostgreSQL RPC via `lib/supabase/mutations.ts` (e.g. `mutateCreateCustomerRequestPersisted`, `mutateCompleteWorkstreamStagePersisted`, `mutateMarkWorkstreamBlockedPersisted`, `mutateReviewDocumentVersionPersisted`).
  - If offline or in test mode (`allowsFixtureData()`), it applies the mutation in-memory, logs an audit event, and dispatches a notification locally.

### 3.2 Mock Schema vs Supabase Schema Parity

| Domain Area | Mock / Fixture Representation | Supabase Database Table / Schema | Parity Status & Gaps |
|---|---|---|---|
| **Organizations** | `registeredOrganizations` (8 orgs: SPACEX, LA-PROJECTS, DOTD, LDEQ, CPRA, USACE, OSFM, VERMILION-PARISH) | `public.organizations` (UUID id, code, name, contacts jsonb) + `public.customer_organizations` | **Good Parity**: Mappings in `lib/supabase/mappings.ts` bridge string codes and UUIDs. |
| **Workstreams** | `workstreamsData` (9 detailed workstreams with nested `tasks`, `commitments`, etc.) | `public.workstreams` (UUID id, project_id, code, JSONB fields: `state_concierge`, `regulatory_lead`, `six_questions`, `active_blockers`) | **Good Parity**: Relational child tables (`tasks`, `commitments`) point to `workstreams.id`. |
| **Workflow Versions & Stages** | `workflowTemplatesData` with stages | `public.workflow_definitions`, `public.workflow_versions`, `public.workflow_version_stages`, `public.workflow_stages` | **Good Parity**: Versioning is preserved; draft authoring is isolated in `workflow_version_stages`. |
| **Document Vault** | `projectDocumentsData` (8 documents with versions and reviews) | `public.documents`, `public.document_versions`, `public.document_agency_reviews`, bucket `path-documents` | **High Parity**: SHA-256 checksums and multi-agency signoff matrices are strictly mirrored. |
| **Customer Requests** | `customerRequests` array in repository | `public.customer_requests` | **High Parity**: Direct mapping of confirmation numbers, attachments, and status. |
| **Assignment Groups** | Embedded in role/persona strings (e.g., "District 03 Aviation & Bridge Design", "Water Quality Division") | **Missing from Database**: No `assignment_groups` table exists. | **GAP**: No relational entity for assignment groups / queues. |
| **Organizational Units** | `organizationalUnits` defined in `db/schema.ts` | **Missing in Supabase**: Table not created in any SQL migration. | **GAP**: Stored only as unindexed text `user_profiles.organizational_unit`. |

---

## 4. Multi-Tenancy & Assignment Group Gap Analysis

### 4.1 Participating Organizations & Companies
The system models three tiers of organizations:
1. **Customer Companies**: SpaceX (`SPACEX` / `org-spacex`, `customer_organizations.name = 'SpaceX Louisiana'`).
2. **Lead State Coordination Authority**: Louisiana Governor's Office of Major Projects & Delivery (`LA-PROJECTS` / `STATEPO` / `org-state-po`), led by State PM / Concierge Sarah Johnson.
3. **Reviewing Agencies & Authorities**:
   - **DOTD**: Louisiana Department of Transportation & Development (`DOTD` / `org-dotd`) — heavy-haul, bridges, road access.
   - **LDEQ**: Louisiana Department of Environmental Quality (`LDEQ` / `org-ldeq`) — LPDES wastewater, air quality, environmental permits.
   - **CPRA**: Coastal Protection and Restoration Authority (`CPRA` / `org-cpra`) — Coastal Use Permits (CUP), coastal hydrology concurrence.
   - **USACE**: U.S. Army Corps of Engineers New Orleans District (`USACE` / `org-usace`) — Section 404 wetlands and dredging.
   - **OSFM**: Louisiana Office of State Fire Marshal (`OSFM` / `org-osfm`) — high-bay fire suppression, cryogenic safety, life safety codes.
   - **LSP**: Louisiana State Police (`LSP` / `org-lsp`) — traffic escorts, launch safety corridors.
   - **Vermilion Parish**: Vermilion Parish Police Jury (`VERMILION-PARISH` / `org-parish`) — local development permits, road closures, community water.
   - **LED**: Louisiana Economic Development (`LED` / `org-led`) — workforce training consortium and PATH administration.

### 4.2 Multi-Tenancy Gaps Identified

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         MULTI-TENANCY TOPOLOGY                          │
├────────────────────────────────┬─────────────────────────────────────────┤
│ EXISTING IMPLEMENTATION        │ REQUIRED ITSM TARGET                    │
├────────────────────────────────┼─────────────────────────────────────────┤
│ • Organization / Agency level  │ • Company / Agency level (Tenants)      │
│ • Direct User assignment only  │ • Assignment Groups (e.g. Structures,   │
│ • Broad Persona / Workspace    │   Water Quality, Coastal Review)        │
│   Modes (reviewer, supervisor, │ • Fulfillers & Reviewers assigned to    │
│   state_office, customer)      │   specific Assignment Groups            │
│ • Client-side UI filtering for │ • Dual Ticket Assignment Routing:       │
│   customer view isolation      │   [Assignment Group] + [Assigned To]    │
│ • No group triage queues       │ • Strict Fulfiller Queues & Round-Robin │
│                                │ • Customer Portal vs Internal Fulfiller │
│                                │   Work Notes separation                 │
└────────────────────────────────┴─────────────────────────────────────────┘
```

1. **Lack of `assignment_groups` Entity**:
   - Current tickets and workstreams have `assignedReviewerUserId` (nullable user UUID) and `regulatoryLead.orgCode` (agency code).
   - There is no intermediary entity representing specialized review queues within an agency (e.g. DOTD Bridge Bureau vs DOTD Hydraulics; LDEQ Industrial Wastewater vs LDEQ Air Permits; CPRA Coastal Permits vs CPRA Ecological Modeling).
2. **Fulfiller / State Worker Role Precision**:
   - Organization memberships support only coarse roles: `contributor`, `supervisor`, `organization_admin`, `system_admin`.
   - A state worker cannot belong to multiple specific functional assignment groups with distinct queue visibility.
3. **Internal vs Customer Work Notes**:
   - Currently, audit events and workstream notes are partially segregated via `isCustomer` checks in UI rendering, but the data model lacks an explicit `is_internal` or `customer_visible` flag on individual audit notes/comments.

---

## 5. ITSM Lifecycle States & PM Milestone / Critical Path Tracking Gaps

### 5.1 State Model Discrepancy & Alignment

Currently, the codebase uses four different state machines across different entities:
1. `customer_requests.status`: `draft` | `submitted` | `triage` | `in_progress` | `resolved` | `closed`
2. `workstreams.operational_state`: `running` | `waiting_government` | `waiting_applicant` | `waiting_external` | `scheduled_hold` | `statutory_waiting_period` | `blocked` | `escalated` | `complete` | `cancelled`
3. `requests.status` (legacy table): `draft` | `submitted` | `in_review` | `action_required` | `on_hold` | `completed` | `withdrawn` | `archived`
4. `ServiceRequest.status` (demo-data): `in-review` | `action-needed` | `hearing` | `approved`

#### Target ITSM State Alignment:
To meet standard ITSM ticketing standards, the lifecycle states across all work items must be standardized:

```
[Draft] ──► [Submitted / New] ──► [Triaged] ──► [In Progress] ──┬──► [Pending Customer / Info]
                                                     │         ├──► [Pending Agency Concurrence]
                                                     │         └──► [Blocked / Suspended]
                                                     ▼
                                              [Resolved] ──► [Closed / Issued]
```

- **Draft**: Work item or permit request initiated by customer or state worker, not yet submitted into the operational queue.
- **Submitted / New**: Formally submitted into the intake queue; statutory/target clock starts.
- **Triaged**: Intake verified by State Project Office / Agency Concierge and routed to the designated Assignment Group.
- **In Progress**: Active technical review underway by the assigned fulfiller.
- **Pending Customer / Info**: Review clock paused pending applicant response to an issued RFI or required submittal.
- **Pending Agency Concurrence**: Review waiting on formal concurrence or consultation from another agency (`CR-00xxx`).
- **Blocked / Suspended**: Review stopped due to an external impediment, legal hold, or severe roadblock requiring escalation.
- **Resolved**: Technical determination reached and approved by the lead reviewer.
- **Closed / Issued**: Final statutory authorization, permit document, or formal closure package signed and delivered.

### 5.2 Interactive In-Ticket Workflow DAG Modification Gaps

The original requirement specifies:
> *"Authorized roles (`state worker`, `reviewer`, `fulfiller`, `admin`) can click directly into the workflow on any ticket/workstream. Capability to modify workflow steps, insert custom milestones or sub-tasks, adjust step dependencies/order, update step owners/agencies, and change step states (`Active`, `Done`, `Blocked`, `Pending Hearing`, etc.) directly from the ticket view. Changes persist immediately to Supabase and update audit trails."*

#### Current Implementation vs Gap:
- **What Exists**:
  - `WorkflowDesignerPanel.tsx`: Allows an administrator to create a draft of a *global workflow template* (`WorkflowTemplateRecord`), edit stage labels, validate the draft, and publish a new version.
  - `WorkstreamGraphGantt.tsx`: Visualizes the 9 workstreams and tasks on a Gantt chart with interactive state filtering and simulation (`InteractiveScheduleSimulator.tsx`), but does NOT allow editing the tasks or step sequence of an individual ticket.
  - `app/projects/[projectNumber]/workstreams/[workstreamId]/page.tsx`: Simple static summary route.
- **What is Missing**:
  - **In-Ticket Workflow DAG Customization Engine**: An interactive workflow editor embedded directly inside the ticket / workstream detail view that allows fulfillers to:
    1. Insert new steps/milestones into an active ticket's execution sequence.
    2. Reorder step sequences and alter task dependencies (e.g. change finish-to-start to parallel start-to-start).
    3. Reassign step owner agency or specific fulfiller on a per-step basis.
    4. Transition individual step states (`Active`, `Done`, `Blocked`, `Pending Hearing`, `Waived`) with immediate Supabase persistence and audit logging.

### 5.3 PM Milestone & Critical Path Schedule Engine
- **Schedule Engine (`lib/engines/schedule-engine.ts`)**: Evaluates forward and backward pass critical path scheduling (Early Start, Early Finish, Late Start, Late Finish, Total Float).
- **Variance Drivers & RAG Decoupling**: Properly decouples operational state from RAG health (e.g., `statutory_waiting_period` is healthy green, while `blocked` on critical path is red).
- **Gap**: Dynamic updates made in an in-ticket workflow modification must immediately trigger schedule engine recalculation and persist updated float/variance metrics to Supabase.

---

## 6. Document Management & Download Reliability Analysis

- **Storage Structure**: Private Supabase bucket `path-documents` with RLS policies allowing authenticated uploads, reads, and updates.
- **Document Utilities (`lib/document-download-utils.ts` & `lib/supabase/storage.ts`)**:
  - `downloadDocumentVersion()` fetches bytes from Supabase Storage or data URL, validates byte length against `fileSizeBytes`, validates the SHA-256 hash against `sha256Hash`, and triggers a browser download via `triggerFileDownload()`.
  - `mutateUploadDocumentVersion()` performs atomic file upload, SHA-256 hashing, and PostgreSQL RPC invocation (`rpc_create_document_version`).
  - `mutateCreateCustomerRequestWithDocument()` handles multi-table atomic intake uploads via `rpc_create_customer_request_with_document`.
- **Reliability Assessment**:
  - Valid demo documents are present in `spacex-megaproject-fixture.ts` and `customer-portal.ts`.
  - Downloads work cleanly when connected to Storage, and the system correctly prohibits generating fake mock text blobs in production mode.

---

## 7. Recommended Data Architecture & Action Plan

To fulfill the requirements of `ORIGINAL_REQUEST.md`, the data model and persistence layer should be expanded with the following additions:

1. **Relational Schema Additions**:
   - `assignment_groups` table: `id`, `organization_id`, `code`, `name`, `description`, `lead_user_id`, `is_active`, `created_at`.
   - `assignment_group_memberships` table: `id`, `group_id`, `user_id`, `role`, `is_active`.
   - Add `assignment_group_id` and `assigned_to_user_id` to `customer_requests` and `workstreams`.
   - Standardize ITSM status columns with check constraints reflecting the 9 standardized ITSM states.
   - Add `is_internal` boolean flag to `audit_events` and workstream note comments.
2. **In-Ticket Workflow DAG RPC Functions**:
   - `rpc_modify_workstream_workflow`: Allows adding, removing, reordering, reassigning, or state-transitioning steps on a specific active ticket/workstream.
   - `rpc_recalculate_workstream_schedule`: Runs forward/backward pass schedule float recalculation following workflow modifications.
3. **TypeScript Model Extensions**:
   - Add `AssignmentGroupRecord` and `AssignmentGroupMembershipRecord` to `lib/domain-models.ts`.
   - Update `WorkstreamRecord` and `CustomerRequestRecord` with `assignmentGroupId`, `assignmentGroupCode`, `assignmentGroupName`, and `assignedToUserId`.
   - Update `ProjectDeliveryRepository` with assignment group query and mutation methods.
