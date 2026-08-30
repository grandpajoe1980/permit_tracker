import type {
  AuditEventRecord,
  PermitTypeRecord,
  RequirementResourceRecord,
} from "../domain-models";

export interface FlaggedStaleResource {
  permitTypeId: string;
  permitCode: string;
  permitName: string;
  resourceId: string;
  resourceName: string;
  resourceType: string;
  url: string;
  verifiedAt: string;
  verifiedBy: string;
  daysSinceVerification: number;
  thresholdDays: number;
}

export interface ResourceStalenessAuditReport {
  totalPermitsAudited: number;
  totalResourcesAudited: number;
  totalResources: number;
  staleItemsCount: number;
  staleCount: number;
  freshCount: number;
  flaggedResources: FlaggedStaleResource[];
  auditedCatalog: PermitTypeRecord[];
}

/**
 * Creates an immutable audit event record
 */
export function createAuditEvent(params: {
  entityType: string;
  entityId: string;
  actorName: string;
  actorOrgName: string;
  actionType: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  sourceChannel?: string;
}): AuditEventRecord {
  return {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    entityType: params.entityType,
    entityId: params.entityId,
    actorName: params.actorName,
    actorOrgName: params.actorOrgName,
    actionType: params.actionType,
    oldValue: params.oldValue,
    newValue: params.newValue,
    reason: params.reason,
    sourceChannel: params.sourceChannel || "web_app",
    occurredAt: new Date().toISOString(),
  };
}

/**
 * Filters audit trail records by entity, actor, or search text
 */
export function filterAuditTrail(
  events: AuditEventRecord[],
  query?: {
    entityType?: string;
    entityId?: string;
    actorOrgName?: string;
    searchTerm?: string;
  }
): AuditEventRecord[] {
  if (!query) return events;

  return events.filter((ev) => {
    if (query.entityType && ev.entityType !== query.entityType) return false;
    if (query.entityId && ev.entityId !== query.entityId) return false;
    if (query.actorOrgName && ev.actorOrgName !== query.actorOrgName) return false;
    if (query.searchTerm) {
      const s = query.searchTerm.toLowerCase();
      const match =
        ev.actorName.toLowerCase().includes(s) ||
        ev.actionType.toLowerCase().includes(s) ||
        (ev.reason && ev.reason.toLowerCase().includes(s)) ||
        (ev.newValue && ev.newValue.toLowerCase().includes(s));
      if (!match) return false;
    }
    return true;
  });
}

export const filterAuditEvents = filterAuditTrail;

/**
 * Audits requirement resource verification timestamps against the 180-day threshold.
 * Flags statutory resources whose last verification exceeds 180 days from the reference date.
 */
export function auditResourceStaleness(
  catalog: PermitTypeRecord[],
  referenceDate?: string
): ResourceStalenessAuditReport {
  const STALENESS_THRESHOLD_DAYS = 180;
  const refDate = referenceDate ? new Date(referenceDate) : new Date();
  const refTime = isNaN(refDate.getTime()) ? Date.now() : refDate.getTime();

  let totalResources = 0;
  let staleCount = 0;
  let freshCount = 0;
  const flaggedResources: FlaggedStaleResource[] = [];

  const auditedCatalog: PermitTypeRecord[] = catalog.map((permit) => {
    let permitHasStaleResource = false;
    let permitHasDueResource = false;

    const resources = (permit.resources || []).map((res) => {
      totalResources++;
      const verifiedTime = new Date(res.verifiedAt).getTime();
      let daysSinceVerification = 0;
      let isStale = false;

      if (isNaN(verifiedTime)) {
        daysSinceVerification = 9999;
        isStale = true;
      } else {
        const diffMs = refTime - verifiedTime;
        daysSinceVerification = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        isStale = daysSinceVerification > STALENESS_THRESHOLD_DAYS;
      }

      if (isStale) {
        staleCount++;
        permitHasStaleResource = true;
        flaggedResources.push({
          permitTypeId: permit.id,
          permitCode: permit.code,
          permitName: permit.name,
          resourceId: res.id,
          resourceName: res.resourceName,
          resourceType: res.resourceType,
          url: res.url,
          verifiedAt: res.verifiedAt,
          verifiedBy: res.verifiedBy,
          daysSinceVerification,
          thresholdDays: STALENESS_THRESHOLD_DAYS,
        });
      } else {
        freshCount++;
        if (daysSinceVerification > 120) {
          permitHasDueResource = true;
        }
      }

      return {
        ...res,
        isStale,
      };
    });

    let verificationStatus: "verified" | "verification_due" | "stale_over_180d" = "verified";
    if (permitHasStaleResource) {
      verificationStatus = "stale_over_180d";
    } else if (permitHasDueResource) {
      verificationStatus = "verification_due";
    } else if (permit.lastVerifiedAt) {
      const pVerifiedTime = new Date(permit.lastVerifiedAt).getTime();
      if (!isNaN(pVerifiedTime)) {
        const pDays = Math.max(0, Math.floor((refTime - pVerifiedTime) / (1000 * 60 * 60 * 24)));
        if (pDays > STALENESS_THRESHOLD_DAYS) {
          verificationStatus = "stale_over_180d";
        } else if (pDays > 120) {
          verificationStatus = "verification_due";
        }
      }
    }

    return {
      ...permit,
      verificationStatus,
      resources,
    };
  });

  return {
    totalPermitsAudited: catalog.length,
    totalResourcesAudited: totalResources,
    totalResources,
    staleItemsCount: staleCount,
    staleCount,
    freshCount,
    flaggedResources,
    auditedCatalog,
  };
}
