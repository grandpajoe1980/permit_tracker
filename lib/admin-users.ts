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
  return memberships
    .filter((membership) => membership.status === "active")
    .map((membership) => {
      const profile = profiles.find((entry) => entry.userId === membership.userId);
      const organization = organizations.find((entry) => entry.id === membership.organizationId);
      const roleId = roleIdForMembership(membership.role);
      return {
        id: membership.userId,
        name: profile?.fullName ?? "PATH user",
        email: profile?.workEmail ?? "",
        roleId,
        organizationId: membership.organizationId,
        organization: profile?.organizationName ?? organization?.name ?? "PATH organization",
        agency: profile?.organizationalUnit ?? organization?.code ?? "",
        permissions: roleDefinitions[roleId].defaultPermissions,
        displayTitle: profile?.displayTitle,
        organizationalUnit: profile?.organizationalUnit,
        workEmail: profile?.workEmail,
        phone: profile?.officePhone,
      };
    });
}

export function membershipRoleForRoleId(roleId: RoleId): OrganizationMembershipRecord["role"] {
  if (roleId === "admin") return "organization_admin";
  if (roleId === "reviewer") return "supervisor";
  return "contributor";
}
