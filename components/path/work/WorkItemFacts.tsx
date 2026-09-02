"use client";

type WorkItemFactsProps = { completed: string; current: string; next: string };

export function WorkItemFacts({ completed, current, next }: WorkItemFactsProps) {
  return <section aria-label="Workflow summary" className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-emerald-800">Completed</p><p className="mt-1 text-sm font-black text-emerald-950">{completed}</p></div><div className="rounded-xl border-2 border-teal-500 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-teal-800">Current</p><p className="mt-1 text-sm font-black text-[#00284d]">{current}</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Next</p><p className="mt-1 text-sm font-black text-slate-800">{next}</p></div></section>;
}
