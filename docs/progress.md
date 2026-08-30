# PATH Progress

## Current status

Wave 0 (truth/baseline) is complete. The repository is runnable with the
installed Windows toolchain, but the MVP is not complete. The claims in older
documentation that persistence and cross-browser verification were complete
were not reproducible from the current source and have been replaced with the
findings below.

## Completed in this checkpoint

- Read the repository protocol, PRD, plan, execution docs, operational UX,
  testing docs, source tree, migrations, recent commits, and package scripts.
- Added `docs/architecture.md` with the intended canonical architecture and
  explicit legacy boundaries.
- Rebased `docs/execution-plan.md` and this file on observed source behavior.
- Made build/lint/Drizzle package scripts invoke local binaries directly so
  the required gates run on Windows without GNU bash.

## Baseline verification

| Command | Result | Environment/evidence |
|---|---|---|
| `npx vinext build` | PASS | Vinext/Vite build completed; route output included `/`, `/api/health`, `/api/requests`. |
| `npx eslint . --ignore-pattern dist --ignore-pattern .next` | PASS with warnings | 0 errors, 232 warnings. |
| `node --test tests/*.test.mjs` | PASS | 169 passed, 0 failed, 0 skipped; repeated Vite WebSocket port-in-use warnings. Primarily fixture/unit coverage. |
| `node scripts/supabase-probe.mjs` | PASS | Configured project responded; 37 REST paths, Storage read/write/cleanup probes passed. This does not prove RLS isolation. |
| `npm run build` / `npm run lint` before this checkpoint | BLOCKED | Both stopped because `bash` was unavailable on Windows. |

## Active work

- Wave 1: remove false-success mutations and secure the Supabase trust
  boundary.

## Known blockers and risks

- A live Supabase project is configured, but the repository does not yet have
  a reproducible clean-context RLS negative-test harness for every persona.
- Existing historical migrations contain permissive policies; a forward
  hardening migration must supersede them without rewriting migration history.
- The large internal router must be extracted incrementally to avoid regressing
  the existing operational UI.

## Next actions

1. Add explicit `APP_DATA_MODE` behavior and remove production fixture fallback.
2. Introduce request-bound server client and isolate service-role access.
3. Scope all project queries and make mutation success await the authoritative
   database result.
4. Add failure/RLS regression tests, apply the hardening migration, and commit
   the Wave 1 checkpoint.
