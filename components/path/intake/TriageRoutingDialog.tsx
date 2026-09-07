"use client";

import { useMemo, useState } from "react";
import type { CustomerRequestRecord, WorkstreamRecord } from "@/lib/domain-models";

export type TriageRoutingGroupOption = {
  id: string;
  orgCode: string;
  name: string;
  members: Array<{ userId: string; userName?: string; userEmail?: string; role?: string }>;
};

export type TriageRoutingOrganizationOption = {
  code: string;
  name: string;
};

export type TriageRoutingRow = {
  rowKey: string;
  code: string;
  title: string;
  category: string;
  permitTypeId?: string;
  leadOrgCode?: string;
  leadOrgName?: string;
  assignmentGroupId?: string;
  assignedToUserId?: string;
  workflowVersionId?: string;
  targetDate?: string;
};

type TriageRoutingDialogProps = {
  request: CustomerRequestRecord;
  initialRows: TriageRoutingRow[];
  organizations: TriageRoutingOrganizationOption[];
  assignmentGroups: TriageRoutingGroupOption[];
  workflowVersions: Array<{ id: string; label?: string; versionNumber?: number }>;
  existingWorkstreams: WorkstreamRecord[];
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (rows: TriageRoutingRow[]) => void;
  onRequestClarification: (notes: string) => void;
  onLinkExisting: (workstreamId: string, notes: string) => void;
};

type RoutingMode = "route" | "clarification" | "link";

function normalizedCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
}

function nextWorkstreamCode(rows: TriageRoutingRow[], request: CustomerRequestRecord): string {
  const base = request.confirmationNumber.replace(/[^A-Z0-9]+/gi, "-").slice(-14).toUpperCase();
  let index = rows.length + 1;
  let code = `WS-ROUTE-${base}-${index}`;
  while (rows.some((row) => row.code === code)) {
    index += 1;
    code = `WS-ROUTE-${base}-${index}`;
  }
  return code;
}

