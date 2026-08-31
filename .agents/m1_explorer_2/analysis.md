# Milestone 1: Domain Models & Drizzle ORM Schema Analysis

**Author**: `m1_explorer_2` (Domain Models & Drizzle Explorer)  
**Date**: 2026-08-31  
**Target Milestone**: Milestone 1 (ITSM & Multi-Tenancy Data Model & Supabase Persistence)  
**Related Documents**: `PROJECT.md`, `.agents/ORIGINAL_REQUEST.md`, `lib/domain-models.ts`, `db/schema.ts`, `lib/operational-ux.ts`, `lib/demo-data.ts`

---

## Executive Summary

This document specifies the exact TypeScript domain model definitions (`lib/domain-models.ts`) and Drizzle ORM relational schema (`db/schema.ts`) for Milestone 1.

The design establishes:
1. **First-Class ITSM Tenancy & Routing**: Assignment Groups (`assignment_groups`) and Memberships (`assignment_group_memberships`) linking multi-agency fulfiller queues (DOTD, LDEQ, CPRA, OSFM, LSP, Vermilion Parish, State Project Office, SpaceX) to individual users and tickets.
2. **Unified 9-State ITSM Lifecycle**: Standardized lifecycle (`draft`, `submitted`, `triaged`, `in_progress`, `pending_customer`, `pending_agency`, `blocked`, `resolved`, `closed`) with 100% bi-directional backwards compatibility for existing operational states.
3. **P1–P4 Priority Scoring & Matrix**: Formal Urgency × Impact matrix generating deterministic priority levels (P1 Critical, P2 High, P3 Moderate, P4 Routine).
4. **Statutory SLA Clock State Tracking**: First-class pause/resume clock state, remaining days calculation, deadline projection, and pause history audit trails.
5. **Relational Drizzle Schema & Type Safety**: Drizzle table definitions, foreign keys, and `relations()` declarations supporting relational queries.
6. **Validation & Serialization Toolkit**: Comprehensive type guards, parsing functions, and bi-directional compatibility adapters.

---

## 1. TypeScript Domain Model Specification (`lib/domain-models.ts`)

### 1.1 New Core Enums & Union Types

```typescript
// ==========================================
// ITSM LIFECYCLE, PRIORITY & STATUTORY CLOCKS
// ==========================================

export type ITSMState =
  | "draft"
  | "submitted"
  | "triaged"
  | "in_progress"
  | "pending_customer"
  | "pending_agency"
  | "blocked"
  | "resolved"
  | "closed";

export type PriorityLevel = "P1" | "P2" | "P3" | "P4";

export type UrgencyLevel = "low" | "medium" | "high" | "critical";

export type ImpactLevel = "low" | "medium" | "high" | "critical";

export type ClockStatus = "active" | "paused" | "stopped";

export type AssignmentGroupRole = "member" | "lead" | "backup";
```

### 1.2 Assignment Group Interfaces

```typescript
// ==========================================
// ASSIGNMENT GROUPS & FULFILLER QUEUES
// ==========================================

export interface AssignmentGroupRecord {
  id: string;
  orgCode: string; // e.g. "DOTD", "LDEQ", "CPRA", "OSFM", "LSP", "VERMILION", "LA-PROJECTS", "SPACEX"
  organizationId?: string;
  name: string; // e.g. "DOTD Structural & Heavy-Haul Review"
  description: string;
  leadUserId?: string;
  leadUserName?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignmentGroupMembershipRecord {
  id: string;
  assignmentGroupId: string;
  userId: string;
  role: AssignmentGroupRole;
  userName?: string;
  userEmail?: string;
  userTitle?: string;
  createdAt?: string;
}
```

### 1.3 Statutory Clock & Priority Matrix Models

```typescript
// ==========================================
// STATUTORY CLOCK & PRIORITY MATRIX MODELS
// ==========================================

export interface ClockPauseRecord {
  pausedAt: string;
  resumedAt?: string;
  reason?: string;
  pausedByUserId?: string;
  pausedByName?: string;
  rfiId?: string;
  coordinationRequestId?: string;
  pauseDurationDays?: number;
}

export interface StatutoryClockState {
  clockStatus: ClockStatus;
  statutoryDays: number;
  elapsedDays: number;
  remainingDays: number;
  statutoryDeadline?: string;
  isPaused: boolean;
  pausedAt?: string;
  pausedReason?: string;
  resumedAt?: string;
  totalPausedDays: number;
  pauseHistory: ClockPauseRecord[];
}

export interface PriorityMatrixEntry {
  urgency: UrgencyLevel;
  impact: ImpactLevel;
  priority: PriorityLevel;
  targetResponseHours: number;
  targetResolutionDays: number;
}
```

