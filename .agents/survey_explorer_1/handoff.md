# Handoff Report — Data Model & Persistence Architecture

**Agent:** `survey_explorer_1` (Role: Data Model & Persistence Explorer)  
**Parent Agent:** `6c0c2ad6-b060-4ca1-812d-09c87e71801e` (`parent`)  
**Working Directory:** `/Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_1`  
**Detailed Analysis Path:** `/Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_1/analysis.md`  
**Handoff Type:** Hard (Survey Task Complete)  

---

## 1. Observation

1. **Database Migrations & Schema**:
   - 29 SQL migrations exist in `supabase/migrations/` (from `20260828170355_initial_path_mvp.sql` to `20260830240000_enforce_mandatory_task_dependencies.sql`).
   - Tables defined: `organizations`, `customer_organizations`, `profiles`, `user_profiles`, `organization_memberships`, `projects`, `project_participants`, `workflow_definitions`, `workflow_versions`, `workflow_version_stages`, `workflow_stages`, `workflow_transitions`, `stage_runs`, `workflow_checklist_items`, `permit_types`, `requirement_resources`, `workstreams`, `tasks`, `task_dependencies`, `commitments`, `coordination_requests`, `rfis`, `rfi_responses`, `documents`, `document_versions`, `document_agency_reviews`, `decisions`, `meetings`, `audit_events`, `notifications`, `customer_requests`, `external_filings`, `requests`, `assignments`, `case_workflows`.
   - Security primitives in schema `app_private`: `is_system_admin()`, `is_org_member(uuid)`, `is_organization_admin(uuid)`, `is_customer_org_member(uuid)`, `can_access_project(uuid)`, `can_access_request(uuid)`.
   - Storage bucket: `path-documents` is private with RLS write/read policies for `authenticated`.

2. **TypeScript Domain Models**:
   - `lib/domain-models.ts` defines 28 core domain interfaces (`OrganizationRecord`, `WorkstreamRecord`, `TaskRecord`, `TaskDependencyRecord`, `CoordinationRequestRecord`, `RFIRecord`, `DocumentRecord`, `DocumentVersionRecord`, `DocumentAgencyReviewRecord`, `CustomerRequestRecord`, `WorkflowTemplateRecord`, etc.).
   - `db/schema.ts` provides Drizzle table definitions.

3. **Repository & Offline Fallback**:
   - `lib/repository.ts` defines `ProjectDeliveryRepository` with dual operational modes:
     - When connected to Supabase (`isSupabaseConfigured()`), `hydrateFromSupabase()` loads live relational rows and mutation methods invoke database RPCs in `lib/supabase/mutations.ts`.
     - When offline or in demo mode (`allowsFixtureData()`), in-memory state is seeded from `lib/spacex-megaproject-fixture.ts` (9 workstreams, 8 documents, 6 commitments, 3 coordination requests, 2 RFIs), `lib/customer-portal.ts` (8 profiles, 8 participants), and `lib/demo-data.ts`.

4. **Multi-Tenancy Observations**:
   - Organizations: SpaceX (`SPACEX` as Applicant company), Governor's Project Office (`LA-PROJECTS` / `STATEPO`), DOTD, LDEQ, CPRA, USACE, OSFM, LSP, Vermilion Parish, LED.
   - Dual Ownership on workstreams: `governmentConcierge` (State Project Office coordinator) + `regulatoryLead` (Agency reviewing engineer).
   - **Gaps**: No `assignment_groups` table exists in Supabase. Tickets and workstreams lack an `assignment_group_id` / `assigned_to` dual routing pair.

5. **ITSM Lifecycle States & Workflow Editing Observations**:
   - Disparate status fields: `customer_requests.status` (`draft`, `submitted`, `triage`, `in_progress`, `resolved`, `closed`), `workstreams.operational_state` (`running`, `waiting_government`, `waiting_applicant`, `waiting_external`, `scheduled_hold`, `statutory_waiting_period`, `blocked`, `escalated`, `complete`, `cancelled`), `ServiceRequest.status` (`in-review`, `action-needed`, `hearing`, `approved`).
   - Workflow editing in `WorkflowDesignerPanel.tsx` is template-scoped (`workflow_versions` / `workflow_version_stages`) and only edits global drafts for future workstreams. There is no in-ticket interactive workflow DAG modification engine on active workstreams.

