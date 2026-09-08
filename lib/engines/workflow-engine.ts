import type {
  OperationalState,
  RAGHealth,
  WorkflowStageRecord,
  WorkstreamRecord,
  OrganizationRecord,
  AssignmentGroupRecord,
} from "../domain-models";

export interface SixQuestionsSummary {
  whoHasIt: string;
  whatDoing: string;
  waitingFor: string;
  waitingOn: string;
  whenDue: string;
  missedConsequence: string;
  deterministicParagraph: string;
}

/**
 * Deterministically synthesizes the 6-question summary and customer plain-English narrative
 * purely from structured state without arbitrary free-form guesses.
 */
export function generateSixQuestionsSummary(
  ws: WorkstreamRecord
): SixQuestionsSummary {
  const whoHasIt = `${ws.regulatoryLead.orgName} (${ws.regulatoryLead.orgCode}) — Assigned: ${ws.regulatoryLead.assignedReviewerName}`;
  const whatDoing = ws.currentActionSummary || "Technical review and statutory verification";
  const waitingFor = ws.waitingReason || "Internal agency engineering assessment";
  const waitingOn = ws.waitingOnEntity || (ws.operationalState === "waiting_applicant" ? "SpaceX" : ws.regulatoryLead.orgCode);
  const whenDue = ws.forecastTargetDate || ws.baselineTargetDate;
  
  let missedConsequence = "Schedule slips downstream critical-path timeline";
  if (ws.isCriticalPath) {
    missedConsequence = `Direct impact: Launch complex critical path slips by ${Math.max(1, ws.scheduleVarianceDays || 1)} day(s)`;
  } else {
    missedConsequence = "Absorbed by project schedule float buffer";
  }

  // Format date nicely
  const targetDateFormatted = new Date(whenDue).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Construct deterministic customer narrative
  let actionClause = "No action is currently required from SpaceX.";
  if (ws.operationalState === "waiting_applicant") {
    actionClause = `Action required from SpaceX: ${ws.customerActionRequired || "Submit requested documentation"}.`;
  } else if (ws.operationalState === "statutory_waiting_period") {
    actionClause = "Mandatory statutory public notice period in progress. No additional applicant action required.";
  }

  const deterministicParagraph = [
    `Your application for ${ws.title} is currently with ${ws.regulatoryLead.orgName} (${ws.regulatoryLead.orgCode}).`,
    `Currently active stage: ${ws.currentStageName || "Technical Review"}.`,
    `They are doing: ${whatDoing}.`,
    actionClause,
    `Target completion date: ${targetDateFormatted}.`,
    `Next expected event: ${ws.nextExpectedEvent}.`,
    `State Project Concierge: ${ws.governmentConcierge.name} (${ws.governmentConcierge.email}).`,
  ].join(" ");

  return {
    whoHasIt,
    whatDoing,
    waitingFor,
    waitingOn,
    whenDue,
    missedConsequence,
    deterministicParagraph,
  };
}

/**
 * Validates whether a workflow transition can occur against checklist requirements.
 */
export function validateStageTransition(
  stage: WorkflowStageRecord,
  completedChecklistItems: string[],
  providedDocCategories: string[]
): {
  allowed: boolean;
  missingChecklists: string[];
  missingDocs: string[];
  reasons: string[];
} {
  const missingChecklists = stage.completionRequirements.filter(
    (req) => !completedChecklistItems.includes(req)
  );

  const missingDocs = stage.requiredInputs.filter(
    (input) => !providedDocCategories.includes(input)
  );

  const reasons: string[] = [];
  if (missingChecklists.length > 0) {
    reasons.push(`Unfulfilled checklist gates: ${missingChecklists.join(", ")}`);
  }
  if (missingDocs.length > 0) {
    reasons.push(`Missing required document inputs: ${missingDocs.join(", ")}`);
  }

  return {
    allowed: reasons.length === 0,
    missingChecklists,
    missingDocs,
    reasons,
  };
}

/**
 * Calculates operational state & RAG health decoupling
 */
export function deriveOperationalHealth(
  state: OperationalState,
  varianceDays: number,
  isCriticalPath: boolean
): RAGHealth {
  if (state === "blocked" || varianceDays > 5) {
    return "red";
  }
  if (state === "statutory_waiting_period" || state === "scheduled_hold") {
    return "green"; // Statutory waiting is not unhealthy
  }
  if (varianceDays > 0 || state === "waiting_applicant" || state === "waiting_government") {
    return isCriticalPath ? "red" : "yellow";
  }
  return "green";
}

export interface WorkflowDraftValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  unreachableStages: string[];
  cyclicStages: string[];
}

/**
 * Validates a workflow draft per Checkpoint 9 requirements:
 * - Unreachable stages
 * - Prohibited cycles where completion is unreachable
 * - Missing owners or references to inactive records
 * - Invalid transitions
 * - Impossible requirements
 * - Missing duration or statutory constraints
 */
