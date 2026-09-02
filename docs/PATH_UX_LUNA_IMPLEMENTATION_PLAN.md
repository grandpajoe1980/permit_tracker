# PATH UX Recovery Plan for VS Code + ChatGPT Luna

Prepared from a live review of `https://permit-tracker-iota.vercel.app/` and repository commit `0fe54e2` on `main` (September 2, 2026).

## 1. Mission

Turn PATH into a simple, familiar work-management system in which every screen immediately answers:

1. What am I looking at?
2. What has already happened?
3. What is happening now?
4. What do I need to do next?
5. Who receives the next handoff?
6. What is delaying the work or affecting the critical path?

This is a frontend information-architecture, navigation, workflow-clarity, and interaction-feedback effort. It is **not** a database redesign.

The product name is **PATH**. “Critical Path” is a schedule attribute and visual emphasis, not the application name.

The project name is:

> **SpaceX – Starbase Louisiana Launch Complex and Orbital Support Facility**

The program subtitle is:

> **Starbase Louisiana – SpaceX Coordination**

## 2. Non-negotiable protection boundary

Do not alter working backend behavior merely to simplify frontend work.

- Supabase PostgreSQL and Supabase Storage remain authoritative.
- Do not add localStorage, sessionStorage, fixtures, or React state as production authority.
- Do not rewrite migrations or change the database schema for this UX phase.
- Do not change RLS, RPC authorization, authentication, private document storage, signed-download behavior, hashing, audit-event creation, or notification persistence unless a failing test proves a necessary compatibility repair.
- Do not replace or weaken awaited repository mutations. The UI may report success only after Supabase confirms the mutation.
- Preserve working uploads and downloads exactly. Add regression tests before touching adjacent UI.
- Preserve stable project, workstream, request, document, RFI, coordination, and task identifiers.
- Keep Quick Demo Sign-In for UAT.
- Do not make a broad “rewrite” of `app/page.tsx`. Extract and improve it incrementally in small, reviewable commits.
- Never claim a workstream has several steps unless persisted workflow stages/tasks actually exist. Fix the read projection or test data if authoritative stages exist but are not displayed; do not invent fake steps in the component.
- Every commit must regenerate and display current build metadata through the existing version-generation path.

Protected regression commands:

```bash
npm run build
npx tsc --noEmit
npm run lint
npm test
npx playwright test --project=chromium tests/e2e/supabase-persistence.spec.ts
npx playwright test --project=chromium tests/e2e/document-management.spec.ts
npm run supabase:rls
```

If the live Supabase migration ledger remains unreconciled, do not apply or rewrite migrations as part of this plan. Record that external blocker and continue frontend tasks that do not depend on it.

## 3. Evidence-based current-state diagnosis

### A. Navigation loses the user’s mental location

`app/page.tsx` uses a local `Route` union and `setRoute(...)` for nearly every screen. The deployed URL remains `/` while moving among My Work, Agency Queue, detail, project, and schedule. `navigate()` also clears `selectedItemId`, and an effect scrolls to the top whenever route or selection changes.

Consequences:

- Browser Back cannot return to the prior queue/filter/scroll position.
- Deep links to an exact work item do not exist in the primary shell.
- A workstream label, Project button, and Open Work & Workflow button lead to three different scopes without a clear contract.
- The physical App Router pages under `app/projects/...`, `app/workstreams/...`, and `app/requests/...` use a visually separate shell and are not yet the primary navigation experience.

### B. Customer priority is inverted

After Alex Martin signs in, code explicitly sets the route to `my-work`. The customer’s most important action, “Ask the project office for something,” is below filters, summary tiles, and all work groups. A supporting-file field is inserted above the page before the customer has even chosen a request type.

Desired order:

1. **Submit a Request** primary action.
2. Requests needing SpaceX action.
3. All submitted requests, showing status, current owner, current step, next step, due date, and schedule impact.
4. Project schedule and documents as supporting views.

### C. Reviewer cards are informative but overloaded

Cards show type, assignment group, customer, priority, title, workstream, workflow progress, why visible, required action, due date, age, schedule impact, next handoff, removal condition, and up to three buttons. This is accurate but forces high cognitive load before the reviewer can identify the next action.

My Work reports zero while Due Today contains two document decisions. The label “Needs my action” therefore conflicts with the visible actionable work and undermines trust.

### D. Work item and workstream state can disagree

The reviewed coordination item displayed `pending`, while its linked workstream displayed `Blocked (Action Required)`. Activity showed three blocked events, but the page did not prominently reconcile the current record state, linked workstream state, blocker reason, and owner of the next action.

After a mutation, the selected `OperationalWorkItem` can remain based on a stale projection. The app needs a deterministic refresh-and-reselect sequence so the user stays on the same item and sees the new authoritative state.

### E. “Past / present / future” is implemented as labels, not as a truthful schedule model

