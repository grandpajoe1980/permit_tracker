# UI Architecture & Workflow Engine Survey Report

**Author**: `survey_explorer_2` (UI & Workflow Engine Explorer)  
**Date**: 2026-08-31  
**Project**: PATH — Louisiana Project Operations & ITSM Platform (`permit_tracker`)  
**Scope**: UI Architecture, Routing, Role Separation, Ticket Detail Views, Workflow Engine, In-Ticket Interactive DAG Modification, and Technical Gaps.

---

## 1. Executive Summary

The PATH platform is a multi-agency, role-aware ITSM and Project Management system built with **Next.js (App Router)** via **Vinext (Vite 8) + React 19 + TypeScript + Tailwind CSS + Supabase**.

The system currently features:
1. **Role-Aware Operational Workspaces**: Dynamic perspective switching between Customer / Applicant Portal (`SpaceX`), Agency Technical Reviewers (`LDEQ`, `DOTD`, `CPRA`, `OSFM`, `LSP`), Agency Supervisors, State Project Office (`Sarah Johnson`), and PATH Administrators (`Joe Skaggs`).
2. **Deterministic Queue Management ("My Work")**: Action-driven work cards displaying assignment reasons, due dates, statutory clock impact, downstream handoffs, and required inputs.
3. **Execution Intelligence & Schedule Engine**: Forward and backward DAG topological solver (`schedule-engine.ts`), What-If scenario perturbation simulator (`simulation-engine.ts`), and traditional Gantt visualization with historical baseline, current execution, and future forecast horizons (`WorkstreamGraphGantt.tsx`).
4. **Template-Level Workflow Designer**: Versioned template lifecycle management with draft creation, stage configuration, checklist gate definitions, and validation/publication RPCs (`WorkflowDesignerPanel.tsx`).

### Critical Architectural Finding & Gap
While PATH possesses robust **global template versioning** and a **DAG mathematical solver**, there is **currently no per-ticket in-line interactive workflow DAG editor**. Fulfillers can advance sequential stages (`rpc_complete_workstream_stage`) or set whole-workstream blockers (`rpc_mark_workstream_blocked`), but they **cannot interactively click into an active ticket to insert custom milestones, remove steps, drag/reorder dependency edges, change individual step assignees/agencies, or modify gate criteria on a specific live ticket instance**.

---

## 2. Current UI Architecture & Routing Structure

### 2.1 Routing and Page Hierarchy

The application utilizes Next.js App Router structure under `app/`:

```
app/
├── layout.tsx                                # Root HTML shell, fonts, global styles, metadata
├── globals.css                               # Tailwind v4 theme, design system tokens, road-stripe styling
├── page.tsx                                  # Core SPA view orchestrator with Supabase Realtime synchronization
├── admin/
│   └── workflows/
│       └── page.tsx                          # Server-rendered administrative route for workflow version inspection
├── projects/
│   └── [projectNumber]/
│       ├── page.tsx                          # Server-rendered project summary route
│       └── workstreams/
│           └── [workstreamId]/
│               └── page.tsx                  # Server-rendered individual workstream drilldown
├── requests/
│   └── [confirmationNumber]/
│       └── page.tsx                          # Public/authorized customer confirmation status route
└── api/
    ├── health/route.ts                       # Health check endpoint
    └── requests/route.ts                     # API request intake & dispatch
```

### 2.2 View Hierarchy in `app/page.tsx`

`app/page.tsx` acts as the primary operational command center, managing internal routes via `route` state:

```typescript
// app/page.tsx:119-120
type Route =
  | "my-work"          // Primary prioritized action queue
  | "agency-queue"     // Departmental backlog (LDEQ, DOTD, CPRA, Parish)
  | "rfis"             // RFI management and response reviews
  | "coordination"     // Interagency coordination requests (CR-00xxx)
  | "documents"        // Document review signoffs & Vault
  | "project"          // Authoritative / Customer Project Command Center
  | "notifications"    // Action-required, escalation & system alerts
  | "secondary"        // Secondary tools (Schedule, Vault, Catalog)
  | "admin"            // Team RBAC, participant visibility & intake triage
  | "detail"           // Comprehensive work item & assignment drilldown
  | "requests"         // Customer intake request center (6 guided intents)
  | "schedule"         // Customer-safe baseline vs forecast schedule
  | "contacts"         // Project directory & participant visibility
  | "help"             // Customer escalation & concierge assistance
  | "profile";         // Self-service contact & notification preferences
```

