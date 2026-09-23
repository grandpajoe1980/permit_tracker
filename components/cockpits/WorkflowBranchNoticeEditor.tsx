"use client";

import React from "react";
import { ArrowDown, ArrowUp, BellRing, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkflowStageRecord } from "@/lib/domain-models";
import type { WorkflowIntakeQuestion, WorkflowNoticeTemplate, WorkflowRuleCondition, WorkflowStageBranch } from "@/lib/workflow-rules";
import { ConditionListEditor, conditionSummary } from "./WorkflowRuleBuilder";

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const noticeTriggers: Array<{ value: WorkflowNoticeTemplate["trigger"]; label: string; help: string }> = [
  { value: "request_routed", label: "Request routed", help: "Sent when the request is assigned to a workflow and agency." },
  { value: "stage_completed", label: "Stage completed", help: "Sent when a configured workflow stage is completed." },
  { value: "review_outcome", label: "Review outcome recorded", help: "Sent when a reviewer records an outcome." },
];

export function WorkflowBranchNoticeEditor({
  stages,
  questions,
  branches,
  noticeTemplates,
  onBranchesChange,
  onNoticeTemplatesChange,
  readOnly = false,
}: {
  stages: WorkflowStageRecord[];
  questions: WorkflowIntakeQuestion[];
  branches: WorkflowStageBranch[];
  noticeTemplates: WorkflowNoticeTemplate[];
  onBranchesChange: (branches: WorkflowStageBranch[]) => void;
  onNoticeTemplatesChange: (templates: WorkflowNoticeTemplate[]) => void;
  readOnly?: boolean;
}) {
  const sortedBranches = [...branches].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  function updateBranch(id: string, change: Partial<WorkflowStageBranch>) {
    onBranchesChange(branches.map((branch) => branch.id === id ? { ...branch, ...change } : branch));
  }
  function moveBranch(index: number, direction: -1 | 1) {
    const next = [...sortedBranches];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onBranchesChange(next.map((branch, branchIndex) => ({ ...branch, priority: branchIndex + 1 })));
  }
  function addBranch() {
    const firstStage = stages[0]?.stageKey ?? "";
    const nextStage = stages[1]?.stageKey ?? firstStage;
    onBranchesChange([...branches, {
      id: newId("branch"),
      fromStageKey: firstStage,
      toStageKey: nextStage,
      priority: branches.length + 1,
      conditions: [] as WorkflowRuleCondition[],
    }]);
  }
  function updateNotice(id: string, change: Partial<WorkflowNoticeTemplate>) {
    onNoticeTemplatesChange(noticeTemplates.map((template) => template.id === id ? { ...template, ...change } : template));
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-black text-[#00284d]">Conditional stage paths</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">A matching branch takes the request from one stage to another. Conditions are checked in priority order; with no match, the normal next-stage path remains in effect.</p>
        </div>
        {sortedBranches.map((branch, index) => (
          <div key={branch.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-900">Branch priority {branch.priority ?? 0}</p>
              {!readOnly && <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" aria-label="Move branch up" disabled={index === 0} onClick={() => moveBranch(index, -1)} className="size-8"><ArrowUp className="size-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Move branch down" disabled={index === sortedBranches.length - 1} onClick={() => moveBranch(index, 1)} className="size-8"><ArrowDown className="size-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove stage branch" onClick={() => onBranchesChange(branches.filter((item) => item.id !== branch.id))} className="size-8 text-slate-500 hover:text-red-700"><Trash2 className="size-4" /></Button>
              </div>}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <label className="text-[11px] font-bold text-slate-600">From stage
                <select value={branch.fromStageKey} disabled={readOnly} onChange={(event) => updateBranch(branch.id, { fromStageKey: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs">
                  {stages.map((stage) => <option key={stage.stageKey} value={stage.stageKey}>{stage.sequenceOrder}. {stage.name}</option>)}
                </select>
              </label>
              <span className="pb-2 text-xs font-black uppercase tracking-wider text-teal-800">When … then go to</span>
              <label className="text-[11px] font-bold text-slate-600">Next stage
                <select value={branch.toStageKey} disabled={readOnly} onChange={(event) => updateBranch(branch.id, { toStageKey: event.target.value })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs">
                  {stages.map((stage) => <option key={stage.stageKey} value={stage.stageKey}>{stage.sequenceOrder}. {stage.name}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Branch conditions</p>
              <ConditionListEditor conditions={branch.conditions} questions={questions} onChange={(conditions) => updateBranch(branch.id, { conditions })} addLabel="Add branch condition" readOnly={readOnly} />
              {branch.conditions.length === 0 && <p className="mb-2 text-xs text-amber-800">This branch is unconditional. It takes precedence over any lower priority branch.</p>}
            </div>
            <p className="mt-3 text-xs text-slate-600"><strong className="text-slate-800">Path preview:</strong> From {stages.find((stage) => stage.stageKey === branch.fromStageKey)?.name ?? branch.fromStageKey}, {branch.conditions.length ? `when ${branch.conditions.map((condition) => conditionSummary(condition, questions)).join(" and ")}` : "for every request"}, continue to {stages.find((stage) => stage.stageKey === branch.toStageKey)?.name ?? branch.toStageKey}.</p>
          </div>
        ))}
        {!readOnly && <Button type="button" variant="outline" size="sm" onClick={addBranch} disabled={stages.length < 2} className="font-bold text-xs"><Plus className="mr-1 size-3.5" /> Add stage branch</Button>}
        {readOnly && branches.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No conditional branches configured. Stages follow their standard next-step flow.</p>}
      </section>

      <section className="space-y-3 border-t border-slate-200 pt-5">
        <div className="flex items-start gap-2">
          <BellRing className="mt-0.5 size-4 text-teal-800" />
          <div>
            <h3 className="text-sm font-black text-[#00284d]">In-app notices</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Choose whether each in-app notice goes to the customer, assigned team, or both. These templates are saved with this workflow version.</p>
          </div>
        </div>
        {noticeTemplates.map((template) => {
          const trigger = noticeTriggers.find((item) => item.value === template.trigger);
          return (
            <div key={template.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-600">Send notice when
                  <select value={template.trigger} disabled={readOnly} onChange={(event) => updateNotice(template.id, { trigger: event.target.value as WorkflowNoticeTemplate["trigger"] })} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs">
                    {noticeTriggers.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-bold text-slate-600">Recipients
                  <select value={template.audience ?? "both"} disabled={readOnly} onChange={(event) => updateNotice(template.id, { audience: event.target.value as WorkflowNoticeTemplate["audience"] })} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs">
                    <option value="customer">Customer</option>
                    <option value="team">Assigned team</option>
                    <option value="both">Customer and team</option>
                  </select>
                </label>
                {!readOnly && <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${trigger?.label ?? "notice"} template`} onClick={() => onNoticeTemplatesChange(noticeTemplates.filter((item) => item.id !== template.id))} className="size-8 text-slate-500 hover:text-red-700"><Trash2 className="size-4" /></Button>}
              </div>
              <p className="mt-1 text-[11px] text-slate-500">In-app notification · {trigger?.help}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-[11px] font-bold text-slate-600">Notice title
                  <input value={template.title} disabled={readOnly} onChange={(event) => updateNotice(template.id, { title: event.target.value })} placeholder="Your request has been routed" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs" />
                </label>
                <label className="text-[11px] font-bold text-slate-600">Message
                  <textarea rows={2} value={template.body} disabled={readOnly} onChange={(event) => updateNotice(template.id, { body: event.target.value })} placeholder="We sent your request to the reviewing agency." className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs" />
                </label>
              </div>
              <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50 p-3" aria-live="polite">
                <p className="text-[10px] font-black uppercase tracking-wider text-teal-900">{template.audience === "team" ? "Team notice preview" : template.audience === "customer" ? "Customer notice preview" : "Customer and team notice preview"}</p>
                <p className="mt-1 text-xs font-bold text-slate-900">{template.title || "Notice title"}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{template.body || "Your message will appear here."}</p>
              </div>
            </div>
          );
        })}
        {!readOnly && <Button type="button" variant="outline" size="sm" onClick={() => onNoticeTemplatesChange([...noticeTemplates, { id: newId("notice"), trigger: "request_routed", audience: "both", title: "", body: "" }])} className="font-bold text-xs"><Plus className="mr-1 size-3.5" /> Add in-app notice</Button>}
        {readOnly && noticeTemplates.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No in-app notice templates configured.</p>}
      </section>
    </div>
  );
}