`components/cockpits/WorkstreamGraphGantt.tsx` hard-codes:

```ts
new Date("2026-08-30T12:00:00Z")
```

`lib/operational-ux.ts` separately hard-codes `AS_OF_DATE = "2026-08-30"` for queue ages and due-date logic. The deployed site on September 2 still labels Today as August 30.

Many bars use workstream-level baseline/forecast values whose start date is effectively the current seed/import time. As a result, nearly every bar appears to begin at “today,” and “Past / Baseline,” “Current,” and “Future” do not correspond to completed stages, the active stage, and planned stages.

### F. Clicking a project workstream appears to do nothing

On the project page, clicking a workstream only sets `focusedWorkstreamId`. The selected details render **after** the entire workstream grid. There is no automatic focus, scroll, route change, drawer, or clear selected-state affordance at the click location. On a long page this feels broken.

### G. Physical routes exist but do not yet form a coherent application

The repository contains authenticated physical routes for projects, workstreams, and request receipts, which is useful. However, the root application still owns the richer UI and internal navigation. The physical routes have a simplified standalone layout, and a resolver mismatch can surface “Workstream not found.” The UX phase should converge these surfaces rather than create a third navigation system.

### H. Branding and secondary copy are inconsistent

Current copy includes Critical Path, PATH, SpaceX Louisiana, SpaceX Pecan Island, Vermilion Parish, and PATH ITSM & Permitting Platform. The official-filing warning appears persistently in the sidebar even when it does not help the current task. “Secondary tools” is sometimes empty for customers.

## 4. Target mental model

Use a familiar ServiceNow-like hierarchy, expressed in plain language:

```text
Project
  └── Workstream
        └── Workflow steps
              └── Current work item/action
```

Supporting records—RFI, document review, coordination request, blocker, commitment, escalation, and note—must always show which workstream and step they affect. They must not feel like unrelated destinations.

Every exact work-item screen uses one shared layout:

- Breadcrumb: queue → project → workstream → work item.
- Header: record number, concise title, status, priority, critical-path indicator.
- “Your next action” panel: one primary action and limited secondary actions.
- Workflow journey: completed steps with checkmarks, current step highlighted, next step visible.
- Context: owner, assignment group, due date, elapsed age, schedule impact, blocker/wait reason.
- Activity: newest meaningful event first, with internal/customer visibility respected.
- Return behavior: Back returns to the originating queue with its filters and scroll position.

## 5. Information architecture

### Customer navigation

Use this order and wording:

1. **Submit a Request**
2. **My Requests**
3. **My Actions** with count
4. **Project Overview**
5. **Schedule**
6. **Documents**
7. **Contacts & Help**
8. **Notifications**

Do not render an empty “Secondary tools” heading.

Customer landing page:

- Large, high-contrast **Submit a Request** button directly under the page title.
- One-sentence helper: “Tell the State Project Office what you need. PATH will route it and give you a tracking number.”
- Below it, show “Needs your action” only when non-empty.
- Then show “Your requests” as a compact status list/table.
- Each request row answers: request, submitted date, current owner/agency, current step, next event, due date, and status.
- Request-type choices appear only after Submit a Request is selected.
- The upload control appears inside the selected request form, never as a global field above My Work.
- Escalation form includes a required dropdown of the exact item/workstream/request being escalated, plus “Project-wide / not sure.”

### Government worker navigation

Use this order:

1. **My Work** with a count of all items actually requiring the user’s action.
2. **My Agency Queue**
3. **Waiting on Others**
4. **Requests for Information**
5. **Documents to Review**
6. **Project Overview**
7. **Schedule**
8. **Notifications**

Coordination requests should normally appear through My Work, My Agency Queue, or Waiting on Others. Keep a separate Coordination view only if users need a full record register; do not treat it as a competing primary queue.

Government My Work grouping:

- **Needs my action**
- **Due soon**
- **Waiting on others**
- **Recently completed**

Do not duplicate one item across primary groups. “Due today” and “overdue” are badges/filters within Needs my action, not peer groups that make the My Work count read zero.

## 6. Applying 20 Laws of UX

