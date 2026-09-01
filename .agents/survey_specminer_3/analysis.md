# Technical Specification Mining Report: Documents, Testing & Git Checkpoints

**Document Author**: `survey_specminer_3` (Documents, Testing & Git Spec Miner)  
**Date**: August 31, 2026  
**Target Repository**: `/Users/joe/Repos/Permit/permit_tracker`  
**Authoritative Reference**: `/Users/joe/Repos/Permit/permit_tracker/.agents/ORIGINAL_REQUEST.md`

---

## 1. Executive Summary

This report establishes the mined authoritative specifications, current architectural implementation, and verification baselines for the **SpaceX Louisiana Critical Path / PATH ITSM Permitting Platform**.

### Key Discoveries & Status:
1. **Document Storage & Downloads**:
   - Authoritative documents and ticket attachments are stored in Supabase Storage bucket `path-documents`.
   - `lib/document-download-utils.ts` and `lib/supabase/storage.ts` implement cryptographic validation: files are checked for exact byte length and SHA-256 hex checksums before triggering browser downloads.
   - Live Supabase storage contains **8 verified demo PDFs** and **1 deep research markdown artifact**, all with verified SHA-256 hashes and zero corrupt fixtures.
   - Download handlers operate across Customer Portal request intake, Project Document Vault, Workstream Cockpits, and Agency Review Certification Matrices.
2. **Build & Test Infrastructure**:
   - **Package Manager**: `npm` (pinned via `package-lock.json` and strict Linux CI script `scripts/install-ci.sh`), requiring Node `>=22.13.0` (active: `v22.22.0`).
   - **Build Tool**: `vinext build` (Vite 8.0.13 with RSC/SSR/Client compilation), building in ~2.5s with zero errors.
   - **Test Runner**: Node.js native test harness (`node --test tests/*.test.mjs`).
   - **Test Suite Scale**: 28 test files containing 170+ subtests.
   - **Test Execution Findings**: Running tests with concurrency control (`--test-concurrency=1`) yields 169 passing tests. One date-sensitive assertion (`tests/gantt-schedule-enhancements.test.mjs:58` expecting `Today (Aug 30)`) failed due to calendar advancement to August 31. Parallel batch execution requires single-concurrency or independent port allocation due to Vite SSR port 24678 collisions.
