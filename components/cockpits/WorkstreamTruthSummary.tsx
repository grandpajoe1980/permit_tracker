"use client";

import type { WorkstreamRecord, WorkflowTemplateRecord } from "@/lib/domain-models";
import { buildWorkstreamTruth } from "@/lib/workstream-truth";

function formatDate(value?: string) {
  if (!value) return "Not set";
  const date = new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function WorkstreamTruthSummary({
  workstream,
  templates = [],
  customerSafe = false,
}: {
  workstream: WorkstreamRecord;
  templates?: WorkflowTemplateRecord[];
  customerSafe?: boolean;
}) {
  const truth = buildWorkstreamTruth(workstream, templates);
  const owner = customerSafe ? truth.ownerOrganization : `${truth.ownerName} · ${truth.ownerOrganization}`;
  const fields = [
    ["Stage", truth.stage],
    ["Owner", owner],
    ["Hold", truth.hold],
    ["Baseline", formatDate(truth.baselineDate)],
    ["Forecast", formatDate(truth.forecastDate)],
    ["Next action", truth.nextAction],
  ] as const;

  return (
    <section aria-label="Canonical workstream story" data-workstream-story={workstream.id} className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {fields.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-md bg-white/70 p-2">
          <p className="font-black uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`mt-1 break-words font-bold ${label === "Hold" && truth.hold !== "No hold recorded" ? "text-amber-900" : label === "Next action" ? "text-teal-900" : "text-slate-800"}`}>{value}</p>
        </div>
      ))}
    </section>
  );
}
