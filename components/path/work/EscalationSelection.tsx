"use client";

type EscalationSelectionProps = { value: string; onChange: (value: string) => void };

export function EscalationSelection({ value, onChange }: EscalationSelectionProps) {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><label htmlFor="escalation-target" className="text-xs font-black uppercase tracking-wider text-amber-900">What are you escalating?</label><select id="escalation-target" value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-950"><option value="project-wide">Project-wide / not sure</option><option value={value}>Selected record</option><option value="workstream">Workstream</option><option value="permit">Permit / authorization</option><option value="rfi">RFI</option><option value="document">Document decision</option></select><p className="mt-2 text-xs text-amber-800">The selected record remains attached to the escalation and its confirmation.</p></div>;
}