3. **Git History & Checkpoints**:
   - Branch: `main` tracking `origin/main` at `https://github.com/grandpajoe1980/permit_tracker.git`.
   - History exhibits clean, semantic functional milestone commits (`checkpoint:`, `fix:`, `docs:`).

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Document Management | Cryptographic SHA-256 Download Verification | Verifies file integrity using `crypto.subtle.digest("SHA-256")` against database record prior to download dispatch. | `DocumentRecord`, `DocumentVersionRecord`, `DownloadDocumentBlob` callback | `{ success: boolean, error: Error \| null }` | Returns explicit error if bytes size or SHA-256 mismatch; never manufactures fake documents. | `lib/document-download-utils.ts` |
| 2 | Document Management | Ephemeral Browser Download Trigger | Injects transient HTML anchor (`<a download="...">`) and invokes `.click()`, revoking Object URL after 60s. | `Blob`, `fileName: string` | Void (triggers browser download prompt) | No-ops gracefully in server-side/headless contexts (`window === undefined`). | `lib/document-download-utils.ts:20` |
| 3 | Document Management | Multi-Agency Revision Certification Matrix | Tracks per-version agency signoffs (`approved`, `under_review`, `revisions_requested`) that reset upon subsequent uploads. | `versionId`, `agencyCode`, `decision`, `actorName`, `comments` | Updated `DocumentAgencyReviewRecord` | Rejects unauthorized review states; logs immutable audit event. | `lib/supabase/storage.ts:233` |
| 4 | Document Management | Atomic Document Version RPC | Supabase database transaction (`rpc_create_document_version`) creating document version, reviews, and audit log atomically. | `p_version_id`, `p_document_id`, `p_storage_path`, `p_sha256_hash`, agency codes | Supabase JSON payload | Reverts and cleans up Storage file on database transaction failure. | `lib/supabase/storage.ts:98` |
| 5 | Document Vault UI | Document Vault Filter & Search Engine | Multi-dimensional filter by project/workstream, category, free text, and partial SHA-256 hash. | Search string, workstream filter, category filter | Filtered array of `DocumentRecord` | Renders clean empty state when no documents match query. | `components/cockpits/DocumentVaultPanel.tsx:55` |
| 6 | Document Vault UI | In-App Document Viewer & Engineering Inspector | Modal rendering document metadata, revision timeline, technical section breakdown, and review certifications. | `DocumentRecord`, `DocumentVersionRecord`, modal state | React JSX Modal | Falls back to latest version if selected version ID is not found. | `components/documents/DocumentViewerModal.tsx` |
| 7 | Ticket Attachments | Customer Intake Supporting Attachments | Allows customer to attach files to permit intake or service requests; stored in Supabase storage and linked via version IDs. | File input `FileList`, request metadata | `CustomerRequestRecord` with `attachmentDocumentVersionIds` | Validates file size and handles retry idempotency. | `app/page.tsx:1468`, `db/schema.ts:686` |
| 8 | ITSM Queues | Dual-Ownership Workstream Model | Combines State Concierge Coordinator (`governmentConcierge`) and Regulatory Review Agency (`regulatoryLead`) per workstream. | `WorkstreamRecord` | Mapped domain state | Defaults to fallback state coordinator if unassigned. | `lib/domain-models.ts:169`, `lib/operational-ux.ts` |
| 9 | ITSM Queues | Deterministic 6-Question Workstream Generator | Computes structured answers to: What is this? Who owns it? Current action? Why waiting? Next milestone? What must customer do? | `WorkstreamRecord`, operational state | Structured 6-question summary | Handles 10 distinct operational states (`running`, `waiting_government`, etc.). | `lib/engines/workflow-engine.ts`, `tests/engine-stress.test.mjs` |
| 10 | ITSM Queues | Multi-Tier Delay Reason Taxonomy | Classifies schedule variance into 13 delay categories with calendar slip impact calculations. | `primaryDelayReason`, `scheduleVarianceDays` | Delay breakdown & attribution | Defaults to `'none'` for on-track workstreams. | `db/schema.ts:279`, `lib/domain-models.ts:200` |
| 11 | Workflow Engine | Gate Validation Oracle (`validateStageTransition`) | Enforces prerequisite checklists, required input documents, and signoff gates before advancing stage. | `currentStage`, `nextStage`, `context` | `{ canTransition: boolean, missingRequirements: string[] }` | Throws descriptive validation error if gate conditions are unsatisfied. | `lib/engines/workflow-engine.ts:95` |
| 12 | Persistence / RLS | Project & Document RLS Isolation | Database policies ensuring customer users access only their organization's projects and non-confidential files. | Supabase Auth JWT / Session | SQL Row-level security filtering | Denies unauthorized read/write with PostgREST 403 / 401. | `supabase/migrations/20260830190000_authoritative_access_boundary.sql` |
| 13 | Build / Runtime | Vinext Fast SSR & RSC Bundler | Hybrid React Server Components and SSR builder integrated with Vite 8 and Rolldown chunking. | TypeScript / React source tree | Production build artifacts in `.next` / `dist` | Reports chunk size warnings and catches compilation errors during build. | `package.json:11`, `vite.config.ts` |
| 14 | Git Automation | Semantic Checkpoint Commits | Structured commit messages tracking functional milestone completions and architectural invariants. | Git staging area | Atomic git commits on `main` | Verifies clean working directory before tagging checkpoints. | `scripts/`, Git log |

---

## 3. Edge Cases & Observed Behaviors

