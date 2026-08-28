# PATH Product Requirements Document

## 1. Product Summary

PATH is a secure, multi-agency government project and permit tracking platform. It is the operational system of record for customer requests, permits, approvals, and infrastructure coordination across participating Louisiana state agencies, local governments, and federal partners.

The first release supports Louisiana DOTD, LDEQ, LDH, DENR, CPRA, FAA, FCC, U.S. Army Corps of Engineers (USACE), and local-government participants. Organizations are configurable so additional agencies can be added without an application rewrite.

PATH must let customers submit and monitor requests while authorized government contributors route, own, coordinate, escalate, and complete the work. A single project may include many linked workstreams, such as road construction, airport approvals, power plants, industrial wastewater, environmental permits, coastal work, and federal reviews.

## 2. Goals

- Provide customers one authenticated place to submit requests, upload supporting material, and understand their status.
- Provide government contributors a shared work-management system for multi-jurisdiction projects.
- Track current owner, workflow stage, planned and actual milestones, dependencies, minimum processing periods, service targets, escalations, and audit history.
- Support configurable organization-specific permit and approval workflows.
- Provide a project-level Gantt chart that surfaces cross-agency dependencies and schedule risk.
- Protect sensitive customer, permit, and document data with least-privilege access controls.

## 3. Non-Goals for the Initial Release

- OAuth, SSO, or social login. Authentication is email/password only.
- Accepting public comments directly in PATH. PATH tracks comment periods and links to the authoritative external submission site.
- Payment processing.
- Replacing an external statutory or regulatory system of record that an agency must retain.
- Automated synchronization with EPA, USACE, FAA, FCC, local, or agency systems until a supported interface and data-sharing agreement are confirmed.
- Mobile-native applications; the web application must be responsive.

## 4. Users and Roles

| Role | Primary View | Core Capabilities |
| --- | --- | --- |
| Customer | Customer portal | Submit requests, upload documents, view only its organization’s requests/projects, respond to RFIs, view authorized status and external public-comment links. |
| Organization Contributor | Staff workspace | View organizational work and explicitly shared projects; own and update assigned tasks; route work; request information; add internal notes; update permitted workflow stages. |
| Organization Supervisor | Staff workspace | All contributor actions for their organization; assign work, manage queues, approve escalations, and perform supervisor-only transitions. |
| Organization Administrator | Organization administration | Manage organization users, roles, workflows, permit/approval types, routing rules, templates, service targets, and reports. |
| System Administrator | Platform administration | Configure organizations, jurisdiction types, global standards, cross-organization access, platform users, audit/report access, and system configuration. |

Role access is additive only where explicitly granted. A contributor does not receive access to all platform cases merely because they belong to a participating organization.

## 5. Scope and Core Concepts

### 5.1 Organizations and Jurisdictions

An organization represents an agency or government body, such as DOTD, LDEQ, LDH, DENR, CPRA, FAA, FCC, USACE, EPA, parish government, municipality, or future partner. Each organization has a jurisdiction level: local, state, federal, or external partner.

Every project, request, workstream, document, task, and workflow action has an owning organization. Additional organizations may be added as lead, coordinating, reviewing, consulting, or notified participants.

### 5.2 Projects, Requests, and Workstreams

- A **project** is the umbrella initiative: for example, a new industrial facility, airport expansion, custom road, power plant, or coastal restoration project.
- A **request** is a customer-submitted question, intake item, permit, approval, review, or service request.
- A **workstream** is a track of government work linked to a project, such as DOTD road access approval, LDEQ wastewater permit, LDH review, FAA airport determination, USACE wetland authorization, or FCC coordination.
- A **case** refers to a request, permit, approval, or workflow instance managed by PATH.

A customer may submit one request that staff triage into one or more workstreams. Each workstream can have a different lead organization, workflow, owner, statutory clock, and completion status.

### 5.3 Workflow and Schedule

Workflows are organization- and type-specific, versioned, and configurable by organization administrators. A workflow contains stages, allowed transitions, required roles, required documents, service targets, minimum processing periods, optional public-comment periods, and escalation rules.

PATH distinguishes:

