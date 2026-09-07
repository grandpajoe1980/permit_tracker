"use client";

import { useState } from "react";
import type { CustomerRequestRecord } from "@/lib/domain-models";

export type TriageRoutingRow = {
  code: string;
  title: string;
  category: string;
  permitTypeId?: string;
  leadOrgCode?: string;
  leadOrgName?: string;
  workflowVersionId?: string;
};

type TriageRoutingDialogProps = {
  request: CustomerRequestRecord;
  initialRows: TriageRoutingRow[];
  workflowVersions: Array<{ id: string; label?: string; versionNumber?: number }>;
  onCancel: () => void;
  onConfirm: (rows: TriageRoutingRow[]) => void;
};

export function TriageRoutingDialog({ request, initialRows, workflowVersions, onCancel, onConfirm }: TriageRoutingDialogProps) {
  const [rows, setRows] = useState(initialRows);
  const updateRow = (index: number, changes: Partial<TriageRoutingRow>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row));
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#00284d]/60 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="triage-routing-title">
    <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-100 bg-slate-50 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Intake routing review</p><h2 id="triage-routing-title" className="mt-1 text-xl font-black text-[#00284d]">{request.confirmationNumber} · {request.title}</h2><p className="mt-1 text-sm text-slate-600">Review the request and edit each proposed workstream before creating any downstream work.</p></div>
      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">These are routing suggestions, not final assignments. Confirming creates the listed workstreams in one transaction.</div>
        {rows.map((row, index) => <section key={`${row.code}-${index}`} className="space-y-3 rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between"><p className="font-black text-[#00284d]">Workstream {index + 1}</p>{rows.length > 1 && <button type="button" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="text-xs font-bold text-red-700 underline">Remove</button>}</div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Agency code<input value={row.leadOrgCode ?? ""} onChange={(event) => updateRow(index, { leadOrgCode: event.target.value.toUpperCase() })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-bold text-slate-600">Agency name<input value={row.leadOrgName ?? ""} onChange={(event) => updateRow(index, { leadOrgName: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Workstream title<input value={row.title} onChange={(event) => updateRow(index, { title: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-xs font-bold text-slate-600 sm:col-span-2">Published workflow template<select value={row.workflowVersionId ?? ""} onChange={(event) => updateRow(index, { workflowVersionId: event.target.value || undefined })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Use latest published template</option>{workflowVersions.map((version) => <option key={version.id} value={version.id}>{version.label ?? "Workflow"}{version.versionNumber ? ` · v${version.versionNumber}` : ""}</option>)}</select></label></div></section>)}
        <button type="button" onClick={() => setRows((current) => [...current, { code: `STATEPO-${current.length + 1}`, title: "Additional coordinated work", category: request.requestType, leadOrgCode: "STATEPO", leadOrgName: "Louisiana Governor's Office of Major Projects & Delivery" }])} className="rounded-md border border-dashed border-teal-400 px-3 py-2 text-sm font-bold text-teal-800 hover:bg-teal-50">+ Add another workstream</button>
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button><button type="button" disabled={rows.length === 0 || rows.some((row) => !row.code.trim() || !row.title.trim() || !row.leadOrgCode?.trim())} onClick={() => onConfirm(rows)} className="rounded-md bg-[#00284d] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">Confirm routing and create work</button></div>
      </div>
    </div>
  </div>;
}
