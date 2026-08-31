# BRIEFING — 2026-08-31T13:13:28Z

## Mission
Transform SpaceX Louisiana Critical Path / PATH system into an ITSM & Project Management platform with multi-agency tenancy, in-ticket workflow modification, reliable document downloads, and Supabase persistence.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: /Users/joe/Repos/Permit/permit_tracker/.agents/orchestrator
- Original parent: parent
- Original parent conversation ID: 4bd5b791-f862-4712-8d75-9f94573c4943

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: /Users/joe/Repos/Permit/permit_tracker/PROJECT.md
1. **Decompose**: Survey codebase via 3 Explorers / Spec Miners, map architecture and feature inventory in PROJECT.md, decompose into milestone tracks (Implementation + E2E Testing).
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: For sub-orchestrators: Explorer → Worker → Reviewer → Challenger → Auditor loop.
   - **Delegate (sub-orchestrator)**: Spawn milestone sub-orchestrators and E2E testing orchestrator.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Survey & Architecture Mapping [done]
  2. Project Decomposition & PROJECT.md [done]
  3. E2E Testing Track & Milestone 1 (Data Model & Tenancy) [in-progress]
  4. Milestone 2 (ITSM UI & Queues) [pending]
  5. Milestone 3 (In-Ticket Workflow DAG Engine) [pending]
  6. Milestone 4 (Document Downloads & Persistence Sync) [pending]
  7. Final Milestone E2E & Hardening [pending]
- **Current phase**: 2 (Dispatch & Execution)
- **Current focus**: Launching E2E Testing Track in parallel with Milestone 1 Iteration Loop

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- Audit Enforcement: Forensic Auditor binary veto.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Include path to ORIGINAL_REQUEST.md in every subagent dispatch.

## Current Parent
- Conversation ID: 4bd5b791-f862-4712-8d75-9f94573c4943
- Updated: not yet

## Key Decisions Made
- Selected Project pattern with parallel Survey phase completed.
- Created master PROJECT.md with 16 features across 5 milestones + E2E testing track.
- Dispatched E2E Testing Track and Milestone 1 (ITSM & Multi-Tenancy Data Model & Supabase Persistence).

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| survey_explorer_1 | teamwork_preview_explorer | Data Model & Persistence Survey | completed | 05fd6815-9f3a-4e87-97f4-05315c4c1234 |
| survey_explorer_2 | teamwork_preview_explorer | UI & Workflow Engine Survey | completed | 6e303b9b-dca1-4134-8ac4-d4c7ab8ee270 |
| survey_specminer_3 | teamwork_preview_spec_miner | Documents, Testing & Git Survey | completed | fd4c35d4-bf4b-4ba5-8c26-f33e044477ed |
| e2e_test_writer_1 | teamwork_preview_test_writer | E2E Testing Track & 4-Tier Test Suite | completed | 2e4074d9-df9c-4afe-b93a-0c3a57c3e6f6 |
| m1_explorer_1 | teamwork_preview_explorer | M1 SQL Schema & Migration Design | completed | 845da6e4-abb5-4056-8a1c-b35eca94163b |
| m1_explorer_2 | teamwork_preview_explorer | M1 Domain Models & Drizzle Design | completed | 807c3857-a723-494a-b58b-6ca462ae67a3 |
| m1_explorer_3 | teamwork_preview_explorer | M1 Repository & Fixture Design | completed | 404f0eb0-f1ae-4d4d-bf9a-b4892a1d0215 |
| m1_worker_1 | teamwork_preview_worker | M1 Implementation Lead | in-progress | 6f60f874-5f35-4eaa-a8f8-3229a2894a9f |

## Succession Status
- Succession required: no
- Spawn count: 8 / 16
- Pending subagents: 6f60f874-5f35-4eaa-a8f8-3229a2894a9f
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: 6c0c2ad6-b060-4ca1-812d-09c87e71801e/task-15
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- /Users/joe/Repos/Permit/permit_tracker/.agents/ORIGINAL_REQUEST.md — User Requirements
- /Users/joe/Repos/Permit/permit_tracker/.agents/orchestrator/BRIEFING.md — Persistent Memory
- /Users/joe/Repos/Permit/permit_tracker/.agents/orchestrator/progress.md — Liveness & Progress
