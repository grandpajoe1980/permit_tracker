"use client";

import { useState } from "react";
import type { CustomerRequestRecord } from "@/lib/domain-models";

type CustomerRequestListProps = {
  requests: CustomerRequestRecord[];
  onOpenRequest?: (request: CustomerRequestRecord) => void;
};

function formatUpdatedDate(value?: string) {
  if (!value) return "Not yet updated";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Not yet updated" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CustomerRequestList({ requests, onOpenRequest }: CustomerRequestListProps) {
  const [query, setQuery] = useState("");
  if (requests.length === 0) return <p className="text-sm text-slate-600">No requests submitted yet.</p>;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleRequests = requests.filter((request) => !normalizedQuery || `${request.confirmationNumber} ${request.title} ${request.description} ${request.assignmentGroupName ?? ""} ${request.knownAgencyCode ?? ""}`.toLowerCase().includes(normalizedQuery));
  return <div className="space-y-3">
    <label className="block text-xs font-bold text-slate-600">Search my requests<input aria-label="Search my requests" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search confirmation, title, or receiving team" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" /></label>
    {visibleRequests.length === 0 && <p className="text-sm text-slate-600">No requests match “{query}”. Clear the search to see all requests.</p>}
    {visibleRequests.length > 0 && <p className="text-xs text-slate-500">Showing {visibleRequests.length} of {requests.length} requests.</p>}
    {visibleRequests.map((request) => {
      const receivingTeam = request.assignmentGroupName ?? request.knownAgencyCode ?? "State Project Office";
      const isActionNeeded = request.status === "pending_customer" || request.itsmState === "pending_customer";
      const nextStep = isActionNeeded
        ? "Action needed: Please provide the requested clarification"
        : request.status === "submitted" || request.status === "triage"
        ? "Next step: State Project Office intake review & routing"
        : request.status === "in_progress"
        ? "Next step: Agency review in progress"
        : request.status === "resolved" || request.status === "closed"
        ? "Completed · Resolution provided"
        : "In progress";
      return (
        <button key={request.id} type="button" onClick={() => onOpenRequest?.(request)} className={`w-full rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${isActionNeeded ? "border-amber-300 bg-amber-50/60 hover:border-amber-500 hover:bg-amber-50" : "border-slate-200 hover:border-teal-400 hover:bg-teal-50/40"}`}>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="break-words pr-2 text-sm font-black text-[#00284d]">{request.confirmationNumber} · {request.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isActionNeeded ? "bg-amber-200 text-amber-900" : "bg-teal-50 text-teal-800"}`}>
              {isActionNeeded ? "Response needed" : request.status.replaceAll("_", " ")}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Receiving team: {receivingTeam}</p>
          <p className={`mt-1 text-xs font-semibold ${isActionNeeded ? "text-amber-900" : "text-slate-600"}`}>{nextStep} · Updated {formatUpdatedDate(request.updatedAt)}</p>
        </button>
      );
    })}
  </div>;
}
