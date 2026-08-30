# Critical Path — SpaceX Louisiana Project Operations

## Operational UX

PATH now opens authenticated users into a role-aware workspace instead of a cockpit selector. Reviewers land on **My Work**, where prioritized cards explain why a work item is assigned, what action is required, the due date, wait time, schedule impact, and what removes it from the queue. The reusable Work Action Bar keeps **Complete Step**, **Request Information**, **Mark Blocked**, **Ask for Help / Transfer**, **Escalate**, and **Add Note** visible at the point of work.

Completion and blocked flows use the existing audited workflow/repository layer. Completion shows configured requirements and the next handoff. A blocked reviewer selects a plain-language reason; PATH creates an RFI for SpaceX, a Coordination Request for another agency, an internal blocker, or a structured statutory wait, then previews recipients and the customer-safe status message.

Supervisors see an operational exception queue. The State Project Office sees cross-agency exceptions. SpaceX sees a sanitized **Needs SpaceX / Needs Government / Blocked / Upcoming decisions** workspace without internal government controls. See [docs/operational-ux.md](docs/operational-ux.md) for the reviewer, supervisor, State Project Office, and SpaceX journeys.

**Critical Path** is an accessible, multi-agency operational coordination and permit tracking platform for the **SpaceX Louisiana Pecan Island Launch Complex** project. It brings together state infrastructure requests, statutory permit tracking, critical path milestones, agency workload distribution, role-based access control, workflow flow editing, and executive escalation across Federal, State, and Local Louisiana departments.

---

## Key Capabilities

### 1. Operations Overview & Gantt Timeline
- **Interactive Gantt Chart**: Visual 2024 phase progression spanning route surveys, technical review, inter-agency clearances, public hearings, and final determinations across all government stakeholders.
- **RAG Status Summaries**: Clickable rollups for 🟢 **On Track**, 🟡 **Action Needed / Public Hearing**, 🔴 **Blocked**, and ⚡ **Critical Path**. Clicking any status dynamically filters the project requests.
- **Active Blockers Spotlight**: Directly surfaces active roadblocks (e.g. `TASK-T001` bridge reinforcement blocked on CPRA drainage concurrence), days elapsed, and immediate unblocking actions.
- **Human-Readable Task IDs**: Standardized identifiers (`TASK-T001` through `TASK-T009`) with clear reviewing agency and jurisdiction levels.

### 2. Multi-Level Agency Review & Jurisdiction Tracking
Every project request notes the Reviewing Agency and its Jurisdiction Level:
- **Federal**: FAA Southwest Region (Airspace NOTAMs), US Coast Guard District 8 (Maritime safety corridors), US Army Corps of Engineers (USACE Section 404), FCC (Spectrum clearance).
- **State**: Louisiana DOTD (Highway LA-82 & heavy-haul bridges), LDEQ (Water quality & deluge basins), CPRA (Coastal protection & wetland mitigation), Office of State Fire Marshal (OSFM cryogenic storage), Louisiana State Police (LSP escort & safety), Louisiana Economic Development (LED FastStart).
- **Local / Parish**: Vermilion Parish Police Jury, Vermilion Parish Building Department, Louisiana Department of Health (LDH).
- **Utility / Regional**: Entergy Louisiana & Louisiana Public Service Commission (LPSC 230kV transmission).

### 3. Role-Based Access Control & Permission Management
- **Admin Access Control Panel**: Authorized administrators and program supervisors can modify user roles and assign granular permissions across the team.
- **Role Hierarchy**:
  - `admin`: Program Administrator / Supervisor (manage roles, edit workflows, reassign agencies, resolve blockers).
  - `submitter`: SpaceX Project Lead / Submitter (submit needs, track milestones, escalate).
  - `reviewer`: Agency Technical Reviewer (review submittals, advance workflow stages, flag blockers).
  - `infrastructure`: Infrastructure & Utility Lead (civil bridge reinforcements, power interconnects).
  - `community`: Community & Hearing Coordinator (parish hearings, public notices).
  - `viewer`: Applicant / Stakeholder (view-only access).
- **Granular Permissions**: Live checkbox toggles for `manage_roles`, `edit_workflow`, `submit_requests`, `add_blockers`, `resolve_blockers`, `escalate_liaison`, and `reassign_agency`.

### 4. Interactive Request Workflow Flow Editor
- **Dynamic Step States**: Change any step to `Done`, `Active`, `Blocked`, `Hearing`, or `Future`.
- **Advance Workflow**: One-click advance button that marks current active stage as completed and activates the subsequent stage in sequence.
- **Custom Milestone Insertion**: Add new phases, custom review tasks, target dates, and state flags on the fly as requests evolve.
- **Blocker Flagging & Resolution**: Modal dialog to flag critical roadblocks (updating RAG status to Red and creating action items) and instant resolution action to unblock workflows.
- **Agency & Jurisdiction Reassignment**: Dynamically update lead agency and jurisdiction level (Federal, State, Local/Parish, Utility/Regional).