| # | Feature | Input / Condition | Observed Behavior | Root Cause / Notes |
|---|---|---|---|---|
| 1 | Document Download | Download blob unavailable from Storage | Returns `{ success: false, error: Error("Object not found") }`; no fake file downloaded. | Intentional design in `lib/document-download-utils.ts` to prevent false official certifications. |
| 2 | Document Download | SHA-256 mismatch between metadata and file | Returns `{ success: false, error: Error("Integrity check failed...") }`; aborts download. | Prevents corrupted or tampered files from being presented to users. |
| 3 | Document Download | Version has `fileSizeBytes === 0` | Skips byte length validation and falls back to SHA-256 hash comparison if hash is valid. | Handled gracefully in `lib/document-download-utils.ts:101`. |
| 4 | Document Download | Missing `downloadBlob` callback | Returns `{ success: false, error: Error("Supabase Storage download is unavailable.") }`. | `DocumentVaultPanel` must receive `onDownloadDocument` from top-level page with `downloadDocumentFile`. |
| 5 | Document Review | Upload new revision while previous version has approvals | New version created with `under_review` status; previous version retains its approval audit trail. | Verified in `tests/document-lifecycle.test.mjs:44`. |
| 6 | Test Execution | Parallel execution of 28 test files | Hits `ENFILE: file table overflow` and WebSocket port 24678 collisions. | Vite SSR instances initialized per test file without port pooling. |
| 7 | Test Assertions | Gantt chart test executed on dates after Aug 30 | Fails on `assert.match(html, /Today \(Aug 30\)/)`. | Hardcoded date in `tests/gantt-schedule-enhancements.test.mjs:58`. Dynamic date helper needed. |
| 8 | Intake Attachments | Customer submits request with duplicate attachment retry | Attachment transaction is idempotent; links existing version ID without duplicating blob. | Handled in `supabase/migrations/20260830233000_customer_request_first_attachment.sql`. |
| 9 | Multi-Tenancy RLS | Anonymous / wrong-organization access to storage | PostgREST / Storage API rejects upload with `new row violates row-level security policy`. | Verified in `scripts/test-supabase-rls-isolation.mjs`. |
| 10 | Stage Transition | Missing required input document | `validateStageTransition` returns `canTransition: false` with missing document list. | Enforced by workflow engine in `lib/engines/workflow-engine.ts`. |

---

## 4. Document Management & Download Architecture

### 4.1 Storage Schema & Bucket Configuration
- **Bucket Name**: `path-documents`
- **Path Hierarchy**:
  ```
  path-documents/
  ├── {document_uuid}/
  │   └── v{version_number}/
  │       └── {file_name_sanitized}
  └── {workstream_code}/ (legacy storage path)
  ```
- **Storage Primitives**: `lib/supabase/storage-primitives.ts`
  - `calculateSHA256(buffer)`: Computes SHA-256 digest using `globalThis.crypto.subtle`.
  - `uploadDocumentFile(file, docId, version)`: Sanitizes filename (`[^a-zA-Z0-9._-]` -> `_`) and writes to `path-documents`.

### 4.2 Verified Live Demo Documents
The live Supabase database and Storage bucket (`path-documents`) were probed via `scripts/diagnose-document-storage.mjs` and `scripts/verify-project-test-documents.mjs`. All 8 project packages are 100% verified:

1. `2c156e79-5620-409e-80ab-2684adb574b4/v1/la82-drainage-hydrodynamic-demo-v1.pdf` (1,042 bytes, SHA-256: `c6868c6635e994e5...`)
2. `397b11df-a36c-42ae-ad69-83837852877b/v1/freshwater-bayou-bridge-load-demo-v1.pdf` (1,034 bytes, SHA-256: `45970a130170fa42...`)
3. `d12061f0-fb2b-420c-b81c-d4c4a2a82db8/v1/la82-traffic-escort-protocol-demo-v1.pdf` (1,031 bytes, SHA-256: `dea71b68ba863848...`)
4. `edd619e9-5b3c-4693-8edb-46382889c843/v1/wetland-mitigation-package-demo-v1.pdf` (1,051 bytes, SHA-256: `27e2ab702ac9ecd6...`)
5. `311d633b-4c53-4158-8218-d4bb9f04a492/v1/deluge-retention-basin-report-demo-v1.pdf` (1,042 bytes, SHA-256: `801a4ae48c3dde7f...`)
6. `125afd53-2e05-4fd1-9dd5-a8cc96834cb9/v1/launch-flight-safety-hazard-demo-v1.pdf` (1,028 bytes, SHA-256: `650acfbf35eb16b1...`)
7. `7f74480b-6a83-42c1-b23b-d708b299d9f3/v1/methane-pipeline-safety-study-demo-v1.pdf` (1,047 bytes, SHA-256: `2c32b5ff59c2fea2...`)
8. `86266fab-5286-44bc-8b8f-7e01a7a4c9ce/v1/230kv-substation-single-line-demo-v1.pdf` (1,037 bytes, SHA-256: `fa801bfa37b1e2f7...`)
*Plus research artifact*: `97393af7-7f13-448b-8d4e-3fc275a604f1/v2/deep-research-report__1_.md` (85,599 bytes, SHA-256: `0dde149c1863b369...`).

