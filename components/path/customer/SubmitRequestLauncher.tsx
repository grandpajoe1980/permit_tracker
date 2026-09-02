"use client";

import type { ReactNode } from "react";

export type CustomerRequestIntent = "permit" | "service" | "question" | "blocker" | "escalation" | "concierge";

type SubmitRequestLauncherProps = {
  open: boolean;
  onToggle: () => void;
  onSelect: (intent: CustomerRequestIntent) => void;
};

const intents: Array<[CustomerRequestIntent, string, string, ReactNode]> = [
  ["permit", "Submit / track a permit or authorization", "Choose an authorization and create a PATH tracking record.", "Permit"],
  ["service", "Request government help / service", "Ask for a review, meeting, referral, or other project-office help.", "Service"],
  ["question", "Ask a project question", "Send a structured question with the context needed for an answer.", "Question"],
  ["blocker", "Report a blocker / coordination problem", "Identify what is blocked, who may need to act, and the date that matters.", "Blocker"],
  ["escalation", "Request escalation", "Raise a critical-path risk or delayed dependency for project-office attention.", "Escalation"],
  ["concierge", "I'm not sure what I need", "Describe the situation in plain language and PATH will suggest a route.", "Concierge"],
];

export function SubmitRequestLauncher({ open, onToggle, onSelect }: SubmitRequestLauncherProps) {
  return <section aria-label="Submit a Request" className="rounded-xl border border-teal-300 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Next action</p><h2 className="mt-1 text-lg font-black text-[#00284d]">Submit a Request</h2><p className="mt-1 text-sm text-slate-600">Start a trackable permit, service request, question, blocker, or escalation.</p></div><button type="button" aria-expanded={open} onClick={onToggle} className="rounded-md bg-[#00284d] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#003c70] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">{open ? "Hide request choices" : "Choose request type"}</button></div>
    {open && <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{intents.map(([id, label, description, shortLabel]) => <button key={id} type="button" onClick={() => onSelect(id)} className="rounded-lg border border-slate-200 p-3 text-left hover:border-teal-400 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><span className="text-xs font-black uppercase tracking-wider text-teal-800">{shortLabel}</span><span className="mt-1 block text-sm font-black text-[#00284d]">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{description}</span></button>)}</div>}
  </section>;
}
