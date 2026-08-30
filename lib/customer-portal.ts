import type {
  CustomerRequestRecord,
  ExternalFilingRecord,
  FilingMode,
  ProjectParticipantRecord,
  ProjectRecord,
  UserProfileRecord,
  WorkstreamRecord,
} from "./domain-models";

export const CUSTOMER_ORGANIZATION_NAME = "Space Exploration Technologies Corp. (SpaceX)";
export const PATH_PROJECT_ID = "proj-spacex-pecan";

/** Synthetic fixture contacts. These are believable demo identities, not verified public officials. */
export const projectProfiles: UserProfileRecord[] = [
  {
    id: "profile-alex-martin",
    userId: "user-alex-martin",
    fullName: "Alex Martin",
    displayTitle: "SpaceX Project Manager",
    organizationId: "org-spacex",
    organizationName: CUSTOMER_ORGANIZATION_NAME,
    organizationalUnit: "Louisiana Launch Site Delivery",
    workEmail: "alex.martin@spacex.com",
    officePhone: "(310) 363-6000",
    officeLocation: "Hawthorne, California",
    preferredContactMethod: "email",
    availabilityStatus: "available",
    projectRole: "Customer project lead",
    isCustomerVisible: true,
    isActive: true,
  },
  {
    id: "profile-maya-chen",
    userId: "user-maya-chen",
    fullName: "Maya Chen",
    displayTitle: "SpaceX Regulatory Affairs Manager",
    organizationId: "org-spacex",
    organizationName: CUSTOMER_ORGANIZATION_NAME,
    organizationalUnit: "Regulatory Affairs & Permitting",
    workEmail: "maya.chen@spacex.com",
    officePhone: "(310) 363-6000",
    officeLocation: "Hawthorne, California",
    preferredContactMethod: "email",
    availabilityStatus: "available",
    projectRole: "Customer regulatory lead",
    isCustomerVisible: true,
    isActive: true,
  },
  {
    id: "profile-jordan-lee",
    userId: "user-jordan-lee",
    fullName: "Jordan Lee",
    displayTitle: "Environmental Scientist 1",
    organizationId: "org-ldeq",
    organizationName: "Louisiana Department of Environmental Quality",
    organizationalUnit: "Office of Environmental Services · Water Quality Permits",
    workEmail: "jordan.lee@la.gov",
    officePhone: "(225) 219-3181",
    officeLocation: "Baton Rouge, Louisiana",
    preferredContactMethod: "email",
    availabilityStatus: "available",
    projectRole: "Environmental review lead",
    isCustomerVisible: true,
    isActive: true,
  },
  {
    id: "profile-sam-rivera",
    userId: "user-sam-rivera",
    fullName: "Sam Rivera",
    displayTitle: "Civil Engineer 4",
    organizationId: "org-dotd",
    organizationName: "Louisiana Department of Transportation and Development",
    organizationalUnit: "District 03 · Aviation and Bridge Design",
    workEmail: "sam.rivera@la.gov",
    officePhone: "(337) 262-6100",
    officeLocation: "Lafayette, Louisiana",
    preferredContactMethod: "email",
    availabilityStatus: "available",
    projectRole: "Transportation and infrastructure lead",
    isCustomerVisible: true,
    isActive: true,
  },
  {
    id: "profile-riley-brooks",
    userId: "user-riley-brooks",
    fullName: "Riley Brooks",
    displayTitle: "Intergovernmental Affairs Coordinator",
    organizationId: "org-parish",
    organizationName: "Vermilion Parish Police Jury",
    organizationalUnit: "Parish Administration · Community Relations",
    workEmail: "riley.brooks@vermilionparish.org",
    officePhone: "(337) 898-4300",
    officeLocation: "Abbeville, Louisiana",
    preferredContactMethod: "phone",
    availabilityStatus: "available",
    projectRole: "Parish and community liaison",
    isCustomerVisible: true,
    isActive: true,
  },
  {
    id: "profile-sarah-johnson",
    userId: "user-sarah-johnson",
    fullName: "Sarah Johnson",
    displayTitle: "State Project Manager",
    organizationId: "org-state-po",
    organizationName: "Louisiana Governor's Office of Major Projects & Delivery",
    organizationalUnit: "PATH / Louisiana Project Delivery Office",
    workEmail: "sarah.johnson@la.gov",
    officePhone: "(225) 342-7000",
    officeLocation: "Baton Rouge, Louisiana",
    preferredContactMethod: "email",
    availabilityStatus: "available",
    projectRole: "State concierge and project manager",
    isCustomerVisible: true,
    isActive: true,
  },
  {
    id: "profile-joe-skaggs",
    userId: "user-joe-skaggs",
    fullName: "Joe Skaggs",
    displayTitle: "Space Czar",
    organizationId: "org-led",
    organizationName: "Louisiana Economic Development (LED)",
    organizationalUnit: "PATH / Louisiana Project Delivery Administration",
    workEmail: "joe.skaggs@la.gov",
    officePhone: "(225) 342-3000",
    officeLocation: "Baton Rouge, Louisiana",
    preferredContactMethod: "email",
    availabilityStatus: "available",
    projectRole: "PATH administrator",
    isCustomerVisible: false,
    isActive: true,
  },
  {
    id: "profile-aris-thorne",
    userId: "user-aris-thorne",
    fullName: "Dr. Aris Thorne",
    displayTitle: "Civil / Coastal Engineering Lead",
    organizationId: "org-coastal-engineering",
    organizationName: "Gulf Coast Engineering Partners",
    organizationalUnit: "Coastal Hydrology Practice",
    workEmail: "aris.thorne@gulfcoast-engineering.example",
    officePhone: "(504) 555-0148",
    officeLocation: "New Orleans, Louisiana",
    preferredContactMethod: "email",
    availabilityStatus: "available",
    projectRole: "Consultant · representing SpaceX",
    isCustomerVisible: true,
    isActive: true,
  },
];

