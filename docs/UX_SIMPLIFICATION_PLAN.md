# PATH: make work understandable

Review date: September 7–8, 2026. Source baseline: `68c3313be51681b5c1fbbe3cbffff0fdab9a4163`, current `main` after a fast-forward-only pull. This is an inspection and implementation plan, not a completed redesign.

## Product direction

PATH should feel like a familiar work inbox attached to a clear project tracker. A person should be able to open it and answer: **What needs my attention? Who has the next move? What happens after I act?**

Preserve projects, workstreams, tasks, requests, documents, agency responsibilities, and versioned workflows. Simplify how people encounter them. The existing product repeatedly explains its machinery while leaving essential facts disconnected. Adding another dashboard would worsen that problem.

The first delivery should be one complete, understandable journey: Jordan opens a request, asks the customer for information, sees the response, finishes the review, and watches the project update. Build the shared foundations while delivering that journey, then apply them across the product.

## What was inspected

- The supplied 20-part walkthrough brief, in full.
- The live Vercel site in Chrome: project overview, a schedule-bar selection, My Work, request detail, an RFI form without submission, administration, demo sign-in, Jordan's staff queue, and Alex's customer work/home views. A 390 × 844 administration screenshot was inspected and the temporary viewport restored.
- Current source: shell/history navigation, operational work-item adapters, repository hydration and mutation entry points, Supabase mappings and queries, project overview, schedule, workflow journey, login, people/team administration, record inspection, and workflow editors.
- Read-only Supabase schema and selected records in the linked project. Confirmed workflow authoring RPCs exist.
- GitHub repository metadata and Sites publication metadata. The existing Sites publication is separate from the Vercel URL used in the walkthrough.

Evidence limits: no business records were changed, no RFI was sent, and no workflow was published. This was not a complete multi-persona persistence test. Vercel's connector returned no teams; its deployment commit was not established. The live footer says `Commit: unknown`, so source findings and live observations must remain distinct. Mobile review was a representative layout inspection, not a mobile acceptance pass. Customer end-to-end behavior and cross-browser behavior remain release gates.

## Findings that shape the plan

| Finding | Evidence and implication |
|---|---|
| The overview is far too long | The live page renders 23 detailed workstream cards, a full schedule, and another metrics table. `ProjectOverviewPage.tsx` embeds `WorkstreamGraphGantt`. Separate the overview, work list, and schedule. |
| Summary facts are dead ends | Applicant, owners, health counts, documents, commitments, decisions, and participants appear as static text. Reuse canonical record links and URL-backed list filters. |
| Selecting a schedule item does not establish a clear record destination | Clicking the air-permit bar changed the URL to `?view=project&workstream=WS-AIR-TITLE-V` and inserted a workspace into the long overview. It did select a specific workstream, but retained the surrounding overview and schedule. Source also scrolls to the first `button[aria-pressed='true']`, rather than the selected record. |
| An intake request can be offered impossible workstream actions | Supabase confirms `PATH-DEMO-REQ-INTAKE` has no related workstream, assignee, or assignment group. `customerRequestToWorkItem` supplies `WS-CUSTOMER-INTAKE`; `createRFIPersisted` requires an existing workstream. The live request offers Request Information and Complete Step. This establishes a concrete failure path; the submit error was not reproduced by sending an RFI. |
| Submitter and assignee are confused | The same unassigned intake record displays “Assigned to: Alex Martin.” Its adapter uses `submittedByName` as `ownerName`. This is a data-meaning bug, not a missing label. |
| The product contradicts itself about RFIs | The air-permit workspace displays a waiting reason naming an RFI but says zero information requests and “No action currently required.” Supabase contains three linked RFIs. The mapper initializes workstream `rfis` as an empty array and defaults customer action copy; the project workspace reads those fields. Repair the joined read model. |
| Accepted does not reliably mean finished | The live queue places an accepted RFI in Waiting on others and tells staff to monitor an applicant response. `rfiToWorkItem` retains waiting copy for terminal states; `groupMyWork` also relies on visual tone to determine completion. Business status must determine presentation, never the reverse. |
| Missing history is presented as zero progress | A completed demo workstream has zero `stage_runs` and displays “0 of 5 steps recorded.” Preserve the completion fact and explain unavailable step history; do not invent completed events. |
| Workflow and task concepts blur together | The air permit has no pinned workflow version or current stage ID, while tasks are presented as workflow steps. Separate actual stages from task fallback; label incomplete configuration honestly. |
| Customer home counts do not mean what they say | Alex saw My actions 4 while Home showed Requests needing your response 7. Source counts submitted/triage/in-progress customer requests for that home metric rather than outstanding customer response obligations. Reuse the same action eligibility projection and make count scope explicit. |
| Identity and scope are weak | Header identity is non-interactive. Jordan sees an unassigned intake as Needs my action. Admin's broad access is mixed into My Work. Team count is absent. The source declares `profile` but omits it from the route definitions recognized by `parseShellPath`. |
| Administration has useful pieces but lacks a coherent flow | Inspect is explicitly read only and renders raw values. People/team editing exists elsewhere. The live admin people section showed zero visible profiles, while assignment options elsewhere exposed repeated UUIDs. Trace profile hydration, membership joins, and access separately before assuming records are absent. |
| Workflow authoring is partial, not nonexistent | `WorkflowDesignerPanel` creates drafts, saves stage labels, validates, and publishes through existing RPCs. The UI does not expose the full process contract. It also describes v4/v5 while displaying published v1. Extend this path and remove misleading fixed copy. |
| Demo data adds confusion | Multiple nearly identical agency/team names and E2E records appear in normal queues. Validate aliases and provenance before any merge or cleanup; similar names are not proof of duplicate identity. |
| Mobile still loses context | At 390px, the header truncates the long context and hides the user's identity. The admin table wraps record names into very narrow columns. Use a compact profile control and mobile record cards. |

