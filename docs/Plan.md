YOU ARE THE MASTER IMPLEMENTATION ORCHESTRATOR, STAFF SOFTWARE ENGINEER, PRODUCT ARCHITECT, DATABASE ARCHITECT, SECURITY REVIEWER, AND INTEGRATION OWNER FOR:

REPOSITORY:
https://github.com/grandpajoe1980/permit_tracker

PRODUCT:
PATH — Louisiana Project Delivery / Permit / Interagency Workflow Command System

MISSION:
Take the repository FROM ITS ACTUAL CURRENT STATE and turn it into a genuinely end-to-end working project/workflow management system in which:

1. A customer/project office such as SpaceX can:
   - create a project or submit a request
   - request government assistance
   - submit permit/approval requests
   - upload files and studies
   - answer Requests for Information
   - monitor every authorized project/workstream
   - understand what is happening now
   - understand what SpaceX must do next
   - understand what government must do next
   - see schedule, milestones, dependencies, blockers, statutory waiting periods, and forecast dates
   - see a project-level Gantt
   - see documents and their review state
   - escalate an issue appropriately
   - return later, from another computer/browser, and see exactly the same persisted state

2. A government employee can:
   - receive assigned work
   - clearly see why it is in their queue
   - see the governing workflow stage
   - see legal/process requirements for that stage
   - see required documents/checklists
   - start work
   - add notes with proper visibility
   - upload/review documents
   - ask the applicant for information
   - request help from another agency
   - mark an item blocked/waiting
   - transfer/reassign authorized work
   - escalate problems
   - complete their stage
   - preview exactly where the work goes next
   - hand the work to the next department/unit/person
   - eventually complete the workstream

3. An agency administrator can:
   - build workflows without editing source code
   - create a draft workflow
   - configure stages
   - configure which agency/unit owns each stage
   - configure required roles/capabilities
   - configure required documents
   - configure checklist requirements
   - configure processing targets
   - configure minimum statutory waiting periods
   - configure public notice/hearing periods
   - configure clock pause/resume behavior
   - configure allowed transitions
   - configure parallel stages
   - configure dependencies
   - configure escalation rules
   - configure customer-visible labels
   - preview/test a workflow
   - publish an immutable workflow version
   - leave existing workstreams pinned to the workflow version under which they started

4. The State Project Office can:
   - view the whole project
   - see every participating agency
   - see every workstream
   - see cross-agency dependencies
   - identify bottlenecks
   - identify blocked work
   - identify overdue work
   - identify upcoming deadlines
   - identify statutory waiting periods
   - identify critical-path impacts
   - see current accountable owner
   - escalate across agencies
   - view project-level Gantt and project health

5. EVERYTHING THAT CHANGES STATE MUST BE PERSISTENT.
   Supabase PostgreSQL and Supabase Storage are the production sources of truth.

======================================================================
0. FIRST: READ THE REPOSITORY PROTOCOL
======================================================================

Before changing code:

1. Read:
   - docs/.agents.md
   - README.md
   - docs/PRD.MD
   - docs/execution-plan.md
   - docs/progress.md
   - docs/operational-ux.md
   - all relevant docs/testing/*
   - package.json

2. Inspect:
   - latest 20 commits
   - current git status
   - full source tree
   - app/
   - components/
   - lib/
   - lib/supabase/
   - db/
   - supabase/migrations/
   - tests/
   - scripts/

3. Follow docs/.agents.md as the orchestration protocol.

4. HOWEVER:
   DO NOT TRUST CHECKBOXES OR CLAIMS OF COMPLETION IN THE PRD,
   execution-plan.md, or progress.md without reproducing them.

The documentation currently claims a more complete state than the code actually demonstrates.

Treat implementation + reproducible tests + live persistence as truth.

======================================================================
1. IMPORTANT CURRENT-STATE CONTEXT
======================================================================

Current main has recently gone through a persistence change, rollback, and follow-up navigation work.

DO NOT:
- blindly cherry-pick previous persistence commits
- blindly revert the rollback
- restore old code wholesale
- assume a prior commit represents the desired architecture

Instead:
inspect current HEAD and implement the correct solution forward.

KNOWN CURRENT ARCHITECTURE:

- Next.js App Router
- Vinext / Vite
- React 19
- TypeScript
- Tailwind / existing PATH visual system
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- Supabase Realtime
- Node test runner
- Playwright
- Drizzle exists, but db/schema.ts currently models SQLite while production persistence is Supabase PostgreSQL

Preserve the existing PATH visual identity and useful current functionality.

Do not unnecessarily rewrite good UI.

======================================================================
2. CURRENT PROBLEMS YOU MUST VERIFY AND RESOLVE
======================================================================

Treat each of these as an investigation item, not merely an assertion.

[ ] A. FIRE-AND-FORGET DATABASE MUTATIONS

Current repository methods frequently:
1. mutate in-memory objects
2. update the UI
3. call a Supabase mutation with `void`
4. return success without awaiting the database

Example patterns exist in lib/repository.ts.

This violates the project's own durability gate.

TARGET:
No state-changing UI may show success until the canonical database transaction succeeds.

Pattern must become:

USER ACTION
→ UI shows "Saving..."
→ authenticated server mutation
→ validate actor
→ validate workflow/action
→ DB transaction succeeds
→ audit + notification committed
→ authoritative result returned
→ UI updates
→ success shown

If database write fails:
- UI must not pretend success
- local state must not remain falsely updated
- user sees actionable failure
- retry is possible

--------------------------------------------------

[ ] B. FIXTURE DATA REMAINS MIXED WITH PRODUCTION STATE

Current code still imports:
- spacex-megaproject-fixture
- demo-data
- customer-portal fixture content
- pecanIslandRequests

Fixtures are useful for:
- unit tests
- deterministic demo seeds
- explicit development/demo mode

They must NOT silently become production records when Supabase returns zero rows.

An empty authorized database result must mean:
"there are zero records"

NOT:
"show the fixture because the DB returned nothing."

Create an explicit boundary such as:

APP_DATA_MODE=production
APP_DATA_MODE=demo

Production:
Supabase only.

Demo:
seed Supabase with deterministic demo records.

Prefer even demo mode to run against Supabase rather than a completely separate in-memory product.

--------------------------------------------------

[ ] C. TWO COMPETING REQUEST MODELS EXIST

Inspect:
- legacy `requests`
- newer `customer_requests`
- lib/supabase-browser.ts
- lib/supabase/queries.ts
- lib/supabase/mutations.ts
- app/page.tsx

There must be ONE canonical intake/request model.

Choose the least disruptive canonical model after inspecting current migrations.

Preferred direction:
standardize customer/project intake on `customer_requests` if it is the more mature current model, while creating a migration/compatibility strategy for any useful data in legacy `requests`.

Do not leave two application paths where:
one dashboard reads `requests`
and another creates `customer_requests`.

--------------------------------------------------

[ ] D. RLS IS CURRENTLY TOO BROAD

Audit every policy.

Search specifically for:
- `OR true`
- `USING (true)`
- `WITH CHECK (true)`
- broad authenticated grants
- service-role usage
- unrestricted Storage access

REMOVE any policy that gives authenticated users unrestricted access merely because they are logged in.

Authorization must reflect:
- customer organization
- project participation
- owning organization
- explicit cross-agency sharing
- assigned users
- role/capability
- administrator scope

A logged-in LDEQ reviewer must not automatically see every SpaceX record merely because they are authenticated.

A SpaceX user must not see another customer organization's project.

An organization administrator must not administer another organization.

--------------------------------------------------

[ ] E. SERVER CLIENT / SERVICE ROLE TRUST BOUNDARY

Inspect lib/supabase/client.ts and all route handlers.

Do not allow ordinary HTTP endpoints to become privileged simply because the server happens to have SUPABASE_SERVICE_ROLE_KEY.

Normal user-facing routes/actions should execute as the authenticated user whenever practical.

Build a proper request-bound Supabase server client using:
- authenticated cookies/session
- publishable/anon credential
- user JWT
- RLS

Service role should be isolated to narrowly defined trusted administrative/background operations.

Never expose service role to browser code.

Never use service role as a fallback for an ordinary end-user request.

--------------------------------------------------

[ ] F. API ROUTES NEED REAL AUTHORIZATION

Inspect app/api/requests/route.ts and all future endpoints.

Every endpoint must:
- establish authenticated user
- reject anonymous access when required
- validate payload with Zod
- derive actor identity server-side
- ignore client-supplied claims about privileges
- enforce project/workstream authorization
- validate permitted transition
- use transaction/RPC where multiple records change
- return sanitized result

Never trust fields such as:
- actorUserId
- actorRole
- actorOrg
- isAdmin

simply because the browser sent them.

--------------------------------------------------

[ ] G. DUPLICATE AUDIT / NOTIFICATION WRITES

Inspect RPCs such as rpc_create_customer_request.

If an RPC already writes:
- request
- audit event
- notification

do NOT write the audit and notification a second time in client code.

For each domain transaction establish exactly one owner of:
- primary mutation
- audit event
- notification generation

Compound operations should generally be atomic.

--------------------------------------------------

[ ] H. PROJECT-ID / PROJECT-CODE CONSISTENCY

Normalize:
- database PK
- project code
- display number
- route parameter

Do not inconsistently treat `PRJ-PECAN-2026` as:
- ID in one area
- number in another
- code somewhere else.

Use explicit names:
project.id
project.code

Filter every project-specific query.

--------------------------------------------------

[ ] I. QUERIES THAT ACCEPT projectId MUST ACTUALLY USE projectId

Audit lib/supabase/queries.ts.

Functions such as:
fetchWorkstreams(projectId)
fetchCustomerRequests(projectId)
fetchDocuments(projectId)
fetchAuditEvents(projectId)

must scope queries correctly.

Do not return an entire table and assume the UI will filter it.

RLS is defense in depth, not an excuse for broad queries.

--------------------------------------------------

[ ] J. WORKFLOW DESIGNER IS CURRENTLY MOSTLY DISPLAY-ONLY

Current WorkflowDesignerPanel has disabled controls such as:
- Create Draft
- Add Authorization Type
- Register Organization

Turn this into a real persistent administrative capability.

--------------------------------------------------

[ ] K. GANTT IS VISUALLY USEFUL BUT STILL TOO FIXTURE/HARDCODE DRIVEN

Preserve the good current visual work.

Replace:
- hardcoded "today"
- fixed March–December horizon
- fixture-only schedule inputs

with:
- current date
- dynamic project range
- persisted tasks/stages/milestones
- persisted dependencies
- baseline vs current forecast
- actual dates
- operational-state color coding
- project filters

--------------------------------------------------

[ ] L. CURRENT E2E TESTS OVERSTATE CROSS-BROWSER VERIFICATION

Rewrite/extend them so they actually prove the record created in Browser A is retrieved and acted upon in Browser B.

Do not count a test as cross-browser persistence merely because:
Browser B successfully loads the Notifications page.

Browser B must assert the exact data created by Browser A.

Likewise RFI tests must:
issue RFI
→ see exact RFI as customer
→ respond
→ see response as reviewer
→ accept
→ verify workstream clock/state changed

--------------------------------------------------

[ ] M. REMOVE FALSE DOCUMENT SUCCESS

If a document cannot be retrieved from Supabase Storage, production UI must not synthesize a fake "certified document" and report that the real document was verified.

Development placeholder behavior must be explicitly demo-only.

Production:
real file or real error.

======================================================================
3. PRODUCT DOMAIN MODEL
======================================================================

PATH should model the real work this way:

PROJECT
The overall undertaking.

Examples:
- SpaceX Louisiana Launch Complex
- airport construction
- industrial plant
- coastal restoration program
- highway improvement

A project contains many WORKSTREAMS.

--------------------------------------------------

CUSTOMER REQUEST
Something the project/customer asks government to do.

Examples:
- "We need an access road"
- "We need an air permit"
- "We need help determining coastal approvals"
- "We are ready to begin the FAA airport process"
- "We need a wastewater authorization"
- "Help resolve this blocker"
- "We are not sure which permits apply"

A request may be triaged into:
- one workstream
- several workstreams
- an informational response
- an existing workstream

--------------------------------------------------

WORKSTREAM / CASE
One track of governmental work.

Examples:
- DOTD LA-82 access improvements
- FAA airport determination
- LDEQ air permit
- LDEQ LPDES wastewater permit
- CPRA Coastal Use Permit
- USACE Section 404
- LDH water review
- natural gas pipeline coordination
- fire marshal cryogenic storage approval
- utility interconnection
- coastal restoration study

Each workstream:
- belongs to one project
- has one current workflow version
- has one current workflow stage
- has one accountable owner
- has one owning/lead organization
- may involve several participant organizations
- has tasks
- has documents
- has RFIs
- has dependencies
- has schedule dates
- has operational state
- has audit history

--------------------------------------------------

WORKFLOW TEMPLATE

Defines a reusable process.

Example:

LDEQ AIR PERMIT
1. Intake
2. Completeness review
3. Technical review
4. Applicant RFI if necessary
5. Public notice
6. Response to comments
7. Final technical determination
8. Permit issuance

Another workflow could hand across agencies:

COASTAL INFRASTRUCTURE APPROVAL
1. State Project Office intake
2. CPRA screening
3. LDNR/OCM review
4. USACE review
5. LDWF consultation
6. Applicant revisions
7. public notice
8. concurrent final review
9. determination

The system must support cross-agency handoffs.

--------------------------------------------------

WORKFLOW INSTANCE

When a workstream starts, it becomes an instance of a specific published workflow version.

Changing the master workflow later must NOT silently rewrite an in-flight legal/regulatory process.

Store/pin:
workflow_version_id

--------------------------------------------------

WORKFLOW STAGE

Each stage should support configuration for:

- name
- internal description
- customer-visible name
- responsible organization
- responsible organizational unit
- required role/capability
- target processing duration
- minimum legal processing period
- clock behavior
- required documents
- completion checklist
- allowed transitions
- whether it can run in parallel
- whether it is a milestone
- public-comment requirements
- hearing requirements
- external-system filing requirement
- legal authority citation/reference
- escalation policy
- customer visibility
- transition/handoff destination

--------------------------------------------------

OPERATIONAL STATE

Keep workflow stage separate from operational state.

Good operational states include:

- running
- waiting_applicant
- waiting_government
- waiting_external
- statutory_waiting_period
- scheduled_hold
- blocked
- escalated
- complete
- cancelled

Example:

Workflow Stage:
Technical Review

Operational State:
Waiting Applicant

Reason:
RFI-2026-0043 — updated hydraulic analysis requested

This separation is important.

======================================================================
4. CANONICAL DATABASE MODEL
======================================================================

Do not gratuitously rebuild the entire schema if good current tables exist.

Review existing PostgreSQL migrations and evolve them.

The canonical model should cover at least:

[ ] organizations
[ ] organizational_units
[ ] user_profiles
[ ] organization_memberships
[ ] projects
[ ] project_participants / access grants
[ ] customer_requests
[ ] permit_types / authorization catalog
[ ] requirement_resources
[ ] workflow_templates
[ ] workflow_versions
[ ] workflow_stages
[ ] workflow_transitions
[ ] stage requirements / document requirements
[ ] workflow_instances or equivalent pinned workflow context
[ ] workstreams
[ ] stage_runs or equivalent stage execution history
[ ] tasks
[ ] task_dependencies
[ ] milestones
[ ] notes
[ ] RFIs
[ ] RFI responses
[ ] coordination requests
[ ] escalations
[ ] documents
[ ] document_versions
[ ] document_agency_reviews
[ ] external_filings
[ ] public_comment_periods
[ ] hearings
[ ] commitments
[ ] notifications
[ ] audit_events

Where the current model already supports this cleanly, extend rather than duplicate.

======================================================================
5. REMOVE THE SQLITE/POSTGRES SCHEMA SPLIT
======================================================================

Production persistence is Supabase PostgreSQL.

db/schema.ts currently uses SQLite Drizzle definitions.

Choose one coherent strategy.

OPTION A:
Supabase SQL migrations are canonical; remove or clearly retire the stale SQLite model.

OPTION B:
If Drizzle is retained for schema typing/generation, convert it to PostgreSQL pg-core and keep it synchronized with migrations.

DO NOT continue maintaining a production Postgres schema and an unrelated SQLite schema that appear to represent the same application.

Document the chosen approach in:
docs/architecture.md

======================================================================
6. BACKEND WORKFLOW TRANSACTIONS
======================================================================

Create clean domain-level server functions/RPCs for major actions.

At minimum:

[ ] createCustomerRequest
[ ] updateCustomerDraft
[ ] submitCustomerRequest
[ ] withdrawDraft
[ ] triageCustomerRequest
[ ] createProject
[ ] createWorkstreamFromRequest
[ ] assignWorkstream
[ ] reassignWorkstream
[ ] startStage
[ ] addNote
[ ] issueRFI
[ ] submitRFIResponse
[ ] acceptRFIResponse
[ ] rejectRFIResponse
[ ] markBlocked
[ ] clearBlocker
[ ] createCoordinationRequest
[ ] completeCoordinationRequest
[ ] transferWork
[ ] escalateWork
[ ] resolveEscalation
[ ] completeStage
[ ] advanceToNextStage
[ ] createTask
[ ] updateTask
[ ] createDependency
[ ] updateDependency
[ ] uploadDocumentVersion
[ ] reviewDocumentVersion
[ ] createWorkflowDraft
[ ] updateWorkflowDraft
[ ] publishWorkflowVersion

Every state-changing operation must define:

- authorized actor
- required capability
- allowed prior state
- resulting state
- affected rows
- audit event
- notifications
- transaction boundary
- returned authoritative record

======================================================================
7. WORKFLOW TRANSITION ENGINE
======================================================================

DO NOT let the browser arbitrarily set database status strings.

Workflow state changes must be validated server-side.

For `completeStage`, verify:

[ ] actor has authority
[ ] stage is current/active
[ ] required checklist items are satisfied
[ ] required documents exist
[ ] required document approvals exist when configured
[ ] prerequisite tasks are complete
[ ] minimum statutory period has elapsed
[ ] required public-comment/hearing windows are complete
[ ] unresolved mandatory RFIs are handled
[ ] blocking dependencies are resolved
[ ] transition is allowed by the published workflow version

Then perform in ONE transaction where practical:

1. close current stage
2. create stage-completion event
3. calculate next stage(s)
4. activate next stage(s)
5. assign next owner/queue
6. create tasks if configured
7. recalculate schedule
8. create audit events
9. create notifications
10. return resulting authoritative state

The UI button should be something understandable such as:

"Complete review & hand off to CPRA"

NOT merely:
"Set state = stage_4"

======================================================================
8. WORKFLOW VERSIONING
======================================================================

Published workflow versions are immutable.

Required lifecycle:

DRAFT
→ VALIDATED
→ PUBLISHED
→ RETIRED

Administrator workflow:

1. Open published workflow v4
2. Click "Create Draft v5"
3. Edit v5
4. Validate
5. Preview/test
6. Publish v5

Existing workstreams on v4 stay on v4.

New workstreams use v5.

Every:
- draft creation
- configuration change
- publication
- retirement

must be audited.

======================================================================
9. WORKFLOW DESIGNER UI
======================================================================

Build a practical workflow designer for agency administrators.

Do not make it a source-code editor.

Primary screen:

LEFT:
Workflow stages in sequence

CENTER:
Selected stage configuration

RIGHT:
Transition / handoff preview

Provide:

[ ] Add stage
[ ] Duplicate stage
[ ] Delete draft stage
[ ] Reorder stages
[ ] Configure responsible agency
[ ] Configure organizational unit
[ ] Configure role/capability
[ ] Configure customer-visible stage name
[ ] Configure SLA/target duration
[ ] Configure minimum statutory days
[ ] Configure clock behavior
[ ] Configure required documents
[ ] Configure checklist
[ ] Configure transition destinations
[ ] Configure parallel stages
[ ] Configure escalation policy
[ ] Configure public notice/hearing settings
[ ] Configure external filing link/system
[ ] Configure legal citation/reference
[ ] Preview customer view
[ ] Preview government view
[ ] Validate workflow
[ ] Publish

Workflow validation must detect:

[ ] no starting stage
[ ] no terminal stage
[ ] unreachable stages
[ ] invalid transition target
[ ] accidental loops
[ ] missing owner
[ ] missing required role
[ ] impossible statutory timing
[ ] missing required document type reference
[ ] duplicate sequence/order problems
[ ] parallel branch that can never rejoin where a join is required

Allow explicit rework loops only when intentionally configured.

======================================================================
10. CUSTOMER REQUEST EXPERIENCE
======================================================================

Build a straightforward intake process.

The user should not need to understand Louisiana government organizational structure.

Offer intents such as:

- Permit / authorization
- Road / infrastructure
- Airport / aviation
- Environmental / air / water
- Coastal / wetlands
- Utility / power / natural gas
- Fire / hazardous materials / cryogenic systems
- Government coordination help
- Project blocker
- General question
- "I'm not sure what I need"

The form should support:
- project
- title
- description
- desired outcome
- affected location
- desired date
- urgency/schedule impact
- files
- known agency if user knows
- known permit if user knows

On submission:

CUSTOMER
→ request persisted
→ audit persisted
→ receipt generated
→ intake queue notified
→ customer sees confirmation number

Then government triage:

INTAKE
→ classify request
→ link/create project
→ determine applicable processes
→ create workstream(s)
→ select published workflow(s)
→ assign lead organization/owner
→ create first stage/task
→ notify customer and government staff

One request may create multiple workstreams.

Example:

"Build a new access road and bridge"

could spawn:
- DOTD roadway workstream
- wetlands/USACE workstream
- CPRA coastal workstream
- utility relocation workstream

======================================================================
11. CUSTOMER PROJECT PAGE
======================================================================

Clicking a project anywhere in the product must open a real project route.

Implement physical App Router routes rather than relying exclusively on an internal React route enum.

At minimum:

/dashboard
/requests/new
/requests/[requestId]
/projects/[projectId]
/projects/[projectId]/gantt
/projects/[projectId]/workstreams/[workstreamId]
/work
/intake
/coordination
/escalations
/admin/organization
/admin/organization/workflows
/admin/system
/reports

Do not attempt a giant rewrite in one step.

Incrementally extract the current 140k+ app/page.tsx into:
- route pages
- shared layouts
- reusable work components
- domain services

Preserve existing working UI during extraction.

======================================================================
12. PROJECT WORK PAGE
======================================================================

This is one of the highest priorities.

When a user clicks a project:

/projects/[projectId]

should feel like the operational home for that project.

TOP SUMMARY:
- project name
- customer
- project manager
- current phase
- overall health
- baseline
- forecast
- variance
- current critical-path issue
- next major milestone

TABS/AREAS:
- Overview
- Work
- Schedule
- Documents
- RFIs
- Dependencies
- Decisions
- Participants
- Activity

The Work tab should show every workstream.

Clicking a workstream opens its workbench.

======================================================================
13. GOVERNMENT WORKBENCH
======================================================================

The workbench should make it almost impossible to wonder:
"What am I supposed to do?"

HEADER:

Workstream
Permit / process
Current workflow stage
Current operational state
Responsible agency
Assigned reviewer
Due date
Clock state
SLA
Statutory minimum
Critical path
Variance

PRIMARY CARD:

"WHAT YOU NEED TO DO NOW"

Example:

Technical Completeness Review

Before you can complete this step:

✓ Site plan received
✓ Wetlands delineation received
□ Hydraulic study approved
□ Completeness checklist item 4

Next handoff:
CPRA Coastal Engineering Review

BUTTON:
Complete Review & Send to CPRA

--------------------------------------------------

ACTION BAR:

[ Complete Step ]
[ Request Information ]
[ Add Note ]
[ Mark Blocked ]
[ Ask Another Agency ]
[ Transfer ]
[ Escalate ]
[ Attach Document ]

Only show/enable actions the current actor is authorized to perform.

--------------------------------------------------

STATE CONTROL:

Allow staff to understand/change operational condition,
but do not expose arbitrary unrestricted database status mutation.

For example:

Running
Waiting on Applicant
Waiting on Government
Waiting on External Party
Statutory Waiting Period
Blocked
Escalated

Require structured reason fields where appropriate.

--------------------------------------------------

WORKBENCH SECONDARY PANELS:

Documents
RFIs
Tasks
Dependencies
Notes
Schedule impact
Audit/activity
Participants
Legal/process reference

======================================================================
14. NOTES AND VISIBILITY
======================================================================

Implement persisted notes with explicit visibility classes:

- internal organization
- government project participants
- customer visible
- restricted named participants

Never derive security merely from hiding a note in React.

Enforce visibility in database/server authorization.

Audit note creation and material visibility changes.

======================================================================
15. REQUEST FOR INFORMATION WORKFLOW
======================================================================

Government reviewer:

Request Information
→ structured question
→ requested documents
→ response due date
→ clock rule
→ customer visibility
→ issue

System transaction:

1. creates RFI
2. updates workstream state if policy says pause
3. records clock event
4. recalculates forecast if necessary
5. creates audit event
6. notifies customer

Customer sees:
"ACTION REQUIRED"

Customer:
- enters response
- uploads documents
- submits response

Reviewer:
- sees submitted response
- Accept
- Request clarification
- Reject if allowed

Acceptance:
- closes/accepts response
- resumes clock
- recalculates schedule
- restores workstream to appropriate running state
- audits
- notifies

======================================================================
16. ESCALATIONS
======================================================================

Escalation is not simply a red badge.

Persist an escalation record with:

- workstream
- reason
- type
- created by
- current level
- current recipient
- created timestamp
- required response date
- status
- resolution
- resolved by
- resolved timestamp

Example ladder:

Reviewer
→ Supervisor
→ Agency Program Manager
→ Agency Executive
→ State Project Office
→ Executive escalation

The escalation policy should be configurable by organization/workflow.

Escalating must not automatically change the legal workflow stage unless a configured/authorized action explicitly does so.

======================================================================
17. DOCUMENT SYSTEM
======================================================================

Supabase Storage bucket remains PRIVATE.

Required model:

document
→ versions
→ agency reviews
→ workstream/project links

Each version should preserve:
- file name
- MIME type
- size
- storage object path
- SHA-256
- uploaded by
- uploaded organization
- timestamp
- change summary
- status
- malware scan state
- visibility/access classification

Never silently overwrite a prior version.

UPLOAD:

user
→ authorization check
→ storage upload
→ SHA-256
→ document_version metadata
→ review assignments
→ audit
→ return success

DOWNLOAD:

user requests document
→ app verifies metadata authorization
→ signed short-lived URL
→ download

Unauthorized user:
DENIED.

Do not use the existence of the storage object path as authorization.

======================================================================
18. STORAGE RLS
======================================================================

Do not allow:

"any authenticated user may read anything in path-documents"

Use either:

A. strict Storage RLS tied to authorized document metadata

or

B. block direct listing/read and issue signed URLs from an authorized server endpoint

Prefer opaque storage object identifiers.

Do not encode sensitive customer/project information unnecessarily into object paths.

======================================================================
19. PROJECT SCHEDULE / GANTT
======================================================================

Preserve the current state-color approach.

A real project Gantt must show:

- past actual/history
- current execution
- future forecast
- baseline
- actual dates
- forecast dates
- milestones
- stage/task bars
- dependencies
- critical path
- schedule variance
- owning organization
- blocked/wait state color
- RFI pauses
- public-comment/statutory waits
- external waits
- escalations

Provide:
- day
- week
- month
- quarter if useful

Dynamic range:
derive from project data.

Today:
derive from current date.

Do not hardcode August 30, 2026 into the component.

--------------------------------------------------

A workstream should be expandable.

Collapsed:
Workstream summary

Expanded:
individual stages/tasks

Example:

LDEQ AIR PERMIT
   Intake                  █████
   Completeness Review          █████
   Technical Review                  █████████
   RFI Hold                              ███
   Public Notice                            ███████
   Final Determination                             █████

This makes past, present, and future immediately understandable.

--------------------------------------------------

Dependencies must be persisted.

Support at least:
- Finish-to-Start
- Start-to-Start
- Finish-to-Finish
- lag days

Changing a predecessor date must recalculate affected forecast dates.

Use/enhance the existing schedule engine rather than replacing useful working logic without cause.

======================================================================
20. STATUTORY / LEGAL PROCESS SUPPORT
======================================================================

PATH must support laws and processes without pretending the application itself is legal counsel.

Workflow configuration should record:

- legal authority citation
- source link
- effective date
- last verified date
- minimum statutory time
- public-comment requirements
- required notice
- hearing requirement
- external authoritative filing system
- required documents/checklists

Do not invent regulatory requirements.

Seeded data may demonstrate the capability, but source/reference metadata must be explicit.

======================================================================
21. REALTIME
======================================================================

Realtime should update relevant UI without subscribing indiscriminately to every event in every public table if avoidable.

Scope subscriptions by:
- project
- relevant entities
- current user's access

Realtime is a synchronization aid.

It does not replace:
- database transactions
- authorization
- normal query hydration

======================================================================
22. SECURITY MODEL
======================================================================

Create and document capabilities such as:

- project.read
- project.manage
- request.submit
- request.triage
- workstream.read
- workstream.assign
- workstream.transition
- workstream.escalate
- note.internal.create
- note.customer.create
- rfi.create
- rfi.respond
- rfi.review
- document.upload
- document.review
- workflow.manage
- workflow.publish
- organization.manage
- system.admin

Roles map to capabilities.

Server/backend checks capabilities.

Do not sprinkle hardcoded user names through authorization logic.

======================================================================
23. RLS ACCEPTANCE MATRIX
======================================================================

Create automated tests for:

CUSTOMER A:
[ ] sees own organization projects
[ ] sees own requests
[ ] sees authorized documents
[ ] cannot see Customer B

CUSTOMER B:
[ ] cannot see Customer A

AGENCY REVIEWER:
[ ] sees assigned work
[ ] sees organization-owned work where policy allows
[ ] sees explicitly shared project records
[ ] cannot see unrelated restricted cases

AGENCY SUPERVISOR:
[ ] manages permitted organization work
[ ] cannot administer another organization

ORG ADMIN:
[ ] manages their organization workflows/users
[ ] cannot manage another organization

SYSTEM ADMIN:
[ ] appropriately elevated

DOCUMENTS:
[ ] unauthorized signed URL request denied
[ ] direct unauthorized Storage read denied

======================================================================
24. AUDIT LEDGER
======================================================================

Audit events should be append-only.

Ordinary authenticated users must not:
- update audit history
- delete audit history

Audit meaningful actions including:

- request submitted
- request triaged
- project created
- workstream created
- assigned/reassigned
- state changed
- stage completed
- RFI issued
- RFI responded
- RFI accepted/rejected
- blocker created/resolved
- note added
- document uploaded
- document reviewed
- workflow changed
- workflow published
- escalation created/resolved
- dependency changed
- due date changed

Include:
- actor
- organization
- timestamp
- entity
- old state
- new state
- reason
- correlation/transaction ID where useful

======================================================================
25. USER EXPERIENCE PRINCIPLES
======================================================================

This product should behave like a good project/work management system, not like a database administration screen.

At every page answer:

1. Where am I?
2. What is this?
3. What state is it in?
4. Who owns it?
5. What is blocking it?
6. What do I need to do?
7. When is it due?
8. What happens after I finish?
9. What documents are required?
10. Who gets notified?

Use plain-language verbs.

Good:
"Complete review & send to DOTD District 03"

Weak:
"Transition"

Good:
"Waiting on SpaceX — hydraulic model due Sep 8"

Weak:
"STATE = WAIT_APP"

======================================================================
26. DO NOT DESTROY THE GOOD UI
======================================================================

The project already has substantial:
- navigation
- customer portal
- operational queues
- project cards
- document UI
- Gantt work
- role-oriented views
- visual polish

Preserve and evolve these.

Do not produce a generic CRUD dashboard.

Do not redesign everything merely because you would have structured it differently.

The priority is:
CONNECT EXISTING GOOD UX TO REAL PERSISTED DOMAIN BEHAVIOR.

======================================================================
27. IMPLEMENTATION WAVES
======================================================================

Execute continuously.

Do not return after merely producing a plan.

--------------------------------------------------
WAVE 0 — TRUTH / BASELINE
--------------------------------------------------

[ ] read protocol/docs
[ ] inspect commits
[ ] inspect migrations
[ ] inspect current database integration
[ ] run build
[ ] run lint
[ ] run tests
[ ] run existing Playwright tests
[ ] identify failed/unverifiable claims
[ ] update execution-plan.md honestly
[ ] update progress.md honestly
[ ] document canonical architecture

CHECKPOINT:
"checkpoint: repository re-baselined"

--------------------------------------------------
WAVE 1 — SECURITY + PERSISTENCE FOUNDATION
--------------------------------------------------

[ ] fix user-scoped Supabase server client
[ ] isolate service role
[ ] remove OR true RLS
[ ] tighten Storage policies
[ ] correct query project/user scoping
[ ] remove fire-and-forget mutation success
[ ] make repository mutations async or replace repository mutation layer
[ ] eliminate false local success
[ ] consolidate duplicate audit/notification writes
[ ] remove fixture fallback in production
[ ] standardize canonical request table
[ ] standardize project ID/code
[ ] eliminate SQLite/Postgres schema ambiguity

TEST:
unauthorized and cross-browser tests

CHECKPOINT:
"checkpoint: authoritative persistence and trust boundary"

--------------------------------------------------
WAVE 2 — WORKFLOW ENGINE
--------------------------------------------------

[ ] canonical workflow versions
[ ] persistent transitions
[ ] stage ownership
[ ] checklist/document gates
[ ] stage execution history
[ ] clock events
[ ] statutory minimum enforcement
[ ] backend transition validation
[ ] handoff activation
[ ] audit
[ ] notifications

TEST:
multi-stage workflow transition tests

CHECKPOINT:
"checkpoint: workflow engine operational"

--------------------------------------------------
WAVE 3 — WORKFLOW DESIGNER
--------------------------------------------------

[ ] draft version creation
[ ] editable stages
[ ] organization/unit selection
[ ] requirements
[ ] timing
[ ] transitions
[ ] escalation
[ ] validation
[ ] preview
[ ] publish
[ ] immutable versions

TEST:
published v1 remains unchanged while new v2 is used by new case

CHECKPOINT:
"checkpoint: configurable workflow designer"

--------------------------------------------------
WAVE 4 — CUSTOMER → INTAKE → WORKSTREAM
--------------------------------------------------

[ ] customer intake
[ ] file upload
[ ] receipt
[ ] intake queue
[ ] triage
[ ] create project if necessary
[ ] spawn one/many workstreams
[ ] select workflow
[ ] assign first stage
[ ] notifications

TEST:
SpaceX request submitted in Browser A appears in government Browser B

CHECKPOINT:
"checkpoint: customer intake to government workflow"

--------------------------------------------------
WAVE 5 — GOVERNMENT WORKBENCH
--------------------------------------------------

[ ] project route
[ ] workstream route
[ ] required-action panel
[ ] notes
[ ] RFI
[ ] block
[ ] coordination
[ ] transfer
[ ] escalation
[ ] document review
[ ] complete step
[ ] next-agency handoff

TEST:
government user can work a stage all the way to next agency

CHECKPOINT:
"checkpoint: government workbench end to end"

--------------------------------------------------
WAVE 6 — DOCUMENT LIFECYCLE
--------------------------------------------------

[ ] private Storage
[ ] versions
[ ] hashes
[ ] metadata
[ ] review assignments
[ ] signed download
[ ] authorization
[ ] audit
[ ] customer response attachments

TEST:
authorized download succeeds; unauthorized download fails

CHECKPOINT:
"checkpoint: persistent document lifecycle"

--------------------------------------------------
WAVE 7 — GANTT + SCHEDULE ENGINE
--------------------------------------------------

[ ] dynamic dates
[ ] baseline
[ ] actual
[ ] forecast
[ ] stages/tasks
[ ] dependencies
[ ] critical path
[ ] state colors
[ ] statutory waits
[ ] RFI pauses
[ ] schedule recalculation
[ ] project navigation

TEST:
change predecessor/RFI delay and verify downstream forecast

CHECKPOINT:
"checkpoint: operational project gantt"

--------------------------------------------------
WAVE 8 — ROUTES / STRUCTURAL CLEANUP
--------------------------------------------------

[ ] extract monolithic app/page.tsx
[ ] physical App Router routes
[ ] shared layout
[ ] shared project/workbench components
[ ] remove obsolete legacy data path
[ ] remove dead demo-specific production code

Do this incrementally.

CHECKPOINT:
"checkpoint: production application structure"

--------------------------------------------------
WAVE 9 — ADVERSARIAL / FINAL REVIEW
--------------------------------------------------

Use independent reviewers if available:

Reviewer 1:
PRD compliance

Reviewer 2:
Persistence/data integrity

Reviewer 3:
Security/RLS

Reviewer 4:
Operational UX

Reviewer 5:
E2E testing

Fix BLOCKER and HIGH findings.

CHECKPOINT:
"checkpoint: end-to-end MVP verified"

======================================================================
28. REQUIRED END-TO-END DEMONSTRATION
======================================================================

The system is NOT complete until the following scenario works:

PERSONA 1 — SpaceX Project Manager

1. Signs in.
2. Opens SpaceX Louisiana project.
3. Submits:
   "Construct a new heavy-haul access road requiring coastal and wetlands coordination."
4. Uploads a preliminary site plan.
5. Receives a persisted confirmation number.
6. Logs out.

--------------------------------------------------

PERSONA 2 — State Project Office

7. Signs in from a completely clean browser context.
8. Sees EXACTLY that request.
9. Opens it.
10. Triages it.
11. Creates:
    - DOTD Road Access workstream
    - CPRA Coastal Review workstream
    - USACE Wetlands Coordination workstream
12. Each receives appropriate persisted workflow version and owner.
13. State PM logs out.

--------------------------------------------------

PERSONA 3 — DOTD Reviewer

14. Signs in from another clean browser context.
15. Sees the DOTD task in My Work.
16. Opens project/work page.
17. Sees:
    - current stage
    - requirements
    - documents
    - due date
    - next handoff
18. Adds an internal note.
19. Issues an RFI to SpaceX requesting revised turning-radius drawings.
20. Workstream moves to waiting_applicant.
21. Clock impact is recorded.
22. Gantt reflects the wait.
23. Reviewer logs out.

--------------------------------------------------

PERSONA 1 — SpaceX

24. Signs back in.
25. Sees exact RFI.
26. Uploads revised drawing.
27. Responds to RFI.
28. Logs out.

--------------------------------------------------

PERSONA 3 — DOTD Reviewer

29. Signs in again.
30. Sees the submitted RFI response.
31. Reviews document.
32. Accepts RFI.
33. Workstream returns to running.
34. Clock resumes.
35. Completes required checklist.
36. Clicks:
    "Complete DOTD Review & Hand Off"
37. Database commits.
38. Audit commits.
39. Next stage is created/activated.
40. Next authorized owner is notified.

--------------------------------------------------

PERSONA 4 — NEXT GOVERNMENT OWNER

41. Signs in from another clean context.
42. Sees the handed-off work.
43. Continues the workflow.

--------------------------------------------------

PROJECT MANAGER

44. Opens project page.
45. Sees all three workstreams.
46. Sees accurate current owner for each.
47. Sees Gantt.
48. Sees actual history, current state, and future work.
49. Sees RFI delay in schedule.
50. Sees documents.
51. Sees blocked/escalated items.
52. Sees project forecast.

THIS IS THE CORE ACCEPTANCE JOURNEY.

Automate as much of it as practical with Playwright.

======================================================================
29. CROSS-BROWSER DURABILITY TEST REQUIREMENTS
======================================================================

For every critical mutation test:

Browser/Context A:
perform mutation.

Then:
close Context A.

Browser/Context B:
fresh cookies
fresh localStorage
fresh sessionStorage
authenticate appropriate user
retrieve exact record from Supabase-backed UI

Assert specific:
- ID
- title
- state
- note
- RFI
- document
- owner
- workflow stage
- audit where appropriate

Do not merely assert generic page headings.

Also directly verify PostgreSQL where useful.

======================================================================
30. FAILURE TESTING
======================================================================

Add tests proving:

[ ] DB failure does not display "Saved"
[ ] Storage failure does not display "Uploaded"
[ ] unauthorized transition returns 403/permission failure
[ ] missing required document prevents stage completion
[ ] statutory minimum prevents premature completion
[ ] unresolved mandatory dependency prevents completion
[ ] wrong agency cannot assign itself unauthorized work
[ ] invalid workflow transition is rejected server-side
[ ] stale workflow editor cannot overwrite published workflow
[ ] two users editing sensitive state produce predictable conflict handling
[ ] duplicate request submission is handled/idempotent where appropriate

======================================================================
31. DATABASE MIGRATION REQUIREMENTS
======================================================================

All schema changes:

[ ] represented as checked-in Supabase migrations
[ ] reproducible from clean database
[ ] safe for existing development/live data
[ ] forward-only unless rollback explicitly designed
[ ] indexed appropriately
[ ] foreign keys enforced
[ ] RLS enabled
[ ] RLS policies created
[ ] verified as authenticated users
[ ] documented

Never manually change the live DB and forget the migration.

THE REPOSITORY MUST BE CAPABLE OF REBUILDING THE DATABASE STRUCTURE.

======================================================================
32. SUPABASE DURABILITY GATE — ABSOLUTE
======================================================================

NO FEATURE THAT CHANGES STATE IS COMPLETE UNTIL:

[ ] database/storage mutation succeeds
[ ] UI awaited success
[ ] exact persisted record is returned/read back
[ ] audit record exists
[ ] notification exists where required
[ ] refresh retains it
[ ] logout/login retains it
[ ] localStorage cleared retains it
[ ] fresh browser retains it
[ ] another authorized user sees it where appropriate
[ ] unauthorized user cannot see it
[ ] Vercel/server restart cannot erase it

Production state must never depend on:

- React component state
- module singleton state
- localStorage
- sessionStorage
- fixture objects
- mock APIs

These may be caches/test tools only.

======================================================================
33. TEST COMMANDS / CHECKPOINT GATE
======================================================================

Use current repository commands and improve scripts where needed.

At every checkpoint run appropriate:

npm run build
npm run lint
npm test

and targeted Playwright tests.

If Playwright is not currently included in `npm test`,
create a clearly documented E2E command.

Record exact results in docs/progress.md.

Do not write:
"tests pass"

without recording:
- command
- number passed
- number failed
- skipped tests
- relevant environment

======================================================================
34. DOCUMENTATION MUST BECOME TRUTHFUL
======================================================================

Update:

docs/execution-plan.md
docs/progress.md
docs/architecture.md
docs/operational-ux.md
docs/testing/*

Do not leave "100% complete" claims that are contradicted by source code.

For each completed capability document:

- authoritative database table/bucket
- transaction/mutation
- RLS policy
- UI entry point
- automated test
- cross-browser proof

======================================================================
35. SUBAGENT STRATEGY
======================================================================

Use no more than roughly four concurrent implementation agents unless clearly justified.

Suggested lanes:

AGENT A — Supabase / Security / RLS
AGENT B — Workflow Engine / Persistence
AGENT C — UI / Workbench / Workflow Designer
AGENT D — E2E / Playwright / Adversarial QA

The orchestrator owns:
- architecture
- conflicts
- integration
- acceptance
- final verification

Do not allow agents to make incompatible competing schemas.

Database/domain model decisions must be coordinated centrally.

======================================================================
36. COMMIT POLICY
======================================================================

Make small coherent checkpoint commits.

Examples:

checkpoint: rebaseline current persistence state
fix: enforce authenticated project-scoped persistence
feat: persist workflow execution instances
feat: add workflow draft and publish lifecycle
feat: build government workbench
feat: connect customer intake to triage workflows
feat: complete private document lifecycle
feat: drive gantt from persisted schedule
test: verify multi-user end-to-end handoff

Before every commit:

git status --short
git diff --stat
inspect actual diff
run relevant tests

Never commit:
- .env
- service-role keys
- passwords
- credentials
- generated junk
- local diagnostic dumps

Do not force-push main.

======================================================================
37. DEFINITION OF DONE
======================================================================

The phase is complete only when ALL of these are true:

ARCHITECTURE
[ ] Supabase PostgreSQL is production source of truth
[ ] Supabase Storage is production file source of truth
[ ] no authoritative fixture/localStorage state
[ ] one canonical request model
[ ] coherent PostgreSQL schema strategy
[ ] user/session trust boundary correct

CUSTOMER
[ ] customer can submit persisted request
[ ] customer can upload persisted files
[ ] customer can view project
[ ] customer can see current workstream status
[ ] customer can see required actions
[ ] customer can answer RFI
[ ] customer can see authorized schedule/Gantt

GOVERNMENT
[ ] staff receive persisted assignments
[ ] staff can open a workbench
[ ] staff can see requirements
[ ] staff can add notes
[ ] staff can issue RFI
[ ] staff can coordinate with another agency
[ ] staff can block/resume
[ ] staff can escalate
[ ] staff can complete stage
[ ] stage hands off to next department
[ ] unauthorized action is rejected

WORKFLOW ADMIN
[ ] create workflow draft
[ ] edit stages
[ ] configure ownership
[ ] configure requirements
[ ] configure timing
[ ] configure transitions
[ ] validate
[ ] publish immutable version
[ ] new work uses new version
[ ] old work remains on original version

PROJECT
[ ] clicking project opens real project page
[ ] clicking workstream opens real work page
[ ] project shows workstreams
[ ] project shows owners
[ ] project shows blockers
[ ] project shows documents
[ ] project shows RFIs
[ ] project shows audit/activity
[ ] project shows Gantt

GANTT
[ ] real persisted data
[ ] dynamic horizon
[ ] current date
[ ] stages/tasks
[ ] baseline
[ ] actual
[ ] forecast
[ ] dependencies
[ ] critical path
[ ] state colors
[ ] schedule recalculation

FILES
[ ] private storage
[ ] immutable versions
[ ] authorized signed downloads
[ ] unauthorized download denied
[ ] real errors, no fake production files

SECURITY
[ ] no `OR true` authorization bypass
[ ] no broad authenticated storage access
[ ] service role isolated
[ ] tenant/customer isolation tested
[ ] agency isolation tested
[ ] administrator scope tested

AUDIT
[ ] important actions persisted
[ ] immutable to normal users

TESTS
[ ] build passes
[ ] lint passes
[ ] unit/integration tests pass
[ ] real multi-context Playwright journey passes
[ ] exact cross-browser persistence proven
[ ] RLS negative tests pass
[ ] document negative tests pass
[ ] workflow negative tests pass
[ ] no BLOCKER/HIGH defects remain

DOCUMENTATION
[ ] execution-plan reflects reality
[ ] progress reflects reality
[ ] architecture reflects reality
[ ] setup instructions work from clean clone

======================================================================
38. FINAL INSTRUCTION
======================================================================

DO NOT STOP AFTER WRITING A PLAN.

DO NOT DECLARE SUCCESS BECAUSE A COMPONENT EXISTS.

DO NOT DECLARE PERSISTENCE COMPLETE BECAUSE A Supabase function exists.

DO NOT DECLARE CROSS-BROWSER COMPLETE BECAUSE two browser contexts loaded pages.

DO NOT DECLARE WORKFLOW COMPLETE because stages are displayed.

DO NOT DECLARE DOCUMENTS COMPLETE because files can be selected in a browser.

IMPLEMENT.
TEST.
REPRODUCE.
FIX.
INTEGRATE.
VERIFY THE DATABASE.
VERIFY AUTHORIZATION.
VERIFY ANOTHER BROWSER.
UPDATE DOCUMENTATION.
COMMIT CHECKPOINT.
CONTINUE.

The final objective is a working operational demonstration:

SPACEX SUBMITS REQUEST
→ STATE RECEIVES IT
→ REQUEST IS TRIAGED
→ WORKSTREAMS ARE CREATED
→ WORKFLOW ASSIGNS THE FIRST AGENCY
→ GOVERNMENT EMPLOYEE WORKS THEIR STEP
→ DOCUMENTS/RFIs/NOTES ARE PERSISTED
→ STEP IS COMPLETED
→ WORK AUTOMATICALLY HANDS TO THE NEXT AUTHORIZED AGENCY
→ CUSTOMER WATCHES PROGRESS
→ PROJECT GANTT UPDATES
→ ESCALATIONS AND DELAYS ARE VISIBLE
→ ALL DATA SURVIVES BROWSERS, COMPUTERS, REFRESHES, LOGOUTS, REDEPLOYS
→ RLS PREVENTS UNAUTHORIZED ACCESS

Keep looping until that journey is actually working end-to-end or a genuine external blocker makes further implementation impossible.