### 2.3 Modular Cockpit & Component Layout

Components under `components/` are cleanly decoupled by operational domain:

```
components/
├── admin/
│   └── AdminDirectory.tsx                    # Team user role toggles, workstream scoping & visibility
├── cockpits/
│   ├── ProjectOverviewPage.tsx               # High-level project KPIs, health cards, workstream list
│   ├── WorkstreamGraphGantt.tsx              # Gantt timeline, 12-column DAG table, state legend
│   ├── WorkflowDesignerPanel.tsx             # Versioned workflow templates, permit catalog, agency registry
│   ├── InteractiveScheduleSimulator.tsx      # "What-If" task duration perturbation & float simulator
│   ├── DailyCommandCenter.tsx                # Morning exception radar & standup review stepper
│   ├── InteragencyCoordinationPanel.tsx      # Interagency dependency matrix & CR management
│   ├── CommitmentsDecisionsPanel.tsx         # First-class commitments & formal decision records
│   ├── DocumentVaultPanel.tsx                # Project document repository & multi-version review status
│   ├── ExecutiveBriefingReport.tsx           # Printable/exportable Governor's executive summary
│   ├── PreApplicationReadinessPanel.tsx      # Pre-filing completeness checklists
│   ├── PublicTransparencyPortal.tsx          # Public docket, statutory hearings & transparency
│   └── SpaceXNoSurprises.tsx                 # Specialized customer plain-English status overview
├── documents/
│   └── DocumentViewerModal.tsx               # Exact-version document viewer & verified file downloader
└── ui/                                       # 30+ accessible Radix UI & Tailwind component primitives
```

---

## 3. Customer Portal vs Fulfiller / Agency / Admin Separation

PATH maintains a strict security and experience boundary between customer applicants (`SpaceX`) and government fulfillers / supervisors / admins.

### 3.1 Role & Permission Matrix

Roles are defined in `lib/demo-data.ts:234-285` and mapped to operational personas in `lib/operational-ux.ts:51-62`:

| Persona | Role Identifier | Organization / Agency | Workspace Mode | Default Permissions |
|---|---|---|---|---|
| **Alex Martin** | `submitter` | SpaceX Louisiana | `customer` | `submit_requests`, `escalate_liaison` |
| **Maya Chen** | `admin` (supervisor) | SpaceX Louisiana | `supervisor` | Full administrative & review permissions |
| **Sarah Johnson** | `admin` (state PM) | Governor's Major Projects | `state_office` | Full coordination, triage, escalation |
| **Jordan Lee** | `reviewer` | LDEQ Water Quality | `reviewer` | `edit_workflow`, `add_blockers`, `resolve_blockers` |
| **Sam Rivera** | `infrastructure` | DOTD District 03 | `agency` | `edit_workflow`, `add_blockers`, `resolve_blockers`, `escalate_liaison` |
| **Riley Brooks** | `community` | Vermilion Parish | `agency` | `edit_workflow` |
| **Joe Skaggs** | `admin` | LED / Space Czar | `admin` | `manage_roles`, `edit_workflow`, `submit_requests`, `add_blockers`, `resolve_blockers`, `escalate_liaison`, `reassign_agency` |

### 3.2 Customer View Sanitization & Plain-English Synthesis

The boundary is enforced at both data access (Supabase RLS) and presentation layers:

1. **Sanitized Queue Buckets** (`lib/operational-ux.ts:1199-1206`):
   - Fulfillers see: *Needs my action*, *Due today*, *Overdue*, *Waiting on others*, *Upcoming*.
   - Customers see: *Needs SpaceX*, *Needs Government*, *Blocked*, *Upcoming decisions*.
2. **Deterministic 6-Question Customer Summary** (`lib/engines/workflow-engine.ts:9-73`):
   Instead of raw internal agency chatter, the engine compiles structured answers:
   - **Who has it**: Reviewing agency and lead reviewer (e.g. `DOTD (District 03) — Assigned: Mark Fontenot, PE`).
   - **What they are doing**: Current active stage summary (e.g. `Structural and hydrology review`).
   - **Waiting for**: Structured blocker/dependency explanation.
   - **Action required from SpaceX**: Clear plain-English action (e.g. `Submit revised axle load distribution drawing`) or `None`.
   - **Target completion date**: Forecast completion date.
   - **Next expected event**: Milestone transition.
