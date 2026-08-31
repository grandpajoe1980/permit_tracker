# TEST_INFRA.md — ITSM & Project Management Platform Test Infrastructure

## 1. Testing Methodology & Philosophy

The test infrastructure for the SpaceX Louisiana Critical Path / PATH ITSM & Project Management platform is built upon a **requirement-driven, opaque-box, 4-tier testing methodology**. The suite validates domain behaviors, operational workflows, mathematical algorithms, security boundaries, and multi-tenant isolation against documented specifications in `ORIGINAL_REQUEST.md` and `PROJECT.md`.

### Core Principles
1. **Opaque-Box Verification**: Tests execute against public APIs, repository interfaces, business engines, and domain models without coupling to ephemeral internal state.
2. **Authoritative Expected Output**: Test expectations are derived strictly from statutory rules, CPM mathematical properties, priority matrices, and documented acceptance criteria.
3. **Deterministic Isolation**: Every test creates and isolates its runtime state without cross-test contamination or order dependencies.
4. **Dual Execution Hydration**: The test harness supports dual hydration — validating both live Supabase transaction contracts and offline deterministic repository fixtures.
5. **Cryptographic & Data Integrity**: Document payloads, SHA-256 checksums, and byte sizes are verified deterministically without synthetic mocked shortcuts.

---

## 2. Feature Inventory Traceability

| Feature ID | Feature Name | Source Specification | Verification Tier | Scope & Capabilities |
|---|---|---|---|---|
| **F1** | Multi-Agency & Customer Tenancy Model | ORIGINAL_REQUEST §1, R1, AC1 | Tier 1, Tier 3, Tier 4 | SpaceX (Applicant) and agencies (DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish) multi-tenancy, jurisdiction levels, data isolation |
| **F2** | Assignment Groups & Fulfiller Queues | ORIGINAL_REQUEST §1, R1, AC1 | Tier 1, Tier 2, Tier 3 | First-class `assignment_groups`, fulfiller memberships, role titles, queue filtering, My Work deduplication |
| **F3** | Unified ITSM Lifecycle & PM Milestones | ORIGINAL_REQUEST §1, R1, AC1 | Tier 1, Tier 2, Tier 4 | Standard ITSM states (`Draft`, `Submitted`, `Triaged`, `In Progress`, `Pending Customer`, `Pending Agency`, `Blocked`, `Resolved`, `Closed`) & PM milestones |
| **F4** | Priority Matrix & Statutory Clocks | ORIGINAL_REQUEST §1, R1, AC1 | Tier 1, Tier 2, Tier 3 | P1-P4 priority scoring, urgency/impact matrix, statutory deadlines, clock pause/resume triggers, 5-tier escalation engine |
| **F5** | ITSM Operations UI & Fulfiller Triage | ORIGINAL_REQUEST §1, AC1 | Tier 1, Tier 3, Tier 4 | Triage queue, work item generation, role-based action bars, status tone calculation, fulfiller operational notes |
| **F6** | Customer Portal Clean Separation | ORIGINAL_REQUEST §1, AC1 | Tier 1, Tier 2, Tier 3 | 6-question plain-English narrative engine, customer intake, internal deliberation redaction, visibility filtering |
| **F7** | Dynamic Calendar & Schedule Resilience | PROJECT.md F7, survey_specminer_3 | Tier 1, Tier 2 | Calendar independence, leap/weekend interval calculations, statutory target date formatting, schedule variance |
| **F8** | In-Ticket Interactive Workflow DAG Editor | ORIGINAL_REQUEST §2, R2, AC2 | Tier 1, Tier 2, Tier 3, Tier 4 | In-ticket DAG task insertion, removal, criteria editing, milestone gate flags, parish hearing insertion |
| **F9** | Live Step & Dependency Mutations | ORIGINAL_REQUEST §2, R2, AC2 | Tier 1, Tier 2, Tier 3, Tier 4 | Dependency predecessor/successor links, step state transitions (`Active`, `Done`, `Blocked`, `Waived`), step assignee updates |
| **F10** | Realtime CPM & Gantt Schedule Synchronization | ORIGINAL_REQUEST §2, R2, AC2 | Tier 1, Tier 2, Tier 3, Tier 4 | Forward/backward pass CPM solver, early/late dates, total float days, critical path determination, What-If perturbation |
| **F11** | End-to-End Document Download Reliability | ORIGINAL_REQUEST §3, R3, AC3 | Tier 1, Tier 2, Tier 3, Tier 4 | Direct download, signed URL fallback, multi-version document history, multi-agency review approvals, filename sanitization |
| **F12** | Authentic Demo Document Preservation & SHA-256 | ORIGINAL_REQUEST §3, R3, AC3 | Tier 1, Tier 2, Tier 3, Tier 4 | 8 authentic demo documents preservation, cryptographic SHA-256 hex verification, byte length integrity, tampering rejection |
| **F13** | Supabase Authoritative Persistence & Sync | ORIGINAL_REQUEST §4, R4, AC4 | Tier 1, Tier 2, Tier 3 | Dual hydration parity, immutable audit event ledger, mutation RPC signatures, coordination request (CR) persistence |

