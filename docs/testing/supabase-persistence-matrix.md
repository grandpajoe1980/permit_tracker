# PATH Supabase Durability & Cross-Browser Persistence Matrix

## 1. Executive Summary & Durability Gate

The **Louisiana Project Delivery Command System (PATH)** operates with **Supabase PostgreSQL and Supabase Storage as the sole authoritative runtime**. Local storage and fixture states are strictly non-authoritative compatibility data for explicit demo/unit-test isolation.

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
| **Customer Requests** | `public.customer_requests` | `id` (text) | `project_id`, `submitted_by_user_id` | Authenticated project/request-owner read; RPC write |
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
- **Permissions**: private bucket; authenticated project/request-authorized access only
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
| **SCEN-01** | Dual-User Customer Request Propagation | Browser 1: SpaceX PM submits service request | Browser 2: State PM with clean storage | Exact request title is retrieved from the Supabase-backed intake queue | **PASS (Chromium, 2/2 persistence suite)** |
| **SCEN-02** | RFI Creation & Workstream Clock Pause | Browser 1: LDEQ Reviewer issues RFI | Browser 2: SpaceX PM | Exact RFI is retrieved by the applicant; linked workstream visibly enters `Waiting on Applicant (RFI Issued)` | **PASS (Chromium)** |
| **SCEN-03/04** | RFI Response and Acceptance | Applicant and fresh reviewer contexts | Reviewer/applicant contexts | Exact question and response propagate; reviewer acceptance visibly resumes the linked workstream as `Running (Response Accepted)` | **PASS (Chromium)** |
| **SCEN-05** | Private Document Version Upload & Hash Verification | Browser 1: SpaceX uploads revision file | Browser 2: Agency reviewers | Exact uploaded bytes round-trip through private Storage; seeded private PDF download also passes | **PASS (Chromium, 2/2)** |
| **SCEN-06–13** | Remaining lifecycle, admin, realtime, and filing scenarios | Multiple contexts | Authorized users | No dedicated clean-context proof in the current automated suite | **UNVERIFIED** |
| **SCEN-14** | Production Build & Lint Gate | Automated CI | Vinext / ESLint / Node Test Runner | Build/type checks pass; lint has 0 errors but warning debt remains | **PASS WITH WARNINGS** |
| **SCEN-15** | Tenant and Storage Isolation Probe | Disposable isolated tenant; authenticated customer and anonymous contexts | Supabase RLS/Storage | Isolated project/document are hidden and unauthorized upload is rejected | **PASS (live Supabase)** |

The older table claimed all scenarios passed; those claims were not reproducible
from the current test suite and have been replaced with evidence-based status.