export function validateWorkflowDraft(params: {
  stages: WorkflowStageRecord[];
  organizations?: OrganizationRecord[];
  assignmentGroups?: AssignmentGroupRecord[];
}): WorkflowDraftValidationResult {
  const { stages, organizations = [], assignmentGroups = [] } = params;
  const errors: string[] = [];
  const warnings: string[] = [];
  const unreachableStages: string[] = [];
  const cyclicStages: string[] = [];

  if (stages.length === 0) {
    errors.push("At least one workflow stage is required.");
    return { valid: false, errors, warnings, unreachableStages, cyclicStages };
  }

  const stageKeys = new Set(stages.map((s) => s.stageKey));
  const orgMap = new Map(organizations.map((org) => [org.code.toUpperCase(), org]));
  const groupMap = new Map(assignmentGroups.map((g) => [g.id, g]));

  // 1. Stage-level checks: missing owners, constraints, impossible requirements
  for (const stage of stages) {
    // Missing owner
    if (!stage.responsibleOrgCode || stage.responsibleOrgCode.trim() === "") {
      errors.push(`Stage "${stage.name || stage.stageKey}" is missing an owning agency.`);
    } else if (organizations.length > 0) {
      const org = orgMap.get(stage.responsibleOrgCode.toUpperCase());
      if (org && (org as unknown as { active?: boolean }).active === false) {
        errors.push(`Stage "${stage.name}" references inactive organization "${stage.responsibleOrgCode}".`);
      }
    }

    // Inactive assignment group
    if (stage.defaultAssignmentGroupId && assignmentGroups.length > 0) {
      const group = groupMap.get(stage.defaultAssignmentGroupId);
      if (group && group.active === false) {
        errors.push(`Stage "${stage.name}" references inactive assignment group "${group.name}".`);
      }
    }

    // Duration / statutory constraints
    if (stage.targetDurationDays <= 0) {
      errors.push(`Stage "${stage.name}" target SLA duration must be greater than 0 days.`);
    }
    if (stage.minimumStatutoryDays < 0) {
      errors.push(`Stage "${stage.name}" minimum statutory duration cannot be negative.`);
    }
    if (stage.minimumStatutoryDays > 0 && stage.targetDurationDays < stage.minimumStatutoryDays) {
      errors.push(
        `Stage "${stage.name}" target duration (${stage.targetDurationDays}d) cannot be less than mandatory statutory minimum (${stage.minimumStatutoryDays}d).`
      );
    }

    // Impossible requirements: milestone gate with no completion criteria
    if (stage.isMilestoneGate && (!stage.completionRequirements || stage.completionRequirements.length === 0)) {
      errors.push(`Milestone gate stage "${stage.name}" has no completion criteria configured.`);
    }

    // Check for empty string items in requirements
    if (stage.completionRequirements?.some((c) => !c.trim())) {
      errors.push(`Stage "${stage.name}" contains blank completion requirement.`);
    }
    if (stage.requiredInputs?.some((i) => !i.trim())) {
      errors.push(`Stage "${stage.name}" contains blank required document input.`);
    }

    // Prerequisites must point at real, earlier stages. A self-reference is
    // never satisfiable and an unknown key would leave the workflow blocked
    // at runtime.
    for (const dependency of stage.dependencies ?? []) {
      const dependencyStage = stages.find((candidate) => candidate.stageKey === dependency);
      if (!dependencyStage) {
        errors.push(`Stage "${stage.name}" specifies an unknown prerequisite "${dependency}".`);
      } else if (dependencyStage.stageKey === stage.stageKey) {
        errors.push(`Stage "${stage.name}" cannot depend on itself.`);
      } else if (dependencyStage.sequenceOrder >= stage.sequenceOrder) {
        errors.push(`Stage "${stage.name}" prerequisite "${dependency}" must appear earlier in the workflow.`);
      }
    }

    // Task definitions are part of the versioned process contract. Keep the
    // draft validator strict enough that publishing cannot create anonymous
    // or impossible task rows.
    const taskIds = new Set<string>();
    for (const task of stage.tasks ?? []) {
      if (!task.id.trim()) errors.push(`Stage "${stage.name}" contains a task without an id.`);
      if (!task.title.trim()) errors.push(`Stage "${stage.name}" contains a task without a title.`);
      if (task.id && taskIds.has(task.id)) errors.push(`Stage "${stage.name}" contains duplicate task id "${task.id}".`);
      taskIds.add(task.id);
      if (task.defaultDays !== undefined && (!Number.isFinite(task.defaultDays) || task.defaultDays < 0)) {
        errors.push(`Task "${task.title || task.id}" in stage "${stage.name}" has an invalid default duration.`);
      }
    }

    // Recognized terminal and action states in statutory workflows
    const isRecognizedTerminalOrAction = (t: string) => {
      const lower = t.toLowerCase().trim();
      return [
        "complete", "completed", "cancelled", "canceled", "rejected", "reject",
        "blocked", "withdrawn", "rfi", "return_to_applicant", "issued", "denied",
        "comment_extension", "hearing", "interagency_concurrence", "final_review", "decision",
        "next_stage"
      ].includes(lower);
    };

    function resolveTransitionTarget(t: string): string | undefined {
      if (stageKeys.has(t)) return t;
      const lower = t.toLowerCase().trim();
      if (lower === "final_review" || lower === "decision") {
        const found = stages.find((s) => s.stageKey === "decision" || s.stageKey === "final_review" || s.stageKey.includes("final"));
        if (found) return found.stageKey;
      }
      return undefined;
    }

    // Invalid transitions
    for (const transition of stage.permittedTransitions || []) {
      const resolved = resolveTransitionTarget(transition);
      if (!resolved && !isRecognizedTerminalOrAction(transition)) {
        errors.push(`Stage "${stage.name}" specifies invalid transition target "${transition}".`);
      }
    }
  }

  function resolveTargetStage(t: string): string | undefined {
    if (stageKeys.has(t)) return t;
    const lower = t.toLowerCase().trim();
    if (lower === "final_review" || lower === "decision") {
      const found = stages.find((s) => s.stageKey === "decision" || s.stageKey === "final_review" || s.stageKey.includes("final"));
      if (found) return found.stageKey;
    }
    return undefined;
  }

  // 2. Unreachable stages check
  // Sort stages by sequenceOrder
  const sortedStages = [...stages].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const reachable = new Set<string>();
  if (sortedStages.length > 0) {
    const queue: string[] = [sortedStages[0].stageKey];
    reachable.add(sortedStages[0].stageKey);

    while (queue.length > 0) {
      const currentKey = queue.shift()!;
      const currentStage = stages.find((s) => s.stageKey === currentKey);
      if (!currentStage) continue;

      const targets = currentStage.permittedTransitions || [];
      for (const t of targets) {
        const resolved = resolveTargetStage(t);
        if (resolved && stageKeys.has(resolved) && !reachable.has(resolved)) {
          reachable.add(resolved);
          queue.push(resolved);
        }
      }
      // If no transitions defined, sequential flow reaches next stage
      if (targets.length === 0) {
        const nextIdx = sortedStages.findIndex((s) => s.stageKey === currentKey) + 1;
        if (nextIdx < sortedStages.length) {
          const nextStageKey = sortedStages[nextIdx].stageKey;
          if (!reachable.has(nextStageKey)) {
            reachable.add(nextStageKey);
            queue.push(nextStageKey);
          }
        }
      }
    }

    for (const stage of sortedStages) {
      if (!reachable.has(stage.stageKey)) {
        unreachableStages.push(stage.stageKey);
        errors.push(`Stage "${stage.name || stage.stageKey}" is unreachable from the initial workflow stage.`);
      }
    }
  }

  // 3. Prohibited cycles detection: a cycle with no path to workflow completion
  const adj = new Map<string, string[]>();
  for (const stage of stages) {
    const transitions = stage.permittedTransitions || [];
    adj.set(
      stage.stageKey,
      transitions.filter((t) => stageKeys.has(t))
    );
  }

  const canReachTerminal = new Set<string>();
  for (const stage of stages) {
    const targets = stage.permittedTransitions || [];
    if (targets.some((t) => ["complete", "completed"].includes(t.toLowerCase().trim()))) {
      canReachTerminal.add(stage.stageKey);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const stage of stages) {
      if (!canReachTerminal.has(stage.stageKey)) {
        const nexts = adj.get(stage.stageKey) || [];
        if (nexts.some((n) => canReachTerminal.has(n))) {
          canReachTerminal.add(stage.stageKey);
          changed = true;
        }
      }
    }
  }

  for (const stage of stages) {
    if (!canReachTerminal.has(stage.stageKey)) {
      const visited = new Set<string>();
      const inStack = new Set<string>();
      let hasCycle = false;
      const dfs = (node: string) => {
        visited.add(node);
        inStack.add(node);
        for (const neighbor of adj.get(node) || []) {
          if (!visited.has(neighbor)) {
            dfs(neighbor);
          } else if (inStack.has(neighbor)) {
            hasCycle = true;
          }
        }
        inStack.delete(node);
      };
      dfs(stage.stageKey);
      if (hasCycle && !cyclicStages.includes(stage.stageKey)) {
        cyclicStages.push(stage.stageKey);
        errors.push(`Prohibited cycle detected at stage "${stage.name || stage.stageKey}" with no path to workflow completion.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    unreachableStages,
    cyclicStages,
  };
}
