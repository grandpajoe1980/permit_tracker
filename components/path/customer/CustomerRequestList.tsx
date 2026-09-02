"use client";

import type { CustomerRequestRecord } from "@/lib/domain-models";

type CustomerRequestListProps = {
  requests: CustomerRequestRecord[];
  onOpenRequest?: (request: CustomerRequestRecord) => void;
};

export function CustomerRequestList({ requests, onOpenRequest }: CustomerRequestListProps) {
  if (requests.length === 0) return <p className="text-sm text-slate-600">No requests submitted yet.</p>;
  return <div className="space-y-3">
    {requests.map((request) => <button key={request.id} type="button" onClick={() => onOpenRequest?.(request)} className="w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-black text-[#00284d]">{request.confirmationNumber} · {request.title}</p><span className="text-xs font-bold text-teal-800">{request.status.replaceAll("_", " ")}</span></div>
      <p className="mt-1 text-xs text-slate-500">Owner: {request.knownAgencyCode ?? "State Project Office"} · Updated {request.updatedAt ? new Date(request.updatedAt).toLocaleDateString() : "Not yet updated"}</p>
    </button>)}
  </div>;
}
