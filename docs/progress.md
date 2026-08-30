# PATH Progress

## Current status

Production persistence foundation is in progress. The prior `COMPLETE & VERIFIED` claim was inaccurate: the latest command-system work was fixture and in-memory based.

## Starting state recorded 2026-08-30

- Build passed after dependencies were installed.
- Lint failed with inherited unescaped-entity errors and warnings.
- Typecheck failed with D1 typing, missing auth imports, and repository/domain drift.
- Existing tests proved fixture behavior, not database persistence, transactions, or RLS.

## Completed in this phase

- Chosen Supabase Auth + PostgreSQL + Storage + RLS as canonical architecture.
- Retired unbound D1 configuration and removed its example route/schema.
- Replaced SQLite Drizzle metadata with PostgreSQL typed metadata.
- Added normalized command-system migration covering organizations/capabilities, catalog/resources, workflows, workstreams/DAG, CRs, RFIs, documents, commitments, decisions, meetings, readiness, escalation, filings, and audit extensions.
- Added RLS foundation, capability helpers, six-question invariant, protected storage read policy, and transactional RFI acceptance RPC.
- Added development-only deterministic SpaceX Pecan Island command-data seed.
- Corrected inherited TypeScript blockers so typecheck passes.

## Remaining production work

- Apply migration to a linked Supabase project and run database/RLS integration tests; no project credential was supplied in this workspace.
- Move each cockpit from fixture adapters to the actor-scoped `CommandRepository` and complete all mutation handlers.
- Add a scheduled persisted SLA/escalation worker, malware scanning provider, and transactional email provider.
- Replace fixture-only repository tests with an ephemeral Postgres/Supabase integration suite.

## Verification

- `npx tsc --noEmit` passes.
- `npm run build` passes.
- Existing suite passes after schema compatibility updates; it remains fixture-heavy and does not prove an external Supabase project was migrated.

## Trust review update — 2026-08-30

- Four independent reviews found BLOCKER/HIGH issues in direct request mutation,
  document/storage inheritance and visibility, profile authorization fields,
  fixture fallback/false success, seed idempotency, and absent live Supabase
  RLS/E2E coverage.
- The live database contained later customer-portal migrations absent from this
  checkout. The browser and corrective SQL were reconciled to that deployed
  `customer_requests` / `rpc_create_customer_request` schema; recovering those
  missing migration sources into Git is now a prerequisite to using automatic
  `supabase db push` from this repository.
- Added corrective migrations rather than modifying applied history. They remove
  permissive customer-portal policies and direct authenticated
  request/profile/participant/document-version writes, narrow notification and
  audit reads, and harden the existing atomic
  `rpc_create_customer_request` submission RPC to derive the actor, customer
  organization, project, status, and confirmation number from `auth.uid()`.
- Browser intake now awaits that RPC, uses the returned database row as the
  confirmation, and reports failure without creating a local phantom request.
  Fixture fallback is explicit `NEXT_PUBLIC_PATH_DATA_MODE=demo` only.
- Replaced the cockpit Gantt table with an expandable timeline that presents
  multiple past/current/future task stages and an accessible color map for each
  operational hold type. It is still fixture-backed until the command selector
  is connected to persisted workstream/task queries.
- Local validation passed: `npx tsc --noEmit`, `npx vinext build`, and
  `node --test tests/*.test.mjs` (122 tests). The live Supabase service-role
  probe, migration history, restrictive-policy scan, and RPC auth source check
  also pass. Authenticated cross-browser tests remain outstanding.
