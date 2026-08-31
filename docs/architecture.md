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

Security-definer request creation derives the submitter from `auth.uid()` and
the project from the canonical `projects` row. Client-provided submitter IDs
and names are compatibility parameters only; they are not trusted for request
or audit attribution. Referenced document versions must belong to the selected
project.

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

## Current verification findings (2026-08-30)

- The required shell-wrapper scripts were not runnable on Windows because GNU
  `bash` was unavailable; package scripts now call the installed binaries
  directly.
- Direct build passed and direct lint had 0 errors with existing warning debt.
- The Node suite passed 170 tests, but this is primarily fixture/unit coverage;
  it does not prove the required clean-browser, multi-persona journey.
- Chromium persistence scenarios now assert exact request data across isolated
  contexts, and the document lifecycle verifies exact uploaded bytes plus a
  seeded private PDF download. The checked-in forward Storage/RLS migrations
  still require live ledger reconciliation before deployment verification;
  Firefox/WebKit binaries are not installed in the current runner.
- Customer first-file intake uploads to private Storage and then uses one
  security-definer transaction for the document parent, immutable version, and
  request link. The client removes the Storage object if that transaction is
  rejected; cross-system byte/database atomicity cannot be provided by
  PostgreSQL alone.
- The Workflow Designer's production source is now hydrated from
  `workflow_definitions`, `workflow_versions`, and `workflow_version_stages`;
  its fixture templates are used only when explicit demo/test mode is active.
- Historical permissive migrations remain in the repository for replayability,
  but later forward migrations drop their broad policies. The live migration
  ledger still differs from this checkout and must be reconciled before deploy.