---

## 3. Architecture & Test System Boundaries

```
+-------------------------------------------------------------------------------+
|                             TEST RUNNER (node:test)                           |
|               tests/e2e-itsm-pm-platform.test.mjs (100% Native ESM)           |
+-------------------------------------------------------------------------------+
        |                                       |
        v                                       v
+-----------------------------------+   +---------------------------------------+
|        Vite SSR Dynamic Loader    |   |         Cryptographic Utilities       |
|    (vite.ssrLoadModule TS engine) |   |    (node:crypto SHA-256 verification) |
+-----------------------------------+   +---------------------------------------+
        |
        +-----------------------+-----------------------+
        |                       |                       |
        v                       v                       v
+------------------+   +-------------------+   +--------------------------------+
| Domain Models &  |   | Business Engines  |   | Repository Layer               |
| Drizzle Schema   |   | - Schedule (CPM)  |   | (lib/repository.ts)            |
| (lib/domain-     |   | - Workflow (6-Q)  |   | - Dual Hydration Parity        |
|  models.ts,      |   | - Escalation (SLA)|   | - Operational UX Queues        |
|  db/schema.ts)   |   | - Simulation      |   | - Document Download Dispatcher |
+------------------+   +-------------------+   +--------------------------------+
```

---

## 4. 4-Tier Test Coverage Hierarchy & Quality Thresholds

### Tier 1: Feature Coverage (F1 through F13)
- **Requirement**: Minimum 5 test cases per feature across F1 to F13.
- **Threshold**: >= 65 tests total.
- **Scope**:
  - `F1`: Multi-Tenancy (SpaceX, DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish isolation and metadata).
  - `F2`: Assignment Groups (group creation, membership roles, fulfiller routing, queue partitioning).
  - `F3`: ITSM Lifecycle (ITSM state enum transitions, PM milestone alignment, stage advancement gates).
  - `F4`: Priority & Statutory Clocks (P1-P4 matrix, statutory deadline computation, clock pause/resume triggers).
  - `F5`: Operations UI (work item generation, fulfiller action availability, triage queue routing, status tones).
  - `F6`: Customer Portal (6-question narrative, plain-English synthesis, confidential redactions, intake confirmation).
  - `F7`: Calendar Resilience (date difference calculations, leap year handling, statutory date formatting).
  - `F8`: In-Ticket Workflow Editor (in-ticket task addition, task removal, attribute editing, custom review gates).
  - `F9`: Step & Dependency Mutations (predecessor/successor links, step state machine, assignee reassignments).
  - `F10`: CPM Solver (forward/backward passes, early/late dates, zero-float critical path detection, perturbation).
  - `F11`: Document Downloads (direct download, signed URL fallback, multi-version history, filename sanitization).
  - `F12`: Authentic Demo Documents (preservation of 8 authentic demo documents, SHA-256 hashing, byte verification).
  - `F13`: Persistence & Sync (dual hydration parity, immutable audit ledger, coordination requests persistence).