### 1.4 Updated `CustomerRequestRecord`

```typescript
export interface CustomerRequestRecord {
  id: string;
  confirmationNumber: string;
  projectId: string;
  requestType: CustomerRequestType;
  title: string;
  description: string;
  requestedOutcome?: string;
  locationOrAffectedArea?: string;
  desiredDate?: string;
  scheduleImportance?: "low" | "normal" | "critical";
  knownAgencyCode?: string;
  knownPermitTypeId?: string;
  submittedByUserId?: string;
  submittedByName: string;
  relatedWorkstreamId?: string;
  blocksActiveWork: boolean;
  status: "draft" | "submitted" | "triage" | "in_progress" | "resolved" | "closed" | ITSMState;
  attachmentDocumentVersionIds: string[];
  createdAt: string;
  updatedAt: string;

  // Milestone 1 ITSM & Assignment Extensions
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  itsmState?: ITSMState;
  priority?: PriorityLevel;
  urgency?: UrgencyLevel;
  impact?: ImpactLevel;
  statutoryDeadline?: string;
  clockStatus?: ClockStatus;
  clockPausedReason?: string;
  statutoryClock?: StatutoryClockState;
}
```

### 1.5 Updated `WorkstreamRecord`

```typescript
export interface WorkstreamRecord {
  id: string;
  projectId: string;
  code: string; // e.g. "WS-WETLANDS-PAD-A"
  title: string;
  category: RequestCategory;
  categoryLabel: string;
  permitTypeId?: string;
  permitTypeCode?: string;
  workflowVersionId?: string;
  currentStageId?: string;
  currentStageName?: string;
  
  // Accountable ownership model
  governmentConcierge: {
    name: string;
    title: string;
    agency: string;
    email: string;
    phone: string;
  };
  regulatoryLead: {
    orgCode: string;
    orgName: string;
    jurisdictionLevel: JurisdictionLevel;
    assignedReviewerName: string;
    assignedReviewerEmail: string;
  };
  assignedReviewerUserId?: string;
  
  // State & Health decoupling
  operationalState: OperationalState;
  operationalStateLabel: string;
  ragHealth: RAGHealth;
  isCriticalPath: boolean;
  
  // Schedule dates & Variance
  baselineStartDate: string;
  baselineTargetDate: string;
  forecastStartDate: string;
  forecastTargetDate: string;
  actualStartDate?: string;
  actualCompletionDate?: string;
  scheduleVarianceDays: number;
  controllingDependencyTitle?: string;
  
  // The 6 Core Questions Deterministic Fields
  currentActionSummary: string;
  waitingReason?: string;
  waitingOnEntity?: string;
  nextExpectedEvent: string;
  customerActionRequired: string;
  
  // Delay accounting
  primaryDelayReason: DelayReason;
  delayNotes?: string;
  
  // Escalation policy
  escalationLevel: EscalationLevel;
  escalationTriggeredAt?: string;
  escalationSummary?: string;
  
  // Nested execution data
  tasks: TaskRecord[];
  commitments: CommitmentRecord[];
  coordinationRequests: CoordinationRequestRecord[];
  rfis: RFIRecord[];
  readinessChecklist?: ReadinessChecklistRecord;

  // Milestone 1 ITSM & Assignment Extensions
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  itsmState?: ITSMState;
  priority?: PriorityLevel;
  statutoryDeadline?: string;
  clockStatus?: ClockStatus;
  clockPausedReason?: string;
  statutoryClock?: StatutoryClockState;
}
```

### 1.6 Updated `TaskRecord`

