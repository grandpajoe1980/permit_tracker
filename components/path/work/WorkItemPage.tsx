"use client";

import type { ReactNode } from "react";
import type { OperationalWorkItem } from "@/lib/operational-ux";
import { ActivityFeed } from "./ActivityFeed";
import { NextActionPanel } from "./NextActionPanel";
import { WorkItemFacts } from "./WorkItemFacts";

type WorkItemPageProps = { item: OperationalWorkItem | null; events: Array<{ id: string; actorName?: string; actionType?: string; occurredAt?: string; reason?: string | null }>; children: ReactNode };

export function WorkItemPage({ item, events, children }: WorkItemPageProps) {
  if (!item) return <div data-path-work-item-page="true">{children}</div>;
  return <div data-path-work-item-page="true" className="space-y-4"><NextActionPanel nextAction={item.whatToDo} owner={item.nextOwner ?? item.ownerName} removesFromQueue={item.removesFromQueue} /><WorkItemFacts completed={item.sourceWorkstream ? "Persisted history shown below" : "No completed stage recorded"} current={item.sourceWorkstream?.currentStageName ?? item.statusLabel} next={item.nextHandoff ?? item.nextOwner ?? "Next configured workflow owner"} /><ActivityFeed events={events} />{children}</div>;
}