- Calendar target: planned completion date.
- Minimum processing period: earliest legal or policy-allowed completion date.
- Service-level target: expected completion date based on the active workflow.
- Due date: date by which an owner, customer, or coordinating organization must act.
- Schedule dependency: predecessor/successor relationship between tasks or milestones.
- Clock state: running, paused, extended, or complete.

## 6. Functional Requirements

### 6.1 Authentication and User Lifecycle

Tasks:

- [ ] Implement Supabase Auth email/password sign-up, sign-in, sign-out, password reset, password update, session restore, and email verification.
- [ ] Require approved organization membership before staff roles grant operational access.
- [ ] Allow organization administrators to invite staff and assign roles within their organization.
- [ ] Allow customers to self-register or be invited, then associate their account with a customer organization.
- [ ] Require administrators to approve customer-organization association changes.
- [ ] Enforce account deactivation without deleting audit history.
- [ ] Record authentication and authorization-relevant events in audit logs.

Acceptance criteria:

- An unauthenticated user cannot access protected routes or APIs.
- A customer cannot view another customer organization’s cases, documents, comments, or notifications.
- A contributor sees only organization-owned work and cases explicitly shared with their organization or assigned to them.
- The service-role key is never included in browser code, built assets, or client-visible environment variables.

### 6.2 Customer Intake

Tasks:

- [ ] Build a guided request intake form with request type, project association, locations, affected jurisdiction, applicant organization, contacts, description, and supporting files.
- [ ] Support a request type catalog that explains lead organization, expected workflow, required information, processing minimums, and external references.
- [ ] Validate required fields and file types before submission.
- [ ] Create a confirmation number and customer-facing receipt after submission.
- [ ] Allow customers to save drafts, resume drafts, submit, and withdraw unassigned drafts.
- [ ] Route completed submissions to a configurable intake queue.
- [ ] Notify the customer and assigned intake team after submission.

Acceptance criteria:

- Submitted intake data creates an immutable submission event, a request record, and an initial workflow state in one transaction.
- Customers can view receipt, current status, owner organization, next action, and authorized documents after submission.
- Intake staff can request clarification without exposing internal notes to customers.

### 6.3 Triage, Routing, and Agency Coordination

Tasks:

- [ ] Provide staff an intake queue with filters for organization, request type, jurisdiction, priority, age, status, and unassigned items.
- [ ] Allow staff to classify a request, choose a lead organization, assign an owner, attach it to a project, and create one or more workstreams.
- [ ] Define configurable routing rules based on request type, location, project type, jurisdiction, and environmental or infrastructure attributes.
- [ ] Allow lead staff to add coordinating organizations with role, scope, due date, and document access level.
- [ ] Record each routing, assignment, reassignment, and cross-organization access decision in the audit log.
- [ ] Provide a coordination panel showing requested actions, responses, overdue items, and the current process owner.

Acceptance criteria:

- A routing decision identifies one lead organization and one current accountable owner for every active workstream.
- Adding a coordinating organization grants only the project/workstream permissions selected by the lead organization.
- Staff can see unresolved dependencies and overdue coordination tasks from the project workspace.

### 6.4 Customer Status Portal

Tasks:

- [ ] Build a customer dashboard listing active, action-required, completed, and archived requests/projects.
- [ ] Build a request detail screen showing case number, type, lead organization, current stage, owner organization, schedule, next action, timeline, authorized documents, and notifications.
- [ ] Display action-required alerts for requests for information, document deadlines, and pending customer tasks.
- [ ] Display a clear status history without internal-only notes or restricted participant details.
- [ ] Provide a print-friendly summary and accessible document download links.
- [ ] Show public-comment period dates and authoritative external submission links when approved for customer visibility.

Acceptance criteria:

- The existing demo’s hardcoded login, permits, and client-side data are removed from the production application.
- Dashboard changes appear without a manual browser refresh when a customer’s authorized case changes.
- Customer-visible status is derived from configured workflow state, not free-form display text alone.

### 6.5 Staff Work Management

Tasks:

- [ ] Build staff dashboards for personal assignments, organization queues, overdue actions, RFIs, escalations, and upcoming milestones.
- [ ] Allow authorized staff to change stage, add operational notes, assign or reassign owners, set due dates, create tasks, and attach documents.
- [ ] Validate every status transition against the workflow state machine, actor role, required documents, and prerequisite tasks.
- [ ] Support internal notes, customer-visible updates, and restricted cross-organization notes as separate visibility classes.
- [ ] Track workload and assignment history by owner and organization.
- [ ] Support bulk assignment and bulk notification for authorized supervisors.

Acceptance criteria:

- Unauthorized transitions are rejected by the backend even if a user manipulates the browser.
- Every workflow transition captures prior state, new state, actor, timestamp, reason, and visibility.
- Each active case has a current owner and a next required action or an explicit waiting state.

### 6.6 Project Workspace and Gantt Chart

Tasks:

- [ ] Build a project workspace that groups related requests, permits, approvals, workstreams, tasks, risks, documents, and participants.
- [ ] Implement an interactive Gantt chart with configurable day/week/month zoom, start/end dates, milestones, dependencies, critical-path indication, ownership, status, and baseline versus current schedule.
- [ ] Support task dependencies across agencies and workstreams, including finish-to-start, start-to-start, finish-to-finish, and lag days.
- [ ] Calculate schedule impact when a dependency changes, a minimum processing period applies, an RFI pauses the clock, or a public-comment/hearing extension occurs.
- [ ] Show current process owner, escalation path, blocked reason, and external reference number for every workstream.
- [ ] Provide project-level filters by organization, jurisdiction, workstream type, status, owner, and schedule risk.

Acceptance criteria:

- A project coordinator can identify blocked tasks, overdue work, and schedule dependencies from one view.
- The Gantt chart respects the viewer’s permissions and never reveals restricted task names, dates, or documents.
- Changes to tasks and dependencies generate audit events and recalculate affected schedule indicators.

### 6.7 Requests for Information (RFI)

Tasks:

- [ ] Allow authorized staff to create an RFI with requested items, instructions, due date, visibility, and pause/extension policy.
- [ ] Notify the customer, show the RFI as action required, and allow customer responses and document uploads.
- [ ] Track RFI response status: draft, issued, partially answered, submitted, accepted, rejected, expired, withdrawn.
- [ ] Pause, resume, or extend the case clock according to the configured workflow rule.
- [ ] Escalate overdue RFIs using organization rules.

Acceptance criteria:

- Customers cannot mark an RFI complete; an authorized staff member must accept or reject the response.
- Clock changes explain the policy, actor, start/end timestamps, and resulting target date.
- The customer sees only the content and documents intended for customer visibility.

### 6.8 Public Comment and Hearing Tracking

Tasks:

- [ ] Allow staff to schedule and track public-comment periods and hearings for eligible cases.
- [ ] Record start/end dates, notice date, hearing date/time/location, external official submission URL, extension reason, and customer-visible notice text.
- [ ] Add workflow dependencies and schedule extensions caused by comment periods or hearings.
- [ ] Send customer and stakeholder notifications according to visibility and notice rules.
- [ ] Support links to authoritative public docket, agency page, or comment portal.

Acceptance criteria:

- PATH does not accept public comments in the initial release.
- Only authorized staff can publish customer-visible notice information.
- Hearing/comment updates are reflected in project timelines and the Gantt chart.

### 6.9 Documents and Records

Tasks:

- [ ] Implement private document storage for intake files, RFIs, agency documents, and project records.
- [ ] Define document types, visibility, version, owner organization, retention category, and malware-scan status.
- [ ] Upload directly to restricted storage using short-lived signed upload URLs or Supabase Storage policies.
- [ ] Generate short-lived signed download URLs after backend authorization.
- [ ] Require malware scanning before staff can open externally uploaded files.
- [ ] Preserve document metadata and version history; prevent silent replacement.

Acceptance criteria:

- Storage paths do not reveal sensitive tenant information and are protected by storage RLS policies.
- A user cannot download a document they cannot see in the application.
- Deletion is a governed retention action, recorded in the audit trail.

### 6.10 Notifications and Escalations

Tasks:

- [ ] Provide in-app notifications for assignment, status update, RFI, deadline, document, comment period, hearing, and escalation events.
- [ ] Send transactional email notifications through a server-side provider.
- [ ] Support configurable reminder schedules, escalation thresholds, recipients, and templates by workflow and organization.
- [ ] Allow users to control non-mandatory email preferences while preserving mandatory regulatory notices.
- [ ] Build an escalation view that identifies current owner, supervisory path, policy, overdue duration, and resolution.

Acceptance criteria:

- Notifications are triggered from audited backend events and are idempotent.
- An escalation does not change case ownership or status unless an authorized user acts.
- Delivery failures are logged and visible to authorized administrators.

### 6.11 Administration and Reporting

Tasks:

- [ ] Build organization administration for agency profile, jurisdiction, contacts, users, roles, routing rules, workflows, permit/approval types, document requirements, SLAs, and escalation policies.
- [ ] Build system administration for organization onboarding, global permissions, cross-organization access governance, reference data, and audit review.
- [ ] Build reports for intake volume, queue age, workload, SLA performance, RFI aging, schedule risk, status distribution, and project/workstream completion.
- [ ] Support CSV export for authorized administrative reports with audit logging.
- [ ] Provide retention and archive management according to organization policy.

Acceptance criteria:

- Organization administrators cannot change global platform settings or other organizations’ configuration.
- Report queries honor the same authorization scope as interactive screens.
- All administrative changes are auditable.

## 7. Frontend Information Architecture and Routes

The production application uses Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, and the existing PATH/Pelican visual language. The current `index.html` supplies visual reference for the landing page, status cards, alerts, timeline, agency context, and print summary, but it is not production application code.

| Route | Audience | Requirement |
| --- | --- | --- |
| `/` | Public | Product landing and sign-in entry. |
| `/login` | Public | Email/password authentication and reset entry. |
| `/register` | Customer | Customer registration/invitation completion. |
| `/dashboard` | Customer | Customer request/project dashboard. |
| `/requests/new` | Customer | Guided intake and drafts. |
| `/requests/:requestId` | Customer/authorized staff | Permission-aware case detail. |
| `/projects/:projectId` | Authorized customer/staff | Project summary, workstreams, risks, and activity. |
| `/projects/:projectId/gantt` | Authorized staff | Gantt chart and dependency management. |
| `/work` | Staff | Personal and organization work queues. |
| `/intake` | Staff | Intake triage and routing queue. |
| `/coordination` | Staff | Cross-organization requested actions and responses. |
| `/escalations` | Supervisor/admin | Overdue and escalated cases. |
| `/admin/organization` | Organization admin | Users, workflows, routing, types, SLAs, and templates. |
| `/admin/system` | System admin | Organization onboarding, access governance, and platform controls. |
| `/reports` | Authorized admin | Scope-safe reporting and exports. |

Next.js middleware must validate sessions and redirect unauthenticated users before protected routes render. Server Components, Server Actions, and route handlers must independently authorize all data access and mutations. UI visibility is a convenience only; RLS and backend authorization remain the enforcement boundary.

## 8. Technical Architecture

### 8.1 Frontend

- Next.js with the App Router, React, and TypeScript.
- Tailwind CSS for styling and a PATH theme layer that preserves the established government visual language.
- shadcn/ui for accessible, composable application controls, augmented only where needed for government workflow patterns.
- Server Components for permission-aware initial data loading; Client Components only for interactive forms, realtime updates, and the Gantt experience.
- Next.js `middleware.ts` for session-aware route protection and organization-context setup.
- Next.js Server Actions for authenticated application mutations and Route Handlers for webhooks, integrations, and API consumers.
- Accessible component system built from the existing PATH design tokens; meet WCAG 2.1 AA.
- A proven React Gantt library selected during implementation based on accessibility, dependency support, virtualization, and licensing.
- Browser Supabase client uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 8.2 Supabase Platform

- Supabase Auth for email/password identity and sessions.
- PostgreSQL for transactional domain data.
- Supabase Storage for restricted documents.
- Supabase Realtime for authorized status and work-queue updates.
- Version-controlled SQL migrations, seed data, and RLS policies under `supabase/`.

### 8.3 Backend and Middleware

Use Supabase Data APIs only for RLS-safe, bounded CRUD. Use Next.js Server Actions and Route Handlers for business logic that needs transactions, cross-table validation, private secrets, or side effects. Privileged server code runs on Vercel and may use the service-role key only after authenticating and authorizing the request.

