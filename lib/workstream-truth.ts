import type { WorkstreamRecord, WorkflowTemplateRecord } from "./domain-models";
import { buildWorkflowJourney } from "./workflow-journey";

export type WorkstreamTruth = {
  stage: string;
  ownerName: string;
  ownerOrganization: string;
  hold: string;
  baselineDate?: string;
  forecastDate?: string;
  actualCompletionDate?: string;
  nextAction: string;
  nextHandoff: string;
  stateLabel: string;
  scheduleVarianceDays: number;
  activeStageCount: number;
};

function recorded(value?: string) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/**
 * The shared projection for the workstream story shown in queues, detail,
 * Project, the mini-stepper, and the schedule. It intentionally preserves
 * missing dates and dependency information instead of manufacturing values.
 */
export function buildWorkstreamTruth(workstream: WorkstreamRecord, templates: WorkflowTemplateRecord[] = []): WorkstreamTruth {
  const journey = buildWorkflowJourney(workstream, templates);
  const activeStageNames = journey.currentStages.map((stage) => stage.label).filter(Boolean);
  const stage = activeStageNames.length > 1
    ? activeStageNames.join(" · ")
    : recorded(workstream.currentStageName) ?? activeStageNames[0] ?? "Stage not recorded";
  const waiting = workstream.operationalState === "blocked"
    || workstream.operationalState.startsWith("waiting_")
    || workstream.operationalState === "scheduled_hold"
    || workstream.operationalState === "statutory_waiting_period"
    || Boolean(workstream.waitingReason)
    || Boolean(workstream.waitingOnEntity);
  const hold = waiting
    ? [workstream.waitingOnEntity ? `Waiting on ${workstream.waitingOnEntity}` : workstream.operationalStateLabel, workstream.waitingReason]
      .filter(Boolean)
      .join(" · ") || "Hold recorded"
    : "No hold recorded";

  return {
    stage,
    ownerName: recorded(workstream.assignedToUserName) ?? recorded(workstream.regulatoryLead.assignedReviewerName) ?? "Unassigned",
    ownerOrganization: recorded(workstream.assignmentGroupName) ?? recorded(workstream.regulatoryLead.orgName) ?? recorded(workstream.regulatoryLead.orgCode) ?? "Owner not recorded",
    hold,
    baselineDate: recorded(workstream.baselineTargetDate),
    forecastDate: recorded(workstream.forecastTargetDate),
    actualCompletionDate: recorded(workstream.actualCompletionDate),
    nextAction: recorded(workstream.currentActionSummary) ?? "Next action not recorded",
    nextHandoff: recorded(workstream.nextExpectedEvent) ?? "Next handoff not recorded",
    stateLabel: recorded(workstream.operationalStateLabel) ?? workstream.operationalState,
    scheduleVarianceDays: workstream.scheduleVarianceDays,
    activeStageCount: journey.currentStages.length,
  };
}