export function TriageRoutingDialog({
  request,
  initialRows,
  organizations,
  assignmentGroups,
  workflowVersions,
  existingWorkstreams,
  busy = false,
  onCancel,
  onConfirm,
  onRequestClarification,
  onLinkExisting,
}: TriageRoutingDialogProps) {
  const [mode, setMode] = useState<RoutingMode>("route");
  const [rows, setRows] = useState(initialRows);
  const [clarificationNotes, setClarificationNotes] = useState("");
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState("");
  const [linkNotes, setLinkNotes] = useState("");

  const updateRow = (rowKey: string, changes: Partial<TriageRoutingRow>) => {
    setRows((current) => current.map((row) => row.rowKey === rowKey ? { ...row, ...changes } : row));
  };

  const routeErrors = useMemo(() => rows.map((row) => {
    if (!row.leadOrgCode) return "Choose an agency.";
    if (!row.assignmentGroupId) return "Choose a team.";
    if (!row.workflowVersionId) return "Choose a published workflow.";
    if (!row.targetDate) return "Choose an intentional target date.";
    if (!row.title.trim()) return "Add a workstream title.";
    if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(normalizedCode(row.code))) return "Use a valid unique workstream code.";
    return "";
  }), [rows]);
  const duplicateCodes = new Set(rows.map((row) => normalizedCode(row.code)).filter((code, index, all) => code && all.indexOf(code) !== index));
  const canConfirmRoute = rows.length > 0 && routeErrors.every((error) => !error) && duplicateCodes.size === 0;
  const selectedLink = existingWorkstreams.find((workstream) => workstream.id === selectedWorkstreamId);

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#00284d]/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="triage-routing-title">
    <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-100 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Intake routing review</p><h2 id="triage-routing-title" className="mt-1 text-xl font-black text-[#00284d]">{request.confirmationNumber} · {request.title}</h2><p className="mt-1 text-sm text-slate-600">Choose the deliberate outcome for this request. Suggestions never create work until the database confirms your choice.</p></div>
      <div className="space-y-4 p-5">
        <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Intake outcome">
          {([ ["route", "Create workstreams"], ["clarification", "Ask for clarification"], ["link", "Link existing work"] ] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={mode === value} disabled={busy} onClick={() => setMode(value)} className={`rounded-lg border px-3 py-2 text-sm font-bold ${mode === value ? "border-[#00284d] bg-[#00284d] text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-teal-50"}`}>{label}</button>)}
        </div>

        {mode === "route" && <>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">These are provisional routing suggestions. Every workstream must have a persisted agency, team, optional eligible person, published workflow, and intentional target date before it can be created.</div>
          {rows.map((row, index) => {
            const groupsForAgency = assignmentGroups.filter((group) => group.orgCode === row.leadOrgCode);
            const selectedGroup = assignmentGroups.find((group) => group.id === row.assignmentGroupId);
            const rowError = routeErrors[index];
            return <section key={row.rowKey} className="space-y-3 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><div><p className="font-black text-[#00284d]">Workstream {index + 1}</p><p className="text-xs text-slate-500">Code: {row.code || "not generated"}</p></div>{rows.length > 1 && <button type="button" disabled={busy} onClick={() => setRows((current) => current.filter((candidate) => candidate.rowKey !== row.rowKey))} className="text-xs font-bold text-red-700 underline disabled:opacity-50">Remove</button>}</div><div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-600">Agency<select value={row.leadOrgCode ?? ""} disabled={busy} onChange={(event) => { const organization = organizations.find((candidate) => candidate.code === event.target.value); updateRow(row.rowKey, { leadOrgCode: organization?.code, leadOrgName: organization?.name, assignmentGroupId: undefined, assignedToUserId: undefined }); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Choose an agency</option>{organizations.map((organization) => <option key={organization.code} value={organization.code}>{organization.code} · {organization.name}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-600">Team<select value={row.assignmentGroupId ?? ""} disabled={busy || !row.leadOrgCode} onChange={(event) => { const group = groupsForAgency.find((candidate) => candidate.id === event.target.value); updateRow(row.rowKey, { assignmentGroupId: group?.id, assignedToUserId: undefined, leadOrgCode: group?.orgCode ?? row.leadOrgCode, leadOrgName: organizations.find((candidate) => candidate.code === group?.orgCode)?.name ?? row.leadOrgName }); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">{row.leadOrgCode ? "Choose a persisted team" : "Choose an agency first"}</option>{groupsForAgency.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              <label className="text-xs font-bold text-slate-600">Assigned person<select value={row.assignedToUserId ?? ""} disabled={busy || !selectedGroup} onChange={(event) => updateRow(row.rowKey, { assignedToUserId: event.target.value || undefined })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Leave in team queue</option>{selectedGroup?.members.map((member) => <option key={member.userId} value={member.userId}>{member.userName ?? member.userEmail ?? member.userId} · {member.role ?? "member"}</option>)}</select><span className="mt-1 block text-[11px] font-normal text-slate-500">Only active members of the selected team are listed.</span></label>
              <label className="text-xs font-bold text-slate-600">Target date<input type="date" required value={row.targetDate ?? ""} disabled={busy} onChange={(event) => updateRow(row.rowKey, { targetDate: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /><span className="mt-1 block text-[11px] font-normal text-slate-500">No date is invented; choose the date the team should target.</span></label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">Workstream title<input value={row.title} disabled={busy} onChange={(event) => updateRow(row.rowKey, { title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="text-xs font-bold text-slate-600 sm:col-span-2">Published workflow<select value={row.workflowVersionId ?? ""} disabled={busy} onChange={(event) => updateRow(row.rowKey, { workflowVersionId: event.target.value || undefined })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Choose a published workflow</option>{workflowVersions.map((version) => <option key={version.id} value={version.id}>{version.label ?? "Workflow"}{version.versionNumber ? ` · v${version.versionNumber}` : ""}</option>)}</select></label>
            </div>{rowError && <p role="alert" className="text-xs font-bold text-red-700">{rowError}</p>}{duplicateCodes.has(normalizedCode(row.code)) && <p role="alert" className="text-xs font-bold text-red-700">Workstream codes must be unique within this routing plan.</p>}</section>;
          })}
          <button type="button" disabled={busy} onClick={() => setRows((current) => [...current, { rowKey: `route-${crypto.randomUUID()}`, code: nextWorkstreamCode(current, request), title: "Additional coordinated work", category: request.requestType, permitTypeId: request.knownPermitTypeId }])} className="rounded-md border border-dashed border-teal-400 px-3 py-2 text-sm font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-50">+ Add another workstream</button>
        </>}

        {mode === "clarification" && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-black text-amber-950">Pause routing and ask the customer for more information.</p><p className="text-sm text-amber-900">This changes the request to waiting on the customer. It does not create a workstream or assignment.</p><label className="text-xs font-bold text-amber-950">What needs clarification?<textarea value={clarificationNotes} disabled={busy} onChange={(event) => setClarificationNotes(event.target.value)} rows={5} className="mt-1 w-full rounded-md border border-amber-300 bg-white p-3 text-sm" placeholder="Describe the missing decision, location, document, or outcome needed." /></label></div>}

        {mode === "link" && <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4"><p className="font-black text-teal-950">Connect this request to work that already exists.</p><p className="text-sm text-teal-900">No new workstream will be created. Choose only a workstream in this project and explain the relationship.</p><label className="text-xs font-bold text-teal-950">Existing workstream<select value={selectedWorkstreamId} disabled={busy} onChange={(event) => setSelectedWorkstreamId(event.target.value)} className="mt-1 w-full rounded-md border border-teal-300 bg-white px-3 py-2 text-sm"><option value="">Choose existing work</option>{existingWorkstreams.map((workstream) => <option key={workstream.id} value={workstream.id}>{workstream.code} · {workstream.title}</option>)}</select></label>{selectedLink && <p className="rounded-md bg-white p-2 text-xs text-teal-950">Current state: {selectedLink.operationalStateLabel} · owner: {selectedLink.assignedToUserName ?? selectedLink.assignmentGroupName ?? "unassigned"}</p>}<label className="text-xs font-bold text-teal-950">Why is this request linked?<textarea value={linkNotes} disabled={busy} onChange={(event) => setLinkNotes(event.target.value)} rows={4} className="mt-1 w-full rounded-md border border-teal-300 bg-white p-3 text-sm" placeholder="Explain how the request relates to the existing work." /></label></div>}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={busy} onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">Cancel</button>{mode === "route" ? <button type="button" disabled={busy || !canConfirmRoute} onClick={() => onConfirm(rows.map((row) => ({ ...row, code: normalizedCode(row.code) })))} className="rounded-md bg-[#00284d] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving route…" : "Confirm routing and create work"}</button> : mode === "clarification" ? <button type="button" disabled={busy || clarificationNotes.trim().length < 8} onClick={() => onRequestClarification(clarificationNotes.trim())} className="rounded-md bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Saving request…" : "Ask customer for clarification"}</button> : <button type="button" disabled={busy || !selectedWorkstreamId || linkNotes.trim().length < 8} onClick={() => onLinkExisting(selectedWorkstreamId, linkNotes.trim())} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Linking request…" : "Link without creating work"}</button>}</div>
      </div>
    </div>
  </div>;
}