Required server operations:

| Operation | Responsibility |
| --- | --- |
| `submitRequest` Server Action | Validate intake, create request/workflow/audit event atomically, route to intake queue, notify recipients. |
| `transitionCase` Server Action | Validate the workflow state machine, role, prerequisites, clock changes, audit history, and notifications. |
| `assignWork` Server Action | Validate organization/project scope, create assignment, record history, and notify assignee. |
| `createRfi` Server Action | Create RFI, apply configured clock policy, notify customer, and create escalation schedule. |
| `respondToRfi` Server Action | Validate response/documents, update RFI status, and notify case owner. |
| `manageCommentPeriod` Server Action | Create/update public-comment or hearing schedule, dependency/clock impacts, and notifications. |
| `authorizeDocument` Route Handler | Create restricted upload/download authorization after permission and scan checks. |
| `processNotifications` Route Handler | Send email, retry safely, log delivery outcomes, and respect preference policy. |
| `evaluateDeadlines` Scheduled Route Handler | Scheduled evaluation of due dates, minimum processing periods, SLA targets, and escalations. |
| `reportExport` Route Handler | Generate authorization-scoped report exports. |

Middleware requirements:

- Validate JSON payloads with shared schemas.
- Authenticate every protected request and resolve the user’s active organization context.
- Enforce role, organization membership, case access, and assignment scope before operations.
- Apply rate limiting to login, registration, intake, upload authorization, and public endpoints.
- Emit structured logs with correlation ID, actor ID, organization ID, resource type/ID, and result. Do not log sensitive document content or secrets.

## 9. Data Model

Core tables:

| Entity | Key Fields |
| --- | --- |
| `profiles` | `id`, name, email, status, customer_organization_id, timestamps. |
| `organizations` | `id`, code, name, organization_type, jurisdiction_level, contacts, active. |
| `organization_memberships` | user, organization, role, status, effective dates. |
| `customer_organizations` | customer company/entity details, approved contacts, active. |
| `projects` | number, name, customer organization, lead organization, location, project type, status, dates, risk. |
| `project_participants` | project, organization, participation role, access scope, contact. |
| `workstreams` | project, lead organization, type, workflow version, owner, status, dates, external reference. |
| `requests` | number, project/workstream, submitter, type, status, intake data, visibility, timestamps. |
| `case_workflows` | case, workflow version, stage, clock state, minimum completion, target completion. |
| `workflow_definitions` | organization, case type, version, active state. |
| `workflow_stages` | workflow, order, allowed roles/transitions, targets, prerequisites. |
| `assignments` | resource, user/organization, assignment role, due date, status. |
| `tasks` | project/workstream/case, owner, dates, status, predecessor/dependency data. |
| `milestones` | project/workstream/case, date, type, status, visibility. |
| `schedule_dependencies` | predecessor, successor, dependency type, lag, status. |
| `rfi_requests` | case, requester, due date, status, clock policy, visibility. |
| `comment_periods` | case, dates, notice, hearing data, external URL, visibility. |
| `documents` | storage path, resource, type, version, visibility, scan/retention status. |
| `notifications` | recipient, event, resource, channel, delivery status, read status. |
| `escalations` | resource, policy, severity, current owner, status, timestamps. |
| `audit_events` | actor, organization, action, resource, before/after metadata, correlation ID, timestamp. |
| `external_references` | resource, external system, reference number, URL, sync status. |

Use UUID primary keys, immutable public-facing reference numbers, timestamps, soft-delete/archive state where retention requires it, and explicit visibility fields. Use database constraints and foreign keys for integrity. Keep audit events append-only.

## 10. Authorization and Row-Level Security

RLS is enabled on every application table and every private storage bucket. Database policies, not frontend conditionals, are the security boundary.

Required policy rules:

- Customers may select only cases, projects, documents, notifications, and RFIs connected to their approved customer organization and marked customer-visible.
- Contributors may select resources owned by their organization, assigned to them, or explicitly shared through a project participant/access grant.
- Contributors may modify only allowed fields on resources assigned to them and only for valid workflow transitions.
- Supervisors may manage organization queues and assignments, within their organization and shared-project authority.
- Organization administrators may configure their organization but cannot access unshared data for another organization.
- System administrators have audited platform-wide access through server-side administrative workflows; do not grant broad client-side write policies.
- Cross-organization access is granted by explicit participant/access records with scope and expiry, never inferred from a project name or customer relationship.
- Storage access checks document metadata, organization/case membership, visibility, and malware-scan status.

## 11. Security, Privacy, and Compliance

- HTTPS/TLS in all environments.
- Secrets stored only in deployment secret stores and local ignored environment files.
- Commit `.env.example`; ignore `.env`, `.env.local`, and all credential-bearing files.
- Use `SUPABASE_SERVICE_ROLE_KEY` only in a trusted Next.js server environment. Never prefix it with `NEXT_PUBLIC_`.
- Apply strict content security policy, secure headers, input validation, output encoding, and dependency scanning.
- Record all sensitive reads, exports, assignments, status transitions, authorization grants, and administrative changes in audit logs.
- Encrypt data in transit and at rest using platform capabilities.
- Establish retention, archival, legal-hold, and deletion policies with participating agencies before production data import.
- Perform accessibility testing to WCAG 2.1 AA, including keyboard Gantt navigation and accessible alternatives for chart data.
- Conduct security review, RLS test suite, and authorization penetration tests before pilot launch.

## 12. Infrastructure and Delivery

### 12.1 Repository Structure

```text
app/
  (auth)/               # Login, registration, password reset
  (portal)/             # Customer and staff protected routes
  admin/                # Organization and system administration
  api/                  # Route Handlers, webhooks, scheduled jobs
  layout.tsx            # Root layout and providers
  page.tsx              # Public landing page
components/
  ui/                   # shadcn/ui primitives
  features/             # Intake, cases, projects, gantt, work, admin
lib/
  supabase/             # Browser/server/admin Supabase clients
  actions/              # Server Actions and authorization helpers
  schemas/              # Shared validation schemas
middleware.ts           # Session-aware protected-route middleware
supabase/
  migrations/          # Version-controlled schema and RLS policies
  seed.sql             # Non-production reference/demo data
  tests/               # Database/RLS tests
```

### 12.2 Environments