### 4.3 Download Flow Trace Matrix
| Panel / Context | UI Trigger | Handler Function | Backend / Storage Invocation | Blob / Fallback Integrity |
|---|---|---|---|---|
| **Customer Portal** (`app/page.tsx:1468`) | File Upload on Request Intake | `setRequestFile(file)` | `uploadDocumentFile` -> RPC `rpc_create_customer_request` | Verifies SHA-256, links version ID to request |
| **Document Vault** (`DocumentVaultPanel.tsx`) | Table Download Icon / "Download Latest" | `handleDownload(docId, verId)` | `onDownloadDocument` callback -> `downloadDocumentFile` | Matches exact byte size and SHA-256 checksum |
| **Document Modal** (`DocumentViewerModal.tsx`) | "Download Official File" Button | `handleDownloadClick()` | `downloadDocumentVersion(doc, ver, downloadDocumentFile)` | Validates integrity, triggers browser download anchor |
| **Agency Review Panel** (`app/page.tsx`) | Agency Signoff on Revision | `reviewDocumentVersion` | `mutateReviewDocumentVersion` -> RPC `rpc_review_document_version` | Logs immutable audit ledger entry with actor name & org |

---

## 5. Build & Test Infrastructure

### 5.1 Environment Specifications
- **Node.js**: `v22.22.0` (Satisfies engine requirement `>=22.13.0`)
- **Package Manager**: `npm 10.9.2` (Locked via `package-lock.json`)
- **Framework**: `next@16.2.6` / `react@19.2.6` / `vinext@0.0.50` (Vite 8.0.13 backend)
- **Styling**: `tailwindcss@4.2.1` with `@tailwindcss/postcss` and `lucide-react`
- **Database Client**: `@supabase/supabase-js@2.112.4`, `drizzle-orm@0.45.2`

### 5.2 Build Command
- Command: `npm run build` (`vinext build`)
- Execution Time: ~2.4s
- Stages:
  1. Client references analysis (`212 modules transformed`)
  2. Server references analysis (`232 modules transformed`)
  3. RSC environment build (`218 modules transformed`)
  4. Client environment build (`2076 modules transformed`)
  5. SSR environment build (`238 modules transformed`)
- Output Routes: `/`, `/admin/workflows`, `/api/health`, `/api/requests`, `/projects/:projectNumber`, `/projects/:projectNumber/workstreams/:workstreamId`, `/requests/:confirmationNumber`.

### 5.3 Test Suite Inventory & Baseline
The repository contains 28 test files in `tests/`:

