import type {
  OperationalState,
  RAGHealth,
  WorkflowStageRecord,
  WorkflowVersionRecord,
  WorkstreamRecord,
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
