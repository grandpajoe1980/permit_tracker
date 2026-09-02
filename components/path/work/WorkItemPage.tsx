"use client";

import type { ReactNode } from "react";
import type { OperationalWorkItem } from "@/lib/operational-ux";
import { ActivityFeed } from "./ActivityFeed";
import { NextActionPanel } from "./NextActionPanel";
import { WorkItemFacts } from "./WorkItemFacts";
import { EscalationSelection } from "./EscalationSelection";

type WorkItemPageProps = { item: OperationalWorkItem | null; saving?: boolean; escalationTarget?: string; onEscalationTargetChange?: (value: string) => void; events: Array<{ id: string; actorName?: string; actionType?: string; occurredAt?: string; reason?: string | null }>; children: ReactNode };

export function WorkItemPage({ item, saving = false, escalationTarget, onEscalationTargetChange, events, children }: WorkItemPageProps) {
  if (!item) return <div data-path-work-item-page="true">{children}</div>;
  return <div data-path-work-item-page="true" aria-busy={saving} className="space-y-4">{saving && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-950">Saving…</p>}{escalationTarget && onEscalationTargetChange && <EscalationSelection value={escalationTarget} onChange={onEscalationTargetChange} />}<NextActionPanel nextAction={item.whatToDo} owner={item.nextOwner ?? item.ownerName} removesFromQueue={item.removesFromQueue} /><WorkItemFacts completed={item.sourceWorkstream ? "Persisted history shown below" : "No completed stage recorded"} current={item.sourceWorkstream?.currentStageName ?? item.statusLabel} next={item.nextHandoff ?? item.nextOwner ?? "Next configured workflow owner"} /><ActivityFeed events={events} />{children}</div>;
}
