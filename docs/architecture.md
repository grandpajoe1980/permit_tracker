# PATH Architecture

## Runtime source of truth

Supabase PostgreSQL is the production source of truth for projects, requests,
workstreams, workflow execution, notes, RFIs, assignments, documents,
notifications, and audit events. Supabase Storage bucket `path-documents` is
private and is the source of truth for uploaded bytes. Browser state is a view
cache only; it is never authoritative.

The repository currently contains an in-memory fixture repository for unit tests
and explicitly offline/demo execution. Production mode must hydrate from
Supabase and must preserve empty authorized query results as empty results.

## Canonical identifiers and request model

- `projects.id` is the database primary key.
- `projects.number` is the human-facing project code, for example
  `PRJ-PECAN-2026`.
- Routes and service functions use an explicit `projectId` or `projectCode`; a
  code is not silently treated as a primary key.
- `customer_requests` is the canonical PATH intake model. The legacy
  `requests` table remains only for compatibility with the original auth and
  trigger model; application intake must not write one table and read the
  other.

## Trust boundaries

Browser clients use only the publishable/anon key and the authenticated
Supabase session. Server-facing user requests must use a request-bound SSR
client so PostgreSQL RLS evaluates the caller. The service-role client is
isolated to seed, migration, and explicitly trusted maintenance scripts; it is
not a fallback for ordinary user requests.

Authorization is enforced by PostgreSQL RLS and server-side/domain checks.
Hiding a control in React is not an authorization boundary.

## Workflow execution

Published workflow versions are immutable. A workstream pins the published
version under which it started. State transitions validate the actor, current
stage, requirements, dependencies, statutory timing, and allowed transition
before the database transaction updates execution state, audit, notifications,
and schedule effects.

## Schema strategy

Supabase SQL migrations are canonical. `db/schema.ts` is legacy Drizzle/SQLite
metadata retained temporarily for existing unit tests and migration tooling;
it is not used as the production schema. New production schema changes must be
checked in as forward-only Supabase migrations and reflected here.

## Known baseline findings (2026-08-30)

- The required shell-wrapper scripts were not runnable on Windows because GNU
  `bash` was unavailable; package scripts now call the installed binaries
  directly.
- Direct build passed and direct lint had 0 errors with 232 warnings.
- The Node suite passed 169 tests, but this is primarily fixture/unit coverage;
  it does not prove the required clean-browser, multi-persona journey.
- Existing code still contains unawaited mutations, fixture fallbacks, broad
  historical policies, and only one physical API route. These are active work,
  not completed capabilities.
