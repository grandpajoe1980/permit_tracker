# Government Service Request and Permit Command Center — Execution Plan

## 1. Objective
Evolve PATH from a permit tracker into a comprehensive **Government Service Request and Permit Command Center** for the **SpaceX Pecan Island Launch Complex** project in Louisiana. The platform acts as an operational tracking, cross-agency coordination, and escalation center spanning permits, roads, utilities, public safety, workforce, and community infrastructure.

## 2. Positioning & Boundaries
- **Demo-Ready Storytelling**: Focus on clarity, visual impact, and realistic project milestones rather than deep security or production hardening.
- **Unified Request Object**: Any request can be a permit, road access request, utility interconnection, public safety plan, workforce initiative, or community item.
- **Pervasive Disclaimer**: Prominently emphasize that official statutory filings continue in designated agency portals; PATH provides tracking, visibility, and escalation.

## 3. Requirements Matrix

| ID | Requirement | Priority | Status | Description | Verification |
|---|---|---|---|---|---|
| REQ-OBJ-01 | Unified Service Request Object | P0 | Planned | Model requests across `permit`, `road`, `utility`, `public_safety`, `workforce`, `community` with owners, blockers, escalation paths, and next actions | `tests/permit-data.test.mjs` |
| REQ-DATA-01 | Pecan Island Demo Dataset | P0 | Planned | Realistic multi-agency requests for SpaceX Louisiana with real timelines, blockers, and dependencies | `tests/permit-data.test.mjs` |
| REQ-EXEC-01 | Executive Command Center Dashboard | P0 | Planned | RAG status summary (Green/Yellow/Red), Critical Path visualizer, 30/60-day deadlines, and agency workload distribution | UI component & contract tests |
| REQ-INTAKE-01 | Plain-English SpaceX Intake & Triage | P0 | Planned | Conversational intake form that parses needs, auto-assigns category & agency, and routes to liaison triage queue | Journey tests & contract tests |
| REQ-DETAIL-01 | Detailed Request & Escalation View | P0 | Planned | Step-by-step milestone timeline, active blockers, direct agency owner, and 3-tier escalation path | Manual & contract tests |
| REQ-NOTICE-01 | Pervasive Official Filing Disclaimer | P0 | Planned | Visible disclosure that PATH is for operational coordination and official filings happen elsewhere | `tests/source-contract.test.mjs` |
| REQ-DOCS-01 | Positioning & README Overhaul | P0 | Planned | Updated README and docs reflecting the Command Center mission | Documentation review |

## 4. Task Dependency Graph

```text
WAVE 1 (Data & Architecture)
  `-- REQ-OBJ-01 & REQ-DATA-01: lib/demo-data.ts & lib/permit-utils.ts
        |
WAVE 2 (Fullstack UI & Command Center)
  `-- REQ-EXEC-01 + REQ-INTAKE-01 + REQ-DETAIL-01 + REQ-NOTICE-01: app/page.tsx
        |
WAVE 3 (QA & Testing)
  `-- Test updates across permit-data, source-contract, and ui-components
        |
WAVE 4 (Documentation & Checkpoint)
  `-- REQ-DOCS-01: README.md, docs/progress.md, execution-plan.md
```

## 5. Work Waves

### Wave 1 — Domain Data & Schemas
- Define `RequestType`, `RAGStatus`, `EscalationTier`, `ServiceRequest` types in `lib/demo-data.ts`.
- Build comprehensive SpaceX Pecan Island project dataset with realistic inter-agency dependencies (DOTD, LDEQ, Entergy/LPSC, Vermilion Parish, CPRA/USACE, FAA/USCG, LED/SLCC, OSFM/GOHSEP).
- Implement utilities in `lib/permit-utils.ts` for RAG computation, category filtering, workload aggregation, critical path detection, and intake parsing.

### Wave 2 — Command Center UI & Plain-English Intake
- Executive Summary Bar with RAG badges and critical path badge.
- Interactive category filter tabs (`All`, `Permits`, `Roads`, `Utilities`, `Public Safety`, `Workforce`, `Community`).
- SpaceX Plain-English Intake card with instant category detection, estimated lead agency, and direct submission to the Liaison Triage Queue.
- Agency Workload distribution overview card.
- Upcoming statutory and agency decision deadlines card.
- Deep request detail view with Blocker Banner, Escalation Matrix, and immediate next steps.
- Prominent official filing disclaimers in header, login, dashboard, and detail views.

### Wave 3 — Testing & Verification
- Expand test suite in `tests/permit-data.test.mjs` and `tests/source-contract.test.mjs`.
- Execute `vinext build` and `node --test tests/*.test.mjs`.

### Wave 4 — Documentation & Positioning
- Rewrite `README.md` to reflect the Government Service Request and Permit Command Center.
- Update `docs/progress.md`.