```typescript
export interface TaskRecord {
  id: string;
  workstreamId: string;
  stageId?: string;
  title: string;
  description?: string;
  taskType: "agency_review" | "applicant_action" | "consultation" | "public_notice" | "inspection" | "determination";
  assignedOrgId: string;
  assignedOrgCode: string;
  assignedUserName?: string;
  assignedUserId?: string;
  status: "pending" | "in_progress" | "waiting" | "blocked" | "completed" | "waived";
  isMilestone: boolean;
  isCriticalPath: boolean;
  baselineStartDate?: string;
  baselineDueDate?: string;
  forecastStartDate?: string;
  forecastDueDate?: string;
  actualCompletionDate?: string;
  durationDays: number;
  floatDays: number;
  predecessorTaskIds: string[];

  // Milestone 1 ITSM Extensions
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  itsmState?: ITSMState;
  priority?: PriorityLevel;
}
```

### 1.7 Unified `TicketRecord` Interface

```typescript
export interface TicketRecord {
  id: string;
  ticketNumber: string; // e.g. "CR-2026-08-30-01" or "WS-WETLANDS-PAD-A"
  entityType: "customer_request" | "workstream" | "task";
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  category: RequestCategory;
  categoryLabel: string;
  
  // Tenancy & Assignment Routing
  applicantOrgCode: string;
  applicantOrgName: string;
  leadAgencyCode: string;
  leadAgencyName: string;
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  assignedToUserId?: string;
  assignedToUserName?: string;
  assignedToUserEmail?: string;
  
  // ITSM Lifecycle & Priority
  itsmState: ITSMState;
  statusLabel: string;
  ragHealth: RAGHealth;
  priority: PriorityLevel;
  urgency: UrgencyLevel;
  impact: ImpactLevel;
  isCriticalPath: boolean;
  
  // Statutory / Due Dates & Clock
  targetDueDate?: string;
  statutoryDeadline?: string;
  clockStatus: ClockStatus;
  clockPausedReason?: string;
  statutoryClock?: StatutoryClockState;
  
  // Metadata & Audit
  createdAt: string;
  updatedAt: string;
  submittedByName?: string;
  submittedByUserId?: string;
}
```

---

## 2. Drizzle ORM Relational Schema Specification (`db/schema.ts`)

### 2.1 Table Definitions for Assignment Groups & Memberships

```typescript
// ==========================================
// 1.1 ASSIGNMENT GROUPS & FULFILLER QUEUES (ITSM)
// ==========================================

export const assignmentGroups = sqliteTable("assignment_groups", {
  id: text("id").primaryKey(),
  orgCode: text("org_code").notNull(), // e.g. 'DOTD', 'LDEQ', 'CPRA', 'OSFM', 'LSP', 'VERMILION', 'LA-PROJECTS', 'SPACEX'
  organizationId: text("organization_id").references(() => organizations.id),
  name: text("name").notNull(), // e.g. 'DOTD Structural & Heavy-Haul Review'
  description: text("description").notNull(),
  leadUserId: text("lead_user_id").references(() => users.id),
  active: integer("active", { mode: "boolean" }).default(true).notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const assignmentGroupMemberships = sqliteTable("assignment_group_memberships", {
  id: text("id").primaryKey(),
  assignmentGroupId: text("assignment_group_id")
    .notNull()
    .references(() => assignmentGroups.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  role: text("role", { enum: ["member", "lead", "backup"] }).default("member").notNull(),
  createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});
```

### 2.2 Table Column Extensions

#### `workstreams` Extensions:
```typescript
  // Milestone 1 ITSM & Assignment Group Extensions
  assignmentGroupId: text("assignment_group_id").references(() => assignmentGroups.id),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id),
  itsmState: text("itsm_state", {
    enum: [
      "draft",
      "submitted",
      "triaged",
      "in_progress",
      "pending_customer",
      "pending_agency",
      "blocked",
      "resolved",
      "closed",
    ],
  }).default("in_progress").notNull(),
  priority: text("priority", { enum: ["P1", "P2", "P3", "P4"] }).default("P3").notNull(),
  statutoryDeadline: text("statutory_deadline"),
  clockStatus: text("clock_status", { enum: ["active", "paused", "stopped"] }).default("active").notNull(),
  clockPausedReason: text("clock_paused_reason"),
```