---

## 2. Logic Chain

1. **From Observation 1 & 4 (Database Schema & Tenancy)**:
   - *Premise*: Standard ITSM systems (e.g. ServiceNow, Jira Service Management) route work orders to Assignment Groups (e.g. Structural Review, Environmental Compliance, Maritime Clearances) before individual fulfiller pickup.
   - *Observation*: The database has `organizations` and `users`, but lacks `assignment_groups` and `assignment_group_memberships`.
   - *Conclusion*: A new migration is required to create `assignment_groups` and `assignment_group_memberships`, and to add `assignment_group_id` and `assigned_to_user_id` foreign keys to `customer_requests` and `workstreams`.

2. **From Observation 5 (ITSM States & Workflow Editing)**:
   - *Premise*: Fulfillers and state workers need to triage tickets through standardized ITSM states and interactively edit the workflow DAG on a ticket instance.
   - *Observation*: Current UI restricts workflow editing to global templates; tickets use fragmented status enumerations.
   - *Conclusion*: 
     a. Consolidate ticket status into standard ITSM states (`Draft`, `Submitted/New`, `Triaged`, `In Progress`, `Pending Customer/Info`, `Pending Agency Concurrence`, `Blocked/Suspended`, `Resolved`, `Closed/Issued`).
     b. Create PostgreSQL RPC functions (`rpc_modify_workstream_workflow` / `rpc_reorder_workstream_tasks`) and UI components allowing authorized fulfillers to add milestones, reorder dependencies, reassign step fulfillers, and toggle step states directly on active tickets.

3. **From Observation 3 & 6 (Document Management)**:
   - *Premise*: Document vault and ticket attachments must provide reliable downloads without mock blob generation or broken links.
   - *Observation*: `lib/document-download-utils.ts` and `lib/supabase/storage.ts` have robust SHA-256 and Storage bucket plumbing, but require seamless signed URL fallback and direct stream downloads across customer and agency cockpits.
   - *Conclusion*: Ensure all document download buttons hook directly into `downloadDocumentVersion` with signed URL and storage bucket resolution.

---

## 3. Caveats

1. **Active Realtime Subscriptions**: `app/page.tsx` subscribes to Supabase Realtime channel `public-db-realtime-changes`. In offline demo mode, realtime events are simulated locally through `mutationVersion` state triggers.
2. **Backward Compatibility**: Existing tests (`tests/*.test.mjs`) rely on fixture workstream codes (`WS-LA82-HEAVYHAUL`, `WS-WETLANDS-PAD-A`, etc.) and legacy project identifier `PRJ-PECAN-2026`. Any schema additions must preserve backward compatibility with existing test assertions and seeded project references (`lib/project-identifiers.ts`).

---

## 4. Conclusion

The current data model and persistence foundation in PATH is robust and well-architected for megaproject coordination, but requires targeted extensions to achieve complete ITSM and interactive project management capabilities:
1. Introduce **Assignment Groups & Fulfiller Queues** in the database schema and TypeScript domain models.
2. Implement **In-Ticket Workflow DAG Customization** via dedicated PostgreSQL RPCs and an interactive node/step editor component on active tickets.
3. Standardize **ITSM Lifecycle States** across customer intake, workstreams, and fulfiller queues.
4. Ensure **Document Download End-to-End Reliability** across all UI touchpoints.

---

## 5. Verification Method

To independently verify these findings:
1. **Inspect Supabase Migrations & Schema**:
   ```bash
   grep -rn "CREATE TABLE" supabase/migrations/
   node scripts/inspect-db-schema.mjs
   ```
2. **Inspect Domain Models & Interfaces**:
   View `lib/domain-models.ts` and `db/schema.ts` to confirm existing entity types.
3. **Verify Repository Hydration & Tests**:
   ```bash
   npm test
   ```
   Execute the test suite to verify existing test pass rates and data mode behaviors.
