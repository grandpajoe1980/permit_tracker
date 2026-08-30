import type {
  CommitmentRecord,
  CoordinationRequestRecord,
  DecisionRecord,
  ProjectRecord,
  WorkstreamRecord,
} from "../domain-models";
import { calculateDateDiffDays } from "./schedule-engine";

export interface GovernorBriefingReport {
  generatedAt: string;
  reportPeriod: string;
  projectTitle: string;
  applicantName: string;
  parish: string;
  overallRagHealth: "green" | "yellow" | "red";
  baselineLaunchDate: string;
  currentForecastLaunchDate: string;
  scheduleVarianceDays: number;
  executiveSummaryText: string;
  criticalPathBottlenecks: Array<{
    workstreamCode: string;
    title: string;
    leadAgency: string;
    varianceDays: number;
    escalationLevel: number;
    blockerDescription: string;
    requiredExecutiveAction: string;
  }>;
  highStakesDecisions: Array<{
    decisionCode: string;
    title: string;
    statutoryAuthority: string;
    agency: string;
    status: string;
    impact: string;
  }>;
  interagencyConcurrenceStatus: {
    totalRequests: number;
    pendingCount: number;
    concurredCount: number;
    criticalPathRequests: Array<{
      code: string;
      title: string;
      requestingAgency: string;
      targetAgency: string;
      daysRemaining: number;
    }>;
  };
  keyMilestonesNext14Days: Array<{
    milestoneName: string;
    workstreamTitle: string;
    targetDate: string;
    responsibleParty: string;
    isCriticalPath: boolean;
  }>;
}

export interface PublicNoticeItem {
  id: string;
  permitCode: string;
  permitTitle: string;
  leadAgency: string;
  statutoryCitation: string;
  noticeStartDate: string;
  noticeEndDate: string;
  daysRemaining: number;
  publicHearingDate?: string;
  publicHearingLocation?: string;
  officialDocketUrl: string;
  summary: string;
  commentSubmissionEmail: string;
}

export interface PublicTransparencyData {
  parishName: string;
  projectOverview: string;
  activePublicNotices: PublicNoticeItem[];
  environmentalSafeguards: Array<{
    resource: string;
    measure: string;
    monitoringAgency: string;
    status: string;
  }>;
  communityBenefits: Array<{
    category: string;
    metric: string;
    description: string;
  }>;
  upcomingTownHalls: Array<{
    date: string;
    time: string;
    title: string;
    location: string;
    agendaSummary: string;
  }>;
}

/**
 * Synthesizes the Governor's Weekly Megaproject Briefing One-Pager
 */