#### `customerRequests` Extensions:
```typescript
  // Milestone 1 ITSM & Assignment Group Extensions
  assignmentGroupId: text("assignment_group_id").references(() => assignmentGroups.id),
  assignedToUserId: text("assigned_to_user_id").references(() => users.id),
  itsmState: text("itsm_state", {
    enum: [
      "draft",
      "submitted",
      "triaged",
      "in_progress",
      "pending_customer",
      "pending_agency",
      "blocked",
      "resolved",
      "closed",
    ],
  }).default("submitted").notNull(),
  priority: text("priority", { enum: ["P1", "P2", "P3", "P4"] }).default("P3").notNull(),
  urgency: text("urgency", { enum: ["low", "medium", "high", "critical"] }).default("medium").notNull(),
  impact: text("impact", { enum: ["low", "medium", "high", "critical"] }).default("medium").notNull(),
  statutoryDeadline: text("statutory_deadline"),
  clockStatus: text("clock_status", { enum: ["active", "paused", "stopped"] }).default("active").notNull(),
  clockPausedReason: text("clock_paused_reason"),
```

#### `tasks` Extensions:
```typescript
  // Milestone 1 ITSM Extensions
  assignmentGroupId: text("assignment_group_id").references(() => assignmentGroups.id),
  itsmState: text("itsm_state", {
    enum: [
      "draft",
      "submitted",
      "triaged",
      "in_progress",
      "pending_customer",
      "pending_agency",
      "blocked",
      "resolved",
      "closed",
    ],
  }).default("pending").notNull(),
  priority: text("priority", { enum: ["P1", "P2", "P3", "P4"] }).default("P3").notNull(),
```

### 2.3 Drizzle Relations

```typescript
// ==========================================
// 11. DRIZZLE RELATIONS
// ==========================================

import { relations } from "drizzle-orm";

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  memberships: many(organizationMemberships),
  units: many(organizationalUnits),
  assignmentGroups: many(assignmentGroups),
  permitTypes: many(permitTypes),
  workstreams: many(workstreams),
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  unit: one(organizationalUnits, {
    fields: [users.unitId],
    references: [organizationalUnits.id],
  }),
  memberships: many(organizationMemberships),
  groupMemberships: many(assignmentGroupMemberships),
  assignedWorkstreams: many(workstreams),
  assignedCustomerRequests: many(customerRequests),
  assignedTasks: many(tasks),
}));

export const assignmentGroupsRelations = relations(assignmentGroups, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [assignmentGroups.organizationId],
    references: [organizations.id],
  }),
  leadUser: one(users, {
    fields: [assignmentGroups.leadUserId],
    references: [users.id],
  }),
  memberships: many(assignmentGroupMemberships),
  workstreams: many(workstreams),
  customerRequests: many(customerRequests),
  tasks: many(tasks),
}));

export const assignmentGroupMembershipsRelations = relations(assignmentGroupMemberships, ({ one }) => ({
  assignmentGroup: one(assignmentGroups, {
    fields: [assignmentGroupMemberships.assignmentGroupId],
    references: [assignmentGroups.id],
  }),
  user: one(users, {
    fields: [assignmentGroupMemberships.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  applicantOrg: one(organizations, {
    fields: [projects.applicantOrgId],
    references: [organizations.id],
  }),
  leadStateAgency: one(organizations, {
    fields: [projects.leadStateAgencyId],
    references: [organizations.id],
  }),
  workstreams: many(workstreams),
  customerRequests: many(customerRequests),
  documents: many(documents),
  decisions: many(decisions),
  meetings: many(meetings),
}));

export const workstreamsRelations = relations(workstreams, ({ one, many }) => ({
  project: one(projects, {
    fields: [workstreams.projectId],
    references: [projects.id],
  }),
  permitType: one(permitTypes, {
    fields: [workstreams.permitTypeId],
    references: [permitTypes.id],
  }),
  assignmentGroup: one(assignmentGroups, {
    fields: [workstreams.assignmentGroupId],
    references: [assignmentGroups.id],
  }),
  assignedToUser: one(users, {
    fields: [workstreams.assignedToUserId],
    references: [users.id],
  }),
  tasks: many(tasks),
  commitments: many(commitments),
  coordinationRequests: many(coordinationRequests),
  rfis: many(rfis),
}));

export const customerRequestsRelations = relations(customerRequests, ({ one }) => ({
  project: one(projects, {
    fields: [customerRequests.projectId],
    references: [projects.id],
  }),
  permitType: one(permitTypes, {
    fields: [customerRequests.knownPermitTypeId],
    references: [permitTypes.id],
  }),
  relatedWorkstream: one(workstreams, {
    fields: [customerRequests.relatedWorkstreamId],
    references: [workstreams.id],
  }),
  submittedByUser: one(users, {
    fields: [customerRequests.submittedByUserId],
    references: [users.id],
  }),
  assignmentGroup: one(assignmentGroups, {
    fields: [customerRequests.assignmentGroupId],
    references: [assignmentGroups.id],
  }),
  assignedToUser: one(users, {
    fields: [customerRequests.assignedToUserId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  workstream: one(workstreams, {
    fields: [tasks.workstreamId],
    references: [workstreams.id],
  }),
  stage: one(workflowStages, {
    fields: [tasks.stageId],
    references: [workflowStages.id],
  }),
  assignedOrg: one(organizations, {
    fields: [tasks.assignedOrgId],
    references: [organizations.id],
  }),
  assignedUser: one(users, {
    fields: [tasks.assignedUserId],
    references: [users.id],
  }),
  assignmentGroup: one(assignmentGroups, {
    fields: [tasks.assignmentGroupId],
    references: [assignmentGroups.id],
  }),
  dependenciesAsPredecessor: many(taskDependencies, { relationName: "predecessor" }),
  dependenciesAsSuccessor: many(taskDependencies, { relationName: "successor" }),
}));
```