| UX law | Required PATH application |
|---|---|
| Jakob’s Law | Use familiar inbox/queue, record-detail, breadcrumb, status badge, tabs, and activity-feed patterns. |
| Hick’s Law | Show one primary next action; move less-common actions into a More menu. Reveal request types only after Submit a Request. |
| Fitts’s Law | Make the whole work-card title/row a large target for opening the exact item; keep the primary action large and predictable. |
| Miller’s Law | Keep primary navigation near 5–8 meaningful destinations and group the rest contextually. |
| Tesler’s Law | Keep workflow complexity in the system; translate it into plain-language current owner, current step, next step, and schedule impact. |
| Postel’s Law | Accept flexible plain-language request input, but save and display normalized structured categories/statuses. |
| Peak-End Rule | Make submission/mutation completion clear: confirmation number, saved state, new owner, next step, and return path. |
| Zeigarnik Effect | Keep unfinished work visible as an explicit progress journey without turning waiting work into failure. |
| Goal-Gradient Effect | Show step X of Y and make progress toward handoff/completion obvious. |
| Von Restorff Effect | Reserve visual isolation for the one primary action and true Critical Path risks. |
| Serial Position Effect | Put Submit a Request/My Work first and Help/Notifications last; order detail content from action to history. |
| Law of Proximity | Place status beside the item title, actions beside the required task, and dates beside schedule impact. |
| Law of Common Region | Visually group Past, Current, and Next workflow stages; group wait reason with who must act. |
| Law of Similarity | Use the same status, hold, and critical-path colors everywhere. Same action label must always open the same scope. |
| Law of Uniform Connectedness | Use connectors/stepper lines for workflow sequence and dependency arrows only where a real dependency exists. |
| Law of Prägnanz | Prefer the simplest explanation: “Waiting on CPRA for drainage concurrence” over several platform-state labels. |
| Cognitive Load | Default cards to summary fields; put record metadata and secondary explanations in detail or expandable sections. |
| Choice Overload | Remove duplicate route buttons and do not present six request choices until the customer asks to submit. |
| Selective Attention | Keep due, owner, blocker, next action, and critical-path impact visually prominent; demote IDs and implementation language. |
| Doherty Threshold | Use immediate skeleton/loading states and keep interaction feedback under 400 ms when possible; show “Saving…” until Supabase confirms. |

Reference: https://lawsofux.com/

## 7. Luna-sized implementation backlog

Each task is one focused commit. Luna must inspect the named files before editing, avoid unrelated formatting, run the task-specific tests, inspect `git diff`, and update `docs/progress.md`.

### UX-00 — Establish a safe baseline

**Files:** no source changes; optionally add a dated audit section to `docs/progress.md`.

**Steps:**

1. Confirm `git status --short` is clean or record pre-existing user changes without overwriting them.
2. Record the current commit and deployed footer commit.
3. Run build, typecheck, lint, Node tests, the two protected Playwright suites, and the RLS probe where credentials allow.
4. Capture failures exactly. Do not begin by fixing unrelated failures.

**Done when:** baseline evidence exists and working persistence/download checks are identified as regression gates.

### UX-01 — Centralize product and project naming

**Files:** add `lib/product-copy.ts`; update `app/layout.tsx`, `app/page.tsx`, `components/SystemVersionFooter.tsx`, `lib/operational-ux.ts`, and source fixtures/tests that assert display names.

**Steps:**

1. Add exported constants for product name, program subtitle, and project display name.
2. Replace visible “Critical Path” branding with PATH.
3. Change visible project title to “SpaceX – Starbase Louisiana Launch Complex and Orbital Support Facility.”
4. Remove Vermilion Parish from the login hero and persistent footer. Location may remain on project detail where relevant.
5. Change page metadata title to `PATH — Starbase Louisiana – SpaceX Coordination`.
6. Keep “Critical Path” only for schedule flags, filters, and badges.

**Acceptance:** search for visible legacy branding; remaining occurrences must be intentional domain language or historical docs/tests.

### UX-02 — Simplify the login page

**Files:** extract `components/path/LoginPage.tsx` from the logged-out branch of `app/page.tsx`; update source-contract tests.

**Steps:**

1. Center a single sign-in card under a simple PATH header.
2. Heading: **Sign in to PATH**.
3. Remove the hero claim “PATH tells you what to do next,” the three benefit cards, “Your default landing page,” and the demo-persona explanatory paragraph.
4. Keep username, password, Sign In, and Quick Demo Sign-In.
5. Keep demo personas collapsed until selected.
6. Ensure keyboard focus, error announcement, and responsive layout remain accessible.

**Acceptance:** a first-time user sees only product identity, sign-in controls, and optional Quick Demo entry.

### UX-03 — Create a stable navigation and return-context contract

**Files:** add `lib/navigation.ts`; update `app/page.tsx`; incrementally add shared shell components under `components/path/`. Reuse the existing physical route resolvers.

**Steps:**

1. Define route names, labels, role visibility, and destination scope in one configuration.
2. Give every open control one semantic contract:
   - Clicking a work card/title opens the exact work item.
   - Clicking a workstream link opens the exact workstream journey.
   - Clicking Project Overview opens the project summary.
3. Remove the duplicate generic Project button from work cards.
4. Preserve origin queue, filters, and scroll position when returning from detail.
5. Add URL-backed navigation for exact work items instead of root-only `setRoute`. Use a single canonical pattern selected for all kinds, e.g. `/work/{kind}/{id}`, with authenticated resolution and customer-safe projection.
6. Reuse the PATH shell on physical project/workstream/request routes so they do not look like a different application.
7. Keep compatibility redirects from `/workstreams/{id}` to the canonical project-scoped route.
8. Add an inline not-found/access-denied state inside the shell, never a dead standalone page.

