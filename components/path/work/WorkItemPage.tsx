"use client";

import { useState, type ReactNode } from "react";
import type { OperationalWorkItem } from "@/lib/operational-ux";
import { EscalationSelection } from "./EscalationSelection";
import { ActivityFeed } from "./ActivityFeed";

export type WorkItemPageTab = "overview" | "documents" | "activity";

type WorkItemPageProps = {
  item: OperationalWorkItem | null;
  saving?: boolean;
  escalationTarget?: string;
  onEscalationTargetChange?: (value: string) => void;
  events: Array<{ id: string; actorName?: string; actionType?: string; occurredAt?: string; reason?: string | null }>;
  children: ReactNode;
  onNavigateParent?: (kind: "project" | "workstream", id?: string) => void;
};

export function WorkItemPage({
  item,
  saving = false,
  escalationTarget,
  onEscalationTargetChange,
  events,
  children,
  onNavigateParent,
}: WorkItemPageProps) {
  const [activeTab, setActiveTab] = useState<WorkItemPageTab>("overview");

  if (!item) return <div data-path-work-item-page="true">{children}</div>;
  const owner = item.ownerName || "Unassigned";
  const team = item.ownerOrganization || "Team not configured";
  const docCount = item.documents?.length ?? 0;
  const eventCount = events?.length ?? 0;

  return (
    <div data-path-work-item-page="true" aria-busy={saving} className="space-y-4">
      {/* Breadcrumb parent links */}
      <nav aria-label="Record breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
        <button
          type="button"
          onClick={() => onNavigateParent?.("project")}
          className="text-teal-800 underline-offset-2 hover:underline font-bold"
        >
          {item.projectName || "Starbase Louisiana"}
        </button>
        {item.workstreamTitle && (
          <>
            <span aria-hidden="true">›</span>
            <button
              type="button"
              onClick={() => onNavigateParent?.("workstream", item.workstreamId)}
              className="text-teal-800 underline-offset-2 hover:underline"
            >
              {item.workstreamTitle}
            </button>
          </>
        )}
        <span aria-hidden="true">›</span>
        <span className="text-slate-800">{item.title}</span>
      </nav>

      {saving && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950">Saving…</p>}

      {/* Record tabs */}
      <div className="flex border-b border-slate-200" role="tablist" aria-label="Record sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          className={`border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
            activeTab === "overview"
              ? "border-teal-700 text-[#00284d]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "documents"}
          onClick={() => setActiveTab("documents")}
          className={`border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
            activeTab === "documents"
              ? "border-teal-700 text-[#00284d]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Documents ({docCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "activity"}
          onClick={() => setActiveTab("activity")}
          className={`border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
            activeTab === "activity"
              ? "border-teal-700 text-[#00284d]"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Activity ({eventCount})
        </button>
      </div>

      <section aria-label="Current responsibility" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Current responsibility</p>
            <p className="mt-1 text-sm text-slate-800"><strong>Assigned to:</strong> {owner}</p>
            <p className="text-sm text-slate-700"><strong>Responsible team:</strong> {team}</p>
          </div>
          <div className="max-w-none text-left sm:max-w-md sm:text-right">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Next response</p>
            <p className="mt-1 text-sm font-semibold text-[#00284d]">{item.waitingOn ? `Waiting on ${item.waitingOn}` : item.whatToDo || "No action required from you right now."}</p>
          </div>
        </div>
      </section>

      {escalationTarget && onEscalationTargetChange && <EscalationSelection value={escalationTarget} onChange={onEscalationTargetChange} />}

      {activeTab === "overview" && children}
      {activeTab === "documents" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-700">Record Documents ({docCount})</h2>
          {docCount === 0 ? (
            <p className="text-sm text-slate-500">No attached documents for this record.</p>
          ) : (
            <div className="space-y-2">
              {item.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 bg-slate-50">
                  <div>
                    <p className="text-sm font-bold text-[#00284d]">{doc.label}</p>
                    <p className="text-xs text-slate-500">Attachment{doc.version ? ` · ${doc.version}` : ""}</p>
                  </div>
                  <span className="rounded bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-mono font-bold text-teal-800">{doc.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {activeTab === "activity" && <ActivityFeed events={events} />}
    </div>
  );
}
