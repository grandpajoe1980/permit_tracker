# PATH Supabase Durability & Cross-Browser Persistence Matrix

## 1. Executive Summary & Durability Gate

The **Louisiana Project Delivery Command System (PATH)** operates with **Supabase PostgreSQL and Supabase Storage as the sole authoritative runtime**. Local storage and fixture states are strictly non-authoritative fallback caches for offline/unit-test isolation.

Every mutation must satisfy the **Non-Negotiable Supabase Durability Gate**:
1. Mutation is committed to Supabase PostgreSQL and/or Supabase Storage.
2. The database commit is confirmed before UI reports success.
3. A clean browser session with cleared cookies/storage retrieves the change from Supabase.
4. Concurrent authorized browsers receive realtime updates via Supabase Realtime channels.
5. Unauthorized actors cannot retrieve or mutate records (enforced by RLS).
6. Immutable audit ledger events (`audit_events`) and notifications (`notifications`) are persisted for all domain actions.

---

## 2. PostgreSQL Relational Schema & Entity Matrix

| Entity | PostgreSQL Table | Primary Key | Key Relationships | RLS Policy Status |
| :--- | :--- | :--- | :--- | :--- |
| **Organizations** | `public.organizations` | `id` (text) | Parent org hierarchy | Authenticated read |
| **User Profiles** | `public.user_profiles` | `id` (text) | `user_id` -> `auth.users(id)` | User self-edit, Admin full |
| **Project Participants** | `public.project_participants` | `id` (uuid) | `project_id`, `user_id`, `organization_id` | Role-based visibility |
| **Workstreams** | `public.workstreams` | `id` (text) | `project_id`, `permit_type_id` | Project participant read/write |
| **Tasks** | `public.tasks` | `id` (text) | `workstream_id`, `assigned_user_id` | Authenticated read/write |
| **Customer Requests** | `public.customer_requests` | `id` (text) | `project_id`, `submitted_by_user_id` | Authenticated / Anon insert, Project read |
| **External Filings** | `public.external_filings` | `id` (text) | `workstream_id`, `authority_organization_id` | Authenticated read/write |
| **RFIs** | `public.rfis` | `id` (text) | `workstream_id`, `requesting_org_id` | Authenticated read/write |
| **RFI Responses** | `public.rfi_responses` | `id` (text) | `rfi_id` | Authenticated read/write |
| **Coordination Requests** | `public.coordination_requests` | `id` (text) | `workstream_id`, `target_org_id` | Authenticated read/write |
| **Commitments** | `public.commitments` | `id` (text) | `workstream_id`, `committing_org_id` | Authenticated read/write |
| **Documents** | `public.documents` | `id` (uuid) | `project_id`, `owner_organization_id` | Authenticated read/write |
| **Document Versions** | `public.document_versions` | `id` (text) | `document_ref_id`, storage bucket path | Authenticated read/write |
| **Agency Reviews** | `public.document_agency_reviews`| `id` (text) | `document_version_id` (FK) | Authenticated review signoff |
| **Decisions** | `public.decisions` | `id` (text) | `project_id` | Authenticated read |
| **Meetings** | `public.meetings` | `id` (text) | `project_id` | Authenticated read |
| **Permit Types** | `public.permit_types` | `id` (text) | `responsible_org_id` | Authenticated read |
| **Requirement Resources** | `public.requirement_resources` | `id` (text) | `permit_type_id` | Authenticated read |
| **Audit Ledger** | `public.audit_events` | `id` (uuid) | `actor_id`, `entity_type`, `entity_id` | Immutable append-only |
| **Notifications** | `public.notifications` | `id` (uuid) | `user_id`, `event_type` | User-scoped read/update |

---

## 3. Storage Architecture (`path-documents`)

- **Bucket Name**: `path-documents`
- **Visibility**: Private (Non-public)
- **Permissions**: `authenticated` and `anon` authenticated RLS policies
- **Naming Pattern**: `{documentId}/v{versionNumber}/{fileName}`
- **Integrity**: SHA-256 hash calculated on upload and stored with immutable version record
- **Download**: Short-lived signed URLs via `getSignedDocumentUrl(storagePath, expiresInSeconds)`

---

## 4. Atomic PostgreSQL RPC Functions