Primary source locations: `app/page.tsx` (navigation, queues, actions and shell); `lib/navigation.ts`; `lib/operational-ux.ts` (especially `customerRequestToWorkItem`, `rfiToWorkItem`, `groupMyWork`); `lib/repository.ts` (`getWorkstreamById`, `createRFIPersisted`); `lib/supabase/mappings.ts`; `components/cockpits/ProjectOverviewPage.tsx`; `components/cockpits/WorkflowDesignerPanel.tsx`; `components/cockpits/TicketWorkflowEditor.tsx`; `components/admin/AdminExplorer.tsx`; `components/admin/AdminDirectory.tsx`.

## The simpler experience

### Navigation

Staff get four primary destinations: **My Work, Team Work, Projects, Services & Permits**. Notifications and profile live in the header; Administration is a separate destination for authorized users. RFIs, coordination, and document reviews remain recognizable work types and saved views inside the work inbox, with legacy links preserved.

Customers get **Home, My Requests, Projects, Services & Permits**. Home prioritizes requests awaiting their response, then recent updates. Staff-only assignment and internal deliberation stay out of the customer view.

Project navigation is **Overview, Work, Schedule, Documents, People**. Commitments and decisions are linked sections of Overview/Work rather than additional top-level navigation. An accessible project selector establishes scope; avoid silently treating every record as belonging to the hardcoded Starbase project.

Keep the shell identity to “PATH” and a short project name. Put the full project title on its page. Use a stable desktop header and navigation rail with one main scrolling pane. Store and restore that pane's scroll position, filters, selected tab, and focused row with browser history. At 390px use a navigation drawer, visible avatar/profile button, and a normal vertical record layout.

### Work inbox

Use compact rows instead of a page of repeated fact cards. Show **work title, next action, owner/team, status, due date**. Reveal the longer explanation and history on the record. Rows open records; a clearly named secondary action can provide a preview. Do not make a row-sized button contain other links.

Default tabs: **Needs my action, Waiting, Completed**. Due soon and Overdue are filters with real dates. Team Work adds **Unassigned, Assigned, Waiting, Completed**, a team selector, and Take ownership where authorized. Advanced type/agency/priority filters sit behind Filters.

Definitions must be explicit:

- Assigned to me: persisted individual assignee equals the current user.
- Needs my action: the user can perform a currently required transition, including eligible unassigned team work only when clearly labeled “Available to your team.”
- Team work: persisted membership connects the user to the owning team. Broader supervisor/admin scope is separately labeled.
- Waiting: another identified party owns the next move. Blocked is a specific impediment with reason and resolution action.
- Completed: a terminal business state. Accepted RFIs do not remain in waiting queues.

Counts and rows use the same query and filters. A count links to exactly the records it counted. Distinguish no records, filtered-out records, failed loading, and access restrictions.

### One record page

Every entry point opens the same record and resulting state. Keep workstream, task, RFI, and customer request as different entities; use a shared page structure and a clear parent relationship.

```text
PATH / Starbase / Air permit

Review revised emissions inventory             Waiting for customer
Assigned to Jordan Lee · LDEQ Air Review        Due Sep 18

Next move: SpaceX needs to send the revised inventory.
Requested Sep 7 by Jordan Lee. Review is paused.
[View information request]                     [More actions]

Overview | Documents | Activity

Process: Intake ✓ → Technical review (waiting) → Agency decision → Closeout
```

The example illustrates the proposed layout; its copy and dates are not an additional live-data claim.