3. **Hidden Controls in Customer View**:
   - Customer views (`activePersona.isCustomer === true`) hide: internal government deliberations, numeric escalation levels (1-5), What-If schedule perturbation sliders, internal audit feeds, and agency reassignment tools.
   - Customer views expose: 6 guided request intents (`Requests & permits`), verified document downloads with SHA-256 integrity, customer-safe Gantt milestones, and contact directory.

---

## 4. Ticket Detail Views & ITSM Lifecycle Architecture

The Ticket Detail View (`app/page.tsx:1234-1280`) provides deep ITSM operational capabilities:

```
+----------------------------------------------------------------------------------------------------+
| Breadcrumbs: My Work > SpaceX Pecan Island > WS-LA82-HEAVYHAUL > LA-82 Heavy-Haul Access Road       |
+----------------------------------------------------------------------------------------------------+
| [YOUR ASSIGNMENT] LA-82 Heavy-Haul Access Road & Bridge Reinforcement    [BLOCKED (ACTION REQUIRED)]|
| Lead: Louisiana DOTD · Due: Sep 1, 2024 · Critical Path: YES · Schedule Float: -13 Days           |
+----------------------------------------------------------------------------------------------------+
| WORK ACTION BAR (Sticky):                                                                          |
| [Complete Step] [Request Information] [Mark Blocked] [Clear Blocker] [Ask for Help] [Escalate]    |
+----------------------------------------------------------------------------------------------------+
| LEFT COLUMN (1.15fr)                               | RIGHT COLUMN (0.85fr)                         |
|                                                    |                                               |
| 1. What you need to do                             | 1. Downstream Impact                          |
|    - Review assigned submittals & engineering data |    - CPRA Drainage clearance unlocks DOTD     |
|    - Why you're seeing this: Assigned reviewer     |      bridge work release                      |
|                                                    |    - Net project slip: +13 days               |
| 2. Active Blocker / RFI Record                     |                                               |
|    - CR-00451: Culvert 14B hydrodynamic concurrence| 2. Activity / Audit History (Immutable)       |
|    - Target: CPRA Coastal Engineering team         |    - 2026-08-30: RFI Response submitted       |
|                                                    |    - 2026-08-28: Blocker flagged by Reviewer  |
| 3. Required Checklist Gates                        |    - 2026-08-20: Route Survey completed       |
|    [x] Route Survey complete                       |                                               |
|    [x] Axle-load calculations verified             | 3. Upstream & Downstream Dependencies         |
|    [ ] Hydrologic model concurred by CPRA          |    - Upstream: WS-WETLANDS-PAD-A              |
|                                                    |    - Downstream: Rocket Stage 1 Delivery      |
| 4. Attached Document Packages                      |                                               |
|    - LA-82-Drainage-Model-v12.0.pdf (SHA-256)      |                                               |
|    [View Document] [Download Package]              |                                               |
+----------------------------------------------------------------------------------------------------+
```

### 4.1 Priority & RAG Matrix

- **RAG Status Decoupling**: RAG health (`green`, `yellow`, `red`) is explicitly decoupled from operational state (`running`, `waiting_government`, `waiting_applicant`, `waiting_external`, `scheduled_hold`, `statutory_waiting_period`, `blocked`, `escalated`, `complete`). A statutory public comment period pauses the review without falsely flagging the ticket as unhealthy red.
- **Priority Scoring** (`lib/operational-ux.ts:258-260`): Priority score (0-100) dynamically evaluates Critical Path status, overdue days, blocked dependencies, and imminent deadlines to order fulfiller work.

### 4.2 Statutory Clocks & SLA Engine