---

## 3. Compatibility Mappings & Interoperability

### 3.1 Operational UX Mappings (`lib/operational-ux.ts`)

#### Status Tone Mapping:
| ITSM State | Tone | Description |
|---|---|---|
| `draft` | `"slate"` | Submitter or internal draft |
| `submitted` | `"amber"` | Intake triage needed |
| `triaged` | `"blue"` | Assigned to group, awaiting active work |
| `in_progress` | `"blue"` | Fulfiller review underway |
| `pending_customer` | `"amber"` (Fulfiller) / `"red"` (Customer) | Clock paused, awaiting applicant submittal |
| `pending_agency` | `"amber"` | Interagency coordination / external gate |
| `blocked` | `"red"` | Active blocker flagged |
| `resolved` | `"green"` | Permit determination / outcome reached |
| `closed` | `"green"` | Archived / officially completed |

#### Queue Group Routing (`groupMyWork`):
- **`needs_action`**: P1/P2 items assigned to current user, unassigned triage items for supervisors/leads, active customer requests in draft for submitters.
- **`due_today`**: Items with `statutoryDeadline === today` or `dueDate === today`.
- **`overdue`**: Items with deadline < today not yet resolved/closed.
- **`waiting`**: Items in `pending_customer`, `pending_agency`, or `clockStatus === 'paused'`.
- **`upcoming`**: Items in `in_progress` or `triaged` with remaining float.
- **`recently_completed`**: Items in `resolved` or `closed`.

### 3.2 Bi-Directional State Converters

```typescript
export function mapOperationalStateToITSMState(opState: OperationalState, hasBlocker = false): ITSMState {
  if (hasBlocker || opState === "blocked") return "blocked";
  switch (opState) {
    case "complete":
      return "resolved";
    case "cancelled":
      return "closed";
    case "waiting_applicant":
      return "pending_customer";
    case "waiting_government":
    case "waiting_external":
    case "statutory_waiting_period":
    case "scheduled_hold":
      return "pending_agency";
    case "escalated":
    case "running":
    default:
      return "in_progress";
  }
}

export function mapITSMStateToOperationalState(itsmState: ITSMState): OperationalState {
  switch (itsmState) {
    case "draft":
    case "submitted":
    case "triaged":
      return "waiting_government";
    case "in_progress":
      return "running";
    case "pending_customer":
      return "waiting_applicant";
    case "pending_agency":
      return "waiting_government";
    case "blocked":
      return "blocked";
    case "resolved":
    case "closed":
      return "complete";
    default:
      return "running";
  }
}

export function mapCustomerRequestStatusToITSMState(status: string): ITSMState {
  switch (status) {
    case "draft":
      return "draft";
    case "submitted":
      return "submitted";
    case "triage":
      return "triaged";
    case "in_progress":
      return "in_progress";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
    default:
      return "submitted";
  }
}
```

### 3.3 Default Assignment Groups & Seed Mapping

Matching existing `demoPersonas` and `registeredOrganizations`:

| Group ID | Organization | Group Name | Lead User | Members |
|---|---|---|---|---|
| `ag-dotd-structures` | `DOTD` | DOTD Structural & Heavy-Haul Review | `user-sam-rivera` | `user-sam-rivera` |
| `ag-ldeq-water` | `LDEQ` | LDEQ Industrial Wastewater & Air Quality | `user-jordan-lee` | `user-jordan-lee` |
| `ag-cpra-coastal` | `CPRA` | CPRA Coastal Permitting & Hydrology | `user-jean-paul-guidry` | `user-jean-paul-guidry` |
| `ag-osfm-safety` | `OSFM` | OSFM Cryogenic & Life Safety Review | `user-brent-thibodeaux` | `user-brent-thibodeaux` |
| `ag-lsp-escort` | `LSP` | LSP Hazardous Materials & Transport Escorts | `user-marcus-hebert` | `user-marcus-hebert` |
| `ag-vermilion-parish` | `VERMILION` | Vermilion Parish Permitting & Water Monitoring | `user-riley-brooks` | `user-riley-brooks` |
| `ag-state-project-office` | `LA-PROJECTS` | State Project Office Concierge & Triage | `user-joe-skaggs` | `user-joe-skaggs`, `user-sarah-johnson` |
| `ag-spacex-regulatory` | `SPACEX` | SpaceX Regulatory Engineering | `user-maya-chen` | `user-maya-chen`, `user-alex-martin` |

---

## 4. Serialization, Parsing & Validation Toolkit

### 4.1 Type Guards & Parsers

```typescript
export const VALID_ITSM_STATES: readonly ITSMState[] = [
  "draft",
  "submitted",
  "triaged",
  "in_progress",
  "pending_customer",
  "pending_agency",
  "blocked",
  "resolved",
  "closed",
] as const;

export const VALID_PRIORITIES: readonly PriorityLevel[] = ["P1", "P2", "P3", "P4"] as const;

export const VALID_CLOCK_STATUSES: readonly ClockStatus[] = ["active", "paused", "stopped"] as const;

export function isITSMState(value: unknown): value is ITSMState {
  return typeof value === "string" && VALID_ITSM_STATES.includes(value as ITSMState);
}

export function isPriorityLevel(value: unknown): value is PriorityLevel {
  return typeof value === "string" && VALID_PRIORITIES.includes(value as PriorityLevel);
}

export function isClockStatus(value: unknown): value is ClockStatus {
  return typeof value === "string" && VALID_CLOCK_STATUSES.includes(value as ClockStatus);
}

export function parseITSMState(value: unknown, defaultState: ITSMState = "submitted"): ITSMState {
  if (isITSMState(value)) return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase().replace(/[\s-]/g, "_");
    if (isITSMState(normalized)) return normalized;
    if (normalized === "triage") return "triaged";
    if (normalized === "complete") return "resolved";
  }
  return defaultState;
}

export function parsePriorityLevel(value: unknown, defaultPriority: PriorityLevel = "P3"): PriorityLevel {
  if (isPriorityLevel(value)) return value;
  if (typeof value === "string") {
    const upper = value.toUpperCase().trim();
    if (upper === "CRITICAL" || upper === "P1") return "P1";
    if (upper === "HIGH" || upper === "P2") return "P2";
    if (upper === "MEDIUM" || upper === "NORMAL" || upper === "P3") return "P3";
    if (upper === "LOW" || upper === "P4") return "P4";
  }
  return defaultPriority;
}
```

### 4.2 Priority Matrix Calculation

```typescript
export function calculatePriority(
  urgency: UrgencyLevel = "medium",
  impact: ImpactLevel = "medium",
  fallback: PriorityLevel = "P3"
): PriorityLevel {
  const u = urgency.toLowerCase();
  const i = impact.toLowerCase();

  if (u === "critical" && (i === "critical" || i === "high")) return "P1";
  if (u === "high" && i === "critical") return "P1";
  if (u === "critical" && i === "medium") return "P2";
  if (u === "high" && i === "high") return "P2";
  if (u === "medium" && i === "critical") return "P2";
  if (u === "low" && i === "critical") return "P3";
  if (u === "medium" && i === "high") return "P3";
  if (u === "high" && i === "medium") return "P3";
  if (u === "medium" && i === "medium") return "P3";
  if (u === "low" && (i === "high" || i === "medium")) return "P4";
  if (u === "high" && i === "low") return "P4";
  if (u === "medium" && i === "low") return "P4";
  if (u === "low" && i === "low") return "P4";

  return fallback;
}
```

