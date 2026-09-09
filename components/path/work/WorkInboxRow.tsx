"use client";

import React from "react";
import { Check, Clock3, AlertCircle } from "lucide-react";
import type { OperationalWorkItem } from "@/lib/operational-ux";

export interface WorkInboxRowProps {
  item: OperationalWorkItem;
  onOpen: (item: OperationalWorkItem) => void;
  onClaim?: (item: OperationalWorkItem) => void;
  canClaim?: boolean;
}

export function WorkInboxRow({ item, onOpen, onClaim, canClaim = false }: WorkInboxRowProps) {
  const toneClasses = {
    red: "bg-red-50 text-red-800 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    green: "bg-emerald-50 text-emerald-800 border-emerald-200",
    blue: "bg-blue-50 text-blue-800 border-blue-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200",
  }[item.statusTone] || "bg-slate-50 text-slate-700 border-slate-200";

  const statusToneIcon = {
    green: <Check className="size-3 text-emerald-700 mr-1 inline shrink-0" aria-hidden="true" />,
    amber: <Clock3 className="size-3 text-amber-700 mr-1 inline shrink-0" aria-hidden="true" />,
    red: <AlertCircle className="size-3 text-red-700 mr-1 inline shrink-0" aria-hidden="true" />,
    blue: <Clock3 className="size-3 text-blue-700 mr-1 inline shrink-0" aria-hidden="true" />,
    slate: null,
  }[item.statusTone] ?? null;

  const assigneeDisplay = item.ownerName || (item.assignmentGroupName ? `Unassigned (${item.assignmentGroupName})` : "Unassigned");
  const claimableKind = item.kind === "workflow" || item.kind === "task" || item.kind === "customer_request";
  const showClaim = canClaim && claimableKind && (!item.assignedUserId || item.ownerName === "Unassigned");

  return (
    <div
      data-testid={`inbox-row-${item.id}`}
      onClick={() => onOpen(item)}
      className="group flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs transition hover:border-teal-400 hover:bg-teal-50/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-slate-400">{item.id}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-slate-600">{item.kind.replace("_", " ")}</span>
          {item.isCriticalPath && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">Critical path</span>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
          className="mt-1 block max-w-full text-left text-sm font-black text-[#00284d] group-hover:text-teal-950 group-hover:underline truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          aria-label={`Open ${item.title}`}
        >
          {item.title}
        </button>
        <p className="mt-0.5 text-xs text-slate-500 truncate">
          <span className="font-semibold text-slate-700">Next:</span> {item.waitingOn ? `Waiting on ${item.waitingOn}` : item.whatToDo || "Review record"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs">
        <div className="text-right">
          <p className="font-bold text-slate-700 truncate max-w-[160px]">{assigneeDisplay}</p>
          <p className="text-[11px] text-slate-400">{item.dueDate ? `Due ${item.dueDate}` : "No deadline"}</p>
        </div>

        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${toneClasses}`}>
          {statusToneIcon}
          <span>{item.statusLabel}</span>
        </span>

        {showClaim && onClaim && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClaim(item);
            }}
            onKeyDown={(e) => e.stopPropagation()}
            className="rounded-md bg-[#00284d] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#003c70] transition min-h-[36px] sm:min-h-[32px]"
          >
            Take ownership
          </button>
        )}
      </div>
    </div>
  );
}
