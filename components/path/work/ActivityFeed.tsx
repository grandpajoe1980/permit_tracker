"use client";

type ActivityEvent = { id: string; actorName?: string; actionType?: string; occurredAt?: string; reason?: string | null };

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  return <section aria-label="Saved activity" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Saved activity</p>{events.length === 0 ? <p className="mt-2 text-sm text-slate-500">No saved activity yet.</p> : <div className="mt-3 space-y-2">{events.slice(0, 6).map((event) => <p key={event.id} className="text-xs text-slate-600"><strong className="text-slate-800">{event.actorName ?? "PATH"}</strong> · {event.actionType?.replaceAll("_", " ") ?? "Recorded activity"}{event.reason ? ` · ${event.reason}` : ""}</p>)}</div>}</section>;
}