export function generateGovernorWeeklyBriefing(
  project: ProjectRecord,
  workstreams: WorkstreamRecord[],
  commitments: CommitmentRecord[],
  decisions: DecisionRecord[],
  coordinationRequests: CoordinationRequestRecord[]
): GovernorBriefingReport {
  const criticalWs = workstreams.filter((ws) => ws.isCriticalPath);
  const bottlenecks = criticalWs
    .filter((ws) => ws.operationalState === "blocked" || ws.scheduleVarianceDays > 0)
    .map((ws) => ({
      workstreamCode: ws.code,
      title: ws.title,
      leadAgency: ws.regulatoryLead.orgName,
      varianceDays: ws.scheduleVarianceDays,
      escalationLevel: ws.escalationLevel || 0,
      blockerDescription: ws.waitingReason || ws.currentActionSummary,
      requiredExecutiveAction:
        ws.escalationLevel >= 2
          ? `State Project Office Director intervention required with ${ws.regulatoryLead.orgCode} leadership.`
          : `Monitor scheduled technical review completion by ${ws.forecastTargetDate}.`,
    }));

  const executiveDecisions = decisions.map((d) => ({
    decisionCode: d.id,
    title: d.title,
    statutoryAuthority: d.statutoryAuthority || "La. R.S. 48:26 et seq.",
    agency: (d.organizationsRepresented || []).join(", ") || "State Review Board",
    status: "Adopted",
    impact: d.decisionSummary,
  }));


  const pendingCRs = coordinationRequests.filter((r) => r.status === "pending" || r.status === "in_review");
  const criticalCRs = coordinationRequests
    .filter((r) => r.priority === "critical_path")
    .map((r) => ({
      code: r.code,
      title: r.title,
      requestingAgency: r.requestingOrgCode,
      targetAgency: r.targetOrgCode,
      daysRemaining: calculateDateDiffDays(new Date().toISOString().split("T")[0], r.dueDate),
    }));

  const next14DaysMilestones = commitments
    .filter((c) => c.status === "on_track" || c.status === "at_risk")
    .slice(0, 5)
    .map((c) => ({
      milestoneName: c.committedAction,
      workstreamTitle: c.workstreamTitle ?? "Interagency Workstream",
      targetDate: c.promisedDueDate,
      responsibleParty: `${c.committingOrgCode} (${c.madeByPersonName})`,
      isCriticalPath: c.isCriticalPathImpact,
    }));

  return {
    generatedAt: new Date().toISOString(),
    reportPeriod: "Week of Sunday, August 30, 2026",
    projectTitle: project.name,
    applicantName: "Space Exploration Technologies Corp. (SpaceX)",
    parish: project.parish || "Vermilion Parish",
    overallRagHealth: project.overallRagHealth,
    baselineLaunchDate: project.baselineLaunchDate,
    currentForecastLaunchDate: project.currentForecastLaunchDate,
    scheduleVarianceDays: project.scheduleVarianceDays,
    executiveSummaryText: `The SpaceX Pecan Island Launch Complex is currently tracking to a forecast launch window of ${project.currentForecastLaunchDate} (+${project.scheduleVarianceDays} days from baseline). The primary critical path driver remains DOTD LA-82 Superload & Culvert Reinforcement pending CPRA coastal drainage concurrence (CR-00451). Interagency resolution sprint is actively underway to recover 10 days of schedule buffer.`,
    criticalPathBottlenecks: bottlenecks,
    highStakesDecisions: executiveDecisions,
    interagencyConcurrenceStatus: {
      totalRequests: coordinationRequests.length,
      pendingCount: pendingCRs.length,
      concurredCount: coordinationRequests.length - pendingCRs.length,
      criticalPathRequests: criticalCRs,
    },
    keyMilestonesNext14Days: next14DaysMilestones,
  };
}

/**
 * Returns structured public transparency data for Vermilion Parish citizens
 */
