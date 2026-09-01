## 2026-08-31T13:20:14Z
You are e2e_test_writer_1 (role: E2E Testing Track Lead & Test Writer).
Your working directory is /Users/joe/Repos/Permit/permit_tracker/.agents/e2e_test_writer_1 (create it and write only within your directory; you also own writing TEST_INFRA.md, TEST_READY.md at project root, and tests/e2e-itsm-pm-platform.test.mjs).

Authoritative Request:
/Users/joe/Repos/Permit/permit_tracker/.agents/ORIGINAL_REQUEST.md
Master Project Plan:
/Users/joe/Repos/Permit/permit_tracker/PROJECT.md
Please read both files carefully.

Objective:
Design and implement a comprehensive, requirement-driven, opaque-box 4-tier E2E test suite for the ITSM & Project Management transformation.

Deliverables:
1. Create /Users/joe/Repos/Permit/permit_tracker/TEST_INFRA.md at project root using the standard TEST_INFRA template (Methodology, Feature Inventory, Architecture, Tier 1-4 coverage thresholds).
2. Implement /Users/joe/Repos/Permit/permit_tracker/tests/e2e-itsm-pm-platform.test.mjs using Node.js native test runner (`node:test`, `node:assert/strict`):
   - Tier 1 (Feature Coverage): >=5 test cases per feature across F1-F13 (Multi-tenancy, Assignment Groups, ITSM States, Priority P1-P4, Ticket Triage, Customer Portal view sanitization, In-ticket workflow DAG editing, Step/Dependency mutations, CPM solver schedule updates, Document Downloads, SHA-256 integrity, Demo document preservation, Supabase/Repository sync).
   - Tier 2 (Boundary & Corner Cases): >=5 test cases per feature area (Zero/null assignees, cyclic DAG dependency detection and rejection, statutory clock pause/resume transitions, document byte mismatch rejection, unauthorized role workflow edit rejection).
   - Tier 3 (Cross-Feature Pairwise): >=10 test cases covering feature interactions (e.g. In-ticket DAG step injection triggering CPM float recalculation + Assignment Group routing + customer narrative update).
   - Tier 4 (Real-World Application Scenarios): >=5 comprehensive end-to-end scenarios (e.g. SpaceX heavy-haul intake -> State Concierge triage -> DOTD & Parish assignment group queue -> in-ticket custom parish hearing gate addition -> document submittal review -> statutory clock compliance -> approval).
3. Validate tests run cleanly via `node --test tests/e2e-itsm-pm-platform.test.mjs`.
4. Create /Users/joe/Repos/Permit/permit_tracker/TEST_READY.md at project root with test runner command, tier breakdown, and feature checklist.
5. Write your handoff report to /Users/joe/Repos/Permit/permit_tracker/.agents/e2e_test_writer_1/handoff.md and report completion back to orchestrator.
