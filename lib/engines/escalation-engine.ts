import type { EscalationLevel, WorkstreamRecord } from "../domain-models";

export interface EscalationStatusEvaluation {
  currentLevel: EscalationLevel;
  levelLabel: string;
  isEscalated: boolean;
  daysDelayed: number;
  currentOwnerName: string;
  currentOwnerAgency: string;
  notifiedParties: string[];
  nextEscalationDate?: string;
  nextEscalationParty?: string;
  recommendedAction: string;
  isExecutiveActionRequired: boolean;
}

/**
 * Evaluates the escalation tier for a workstream based on delay days, target SLA, and critical path impact.
 */
export function evaluateWorkstreamEscalation(
  ws: WorkstreamRecord,
  elapsedDaysInCurrentStage: number = 11
): EscalationStatusEvaluation {
  const variance = ws.scheduleVarianceDays;
  let level: EscalationLevel = 0;
  let levelLabel = "Level 0: Normal Review";
  let isEscalated = false;
  const notifiedParties: string[] = [];
  let nextEscalationDate: string | undefined;
  let nextEscalationParty: string | undefined;
  let recommendedAction = "Review progressing according to baseline schedule.";
  let isExecutiveActionRequired = false;

  // Escalation policy thresholds:
  // Day 0-7: Reviewer (Level 0)
  // Day 8: Reviewer warning (Level 1)
  // Day 10: Supervisor notified (Level 2)
  // Day 12: Agency project liaison notified (Level 3)
  // Day 15: State Project Office notified (Level 4)
  // Critical path variance > 5 days + deadlock: Executive Program Review (Level 5)

  if (ws.isCriticalPath && variance >= 5) {
    level = 4;
    levelLabel = "Level 4: State Project Office Intervention";
    isEscalated = true;
    notifiedParties.push(
      `${ws.regulatoryLead.assignedReviewerName} (Reviewer)`,
      "Agency Section Supervisor",
      "Agency Project Liaison",
      "Louisiana State Project Office (Sarah Johnson)"
    );
    if (variance >= 10 || ws.operationalState === "blocked") {
      level = 5;
      levelLabel = "Level 5: Executive Megaproject Review";
      isExecutiveActionRequired = true;
      notifiedParties.push("Governor's Office of Major Projects & Economic Development");
      recommendedAction = "Immediate executive coordination session required to resolve interagency roadblock.";
    } else {
      recommendedAction = "State Project Office concierge actively mediating agency review bottleneck.";
    }
  } else if (elapsedDaysInCurrentStage >= 15 || variance >= 4) {
    level = 4;
    levelLabel = "Level 4: State Project Office Engaged";
    isEscalated = true;
    notifiedParties.push("Reviewer", "Supervisor", "Agency Liaison", "State Project Office");
    recommendedAction = "State Project Manager convening interagency alignment standup.";
  } else if (elapsedDaysInCurrentStage >= 12 || variance >= 3) {
    level = 3;
    levelLabel = "Level 3: Agency Project Liaison Notified";
    isEscalated = true;
    notifiedParties.push("Reviewer", "Supervisor", "Agency Project Liaison");
    nextEscalationParty = "State Project Office";
    recommendedAction = "Agency liaison prioritizing technical resources.";
  } else if (elapsedDaysInCurrentStage >= 10 || variance >= 2) {
    level = 2;
    levelLabel = "Level 2: Supervisor Escalation";
    isEscalated = true;
    notifiedParties.push("Reviewer", "Section Supervisor");
    nextEscalationParty = "Agency Project Liaison";
    recommendedAction = "Supervisor reviewing queue distribution and draft comments.";
  } else if (elapsedDaysInCurrentStage >= 8 || variance >= 1) {
    level = 1;
    levelLabel = "Level 1: Reviewer Warning";
    isEscalated = false;
    notifiedParties.push("Assigned Reviewer");
    nextEscalationParty = "Section Supervisor";
    recommendedAction = "Approaching target SLA; prepare findings package.";
  }

  return {
    currentLevel: level,
    levelLabel,
    isEscalated,
    daysDelayed: Math.max(0, variance),
    currentOwnerName: ws.regulatoryLead.assignedReviewerName,
    currentOwnerAgency: ws.regulatoryLead.orgName,
    notifiedParties,
    nextEscalationDate,
    nextEscalationParty,
    recommendedAction,
    isExecutiveActionRequired,
  };
}
