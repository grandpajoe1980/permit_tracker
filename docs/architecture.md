# PATH Production Persistence Architecture

## Canonical source of truth

PATH uses Supabase: Auth for identity, PostgreSQL for operational records, and the private `path-documents` Storage bucket for files. D1 is retired; the former SQLite schema was never deployed and has been translated into the checked-in Supabase migration.

`supabase/migrations/` is executable schema history. `db/schema.ts` is its typed Drizzle/Postgres mirror. `lib/repository.ts` remains a deprecated fixture adapter strictly for current pure unit tests; production commands use the asynchronous, actor-scoped `CommandRepository` and database RPCs.

## Security and audit

Profiles are anchored to `auth.users`. Organization membership plus capability grants govern access; project participation scopes cross-agency access. RLS is enabled for all command tables. Browser keys are publishable only. Server commands must create an actor-scoped client; service-role credentials are for controlled seed/admin jobs only.

Compound operations run in database transactions. `accept_rfi_response` demonstrates the required pattern: response acceptance, clock/workstream update, and immutable audit event occur together. Audit rows have no browser write policy.

## Documents

Documents have immutable version rows, content hashes, scan state, classification, entity references, and version-specific agency review. Storage reads require both a clean version and workstream/project authorization. Actual malware scanning and outbound email are integration boundaries; no scan or delivery is fabricated.

## Background work

An external scheduled worker should evaluate SLA/escalation thresholds and notification delivery against persisted records. It must use idempotency keys and write escalation events; the old fixture SLA simulator is not the production worker.

## Local operations

```bash
# Requires Supabase CLI linked to the intended non-production project.
supabase db push
PATH_ALLOW_DEMO_SEED=true npm run supabase:seed:command-demo
npm run build
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs
```

To reset a local Supabase environment, use `supabase db reset`, then re-run the explicitly opted-in demo seed. Never set `PATH_ALLOW_DEMO_SEED` in production.