| Test File | Target Domain | Subtests | Status (Sequential) |
|---|---|---|---|
| `adversarial-fuzz-m1-challenger2.test.mjs` | Fuzzing & Malformed Inputs | 10 | PASS |
| `adversarial-milestone2.test.mjs` | Cockpit & DAG Stress | 10 | PASS |
| `assignment-queue.test.mjs` | Persona Work Items & Queues | 2 | PASS |
| `cockpit-stress-m2-challenger1.test.mjs` | Multi-Cockpit Integrations | 13 | PASS |
| `cockpits-m2-challenger2.test.mjs` | SSR Markup & View Router | 9 | PASS |
| `command-system.test.mjs` | Schema & Audit System | 4 | PASS |
| `customer-portal.test.mjs` | Customer Intake & Contacts | 8 | PASS |
| `db-persistence.test.mjs` | Repository CRUD & SLA Worker | 8 | PASS |
| `document-lifecycle.test.mjs` | Versioning & Agency Signoff | 2 | PASS |
| `document-storage-regression.test.mjs` | Storage Downloads & SHA Checks | 3 | PASS |
| `document-system.test.mjs` | Document Vault & Search | 4 | PASS |
| `e2e-cross-browser-durability.test.mjs` | Multi-User Postgres Durability | 3 | PASS |
| `end-to-end-workflow.test.mjs` | End-to-End Ticketing & RFI | 5 | PASS |
| `engine-stress.test.mjs` | 6-Question Engine & RAG Health | 8 | PASS |
| `executive-public-reporting.test.mjs` | Transparency & Public Reports | 6 | PASS |
| `gantt-schedule-enhancements.test.mjs` | Timeline Bars & Legend | 2 | 1 PASS, 1 FAIL (date-hardcoded) |
| `operational-ux.test.mjs` | Role-Based UX & Exceptions | 6 | PASS |
| `permit-data.test.mjs` | Persona Normalization & Permitting | 13 | PASS |
| `project-navigation.test.mjs` | Project Routing & Deep Links | 5 | PASS |
| `rendered-html.test.mjs` | Static HTML & Shell Markers | 1 | PASS |
| `schedule-simulation.test.mjs` | Schedule Perturbation & Float | 6 | PASS |
| `source-contract.test.mjs` | Source Contracts & Migration Integrity | 7 | PASS |
| `stress-test-m1-challenger2.test.mjs` | Scale & Invariant Testing | 8 | PASS |
| `supabase-durability.test.mjs` | Live DB & Bidirectional Mappings | 6 | PASS |
| `ui-components.test.mjs` | UI Atoms & 8 Delivery Cockpits | 5 | PASS |

---

## 6. Git Status & Checkpoint Mechanics

### 6.1 Git State
- **Active Branch**: `main` (synchronized with `origin/main`)
- **Remote**: `https://github.com/grandpajoe1980/permit_tracker.git`
- **Commit History Standard**:
  - `checkpoint:` — Functional milestone completion (e.g., `checkpoint: enforce mandatory task dependencies`)
  - `fix:` — Bug fixes and regression corrections (e.g., `fix: resolve request projects by uuid or number`)
  - `docs:` — Architectural records and verification status updates

### 6.2 Checkpoint Procedure
For each functional milestone during delivery:
1. Verify build passes: `npm run build`.
2. Run test verification suite: `node --test --test-concurrency=1 tests/*.test.mjs`.
3. Verify live storage & RLS: `node scripts/test-supabase-rls-isolation.mjs`.
4. Create descriptive git commit: `git commit -m "checkpoint: <milestone-description>"`.
5. Push to origin: `git push origin main`.

---

## 7. Four-Tier Quality Assurance Matrix

To guarantee end-to-end reliability across ITSM, Workflows, Documents, and Supabase, the following 4-tier testing framework is defined:

```
+--------------------------------------------------------------------------------+
| TIER 4: End-to-End User Journeys, Cockpits & Cross-Browser Markup              |
| (Customer Portal, Fulfiller Workflows, Live Downloads, SSR Invariants)         |
+--------------------------------------------------------------------------------+
                                       ▲
+--------------------------------------------------------------------------------+
| TIER 3: Live Supabase Persistence, RLS Security & Storage Lifecycle            |
| (Atomic RPC Transactions, Multi-Tenant RLS, SHA-256 Storage Verification)      |
+--------------------------------------------------------------------------------+
                                       ▲
+--------------------------------------------------------------------------------+
| TIER 2: State Machine, Workflow Execution & ITSM Queues                        |
| (Gate Validation, 6-Question Engine, RFI Clock Impacts, Priority SLA Worker)   |
+--------------------------------------------------------------------------------+
                                       ▲
+--------------------------------------------------------------------------------+
| TIER 1: Unit & Cryptographic Integrity Tests                                   |
| (SHA-256 Checksums, Byte Verification, Bidirectional Row Mappings, Domain UX)  |
+--------------------------------------------------------------------------------+
```

