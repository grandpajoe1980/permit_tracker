# Original User Request

## 2026-08-31T13:13:06Z

Transform the SpaceX Louisiana Critical Path / PATH system into a comprehensive, clean ITSM and Project Management ticketing platform with full multi-tenancy (companies/agencies, assignment groups, customers, fulfillers/state workers), inline interactive workflow modification per ticket for authorized fulfillers/state workers, end-to-end reliable document preview/downloads, robust Supabase persistence, and git checkpoints.

Working directory: /Users/joe/Repos/Permit/permit_tracker
Integrity mode: development

## Core Features & ITSM / PM Alignment

### 1. ITSM & Project Management Entities & Tenancy
- **Organizations / Agencies & Companies**: Multi-agency model (e.g., SpaceX as customer company; DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish as reviewing agencies/authorities).
- **Assignment Groups & Fulfiller Queues**: Dedicated assignment groups per agency/department (e.g., Structural Review, Environmental Compliance, Maritime Clearances, Parish Permitting) with round-robin or individual fulfiller assignment (`Assigned To` / `Assignment Group`).
- **Customer & Stakeholder Portal**: Dedicated customer view with request intake, status tracking, plain-English notifications, and customer-safe milestones.
- **Ticketing & Work Items Lifecycle**: Standard ITSM states (Draft, Submitted/New, Triaged, In Progress, Pending Customer/Info, Pending Agency Concurrence, Blocked/Suspended, Resolved, Closed/Issued) alongside PM milestone/critical path indicators.
- **Priority & SLA / Statutory Due Dates**: Urgency, Impact, Priority Matrix (P1-P4), Statutory Deadlines, and Target Completion tracking.

### 2. Interactive In-Ticket Workflow Modification
- Authorized roles (`state worker`, `reviewer`, `fulfiller`, `admin`) can click directly into the workflow on any ticket/workstream.
- Capability to modify workflow steps, insert custom milestones or sub-tasks, adjust step dependencies/order, update step owners/agencies, and change step states (`Active`, `Done`, `Blocked`, `Pending Hearing`, etc.) directly from the ticket view.
- Changes persist immediately to Supabase and update audit trails / operational histories.

### 3. Reliable Document Management & Downloads
- Document vault and ticket attachments with robust download functionality (direct file download / signed URL fallback).
- Retain existing demo documents (only clean up corrupt/broken fixtures if any).
- Download actions work across customer portal, ticket detail views, and agency review panels.

### 4. Supabase Persistent Database
- All ticketing, assignment groups, organizations, workflow steps, documents, comments/audit notes, and status updates persist through Supabase as authoritative source of truth.
- Offline/mock demo fallback seamlessly aligns with Supabase schema.

### 5. Git Checkpoints
- Automated clean git commits at each functional checkpoint with descriptive messages all the way to GitHub repository.

## Requirements

### R1. ITSM & Project Management Data Model & Tenancy
Provide full data modeling and UI for Assignment Groups, Companies/Agencies, Customers, and Fulfillers. Tickets must support assignment routing, priority, category/intent, RAG status, critical path tagging, statutory clocks, and internal vs. customer-facing audit updates.

### R2. In-Ticket Workflow Editor & Execution Engine
Enable fulfillers and state workers to open, inspect, and modify the workflow DAG / step sequence directly on any ticket. Fulfillers can reorder steps, add/remove review gates, change assigned agency/fulfiller per step, resolve/add blockers, and advance step execution.

### R3. Document Management & Download Reliability
Ensure all document attachments across tickets, submittals, and repository vaults can be downloaded and viewed reliably without missing blobs or broken links, preserving valid demo data.

### R4. Supabase Authoritative Persistence & Sync
Ensure all ticket mutations, assignment updates, workflow modifications, document uploads/links, and status changes operate through Supabase client/server transactions with robust RLS policies.

### R5. Incremental Git Checkpoints
Create descriptive git commits at each functional milestone checkpoint.

## Acceptance Criteria

### ITSM & Ticketing Operations
- [ ] Users can browse, filter, create, assign, and triage tickets by Assignment Group, Agency/Company, Customer, Priority, and Status.
- [ ] Fulfillers and state workers can be assigned to tickets within their assignment group.
- [ ] Customers see a clean, restricted view of their submitted tickets without internal agency deliberations.

### Workflow Customization on Tickets
- [ ] Any ticket with an attached workflow allows state workers / fulfillers / admins to click "Edit Workflow" or interact directly with workflow nodes.
- [ ] Fulfillers can add new steps, edit step criteria, change assignees, reorder dependencies, and advance/block steps in real time.
- [ ] Workflow modifications persist to Supabase and reflect across Gantt/schedule views and ticket details.

### Documents & Downloads
- [ ] All document items in ticket attachments and document vaults provide working download actions (triggering real file downloads / valid data blobs).
- [ ] Demo documents remain intact and accessible.

### Database & Persistence
- [ ] All entities (tickets, groups, agencies, workflow nodes, documents) persist reliably to Supabase with proper relationships and foreign keys.
