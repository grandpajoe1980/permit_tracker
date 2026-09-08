"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Database,
  ExternalLink,
  FileEdit,
  History,
  RefreshCw,
  Shield,
  Users,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ADMIN_RESOURCES, type AdminResource } from "@/lib/admin-resources";
import { repository } from "@/lib/repository";
import type { OperationalState, TaskRecord } from "@/lib/domain-models";

type Row = Record<string, unknown>;

const value = (row: Row, ...keys: string[]) => {
  for (const key of keys) {
    if (row[key] !== null && row[key] !== undefined && row[key] !== "") return String(row[key]);
  }
  return "—";
};

const READ_ONLY_RESOURCES = new Set(["workflow_versions", "audit_events"]);

export function AdminExplorer({
  onOpenWork,
  initialTab = "records",
}: {
  onOpenWork?: (resource: string, id: string) => boolean;
  initialTab?: "records" | "people" | "teams" | "workflows" | "audit";
}) {
  const [activeAdminTab, setActiveAdminTab] = useState<"records" | "people" | "teams" | "workflows" | "audit">(initialTab);
  const [resource, setResource] = useState<AdminResource>("projects");
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [scope, setScope] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [editingRecord, setEditingRecord] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  function beginLoad() {
    setLoading(true);
    setError("");
    setSelected(null);
    setEditingRecord(null);
    setRecords([]);
    setTotal(0);
    setNotice("");
    setReceipt("");
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/records?resource=${resource}&page=${page}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load records.");
        return result;
      })
      .then((result) => {
        if (!controller.signal.aborted) {
          setRecords(result.records);
          setTotal(result.total);
          setScope(result.scope);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message || "Unable to load records.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [resource, page, reload]);

  const filtered = records.filter((row) =>
    JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase())
  );

  const startEdit = (record: Row) => {
    setEditingRecord(record);
    setEditReason("");
    setEditStatus(String(record.operational_state || record.status || record.itsm_state || ""));
    setEditTitle(String(record.title || record.name || ""));
    setReceipt("");
    setNotice("");
  };

  const handleSaveCorrection = () => {
    if (!editingRecord) return;
    if (!editReason.trim()) {
      setNotice("A valid correction reason is required for administrative audit logs.");
      return;
    }

    startTransition(async () => {
      try {
        const recordId = String(editingRecord.id);
        const recordCode = String(editingRecord.code || editingRecord.id);

        if (resource === "workstreams") {
          const ws = repository.getWorkstreamById(recordId) || repository.getWorkstreamById(recordCode);
          if (ws) {
            if (editStatus) {
              await repository.setWorkstreamStatePersisted({
                workstreamId: ws.id,
                operationalState: editStatus as OperationalState,
                actorName: "PATH Administrator",
                actorOrgName: "State Project Office",
                reason: editReason.trim(),
              });
            }
          }
        } else if (resource === "tasks") {
          await repository.updateTaskPersisted({
            taskId: recordId,
            updates: {
              status: editStatus as TaskRecord["status"],
              title: editTitle || undefined,
            },
            actorName: "PATH Administrator",
            actorOrgName: "State Project Office",
          });
        }

        setReceipt(`Correction recorded: ${resource} (${recordCode}) updated to "${editStatus || "updated"}". Audit log entry saved.`);
        setEditingRecord(null);
        setReload((n) => n + 1);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to save administrative correction.";
        setNotice(message);
      }
    });
  };

  // Relationship links rendered inside Inspect
  function renderRelationships(row: Row) {
    const links: React.ReactNode[] = [];
    const projectId = String(row.project_id || row.projectId || "");
    const workstreamId = String(row.workstream_id || row.workstreamId || "");
    const taskId = String(row.task_id || row.taskId || (row.task_type ? row.id : ""));
    const userId = String(row.user_id || row.userId || row.assigned_to_user_id || row.assigned_user_id || "");
    const orgCode = String(row.assigned_org_code || row.org_code || row.lead_agency_code || "");
    const groupId = String(row.assignment_group_id || row.groupId || "");

    if (projectId && projectId !== "—" && projectId !== "undefined") {
      links.push(
        <div key="proj" className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Project:</span>
          <Link href={`/projects/${encodeURIComponent(projectId)}`} className="text-xs font-bold text-teal-800 hover:underline">
            {projectId}
          </Link>
        </div>
      );
    }
    if (workstreamId && workstreamId !== "—" && workstreamId !== "undefined") {
      links.push(
        <div key="ws" className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Workstream:</span>
          <Link href={`/workstreams/${encodeURIComponent(workstreamId)}`} className="text-xs font-bold text-teal-800 hover:underline">
            {workstreamId}
          </Link>
        </div>
      );
    }
    if (taskId && taskId !== "—" && taskId !== "undefined") {
      links.push(
        <div key="task" className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Task:</span>
          <Link href={`/work/task/${encodeURIComponent(taskId)}`} className="text-xs font-bold text-teal-800 hover:underline">
            {taskId}
          </Link>
        </div>
      );
    }
    if (userId && userId !== "—" && userId !== "undefined") {
      links.push(
        <div key="user" className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Person:</span>
          <Link href={`/?view=profile&userId=${encodeURIComponent(userId)}`} className="text-xs font-bold text-teal-800 hover:underline">
            {userId}
          </Link>
        </div>
      );
    }
    if (orgCode && orgCode !== "—" && orgCode !== "undefined") {
      links.push(
        <div key="org" className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Agency:</span>
          <Link href={`/?view=contacts&orgId=${encodeURIComponent(orgCode)}`} className="text-xs font-bold text-teal-800 hover:underline">
            {orgCode}
          </Link>
        </div>
      );
    }
    if (groupId && groupId !== "—" && groupId !== "undefined") {
      links.push(
        <div key="grp" className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Team Queue:</span>
          <Link href={`/?view=admin#assignment-groups-heading`} className="text-xs font-bold text-teal-800 hover:underline">
            {groupId}
          </Link>
        </div>
      );
    }

    return links.length > 0 ? (
      <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-3 space-y-1.5 mb-4">
        <p className="text-[11px] font-black uppercase tracking-wider text-teal-900">Canonical Relationships</p>
        <div className="grid gap-1.5 sm:grid-cols-2">{links}</div>
      </div>
    ) : null;
  }

  return (
    <section className="space-y-4 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-6" aria-label="Administration record explorer">
      {/* Admin Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-teal-700">{scope || "Administration"}</p>
          <h2 className="mt-1 text-2xl font-black text-[#00284d]">Administration &amp; Governance</h2>
          <p className="mt-1 text-xs text-slate-600">Typed editing, live state corrections with audit history, and verified directory access.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => { beginLoad(); setReload((n) => n + 1); }} className="gap-1.5 text-xs font-bold">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Admin Section Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => { setActiveAdminTab("records"); setResource("projects"); }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${activeAdminTab === "records" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <Database className="size-3.5" /> Records
        </button>
        <button
          type="button"
          onClick={() => { setActiveAdminTab("people"); setResource("user_profiles"); }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${activeAdminTab === "people" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <Users className="size-3.5" /> People
        </button>
        <button
          type="button"
          onClick={() => { setActiveAdminTab("teams"); setResource("assignment_groups"); }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${activeAdminTab === "teams" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <Shield className="size-3.5" /> Teams &amp; Agencies
        </button>
        <Link
          href="/admin/workflows"
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
        >
          <Workflow className="size-3.5" /> Workflows <ExternalLink className="size-2.5 opacity-60" />
        </Link>
        <button
          type="button"
          onClick={() => { setActiveAdminTab("audit"); setResource("audit_events"); }}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition ${activeAdminTab === "audit" ? "bg-[#00284d] text-white shadow-xs" : "text-slate-700 hover:bg-slate-200"}`}
        >
          <History className="size-3.5" /> Audit
        </button>
      </div>

      {receipt && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 font-bold">
          <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
          <span>{receipt}</span>
        </div>
      )}

      {/* Record Filtering and Search */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">
          Record type
          <select
            className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal"
            value={resource}
            onChange={(event) => {
              beginLoad();
              setResource(event.target.value as AdminResource);
              setPage(0);
              setQuery("");
              setSelected(null);
            }}
          >
            {Object.entries(ADMIN_RESOURCES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-slate-700">
          Search this page
          <Input
            className="mt-1"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, ID, status, agency, or assignee"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-900">
          {error} Use Refresh to retry.
        </p>
      )}

      {loading ? (
        <p role="status" className="py-6 text-slate-600">Loading database records…</p>
      ) : !error && (
        <>
          <p className="text-sm text-slate-600">
            {total} accessible records · Page {page + 1} · {filtered.length} shown{query && " (search applies to this page only)"}
          </p>

          {/* Desktop Multi-column Table */}
          <div className="hidden md:block max-w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Record</th>
                  <th className="p-3">Status / role</th>
                  <th className="p-3">Project / organization</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const isReadOnly = READ_ONLY_RESOURCES.has(resource);
                  return (
                    <tr key={String(row.id)} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <p className="font-bold text-[#00284d]">
                          {value(row, "title", "name", "full_name", "label", "action", "id")}
                        </p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {value(row, "confirmation_number", "number", "code", "id")}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                          {value(row, "status", "itsm_state", "operational_state", "lifecycle_status", "role", "active")}
                        </span>
                      </td>
                      <td className="max-w-48 break-words p-3 text-xs text-slate-600">
                        {value(row, "organization_name", "assigned_org_code", "org_code", "project_id", "organization_id", "workstream_id")}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => { setSelected(row); setNotice(""); }}>
                            Inspect
                          </Button>
                          {!isReadOnly && (
                            <Button variant="ghost" size="sm" onClick={() => startEdit(row)} className="text-teal-800 hover:text-teal-950">
                              <FileEdit className="size-3.5" /> Edit
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Record Cards (390px safe, no horizontal overflow) */}
          <div className="block md:hidden space-y-3">
            {filtered.map((row) => {
              const isReadOnly = READ_ONLY_RESOURCES.has(resource);
              return (
                <div key={String(row.id)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-[#00284d]">
                        {value(row, "title", "name", "full_name", "label", "action", "id")}
                      </p>
                      <p className="text-xs font-mono text-slate-500 break-all">
                        {value(row, "confirmation_number", "number", "code", "id")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold shrink-0">
                      {value(row, "status", "itsm_state", "operational_state", "role", "active")}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-600">
                    Org: {value(row, "organization_name", "assigned_org_code", "org_code", "project_id")}
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                    <Button variant="outline" size="sm" onClick={() => { setSelected(row); setNotice(""); }}>
                      Inspect
                    </Button>
                    {!isReadOnly && (
                      <Button variant="outline" size="sm" onClick={() => startEdit(row)} className="text-teal-800">
                        <FileEdit className="size-3.5 mr-1" /> Edit
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!filtered.length && (
            <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-600">No matching records on this page.</p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" disabled={page === 0} onClick={() => { beginLoad(); setPage((p) => p - 1); }}>
              Previous
            </Button>
            <Button variant="outline" disabled={(page + 1) * 50 >= total} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </>
      )}

      {/* Inspect Dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record details · read only</DialogTitle>
            <DialogDescription>
              Use existing work and configuration screens for audited edits. History and published versions are not editable here.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <>
              {/* Canonical Relationships */}
              {renderRelationships(selected)}

              <div className="flex flex-wrap gap-2">
                {onOpenWork && (
                  <Button onClick={() => {
                    if (!onOpenWork(resource, String(selected.id))) {
                      setNotice("This record has no work editor in the current project. Use the configuration tools below, or inspect its fields here.");
                    }
                  }}>
                    Open existing work editor
                  </Button>
                )}
                {!READ_ONLY_RESOURCES.has(resource) && (
                  <Button variant="outline" onClick={() => { startEdit(selected); setSelected(null); }} className="gap-1.5 text-teal-800 font-bold">
                    <FileEdit className="size-3.5" /> Correct this record (Audited)
                  </Button>
                )}
              </div>

              {notice && <p role="status" className="text-sm text-amber-900">{notice}</p>}

              <dl className="space-y-3">
                {Object.entries(selected).map(([key, field]) => (
                  <div key={key} className="border-t border-slate-200 pt-2">
                    <dt className="text-sm font-bold text-slate-600">{key.replaceAll("_", " ")}</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
                      {typeof field === "object" && field !== null ? JSON.stringify(field, null, 2) : String(field ?? "Not set")}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Collapsed Technical Section */}
              <details className="mt-4 border-t border-slate-200 pt-3">
                <summary className="cursor-pointer text-xs font-bold text-slate-500 hover:text-slate-900">
                  Technical details &amp; raw JSON
                </summary>
                <pre className="mt-2 max-h-60 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100 font-mono">
                  {JSON.stringify(selected, null, 2)}
                </pre>
              </details>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Typed Audited Edit Dialog */}
      <Dialog open={Boolean(editingRecord)} onOpenChange={(open) => { if (!open) setEditingRecord(null); }}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileEdit className="size-4 text-teal-700" />
              <span>Correct Record: {value(editingRecord || {}, "title", "name", "code", "id")}</span>
            </DialogTitle>
            <DialogDescription>
              All administrative corrections require a recorded reason and generate an immutable audit ledger entry.
            </DialogDescription>
          </DialogHeader>

          {editingRecord && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <p><strong>Resource:</strong> {resource}</p>
                <p><strong>Record ID:</strong> <span className="font-mono">{String(editingRecord.id)}</span></p>
              </div>

              {/* Status / State Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700">Status / Operational State</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900"
                >
                  <option value="">(Keep current state)</option>
                  <option value="running">Running / Active Review</option>
                  <option value="waiting_applicant">Waiting on Applicant / RFI</option>
                  <option value="waiting_government">Interagency Coordination</option>
                  <option value="waiting_external">External Utility / Partner</option>
                  <option value="statutory_waiting_period">Statutory Notice</option>
                  <option value="scheduled_hold">Scheduled Hold</option>
                  <option value="blocked">Blocked / Critical Blocker</option>
                  <option value="complete">Complete / Approved</option>
                  <option value="completed">Completed (Task)</option>
                  <option value="in_progress">In Progress (Task)</option>
                </select>
              </div>

              {/* Title Field if editable */}
              {editingRecord.title !== undefined && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">Title</label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              )}

              {/* Required Audit Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Correction Reason <span className="text-rose-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="State the regulatory, engineering, or administrative reason for this correction..."
                  className="mt-1 w-full rounded-md border border-slate-300 p-2 text-xs focus:border-teal-600 focus:outline-none"
                />
              </div>

              {notice && (
                <p role="alert" className="text-xs font-bold text-rose-700">{notice}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setEditingRecord(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={isPending || !editReason.trim()}
                  onClick={handleSaveCorrection}
                  className="bg-[#00284d] hover:bg-[#00386d] text-white font-bold"
                >
                  {isPending ? "Saving..." : "Apply Audited Correction"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
