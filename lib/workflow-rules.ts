import type {
  AssignmentGroupRecord,
  OrganizationRecord,
  WorkflowStageRecord,
} from "./domain-models";

export type WorkflowIntakeQuestionType = "text" | "long_text" | "single_choice" | "yes_no" | "date";
export type WorkflowConditionSource = "answer" | "review_outcome" | "project";
export type WorkflowConditionOperator = "equals" | "one_of" | "yes_no";

export interface WorkflowRuleCondition {
  source?: WorkflowConditionSource;
  key: string;
  operator: WorkflowConditionOperator;
  value?: string | boolean;
  values?: string[];
}

export interface WorkflowIntakeQuestion {
  key: string;
  label: string;
  type: WorkflowIntakeQuestionType;
  required: boolean;
  options?: string[];
  visibleWhen?: WorkflowRuleCondition[];
}

export interface WorkflowRouteDestination {
  permitTypeId?: string;
  workflowVersionId: string;
  leadOrgCode: string;
  leadOrgName?: string;
  assignmentGroupId?: string;
  assignedToUserId?: string;
  targetDate?: string;
}

export interface WorkflowRoutingRule {
  id: string;
  name: string;
  priority: number;
  conditions: WorkflowRuleCondition[];
  destination: WorkflowRouteDestination;
}

export interface WorkflowStageBranch {
  id: string;
  fromStageKey: string;
  priority?: number;
  conditions: WorkflowRuleCondition[];
  toStageKey: string;
}

export interface WorkflowNoticeTemplate {
  id: string;
  trigger: "request_routed" | "stage_completed" | "review_outcome";
  audience?: "customer" | "team" | "both";
  title: string;
  body: string;
}

export interface WorkflowAutomationConfig {
  intakeQuestions: WorkflowIntakeQuestion[];
  routingRules: WorkflowRoutingRule[];
  stageBranches: WorkflowStageBranch[];
  noticeTemplates: WorkflowNoticeTemplate[];
  autoRouteEnabled: boolean;
}

export interface WorkflowAutomationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

type Answers = Record<string, string | boolean | null | undefined>;
export interface WorkflowProjectContext {
  projectId?: string;
  projectNumber?: string;
  projectType?: string;
  customerOrganizationId?: string;
  leadOrganizationId?: string;
}

function normalizedSource(condition: WorkflowRuleCondition): WorkflowConditionSource {
  return condition.source ?? "answer";
}

function conditionField(condition: WorkflowRuleCondition): string {
  return `${normalizedSource(condition)}:${condition.key}`;
}

function allowedValues(condition: WorkflowRuleCondition): Set<string | boolean> | null {
  if (condition.operator === "one_of") return new Set(condition.values ?? []);
  if (condition.operator === "equals" || condition.operator === "yes_no") {
    return condition.value === undefined ? null : new Set([condition.value]);
  }
  return null;
}

function intersect(left: Set<string | boolean> | null, right: Set<string | boolean> | null): Set<string | boolean> | null {
  if (left === null) return right;
  if (right === null) return left;
  return new Set([...left].filter((value) => right.has(value)));
}

function ruleConstraints(conditions: WorkflowRuleCondition[]): Map<string, Set<string | boolean> | null> {
  const constraints = new Map<string, Set<string | boolean> | null>();
  for (const condition of conditions) {
    const field = conditionField(condition);
    constraints.set(field, intersect(constraints.get(field) ?? null, allowedValues(condition)));
  }
  return constraints;
}

function conditionsSubsumes(broader: WorkflowRuleCondition[], narrower: WorkflowRuleCondition[]): boolean {
  const broad = ruleConstraints(broader);
  const narrow = ruleConstraints(narrower);
  for (const [field, broadValues] of broad) {
    if (broadValues === null) continue;
    const narrowValues = narrow.get(field);
    if (narrowValues === undefined || narrowValues === null) return false;
    if ([...narrowValues].some((value) => !broadValues.has(value))) return false;
  }
  return true;
}

