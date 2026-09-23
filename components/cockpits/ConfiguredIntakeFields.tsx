"use client";

import React from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkflowIntakeQuestion, WorkflowProjectContext } from "@/lib/workflow-rules";
import { getVisibleWorkflowIntakeQuestions } from "@/lib/workflow-intake";
import { ConditionListEditor, conditionSummary } from "./WorkflowRuleBuilder";

function newQuestionKey(questions: WorkflowIntakeQuestion[]) {
  let number = questions.length + 1;
  let key = `question_${number}`;
  while (questions.some((question) => question.key === key)) key = `question_${++number}`;
  return key;
}

function normalizeChoice(options: string[] | undefined) {
  return options?.filter(Boolean) ?? [];
}

export function ConfiguredIntakeFields({
  questions,
  onChange,
  readOnly = false,
}: {
  questions: WorkflowIntakeQuestion[];
  onChange: (questions: WorkflowIntakeQuestion[]) => void;
  readOnly?: boolean;
}) {
  const [sampleAnswers, setSampleAnswers] = React.useState<Record<string, string | boolean>>({});
  const [sampleProjectContext, setSampleProjectContext] = React.useState<WorkflowProjectContext>({});
  const visibleQuestions = getVisibleWorkflowIntakeQuestions(questions, sampleAnswers, sampleProjectContext);
  function updateQuestion(key: string, nextQuestion: WorkflowIntakeQuestion) {
    onChange(questions.map((question) => question.key === key ? nextQuestion : question));
  }
  function addQuestion() {
    const key = newQuestionKey(questions);
    onChange([...questions, { key, label: "New question", type: "text", required: false }]);
  }
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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-black text-[#00284d]">Customer questions</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">These questions appear in the request intake. A question can depend on an earlier answer, so customers only see what applies to them.</p>
      </div>

      {questions.map((question, index) => {
        const choiceOptions = normalizeChoice(question.options);
        const priorQuestions = questions.slice(0, index);
        return (
          <section key={question.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-600">Question {index + 1}</span>
                  <code className="text-[10px] font-bold text-teal-800">{question.key}</code>
                </div>
                <label className="mt-3 block text-[11px] font-bold text-slate-600">Customer-facing question
                  <input value={question.label} disabled={readOnly} onChange={(event) => updateQuestion(question.key, { ...question, label: event.target.value })} placeholder="What are you planning to build?" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900" />
                </label>
              </div>
              {!readOnly && <Button type="button" variant="ghost" size="icon" aria-label={`Remove question ${index + 1}`} onClick={() => { onChange(questions.filter((item) => item.key !== question.key)); setSampleAnswers((answers) => { const next = { ...answers }; delete next[question.key]; return next; }); }} className="size-8 text-slate-500 hover:text-red-700"><Trash2 className="size-4" /></Button>}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-[11px] font-bold text-slate-600">Answer type
                <select value={question.type} disabled={readOnly} onChange={(event) => updateQuestion(question.key, { ...question, type: event.target.value as WorkflowIntakeQuestion["type"], options: event.target.value === "single_choice" ? (question.options ?? []) : undefined })} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs">
                  <option value="text">Short answer</option>
                  <option value="long_text">Long answer</option>
                  <option value="single_choice">Choose one</option>
                  <option value="yes_no">Yes / No</option>
                  <option value="date">Date</option>
                </select>
              </label>
              <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700">
                <input type="checkbox" checked={question.required} disabled={readOnly} onChange={(event) => updateQuestion(question.key, { ...question, required: event.target.checked })} className="size-4 accent-teal-700" />
                Required question
              </label>
            </div>

            {question.type === "single_choice" && <label className="mt-3 block text-[11px] font-bold text-slate-600">Choice options (one per line)
              <textarea rows={Math.max(2, Math.min(5, choiceOptions.length || 2))} value={choiceOptions.join("\n")} disabled={readOnly} onChange={(event) => updateQuestion(question.key, { ...question, options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) })} placeholder={"New construction\nModification\nRepair"} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs" />
            </label>}

            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">Show this question when</p>
              <ConditionListEditor conditions={question.visibleWhen ?? []} questions={priorQuestions} onChange={(visibleWhen) => updateQuestion(question.key, { ...question, visibleWhen: visibleWhen.length ? visibleWhen : undefined })} addLabel="Add show condition" readOnly={readOnly} allowReviewOutcome={false} />
              {(question.visibleWhen ?? []).length > 0 && <p className="mt-2 text-[11px] text-slate-500">All conditions must be true: {(question.visibleWhen ?? []).map((condition) => conditionSummary(condition, questions)).join(" and ")}.</p>}
            </div>
          </section>
        );
      })}
      {!readOnly && <Button type="button" variant="outline" size="sm" onClick={addQuestion} className="font-bold text-xs"><Plus className="mr-1 size-3.5" /> Add customer question</Button>}
      {readOnly && questions.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">No customer questions configured for this workflow.</p>}

      <section className="overflow-hidden rounded-xl border border-teal-200 bg-white">
        <div className="flex items-start gap-2 border-b border-teal-100 bg-teal-50/70 p-4">
          <Eye className="mt-0.5 size-4 text-teal-800" />
          <div>
            <h3 className="text-sm font-black text-[#00284d]">Sample-answer preview</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Try sample answers to see which conditional questions customers will get.</p>
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
            {visibleQuestions.length === 0 ? <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">No questions are visible for these sample answers.</p> : visibleQuestions.map((question) => {
              const value = sampleAnswers[question.key] ?? (question.type === "yes_no" ? false : "");
              return <label key={question.key} className="block text-xs font-bold text-slate-700">{question.label}{question.required && <span className="ml-1 text-red-600">*</span>}
                {question.type === "long_text" ? <textarea rows={2} value={String(value)} onChange={(event) => updateSampleAnswer(question.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-normal" />
                  : question.type === "single_choice" ? <select value={String(value)} onChange={(event) => updateSampleAnswer(question.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-normal"><option value="">Choose…</option>{choiceOptionsFor(question).map((option) => <option key={option} value={option}>{option}</option>)}</select>
                    : question.type === "yes_no" ? <select value={String(value === true)} onChange={(event) => updateSampleAnswer(question.key, event.target.value === "true")} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-normal"><option value="false">No</option><option value="true">Yes</option></select>
                      : <input type={question.type === "date" ? "date" : "text"} value={String(value)} onChange={(event) => updateSampleAnswer(question.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-normal" />}
              </label>;
            })}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Customer view</p>
            <ol className="mt-3 space-y-3">
              {visibleQuestions.map((question, index) => <li key={question.key} className="flex gap-2 text-xs text-slate-700"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#00284d] text-[10px] font-black text-white">{index + 1}</span><span>{question.label || "Question label"}{question.required && <span className="ml-1 font-bold text-red-700">Required</span>}</span></li>)}
            </ol>
            {visibleQuestions.length === 0 && <p className="mt-3 text-xs text-slate-500">Questions appear here when their conditions are met.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function choiceOptionsFor(question: WorkflowIntakeQuestion) {
  return normalizeChoice(question.options);
}