**Acceptance:** browser Back restores the prior queue state; refreshing an exact work URL preserves the same authorized record; unauthorized access remains blocked by server/RLS.

### UX-04 — Rebuild the customer landing experience

**Files:** extract `components/path/customer/CustomerHome.tsx`, `CustomerRequestList.tsx`, and `SubmitRequestLauncher.tsx`; update `app/page.tsx` and customer portal tests.

**Steps:**

1. Make the customer default route Customer Home, not generic My Work.
2. Put **Submit a Request** immediately below the title.
3. Move the existing six request intents into the launcher opened by that button.
4. Move attachment input into the chosen permit/service/escalation form.
5. Show Needs SpaceX next, only when non-empty.
6. Show all customer requests below with compact status/owner/current/next fields.
7. Make each row open its request receipt or exact actionable item.
8. Add empty states: “No action needed from SpaceX” and “No requests submitted yet.”
9. Remove the persistent official-filing notice. Display authoritative-system guidance only on permit forms/records where it applies.

**Acceptance:** Alex can identify how to submit within two seconds and can explain where every prior request is, who has it, and what happens next.

### UX-05 — Simplify My Work and correct counts

**Files:** `lib/operational-ux.ts`, extracted `components/path/work/WorkQueue.tsx` and `WorkCard.tsx`, `app/page.tsx`, assignment/customer/operational UX tests.

**Steps:**

1. Define `requiresCurrentUserAction` once from structured ownership and allowed actions.
2. Make the My Work badge equal the count of all actionable items, including due-today and overdue items.
3. Use four mutually exclusive groups: Needs my action, Due soon, Waiting on others, Recently completed.
4. Show only title, status, critical-path badge, one-sentence next action, owner/waiting-on, due/age, and schedule impact on the collapsed card.
5. Make the card/title open exact work. Show one contextual action button only when it is safe and unambiguous.
6. Move assignment group, record kind, customer, removal rule, full handoff explanation, and audit detail to the record page or an expandable Details area.
7. Deduplicate assignment-group options that differ only by `&` versus `and`.

**Acceptance:** the visible actionable card count equals the My Work badge; one record never appears in two primary groups.

### UX-06 — Build the unified work item page

**Files:** extract `components/path/work/WorkItemPage.tsx`, `NextActionPanel.tsx`, `WorkItemFacts.tsx`, and `ActivityFeed.tsx`; reuse `WorkflowJourney.tsx`.

**Steps:**

1. Keep the breadcrumb and exact-item title at the top.
2. Put a clear “Your next action” panel directly beneath the header.
3. Add a prominent three-part workflow summary: Completed, Current, Next.
4. Render the full workflow journey immediately after the summary, not behind a project jump.
5. Show a checkmark and completion date for completed stages, a high-contrast current stage, and the next configured stage/owner.
6. If only one persisted stage exists, say “1 configured step” rather than implying missing UI.
7. Place Add Note, Mark Blocked, Request Information, Complete Step, and Escalate consistently. One is primary; others go in a More actions menu unless currently required.
8. For notes/activity, show the authoritative saved event after refresh.
9. For blocked work, show status, blocker category, exact reason, who must act, since date, due date, paused-clock policy, and downstream impact in one common region.
10. If the supporting work item and linked workstream have different statuses, label both clearly and add a plain-language derived summary rather than silently choosing one.

**Acceptance:** Jordan can open one item and accurately state completed/current/next, the action he owns, what removes the item from his queue, and the next owner without visiting the full project page.

### UX-07 — Make mutations refresh in place

**Files:** `app/page.tsx`, extracted mutation hook/service adapter such as `hooks/useWorkItemMutation.ts`, relevant repository projection tests. Do not change RPC semantics.

**Steps:**

1. Before mutation, retain canonical `kind`, `sourceId`, `workstreamId`, and current URL.
2. Show a disabled Saving state.
3. Await the existing persisted repository mutation.
4. On success, rehydrate from Supabase.
5. Rebuild the operational projection.
6. Re-select the same canonical item or its successor if the completed item legitimately left the queue.
7. Keep the user on the detail page and show an inline confirmation containing saved status, next owner, and next step.
8. On failure, preserve form values and show the real error. Do not show success.
9. Add regression scenarios for Add Note, Mark Blocked, customer RFI response, response acceptance, and Complete Step.

**Acceptance:** each mutation survives refresh and another authorized browser; the current screen immediately reflects the authoritative state.

### UX-08 — Repair workstream navigation and journey hydration

**Files:** `app/projects/[projectNumber]/workstreams/[workstreamId]/page.tsx`, `app/workstreams/[workstreamId]/page.tsx`, `lib/supabase/route-resolvers.ts`, mappings, `WorkflowJourney.tsx`, workflow journey tests.

**Steps:**