function validateCondition(
  condition: WorkflowRuleCondition,
  questions: Map<string, WorkflowIntakeQuestion>,
  path: string,
  errors: string[],
  allowReviewOutcome = false,
): void {
  if (!condition || typeof condition !== "object") {
    errors.push(`${path} must be a condition object.`);
    return;
  }
  if (!condition.key?.trim()) {
    errors.push(`${path} needs a field key.`);
    return;
  }
  const source = normalizedSource(condition);
  if (source !== "answer" && source !== "review_outcome" && source !== "project") {
    errors.push(`${path} uses an unknown condition source.`);
    return;
  }
  if (source === "review_outcome" && !allowReviewOutcome) {
    errors.push(`${path} cannot depend on a review outcome that is recorded after routing.`);
  }
  if (source === "review_outcome" && condition.key !== "review_outcome") {
    errors.push(`${path} must use the review_outcome key.`);
  }
  const projectKeys = new Set(["projectId", "projectNumber", "projectType", "customerOrganizationId", "leadOrganizationId"]);
  if (source === "project" && !projectKeys.has(condition.key)) errors.push(`${path} uses an unsupported project field.`);
  if (source === "project" && condition.operator === "yes_no") errors.push(`${path} cannot use yes/no matching for a project field.`);
  const question = source === "answer" ? questions.get(condition.key) : undefined;
  if (source === "answer" && !question) errors.push(`${path} references unknown intake question "${condition.key}".`);
  if (condition.operator === "yes_no") {
    if (condition.value !== true && condition.value !== false) errors.push(`${path} needs a yes/no value.`);
    if (question && question.type !== "yes_no") errors.push(`${path} uses yes/no matching for non yes/no question "${question.label}".`);
  } else if (condition.operator === "equals") {
    if (typeof condition.value !== "string" || !condition.value.trim()) errors.push(`${path} needs a non-empty comparison value.`);
    if (question?.type === "yes_no") errors.push(`${path} must use yes/no matching for question "${question.label}".`);
  } else if (condition.operator === "one_of") {
    if (!condition.values?.length || condition.values.some((value) => !value.trim())) {
      errors.push(`${path} needs one or more comparison values.`);
    }
    if (new Set(condition.values ?? []).size !== (condition.values ?? []).length) errors.push(`${path} contains duplicate comparison values.`);
    if (question?.type === "yes_no") errors.push(`${path} must use yes/no matching for question "${question.label}".`);
  } else {
    errors.push(`${path} uses an unknown comparison operator.`);
  }
  if (question?.type === "single_choice") {
    const allowed = new Set(question.options ?? []);
    const candidates = condition.operator === "one_of" ? condition.values ?? [] : typeof condition.value === "string" ? [condition.value] : [];
    for (const candidate of candidates) {
      if (!allowed.has(candidate)) errors.push(`${path} uses "${candidate}", which is not an option for "${question.label}".`);
    }
  } else if (question?.type === "date") {
    const candidates = condition.operator === "one_of" ? condition.values ?? [] : typeof condition.value === "string" ? [condition.value] : [];
    for (const candidate of candidates) {
      if (!isValidIsoDate(candidate)) errors.push(`${path} uses "${candidate}", which is not a valid date for "${question.label}".`);
    }
  }
}

