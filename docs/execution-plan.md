# PATH MVP Execution Plan

Last updated: 2026-08-28

## MVP outcome

Ship a secure pilot that proves one complete path: an approved user signs in, a customer submits a request, authorized staff triage and advance it through a configured workflow, and the customer sees the permitted status and next action. A project workspace shows linked workstreams and basic schedule dependencies.

The existing `index.html` is a visual reference only. Production behavior will live in the Next.js application described by the PRD.

## Working assumptions

- Initial pilot configuration uses synthetic data and a small representative organization set until governance decisions are approved.
- Email/password authentication is the only authentication method.
- Public comments remain external; PATH stores dates, notices, and authoritative links only.
- External-system synchronization, advanced reporting, bulk operations, and production data migration are post-core-path work.
- A simple accessible schedule view is acceptable before selecting or adding a full Gantt dependency.

## Delivery sequence

### 1. Foundation and security

- [x] Scaffold Next.js App Router with TypeScript, Tailwind CSS, linting, and type checking.
- [ ] Add formatting and automated test harnesses.
- [x] Add repository secret and build-output protections.
- [x] Add a safe environment-variable template.
- [ ] Add browser/server Supabase clients and session-aware protected-route middleware.
- [ ] Create the organization, profile, membership, and audit schema.
- [ ] Enable and test RLS, including negative cross-tenant authorization cases.
- [ ] Implement sign-in, sign-out, reset, verification, and protected navigation shell.

Checkpoint: authenticated users can reach only permitted navigation and data; no privileged key reaches browser code.

### 2. Case and workflow vertical slice

- [ ] Add customer organizations, projects, requests, workflow definitions/stages, case workflows, assignments, and append-only audit events.
- [ ] Seed one representative customer workflow and staff organization using synthetic data.
- [ ] Implement an intake queue, lead organization/owner assignment, and guarded workflow transitions.
- [ ] Verify transitions enforce actor role, prerequisites, current state, and audit history on the backend.

Checkpoint: authorized staff can process one case end to end; unauthorized transitions fail.

### 3. Customer intake and status

- [ ] Implement request drafts and guided intake with validated required fields.
- [ ] Submit request, workflow state, immutable submission event, routing, and notification record atomically.
- [ ] Build customer dashboard and request detail with status, next action, schedule, and authorized history.
- [ ] Add realtime authorized status updates and print-friendly summary.

Checkpoint: a customer can submit and track a request while tenant-isolation tests prove they cannot access another customer’s records.

### 4. Documents, RFI, and coordination

- [ ] Add private document metadata/storage policies, signed access, versioning, and scan-status gating.
- [ ] Implement the RFI lifecycle and configured clock pause/resume behavior.
- [ ] Add project participants, workstreams, coordination tasks, explicit sharing scopes, and dependencies.
- [ ] Provide a permission-aware project schedule/table and basic Gantt view with an accessible alternative.

Checkpoint: staff can coordinate a synthetic multi-agency case without exposing restricted records.

### 5. Notifications, escalation, and pilot hardening

- [ ] Add idempotent in-app/email notification processing and delivery logging.
- [ ] Add deadline evaluation, reminders, and escalation views without implicit ownership changes.
- [ ] Add public-comment/hearing tracking with external official links.
- [ ] Run build, typecheck, unit/integration, end-to-end, RLS, accessibility, and security checks in CI.
- [ ] Document deployment, backups, restore, rollback, incident response, and pilot operations.

Checkpoint: approved pilot acceptance scenarios pass in staging.

## Verification gate for every slice

- Build and typecheck pass.
- Relevant automated tests pass, including negative authorization tests for privileged behavior.
- Loading, empty, error, and keyboard-accessible states are covered.
- The diff contains no credentials or unrelated refactors.
- Acceptance criteria are checked against `docs/PRD.MD` and recorded in `docs/progress.md`.

## Decisions still requiring product/governance input

These do not block synthetic-data foundation work but do block production pilot readiness:

- Pilot organizations and approved workflow catalog.
- Regulatory clock rules versus service targets.
- Customer organization verification and membership approvals.
- Document visibility, retention, legal-hold, and malware-scanning policies.
- Official public-comment systems and notice requirements.
- Email provider, operational ownership, and production support model.
