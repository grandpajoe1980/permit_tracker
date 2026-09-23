"use client";

import React from "react";
import { ArrowDown, ArrowUp, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrganizationRecord } from "@/lib/domain-models";
import type { WorkflowIntakeQuestion, WorkflowProjectContext, WorkflowRuleCondition, WorkflowRoutingRule } from "@/lib/workflow-rules";
import { evaluateRoutingRules } from "@/lib/workflow-rules";
import { getVisibleWorkflowIntakeQuestions, type WorkflowIntakeAnswers } from "@/lib/workflow-intake";

const projectFields: Array<{ key: keyof WorkflowProjectContext; label: string }> = [
  { key: "projectId", label: "Project ID" },
  { key: "projectNumber", label: "Project number" },
  { key: "projectType", label: "Project type" },
  { key: "customerOrganizationId", label: "Customer organization" },
  { key: "leadOrganizationId", label: "Lead organization" },
];

type WorkflowOption = { id: string; label: string };
type AssignmentOption = { id: string; name: string; orgCode: string };
type PersonOption = { id: string; name: string };

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function conditionSummary(condition: WorkflowRuleCondition, questions: WorkflowIntakeQuestion[]) {
  const question = questions.find((item) => item.key === condition.key);
  const subject = condition.source === "review_outcome" ? "review outcome" : condition.source === "project" ? projectFields.find((field) => field.key === condition.key)?.label ?? "project" : question?.label ?? condition.key;
  if (condition.operator === "yes_no") return `${subject} is ${condition.value === true ? "Yes" : "No"}`;
  if (condition.operator === "one_of") return `${subject} is one of ${(condition.values ?? []).join(", ") || "…"}`;
  return `${subject} ${condition.operator === "equals" ? "is" : condition.operator} ${String(condition.value ?? "…")}`;
}

function ConditionEditor({
  condition,
  questions,
  onChange,
  onRemove,
  readOnly = false,
  allowReviewOutcome = true,
  allowProjectContext = true,
}: {
  condition: WorkflowRuleCondition;
  questions: WorkflowIntakeQuestion[];
  onChange: (next: WorkflowRuleCondition) => void;
  onRemove: () => void;
  readOnly?: boolean;
  allowReviewOutcome?: boolean;
  allowProjectContext?: boolean;
}) {
  const source = condition.source ?? "answer";
  const firstQuestion = questions[0]?.key ?? "";
  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:grid-cols-[minmax(8rem,0.8fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_minmax(8rem,1fr)_auto] sm:items-center">
      <select
        aria-label="Condition source"
        disabled={readOnly}
        value={source}
        onChange={(event) => {
          const nextSource = event.target.value as "answer" | "review_outcome" | "project";
          onChange({ ...condition, source: nextSource, key: nextSource === "answer" ? firstQuestion : nextSource === "review_outcome" ? "review_outcome" : "projectType", operator: nextSource !== "answer" && condition.operator === "yes_no" ? "equals" : condition.operator, value: nextSource !== "answer" && condition.operator === "yes_no" ? "" : condition.value });
        }}
        className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-xs"
      >
        <option value="answer">Customer answer</option>
        {allowReviewOutcome && <option value="review_outcome">Review outcome</option>}
        {allowProjectContext && <option value="project">Project details</option>}
      </select>
      {source === "answer" ? (
        <select
          aria-label="Question for condition"
          disabled={readOnly}
          value={condition.key}
          onChange={(event) => onChange({ ...condition, key: event.target.value })}
          className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-xs"
        >
          <option value="">Choose a question</option>
          {questions.map((question) => <option key={question.key} value={question.key}>{question.label}</option>)}
        </select>
      ) : source === "review_outcome" ? <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-600">Review outcome</div> : (
        <select aria-label="Project field" disabled={readOnly} value={condition.key} onChange={(event) => onChange({ ...condition, key: event.target.value })} className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-xs">
          {projectFields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
        </select>
      )}
      <select
          aria-label="Condition match"
        disabled={readOnly}
        value={condition.operator}
        onChange={(event) => {
          const operator = event.target.value as WorkflowRuleCondition["operator"];
          onChange({ ...condition, operator, value: operator === "yes_no" ? true : "", values: operator === "one_of" ? [] : undefined });
        }}
        className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-xs"
      >
        <option value="equals">equals</option>
        <option value="one_of">is one of</option>
        {source === "answer" && <option value="yes_no">is Yes / No</option>}
      </select>
      {condition.operator === "yes_no" ? (
        <select
          aria-label="Yes or no value"
          disabled={readOnly}
          value={String(condition.value === true)}
          onChange={(event) => onChange({ ...condition, value: event.target.value === "true" })}
          className="rounded-md border border-slate-300 px-2 py-2 text-xs"
        >
          <option value="true">Yes</option><option value="false">No</option>
        </select>
      ) : condition.operator === "one_of" ? (
        <input
          aria-label="Accepted values"
          disabled={readOnly}
          value={(condition.values ?? []).join(", ")}
          onChange={(event) => onChange({ ...condition, values: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}
          placeholder="Separate values with commas"
          className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-xs"
        />
      ) : (
        <input
          aria-label="Matching answer"
          disabled={readOnly}
          value={String(condition.value ?? "")}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
          placeholder="Enter a value"
          className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-xs"
        />
      )}
      {!readOnly && <Button type="button" variant="ghost" size="icon" aria-label="Remove condition" onClick={onRemove} className="size-8 text-slate-500 hover:text-red-700">
        <Trash2 className="size-3.5" />
      </Button>}
    </div>
  );
}

export function ConditionListEditor({
  conditions,
  questions,
  onChange,
  addLabel = "Add condition",
  readOnly = false,
  allowReviewOutcome = true,
  allowProjectContext = true,
}: {
  conditions: WorkflowRuleCondition[];
  questions: WorkflowIntakeQuestion[];
  onChange: (conditions: WorkflowRuleCondition[]) => void;
  addLabel?: string;
  readOnly?: boolean;
  allowReviewOutcome?: boolean;
  allowProjectContext?: boolean;
}) {
  function patch(index: number, condition: WorkflowRuleCondition) {
    onChange(conditions.map((item, itemIndex) => itemIndex === index ? condition : item));
  }
  return (
    <div className="space-y-2">
      {conditions.map((condition, index) => (
        <React.Fragment key={`${index}-${condition.key}`}>
          {index > 0 && <p className="ml-2 text-[10px] font-black uppercase tracking-wider text-slate-400">And</p>}
          <ConditionEditor condition={condition} questions={questions} onChange={(next) => patch(index, next)} onRemove={() => onChange(conditions.filter((_, itemIndex) => itemIndex !== index))} readOnly={readOnly} allowReviewOutcome={allowReviewOutcome} allowProjectContext={allowProjectContext} />
        </React.Fragment>
      ))}
      {!readOnly && <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...conditions, { source: "answer", key: questions[0]?.key ?? "", operator: "equals", value: "" }])}
        className="h-8 text-[11px] font-bold"
      >
        <Plus className="mr-1 size-3" /> {addLabel}
      </Button>}
    </div>
  );
}

