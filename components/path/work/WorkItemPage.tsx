"use client";

import type { ReactNode } from "react";
import type { OperationalWorkItem } from "@/lib/operational-ux";
import { EscalationSelection } from "./EscalationSelection";

type WorkItemPageProps = { item: OperationalWorkItem | null; saving?: boolean; escalationTarget?: string; onEscalationTargetChange?: (value: string) => void; events: Array<{ id: string; actorName?: string; actionType?: string; occurredAt?: string; reason?: string | null }>; children: ReactNode };

export function WorkItemPage({ item, saving = false, escalationTarget, onEscalationTargetChange, events, children }: WorkItemPageProps) {
  if (!item) return <div data-path-work-item-page="true">{children}</div>;
  const owner = item.ownerName || "Unassigned";
  const team = item.ownerOrganization || "Team not configured";
  return <div data-path-work-item-page="true" aria-busy={saving} className="space-y-4">
    {saving && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950">Saving…</p>}
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
    {children}
  </div>;
}