| Function Name | Parameters | Actions Executed Atomically |
| :--- | :--- | :--- |
| `rpc_create_customer_request` | `p_id`, `p_confirmation_number`, `p_project_id`, `p_request_type`, `p_title`, `p_description`, ... | Inserts `customer_requests`, logs `audit_events`, creates triage `notifications` |
| `rpc_create_rfi` | `p_id`, `p_code`, `p_workstream_id`, `p_question_text`, ... | Inserts `rfis`, pauses `workstreams.operational_state` (`waiting_applicant`), logs `audit_events` |
| `rpc_submit_rfi_response` | `p_id`, `p_rfi_id`, `p_submitted_by_user_name`, `p_response_text`, ... | Inserts `rfi_responses`, updates `rfis.status` (`submitted_by_applicant`), logs `audit_events` |
| `rpc_accept_rfi_response` | `p_rfi_id`, `p_actor_name`, `p_actor_org_name`, `p_notes` | Updates `rfi_responses.review_status` (`accepted`), updates `rfis.status`, resumes `workstreams.operational_state` (`running`), logs `audit_events` |
| `rpc_create_document_version` | `p_version_id`, `p_document_id`, `p_version_number`, `p_storage_path`, `p_sha256_hash`, `p_reviewing_agency_codes`, ... | Inserts `document_versions`, creates child `document_agency_reviews` rows, logs `audit_events` |
| `rpc_review_document_version` | `p_version_id`, `p_agency_code`, `p_decision`, `p_actor_name`, `p_comments` | Updates `document_agency_reviews.status`, checks multi-agency consensus to update `document_versions.status`, logs `audit_events` |

---

## 5. Cross-Browser Multi-Context Verification Matrix

| Scenario ID | Test Name | Mutation Context | Verification Context | Assertions | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SCEN-01** | Dual-User Customer Request Propagation | Browser 1: SpaceX PM (Maya Chen) submits service request | Browser 2: State PM (Sarah Johnson) with clean storage | Row in `customer_requests`, notification in `notifications`, audit in `audit_events` | **PASS** |
| **SCEN-02** | RFI Creation & Workstream Clock Pause | Browser 1: CPRA Reviewer (Jordan Lee) issues RFI | Browser 2: SpaceX PM (Maya Chen) | `workstreams.operational_state` is `waiting_applicant`, RFI visible to SpaceX | **PASS** |
| **SCEN-03** | RFI Response Submission | Browser 1: SpaceX PM (Maya Chen) submits response | Browser 2: CPRA Reviewer (Jordan Lee) | `rfi_responses` created, `rfis.status` updated to `submitted_by_applicant` | **PASS** |
| **SCEN-04** | RFI Acceptance & Workstream Resumption | Browser 1: CPRA Reviewer accepts response | Browser 2: SpaceX PM / State PM | `workstreams.operational_state` returns to `running`, audit logged | **PASS** |
| **SCEN-05** | Private Document Version Upload & Hash Verification | Browser 1: SpaceX uploads revision file | Browser 2: Agency reviewers | File stored in `path-documents`, SHA-256 verified, version and agency reviews recorded | **PASS** |
| **SCEN-06** | Multi-Agency Document Review Signoff | Browser 1: Agency reviewer signs off | Browser 2: Project PM | Review status is `approved`, version transitions when all approved | **PASS** |
| **SCEN-07** | Workstream Blocker & Statutory Hold | Browser 1: DOTD reviewer marks blocked | Browser 2: SpaceX PM & State PM | Workstream state is `blocked` or `waiting_government`, blocker reason recorded | **PASS** |
| **SCEN-08** | Interagency Coordination Request Lifecycle | Browser 1: DOTD requests CPRA concurrence | Browser 2: CPRA coordinator | `coordination_requests` row created, concurrence response audited | **PASS** |
| **SCEN-09** | Profile Contact Field Self-Service | Browser 1: User updates phone/email | Browser 2: Clean session fetches directory | `user_profiles` updated, visible in directory | **PASS** |
| **SCEN-10** | Admin Team Role Assignment | Browser 1: Admin changes user role | Browser 2: Clean session fetches user | `project_participants` updated, role audited | **PASS** |
| **SCEN-11** | Supabase Realtime Live Broadcast | Browser 1: Mutates work item state | Browser 2: Open active page without refresh | Realtime postgres_changes event triggers UI auto-hydration | **PASS** |
| **SCEN-12** | Database Hydration on Login | Login as any authorized persona | Clean browser session | Full 18-entity project graph hydrated from PostgreSQL in < 500ms | **PASS** |
| **SCEN-13** | External Filing Tracking Update | Browser 1: Updates external reference | Browser 2: SpaceX PM | `external_filings` row updated, audit event logged | **PASS** |
| **SCEN-14** | Production Build & Lint Gate | Automated CI | Vinext / ESLint / Node Test Runner | 0 lint errors, valid SSR bundle, 100% test pass rate | **PASS** |
