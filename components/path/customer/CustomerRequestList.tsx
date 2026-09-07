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
  const visibleRequests = requests.filter((request) => !normalizedQuery || `${request.confirmationNumber} ${request.title} ${request.description} ${request.assignmentGroupName ?? ""} ${request.assignedToUserName ?? ""}`.toLowerCase().includes(normalizedQuery));
  return <div className="space-y-3">
    <label className="block text-xs font-bold text-slate-600">Search my requests<input aria-label="Search my requests" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search confirmation, title, owner, or team" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" /></label>
    {visibleRequests.length === 0 && <p className="text-sm text-slate-600">No requests match “{query}”. Clear the search to see all requests.</p>}
    {visibleRequests.length > 0 && <p className="text-xs text-slate-500">Showing {visibleRequests.length} of {requests.length} requests.</p>}
    {visibleRequests.map((request) => <button key={request.id} type="button" onClick={() => onOpenRequest?.(request)} className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-[#00284d]">{request.confirmationNumber} · {request.title}</p><span className="text-xs font-bold text-teal-800">{request.status.replaceAll("_", " ")}</span></div>
      <p className="mt-1 text-xs text-slate-500">Assigned to: {request.assignedToUserName ?? "Unassigned"} · Team: {request.assignmentGroupName ?? request.knownAgencyCode ?? "State Project Office"}</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">{request.status === "submitted" || request.status === "triage" ? "Waiting for intake review" : request.status === "resolved" || request.status === "closed" ? "No action required" : "In progress"} · Updated {formatUpdatedDate(request.updatedAt)}</p>
    </button>)}
  </div>;
}
