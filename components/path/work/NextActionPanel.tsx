"use client";

import React from "react";
import type { ActionDescriptor } from "@/lib/action-descriptors";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

type NextActionPanelProps = {
  nextAction: string;
  owner: string;
  removesFromQueue: string;
  descriptor?: ActionDescriptor | null;
  onTriggerAction?: () => void;
  disabledReason?: string;
};

export function NextActionPanel({
  nextAction,
  owner,
  removesFromQueue,
  descriptor,
  onTriggerAction,
  disabledReason,
}: NextActionPanelProps) {
  const reason = disabledReason ?? descriptor?.disabledReason;
  const isActionable = Boolean(descriptor?.eligible && onTriggerAction);

  return (
    <section
      aria-label="Your next action"
      className="rounded-xl border border-teal-300 bg-teal-50/80 p-5 shadow-sm space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Your next action</p>
          <p className="mt-1 text-base font-bold text-[#00284d]">{descriptor?.label ? `${descriptor.label}: ${nextAction}` : nextAction}</p>
        </div>
        {isActionable && (
          <Button
            type="button"
            onClick={onTriggerAction}
            className="bg-teal-700 hover:bg-teal-800 text-white font-bold inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <span>{descriptor?.label ?? "Take action"}</span>
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-teal-950 border-t border-teal-200/60 pt-2.5">
        <span><strong>Owner:</strong> {owner}</span>
        <span className="text-teal-400">·</span>
        <span>{removesFromQueue}</span>
        {descriptor?.expectedResult && (
          <>
            <span className="text-teal-400">·</span>
            <span className="text-xs text-teal-900 inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-teal-700 inline" />
              {descriptor.expectedResult}
            </span>
          </>
        )}
      </div>

      {reason && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900">
          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{reason}</span>
        </div>
      )}
    </section>
  );
}