### 5. SpaceX Plain-English Intake & Liaison Triage
- Conversational natural language intake textarea with live heuristic triage analysis that auto-detects category, suggests lead agency, determines priority, flags critical path candidates, and provides statutory filing instructions.
- Live submission directly routes new items into the project matrix and Liaison Triage Queue.

### 6. Interactive Request Matrix & Dedicated Detail Pages
- **Expandable Inline Summaries**: Quick expansion of milestone steps, active blockers, assigned state owners, quick workflow actions, and next steps right within the list.
- **Dedicated Detail Drilldown**: Complete 5-phase timeline, 3-tier escalation hierarchy (`engaged`, `escalated`, `idle`), contact channels, workflow editor toolbar, and statutory docket notices.

## Customer Portal and E2E Boundary

The SpaceX customer workspace opens with a project command center for the Pecan Island Launch Complex. Its primary navigation includes Project Home, My Actions, Requests & Permits, Schedule, Documents, Contacts, Help & Escalation, and Notifications. Customer-safe Schedule exposes baseline/forecast dates, dependencies, agency-owned milestones, and workstream detail without internal reviewer notes or what-if controls.

Requests & Permits provides six guided intents: permit/authorization, government help/service, project question, blocker/coordination, escalation, and concierge (“I’m not sure what I need”). Permit records show prerequisites, statutory timing, official resources, agency contacts, and whether filing is PATH-supported or remains in an external authoritative system. Customer requests receive a `PATH-YYYY-NNNN` confirmation and are visible to the state project office.

The customer document center creates immutable revisions with file metadata and SHA-256 tracking, exact-version downloads, and agency review assignments. Contacts and My Profile separate editable contact fields from administrator-controlled organization, role, capability, and visibility. The deterministic local demo state persists through browser refresh using `localStorage`; run `node scripts/reset-e2e-demo.mjs` before a clean E2E process.

See [docs/testing/manual-e2e-guide.md](docs/testing/manual-e2e-guide.md), [docs/testing/playwright-handoff.md](docs/testing/playwright-handoff.md), and [docs/testing/playwright-scenarios.json](docs/testing/playwright-scenarios.json) for acceptance flows and stable scenario IDs.

---

## Demo Personas & Sign-In

Critical Path provides direct sign-in on the main page along with an account menu in the top right and a **Quick Demo Sign-In** selector with 9 pre-configured personas:

### SpaceX Louisiana Program Team
| Persona | Role | Scenario | Email |
|---|---|---|---|
| **Alex Martin** | Customer / Submitter | SpaceX Louisiana project lead submitting requests | `alex.martin@spacex.com` |
| **Maya Chen** | Program Supervisor | SpaceX regulatory program supervisor | `maya.chen@spacex.com` |
| **Jordan Lee** | Environmental Reviewer | LDEQ / environmental quality technical reviewer | `jordan.lee@la.gov` |
| **Sam Rivera** | Infrastructure Lead | DOTD / civil engineering and utility coordinator | `sam.rivera@la.gov` |
| **Riley Brooks** | Community Coordinator | Vermilion Parish / local government liaison | `riley.brooks@vermilionparish.org` |
| **Joe Skaggs** | PATH Administrator | LED administrator / Space Czar | `joe.skaggs@la.gov` |

### Applicant Scenarios (Password: `demo1234`)
| Persona | Role | Scenario | Email / Username |
|---|---|---|---|
| **Jordan Thibodaux** | Standard Review Applicant | Water quality permit under standard review | `applicant.happypath` |
| **Marcus Fontenot** | Action Required Applicant | Suspended permit requiring document upload | `applicant.suspended` |
| **Celeste Broussard** | Public Hearing Applicant | Permit undergoing scheduled public hearing | `applicant.hearing` |

---

## Technical Stack & Architecture

- **Framework**: Next.js (App Router) powered by Vinext (Vite 8) + React 19 + TypeScript
- **Styling & UI**: Tailwind CSS, Radix UI primitives, Lucide Icons
- **Data & Utilities**:
  - `lib/demo-data.ts`: Typed request entities, RAG classifications, escalation tiers, Gantt data, role definitions, and Pecan Island demo dataset.
  - `lib/permit-utils.ts`: Progress calculations, RAG aggregators, workload distribution, and plain-English intake triage.
  - `lib/supabase-browser.ts`: Optional Supabase integration for authenticated live workloads.
- **Testing**: Node.js built-in test runner (`node --test tests/*.test.mjs`) covering 100% of data invariants, source contracts, UI components, and SSR output.

---

## Running & Verifying Locally

### 1. Build
```bash
npx vinext build
```

### 2. Run Test Suite
```bash
node --test tests/*.test.mjs
```
