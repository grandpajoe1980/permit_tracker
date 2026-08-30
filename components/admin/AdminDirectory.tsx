"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ProjectParticipantRecord, UserProfileRecord } from "@/lib/domain-models";
import type { RoleId, RoleDefinition, TeamUser } from "@/lib/demo-data";

type AdminRepository = {
  getProfileByUserId: (userId: string) => UserProfileRecord | undefined;
  getParticipants: () => ProjectParticipantRecord[];
  updateProfilePersisted: (params: {
    userId: string;
    updates: Partial<Pick<UserProfileRecord, "organizationName" | "displayTitle" | "organizationalUnit" | "projectRole" | "workEmail" | "isCustomerVisible" | "isActive">>;
    actorUserId: string;
    isAdmin?: boolean;
  }) => Promise<{ data: UserProfileRecord | null; error: Error | null }>;
  updateParticipantPersisted: (params: {
    participantId: string;
    updates: Partial<Pick<ProjectParticipantRecord, "workstreamIds" | "visibilityScope" | "isActive">>;
    actorUserId: string;
    isAdmin?: boolean;
  }) => Promise<{ data: ProjectParticipantRecord | null; error: Error | null }>;
};

const fieldClass = "mt-1 h-9 text-xs";

export function AdminDirectory({
  teamUsers,
  roleDefinitions,
  repository,
  actorUserId,
  onRoleChange,
  onMutation,
}: {
  teamUsers: TeamUser[];
  roleDefinitions: Record<RoleId, RoleDefinition>;
  repository: AdminRepository;
  actorUserId: string;
  onRoleChange: (userId: string, roleId: RoleId) => void;
  onMutation: (message: string) => void;
}) {
  async function updateProfile(user: TeamUser, updates: Partial<Pick<UserProfileRecord, "organizationName" | "displayTitle" | "organizationalUnit" | "projectRole" | "workEmail" | "isCustomerVisible" | "isActive">>) {
    const result = await repository.updateProfilePersisted({ userId: user.id, actorUserId, updates, isAdmin: true });
    if (result.error || !result.data) return;
    onMutation(`${user.name}'s profile was updated.`);
  }

  async function updateParticipant(user: TeamUser, updates: Partial<Pick<ProjectParticipantRecord, "workstreamIds" | "visibilityScope" | "isActive">>) {
    const participant = repository.getParticipants().find((entry) => entry.userId === user.id);
    if (!participant) return;
    const result = await repository.updateParticipantPersisted({ participantId: participant.id, actorUserId, updates, isAdmin: true });
    if (result.error || !result.data) return;
    onMutation(`${user.name}'s project access was updated.`);
  }

  return <div className="space-y-3">
    {teamUsers.map((user) => {
      const profile = repository.getProfileByUserId(user.id);
      const participant = repository.getParticipants().find((entry) => entry.userId === user.id);
      return <div key={user.id} className="rounded-lg border border-slate-200 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-[#00284d]">{user.name} {user.name === "Joe Skaggs" && <Badge className="ml-1 bg-amber-100 text-[10px] uppercase text-amber-900">Space Czar</Badge>}</p>
            <p className="text-xs text-slate-500">{profile?.workEmail ?? user.workEmail ?? user.email}</p>
          </div>
          <select aria-label={`Role for ${user.name}`} value={user.roleId} onChange={(event) => onRoleChange(user.id, event.target.value as RoleId)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800">
            {(Object.keys(roleDefinitions) as RoleId[]).map((role) => <option key={role} value={role}>{roleDefinitions[role].name}</option>)}
          </select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-[11px] font-bold text-slate-600">Display title<Input aria-label={`Display title for ${user.name}`} defaultValue={profile?.displayTitle ?? user.displayTitle ?? ""} className={fieldClass} onBlur={(event) => updateProfile(user, { displayTitle: event.target.value })} /></label>
          <label className="text-[11px] font-bold text-slate-600">Organization<Input aria-label={`Organization for ${user.name}`} defaultValue={profile?.organizationName ?? user.organization} className={fieldClass} onBlur={(event) => updateProfile(user, { organizationName: event.target.value })} /></label>
          <label className="text-[11px] font-bold text-slate-600">Unit / office<Input aria-label={`Unit for ${user.name}`} defaultValue={profile?.organizationalUnit ?? user.organizationalUnit ?? user.agency} className={fieldClass} onBlur={(event) => updateProfile(user, { organizationalUnit: event.target.value })} /></label>
          <label className="text-[11px] font-bold text-slate-600">Project role<Input aria-label={`Project role for ${user.name}`} defaultValue={profile?.projectRole ?? ""} className={fieldClass} onBlur={(event) => updateProfile(user, { projectRole: event.target.value })} /></label>
        </div>
        {participant && <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <label className="text-[11px] font-bold text-slate-600">Assigned workstreams<Input aria-label={`Workstreams for ${user.name}`} defaultValue={participant.workstreamIds.join(", ")} className={fieldClass} onBlur={(event) => updateParticipant(user, { workstreamIds: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label>
          <label className="text-[11px] font-bold text-slate-600">Visibility<select aria-label={`Visibility for ${user.name}`} defaultValue={participant.visibilityScope} onChange={(event) => updateParticipant(user, { visibilityScope: event.target.value as ProjectParticipantRecord["visibilityScope"] })} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="project">Project</option><option value="agency">Agency</option><option value="customer">Customer-safe</option><option value="admin">Admin-only</option></select></label>
          <label className="flex items-center gap-2 pt-5 text-xs font-bold text-slate-700"><input type="checkbox" aria-label={`Active project participant for ${user.name}`} checked={participant.isActive} onChange={(event) => updateParticipant(user, { isActive: event.target.checked })} className="size-4 accent-teal-700" /> Active project participant</label>
        </div>}
      </div>;
    })}
  </div>;
}