Put assignment near the title: person, team, agency, and a compact Change assignment control. Show Submitted by separately. Give one primary action based on actual readiness, with other valid actions under More actions. “Record agency decision” opens the relevant fields directly. Required inputs appear inside that task flow, not as disconnected instructions.

Use a persistent outcome receipt after mutations: what happened, who was notified, who owns the next action, any clock/schedule effect, and a link to the resulting record. Toasts may supplement that receipt. If notification delivery is pending or failed, describe that state rather than claiming delivery.

### Project overview and schedule

The overview contains a brief status sentence, target/forecast dates, actionable health counts, the most important blockers, next milestones, and recent activity. Show a short work preview with View all work. Move the full Gantt and analytical tools to Schedule; place simulation and delay analysis behind Advanced analysis.

Schedule defaults to recent history plus upcoming work, with Today about 25% across the visible time range. Fit project is a separate intentional mode. Expand a workstream into its actual phases/tasks. Distinguish actual, planned, and forecast dates. Do not manufacture phase dates when absent; show “Not scheduled” and a configuration action for authorized users. Support parallel phases and accessible labels/patterns, plus a list equivalent on mobile. A phase click opens that phase in its parent record; a task click opens the task.

### Make it pleasant to use

Keep PATH's navy and teal identity. Use quieter surfaces, normal sentence case, fewer uppercase labels, and less heavy type. Reserve amber/red for conditions needing attention. Replace “DAG,” “Variance Engine,” “Fulfiller,” and “Open Work & Workflow” in everyday flows with “Dependencies,” “Schedule,” “Assigned to,” and “Open.” Retain formal permit names and statutory terminology where needed.

Make progress satisfying: checkmarks on recorded completions, a short “Response sent — Jordan is next” confirmation, helpful empty states, and subtle motion that respects reduced-motion preferences. A short optional first-use guide points to real controls and can be replayed. Avoid points or celebratory effects around regulatory decisions.

Demo sign-in uses search and Customer / Staff / Admin categories, with three featured journeys and all other personas discoverable. Explain the selected persona's role and teams immediately after sign-in. Switching persona should land on an appropriate default page unless an explicitly requested permitted deep link is being resumed.

## Shared implementation contracts

1. **Record identity and links.** Extend `lib/navigation.ts` with typed entity references and one route builder. Reuse `/work/:kind/:id` for operational records and existing project/workstream routes through a single resolver. Add canonical destinations for people, organizations, teams, document versions, and workflow definitions. Legacy query/code URLs resolve to the same stable ID. Profile must parse and reload correctly. Keep authorization on the server and do not reveal inaccessible records through link labels.
2. **Joined record state.** Build one authoritative read projection from records, memberships, RFIs, responses, tasks, stage runs, documents, and dependencies. Preserve separate fields for lifecycle, wait reason, health, clock, assignment, and visibility. Derive each displayed summary from that projection. Eliminate invented relationship IDs and submitter-as-assignee fallbacks. Unknown is a valid explicit state.
3. **Action availability.** A shared action descriptor includes eligibility, required fields, reason unavailable, command, and expected outcome. The next-action sentence and its control consume that descriptor. Customer-request clarification works before a workstream exists; workstream RFIs require a real linked workstream. Use existing request clarification paths where sufficient, extending persistence only where necessary.
4. **Mutation and refresh.** Reuse audited commands/RPCs. Commit business changes and their event/notification intent consistently, return the resulting identity/state, and refresh all affected projections. Handle retry without duplicate RFIs, conflict after reassignment, and stale tabs. Invalidate relevant queue, record, project, schedule, and notification data; use existing realtime/refetch infrastructure where appropriate.
5. **Reusable presentation.** Extract the shell, record header, entity link, status display, assignment editor, next-action panel, and activity feed incrementally from `app/page.tsx`. Keep business logic out of display components. The shared status component renders business state; its color never determines queue membership.

Do not begin with a framework migration or replacement data layer. Preserve existing audited behavior and exact document-version review/download handling. Before migrations, inspect current schema and migration history; reconcile duplicated state/assignment columns with an explicit compatibility strategy rather than deleting them speculatively.

## Delivery sequence and acceptance gates

