import type {
  CoordinationRequestRecord,
  RFIRecord,
  RFIResponseRecord,
} from "../domain-models";

export interface ConsolidatedRFIBatch {
  batchId: string;
  recipientOrgCode: string;
  leadReviewerName: string;
  status: "staged_drafts" | "ready_for_dispatch" | "dispatched_to_spacex";
  stagedRfis: RFIRecord[];
  totalQuestions: number;
}

/**
 * Filter coordination requests for an agency cockpit
 */
export function getAgencyCoordinationViews(
  orgCode: string,
  allRequests: CoordinationRequestRecord[]
): {
  myAgencyIncoming: CoordinationRequestRecord[];
  requestsSentByMyAgency: CoordinationRequestRecord[];
  activeBottlenecks: CoordinationRequestRecord[];
} {
  const normalized = orgCode.toUpperCase();
  const myAgencyIncoming = allRequests.filter(
    (r) => r.targetOrgCode.toUpperCase() === normalized && r.status !== "closed"
  );
  const requestsSentByMyAgency = allRequests.filter(
    (r) => r.requestingOrgCode.toUpperCase() === normalized
  );
  const activeBottlenecks = allRequests.filter(
    (r) => r.priority === "critical_path" && (r.status === "pending" || r.status === "in_review")
  );

  return {
    myAgencyIncoming,
    requestsSentByMyAgency,
    activeBottlenecks,
  };
}

/**
 * Groups draft RFIs across agencies into a consolidated RFI package
 */
export function groupIntoConsolidatedBatch(
  rfis: RFIRecord[],
  batchId: string = "BATCH-2026-AUG-01"
): ConsolidatedRFIBatch {
  const staged = rfis.filter((r) => r.status === "staged_draft" || r.isConsolidatedCycle);
  const allApproved = staged.every((r) => Boolean(r.leadReviewerApprovedAt));

  return {
    batchId,
    recipientOrgCode: "SPACEX",
    leadReviewerName: "Sarah Johnson (Louisiana State Project Office)",
    status: allApproved && staged.length > 0 ? "ready_for_dispatch" : "staged_drafts",
    stagedRfis: staged,
    totalQuestions: staged.length,
  };
}

/**
 * Validates clock impact of an RFI on a workstream
 */
export function evaluateRFIClockImpact(
  rfi: RFIRecord
): {
  pausesClock: boolean;
  scheduleImpactExplanation: string;
} {
  const pausesClock = rfi.clockImpact === "clock_paused";
  const scheduleImpactExplanation = pausesClock
    ? `Statutory review clock paused from ${rfi.issuedDate} until response acceptance. Added ${rfi.scheduleImpactDays} day(s) to forecast completion.`
    : `Review clock remains running while SpaceX prepares response by ${rfi.responseDeadline}.`;

  return {
    pausesClock,
    scheduleImpactExplanation,
  };
}
