"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ADMIN_RESOURCES, type AdminResource } from "@/lib/admin-resources";

type Row = Record<string, unknown>;
const value = (row: Row, ...keys: string[]) => {
  for (const key of keys) if (row[key] !== null && row[key] !== undefined && row[key] !== "") return String(row[key]);
  return "—";
};

export function AdminExplorer({ onOpenWork }: { onOpenWork?: (resource: string, id: string) => boolean }) {
  const [resource, setResource] = useState<AdminResource>("projects");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [scope, setScope] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");

  function beginLoad() {
    setLoading(true); setError(""); setSelected(null); setRecords([]); setTotal(0); setNotice("");
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/records?resource=${resource}&page=${page}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unable to load records."); return result; })
      .then(result => { if (!controller.signal.aborted) { setRecords(result.records); setTotal(result.total); setScope(result.scope); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || "Unable to load records."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [resource, page, reload]);

  const filtered = records.filter(row => JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="space-y-4 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Administration record explorer">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-teal-800">{scope || "Administration"}</p><h2 className="mt-1 text-2xl font-black text-[#00284d]">All work &amp; directories</h2><p className="mt-2 text-sm text-slate-600">Browse database records across projects. Access follows your existing permissions.</p></div><Button variant="outline" disabled={loading} onClick={() => { beginLoad(); setReload(n => n + 1); }}>Refresh</Button></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold text-slate-700">Record type<select className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" value={resource} onChange={event => { beginLoad(); setResource(event.target.value as AdminResource); setPage(0); setQuery(""); setSelected(null); }}>{Object.entries(ADMIN_RESOURCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm font-bold text-slate-700">Search this page<Input className="mt-1" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, ID, status, agency, or assignee" /></label></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-900">{error} Use Refresh to retry.</p>}
    {loading ? <p role="status" className="py-6 text-slate-600">Loading database records…</p> : !error && <>
      <p className="text-sm text-slate-600">{total} accessible records · Page {page + 1} · {filtered.length} shown{query && " (search applies to this page only)"}</p>
      <div className="max-w-full overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Record</th><th className="p-3">Status / role</th><th className="p-3">Project / organization</th><th className="p-3">Details</th></tr></thead><tbody>{filtered.map(row => <tr key={String(row.id)} className="border-t border-slate-100"><td className="p-3"><p className="font-bold text-[#00284d]">{value(row, "title", "name", "full_name", "label", "action", "id")}</p><p className="mt-1 break-all text-xs text-slate-500">{value(row, "confirmation_number", "number", "code", "id")}</p></td><td className="p-3">{value(row, "status", "itsm_state", "operational_state", "lifecycle_status", "role", "active")}</td><td className="max-w-48 break-words p-3">{value(row, "organization_name", "assigned_org_code", "org_code", "project_id", "organization_id", "workstream_id")}</td><td className="p-3"><Button variant="outline" onClick={() => { setSelected(row); setNotice(""); }}>Inspect</Button></td></tr>)}</tbody></table></div>
      {!filtered.length && <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">No matching records on this page.</p>}
      <div className="flex gap-2"><Button variant="outline" disabled={page === 0} onClick={() => { beginLoad(); setPage(p => p - 1); }}>Previous</Button><Button variant="outline" disabled={(page + 1) * 50 >= total} onClick={() => setPage(p => p + 1)}>Next</Button></div>
    </>}
    {selected && <section aria-label="Record details" className="rounded-xl border border-teal-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold text-[#00284d]">Record details · read only</h3><Button variant="outline" onClick={() => setSelected(null)}>Close details</Button></div>
      <p className="my-3 text-sm text-slate-600">Use existing work and configuration screens for audited edits. History and published versions are not editable here.</p>
      {onOpenWork && <Button onClick={() => { if (!onOpenWork(resource, String(selected.id))) setNotice("This record has no work editor in the current project. Use the configuration tools below, or inspect its fields here."); }}>Open existing work editor</Button>}
      {notice && <p role="status" className="mt-3 text-sm text-amber-900">{notice}</p>}
      <dl className="mt-4 space-y-3">{Object.entries(selected).map(([key, field]) => <div key={key} className="border-t border-slate-200 pt-2"><dt className="text-sm font-bold text-slate-600">{key.replaceAll("_", " ")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{typeof field === "object" && field !== null ? JSON.stringify(field, null, 2) : String(field ?? "Not set")}</dd></div>)}</dl>
    </section>}
  </section>;
}