- **Statutory Clock Suspension**: When an RFI is issued to an applicant (`clockImpact: "clock_paused"`), the statutory deadline clock freezes. The reason and clock state persist to Supabase (`lib/repository.ts:862`, `1607-1633`).
- **5-Tier Escalation Hierarchy** (`lib/engines/escalation-engine.ts:34-89`):
  - **Level 0 (Day 0-7)**: Reviewer active analysis.
  - **Level 1 (Day 8)**: Reviewer warning threshold (75% SLA).
  - **Level 2 (Day 10)**: Section Supervisor notified.
  - **Level 3 (Day 12)**: Agency Project Liaison engaged.
  - **Level 4 (Day 15)**: State Project Office intervention (`Sarah Johnson`).
  - **Level 5 (Variance > 5d on Critical Path / Deadlock)**: Governor's Executive Megaproject Review.

---

## 5. Workflow Execution & DAG Analysis

### 5.1 Mathematical DAG Solver (`lib/engines/schedule-engine.ts`)

The schedule engine implements a complete **Critical Path Method (CPM)** solver on the execution graph:
1. **Forward Pass** (`calculateEarlyStartEarlyFinish`): Computes earliest start ($ES$) and earliest finish ($EF$) for all nodes via topological memoization.
2. **Backward Pass** (`calculateLateStartLateFinish`): Computes latest start ($LS$) and latest finish ($LF$) from project end date.
3. **Total Float Calculation**: Float $= LS - ES$. Any node with $\text{Float} \le 0$ is tagged as `isCriticalPath: true`.
4. **Variance Attribution**: Aggregates delays into 12 taxonomy categories (`applicant_information`, `interagency_dependency`, `statutory_minimum`, `environmental_discovery`, etc.).

### 5.2 What-If Scenario Simulator (`lib/engines/simulation-engine.ts`)

The simulator allows government supervisors to perturb task durations (e.g. $+15\text{d}$ USACE Public Notice, $-10\text{d}$ CPRA Fast-Track) and immediately observe:
- Project launch date shift ($\Delta\text{ days}$).
- Critical path flips (identifying non-critical tasks that become controlling).
- Fragility scoring (ranking tasks by float buffer from 0 to 100).

### 5.3 Template Workflow Designer (`components/cockpits/WorkflowDesignerPanel.tsx`)

The template designer manages global workflow templates and version publications:
- Calls `rpc_create_workflow_draft` to fork a published version into a mutable draft.
- Edits draft stage configurations (`rpc_update_workflow_draft_stage`).
- Validates structural invariants and publishes (`rpc_publish_workflow_version`).

---

## 6. Technical Gaps & Required In-Ticket Workflow Editor

To fulfill Requirement **R2** ("In-Ticket Workflow Editor & Execution Engine") and allow authorized fulfillers/state workers to modify workflow DAG nodes directly on any ticket, the following technical gaps must be resolved:

```
+-------------------------------------------------------------------------------------------------------+
| CURRENT STATE (Template-Only & Sequential Stage)  | REQUIRED STATE (In-Ticket Dynamic DAG Modification)|
+-------------------------------------------------------------------------------------------------------+
| 1. Workflows edited at global template level      | 1. Workflows editable directly on individual live |
|    only (affecting future versions, not instances)|    tickets/workstreams                            |
| 2. Progression is linear stage sequence          | 2. Progression follows arbitrary DAG dependencies |
|    (Stage 1 -> Stage 2 -> Stage 3)               |    with parallel forks, joins, and review gates   |
| 3. Fixed stages from database template            | 3. Fulfillers can insert custom milestones,       |
|                                                   |    ad-hoc hearing tasks, or sub-reviews on the fly|
| 4. Workstream owner is at the ticket level        | 4. Fulfillers can assign specific agencies/users  |
|                                                   |    per individual DAG node/step                   |
| 5. Static Gantt bars and metrics table            | 5. Interactive node graph (add, delete, reorder,  |
|                                                   |    drag dependency edges, toggle blocker state)   |
| 6. Step advancement via sequential RPC            | 6. Granular node execution & immediate persistence|
+-------------------------------------------------------------------------------------------------------+
```

### Specific Technical Gaps Identified

