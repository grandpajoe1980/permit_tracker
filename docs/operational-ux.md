# PATH Operational Interaction Model

PATH is organized around the action a person needs to take, not around the internal objects stored by the platform. The same workstream may contain a workflow stage, task, RFI, coordination request, document revision, commitment, escalation, and audit events; a person sees the next useful action in one queue.

## Reviewer journey

1. Sign in and land on **My Work**.
2. Read the priority card: what needs action, why it is assigned, due date, wait time, and schedule impact.
3. Open the item to see the assignment, requirements, documents, related RFIs, dependencies, downstream impact, and activity history.
4. Use the visible Work Action Bar to complete, request information, mark blocked, ask for help, escalate, or add a note.

### Reviewer complete

```text
My Work
→ Open
→ Complete Step
→ Requirements
→ Preview Handoff
→ Confirm
→ Next Owner
```

Completion validates the configured workflow gates, records an audit event, updates the workstream, notifies the resolved recipients, and refreshes the queue from the resulting state.

### Reviewer blocked — customer

```text
Open
→ Mark Blocked
→ Waiting on SpaceX
→ Enter Need
→ PATH Creates RFI
→ Confirm Notifications
→ Customer Action Queue
```

The reviewer chooses a business reason and describes the need. PATH derives the paused-clock policy from that reason and shows the customer-safe status message before confirmation.

### Reviewer blocked — agency

```text
Open
→ Mark Blocked
→ Waiting on Another Agency
→ Select Agency
→ Enter Need
→ PATH Creates Coordination Request
→ Confirm
→ Target Agency Queue
```

The resulting coordination request identifies who must act, what concurrence or decision is needed, when it is needed, and which workstream is waiting.

## Supervisor journey

Supervisors land on a queue of unassigned, overdue, at-risk, blocked, escalated, and transfer-request work. They can open the exact work item, see the current owner and dependency, then assign, reassign, help resolve, approve, return, or escalate. Healthy work remains available through the project context but does not dominate the exception queue.

## State Project Office journey

The State Project Office sees cross-agency exceptions: new blockers, overdue coordination requests, missed commitments, critical-path slips, escalations, and actions due from SpaceX or agencies. Internal routing remains on the agency side; customer-facing status is sanitized.

## SpaceX journey

SpaceX sees four plain-language queues: **Needs SpaceX**, **Needs Government**, **Blocked**, and **Upcoming decisions**. RFI requests show the question, due date, requester, and Respond / Upload Documents actions. Government workflow state, numeric escalation tiers, and internal audit details are not exposed.

## Escalation

```text
Open
→ Escalate
→ Select Problem Type
→ PATH Resolves Escalation Recipient
→ Preview
→ Confirm
```

The person chooses the help needed in ordinary language. PATH resolves the next configured recipient and shows the fallback notification date before the escalation is recorded.

## Notification model

The notification center distinguishes action required, status update, escalation, deadline, completion, and information. It links actionable notices to the exact work item. Routine audit events remain in the work item history instead of becoming duplicate notifications.

## Demo and production boundary

The local persona picker uses the fixture-backed audited repository when Supabase credentials are unavailable. This supports repeatable UAT scenarios; it is not a production authorization boundary. In a connected deployment, Supabase Auth and RLS remain responsible for identity and authorization, while the UI continues to call validated mutation services.