### Tier 2: Boundary & Corner Cases (5 Key Feature Areas)
- **Requirement**: Minimum 5 test cases per boundary area.
- **Threshold**: >= 25 tests total.
- **Scope**:
  - `Area 1`: Zero / Null / Unassigned Fulfillers & Empty Queues (unassigned tickets, empty workstreams, empty queues).
  - `Area 2`: Cyclic DAG Dependency Detection & Graph Anomalies (self-dependency, 2-node cycle, disconnected islands, 0-day milestones).
  - `Area 3`: Statutory Clock Pause/Resume Transitions (multiple consecutive pause cycles, overdue Level 5 escalations, non-negative variance).
  - `Area 4`: Document Byte Mismatch & Tampering Rejection (byte length discrepancy, tampered SHA-256, 0-byte upload rejection).
  - `Area 5`: Unauthorized Role Workflow Edit & Permission Boundaries (customer complete_step rejection, cross-agency approval blocks).

### Tier 3: Cross-Feature Pairwise Interactions
- **Requirement**: Minimum 10 test cases covering multi-feature pairwise interactions.
- **Threshold**: >= 10 tests total.
- **Scope**:
  - `Pairwise 1`: In-ticket DAG step injection -> CPM float recalculation -> Assignment Group routing -> Customer narrative update.
  - `Pairwise 2`: Priority P1 escalation -> Statutory clock acceleration -> Cross-agency coordination request (CR) dispatch.
  - `Pairwise 3`: RFI creation by reviewer -> Statutory clock pause -> Customer portal notification -> Submitter response -> Reviewer acceptance & clock resumption.
  - `Pairwise 4`: Document upload with SHA-256 verification -> In-ticket DAG milestone gate attachment -> Fulfiller review sign-off.
  - `Pairwise 5`: Assignment Group reassignment -> Fulfiller queue update -> Immutable audit ledger event recording.
  - `Pairwise 6`: Inter-agency blocker creation -> Workstream RAG health degradation to Red -> Critical path variance update -> Executive notification.
  - `Pairwise 7`: Customer request triage -> Workstream conversion -> Assignment group routing -> Forecast target date calculation.
  - `Pairwise 8`: What-If simulation perturbation -> Step duration delay -> Critical path shift -> Downstream dependency float reduction.
  - `Pairwise 9`: Workstream stage completion with checklist verification -> Next stage auto-advance -> Lead agency transition -> Statutory clock reset.
  - `Pairwise 10`: Multi-agency concurrent document review -> Aggregate decision logging -> Milestone gate release -> Workstream unblocking.

### Tier 4: Real-World Application Scenarios
- **Requirement**: Minimum 5 comprehensive end-to-end scenarios.
- **Threshold**: >= 5 tests total.
- **Scope**:
  - `Scenario 1`: SpaceX Heavy-Haul Transport Corridor (Intake -> State Concierge triage -> DOTD Structures & Vermilion Parish queue -> In-ticket custom parish hearing gate insertion -> Load study upload & SHA-256 verify -> Statutory clock compliance -> Concurrent approval).
  - `Scenario 2`: Launch Pad A Wetlands & Coastal Use Permit Complex Review (SpaceX submittal -> CPRA / USACE joint review -> RFI issued for storm surge hydrology -> Clock paused -> SpaceX uploads revised model -> Reviewer accepts -> Clock resumes -> Public notice period -> Coastal Use Permit issued).
  - `Scenario 3`: Industrial Wastewater Deluge System Fast-Track Approval (P1 emergency water discharge filing -> LDEQ Environmental Review queue -> In-ticket DAG modification inserting expedited toxicity test -> CPM recalculation -> Cross-agency concurrence from CPRA -> Resolved with statutory certificate).
  - `Scenario 4`: Cryogenic Fuel Storage Facility Multitenant Safety Review (OSFM & State Police Hazmat joint intake -> Multi-agency assignment group triage -> RFI cycle for blast radius modeling -> Document versioning v1->v2 with cryptographic verification -> Interagency coordination sign-off -> Final permit determination).
  - `Scenario 5`: Full Project Lifecycle with Dynamic Scope Change (Initial multi-workstream project setup -> Customer adds new utility interconnection request -> Triage & DAG merge -> Critical path recalculated across all workstreams -> Escalation triggered & resolved -> Final project completion & audit trail generation).

---

## 5. Test Suite Execution & Quality Gate

```bash
# Execute full 4-Tier E2E platform test suite:
node --test tests/e2e-itsm-pm-platform.test.mjs
```

### Quality Gate Pass Criteria
- **Execution Exit Code**: `0`
- **Pass Rate**: `100%` (0 failed, 0 cancelled)
- **Total Test Count**: `>= 105` test cases across Tiers 1–4.
