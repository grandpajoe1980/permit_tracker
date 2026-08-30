import {
  DEMO_PASSWORD,
  demoAccounts,
  demoPersonas,
  pecanIslandRequests,
  permits,
  requestCategories,
  type Agency,
  type DemoAccount,
  type DemoPersona,
  type JurisdictionLevel,
  type PermitRecord,
  type RAGStatus,
  type RequestCategory,
  type ServiceRequest,
} from "./demo-data";

export function authenticateDemoAccount(
  username: string,
  password: string,
  agencyId: Agency["id"] | null,
): DemoAccount | null {
  if (!agencyId || password !== DEMO_PASSWORD) return null;

  const normalizedUsername = username.trim().toLowerCase();
  return (
    demoAccounts.find(
      (account) =>
        account.username === normalizedUsername && account.agencyId === agencyId,
    ) ?? null
  );
}

export function permitProgress(permit: Pick<PermitRecord, "currentDay" | "totalDays">) {
  if (permit.totalDays <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((permit.currentDay / permit.totalDays) * 100)),
  );
}

export function getPermitsForAccount(account: DemoAccount | null): PermitRecord[] {
  if (!account) return [];
  return account.applicationIds
    .map((applicationId) => permits[applicationId])
    .filter((permit): permit is PermitRecord => Boolean(permit));
}

