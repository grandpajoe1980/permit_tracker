"use client";

import { AlertTriangle, Check, Circle, Clock3, Minus, PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WorkflowTemplateRecord } from "@/lib/domain-models";
import {
  buildWorkflowJourney,
  type WorkflowJourneySource,
  type WorkflowJourneyStage,
  type WorkflowJourneyStageState,
} from "@/lib/workflow-journey";

const stateLabel: Record<WorkflowJourneyStageState, string> = {
  completed: "Completed",
  current: "Now",
  waiting: "Waiting",
  blocked: "Blocked",
  upcoming: "Next",
  not_recorded: "History not recorded",
  waived: "Waived",
};

const stateClass: Record<WorkflowJourneyStageState, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  current: "border-teal-300 bg-teal-50 text-teal-900",
  waiting: "border-amber-300 bg-amber-50 text-amber-900",
  blocked: "border-rose-300 bg-rose-50 text-rose-900",
  upcoming: "border-slate-200 bg-slate-50 text-slate-700",
  not_recorded: "border-slate-200 bg-white text-slate-500",
  waived: "border-slate-200 bg-slate-100 text-slate-600",
};

function StageIcon({ state }: { state: WorkflowJourneyStageState }) {
  if (state === "completed" || state === "waived") return <Check className="size-3.5" aria-hidden="true" />;
  if (state === "waiting") return <PauseCircle className="size-3.5" aria-hidden="true" />;
  if (state === "blocked") return <AlertTriangle className="size-3.5" aria-hidden="true" />;
  if (state === "current") return <Clock3 className="size-3.5" aria-hidden="true" />;
  if (state === "not_recorded") return <Minus className="size-3.5" aria-hidden="true" />;
  return <Circle className="size-3.5" aria-hidden="true" />;
}
function displayDate(value?: string) {
  if (!value) return undefined;
  const date = new Date(`${value.length === 10 ? `${value}T12:00:00` : value}`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function stageLabel(stage: WorkflowJourneyStage, customerSafe: boolean) {
  return customerSafe ? stage.customerLabel : stage.label;
}

export function WorkflowMiniStepper({
  source,
  templates = [],
  customerSafe = false,
}: {
  source: WorkflowJourneySource;
  templates?: WorkflowTemplateRecord[];
  customerSafe?: boolean;
}) {
  const journey = buildWorkflowJourney(source, templates);
  const current = journey.currentStages[0];

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5" aria-label="Workflow progress">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <span className="font-black uppercase tracking-wider text-slate-500">Workflow progress</span>
        <span className="font-bold text-teal-800">{journey.stages.length > 0 ? `Step ${current?.sequence ?? journey.completedCount} of ${journey.stages.length}` : "Steps unavailable"}</span>
      </div>
      {journey.stages.length > 0 && (
        <div className="mt-2 flex items-center gap-1" aria-hidden="true">
          {journey.stages.map((stage) => <span key={stage.id} className={`h-1.5 min-w-0 flex-1 rounded-full ${stage.state === "completed" || stage.state === "waived" ? "bg-emerald-500" : stage.state === "current" ? "bg-teal-600" : stage.state === "blocked" || stage.state === "waiting" ? "bg-amber-500" : "bg-slate-200"}`} />)}
        </div>
      )}
      <p className="mt-2 text-xs font-semibold text-slate-700">{current ? `${stateLabel[current.state]}: ${stageLabel(current, customerSafe)}` : journey.summary}</p>
    </div>
  );
}

export function WorkflowJourney({
  source,
  templates = [],
  customerSafe = false,
  compact = false,
}: {
  source: WorkflowJourneySource;
  templates?: WorkflowTemplateRecord[];
  customerSafe?: boolean;
  compact?: boolean;
}) {
  const journey = buildWorkflowJourney(source, templates);
  if (compact) return <WorkflowMiniStepper source={source} templates={templates} customerSafe={customerSafe} />;

  const current = journey.currentStages[0];
  return (
    <section aria-label="Workflow journey" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Workflow journey</p>
          <h2 className="mt-1 text-lg font-black text-[#00284d]">What happened, what is happening, what happens next</h2>
        </div>
        <Badge className="border-teal-200 bg-teal-50 text-xs font-black text-teal-900">{journey.summary}</Badge>
      </div>
      {journey.stages.length === 0 ? (
        <p className="p-5 text-sm text-slate-600">Workflow steps are not available for this workstream yet.</p>
      ) : (
        <ol className="divide-y divide-slate-100">
          {journey.stages.map((stage) => {
            const isCurrent = stage.state === "current" || stage.state === "waiting" || stage.state === "blocked";
            return (
              <li key={stage.id} aria-current={isCurrent ? "step" : undefined} className={`flex gap-3 p-4 ${isCurrent ? "bg-teal-50/30" : ""}`}>
                <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-black ${stateClass[stage.state]}`}>
                  <StageIcon state={stage.state} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">Step {stage.sequence}</p>
                      <p className="mt-0.5 text-sm font-black text-[#00284d]">{stageLabel(stage, customerSafe)}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${stateClass[stage.state]}`}>{stateLabel[stage.state]}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    {stage.ownerOrgCode && <span><strong>{customerSafe ? "Owner" : "Agency"}:</strong> {stage.ownerOrgCode}</span>}
                    {!customerSafe && stage.ownerName && <span><strong>Assigned to:</strong> {stage.ownerName}</span>}
                    {stage.targetDate && <span><strong>{stage.state === "completed" ? "Completed" : "Target"}:</strong> {displayDate(stage.targetDate)}</span>}
                    {stage.targetDurationDays && <span>{stage.targetDurationDays} day target</span>}
                    {stage.isMilestoneGate && <span className="font-bold text-amber-800">Gate</span>}
                  </div>
                  {isCurrent && (
                    <div className="mt-3 rounded-lg border border-teal-200 bg-white p-3 text-xs leading-5 text-slate-700">
                      <p className="font-black text-teal-900">{stage.state === "blocked" ? "Blocked" : stage.state === "waiting" ? "Waiting" : "Current action"}</p>
                      <p className="mt-1">{stage.state === "blocked" || stage.state === "waiting" ? (source.waitingReason ?? `Waiting on ${source.waitingOnEntity ?? "a project dependency"}.`) : "This is the stage that can move the workstream forward now."}</p>
                      {!customerSafe && stage.requiredInputs.length > 0 && <p className="mt-1"><strong>Required inputs:</strong> {stage.requiredInputs.join(", ")}</p>}
                    </div>
                  )}
                  {stage.state === "completed" && stage.completionNotes && !customerSafe && (
                    <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs leading-5 text-emerald-950"><strong>Completion note:</strong> {stage.completionNotes}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {current && (source.forecastTargetDate || source.baselineTargetDate) && (
        <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
          <strong>Schedule:</strong> baseline {displayDate(source.baselineTargetDate) ?? "not set"} · forecast {displayDate(source.forecastTargetDate) ?? "not set"}
        </div>
      )}
    </section>
  );
}
