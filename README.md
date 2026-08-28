# PATH — Permit Application Tracker

PATH is an accessible SpaceX Louisiana permitting-workspace MVP. Employees sign in, submit project requests, review milestones and action deadlines, and monitor the requests authorized for their account.

## Important scope note

This repository is a proof of concept. The SpaceX Louisiana project, users, records, dates, milestones, deadlines, and instructions are illustrative. Do not enter real credentials or sensitive information.

The three public scenarios use the shared password `demo1234`:

| Username | Scenario |
|---|---|
| `applicant.happypath` | Standard review |
| `applicant.suspended` | Action required |
| `applicant.hearing` | Public hearing |

Client-side demo sign-in is intentionally not a security boundary. Production use requires an approved PRD, real identity, server-side authorization, authoritative permit-data integration, auditability, and agency/legal validation.

## Stack

- Vinext, React 19, and TypeScript
- Tailwind CSS and the vendored Shadcn component catalog
- Lucide icons
- Node's built-in test runner

## Run locally

Prerequisites: Node.js `>=22.13.0`, plus Linux tools `flock`, `curl`, and GNU `timeout` for the checked-in lifecycle scripts.

```bash
npm ci
npm run dev
```

## Validate

```bash
npm run lint
npm test
```

## Supabase connection

The website uses Supabase Auth and reads authorized rows from the `requests` table. The schema, RLS policies, auth-profile trigger, and private document bucket are versioned under `supabase/`.

For local verification, copy `.env.example` to `.env` and set the Supabase URL plus a server-only service-role key. Then run:

```bash
npm run supabase:probe
```

To apply the schema to a hosted project, authenticate the Supabase CLI and push the migration from a trusted machine:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

After pushing the migration, seed the illustrative two-month SpaceX Louisiana workspace. This uses the server-only service-role key to create confirmed test users and eight routed requests:

```bash
npm run supabase:seed:spacex
```

The seeded test users all use password `SpaceX-MVP-2026!`; accounts are intentionally `.test` addresses and must be replaced before any real deployment.

Configure these Vercel environment variables for the deployment:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the build safely maps these to browser-safe values)
- Or use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` directly
- `SUPABASE_SERVICE_ROLE_KEY` only for trusted server-side jobs; never expose it to the browser

After the migration is pushed, create/approve user memberships and customer organization links before expecting customer requests to appear. RLS remains the authorization boundary.

`npm test` creates the production build and runs the focused data, helper, component, CSS, and rendered-output checks.

## Project map

- `app/page.tsx` — accessible client-side demo journey
- `app/globals.css` — visual system, responsive behavior, reduced motion, and print rules
- `lib/demo-data.ts` — legacy UI types retained for compatibility with the illustrative fixture tests
- `lib/permit-utils.ts` — authentication lookup, ownership checks, and progress helpers
- `tests/` — domain, source-contract, component, and rendered-output checks
- `docs/execution-plan.md` — inferred MVP requirements and delivery plan
- `docs/progress.md` — durable implementation and validation status

## Production gap

Before any real launch, replace all client-side credentials and data with an approved identity provider, server-enforced applicant-to-case authorization, and validated agency integrations. Publish real accessibility and privacy policies, validate every operational statement and contact, and establish monitoring, incident response, content ownership, and records-retention requirements.
