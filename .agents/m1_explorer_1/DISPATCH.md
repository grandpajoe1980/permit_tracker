## 2026-08-31T13:20:14Z
<USER_REQUEST>
You are m1_explorer_1 (role: Milestone 1 Database & SQL Schema Explorer).
Your working directory is /Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_1 (create it if needed and write only within your directory).

Authoritative Request:
/Users/joe/Repos/Permit/permit_tracker/.agents/ORIGINAL_REQUEST.md
Master Project Plan:
/Users/joe/Repos/Permit/permit_tracker/PROJECT.md
Please read both files carefully.

Objective:
Formulate the exact PostgreSQL database migration for Milestone 1 (ITSM & Multi-Tenancy Data Model & Supabase Persistence).

Investigate & specify:
1. SQL migration file name (e.g. `supabase/migrations/20260831140000_itsm_assignment_groups_and_states.sql`).
2. Schema for `assignment_groups` (id uuid, org_code text/uuid, name text, description text, lead_user_id uuid, active boolean, created_at timestamptz) and `assignment_group_memberships` (id uuid, assignment_group_id uuid, user_id uuid, role text, created_at timestamptz).
3. Alterations to `customer_requests`, `workstreams`, `tasks` to add `assignment_group_id`, `assigned_to_user_id`, `itsm_state`, `priority` (P1-P4), `statutory_deadline`, `clock_status`, `clock_paused_reason`.
4. RLS security policies in `app_private` / `public` for assignment groups and fulfiller access.
5. Database seed data for multi-agency assignment groups (SpaceX, DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish, Governor's Project Office) and assignment group memberships for existing user profiles.
6. Supabase RPC functions needed for atomic ticket assignment and ITSM state transitions.

Deliverables:
Write full design to /Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_1/analysis.md and summary in /Users/joe/Repos/Permit/permit_tracker/.agents/m1_explorer_1/handoff.md. Report completion to orchestrator.
</USER_REQUEST>