1. Test links using project UUID, project number, workstream UUID, and workstream code.
2. Normalize resolver inputs in one place.
3. Ensure a valid queue item always resolves to its authorized workstream.
4. Verify tasks, pinned workflow stages, and stage runs are hydrated in authoritative order.
5. Do not use title matching as the primary identity. Keep the current fuzzy stage-name match only as a documented legacy fallback.
6. Show current and next step even when stage-run history is incomplete; label unknown history honestly.
7. Add tests for multi-step, one-step, completed, blocked, waiting, and incomplete-history workflows.

**Acceptance:** no valid in-app link produces Workstream not found, and every displayed step comes from the correct persisted workflow version/tasks.

### UX-09 — Rebuild the project workstream interaction

**Files:** `components/cockpits/ProjectOverviewPage.tsx`, `WorkflowJourney.tsx`.

**Steps:**

1. Replace the two-column field of large cards with a scan-friendly list/table on desktop and stacked rows on mobile.
2. Each row shows workstream, lead, status, current step, next step, forecast, variance, and critical-path badge.
3. Clicking a row opens an adjacent drawer/details panel or canonical workstream URL. It must not place the result invisibly below a long grid.
4. Preserve the project-level “Needs attention / Happening now / Next milestone” strip but make each card clickable.
5. Show completed/current/next mini-step state only when it improves scanning; avoid repeating full prose from the detail page.

**Acceptance:** clicking Liquid Methane & Gas Utility Interconnection visibly opens that workstream’s journey and the URL/focus state identifies it.

### UX-10 — Make the Gantt truthful and usable

**Files:** `components/cockpits/WorkstreamGraphGantt.tsx`, `lib/operational-ux.ts`, schedule engine/helpers, Gantt tests.

**Steps:**

1. Replace both hard-coded August 30 dates with an injected clock/default `new Date()` normalized consistently. Tests may inject a fixed date.
2. Add one shared `asOfDate`/clock helper used by queues and Gantt.
3. Default the visible schedule viewport so Today is around 25–35% from the left, leaving meaningful recent past and ample future.
4. Add **Today**, **Fit project**, and day/week/month zoom controls. Do not silently crop historical data; Fit project exposes the entire schedule.
5. Build bars from real stage/task segments when available:
   - completed segments: actual start/completion and completed styling/checkmark;
   - current segment: actual/forecast start through today/forecast end, colored by active/wait/blocked state;
   - future segments: planned/forecast dates with subdued forecast styling;
   - baseline: thin comparison line, not mislabeled as the whole past.
6. Use the existing state taxonomy consistently: running, waiting applicant, interagency wait, external wait, statutory notice, scheduled hold, blocked, escalated, complete.
7. Highlight Critical Path with an additional outline/icon, never color alone.
8. Clicking any bar or row opens the exact workstream journey.
9. Make legend items filters only when they have results; visually disable zero-count filters.
10. Preserve a keyboard-accessible table alternative containing every date, dependency, owner, state, variance, and critical-path indicator.

**Acceptance:** on September 2 the marker says September 2; completed work is left of today, current work intersects today when appropriate, future work is right of today, and a user can open any workstream from either bar or table.

### UX-11 — Improve escalation selection

**Files:** customer Help/Request components and existing escalation dialog.

**Steps:**

1. Require selection of what is being escalated: active request, workstream, permit, RFI, document decision, or Project-wide / not sure.
2. Preselect the exact source when Escalate is launched from a record.
3. Keep plain-language problem type and impact description.
4. Preview recipient, customer-visible message, and acknowledgement target before confirmation.
5. After saving, show confirmation number/status and link back to the escalated record.

**Acceptance:** every escalation is traceably associated with a selected record or explicitly project-wide.

### UX-12 — Remove noise and finish the shell

**Files:** app shell/sidebar/header/footer components.

**Steps:**

1. Move Supabase connection health from the header to the version footer.
2. Keep commit hash, commit date, build version, environment, and persistence health in the footer.
3. Remove persistent Official filing notice and empty Secondary tools headings.
4. Use plain labels; avoid “authoritative project page,” “operational queue,” “DAG,” “variance engine,” and “customer-safe projection” in ordinary user copy.
5. Keep technical terms available in admin or diagnostic contexts.
6. Add responsive/mobile and keyboard checks for the shell.

**Acceptance:** header shows PATH, current context, user, notifications, and sign out—nothing else competing for attention.

### UX-13 — Full regression and usability proof

**Files:** focused tests plus `docs/progress.md` and `docs/execution-plan.md`.

Automate these journeys:

1. Jordan → My Agency Queue → exact work item → Add Note → remains on item → note visible after refresh.
2. Jordan → exact work item → Mark Blocked → blocker reason/state visible in queue, work detail, project row, and Gantt.
3. Alex → lands on customer home → Submit a Request → receives confirmation → sees it in My Requests after refresh and isolated browser.
4. Alex → Needs SpaceX RFI → responds → sees submitted/waiting-for-government state and next step.
5. Jordan → sees exact response → accepts it → workflow resumes and next handoff appears.
6. Project → click every sample workstream row/Gantt bar → exact selected workstream opens; no Workstream not found.
7. Gantt → injected historical/current/future fixtures render on correct sides of Today and preserve the accessible table.
8. Download existing document → exact bytes remain correct and unauthorized user remains denied.
9. Browser Back from work detail restores prior queue filters and scroll position.
10. WCAG 2.1 AA pass for keyboard focus order, status not conveyed by color alone, dialog focus, accessible names, and responsive layout.

## 8. Required commit sequence

Use descriptive, narrow commits. Recommended order:

1. `test: baseline protected PATH workflows`
2. `refactor: centralize PATH product copy`
3. `feat: simplify PATH sign-in experience`
4. `feat: add stable work navigation contract`
5. `feat: prioritize customer request intake`
6. `refactor: simplify actionable work queues`
7. `feat: unify work item and workflow journey`
8. `fix: refresh persisted work actions in place`
9. `fix: normalize workstream route resolution`
10. `feat: make project workstreams directly navigable`
11. `fix: render truthful current-date Gantt`
12. `feat: associate escalation requests with work`
13. `chore: simplify shell and update UX documentation`
14. `test: prove PATH UX journeys and protected persistence`

Do not combine these into one giant commit. Do not push or merge until the full gate passes and the diff is reviewed.

## 9. Final definition of done

- Product is named PATH everywhere except intentional Critical Path schedule labels.
- The full project display name is consistent.
- Login is centered, simple, and retains Quick Demo Sign-In.
- Alex sees Submit a Request first.
- Jordan sees a trustworthy count of work requiring action.
- Work cards are scannable and open the exact item.
- Back/refresh/deep links preserve context.
- Every work item clearly shows completed/current/next.
- Notes, blocking, RFIs, responses, completion, and escalation refresh in place from Supabase.
- No valid navigation produces Workstream not found.
- The Gantt uses the real current date, shows recent past plus future by default, uses real stage/task segments, distinguishes hold types, and opens exact workstreams.
- Supabase authority, RLS, audit events, notifications, uploads, and downloads have not regressed.
- Commit/build metadata is regenerated and visible in the footer.
- Build, typecheck, lint, unit, E2E persistence, document-download, and RLS tests pass or have a precisely documented external blocker.

## 10. Copy-paste Luna execution prompt

```text
You are implementing a controlled UX recovery of the PATH permit_tracker repository.

Repository: https://github.com/grandpajoe1980/permit_tracker
Starting review commit: 0fe54e2 (verify current main before acting)
Frontend: React 19 + Next App Router/Vinext + TypeScript + Tailwind/shadcn
Backend: Supabase Auth + PostgreSQL + Storage + RLS/RPC

First read, in full:
1. docs/.agents.md
2. README.md
3. docs/PRD.MD
4. docs/execution-plan.md
5. docs/progress.md
6. docs/operational-ux.md
7. PATH_UX_LUNA_IMPLEMENTATION_PLAN.md supplied by the user

Your mission is to execute the supplied UX plan in the stated task and commit order. Work on exactly one UX task at a time. Do not make a broad rewrite. Inspect every named file before editing. Do not perform unrelated cleanup.

Non-negotiable rules:
- Supabase remains authoritative. Never use localStorage, fixtures, or React state as production persistence.
- Do not rewrite database migrations, RLS, RPCs, authentication, Storage, document downloads, audit behavior, or notification behavior for convenience.
- Preserve existing uploads/downloads and awaited mutations.
- Never show mutation success until Supabase confirms it.
- Rehydrate and reselect the same work item after mutations.
- Do not fabricate workflow steps; display persisted tasks/stages/stage runs.
- Keep Quick Demo Sign-In.
- Product name is PATH. Critical Path is only a schedule attribute.
- Project display name is “SpaceX – Starbase Louisiana Launch Complex and Orbital Support Facility.”
- Program subtitle is “Starbase Louisiana – SpaceX Coordination.”
- Protect all user changes already in the worktree.

For each task:
1. Restate the task objective in one sentence.
2. Inspect current implementation and tests.
3. Make the smallest cohesive change.
4. Add or update focused tests before declaring success.
5. Run focused tests, npx tsc --noEmit, npm run lint, and npm run build.
6. For state-changing or navigation work, run the relevant Playwright persistence/document scenario.
7. Inspect git diff and git status.
8. Update docs/progress.md with exact evidence, failures, and next task.
9. Create one descriptive commit only after checks pass.
10. Continue to the next task without waiting unless you encounter a true external blocker or a decision that would change the data/security model.

At every checkpoint explicitly report:
- files changed;
- behavior changed;
- tests run and results;
- whether Supabase, RLS, audit, notifications, uploads, and downloads were touched;
- current commit hash;
- next ready UX task.

Before final completion run the entire protected regression suite and execute all ten end-to-end journeys in UX-13. Fix all blocker/high findings. Do not call the work complete based only on component rendering or fixture tests.
```


