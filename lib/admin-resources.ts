/** Explicit read-only explorer scope. No caller-controlled table names. */
export const ADMIN_RESOURCES = {
  projects: "Projects",
  customer_requests: "Customer requests",
  requests: "Permit cases",
  workstreams: "Workstreams",
  tasks: "Tasks",
  rfis: "Requests for information",
  coordination_requests: "Coordination requests",
  commitments: "Commitments",
  decisions: "Decisions",
  meetings: "Meetings",
  documents: "Documents",
  external_filings: "External filings",
  user_profiles: "People",
  organization_memberships: "Organization access",
  organizations: "Agencies & organizations",
  assignment_groups: "Teams & assignment groups",
  assignment_group_memberships: "Team members",
  workflow_versions: "Workflow versions",
  permit_types: "Permit catalog",
  audit_events: "Audit history (read only)",
} as const;

export type AdminResource = keyof typeof ADMIN_RESOURCES;
export function isAdminResource(value: string): value is AdminResource {
  return Object.prototype.hasOwnProperty.call(ADMIN_RESOURCES, value);
}
