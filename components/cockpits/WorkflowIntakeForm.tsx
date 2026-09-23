"use client";

import React from "react";
import type { WorkflowIntakeQuestion, WorkflowProjectContext } from "@/lib/workflow-rules";
import { getVisibleWorkflowIntakeQuestions, type WorkflowIntakeAnswers } from "@/lib/workflow-intake";

export function WorkflowIntakeForm({
  workflowVersionId,
  questions,
  answers,
  onAnswersChange,
  projectContext = {},
  disabled = false,
}: {
  workflowVersionId: string;
  questions: WorkflowIntakeQuestion[];
  answers: WorkflowIntakeAnswers;
  onAnswersChange: (answers: WorkflowIntakeAnswers) => void;
  projectContext?: WorkflowProjectContext;
  disabled?: boolean;
}) {
  const visibleQuestions = getVisibleWorkflowIntakeQuestions(questions, answers, projectContext);

  function updateAnswer(key: string, value: string | boolean) {
    const nextAnswers = { ...answers, [key]: value };
    const visibleKeys = new Set(getVisibleWorkflowIntakeQuestions(questions, nextAnswers, projectContext).map((question) => question.key));
    for (const answerKey of Object.keys(nextAnswers)) {
      if (!visibleKeys.has(answerKey)) delete nextAnswers[answerKey];
    }
    onAnswersChange(nextAnswers);
  }

  if (questions.length === 0) return null;
  return (
    <section data-workflow-version-id={workflowVersionId} className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/50 p-4">
      <div>
        <h3 className="text-sm font-black text-[#00284d]">A few questions for this permit</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">Your answers help the reviewing agency understand the request and select the right process.</p>
      </div>
      {visibleQuestions.map((question) => {
        const value = answers[question.key];
        return (
          <label key={question.key} className="block text-xs font-bold text-slate-700">
            {question.label}{question.required && <span className="ml-1 text-red-700" aria-label="required">*</span>}
            {question.type === "long_text" ? (
              <textarea value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(event) => updateAnswer(question.key, event.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
            ) : question.type === "single_choice" ? (
              <select value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(event) => updateAnswer(question.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                <option value="">Choose…</option>{(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : question.type === "yes_no" ? (
              <select value={typeof value === "boolean" ? String(value) : ""} disabled={disabled} onChange={(event) => updateAnswer(question.key, event.target.value === "true")} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
                <option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option>
              </select>
            ) : (
              <input type={question.type === "date" ? "date" : "text"} value={typeof value === "string" ? value : ""} disabled={disabled} onChange={(event) => updateAnswer(question.key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal" />
            )}
          </label>
        );
      })}
      {visibleQuestions.length === 0 && <p className="rounded-lg border border-dashed border-teal-300 bg-white/70 p-3 text-xs text-slate-600">No additional questions apply to your answers.</p>}
    </section>
  );
}
