import type { WorkflowIntakeQuestion, WorkflowProjectContext, WorkflowRuleCondition } from "./workflow-rules";

export type WorkflowIntakeAnswers = Record<string, string | boolean>;

function matchesCondition(condition: WorkflowRuleCondition, answers: WorkflowIntakeAnswers, projectContext: WorkflowProjectContext) {
  if (condition.source === "review_outcome") return false;
  const actual = condition.source === "project"
    ? projectContext[condition.key as keyof WorkflowProjectContext]
    : answers[condition.key];
  if (actual === undefined) return false;
  if (condition.operator === "yes_no") return typeof actual === "boolean" && actual === condition.value;
  if (typeof actual !== "string") return false;
  if (condition.operator === "one_of") return (condition.values ?? []).includes(actual);
  return actual === condition.value;
}

export function getVisibleWorkflowIntakeQuestions(questions: WorkflowIntakeQuestion[], answers: WorkflowIntakeAnswers = {}, projectContext: WorkflowProjectContext = {}) {
  const visible: WorkflowIntakeQuestion[] = [];
  const visibleAnswers: WorkflowIntakeAnswers = {};
  for (const question of questions) {
    if (!(question.visibleWhen ?? []).every((condition) => matchesCondition(condition, visibleAnswers, projectContext))) continue;
    visible.push(question);
    if (question.key in answers) visibleAnswers[question.key] = answers[question.key];
  }
  return visible;
}

export function validateWorkflowIntakeAnswers(questions: WorkflowIntakeQuestion[], answers: WorkflowIntakeAnswers, projectContext: WorkflowProjectContext = {}) {
  const errors: string[] = [];
  const visibleQuestions = getVisibleWorkflowIntakeQuestions(questions, answers, projectContext);
  const visibleKeys = new Set(visibleQuestions.map((question) => question.key));
  for (const [key, value] of Object.entries(answers)) {
    if (!visibleKeys.has(key) && value !== undefined && value !== null) {
      errors.push(`${key} is hidden and cannot be submitted.`);
    }
  }
  for (const question of visibleQuestions) {
    const value = answers[question.key];
    const hasValue = typeof value === "boolean" || (typeof value === "string" && value.trim().length > 0);
    if (question.required && !hasValue) errors.push(`${question.label} is required.`);
    if (value === undefined || value === null || (typeof value === "string" && value.trim().length === 0)) continue;
    if (question.type === "yes_no") {
      if (typeof value !== "boolean") errors.push(`${question.label} must be answered Yes or No.`);
    } else if (typeof value !== "string") {
      errors.push(`${question.label} must be answered with text.`);
    } else if (question.type === "single_choice" && !(question.options ?? []).includes(value)) {
      errors.push(`Choose one of the listed options for ${question.label}.`);
    } else if (question.type === "date") {
      const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      const parsedDate = dateMatch ? new Date(`${value}T00:00:00.000Z`) : null;
      if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== value) {
        errors.push(`${question.label} must be a valid date in YYYY-MM-DD format.`);
      }
    }
  }
  return errors;
}
