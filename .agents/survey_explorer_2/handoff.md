# Handoff Report — UI & Workflow Engine Architecture Survey

**Agent**: `survey_explorer_2` (role: UI & Workflow Engine Explorer)  
**Parent Agent**: `parent` (`6c0c2ad6-b060-4ca1-812d-09c87e71801e`)  
**Timestamp**: 2026-08-31T13:17:00Z  
**Deliverables**:
- Detailed Analysis: `/Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_2/analysis.md`
- Handoff Summary: `/Users/joe/Repos/Permit/permit_tracker/.agents/survey_explorer_2/handoff.md`

---

## 1. Observation

1. **Routing & SPA Layout**:
   - `app/page.tsx:119-120`: Internal state-driven navigation defines 15 distinct routes: `my-work`, `agency-queue`, `rfis`, `coordination`, `documents`, `project`, `notifications`, `secondary`, `admin`, `detail`, `requests`, `schedule`, `contacts`, `help`, and `profile`.
   - `app/projects/[projectNumber]/page.tsx:1-19`, `app/projects/[projectNumber]/workstreams/[workstreamId]/page.tsx:1-19`, `app/requests/[confirmationNumber]/page.tsx:1-17`, `app/admin/workflows/page.tsx:1-16`: Next.js App Router dynamic SSR routes.
   - `app/page.tsx:412-434`: Live multi-browser synchronization via Supabase Realtime channel `public-db-realtime-changes`.

2. **Customer vs Fulfiller Role Separation**:
   - `lib/demo-data.ts:234-285` & `lib/operational-ux.ts:51-62`: RBAC definitions for 6 operational workspaces: `reviewer`, `agency`, `supervisor`, `state_office`, `customer`, `admin`.
   - `lib/operational-ux.ts:691-702` (`sanitizeCustomerItem`): Filters out internal deliberations, notes, and raw government chatter from customer views.
   - `lib/engines/workflow-engine.ts:9-73` (`generateSixQuestionsSummary`): Compiles deterministic plain-English customer narratives answering *Who has it*, *What they are doing*, *Waiting for*, *Action required from SpaceX*, *Target completion date*, and *Next expected event*.
   - `lib/operational-ux.ts:1199-1206`: Queue group labels adapt dynamically: customer views display `Needs SpaceX`, `Needs Government`, `Blocked`, and `Upcoming decisions`.

3. **Ticket Detail Views & ITSM Operations**:
   - `app/page.tsx:1172-1197` (`renderWorkCard`) & `app/page.tsx:1234-1280` (`renderDetail`): Work cards display assignment reasons, SLA due dates, statutory clock status, schedule float impact, and next handoff.
   - `app/page.tsx:1288-1300` (`renderDialog`): Work Action Bar provides actions for `complete_step`, `request_information`, `mark_blocked`, `clear_blocker`, `transfer`, `escalate`, `add_note`, `approve_document`, and `request_revision`.
   - `lib/engines/escalation-engine.ts:34-89`: 5-tier escalation engine tracking elapsed days (Day 0-7 Reviewer, Day 8 Warning, Day 10 Supervisor, Day 12 Liaison, Day 15 State Office, Day 20+ Executive Task Force).

4. **Workflow Execution & DAG Capabilities**:
   - `lib/engines/schedule-engine.ts:47-137` (`solveTaskDAG`): Implements Critical Path Method (CPM) with forward pass, backward pass, total float computation ($LF - EF$), and critical path identification ($\text{Float} \le 0$).
   - `lib/engines/simulation-engine.ts:152-251` (`applyTaskAdjustment`): Perturbs task durations and cascades schedule float / launch date adjustments.
   - `components/cockpits/WorkstreamGraphGantt.tsx:503-709`: Traditional Gantt schedule bars rendering past baseline, current execution, and future forecast horizons.
   - `components/cockpits/WorkflowDesignerPanel.tsx:30-120`: Global template draft creation, stage editing, and validation/publishing RPCs (`rpc_create_workflow_draft`, `rpc_update_workflow_draft_stage`, `rpc_publish_workflow_version`).
   - `supabase/migrations/20260830200000_workflow_execution_engine.sql:78-193`: `rpc_complete_workstream_stage` validates checklist gates and advances workstreams through sequential stages.

5. **In-Ticket Workflow Modification Gap**:
   - `components/cockpits/WorkflowDesignerPanel.tsx` modifies *global workflow templates* (`workflow_templates`, `workflow_versions`, `workflow_stages`), not individual live tickets.
   - `app/page.tsx:1234-1280` (`renderDetail`) and `app/projects/[projectNumber]/workstreams/[workstreamId]/page.tsx` display current stage and tasks, but provide **no UI controls to add, delete, reorder, reassign, or alter dependencies of workflow steps on an individual ticket**.

---

## 2. Logic Chain

1. **Premise 1**: The user requirements (R2 & Acceptance Criteria) stipulate that authorized fulfillers, state workers, and admins must be able to click into any ticket's workflow and interactively edit DAG nodes, reorder steps, change assignees/agencies, add review gates, and advance/block execution with immediate persistence.
2. **Premise 2**: Observation 4 demonstrates that PATH possesses a complete mathematical DAG solver (`schedule-engine.ts`), What-If simulator (`simulation-engine.ts`), and template designer (`WorkflowDesignerPanel.tsx`).
3. **Premise 3**: Observation 5 demonstrates that workflow modification in the current UI is strictly template-scoped. Live ticket execution is driven by sequential stage transitions (`rpc_complete_workstream_stage`), and ticket detail views lack in-line DAG editing controls.
4. **Conclusion**: To satisfy R2, the system requires:
   - An interactive in-ticket workflow DAG editor component embedded in the ticket detail view.
   - Supabase RPC mutation primitives for task-level CRUD and dependency edge reordering on live tickets.
   - Realtime recomputation of critical path float and Gantt horizons upon step modification.

---

## 3. Caveats

- **Existing Data Invariants**: The existing test suite (`tests/*.test.mjs`) tests fixed fixture contracts and template versioning. In-ticket workflow mutations must ensure backward compatibility with existing tests and demo fallback modes (`allowsFixtureData()`).
- **External Filings Boundary**: For authorizations managed externally (e.g. USACE, LPSC), PATH tracks milestone status, but authoritative statutory decisions remain with the respective agency systems.

---

## 4. Conclusion

The PATH UI architecture is well-structured, modular, and cleanly separates customer views from government operations. The primary technical gap is the absence of an **In-Ticket Interactive Workflow DAG Editor** that operates on live ticket instances. Implementing the proposed in-ticket editor component with supporting Supabase RPCs will satisfy Requirement R2 and elevate PATH into a premier ITSM and project operations platform.

---

## 5. Verification Method

To independently verify the observations in this report:

1. **Inspect UI Views & Routing**:
   - View `app/page.tsx` (lines 118-121, 1167-1280) to inspect routing, navigation, customer view sanitization, and ticket detail rendering.
2. **Inspect Schedule Engine & Solver**:
   - View `lib/engines/schedule-engine.ts` (lines 47-137) to verify the DAG CPM topological solver.
3. **Inspect Workflow Designer vs In-Ticket Capabilities**:
   - View `components/cockpits/WorkflowDesignerPanel.tsx` to confirm template-only editing scope.
4. **Run Existing Test Suite**:
   ```bash
   node --test tests/*.test.mjs
   ```
   Confirm all unit, integration, and SSR tests pass.
