import type { OrganizationMembershipRecord, OrganizationRecord, UserProfileRecord } from "./domain-models";
import { roleDefinitions, type RoleId, type TeamUser } from "./demo-data";

function roleIdForMembership(role: OrganizationMembershipRecord["role"]): RoleId {
  if (role === "organization_admin" || role === "system_admin") return "admin";
  if (role === "supervisor") return "reviewer";
  return "viewer";
}

export function teamUsersFromMemberships(
  profiles: UserProfileRecord[],
  memberships: OrganizationMembershipRecord[],
  organizations: OrganizationRecord[],
): TeamUser[] {
  const activeMemberships = memberships.filter((membership) => membership.status === "active");
  const roleRank: Record<OrganizationMembershipRecord["role"], number> = { contributor: 1, supervisor: 2, organization_admin: 3, system_admin: 4 };
  return profiles
    .map((profile) => {
      const membership = activeMemberships.filter((entry) => entry.userId === profile.userId).sort((left, right) => roleRank[right.role] - roleRank[left.role])[0];
      const organization = organizations.find((entry) => entry.id === membership?.organizationId || entry.id === profile.organizationId);
      const roleId = membership ? roleIdForMembership(membership.role) : "viewer";
      return {
        id: profile.userId,
        name: profile.fullName || "PATH user",
        email: profile.workEmail ?? "",
        roleId,
        organizationId: membership?.organizationId,
        organization: profile.organizationName ?? organization?.name ?? "PATH organization",
        agency: profile.organizationalUnit ?? organization?.code ?? "",
        permissions: roleDefinitions[roleId].defaultPermissions,
        displayTitle: profile.displayTitle,
        organizationalUnit: profile.organizationalUnit,
        workEmail: profile.workEmail,
        phone: profile.officePhone,
      };
    });
}

export function membershipRoleForRoleId(roleId: RoleId): OrganizationMembershipRecord["role"] {
  if (roleId === "admin") return "organization_admin";
  if (roleId === "reviewer") return "supervisor";
  return "contributor";
}
