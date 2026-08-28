# PATH — Permit Application Tracker

PATH is an accessible demo of a permit-application status portal. It shows how an applicant could select an agency, sign in, review status and milestones, notice an action deadline, inspect next steps, and print a summary.

## Important scope note

This repository is a prototype. It is not connected to LDEQ or any government system, and every person, company, record, date, milestone, deadline, and instruction is illustrative. Do not enter real credentials or sensitive information.

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

`npm test` creates the production build and runs the focused data, helper, component, CSS, and rendered-output checks.

## Project map

- `app/page.tsx` — accessible client-side demo journey
- `app/globals.css` — visual system, responsive behavior, reduced motion, and print rules
- `lib/demo-data.ts` — typed illustrative agencies, accounts, and permit scenarios
- `lib/permit-utils.ts` — authentication lookup, ownership checks, and progress helpers
- `tests/` — domain, source-contract, component, and rendered-output checks
- `docs/execution-plan.md` — inferred MVP requirements and delivery plan
- `docs/progress.md` — durable implementation and validation status

## Production gap

Before any real launch, replace all client-side credentials and data with an approved identity provider, server-enforced applicant-to-case authorization, and validated agency integrations. Publish real accessibility and privacy policies, validate every operational statement and contact, and establish monitoring, incident response, content ownership, and records-retention requirements.