export function getPublicTransparencyData(): PublicTransparencyData {
  return {
    parishName: "Vermilion Parish, Louisiana",
    projectOverview:
      "The SpaceX Pecan Island Launch Complex & Orbital Support Facility is a state-supported commercial aerospace infrastructure project. All environmental, road safety, and coastal protection reviews are conducted under Louisiana state and federal statutory requirements with mandatory public comment periods.",
    activePublicNotices: [
      {
        id: "pn-cpra-cup",
        permitCode: "CPRA-CUP-2026-088",
        permitTitle: "Joint Coastal Use Permit (CUP) & Tidal Hydrology Review",
        leadAgency: "Louisiana Coastal Protection & Restoration Authority (CPRA)",
        statutoryCitation: "La. R.S. 49:214.21 et seq.; LAC 43:I.723",
        noticeStartDate: "2026-08-15",
        noticeEndDate: "2026-09-09",
        daysRemaining: 10,
        publicHearingDate: "2026-09-02 at 6:00 PM",
        publicHearingLocation: "Vermilion Parish Police Jury Chambers, Abbeville, LA",
        officialDocketUrl: "https://sonris-cpra.dnr.state.la.us/docket/2026-088",
        summary:
          "Public review of proposed launch pad grading, storm surge wave attenuation revetment, and tidal marsh drainage crossings on Pecan Island.",
        commentSubmissionEmail: "coastal.comments@la.gov",
      },
      {
        id: "pn-usace-404",
        permitCode: "MVN-2026-00492-WII",
        permitTitle: "Section 404 Clean Water Act Wetland Delineation & Mitigation",
        leadAgency: "U.S. Army Corps of Engineers (New Orleans District)",
        statutoryCitation: "33 U.S.C. § 1344; 33 CFR Parts 320-332",
        noticeStartDate: "2026-08-10",
        noticeEndDate: "2026-09-09",
        daysRemaining: 10,
        officialDocketUrl: "https://www.mvn.usace.army.mil/regulatory/public-notices/",
        summary:
          "Federal public notice for unavoidable 2.4-acre intermediate marsh impacts with compensatory mitigation proposed at the Chenier Plain Wetland Mitigation Bank.",
        commentSubmissionEmail: "mvn-wetlands-comments@usace.army.mil",
      },
      {
        id: "pn-ldeq-lpdes",
        permitCode: "LA0128491",
        permitTitle: "LPDES Industrial Wastewater & Launch Deluge Retention Discharge",
        leadAgency: "Louisiana Department of Environmental Quality (LDEQ)",
        statutoryCitation: "La. R.S. 30:2001 et seq.; LAC 33:IX",
        noticeStartDate: "2026-08-20",
        noticeEndDate: "2026-09-19",
        daysRemaining: 20,
        publicHearingDate: "2026-09-14 at 6:30 PM",
        publicHearingLocation: "Pecan Island High School Gymnasium, Pecan Island, LA",
        officialDocketUrl: "https://edms.deq.louisiana.gov/docket/LA0128491",
        summary:
          "Public review of industrial wastewater retention basin discharge limits for acoustic sound suppression deluge water into non-potable tidal marsh canals.",
        commentSubmissionEmail: "deq.publicnotices@la.gov",
      },
    ],
    environmentalSafeguards: [
      {
        resource: "Chicot Aquifer Drinking Water Protection",
        measure: "Zero subterranean drilling into freshwater sands; 4 continuous hydrostatic pressure test monitoring wells installed.",
        monitoringAgency: "Louisiana Department of Health (LDH)",
        status: "Active Monitoring (Baseline Normal)",
      },
      {
        resource: "Coastal Fishery & Estuarine Salinity",
        measure: "Deluge retention basin equipped with real-time temperature dissipation baffled weir before tidal release.",
        monitoringAgency: "Louisiana Department of Wildlife & Fisheries (LDWF)",
        status: "Design Concurred",
      },
      {
        resource: "LA-82 Heavy-Haul Traffic & Bridge Safety",
        measure: "Nighttime transport windows (11 PM - 5 AM) with state police escort to prevent school bus and commuter disruption.",
        monitoringAgency: "DOTD District 03 & Louisiana State Police Troop I",
        status: "Permit In Review",
      },
    ],
    communityBenefits: [
      {
        category: "Local Workforce",
        metric: "120+ High-Wage Jobs",
        description: "Aerospace technician, cryogenic operator, and mechanical assembly positions with training funded by LED FastStart at SLCC.",
      },
      {
        category: "Infrastructure Investment",
        metric: "$14.2M Road & Drainage Upgrades",
        description: "Full structural reinforcement of LA-82 bridges and 14 tidal drainage culverts benefiting parish storm runoff.",
      },
      {
        category: "Parish Tax Base",
        metric: "Direct Local Revenue",
        description: "Parish sales and property tax contributions supporting Vermilion Parish public schools and emergency services.",
      },
    ],
    upcomingTownHalls: [
      {
        date: "Wednesday, September 2, 2026",
        time: "6:00 PM - 8:00 PM CDT",
        title: "Vermilion Parish Joint Permitting & Coastal Protection Town Hall",
        location: "Vermilion Parish Police Jury Chambers, 100 N State St, Abbeville, LA",
        agendaSummary: "Public presentation on coastal use permits, bridge reinforcement timelines, and public Q&A with state agency engineers.",
      },
      {
        date: "Monday, September 14, 2026",
        time: "6:30 PM - 8:30 PM CDT",
        title: "LDEQ Environmental Water Quality Public Hearing",
        location: "Pecan Island Community Center, 27150 LA-82, Pecan Island, LA",
        agendaSummary: "Formal public comment hearing on the LPDES industrial discharge permit and environmental testing parameters.",
      },
    ],
  };
}