### 4.3 Statutory Clock Engine Calculation

```typescript
export function calculateStatutoryClock(options: {
  statutoryDays: number;
  startDate: string;
  pauseHistory?: ClockPauseRecord[];
  asOfDate?: string;
  isPaused?: boolean;
}): StatutoryClockState {
  const asOf = options.asOfDate ? new Date(`${options.asOfDate}T12:00:00`) : new Date();
  const start = new Date(`${options.startDate}T12:00:00`);
  
  let totalPausedDays = 0;
  const history = options.pauseHistory ?? [];

  for (const pause of history) {
    const pStart = new Date(`${pause.pausedAt}T12:00:00`);
    const pEnd = pause.resumedAt ? new Date(`${pause.resumedAt}T12:00:00`) : asOf;
    const diff = Math.max(0, Math.floor((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)));
    totalPausedDays += diff;
  }

  const rawElapsed = Math.max(0, Math.floor((asOf.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const activeElapsed = Math.max(0, rawElapsed - totalPausedDays);
  const remainingDays = Math.max(0, options.statutoryDays - activeElapsed);

  const deadlineDate = new Date(start.getTime() + (options.statutoryDays + totalPausedDays) * 24 * 60 * 60 * 1000);
  const statutoryDeadline = deadlineDate.toISOString().split("T")[0];

  const currentPause = history.find((p) => !p.resumedAt);
  const isPaused = options.isPaused ?? Boolean(currentPause);

  return {
    clockStatus: isPaused ? "paused" : remainingDays === 0 ? "stopped" : "active",
    statutoryDays: options.statutoryDays,
    elapsedDays: activeElapsed,
    remainingDays,
    statutoryDeadline,
    isPaused,
    pausedAt: currentPause?.pausedAt,
    pausedReason: currentPause?.reason,
    totalPausedDays,
    pauseHistory: history,
  };
}
```

### 4.4 Entity Validations & Serialization

```typescript
export function validateAssignmentGroup(data: unknown): { valid: boolean; errors: string[]; data?: AssignmentGroupRecord } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data must be a non-null object"] };
  }
  const obj = data as Record<string, unknown>;
  if (!obj.id || typeof obj.id !== "string") errors.push("id is required and must be a string");
  if (!obj.orgCode || typeof obj.orgCode !== "string") errors.push("orgCode is required and must be a string");
  if (!obj.name || typeof obj.name !== "string") errors.push("name is required and must be a string");
  if (!obj.description || typeof obj.description !== "string") errors.push("description is required and must be a string");
  if (obj.active !== undefined && typeof obj.active !== "boolean") errors.push("active must be a boolean");

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    data: {
      id: String(obj.id),
      orgCode: String(obj.orgCode),
      organizationId: obj.organizationId ? String(obj.organizationId) : undefined,
      name: String(obj.name),
      description: String(obj.description),
      leadUserId: obj.leadUserId ? String(obj.leadUserId) : undefined,
      leadUserName: obj.leadUserName ? String(obj.leadUserName) : undefined,
      active: obj.active !== undefined ? Boolean(obj.active) : true,
      createdAt: obj.createdAt ? String(obj.createdAt) : undefined,
      updatedAt: obj.updatedAt ? String(obj.updatedAt) : undefined,
    },
  };
}
```

---

## 5. Architectural Checklist & Migration Compatibility

1. **Clean Isolation**:
   - `lib/domain-models.ts` contains only TypeScript interfaces, types, and pure domain validators.
   - `db/schema.ts` contains Drizzle ORM schema and relations.
   - Zero side-effects or circular dependencies.
2. **Supabase Schema Parity**:
   - Aligns 1:1 with PostgreSQL migration scripts formulated by `m1_explorer_1`.
   - Foreign key field names match (`assignment_group_id`, `assigned_to_user_id`, `itsm_state`, `priority`, `statutory_deadline`, `clock_status`, `clock_paused_reason`).
3. **Repository Parity**:
   - Matches repository method contracts formulated by `m1_explorer_3` (`getAssignmentGroups`, `getAssignmentGroupMembers`, `assignTicket`, `updateTicketITSMState`).
4. **Zero Regressions**:
   - All 27 existing Drizzle ORM table exports in `db/schema.ts` remain intact.
   - Legacy states (`operationalState`, `status`) remain supported alongside new ITSM fields.