| # | Gap Area | Current Limitation in Codebase | Technical Requirement for Completion |
|---|---|---|---|
| **G1** | **In-Ticket Workflow Node CRUD** | Database has `tasks` and `task_dependencies` tables, but no UI in Ticket Detail or Workstream view allows adding/deleting tasks on a ticket. | Create in-ticket "Add Step / Milestone", "Edit Step", and "Remove Step" UI with immediate Supabase persistence. |
| **G2** | **Interactive DAG Dependency Reordering** | Task dependencies are statically initialized from fixtures or templates; no UI exists to connect, disconnect, or reorder predecessor/successor edges on a live ticket. | Implement interactive DAG editor allowing fulfillers to alter dependencies (`predecessorTaskIds`), lag days, and gate types (`AND`/`OR`). |
| **G3** | **Per-Step Assignee & Agency Assignment** | `workstreams` table has `regulatory_lead` at top level; tasks have `assigned_org_id` and `assigned_user_id` but UI does not provide step-level reassignment dropdowns. | Provide assignee picker (agency + individual fulfiller) per workflow step/node directly inside the ticket view. |
| **G4** | **Step-Level Review Gates & Criteria** | Checklist gates are statically defined on template stages (`workflow_stages.completion_requirements`). | Enable fulfillers to attach custom checklist criteria or document validation gates to specific steps on a ticket. |
| **G5** | **Direct Node Execution & Blocker Toggling** | Only the current active workstream stage can be advanced via `rpc_complete_workstream_stage` or blocked via `rpc_mark_workstream_blocked`. | Allow authorized fulfillers to click any DAG node to toggle state (`pending` $\leftrightarrow$ `in_progress` $\leftrightarrow$ `completed` $\leftrightarrow$ `blocked`) with automated critical path recalculation. |
| **G6** | **Atomic Persistence & Audit Trail** | Repository has methods for workstream status updates, but lacks atomic mutations for in-ticket DAG modifications. | Create Supabase RPCs: `rpc_add_ticket_task`, `rpc_update_ticket_task`, `rpc_delete_ticket_task`, `rpc_update_task_dependencies` with automatic `audit_events` logging. |

---

## 7. Proposed Solution Architecture for In-Ticket DAG Editor

### 7.1 Component Architecture

```
components/cockpits/
└── InTicketWorkflowEditor.tsx                # Embedded in Ticket Detail & Workstream views
    ├── WorkflowGraphCanvas.tsx               # Visual node-and-edge interactive DAG graph
    ├── WorkflowNodeInspector.tsx             # Slide-over panel to edit step title, owner, agency, SLA, gates
    ├── AddStepModal.tsx                      # Modal to insert new custom milestone / review gate
    └── DependencyConnectorModal.tsx          # Manage predecessor / successor relationships
```

### 7.2 Database & Supabase RPC Primitives

1. **`rpc_mutate_ticket_workflow_step`**:
   - Accepts `p_workstream_id`, `p_task_id` (null for new), `p_title`, `p_task_type`, `p_assigned_org_code`, `p_assigned_user_id`, `p_duration_days`, `p_is_milestone`, `p_is_critical_path`, `p_predecessors`, `p_actor_name`.
   - Inserts or updates row in `public.tasks` and synchronizes `public.task_dependencies`.
   - Emits immutable `public.audit_events` entry (`action_type: "workflow_step_modified"`).
2. **`rpc_delete_ticket_workflow_step`**:
   - Removes task, cascades/re-links dependent edges, and records audit trail.
3. **`rpc_set_ticket_step_state`**:
   - Updates task status (`completed`, `in_progress`, `blocked`, `waived`).
   - If marked blocked, prompts for reason and creates linked RFI or Coordination Request.

### 7.3 State Management & Realtime Sync

1. Calling the mutation RPC updates Supabase PostgreSQL.
2. The browser's Supabase Realtime channel (`public-db-realtime-changes` in `app/page.tsx:412-434`) receives the change, invokes `repository.hydrateFromSupabase()`, and recalculates project schedule metrics via `evaluateProjectSchedule()`.
3. The Gantt chart, timeline bars, and ticket detail views instantly refresh to reflect the new critical path and forecast dates.

---

## 8. Conclusion

The existing codebase contains excellent foundations: a mathematically rigorous CPM schedule solver, multi-horizon Gantt visualization, decoupled RAG/state architecture, and strong customer-sanitization rules. Implementing the in-ticket interactive workflow DAG editor will bridge the gap between static template versioning and dynamic real-world project operations, fulfilling the core objectives of the ITSM platform transformation.
