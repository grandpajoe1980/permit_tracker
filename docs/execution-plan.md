# PATH Persistence Execution Plan

## Objective

Move the Louisiana Project Delivery Command System from fixture/in-memory state to one operational source of truth: Supabase PostgreSQL.

## Architecture decision

Supabase Auth, Postgres, Storage, RLS, and actor-scoped server command services are canonical. D1 was unbound, unused, and contradicted the PRD, so it is retired. Drizzle is a typed Postgres schema mirror; `supabase/migrations/` is executable schema history.

## Work sequence

1. **Foundation — complete**: inspect runtime, baseline verification, create normalized migration, RLS/audit/Storage foundations, and safe deterministic seed.
2. **Command services — started**: actor-scoped asynchronous repository and transactional RFI acceptance RPC. Continue with CR, commitment, document, workflow, readiness, and escalation commands.
3. **Cockpit integration — pending**: replace fixture imports with persisted view models, beginning with No-Surprises, agency queues, and coordination.
4. **Production verification — pending credential**: apply migration to isolated Supabase project; run migration/seed/restart/FK/RLS/transaction/revision tests.
5. **Integrations — pending**: scheduled SLA worker, malware scan adapter, email adapter, and realtime channels.

## Checkpoint definition of done

- [x] Canonical database decision and checked-in migration.
- [x] No active D1 path.
- [x] Deterministic safe demo seed implementation.
- [x] Typed Postgres schema and initial actor-scoped repository boundary.
- [x] RLS/audit/Storage design encoded in migrations.
- [ ] Migration applied and verified against a real Supabase environment.
- [ ] All cockpit reads/mutations use persisted services.
- [ ] Full database integration/adversarial RLS suite.

## 2026-08-30 Trust and schedule review

Independent security, durability, testing, and architecture reviews confirmed
that the fixture-oriented UI must not be treated as an authoritative multi-user
runtime. The immediate correction sequence is:

**Repository/database reconciliation blocker:** the linked Supabase project
contains portal migrations `20260830071223` through `20260830180623` that are
not present in this repository's migration directory. Do not run a blanket
`supabase db push` from this checkout until those source migrations (or an
equivalent schema baseline) are recovered and committed. The two corrective
migrations below were applied through the Management API and recorded in the
remote migration history.

1. Apply `20260830210000_trust_boundary_and_customer_submission.sql` and
   `20260830210001_remove_residual_permissive_policies.sql` in a
   non-production Supabase project, then production after its authenticated
   RLS/RPC matrix passes.
2. Run browser flows with actual customer, reviewer, and unrelated-user JWTs:
   canonical customer submission; denied direct PATCH; denied cross-project
   read/write; immutable document object; no fixture state after empty/error
   hydration; then two-context persistence after refresh/re-login.
3. Move every remaining local workflow, role, blocker, task, and document
   mutation behind typed, awaited command RPCs. A browser-only transition must
   never show a success state.
4. Replace fixture Gantt inputs with the persisted workstream/task selector.
   The new UI provides a truthful, accessible operational-state color map and
   past/current/future sequence; its fixture fallback exists only to demonstrate
   the visualization while the persisted selector is completed.
