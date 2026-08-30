// @ts-nocheck -- legacy fixture simulation; production escalation is persisted.
import type { WorkstreamRecord } from "../domain-models";
import { repository } from "../repository";
import { evaluateWorkstreamEscalation } from "./escalation-engine";
import { auditResourceStaleness } from "./audit-engine";
import { createAuditEvent } from "./audit-engine";

export interface SlaScanResult {
  scanTimestamp: string;
  evaluatedWorkstreamsCount: number;
  newlyEscalatedCount: number;
  executiveAlertsCount: number;
  escalatedWorkstreamDetails: Array<{
    workstreamCode: string;
    workstreamTitle: string;
    leadAgencyCode: string;
    escalationLevel: number;
    escalationName: string;
    isExecutiveActionRequired: boolean;
    notifiedRoles: string[];
    recommendedAction: string;
  }>;
}

export interface CatalogAuditScanResult {
  scanTimestamp: string;
  totalResourcesAudited: number;
  staleResourcesCount: number;
  verifiedResourcesCount: number;
  staleResources: Array<{
    permitCode: string;
    resourceName: string;
    responsibleAgency: string;
    daysSinceVerified: number;
    url: string;
  }>;
}

/**
 * Runs automated daily SLA scan evaluating aging workstreams and escalating overdue items
 */
export function runDailySlaEscalationScan(referenceDate?: string): SlaScanResult {
  const workstreams = repository.getWorkstreams();
  const scanTimestamp = new Date().toISOString();
  let newlyEscalatedCount = 0;
  let executiveAlertsCount = 0;
  const escalatedWorkstreamDetails: SlaScanResult["escalatedWorkstreamDetails"] = [];

  for (const ws of workstreams) {
    // Only evaluate active running or blocked workstreams
    if (ws.operationalState === "complete") continue;

    const evaluation = evaluateWorkstreamEscalation(ws);

    if (evaluation.isTriggered && evaluation.level > (ws.escalationLevel || 0)) {
      const oldLevel = ws.escalationLevel || 0;
      ws.escalationLevel = evaluation.level;
      ws.escalationTriggeredAt = scanTimestamp;
      ws.escalationSummary = `Level ${evaluation.level}: ${evaluation.levelName}. ${evaluation.recommendedAction}`;
      newlyEscalatedCount++;

      if (evaluation.isExecutiveActionRequired) {
        executiveAlertsCount++;
      }

      // Record audit event
      const audit = createAuditEvent({
        entityType: "workstream",
        entityId: ws.code,
        actorName: "Automated SLA Escalation Worker",
        actorOrgName: "Louisiana State Project Office",
        actionType: "sla_escalation",
        oldValue: `Level ${oldLevel}`,
        newValue: `Level ${evaluation.level} (${evaluation.levelName})`,
        reason: evaluation.recommendedAction,
      });
      repository.getAuditEvents().unshift(audit);

      // Dispatch notification
      repository.dispatchNotification({
        userId: "user-sarah-johnson",
        title: `🚨 SLA Escalation Level ${evaluation.level}: ${ws.code}`,
        message: `${ws.title} (${ws.regulatoryLead.orgCode}) escalated to Level ${evaluation.level} (${evaluation.levelName}). Recommended Action: ${evaluation.recommendedAction}`,
        type: evaluation.isExecutiveActionRequired ? "escalation" : "deadline_warning",
        linkUrl: `/workstreams/${ws.code}`,
        urgency: evaluation.isExecutiveActionRequired ? "critical" : "high",
        metadata: {
          workstreamCode: ws.code,
          escalationLevel: evaluation.level,
          targetRoles: evaluation.targetRoles,
        },
      });

      escalatedWorkstreamDetails.push({
        workstreamCode: ws.code,
        workstreamTitle: ws.title,
        leadAgencyCode: ws.regulatoryLead.orgCode,
        escalationLevel: evaluation.level,
        escalationName: evaluation.levelName,
        isExecutiveActionRequired: evaluation.isExecutiveActionRequired,
        notifiedRoles: evaluation.targetRoles,
        recommendedAction: evaluation.recommendedAction,
      });
    }
  }

  return {
    scanTimestamp,
    evaluatedWorkstreamsCount: workstreams.length,
    newlyEscalatedCount,
    executiveAlertsCount,
    escalatedWorkstreamDetails,
  };
}

/**
 * Runs 180-day statutory permit catalog resource auditing
 */
export function run180DayCatalogVerificationScan(referenceDate?: string): CatalogAuditScanResult {
  const catalog = repository.getCatalog();
  const report = auditResourceStaleness(catalog, referenceDate);
  const scanTimestamp = new Date().toISOString();

  // Dispatch notifications for any stale resources found
  for (const stale of report.flaggedResources) {
    repository.dispatchNotification({
      userId: "user-admin-1",
      title: `⚠️ Stale Statutory Resource Link: ${stale.permitCode}`,
      message: `${stale.resourceName} has not been re-verified in ${stale.daysSinceVerification} days (exceeds 180-day audit threshold).`,
      type: "system",
      linkUrl: stale.url,
      urgency: "high",
      metadata: {
        permitCode: stale.permitCode,
        daysSinceVerified: stale.daysSinceVerification,
      },
    });
  }

  return {
    scanTimestamp,
    totalResourcesAudited: report.totalResourcesAudited,
    staleResourcesCount: report.staleCount,
    verifiedResourcesCount: report.freshCount,
    staleResources: report.flaggedResources.map((f) => ({
      permitCode: f.permitCode,
      resourceName: f.resourceName,
      responsibleAgency: f.permitName,
      daysSinceVerified: f.daysSinceVerification,
      url: f.url,
    })),
  };
}


/**
 * Automatically freezes statutory clock when an RFI is dispatched
 */
export function onRfiDispatched(workstreamId: string, rfiCode: string, actorName: string) {
  return repository.freezeStatutoryClock(
    workstreamId,
    rfiCode,
    actorName,
    "Formal RFI dispatched to SpaceX"
  );
}

/**
 * Automatically resumes statutory clock when applicant response is accepted
 */
export function onRfiResponseAccepted(workstreamId: string, actorName: string) {
  return repository.resumeStatutoryClock(
    workstreamId,
    actorName,
    "Applicant response package verified and accepted"
  );
}