- Local: local Supabase or dedicated development project; `.env.local` is ignored.
- Development: shared developer deployment with synthetic data only.
- Staging: production-like deployment for integration, security, and UAT testing.
- Production: separate Supabase project, audited secrets, backups, monitoring, and approved releases.

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EMAIL_PROVIDER_API_KEY=
APP_BASE_URL=
```

The first two variables are browser-visible. All others are server-only. Do not put actual values in documentation or source control.

### 12.3 CI/CD and Operations

Tasks:

- [ ] Add `.gitignore` protections for local environment files, dependencies, build output, and coverage output.
- [ ] Add `.env.example` with blank values and explanatory comments that omit secrets.
- [ ] Use GitHub as the source repository and require GitHub pull requests for protected-branch changes.
- [ ] Run formatting, linting, type checking, Vitest unit/integration tests, Playwright end-to-end tests, RLS tests, and production build in GitHub Actions CI.
- [ ] Validate migrations against a clean database in CI.
- [ ] Deploy migrations before application deployment using an approved migration pipeline.
- [ ] Deploy Next.js application environments on Vercel, with preview deployments for pull requests and separate development, staging, and production projects.
- [ ] Require pull-request review, passing checks, and staging verification before production deployment.
- [ ] Configure Vercel error tracking and analytics, structured application logs, uptime checks, database performance monitoring, and alerting.
- [ ] Define backup, restore, incident response, and release rollback procedures.

## 13. Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Performance | Primary dashboards load usable content in under 2 seconds at normal pilot load; mutations provide feedback within 1 second when upstream services are healthy. |
| Availability | Target 99.5% monthly availability for the pilot, excluding scheduled maintenance. |
| Scale | Support at least 10 participating organizations, 500 staff users, 10,000 customer users, and 100,000 cases with pagination and indexed queries. |
| Accessibility | WCAG 2.1 AA, responsive design, keyboard navigation, screen-reader support, and text alternatives for Gantt data. |
| Auditability | Every workflow, access-governance, document, and administrative action is traceable. |
| Reliability | Idempotent workflow transitions and notification delivery; no partial state changes on failed operations. |
| Data retention | Configurable by organization; the default policy is determined before pilot data goes live. |

## 14. Delivery Milestones

### Milestone 0: Discovery and Governance

- [ ] Confirm participating organizations, agency terminology, data-sharing agreements, record retention, and authoritative external comment links.
- [ ] Validate workflows, processing minimums, SLAs, routing rules, escalation policies, and customer-visible language.
- [ ] Define pilot users, representative projects, acceptance scenarios, and data migration needs.

Exit criteria: approved workflow catalog and access-governance model for initial organizations.

### Milestone 1: Foundation and Security

- [ ] Scaffold Next.js App Router, React, TypeScript, Tailwind CSS, and shadcn/ui application foundations and repository standards.
- [ ] Configure Supabase projects, migrations, CI, environments, secrets, logging, and error tracking.
- [ ] Create organization, profile, membership, audit, and authorization foundation with tested RLS.
- [ ] Implement email/password authentication and protected route shell.

Exit criteria: users can sign in and see only authorized navigation; RLS tests pass.

### Milestone 2: Case and Workflow Foundation

- [ ] Build schema and APIs for customers, projects, workstreams, requests, workflow definitions, stages, assignments, and audit events.
- [ ] Implement organization admin workflow/type/routing configuration.
- [ ] Implement staff intake queue, classification, routing, owner assignment, and status transitions.

Exit criteria: authorized staff can create and process a case through a configured workflow with full audit history.

### Milestone 3: Customer Portal and Intake

- [ ] Build registration/invitation, customer dashboard, guided intake, drafts, request detail, document center, and realtime updates.
- [ ] Build private uploads, document authorization, and customer-visible updates.

Exit criteria: a customer can submit a request, receive confirmation, upload required documents, and see only authorized status information.

### Milestone 4: Multi-Agency Coordination and Gantt

- [ ] Build project workspace, participants, workstreams, coordination tasks, dependencies, risks, and current owner display.
- [ ] Implement Gantt chart, task/milestone editing, schedule calculations, and permission-aware rendering.
- [ ] Onboard initial multi-agency pilot workflows for roads, airport, power, wastewater, environmental, and coastal scenarios.

Exit criteria: supervisors can manage a shared project across agencies and identify schedule risk/dependencies without unauthorized data exposure.

### Milestone 5: RFI, Comment Tracking, Notifications, and Escalation

- [ ] Implement RFI lifecycle, clock management, due dates, reminders, and customer response workflow.
- [ ] Implement comment/hearing tracking with external submission links.
- [ ] Implement in-app/email notifications, delivery logging, escalations, and deadline jobs.

Exit criteria: overdue RFI and task scenarios trigger correct customer/staff notices and auditable escalations.

### Milestone 6: Reporting, Quality, and Pilot Launch

- [ ] Build organization/system admin reporting and authorization-scoped exports.
- [ ] Complete integration, RLS, accessibility, performance, security, and user-acceptance testing.
- [ ] Train pilot staff, import approved pilot data, launch staging UAT, and execute production readiness review.

Exit criteria: pilot agencies approve workflow outcomes, security controls, accessibility results, support process, and rollback plan.

## 15. Open Decisions Before Implementation

- Which organizations are active in the first pilot versus represented as future configuration?
- Which workflows require formal regulatory clock calculations and which use service targets only?
- What customer organization verification and staff invitation approvals are required?
- Which documents are customer-visible, inter-agency restricted, public, or retention-controlled?
- What are the authoritative public-comment systems and notice publication requirements for each organization?
- Which external systems have confirmed APIs, data owners, legal agreements, and synchronization expectations?
- What retention, legal hold, records-request, and data-residency obligations govern production data?
- Which email provider and operational support model will serve the pilot?

## 16. Definition of Done

A feature is complete only when it has an approved user flow, backend validation, RLS coverage, audit events, loading/error/empty states, accessibility checks, automated tests proportional to its risk, and documentation for operations/configuration. For privileged features, completion also requires a negative authorization test proving that an unauthorized user cannot read or mutate the protected resource.
