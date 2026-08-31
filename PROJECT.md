# Project: SpaceX Louisiana Critical Path / PATH ITSM & PM Transformation

## Architecture
- **Framework & Runtime**: Next.js 16 App Router (SPA with dynamic SSR routes in `vinext`), React 19, TypeScript.
- **Database & Storage**: Supabase PostgreSQL with schema `app_private` security functions, Row Level Security (RLS) policies, atomic transaction RPCs, and Private Storage bucket `path-documents`.
- **Domain Modeling & Persistence**: Drizzle ORM (`db/schema.ts`), TypeScript Domain Records (`lib/domain-models.ts`), Repository Pattern with Dual Hydration (`lib/repository.ts` — PostgreSQL live rows vs offline deterministic mock fixtures in `lib/spacex-megaproject-fixture.ts`).
- **Engines**:
  - Topological Critical Path Method (CPM) solver & float engine (`lib/engines/schedule-engine.ts`).
  - What-If perturbation and schedule simulator (`lib/engines/simulation-engine.ts`).
  - 5-Tier SLA / Statutory clock escalation engine (`lib/engines/escalation-engine.ts`).
  - Plain-English 6-question customer narrative engine (`lib/engines/workflow-engine.ts`).
- **UI & Cockpits**:
  - Role-separated operational cockpits (`reviewer`, `agency`, `supervisor`, `state_office`, `customer`, `admin`).
  - Work card & ticket detail views with work action bars (`app/page.tsx`).
  - In-ticket interactive DAG workflow modification engine.
  - Multi-horizon Gantt & workstream graph (`components/cockpits/WorkstreamGraphGantt.tsx`).
  - Document vault & attachment previewer with cryptographic SHA-256 verification (`components/cockpits/DocumentVaultPanel.tsx`, `components/documents/DocumentViewerModal.tsx`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Multi-Agency & Customer Tenancy Model | Database & domain modeling for SpaceX (customer company) and agencies (DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish) | M1 | ORIGINAL_REQUEST §1, R1 |
| F2 | Assignment Groups & Fulfiller Queues | First-class `assignment_groups` and `assignment_group_memberships` in Supabase and domain model for routing | M1 | ORIGINAL_REQUEST §1, R1 |
| F3 | Unified ITSM Lifecycle & PM Milestones | Standard ITSM states (`Draft`, `Submitted/New`, `Triaged`, `In Progress`, `Pending Customer/Info`, `Pending Agency Concurrence`, `Blocked/Suspended`, `Resolved`, `Closed/Issued`) with PM milestones | M1 | ORIGINAL_REQUEST §1, R1 |
| F4 | Priority Matrix & Statutory Clocks | P1-P4 priority scoring, statutory deadline tracking, clock pause/resume triggers, and RAG status | M1 | ORIGINAL_REQUEST §1, R1 |
| F5 | ITSM Operations UI & Fulfiller Triage | UI to browse, filter, create, triage, and route tickets by Assignment Group, Agency, Priority, and Status | M2 | ORIGINAL_REQUEST §1, AC1 |
| F6 | Customer Portal Clean Separation | Restricted customer view with 6-question plain-English summaries, request intake, and customer-safe milestones | M2 | ORIGINAL_REQUEST §1, AC1 |
| F7 | Dynamic Calendar Regex Fix | Fix hardcoded date regex in test suite to ensure green regression baseline across calendar dates | M2 | survey_specminer_3 |
| F8 | In-Ticket Interactive Workflow DAG Editor | Inline interactive DAG & step editor embedded in ticket detail view for authorized fulfillers/state workers/admins | M3 | ORIGINAL_REQUEST §2, R2, AC2 |
| F9 | Live Ticket Step & Dependency Mutation RPCs | Supabase RPCs and repository methods to add/remove steps, adjust dependencies, reassign step fulfillers, and advance/block execution | M3 | ORIGINAL_REQUEST §2, R2, AC2 |
| F10 | Realtime CPM & Gantt Schedule Synchronization | Dynamic schedule float and critical path recalculation via CPM solver on step modification with Realtime broadcast | M3 | ORIGINAL_REQUEST §2, R2, AC2 |
| F11 | End-to-End Document Download Reliability | Direct file download + signed URL fallback across customer portal, ticket details, document vault, and agency panels | M4 | ORIGINAL_REQUEST §3, R3, AC3 |
| F12 | Authentic Demo Document Preservation | Cryptographic SHA-256 and byte verification preserving all 8 authentic demo PDFs and research documents | M4 | ORIGINAL_REQUEST §3, R3, AC3 |
| F13 | Supabase Authoritative Persistence & Sync | End-to-end sync of all entities through Supabase transactions and RLS with full offline mock fallback parity | M4 | ORIGINAL_REQUEST §4, R4, AC4 |
| F14 | Comprehensive 4-Tier E2E Test Suite | Opaque-box requirement-driven test suite (Tiers 1-4: Feature, Boundary, Pairwise, Real-World) passing 100% | M5 (E2E Track) | ORIGINAL_REQUEST §R1-R5 |
| F15 | Adversarial Coverage Hardening (Tier 5) | White-box adversarial testing and bug hunting via Challenger loop | M5 | Strategy §Dual Track |
| F16 | Incremental Git Checkpoints | Clean, descriptive git commits at each functional milestone checkpoint | M1-M5 | ORIGINAL_REQUEST §5, R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Independent requirement-driven 4-tier opaque-box test suite + TEST_INFRA.md + TEST_READY.md | none | DONE |
| M1 | ITSM & Multi-Tenancy Data Model & Supabase Persistence | F1, F2, F3, F4: DB migration, Drizzle schema, TypeScript types, Supabase RLS, Repository parity | none | DONE |
| M2 | ITSM Operations UI, Fulfiller Queues & Customer Separation | F5, F6, F7: Assignment group views, ticket triage UI, priority matrix, customer vs fulfiller portal, test fix | M1 | DONE |
| M3 | In-Ticket Interactive Workflow DAG Editor & Execution Engine | F8, F9, F10: Interactive in-ticket workflow editor, live step/dependency mutations, CPM recalculation | M1, M2 | DONE |
| M4 | Reliable Document Downloads & System Integration | F11, F12, F13: Document download verification across all portals, signed URL fallback, full persistence sync | M1, M2, M3 | DONE |
| M5 | Final Milestone: 100% E2E Test Pass & Adversarial Hardening | F14, F15, F16: Phase 1 pass 100% E2E tests, Phase 2 Tier 5 Challenger hardening, final Git checkpoints | M4, E2E | DONE |

## Interface Contracts

### M1 ↔ M2: Assignment Groups & ITSM Ticket Data Model
- **Entities**:
  - `AssignmentGroupRecord`: `{ id: string, orgCode: string, name: string, description: string, leadUserId?: string, active: boolean }`
  - `AssignmentGroupMembershipRecord`: `{ id: string, assignmentGroupId: string, userId: string, role: 'member' | 'lead' | 'backup' }`
  - `TicketRecord` / `CustomerRequestRecord` / `WorkstreamRecord`: Extended with `assignmentGroupId: string`, `assignedToUserId?: string`, `itsmState: ITSMState`, `priority: 'P1' | 'P2' | 'P3' | 'P4'`, `statutoryDeadline?: string`, `clockStatus: 'active' | 'paused' | 'stopped'`.
- **ITSMState Enum**: `'draft' | 'submitted' | 'triaged' | 'in_progress' | 'pending_customer' | 'pending_agency' | 'blocked' | 'resolved' | 'closed'`.
- **Repository Methods**:
  - `getAssignmentGroups(orgCode?: string): Promise<AssignmentGroupRecord[]>`
  - `getAssignmentGroupMembers(groupId: string): Promise<UserRecord[]>`
  - `assignTicket(ticketId: string, groupId: string, userId?: string, reason?: string): Promise<void>`
  - `updateTicketITSMState(ticketId: string, state: ITSMState, reason?: string): Promise<void>`

### M1/M2 ↔ M3: In-Ticket Workflow Step & DAG Mutation Engine
- **Entities & Types**:
  - `WorkflowStepMutation`: `{ type: 'add_step' | 'remove_step' | 'update_step' | 'reorder_dependencies' | 'change_state' | 'change_assignee', workstreamId: string, stepId?: string, payload: any }`
  - `TaskRecord`: `{ id: string, workstreamId: string, stageId: string, taskCode: string, name: string, status: 'pending' | 'active' | 'done' | 'blocked', assignedOrgCode?: string, assignedUserId?: string, estimatedDurationDays: number, isMilestone: boolean, dependencies: string[] }`
- **Mutations & RPCs**:
  - `rpc_modify_workstream_task(workstream_id: uuid, task_data: jsonb): Promise<TaskRecord>`
  - `rpc_remove_workstream_task(workstream_id: uuid, task_id: uuid): Promise<void>`
  - `rpc_update_task_dependencies(workstream_id: uuid, task_id: uuid, predecessor_ids: uuid[]): Promise<void>`
  - `rpc_advance_workstream_task(workstream_id: uuid, task_id: uuid, new_status: string, note?: string): Promise<void>`
- **Engine Invariant**:
  - On every mutation, `solveTaskDAG(tasks)` must validate acyclicity and recompute total float, early/late dates, and critical path flags.

### M1/M2/M3 ↔ M4: Document Download & Vault Service
- **Functions**:
  - `downloadDocumentVersion(docId: string, versionId: string): Promise<Blob>`
  - `getDocumentDownloadUrl(docId: string, versionId: string): Promise<string>`
- **Integrity Guarantee**:
  - SHA-256 and byte-length validation against `document_versions` metadata before triggering browser save.

## Code Layout
- `supabase/migrations/`: SQL migration files, RLS policies, PostgreSQL RPCs.
- `db/schema.ts`: Drizzle ORM relational schema definitions.
- `lib/domain-models.ts`: Core TypeScript entity records and type definitions.
- `lib/repository.ts`: Single entry point repository with live Supabase vs mock fixture hydration.
- `lib/supabase/mutations.ts`: Supabase RPC client callers.
- `lib/engines/`:
  - `schedule-engine.ts`: CPM solver & topological DAG scheduler.
  - `simulation-engine.ts`: What-If simulator.
  - `workflow-engine.ts`: Narrative generator & stage engine.
  - `escalation-engine.ts`: Priority & statutory SLA clock timers.
- `components/cockpits/`:
  - `InTicketWorkflowEditor.tsx`: New interactive in-ticket workflow DAG modifier.
  - `DocumentVaultPanel.tsx`: Document management and download cockpit.
  - `WorkstreamGraphGantt.tsx`: Visual DAG and Gantt schedule renderer.
- `components/documents/DocumentViewerModal.tsx`: Attachment preview and verified direct download modal.
- `app/page.tsx`: Main operational cockpit, router, triage queues, ticket detail, work action bar.
- `tests/`:
  - `tests/e2e-itsm-pm-platform.test.mjs`: Requirement-driven 4-tier E2E test suite.
  - `tests/*.test.mjs`: Unit, integration, and security test suites.
