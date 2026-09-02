"use client";

type NextActionPanelProps = { nextAction: string; owner: string; removesFromQueue: string };

export function NextActionPanel({ nextAction, owner, removesFromQueue }: NextActionPanelProps) {
  return <section aria-label="Your next action" className="rounded-xl border border-teal-300 bg-teal-50 p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Your next action</p><p className="mt-1 text-base font-black text-[#00284d]">{nextAction}</p><p className="mt-1 text-sm text-teal-950">Owner: {owner} · {removesFromQueue}</p></section>;
}