Additional Guidance:
You are continuing work on the existing PATH / Louisiana Permit Tracker repository.

Repository:
https://github.com/grandpajoe1980/permit_tracker

This is an implementation assignment, not merely a review. Work autonomously through the entire request in one run. Keep resource usage modest: work serially, do not create a large subagent tree, and avoid broad rewrites.

## Startup

Before changing code:

1. Verify the current branch, commit, and working-tree status.
2. Read and follow:

   * `docs/.agents.md`
   * `README.md`
   * `docs/PRD.MD`
   * `docs/execution-plan.md`
   * `docs/progress.md`
   * `docs/operational-ux.md`, if present
   * the current UX implementation plan copied into the repository
3. Inspect the existing routing, navigation, project cards, workstream views, Permit Catalog, workflow templates, Agency Registry, seed scripts, authentication/personas, and Supabase data access.
4. Preserve working functionality. Do not restart or redesign the application from scratch.
5. Do not stop after producing a plan. Implement, test, document, and commit the work.

## Non-negotiable persistence rule

Supabase/Postgres/Storage must remain the authoritative production data source.

Do not implement new production behavior using `localStorage`, browser-only fixtures, or React state as persistence. All mutations must be awaited and confirmed by Supabase before success is shown. Refreshing, signing in from another browser, or opening a direct URL must rehydrate the same data from Supabase.

Seed data must be created through the project’s real database seeding/migration approach and must be safe to run repeatedly without creating duplicates.

## Task 1: Fix project-card navigation

On the Projects page, clicking a project or workstream card does not reliably open the operational workstream.

A URL such as:

`https://permit-tracker-iota.vercel.app/?view=project&workstream=WS-AIR-TITLE-V`

must open the actual workstream workspace for `WS-AIR-TITLE-V`, including its current stage, assigned group, tasks, documents, notes, decisions, dependencies, holds, next actions, and timeline.

Implement the following:

* Make the entire appropriate card clickable, while preserving any separate buttons or menus.
* Route using stable database-backed identifiers.
* Read the URL on initial load; do not depend on a previous in-memory selection.
* Support refresh, direct-link entry, browser Back, and browser Forward.
* If a workstream ID is invalid, show a useful recovery state with a link back to Projects.
* Do not send the user to a generic project summary when the clicked item represents a specific workstream.
* Provide clear navigation back to the parent project and project list.
* Add or update navigation tests covering card clicks and direct workstream URLs.

## Task 2: Correct the information architecture

Workflow Templates and Agency Registry are administrative configuration features. They do not belong inside the public-facing Permit Catalog.

Create or enhance an Admin section and move these features into it:

* Workflow Templates
* Agency Registry
* User and Persona Management, if an equivalent feature already exists
* Group and Role Management, if supported by the current architecture
* Seed/demo-data controls only if such controls already exist and can be exposed safely

Requirements:

* Add a clearly labeled Admin navigation area.
* Show administrative navigation only to appropriate admin personas.
* Enforce authorization in the underlying route/action, not merely by hiding links.
* Preserve old deep links where practical by redirecting them to the new location.
* Update headings, breadcrumbs, empty states, and navigation labels.
* The Permit Catalog must no longer present workflow-template or agency-registry configuration as catalog content.

## Task 3: Turn the Permit Catalog into a usable resource catalog

Each permit or approval catalog entry should help the user understand and begin the application process.

Each applicable entry should provide:

* Permit or approval name
* Responsible agency and reviewing group
* Plain-language purpose
* When it is required
* Application or form download
* Instructions or checklist
* How and where to submit
* Expected supporting documents
* Typical review stages
* Related permits, dependencies, or prerequisites
* Contact or escalation path
* A clear action to start a request in this system

Do not leave buttons pointing to `#`, blank pages, or dead routes.

Use authoritative links already present in the repository where available. Where the demo lacks an external authoritative resource, create a clearly labeled internal demo instruction page or downloadable sample resource. Do not invent official-looking government URLs or claim that demo material is an official form.

Starting a request from a catalog entry should preselect the relevant permit type and connect the new request to the proper workflow template.

## Task 4: Greatly expand the self-contained seed environment

Enhance the seed data so the application demonstrates a realistic, end-to-end Louisiana space-development permitting program without requiring the user to imagine missing participants or workflow stages.

Add substantially more:

* Agencies
* Divisions and reviewing groups
* Users and demo logins
* Personas and job titles
* Projects and project teams
* Workflow templates
* Workstreams and workflow stages
* Tasks and assignments
* Dependencies
* Documents and document requirements
* Notes and activity history
* Information requests
* Decisions and approvals
* Escalations
* Holds using the supported hold types
* Completed, current, blocked, and future work
* Notifications and audit history where supported