| Checkpoint | Work and walkthrough coverage | Evidence required before moving on |
|---|---|---|
| 0. Baseline | Reproduce the target journeys; record source SHA, deployed SHA, schema, personas, and data issues. Keep test records scoped away from ordinary demos. | A reproducible failure register; confirmed deployment identity; no false “empty” claims on failed queries. |
| 1. One trustworthy journey | Fix pre-workstream clarification/RFI, action eligibility, assignee meaning, terminal RFI handling, joined related records, and authoritative outcome receipts. Covers brief 5–8, 13, 20. | Jordan → request → customer response → reviewer decision → resumed work → completion. Refresh each boundary and verify persisted state and audit/events. |
| 2. One place for each record | Canonical links, stable shell/scroll, history, profile, team scope/counts, and shared record page. Covers 1, 3–5, 9–10, 12, 18–19. | Same workstream from queue, team, project, Gantt, notification, admin, and copied URL; correct focus and back/forward restoration. Unauthorized users see appropriate access states. |
| 3. Simplify daily use | Compact inbox, short project overview, reduced primary navigation, explicit action/wait states, searchable demo picker, request-routing explanation. Covers 2, 4, 7, 9, 14, 18. | First-time user finds actionable work and explains the next owner without help. Desktop and 390px review of staff and customer flows. |
| 4. Usable administration | Dedicated People, Teams & Agencies, Workflows, and Records sections. Inspect relationships become links; Edit opens typed validated forms. Repair profile joins and deduplicate displayed assignee choices. Covers 10, 15, 17. | Admin follows person → team → work, edits a permitted field, refreshes, and sees the same result in operations. Failed edits preserve the prior state and show retry guidance. |
| 5. Complete process authoring | Extend existing draft/validate/publish designer. Add/remove/reorder stages and tasks, agency/team defaults, durations, prerequisites, required inputs, transitions, RFI/hold behavior, and completion rules. Covers 16. | Resume a saved draft, show validation errors and change preview, publish, create new work on the new version, and prove existing work remains pinned. Any migration of live work is a separate explicit operation. |
| 6. Useful schedule and final polish | Actual phase/task expansion, Today positioning, correct target links, accessible list alternative, responsive layout, visual consistency, data-quality review. Covers 11–12 and remaining polish. | Block → schedule/health update → unblock → resume; keyboard/touch operation; truthful missing-history/date states; complete release acceptance below. |

Commit each coherent checkpoint after its relevant validation. Push and compare full local/remote SHAs. Deploy only the intended product release, with source identity visible, and recheck the deployed journey. A passing component test or successful RPC is not acceptance of an entire story.

## Administration boundaries

Use validated forms for workstreams, tasks, projects, people, agencies, groups, role assignments, document metadata, and workflow drafts. Show a clear Save/Cancel flow and a persisted outcome. Live work corrections require a reason and history entry; status changes must respect prerequisites or use a distinct audited administrative correction operation. Published definitions and audit history stay immutable. Separate profile visibility, project participation, organization role, and sign-in eligibility rather than presenting one ambiguous Active switch.

The workflow editor should start as an ordered process list with expandable stage settings. A graphical canvas can be an optional later view if user testing demonstrates value. Publishing includes a readable change summary, validation of dependencies and destinations, and a count/explanation of affected future work. Existing instance editing remains clearly labeled “This work item.”

## Release acceptance

Test these against isolated, named records and actual authenticated personas:

- Jordan's intake clarification and workstream RFI paths both work. Customer sees the correct request and recipient context, responds with a persisted attachment, Jordan accepts or requests clarification, and only satisfied holds clear. Multiple outstanding holds must not disappear when one RFI is accepted.
- Jordan takes eligible team work, reassigns it, marks it blocked, opens its notification, follows the dependency, clears it, and completes the next task. Former and new assignees see correct queues after refresh. Another user cannot claim already reassigned work using stale state.
- Admin inspects a workstream, follows person/group/project links, corrects assignment, and returns to the same operational record. People list and assignment choices display real names and memberships.
- Admin saves and reopens a workflow draft, changes process settings, validates, publishes, and starts a new instance. Existing instances and their recorded history remain unchanged.
- Desktop and 390px: keyboard-only navigation, meaningful focus after route/modal changes, no clipped primary actions, no body-width overflow, back/forward, refresh, direct links, and return to the prior filtered row. Verify Chrome plus another browser supported by the project.
- Document review remains tied to an exact version; upload, metadata, private Storage fetch, and response attachment are independently verified.
- No accepted/closed item claims to await a response. No completed work shows fabricated zero progress. No missing relationship silently becomes an invented ID. No mutation claims notification delivery that has not been confirmed.

Usability targets are proposed acceptance measures, not measured results: in five short first-use sessions, at least four participants can identify their role/team, find their next action, identify who is waiting on whom, and return to their work without assistance. Aim for finding the next action within 30 seconds and explaining a record's state within 10 seconds. Record wrong turns and whether participants need an explanation of PATH-specific terminology.

The result should be a smaller visible product with stronger connected behavior: one inbox, one clear record pattern, one concise project story, and administration that can maintain the process behind them.

