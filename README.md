# PATH — Government Service Request & Permit Command Center

PATH is an accessible, multi-agency operational command center and permit tracking platform for the **SpaceX Louisiana Pecan Island Launch Complex** project. It unifies state infrastructure requests, statutory permit tracking, critical path milestones, agency workload distribution, and executive escalation across Louisiana departments.

> [!NOTE]
> **Operational Tracking Boundary Notice**: PATH is a state-level operational coordination and escalation command center. Official statutory applications, formal permit filings, and legal records continue through each agency's designated system of record (e.g. LDEQ EDMS, Louisiana DOTD, LPSC, CPRA, OSFM, and local Parish building offices).

---

## Core Capabilities

### 1. Unified Service Request Model
Every project need is modeled as a first-class `ServiceRequest` across six key disciplines:
- **Environmental & Facility Permits (`permit`)**: LDEQ air/water quality permits, CPRA coastal use permits, parish industrial building permits.
- **Heavy-Haul & Access Roads (`road`)**: DOTD state highway reinforcement (LA-82), oversized bridge permits, and transport route clearances.
- **Utilities & Grid Interconnection (`utility`)**: Entergy / LPSC 230kV dual-feed high-capacity transmission, substation right-of-ways, and industrial deluge water connections.
- **Airspace, Maritime & Public Safety (`public_safety`)**: FAA launch corridor NOTAMs, US Coast Guard maritime closures, State Police escorts, and Fire Marshal (OSFM) cryogenic storage safety.
- **Workforce Development (`workforce`)**: Louisiana Economic Development (LED FastStart) and SLCC aerospace technician training pipelines.
- **Parish & Community Liaison (`community`)**: Vermilion Parish Police Jury coordination, baseline drinking water monitoring, and local town halls.

### 2. Executive RAG Dashboard & Critical Path Visibility
- **RAG Status Summaries**: Real-time rollups of requests categorized as 🟢 **On Track**, 🟡 **Action Needed / Public Hearing**, and 🔴 **Blocked / Risk**.
- **Critical Path Highlighting**: Direct visual tracking of items whose delays threaten the project go-live date.
- **Active Blocker Banners**: Immediate visibility into root cause blockers, days elapsed, and concrete unblocking actions.
- **Three-Tier Escalation Path**: Clear routing hierarchy from Level 1 (Agency Lead) → Level 2 (Inter-Agency State Liaison) → Level 3 (Governor's Major Project Task Force).

### 3. Plain-English SpaceX Intake & Liaison Triage
- Interactive plain-English intake textarea for engineers and managers to submit needs in natural language.
- Heuristic triage parser automatically infers request category, suggests lead agency, determines priority, flags critical path candidates, and routes the request into the live dashboard and Liaison Triage Queue.

### 4. Cross-Agency Workload & Upcoming Deadlines
- Real-time distribution of open tasks across DOTD, LDEQ, CPRA, LPSC/Entergy, LED, OSFM, LSP, and Vermilion Parish.
- 30/60-day decision deadline ticker.

---

## Demo Personas & Quick Sign-In

PATH includes a **Demo Login** dropdown at the top of the sign-in view with 8 pre-configured personas:

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
  - `lib/demo-data.ts`: Typed request entities, RAG classifications, escalation tiers, Pecan Island demo dataset.
  - `lib/permit-utils.ts`: Progress calculations, RAG aggregators, workload distribution, plain-English intake triage.
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

---

## Scope & Security Notice

This application is a demo-stage proof of concept showcasing government service request tracking and inter-agency coordination. Client-side authentication and demo fixtures do not constitute a security boundary. Production deployment requires formal single sign-on (SSO), server-enforced role-based access control (RBAC), direct REST/API sync with authoritative agency databases, and statutory compliance certification.