function hasContradictoryConditions(conditions: WorkflowRuleCondition[]): boolean {
  return [...ruleConstraints(conditions).values()].some((values) => values !== null && values.size === 0);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function detectStageCycles(stages: WorkflowStageRecord[], branches: WorkflowStageBranch[]): string[] {
  const keys = new Set(stages.map((stage) => stage.stageKey));
  const ordered = [...stages].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const edges = new Map<string, Set<string>>();
  for (const stage of ordered) {
    const targets = (stage.permittedTransitions ?? []).filter((target) => keys.has(target));
    if (targets.length > 0) edges.set(stage.stageKey, new Set(targets));
    else {
      const next = ordered.find((candidate) => candidate.sequenceOrder > stage.sequenceOrder);
      edges.set(stage.stageKey, new Set(next ? [next.stageKey] : []));
    }
  }
  for (const branch of branches) {
    if (!keys.has(branch.fromStageKey) || !keys.has(branch.toStageKey)) continue;
    const targets = edges.get(branch.fromStageKey) ?? new Set<string>();
    targets.add(branch.toStageKey);
    edges.set(branch.fromStageKey, targets);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleNodes = new Set<string>();
  const stack: string[] = [];
  const visit = (key: string) => {
    if (visiting.has(key)) {
      const start = stack.indexOf(key);
      stack.slice(start).forEach((node) => cycleNodes.add(node));
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    stack.push(key);
    for (const target of edges.get(key) ?? []) visit(target);
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  };
  for (const stage of ordered) visit(stage.stageKey);
  return [...cycleNodes];
}

export function validateWorkflowAutomationConfig(params: {
  stages: WorkflowStageRecord[];
  intakeQuestions?: WorkflowIntakeQuestion[];
  routingRules?: WorkflowRoutingRule[];
  stageBranches?: WorkflowStageBranch[];
  noticeTemplates?: WorkflowNoticeTemplate[];
  autoRouteEnabled?: boolean;
  organizations?: OrganizationRecord[];
  assignmentGroups?: AssignmentGroupRecord[];
}): WorkflowAutomationValidationResult {
  const questions = params.intakeQuestions ?? [];
  const routingRules = params.routingRules ?? [];
  const branches = params.stageBranches ?? [];
  const templates = params.noticeTemplates ?? [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const questionMap = new Map<string, WorkflowIntakeQuestion>();
  const stagesByKey = new Map(params.stages.map((stage) => [stage.stageKey, stage]));
  const organizationsByCode = new Map((params.organizations ?? []).map((org) => [org.code.toUpperCase(), org]));
  const groupsById = new Map((params.assignmentGroups ?? []).map((group) => [group.id, group]));

  for (const question of questions) {
    if (!question.key.trim()) errors.push("Every intake question needs a key.");
    if (!question.label.trim()) errors.push(`Intake question "${question.key}" needs a label.`);
    if (questionMap.has(question.key)) errors.push(`Intake question key "${question.key}" is duplicated.`);
    questionMap.set(question.key, question);
    if (question.type === "single_choice") {
      if (!question.options?.length) errors.push(`Single choice question "${question.label}" needs at least one option.`);
      if (new Set(question.options ?? []).size !== (question.options ?? []).length) errors.push(`Single choice question "${question.label}" contains duplicate options.`);
      if ((question.options ?? []).some((option) => !option.trim())) errors.push(`Single choice question "${question.label}" contains a blank option.`);
    } else if (question.options?.length) {
      errors.push(`Question "${question.label}" has options but is not single choice.`);
    }
  }
  for (const question of questions) {
    for (const [index, condition] of (question.visibleWhen ?? []).entries()) {
      validateCondition(condition, questionMap, `Visibility condition ${index + 1} for "${question.label}"`, errors);
      if (normalizedSource(condition) === "review_outcome") errors.push(`Visibility for "${question.label}" cannot depend on a later review outcome.`);
      if (condition.key === question.key && normalizedSource(condition) === "answer") errors.push(`Question "${question.label}" cannot depend on its own answer.`);
      if (normalizedSource(condition) === "answer") {
        const referencedIndex = questions.findIndex((candidate) => candidate.key === condition.key);
        const currentIndex = questions.indexOf(question);
        if (referencedIndex >= currentIndex) errors.push(`Visibility for "${question.label}" can only depend on an earlier intake question.`);
      }
    }
  }

  const sortedRules = [...routingRules].sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const usedPriorities = new Set<number>();
  for (const [index, rule] of sortedRules.entries()) {
    const label = `Routing rule "${rule.name || rule.id || index + 1}"`;
    if (!rule.id.trim() || !rule.name.trim()) errors.push(`${label} needs an id and name.`);
    if (!Number.isInteger(rule.priority)) errors.push(`${label} priority must be an integer.`);
    if (usedPriorities.has(rule.priority)) errors.push(`${label} has a priority already used by another routing rule.`);
    usedPriorities.add(rule.priority);
    for (const [conditionIndex, condition] of (rule.conditions ?? []).entries()) {
      validateCondition(condition, questionMap, `${label}, condition ${conditionIndex + 1}`, errors);
    }
    if (hasContradictoryConditions(rule.conditions ?? [])) errors.push(`${label} has contradictory conditions and can never match.`);
    const destination = rule.destination;
    if (!destination?.workflowVersionId?.trim()) errors.push(`${label} needs a published destination workflow version.`);
    if (!destination?.leadOrgCode?.trim()) errors.push(`${label} needs an owning agency.`);
    if (destination?.leadOrgCode && params.organizations?.length) {
      const owner = organizationsByCode.get(destination.leadOrgCode.toUpperCase());
      if (!owner || !owner.isActive) errors.push(`${label} references unknown or inactive agency "${destination.leadOrgCode}".`);
    }
    if (destination?.assignmentGroupId && params.assignmentGroups?.length) {
      const group = groupsById.get(destination.assignmentGroupId);
      if (!group || !group.active) errors.push(`${label} references a missing or inactive assignment group.`);
      else if (destination.leadOrgCode && group.orgCode.toUpperCase() !== destination.leadOrgCode.toUpperCase()) errors.push(`${label} assignment group belongs to ${group.orgCode}, not ${destination.leadOrgCode}.`);
    }
    if (params.autoRouteEnabled && !destination?.assignmentGroupId) errors.push(`${label} needs an assignment group while automatic routing is enabled.`);
    if (destination?.targetDate && !isValidIsoDate(destination.targetDate)) errors.push(`${label} target date must be a valid date in YYYY-MM-DD format.`);
  }
  for (let index = 0; index < sortedRules.length; index += 1) {
    const rule = sortedRules[index];
    for (let earlierIndex = 0; earlierIndex < index; earlierIndex += 1) {
      const earlier = sortedRules[earlierIndex];
      if (conditionsSubsumes(earlier.conditions ?? [], rule.conditions ?? [])) {
        errors.push(`Routing rule "${rule.name}" is unreachable because earlier rule "${earlier.name}" always matches first.`);
        break;
      }
    }
  }
  if (params.autoRouteEnabled && routingRules.length === 0) errors.push("Automatic routing needs at least one routing rule.");

  const branchPriorities = new Set<string>();
  for (const branch of branches) {
    const label = `Stage branch "${branch.id}"`;
    if (!branch.id.trim()) errors.push("Every stage branch needs an id.");
    const source = stagesByKey.get(branch.fromStageKey);
    const target = stagesByKey.get(branch.toStageKey);
    if (!source) errors.push(`${label} references unknown source stage "${branch.fromStageKey}".`);
    if (!target) errors.push(`${label} references unknown target stage "${branch.toStageKey}".`);
    if (branch.fromStageKey === branch.toStageKey) errors.push(`${label} cannot branch to its own stage.`);
    if (source && target && (source.permittedTransitions ?? []).length > 0 && !source.permittedTransitions.includes(branch.toStageKey)) {
      errors.push(`${label} target "${branch.toStageKey}" is not a permitted transition from "${branch.fromStageKey}".`);
    }
    const priority = branch.priority ?? 0;
    const priorityKey = `${branch.fromStageKey}:${priority}`;
    if (!Number.isInteger(priority)) errors.push(`${label} priority must be an integer.`);
    if (branchPriorities.has(priorityKey)) errors.push(`${label} shares a priority with another branch from "${branch.fromStageKey}".`);
    branchPriorities.add(priorityKey);
    for (const [index, condition] of (branch.conditions ?? []).entries()) {
      validateCondition(condition, questionMap, `${label}, condition ${index + 1}`, errors, true);
    }
    if (hasContradictoryConditions(branch.conditions ?? [])) errors.push(`${label} has contradictory conditions and can never match.`);
  }
  for (const branch of branches) {
    const previous = branches.filter((candidate) => candidate.fromStageKey === branch.fromStageKey && (candidate.priority ?? 0) < (branch.priority ?? 0));
    if (previous.some((candidate) => conditionsSubsumes(candidate.conditions ?? [], branch.conditions ?? []))) {
      errors.push(`Stage branch "${branch.id}" is unreachable because an earlier branch from "${branch.fromStageKey}" always matches first.`);
    }
  }

  const cycleStages = detectStageCycles(params.stages, branches);
  if (cycleStages.length) errors.push(`Stage branches create a cycle involving: ${cycleStages.join(", ")}.`);

  const templateIds = new Set<string>();
  for (const template of templates) {
    if (!template.id.trim() || !template.title.trim() || !template.body.trim()) errors.push("Notification templates need an id, title, and body.");
    if (template.audience && !["customer", "team", "both"].includes(template.audience)) errors.push(`Notification template "${template.id}" has an unsupported audience.`);
    if (templateIds.has(template.id)) errors.push(`Notification template id "${template.id}" is duplicated.`);
    templateIds.add(template.id);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function evaluateWorkflowConditions(
  conditions: WorkflowRuleCondition[],
  answers: Answers,
  reviewOutcome?: string | null,
  projectContext: WorkflowProjectContext = {},
): boolean {
  return conditions.every((condition) => {
    const source = normalizedSource(condition);
    const actual = source === "review_outcome"
      ? reviewOutcome
      : source === "project"
        ? projectContext[condition.key as keyof WorkflowProjectContext]
        : answers[condition.key];
    if (actual === undefined || actual === null) return false;
    if (condition.operator === "one_of") return typeof actual === "string" && (condition.values ?? []).includes(actual);
    if (condition.operator === "yes_no") return typeof actual === "boolean" && actual === condition.value;
    return actual === condition.value;
  });
}

export function evaluateRoutingRules(
  rules: WorkflowRoutingRule[],
  answers: Answers,
  projectContext: WorkflowProjectContext = {},
): WorkflowRoutingRule | null {
  return [...rules]
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .find((rule) => evaluateWorkflowConditions(rule.conditions, answers, null, projectContext)) ?? null;
}

export function evaluateWorkflowStageBranch(params: {
  branches: WorkflowStageBranch[];
  stageKey: string;
  answers: Answers;
  reviewOutcome?: string | null;
  projectContext?: WorkflowProjectContext;
}): WorkflowStageBranch | null {
  return params.branches
    .filter((branch) => branch.fromStageKey === params.stageKey)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id))
    .find((branch) => evaluateWorkflowConditions(branch.conditions, params.answers, params.reviewOutcome, params.projectContext)) ?? null;
}