export function getPermitForAccount(
  account: DemoAccount | null,
  permitId: string,
): PermitRecord | null {
  if (!account?.applicationIds.includes(permitId)) return null;
  return permits[permitId] ?? null;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function findDemoPersona(identifier: string): DemoPersona | null {
  const normalized = identifier.trim().toLowerCase();
  return (
    demoPersonas.find(
      (persona) =>
        persona.id.toLowerCase() === normalized ||
        persona.email.toLowerCase() === normalized ||
        persona.legacyEmails?.some((email) => email.toLowerCase() === normalized) ||
        persona.name.toLowerCase() === normalized,
    ) ?? null
  );
}

export function getPermitsForPersona(persona: DemoPersona | null): PermitRecord[] {
  if (!persona) return [];
  const matchingAccount = demoAccounts.find(
    (account) => account.username.toLowerCase() === persona.email.toLowerCase(),
  );
  if (matchingAccount) {
    return getPermitsForAccount(matchingAccount);
  }
  return pecanIslandRequests;
}

export type RAGSummary = {
  total: number;
  green: number;
  yellow: number;
  red: number;
  criticalPathCount: number;
};

export function calculateRAGSummary(items: ServiceRequest[]): RAGSummary {
  let green = 0;
  let yellow = 0;
  let red = 0;
  let criticalPathCount = 0;

  for (const item of items) {
    if (item.ragStatus === "red") red++;
    else if (item.ragStatus === "yellow") yellow++;
    else green++;

    if (item.isCriticalPath) criticalPathCount++;
  }

  return {
    total: items.length,
    green,
    yellow,
    red,
    criticalPathCount,
  };
}

export type AgencyWorkloadItem = {
  agencyCode: string;
  agencyName: string;
  agencyLevel: JurisdictionLevel;
  count: number;
  blockedCount: number;
  onTrackCount: number;
};

export function getAgencyWorkload(items: ServiceRequest[]): AgencyWorkloadItem[] {
  const map: Record<string, AgencyWorkloadItem> = {};

  for (const item of items) {
    const code = item.leadAgencyCode || "Other";
    if (!map[code]) {
      map[code] = {
        agencyCode: code,
        agencyName: item.leadAgency || code,
        agencyLevel: item.agencyLevel || "State",
        count: 0,
        blockedCount: 0,
        onTrackCount: 0,
      };
    }
    map[code].count++;
    if (item.ragStatus === "red") {
      map[code].blockedCount++;
    } else {
      map[code].onTrackCount++;
    }
  }

  return Object.values(map).sort((a, b) => b.count - a.count);
}

export type UpcomingDeadline = {
  requestId: string;
  requestTitle: string;
  category: RequestCategory;
  agencyCode: string;
  agencyLevel: JurisdictionLevel;
  milestoneTitle: string;
  targetDate: string;
  isCriticalPath: boolean;
  ragStatus: RAGStatus;
};

export function getUpcomingDeadlines(items: ServiceRequest[]): UpcomingDeadline[] {
  return items
    .filter((item) => item.targetDate && item.status !== "approved")
    .map((item) => {
      const activeStep = item.steps.find((s) => s.state === "active" || s.state === "blocked" || s.state === "hearing");
      return {
        requestId: item.id,
        requestTitle: item.title,
        category: item.category,
        agencyCode: item.leadAgencyCode,
        agencyLevel: item.agencyLevel,
        milestoneTitle: activeStep?.title || item.statusLabel,
        targetDate: item.targetDate,
        isCriticalPath: item.isCriticalPath,
        ragStatus: item.ragStatus,
      };
    })
    .slice(0, 5);
}

export type IntakeTriageResult = {
  detectedCategory: RequestCategory;
  categoryLabel: string;
  suggestedLeadAgency: string;
  suggestedLeadAgencyCode: string;
  suggestedAgencyLevel: JurisdictionLevel;
  priority: "critical" | "high" | "normal";
  isCriticalPathCandidate: boolean;
  estimatedDays: number;
  extractedTitle: string;
  statutoryNotice: string;
};

export function parsePlainEnglishIntake(text: string): IntakeTriageResult {
  const lower = text.toLowerCase();

  let detectedCategory: RequestCategory = "permit";
  let suggestedLeadAgency = "Louisiana Department of Environmental Quality (LDEQ)";
  let suggestedLeadAgencyCode = "LDEQ";
  let suggestedAgencyLevel: JurisdictionLevel = "State";
  let priority: "critical" | "high" | "normal" = "normal";
  let isCriticalPathCandidate = false;
  let estimatedDays = 150;
  let statutoryNotice = "Official statutory air/water/waste application must be submitted in LDEQ EDMS.";

  if (
    lower.includes("road") ||
    lower.includes("highway") ||
    lower.includes("bridge") ||
    lower.includes("heavy haul") ||
    lower.includes("traffic") ||
    lower.includes("culvert") ||
    lower.includes("la-82") ||
    lower.includes("transport")
  ) {
    detectedCategory = "road";
    suggestedLeadAgency = "Louisiana Department of Transportation & Development (DOTD)";
    suggestedLeadAgencyCode = "DOTD";
    suggestedAgencyLevel = "State";
    priority = "critical";
    isCriticalPathCandidate = true;
    estimatedDays = 180;
    statutoryNotice = "Formal oversized right-of-way permit application must be filed with DOTD District 03.";
  } else if (
    lower.includes("power") ||
    lower.includes("grid") ||
    lower.includes("electric") ||
    lower.includes("utility") ||
    lower.includes("substation") ||
    lower.includes("transformer") ||
    lower.includes("entergy") ||
    lower.includes("gas line") ||
    lower.includes("water line")
  ) {
    detectedCategory = "utility";
    suggestedLeadAgency = "Louisiana Public Service Commission & Entergy Louisiana";
    suggestedLeadAgencyCode = "LPSC / Entergy";
    suggestedAgencyLevel = "Utility / Regional";
    priority = "critical";
    isCriticalPathCandidate = true;
    estimatedDays = 240;
    statutoryNotice = "Utility interconnection study and tariff filings filed under LPSC transmission docket.";
  } else if (
    lower.includes("airspace") ||
    lower.includes("notam") ||
    lower.includes("faa") ||
    lower.includes("coast guard") ||
    lower.includes("uscg") ||
    lower.includes("fcc") ||
    lower.includes("frequency") ||
    lower.includes("communications") ||
    lower.includes("radar")
  ) {
    detectedCategory = "public_safety";
    suggestedLeadAgency = "FAA Southwest Region, USCG & FCC";
    suggestedLeadAgencyCode = "FAA / USCG / FCC";
    suggestedAgencyLevel = "Federal";
    priority = "high";
    isCriticalPathCandidate = true;
    estimatedDays = 210;
    statutoryNotice = "FAA Part 450 license and federal spectrum clearances required prior to launch operations.";
  } else if (
    lower.includes("fire marshal") ||
    lower.includes("cryo") ||
    lower.includes("hazard") ||
    lower.includes("safety") ||
    lower.includes("deluge") ||
    lower.includes("methane") ||
    lower.includes("lox") ||
    lower.includes("storage")
  ) {
    detectedCategory = "public_safety";
    suggestedLeadAgency = "Louisiana Office of State Fire Marshal & State Police";
    suggestedLeadAgencyCode = "OSFM / LSP";
    suggestedAgencyLevel = "State";
    priority = "high";
    isCriticalPathCandidate = true;
    estimatedDays = 210;
    statutoryNotice = "OSFM industrial hazardous storage reviews required before fueling operations.";
  } else if (
    lower.includes("training") ||
    lower.includes("workforce") ||
    lower.includes("hire") ||
    lower.includes("welder") ||
    lower.includes("technician") ||
    lower.includes("slcc") ||
    lower.includes("college") ||
    lower.includes("intern") ||
    lower.includes("jobs")
  ) {
    detectedCategory = "workforce";
    suggestedLeadAgency = "Louisiana Economic Development (LED FastStart) & SLCC";
    suggestedLeadAgencyCode = "LED / SLCC";
    suggestedAgencyLevel = "State";
    priority = "normal";
    isCriticalPathCandidate = false;
    estimatedDays = 90;
    statutoryNotice = "Customized training grant agreement administered through LED FastStart.";
  } else if (
    lower.includes("community") ||
    lower.includes("town hall") ||
    lower.includes("parish") ||
    lower.includes("resident") ||
    lower.includes("water well") ||
    lower.includes("drinking water") ||
    lower.includes("noise") ||
    lower.includes("fishermen")
  ) {
    detectedCategory = "community";
    suggestedLeadAgency = "Vermilion Parish Police Jury & Department of Health";
    suggestedLeadAgencyCode = "Parish / LDH";
    suggestedAgencyLevel = "Local / Parish";
    priority = "normal";
    isCriticalPathCandidate = false;
    estimatedDays = 60;
    statutoryNotice = "Intergovernmental community agreements registered with Vermilion Parish Government.";
  } else if (
    lower.includes("wetland") ||
    lower.includes("dune") ||
    lower.includes("cpra") ||
    lower.includes("usace") ||
    lower.includes("marsh") ||
    lower.includes("coastal")
  ) {
    detectedCategory = "permit";
    suggestedLeadAgency = "Coastal Protection & Restoration Authority (CPRA) & USACE";
    suggestedLeadAgencyCode = "CPRA / USACE";
    suggestedAgencyLevel = "Federal";
    priority = "high";
    isCriticalPathCandidate = false;
    estimatedDays = 260;
    statutoryNotice = "Joint Coastal Use Permit (CUP) and USACE Section 404 application filed via OCM portal.";
  }

  const firstSentence = text.split(/[.\n]/)[0].trim();
  const extractedTitle = firstSentence.length > 70
    ? `${firstSentence.slice(0, 67)}…`
    : firstSentence || "New Service Request";

  return {
    detectedCategory,
    categoryLabel: requestCategories[detectedCategory].label,
    suggestedLeadAgency,
    suggestedLeadAgencyCode,
    suggestedAgencyLevel,
    priority,
    isCriticalPathCandidate,
    estimatedDays,
    extractedTitle,
    statutoryNotice,
  };
}

// ==========================================
// LOUISIANA PROJECT DELIVERY COMMAND SYSTEM HELPERS
// ==========================================

import {
  registeredOrganizations,
  permitCatalog,
  workflowTemplatesData,
  commitmentsData,
  coordinationRequestsData,
  rfisData,
  projectDocumentsData,
  projectDecisionsData,
  projectMeetingsData,
  workstreamsData,
  spacexProjectRecord,
} from "./spacex-megaproject-fixture";
import { generateSixQuestionsSummary } from "./engines/workflow-engine";
import { evaluateProjectSchedule } from "./engines/schedule-engine";
import { evaluateWorkstreamEscalation } from "./engines/escalation-engine";
import { getAgencyCoordinationViews, groupIntoConsolidatedBatch } from "./engines/coordination-engine";

export function getFullProjectRecord() {
  return spacexProjectRecord;
}

export function getRegisteredOrganizations() {
  return registeredOrganizations;
}

export function getPermitCatalog() {
  return permitCatalog;
}

export function getWorkflowTemplates() {
  return workflowTemplatesData;
}

export function getSpaceXNoSurprisesData() {
  const wsList = spacexProjectRecord.workstreams;

  // 1. Needs SpaceX (items waiting on applicant / RFIs)
  const needsSpaceX = wsList
    .filter((ws) => ws.operationalState === "waiting_applicant" || ws.customerActionRequired !== "None")
    .map((ws) => ({
      workstream: ws,
      actionRequired: ws.customerActionRequired,
      dueDate: ws.forecastTargetDate,
      context: generateSixQuestionsSummary(ws),
    }));

  // 2. Needs Government (items SpaceX has delivered, owned by government)
  const needsGovernment = wsList
    .filter((ws) => ws.operationalState === "running" || ws.operationalState === "statutory_waiting_period")
    .map((ws) => ({
      workstream: ws,
      ownerOrg: ws.regulatoryLead.orgName,
      ownerPerson: ws.regulatoryLead.assignedReviewerName,
      targetDate: ws.forecastTargetDate,
      context: generateSixQuestionsSummary(ws),
    }));

  // 3. Blocked (actual impediments with variance / critical path)
  const blocked = wsList
    .filter((ws) => ws.operationalState === "blocked" || ws.scheduleVarianceDays > 5)
    .map((ws) => ({
      workstream: ws,
      blockerTitle: ws.waitingReason || "Interagency Dependency",
      scheduleImpactDays: ws.scheduleVarianceDays,
      unblockingAction: ws.customerActionRequired || ws.currentActionSummary,
      context: generateSixQuestionsSummary(ws),
    }));

  // 4. Upcoming Decisions & Milestones
  const upcomingMilestones = wsList.map((ws) => ({
    workstream: ws,
    milestoneTitle: ws.nextExpectedEvent,
    targetDate: ws.forecastTargetDate,
    isCriticalPath: ws.isCriticalPath,
    ragHealth: ws.ragHealth,
    context: generateSixQuestionsSummary(ws),
  }));

  return {
    needsSpaceX,
    needsGovernment,
    blocked,
    upcomingMilestones,
    commitments: commitmentsData,
    schedule: evaluateProjectSchedule(wsList),
  };
}

export function getDailyCommandCenterExceptions() {
  const wsList = spacexProjectRecord.workstreams;
  const newBlockers = wsList.filter((ws) => ws.operationalState === "blocked");
  const overdueCommitments = commitmentsData.filter((c) => c.status === "at_risk" || c.status === "missed");
  const escalatedItems = wsList
    .map((ws) => ({ ws, esc: evaluateWorkstreamEscalation(ws) }))
    .filter((item) => item.esc.isEscalated);
  const nearDeadlines = wsList.filter((ws) => ws.scheduleVarianceDays > 0 || ws.isCriticalPath);

  return {
    blockerCount: newBlockers.length,
    overdueCommitmentCount: overdueCommitments.length,
    escalationCount: escalatedItems.length,
    nearDeadlineCount: nearDeadlines.length,
    newBlockers,
    overdueCommitments,
    escalatedItems,
    nearDeadlines,
    coordinationRequests: coordinationRequestsData,
    consolidatedRfiBatch: groupIntoConsolidatedBatch(rfisData),
  };
}
