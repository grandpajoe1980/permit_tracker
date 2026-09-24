import type { ExternalFilingRecord, OrganizationMembershipRecord, OrganizationRecord } from "./domain-models";

function activeMembershipsForUser(memberships: OrganizationMembershipRecord[], userId: string, now: Date) {
  return memberships.filter((membership) =>
    membership.userId === userId
    && membership.status === "active"
    && new Date(membership.effectiveFrom).getTime() <= now.getTime()
    && (!membership.effectiveTo || new Date(membership.effectiveTo).getTime() > now.getTime())
  );
}

/** UI affordance only; the verification RPC repeats every authorization check. */
export function canVerifyExternalFiling(
  filing: ExternalFilingRecord,
  memberships: OrganizationMembershipRecord[],
  organizations: OrganizationRecord[],
  userId: string,
  now = new Date(),
): boolean {
  const active = activeMembershipsForUser(memberships, userId, now);
  if (active.some((membership) => membership.role === "system_admin")) return true;

  const authorityRef = filing.authorityOrganizationId.trim().toUpperCase();
  const authorityCode = authorityRef.replace(/^ORG-/, "");
  const authority = organizations.find((organization) =>
    organization.id.toUpperCase() === authorityRef
    || organization.code.toUpperCase() === authorityRef
    || organization.code.toUpperCase() === authorityCode
  );
  return Boolean(authority && active.some((membership) =>
    membership.role === "organization_admin" && membership.organizationId === authority.id
  ));
}