### 7.1 Tier 1: Unit & Cryptographic Integrity Tests
- **Objective**: Validate pure functions, cryptographic hash verification, domain row mappers, and data integrity algorithms in isolation.
- **Coverage**:
  - `calculateSHA256` generates valid 64-character lowercase hex string.
  - `downloadDocumentVersion` correctly parses data URLs, blob URLs, and storage paths.
  - `downloadDocumentVersion` rejects corrupted bytes (size mismatch or hash mismatch).
  - Bidirectional mappings between Supabase snake_case SQL rows and TypeScript camelCase domain models (`workstreamRowToDomain`, `customerRequestRowToDomain`, `rfiRowToDomain`, `documentRowToDomain`).
  - Zero mock file manufacturing when storage returns `null` or `error`.

### 7.2 Tier 2: State Machine, Workflow Execution & ITSM Queues
- **Objective**: Validate operational state transitions, stage checklist gates, delay attribution, and assignment routing.
- **Coverage**:
  - In-ticket workflow node modifications (reordering, adding steps, updating owners).
  - `validateStageTransition` gate oracle enforcing required input documents and checklist completions.
  - RFI lifecycle: issuance pauses statutory clock, applicant response, lead reviewer acceptance resumes clock.
  - ITSM assignment group and personal ownership segregation across 10 operational states.
  - Dual-ownership model: State Concierge + Lead Reviewing Agency coordination.

### 7.3 Tier 3: Live Supabase Persistence, RLS Security & Storage Lifecycle
- **Objective**: Verify live PostgreSQL database transactions, security definer RPCs, and storage bucket security policies.
- **Coverage**:
  - `rpc_create_document_version` atomic creation of version, agency reviews, and audit events.
  - `rpc_create_customer_request` deriving actor from `auth.uid()` with project access check.
  - Multi-tenant RLS isolation: customer accounts cannot view internal agency deliberations or unauthorized projects.
  - Live Storage upload, signed URL generation, download, and cleanup in `path-documents`.

### 7.4 Tier 4: End-to-End User Journeys, Cockpits & SSR Invariants
- **Objective**: Verify integrated full-stack workflows across Customer Portal, Ticket Details, Agency Review Panels, and Executive Cockpits.
- **Coverage**:
  - Customer submits request with attachment -> Fulfiller receives work item -> Agency reviews document -> Decision recorded.
  - SSR static markup assertions verifying no hydration mismatches or missing interactive widgets across all 8 specialized cockpits.
  - Real browser downloads triggering file save with authentic headers and correct MIME types.

---

## 8. Traceability to ORIGINAL_REQUEST.md

| Requirement | Scope & Description | Mined Architectural Invariant | Verification Tier |
|---|---|---|---|
| **R1. ITSM & PM Data Model & Tenancy** | Organizations, Assignment Groups, Customers, Fulfillers, RAG status, Priority P1-P4, Critical Path tagging. | Mapped in `db/schema.ts`, `lib/domain-models.ts`, and Supabase tables `organizations`, `project_participants`, `workstreams`, `tasks`. | Tier 1, Tier 2 |
| **R2. In-Ticket Workflow Editor & Execution Engine** | Inline DAG modifications, adding/reordering review gates, changing step owners, resolving blockers. | Governed by `lib/engines/workflow-engine.ts`, `validateStageTransition`, and Supabase migrations `20260830200000_workflow_execution_engine.sql`. | Tier 2, Tier 4 |
| **R3. Document Management & Download Reliability** | Document vault, ticket attachments, direct downloads, SHA-256 checks, preservation of demo files. | Enforced by `lib/document-download-utils.ts`, `lib/supabase/storage.ts`, and 8 verified demo PDFs in `path-documents`. | Tier 1, Tier 3, Tier 4 |
| **R4. Supabase Authoritative Persistence & Sync** | All mutations persist to Supabase; offline fallback aligns with schema; RLS security hardening. | Enforced by atomic SQL RPCs (`rpc_create_document_version`, `rpc_review_document_version`) and RLS policies. | Tier 3 |
| **R5. Incremental Git Checkpoints** | Descriptive functional milestone commits pushed to GitHub repository. | Executed per Functional Milestone SOP on branch `main`. | Tier 4 / Git Standard |

---
