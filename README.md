# Critical Path — SpaceX Louisiana Project Operations

**Critical Path** is an accessible, multi-agency operational coordination and permit tracking platform for the **SpaceX Louisiana Pecan Island Launch Complex** project. It brings together state infrastructure requests, statutory permit tracking, critical path milestones, agency workload distribution, and executive escalation across Federal, State, and Local Louisiana departments.

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

### 3. Unified Request Model & SpaceX Plain-English Intake
- Conversational natural language intake textarea with live heuristic triage analysis that auto-detects category, suggests lead agency, determines priority, flags critical path candidates, and provides statutory filing instructions.
- Live submission directly routes new items into the project matrix and Liaison Triage Queue.

### 4. Interactive Request Matrix & Dedicated Detail Pages
- **Expandable Inline Summaries**: Quick expansion of milestone steps, active blockers, assigned state owners, and next steps right within the list.
- **Dedicated Detail Drilldown**: Complete 5-phase timeline, 3-tier escalation hierarchy (`engaged`, `escalated`, `idle`), contact channels, and statutory docket notices.

---

## Demo Personas & Sign-In

Critical Path provides direct sign-in on the main page along with an account menu in the top right and a **Quick Demo Sign-In** selector with 8 pre-configured personas:

### SpaceX Louisiana Program Team
| Persona | Role | Scenario | Email |
|---|---|---|---|
| **Alex Martin** | Customer / Submitter | SpaceX Louisiana project lead submitting requests | `alex.martin@spacex.test` |
| **Maya Chen** | Program Supervisor | Spaceport program supervisor managing approvals | `maya.chen@spacex.test` |
| **Jordan Lee** | Environmental Reviewer | LDEQ / environmental quality technical reviewer | `jordan.lee@spacex.test` |
| **Sam Rivera** | Infrastructure Lead | DOTD / civil engineering and utility coordinator | `sam.rivera@spacex.test` |
| **Riley Brooks** | Community Coordinator | Public hearings & local government liaison | `riley.brooks@spacex.test` |

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
  - `lib/demo-data.ts`: Typed request entities, RAG classifications, escalation tiers, Gantt data, and Pecan Island demo dataset.
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