export function RuleBuilder({
  rules,
  questions,
  workflows,
  permitTypes,
  organizations,
  assignmentGroups,
  people,
  autoRouteEnabled,
  onAutoRouteEnabledChange,
  onChange,
  readOnly = false,
}: {
  rules: WorkflowRoutingRule[];
  questions: WorkflowIntakeQuestion[];
  workflows: WorkflowOption[];
  permitTypes: WorkflowOption[];
  organizations: OrganizationRecord[];
  assignmentGroups: AssignmentOption[];
  people: PersonOption[];
  autoRouteEnabled: boolean;
  onAutoRouteEnabledChange: (enabled: boolean) => void;
  onChange: (rules: WorkflowRoutingRule[]) => void;
  readOnly?: boolean;
}) {
  const [sampleAnswers, setSampleAnswers] = React.useState<WorkflowIntakeAnswers>({});
  const [sampleProjectContext, setSampleProjectContext] = React.useState<WorkflowProjectContext>({});
  const sortedRules = [...rules].sort((a, b) => a.priority - b.priority);
  const sampleQuestions = getVisibleWorkflowIntakeQuestions(questions, sampleAnswers, sampleProjectContext);
  const matchedRule = evaluateRoutingRules(sortedRules, sampleAnswers, sampleProjectContext);
  function updateSampleAnswer(key: string, value: string | boolean) {
    const nextAnswers = { ...sampleAnswers, [key]: value };
    const visibleKeys = new Set(getVisibleWorkflowIntakeQuestions(questions, nextAnswers, sampleProjectContext).map((question) => question.key));
    for (const answerKey of Object.keys(nextAnswers)) if (!visibleKeys.has(answerKey)) delete nextAnswers[answerKey];
    setSampleAnswers(nextAnswers);
  }
  function updateSampleProjectContext(key: keyof WorkflowProjectContext, value: string) {
    const nextContext = { ...sampleProjectContext, [key]: value || undefined };
    const visibleKeys = new Set(getVisibleWorkflowIntakeQuestions(questions, sampleAnswers, nextContext).map((question) => question.key));
    setSampleProjectContext(nextContext);
    setSampleAnswers((answers) => Object.fromEntries(Object.entries(answers).filter(([answerKey]) => visibleKeys.has(answerKey))));
  }
  function update(ruleId: string, change: Partial<WorkflowRoutingRule>) {
    onChange(rules.map((rule) => rule.id === ruleId ? { ...rule, ...change } : rule));
  }
  function move(index: number, direction: -1 | 1) {
    const next = [...sortedRules];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((rule, ruleIndex) => ({ ...rule, priority: ruleIndex + 1 })));
  }
  function addRule() {
    onChange([...rules, {
      id: newId("routing"),
      name: "New routing rule",
      priority: rules.length + 1,
      conditions: [],
      destination: {
        permitTypeId: permitTypes[0]?.id,
        workflowVersionId: workflows[0]?.id ?? "",
        leadOrgCode: organizations[0]?.code ?? "",
        leadOrgName: organizations[0]?.name,
      },
    }]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-black text-[#00284d]">Automatic intake routing</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">Rules are checked from highest priority to lowest. The first match selects the destination; if no rule matches, staff route the request manually.</p>
        </div>
        <label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          <input type="checkbox" checked={autoRouteEnabled} disabled={readOnly} onChange={(event) => onAutoRouteEnabledChange(event.target.checked)} className="size-4 accent-teal-700" />
          Enable automatic routing
        </label>
      </div>
      {sortedRules.map((rule, index) => {
        const chosenGroup = assignmentGroups.find((group) => group.id === rule.destination.assignmentGroupId);
        const eligibleGroups = assignmentGroups.filter((group) => !rule.destination.leadOrgCode || group.orgCode.toUpperCase() === rule.destination.leadOrgCode.toUpperCase());
        return (
          <section key={rule.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-teal-900">Priority {rule.priority}</span>
                <input aria-label={`Routing rule ${index + 1} name`} value={rule.name} disabled={readOnly} onChange={(event) => update(rule.id, { name: event.target.value })} className="min-w-0 rounded border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-800" />
              </div>
              {!readOnly && <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" title="Increase priority" aria-label="Move routing rule up" disabled={index === 0} onClick={() => move(index, -1)} className="size-8"><ArrowUp className="size-4" /></Button>
                <Button type="button" size="icon" variant="ghost" title="Decrease priority" aria-label="Move routing rule down" disabled={index === sortedRules.length - 1} onClick={() => move(index, 1)} className="size-8"><ArrowDown className="size-4" /></Button>
                <Button type="button" size="icon" variant="ghost" aria-label="Remove routing rule" onClick={() => onChange(rules.filter((item) => item.id !== rule.id))} className="size-8 text-slate-500 hover:text-red-700"><Trash2 className="size-4" /></Button>
              </div>}
            </div>

            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">When these conditions match</p>
              <ConditionListEditor conditions={rule.conditions} questions={questions} onChange={(conditions) => update(rule.id, { conditions })} addLabel="Add condition" readOnly={readOnly} />
              {rule.conditions.length === 0 && <p className="mb-2 text-xs text-amber-800">This rule has no conditions and will match every request at its priority.</p>}
            </div>

            <div className="mt-3 rounded-lg border border-teal-100 bg-teal-50/50 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-teal-900">Then route to</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-[11px] font-bold text-slate-600">Workflow version
                  <select value={rule.destination.workflowVersionId} disabled={readOnly} onChange={(event) => update(rule.id, { destination: { ...rule.destination, workflowVersionId: event.target.value } })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs">
                    <option value="">Choose a published workflow</option>
                    {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.label}</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-bold text-slate-600">Lead agency
                  <select value={rule.destination.leadOrgCode} disabled={readOnly} onChange={(event) => { const organization = organizations.find((item) => item.code === event.target.value); update(rule.id, { destination: { ...rule.destination, leadOrgCode: event.target.value, leadOrgName: organization?.name, assignmentGroupId: undefined, assignedToUserId: undefined } }); }} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs">
                    <option value="">Choose an agency</option>
                    {organizations.map((organization) => <option key={organization.id} value={organization.code}>{organization.code} — {organization.name}</option>)}
                  </select>
                </label>
                {permitTypes.length > 0 && <label className="text-[11px] font-bold text-slate-600">Permit type (optional)
                  <select value={rule.destination.permitTypeId ?? ""} disabled={readOnly} onChange={(event) => update(rule.id, { destination: { ...rule.destination, permitTypeId: event.target.value || undefined } })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs">
                    <option value="">Use the selected service</option>{permitTypes.map((permit) => <option key={permit.id} value={permit.id}>{permit.label}</option>)}
                  </select>
                </label>}
                <label className="text-[11px] font-bold text-slate-600">Assignment team {autoRouteEnabled ? "(required)" : "(optional)"}
                  <select value={rule.destination.assignmentGroupId ?? ""} disabled={readOnly} onChange={(event) => update(rule.id, { destination: { ...rule.destination, assignmentGroupId: event.target.value || undefined, assignedToUserId: undefined } })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs">
                    <option value="">No team preset</option>{eligibleGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                  {autoRouteEnabled && !rule.destination.assignmentGroupId && <span className="mt-1 block font-normal text-amber-800">Choose a team while automatic routing is enabled.</span>}
                </label>
                {people.length > 0 && <label className="text-[11px] font-bold text-slate-600">Assigned reviewer (optional)
                  <select value={rule.destination.assignedToUserId ?? ""} disabled={readOnly || !chosenGroup} onChange={(event) => update(rule.id, { destination: { ...rule.destination, assignedToUserId: event.target.value || undefined } })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs">
                    <option value="">Team queue</option>{people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>}
                <label className="text-[11px] font-bold text-slate-600">Target date (optional)
                  <input type="date" value={rule.destination.targetDate ?? ""} disabled={readOnly} onChange={(event) => update(rule.id, { destination: { ...rule.destination, targetDate: event.target.value || undefined } })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs" />
                </label>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600"><strong className="text-slate-800">Rule preview:</strong> When {rule.conditions.length ? rule.conditions.map((condition) => conditionSummary(condition, questions)).join(" and ") : "any request is submitted"}, then route to {workflows.find((workflow) => workflow.id === rule.destination.workflowVersionId)?.label ?? "the selected workflow"} led by {rule.destination.leadOrgName || rule.destination.leadOrgCode || "the selected agency"}{chosenGroup ? `, assigned to ${chosenGroup.name}` : ""}.</p>
          </section>
        );
      })}
      {!readOnly && <Button type="button" variant="outline" size="sm" onClick={addRule} className="font-bold text-xs"><Plus className="mr-1 size-3.5" /> Add routing rule</Button>}
      {readOnly && rules.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No routing rules configured. Requests will be routed manually.</p>}
      <section className="overflow-hidden rounded-xl border border-teal-200 bg-white">
        <div className="flex items-start gap-2 border-b border-teal-100 bg-teal-50/70 p-4">
          <Eye className="mt-0.5 size-4 text-teal-800" />
          <div>
            <h3 className="text-sm font-black text-[#00284d]">Sample-answer routing preview</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Try sample answers to see which priority rule would choose the destination.</p>
          </div>
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
              <p className="sm:col-span-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Sample project details</p>
              {([
                ["projectId", "Project ID"],
                ["projectNumber", "Project number"],
                ["projectType", "Project type"],
                ["customerOrganizationId", "Customer organization ID"],
                ["leadOrganizationId", "Lead organization ID"],
              ] as const).map(([key, label]) => <label key={key} className="text-[10px] font-bold text-slate-600">{label}<input value={sampleProjectContext[key] ?? ""} onChange={(event) => updateSampleProjectContext(key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal" /></label>)}
            </div>
            {sampleQuestions.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Add an intake question to test answer based routing.</p> : sampleQuestions.map((question) => {
              const value = sampleAnswers[question.key];
              return <label key={question.key} className="block text-xs font-bold text-slate-700">{question.label}
                {question.type === "yes_no" ? <select value={typeof value === "boolean" ? String(value) : ""} onChange={(event) => updateSampleAnswer(question.key, event.target.value === "true")} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-normal"><option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option></select>
                  : question.type === "single_choice" ? <select value={typeof value === "string" ? value : ""} onChange={(event) => updateSampleAnswer(question.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-normal"><option value="">Choose…</option>{(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}</select>
                    : <input type={question.type === "date" ? "date" : "text"} value={typeof value === "string" ? value : ""} onChange={(event) => updateSampleAnswer(question.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-normal" />}
              </label>;
            })}
          </div>
          <div className={`rounded-lg border p-4 ${matchedRule ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`} aria-live="polite">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Result</p>
            {matchedRule ? <>
              <p className="mt-2 text-sm font-black text-emerald-950">{autoRouteEnabled ? "Would route automatically" : "First matching route"}</p>
              <p className="mt-1 text-xs text-emerald-900">{matchedRule.name} · Priority {matchedRule.priority}</p>
              <p className="mt-2 text-xs leading-5 text-emerald-950">{workflows.find((workflow) => workflow.id === matchedRule.destination.workflowVersionId)?.label ?? "Selected workflow"} · {matchedRule.destination.leadOrgName || matchedRule.destination.leadOrgCode}{matchedRule.destination.assignmentGroupId ? ` · ${assignmentGroups.find((group) => group.id === matchedRule.destination.assignmentGroupId)?.name ?? "Selected team"}` : ""}</p>
            </> : <>
              <p className="mt-2 text-sm font-bold text-slate-800">No rule matched</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">The request stays in the manual routing queue.</p>
            </>}
          </div>
        </div>
      </section>
    </div>
  );
}
