"use client";

import React from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AssignmentGroupMembershipRecord, AssignmentGroupRecord, ProjectParticipantRecord, UserProfileRecord } from "@/lib/domain-models";
import type { RoleId, RoleDefinition, TeamUser } from "@/lib/demo-data";

type AdminRepository = {
  getProfileByUserId: (userId: string) => UserProfileRecord | undefined;
  getParticipants: () => ProjectParticipantRecord[];
  getAssignmentGroups: () => AssignmentGroupRecord[];
  getAssignmentGroupMemberships: (groupId?: string) => AssignmentGroupMembershipRecord[];
  manageAssignmentGroupPersisted: (params: { action: "create" | "update" | "deactivate"; id?: string; orgCode?: string; name?: string; description?: string; leadUserId?: string; active?: boolean; actorUserId?: string }) => Promise<{ data: AssignmentGroupRecord | null; error: Error | null }>;
  manageAssignmentGroupMembershipPersisted: (params: { action: "upsert" | "delete"; assignmentGroupId: string; userId: string; role?: AssignmentGroupMembershipRecord["role"] }) => Promise<{ data: AssignmentGroupMembershipRecord | null; error: Error | null }>;
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
  onRoleChange: (userId: string, roleId: RoleId) => void | Promise<void>;
  onMutation: (message: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [groupQuery, setGroupQuery] = React.useState("");
  const [selectedGroupId, setSelectedGroupId] = React.useState("");
  const [newGroup, setNewGroup] = React.useState({ name: "", orgCode: "", description: "" });
  const [memberUserId, setMemberUserId] = React.useState("");
  const [memberRole, setMemberRole] = React.useState<AssignmentGroupMembershipRecord["role"]>("member");
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

  async function createGroup() {
    const result = await repository.manageAssignmentGroupPersisted({ action: "create", ...newGroup, actorUserId });
    if (result.error || !result.data) return onMutation(result.error?.message ?? "Team could not be created.");
    setNewGroup({ name: "", orgCode: "", description: "" });
    setSelectedGroupId(result.data.id);
    onMutation(`${result.data.name} was created.`);
  }

  async function saveGroup(group: AssignmentGroupRecord, updates: Partial<Pick<AssignmentGroupRecord, "name" | "description" | "leadUserId" | "active">>) {
    const result = await repository.manageAssignmentGroupPersisted({ action: updates.active === false ? "deactivate" : "update", id: group.id, actorUserId, ...updates });
    onMutation(result.error ? result.error.message : `${group.name} was updated.`);
  }

  async function saveMembership() {
    if (!selectedGroupId || !memberUserId) return;
    const result = await repository.manageAssignmentGroupMembershipPersisted({ action: "upsert", assignmentGroupId: selectedGroupId, userId: memberUserId, role: memberRole });
    if (!result.error) setMemberUserId("");
    onMutation(result.error ? result.error.message : "Team membership was saved.");
  }

  async function removeMembership(groupId: string, userId: string) {
    const result = await repository.manageAssignmentGroupMembershipPersisted({ action: "delete", assignmentGroupId: groupId, userId });
    onMutation(result.error ? result.error.message : "Team membership was removed.");
  }

  const filteredUsers = teamUsers.filter((user) => `${user.name} ${user.email} ${user.organization} ${user.agency}`.toLowerCase().includes(query.trim().toLowerCase()));
  const assignmentGroups = repository.getAssignmentGroups();
  const filteredGroups = assignmentGroups.filter((group) => `${group.name} ${group.orgCode} ${group.description} ${group.leadUserName ?? ""}`.toLowerCase().includes(groupQuery.trim().toLowerCase()));
  const selectedGroup = assignmentGroups.find((group) => group.id === selectedGroupId) ?? filteredGroups[0];
  const selectedMembers = selectedGroup ? repository.getAssignmentGroupMemberships(selectedGroup.id) : [];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-sm font-black text-[#00284d]">People and access</p><p className="mt-1 text-xs text-slate-600">{teamUsers.length} visible user profile{teamUsers.length === 1 ? "" : "s"} · includes people without an active organization role.</p></div><Input aria-label="Search people and access" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, agency, or email" className="max-w-sm bg-white" /></div>
    {filteredUsers.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No people match that search.</p>}
    {filteredUsers.map((user) => {
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
    <section className="border-t border-slate-200 pt-6" aria-labelledby="assignment-groups-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black text-[#00284d]" id="assignment-groups-heading">Teams & assignment groups</p><p className="mt-1 text-xs text-slate-600">Set queue ownership, leads, and the people eligible to receive work.</p></div><Input aria-label="Search teams and assignment groups" value={groupQuery} onChange={(event) => setGroupQuery(event.target.value)} placeholder="Search teams, agencies, or leads" className="max-w-sm bg-white" /></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2"><Input aria-label="New team name" value={newGroup.name} onChange={(event) => setNewGroup((current) => ({ ...current, name: event.target.value }))} placeholder="New team name" /><Input aria-label="New team organization code" value={newGroup.orgCode} onChange={(event) => setNewGroup((current) => ({ ...current, orgCode: event.target.value.toUpperCase() }))} placeholder="Agency code, e.g. DOTD" /></div>
          <div className="flex gap-2"><Input aria-label="New team description" value={newGroup.description} onChange={(event) => setNewGroup((current) => ({ ...current, description: event.target.value }))} placeholder="What does this queue handle?" /><button type="button" onClick={createGroup} disabled={!newGroup.name.trim() || !newGroup.orgCode.trim()} className="shrink-0 rounded-md bg-teal-700 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Create team</button></div>
          <div className="max-h-80 space-y-1 overflow-y-auto pr-1">{filteredGroups.map((group) => <button type="button" key={group.id} onClick={() => setSelectedGroupId(group.id)} className={`w-full rounded-md border p-2 text-left transition ${selectedGroup?.id === group.id ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-300"}`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-black text-[#00284d]">{group.name}</span><Badge className={group.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}>{group.active ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-[11px] text-slate-500">{group.orgCode} · {repository.getAssignmentGroupMemberships(group.id).length} member(s)</p></button>)}</div>
          {filteredGroups.length === 0 && <p className="text-xs text-slate-500">No teams match that search.</p>}
        </div>
        {selectedGroup ? <div className="rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-black text-[#00284d]">{selectedGroup.name}</p><p className="mt-1 text-xs text-slate-500">{selectedGroup.orgCode} queue · {selectedGroup.description || "No description yet."}</p></div><button type="button" onClick={() => saveGroup(selectedGroup, { active: !selectedGroup.active })} className="rounded-md border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700">{selectedGroup.active ? "Deactivate" : "Activate"}</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-bold text-slate-600">Queue name<Input aria-label={`Queue name for ${selectedGroup.name}`} defaultValue={selectedGroup.name} onBlur={(event) => saveGroup(selectedGroup, { name: event.target.value })} className={fieldClass} /></label><label className="text-[11px] font-bold text-slate-600">Queue lead<select aria-label={`Queue lead for ${selectedGroup.name}`} value={selectedGroup.leadUserId ?? ""} onChange={(event) => saveGroup(selectedGroup, { leadUserId: event.target.value || undefined })} className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="">No lead assigned</option>{teamUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label></div><label className="mt-3 block text-[11px] font-bold text-slate-600">Description<Input aria-label={`Description for ${selectedGroup.name}`} defaultValue={selectedGroup.description} onBlur={(event) => saveGroup(selectedGroup, { description: event.target.value })} className={fieldClass} /></label><div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-black uppercase tracking-wide text-slate-600">Eligible members</p><div className="mt-2 flex flex-wrap gap-2">{selectedMembers.map((member) => <span key={member.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"><strong>{member.userName ?? teamUsers.find((user) => user.id === member.userId)?.name ?? member.userId}</strong><span className="text-slate-500">{member.role}</span><button type="button" aria-label={`Remove ${member.userName ?? member.userId} from ${selectedGroup.name}`} onClick={() => removeMembership(selectedGroup.id, member.userId)} className="ml-1 font-black text-rose-700">×</button></span>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]"><select aria-label="Person to add to team" value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="">Add a visible person…</option>{teamUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><select aria-label="Team member role" value={memberRole} onChange={(event) => setMemberRole(event.target.value as AssignmentGroupMembershipRecord["role"])} className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs"><option value="member">Member</option><option value="backup">Backup</option><option value="lead">Lead</option></select><button type="button" onClick={saveMembership} disabled={!memberUserId} className="rounded-md bg-[#00284d] px-3 text-xs font-black text-white disabled:opacity-50">Save member</button></div></div></div> : <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">Choose a team to manage its queue.</div>}
      </div>
    </section>
  </div>;
}