Include representative organizations and groups such as:

* SpaceX Project Delivery
* SpaceX Regulatory Affairs
* SpaceX Environmental
* SpaceX Civil and Site Development
* SpaceX Launch Operations
* Louisiana Economic Development Space Coordination
* Governor’s Executive Review
* LDEQ Air Permits
* LDEQ Water Permits
* LDEQ Waste and Remediation
* DOTD Aviation
* DOTD Roads and Bridges
* CPRA Coastal Permitting
* LDNR Energy and Pipeline Coordination
* State Fire Marshal
* Local parish coordination
* Federal coordination groups such as FAA, USACE, and EPA where appropriate

Include public figures as fun demo personas using only public professional names and roles:

* Elon Musk — SpaceX executive/project sponsor
* Gwynne Shotwell — SpaceX president and operational executive
* Bill Gerstenmaier — SpaceX build and flight reliability executive
* Jeff Landry — Governor of Louisiana/executive sponsor
* Susan Bourgeois — Louisiana Economic Development secretary/executive coordinator

You may add a small number of other widely known SpaceX personnel if their public professional roles are already known in the project context. Do not research, collect, or seed personal details.

Important safety rules:

* These must be unmistakably fictional demo accounts.
* Do not use or imply real email addresses, credentials, phone numbers, signatures, or private information.
* Use a reserved demo domain such as `@demo.permit.local`.
* Do not suggest that any seeded decision or approval was actually made by the named person.
* Label simulated actions and data appropriately.

Create meaningful permission differences among personas, including:

* Applicant/project contributor
* Applicant executive
* Agency reviewer
* Agency supervisor
* Interagency coordinator
* Executive observer/sponsor
* Workflow administrator
* System administrator

## Task 5: Make the seeded scenario functional end to end

The expanded seed data must demonstrate a complete operating path:

1. A SpaceX user searches the Permit Catalog.
2. The user reviews the form, instructions, submission method, and requirements.
3. The user starts and submits a request.
4. The request creates or activates the correct project workstream.
5. An intake group receives and assigns it.
6. A reviewer opens the workstream directly from a card.
7. The reviewer reviews documents, adds notes, requests information, and changes status.
8. The applicant responds and uploads the requested information.
9. The agency resumes review.
10. A supervisor or coordinator handles an escalation.
11. Dependencies and holds are visible.
12. The workstream advances through its configured stages.
13. Completion updates the workstream, project summary, timeline/Gantt, audit history, and applicant view.
14. Refreshing or signing in through another browser shows the same Supabase-backed state.

Every seeded project must have an obvious current condition:

* What has already happened
* What is happening now
* What is blocked or on hold
* Who owns the next action
* What happens next
* How the user performs that action

Eliminate dead-end screens. Every operational screen should offer a valid next action, useful explanation, or route back to the correct parent context.

## Implementation loop

Complete one focused slice at a time:

1. Inspect the relevant existing files and database schema.
2. Make the smallest coherent change.
3. Run focused tests.
4. Run the repository’s typecheck, lint, and build commands.
5. Run relevant Playwright navigation and persistence scenarios where available.
6. Inspect `git diff` and `git status`.
7. Fix regressions before moving on.
8. Make a narrow, descriptive commit.
9. Update `docs/progress.md` with completed work, evidence, failures, and remaining items.
10. Continue immediately to the next slice.

Do not replace established domain concepts merely because you would model them differently. Reuse the current components, repositories, schema, RLS policies, RPCs, authentication, audit, notifications, and storage mechanisms.

## Required acceptance checks

Before declaring completion, verify:

* Project/workstream cards open the correct workspace.
* The supplied `WS-AIR-TITLE-V` deep link works after a fresh load.
* Refresh and browser navigation preserve the correct view.
* Workflow Templates and Agency Registry are under Admin.
* Unauthorized personas cannot access administrative actions.
* Permit Catalog entries provide functional forms, instructions, submission guidance, and start-request actions.
* Expanded personas can sign in through the existing demo-login mechanism.
* Seed execution is idempotent.
* Seeded workstreams cover completed, active, blocked, held, and future states.
* The full seeded request can be operated from submission through completion.
* Mutations survive reload and cross-browser authentication.
* No new production path relies on `localStorage`.
* There are no placeholder links, dead buttons, silent failures, or success messages shown before persistence completes.
* Existing protected regression tests still pass.
* Typecheck, lint, tests, and production build pass.

At the end, provide:

* A concise implementation summary
* The exact commits created
* Database migrations or seed commands required
* Test/build results
* Any remaining blocker that genuinely requires human credentials or a policy decision

Commit all completed changes locally in small, descriptive commits. Do not discard or overwrite unrelated existing work, and do not push or deploy unless that authorization is explicitly available in the current assignment.