export const projectParticipants: ProjectParticipantRecord[] = [
  { id: "participant-alex", projectId: PATH_PROJECT_ID, userId: "user-alex-martin", organizationId: "org-spacex", organizationName: CUSTOMER_ORGANIZATION_NAME, projectRole: "SpaceX Project Manager", workstreamIds: ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-UTILITY-INTERCONNECT"], assignedTaskIds: [], reviewResponsibility: [], notificationResponsibility: ["customer_updates"], visibilityScope: "customer", isActive: true },
  { id: "participant-maya", projectId: PATH_PROJECT_ID, userId: "user-maya-chen", organizationId: "org-spacex", organizationName: CUSTOMER_ORGANIZATION_NAME, projectRole: "SpaceX Regulatory Affairs Manager", workstreamIds: ["WS-WETLANDS-PAD-A", "WS-LA82-HEAVYHAUL", "WS-AIRSPACE-MARITIME"], assignedTaskIds: [], reviewResponsibility: ["customer_submissions"], notificationResponsibility: ["rfis", "escalations"], visibilityScope: "customer", isActive: true },
  { id: "participant-jordan", projectId: PATH_PROJECT_ID, userId: "user-jordan-lee", organizationId: "org-ldeq", organizationName: "Louisiana Department of Environmental Quality", projectRole: "Environmental review lead", workstreamIds: ["WS-WETLANDS-PAD-A", "WS-WASTEWATER-DELUGE"], assignedTaskIds: ["TASK-T003"], reviewResponsibility: ["environmental_permits"], notificationResponsibility: ["rfis", "document_reviews"], visibilityScope: "project", isActive: true },
  { id: "participant-sam", projectId: PATH_PROJECT_ID, userId: "user-sam-rivera", organizationId: "org-dotd", organizationName: "Louisiana Department of Transportation and Development", projectRole: "Transportation and infrastructure lead", workstreamIds: ["WS-LA82-HEAVYHAUL", "WS-SUBSTATION-230KV"], assignedTaskIds: ["TASK-T001", "TASK-T002"], reviewResponsibility: ["transportation_permits"], notificationResponsibility: ["coordination_requests"], visibilityScope: "project", isActive: true },
  { id: "participant-riley", projectId: PATH_PROJECT_ID, userId: "user-riley-brooks", organizationId: "org-parish", organizationName: "Vermilion Parish Police Jury", projectRole: "Parish and community liaison", workstreamIds: ["WS-COMMUNITY-WATER", "WS-AIRSPACE-MARITIME"], assignedTaskIds: [], reviewResponsibility: ["public_hearings"], notificationResponsibility: ["meetings", "public_notices"], visibilityScope: "customer", isActive: true },
  { id: "participant-sarah", projectId: PATH_PROJECT_ID, userId: "user-sarah-johnson", organizationId: "org-state-po", organizationName: "Louisiana Governor's Office of Major Projects & Delivery", projectRole: "State concierge and project manager", workstreamIds: ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A", "WS-COMMUNITY-WATER"], assignedTaskIds: [], reviewResponsibility: ["cross_agency_triage"], notificationResponsibility: ["all_project_exceptions"], visibilityScope: "project", isActive: true },
  { id: "participant-joe", projectId: PATH_PROJECT_ID, userId: "user-joe-skaggs", organizationId: "org-led", organizationName: "Louisiana Economic Development (LED)", projectRole: "Space Czar · PATH administrator", workstreamIds: [], assignedTaskIds: [], reviewResponsibility: ["administration", "escalations"], notificationResponsibility: ["escalation_queue"], visibilityScope: "admin", isActive: true },
  { id: "participant-aris", projectId: PATH_PROJECT_ID, userId: "user-aris-thorne", organizationId: "org-coastal-engineering", organizationName: "Gulf Coast Engineering Partners · representing SpaceX", projectRole: "Civil / Coastal Engineering Lead", workstreamIds: ["WS-LA82-HEAVYHAUL", "WS-WETLANDS-PAD-A"], assignedTaskIds: [], reviewResponsibility: ["technical_submissions"], notificationResponsibility: ["document_requests"], visibilityScope: "customer", isActive: true },
];

export const initialExternalFilings: ExternalFilingRecord[] = [
  {
    id: "filing-usace-404-pecan",
    projectId: PATH_PROJECT_ID,
    workstreamId: "WS-WETLANDS-PAD-A",
    permitTypeId: "cat-usace-404",
    authorityOrganizationId: "org-usace",
    authorityOrganizationName: "U.S. Army Corps of Engineers · New Orleans District",
    filingMethod: "EXTERNAL_PORTAL",
    officialPortalUrl: "https://crms.usace.army.mil",
    externalReferenceNumber: "USACE-TEST-PECAN-404",
    externalRecordUrl: "https://crms.usace.army.mil",
    externalStatus: "under_review",
    submittedAt: "2026-08-22",
    submittedByUserId: "user-maya-chen",
    submittedByName: "Maya Chen",
    lastStatusVerifiedAt: "2026-08-29",
    lastStatusVerifiedBy: "Sarah Johnson",
    authoritativeSystemName: "USACE Regulatory Request System",
    notes: "Manually updated from the agency record. PATH does not synchronize this filing.",
    receiptDocumentVersionIds: [],
    createdAt: "2026-08-22T14:00:00Z",
    updatedAt: "2026-08-29T16:30:00Z",
  },
  {
    id: "filing-cpra-cup-pecan",
    projectId: PATH_PROJECT_ID,
    workstreamId: "WS-WETLANDS-PAD-A",
    permitTypeId: "cat-cpra-cup",
    authorityOrganizationId: "org-cpra",
    authorityOrganizationName: "Coastal Protection and Restoration Authority",
    filingMethod: "EXTERNAL_PORTAL",
    officialPortalUrl: "https://sonris-cpra.dnr.state.la.us/cup-portal",
    externalReferenceNumber: "P20240182",
    externalStatus: "submitted",
    submittedAt: "2026-08-24",
    submittedByUserId: "user-maya-chen",
    submittedByName: "Maya Chen",
    lastStatusVerifiedAt: "2026-08-28",
    lastStatusVerifiedBy: "Jean-Paul Guidry",
    authoritativeSystemName: "SONRIS CPRA",
    notes: "Customer-provided reference; agency portal remains authoritative.",
    receiptDocumentVersionIds: [],
    createdAt: "2026-08-24T12:00:00Z",
    updatedAt: "2026-08-28T10:15:00Z",
  },
];

export type ProjectOverview = {
  project: ProjectRecord;
  stage: string;
  healthLabel: string;
  baseline: string;
  forecast: string;
  varianceDays: number;
  criticalPathCount: number;
  activeWorkstreamCount: number;
  blockedWorkstreamCount: number;
  nextMilestone: { title: string; date: string; owner: string };
  scheduleDrivers: string[];
  customerActions: Array<{ label: string; detail: string; count: number }>;
  governmentActions: Array<{ title: string; agency: string; stage: string; targetDate: string; customerAction: string }>;
  blockers: Array<{ title: string; owner: string; impact: string; expectedResolution: string }>;
  upcomingEvents: Array<{ title: string; date: string; type: string; detail: string }>;
};

export function getProjectOverview(project: ProjectRecord, workstreams: WorkstreamRecord[], customerRequests: CustomerRequestRecord[] = [], externalFilings: ExternalFilingRecord[] = []): ProjectOverview {
  const active = workstreams.filter((workstream) => !["complete", "cancelled"].includes(workstream.operationalState));
  const blockers = active.filter((workstream) => ["blocked", "waiting_government", "waiting_applicant", "waiting_external", "escalated"].includes(workstream.operationalState));
  const next = [...active].sort((left, right) => left.forecastTargetDate.localeCompare(right.forecastTargetDate))[0];
  const critical = active.filter((workstream) => workstream.isCriticalPath);
  const filingsInProgress = externalFilings.filter((filing) => !["approved", "denied", "closed"].includes(filing.externalStatus)).length;
  return {
    project,
    stage: project.scheduleVarianceDays > 0 ? "Active delivery · recovery watch" : "Active delivery",
    healthLabel: project.overallRagHealth === "red" ? "At risk" : project.overallRagHealth === "yellow" ? "Watch" : "On track",
    baseline: project.baselineLaunchDate,
    forecast: project.currentForecastLaunchDate,
    varianceDays: project.scheduleVarianceDays,
    criticalPathCount: critical.length,
    activeWorkstreamCount: active.length,
    blockedWorkstreamCount: blockers.length,
    nextMilestone: next ? { title: next.nextExpectedEvent, date: next.forecastTargetDate, owner: next.regulatoryLead.orgName } : { title: "Project closeout", date: project.currentForecastLaunchDate, owner: project.leadStateAgencyCode },
    scheduleDrivers: critical.slice(0, 3).map((workstream) => `${workstream.title} · ${workstream.scheduleVarianceDays > 0 ? `${workstream.scheduleVarianceDays} days variance` : "critical path"}`),
    customerActions: [
      { label: "Requests needing your response", detail: "RFIs and customer submissions", count: customerRequests.filter((request) => request.status === "submitted" || request.status === "triage" || request.status === "in_progress").length },
      { label: "External filings being tracked", detail: "Manual status updates from agency systems", count: filingsInProgress },
      { label: "Documents requested", detail: "Supporting versions and receipts", count: project.documents.reduce((count, document) => count + document.versions.length, 0) },
    ],
    governmentActions: active.slice(0, 6).map((workstream) => ({ title: workstream.title, agency: workstream.regulatoryLead.orgName, stage: workstream.currentStageName ?? workstream.operationalStateLabel, targetDate: workstream.forecastTargetDate, customerAction: workstream.customerActionRequired })),
    blockers: blockers.slice(0, 5).map((workstream) => ({ title: workstream.waitingReason ?? workstream.currentActionSummary, owner: workstream.waitingOnEntity ?? workstream.regulatoryLead.orgName, impact: workstream.isCriticalPath ? "Critical path impact" : `${workstream.scheduleVarianceDays} day schedule variance`, expectedResolution: workstream.nextExpectedEvent })),
    upcomingEvents: project.meetings.map((meeting) => ({ title: meeting.title, date: meeting.meetingDate, type: "Meeting", detail: meeting.locationOrLink })).concat(project.decisions.map((decision) => ({ title: decision.title, date: decision.decisionDate, type: "Decision", detail: decision.decisionSummary }))).slice(0, 8),
  };
}

export function filingModeLabel(mode: FilingMode | undefined) {
  if (mode === "PATH_SUPPORTED") return "Submit in PATH";
  if (mode === "EXTERNAL_PORTAL") return "File in official agency portal";
  if (mode === "EMAIL_PAPER_OTHER") return "Email / paper / other";
  if (mode === "TRACK_ONLY") return "Track existing filing";
  return "Filing method to confirm";
}

export function customerVisibleProfiles(profiles = projectProfiles) {
  return profiles.filter((profile) => profile.isActive && profile.isCustomerVisible);
}

export function participantForWorkstream(workstreamId: string) {
  return projectParticipants.find((participant) => participant.isActive && participant.workstreamIds.includes(workstreamId) && participant.reviewResponsibility.length > 0);
}

export function participantForTask(taskId: string, workstreamId?: string) {
  return projectParticipants.find((participant) => participant.isActive && participant.assignedTaskIds.includes(taskId))
    ?? (workstreamId ? participantForWorkstream(workstreamId) : undefined);
}
