export type PermitStatus = "in-review" | "action-needed" | "hearing" | "approved";
export type StepState = "done" | "active" | "blocked" | "hearing" | "future";

export type RequestCategory =
  | "permit"
  | "road"
  | "utility"
  | "public_safety"
  | "workforce"
  | "community";

export type JurisdictionLevel =
  | "Federal"
  | "State"
  | "Local / Parish"
  | "Utility / Regional";

export type RAGStatus = "green" | "yellow" | "red";

export type CategoryMeta = {
  id: RequestCategory;
  label: string;
  shortLabel: string;
  description: string;
  defaultLeadAgency: string;
};

export const requestCategories: Record<RequestCategory, CategoryMeta> = {
  permit: {
    id: "permit",
    label: "Environmental & Construction Permits",
    shortLabel: "Permits",
    description: "Statutory air, water, coastal, and facility authorizations across state and parish agencies.",
    defaultLeadAgency: "LDEQ",
  },
  road: {
    id: "road",
    label: "Heavy-Haul & Transportation Infrastructure",
    shortLabel: "Roads & Access",
    description: "State highway reinforcement, oversized transport routes, bridges, and traffic controls.",
    defaultLeadAgency: "DOTD",
  },
  utility: {
    id: "utility",
    label: "Power, Water, Gas & Utility Interconnection",
    shortLabel: "Utilities",
    description: "High-voltage grid transmission, substation right-of-ways, and industrial water feeds.",
    defaultLeadAgency: "LPSC & Entergy",
  },
  public_safety: {
    id: "public_safety",
    label: "Airspace, Maritime & Hazardous Safety",
    shortLabel: "Public Safety",
    description: "FAA airspace NOTAMs, Coast Guard water closures, State Police escorts, and Fire Marshal cryogenic safety.",
    defaultLeadAgency: "State Police / FAA / OSFM",
  },
  workforce: {
    id: "workforce",
    label: "Workforce Training & Labor Pipeline",
    shortLabel: "Workforce",
    description: "Community college fast-track aerospace technician credentials and regional hiring consortia.",
    defaultLeadAgency: "LED & SLCC",
  },
  community: {
    id: "community",
    label: "Parish, Environmental & Community Liaison",
    shortLabel: "Community",
    description: "Parish police jury coordination, baseline water testing, and public feedback channels.",
    defaultLeadAgency: "Vermilion Parish",
  },
};

export type Agency = {
  id: "ldeq" | "conservation-energy" | "dotd" | "cpra" | "led" | "osfm" | "lsp" | "parish";
  abbreviation: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type EscalationTier = {
  level: 1 | 2 | 3;
  title: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  agency: string;
  status: "idle" | "engaged" | "escalated";
};

export type PermitStep = {
  phase: string;
  title: string;
  meta: string;
  state: StepState;
  note?: string;
};

export type GanttPhase = {
  name: string;
  startMonth: number; // 1 = Jan, 12 = Dec 2024
  endMonth: number;
  state: StepState;
};

export type GanttTimeline = {
  startMonth: number;
  endMonth: number;
  progressMonth: number; // e.g. 5.5 = Mid-May
  phases: GanttPhase[];
};

export type ServiceRequest = {
  id: string;
  title: string;
  type: string;
  category: RequestCategory;
  categoryLabel: string;
  applicant: string;
  organization: string;
  leadAgency: string;
  leadAgencyCode: string;
  agencyLevel: JurisdictionLevel;
  submitted: string;
  targetDate: string;
  currentDay: number;
  totalDays: number;
  status: PermitStatus;
  statusLabel: string;
  ragStatus: RAGStatus;
  ragLabel: string;
  isCriticalPath: boolean;
  blocker?: {
    title: string;
    description: string;
    severity: "critical" | "warning";
    blockedSince: string;
    unblockingAction: string;
  };
  owner: {
    name: string;
    title: string;
    agency: string;
    email: string;
    phone: string;
  };
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  escalationPath: EscalationTier[];
  steps: PermitStep[];
  gantt?: GanttTimeline;
  nextSteps: Array<{
    title: string;
    body: string;
    due?: string;
    responsibleParty?: string;
  }>;
  alert?: {
    tone: "warning" | "info";
    title: string;
    body: string;
  };
  officialFilingNotice?: string;
};

export type PermitRecord = ServiceRequest;

export type DemoAccount = {
  username: string;
  name: string;
  agencyId: Agency["id"] | "spaceport";
  applicationIds: string[];
  scenario: string;
};

export const DEMO_PASSWORD = "demo1234";

export const agencies: Agency[] = [
  {
    id: "ldeq",
    abbreviation: "LDEQ",
    name: "Louisiana Department of Environmental Quality",
    description: "Air, water, waste, and environmental permits",
    enabled: true,
  },
  {
    id: "conservation-energy",
    abbreviation: "C&E",
    name: "Louisiana Department of Conservation and Energy",
    description: "Oil, gas, and mineral permits",
    enabled: false,
  },
];

export type DemoPersona = {
  id: string;
  name: string;
  role: string;
  roleDescription: string;
  email: string;
  password?: string;
  badge: string;
  scenario: string;
  group: "SpaceX Louisiana Program" | "Applicant Scenarios" | "Louisiana Governor's Office of Major Projects & Delivery";
  displayTitle?: string;
  organization?: string;
  organizationalUnit?: string;
  workEmail?: string;
  legacyEmails?: string[];
};

export type RoleId = "admin" | "submitter" | "reviewer" | "infrastructure" | "community" | "viewer";

export type PermissionKey =
  | "manage_roles"
  | "edit_workflow"
  | "submit_requests"
  | "add_blockers"
  | "resolve_blockers"
  | "escalate_liaison"
  | "reassign_agency";

export type RoleDefinition = {
  id: RoleId;
  name: string;
  description: string;
  badge: string;
  defaultPermissions: PermissionKey[];
};

export const roleDefinitions: Record<string, RoleDefinition> = {
  admin: {
    id: "admin",
    name: "Program Administrator / Supervisor",
    description: "Full access to edit workflows, manage team roles & permissions, escalate blockers, and reassign agencies.",
    badge: "Administrator",
    defaultPermissions: [
      "manage_roles",
      "edit_workflow",
      "submit_requests",
      "add_blockers",
      "resolve_blockers",
      "escalate_liaison",
      "reassign_agency",
    ],
  },
  submitter: {
    id: "submitter",
    name: "SpaceX Project Lead / Submitter",
    description: "Submit plain-English needs, update project notes, and track critical path milestones.",
    badge: "Project Lead",
    defaultPermissions: ["submit_requests", "escalate_liaison"],
  },
  reviewer: {
    id: "reviewer",
    name: "Agency Technical Reviewer",
    description: "Review statutory technical submittals, advance review stages, and request technical clarification.",
    badge: "Reviewer",
    defaultPermissions: ["edit_workflow", "add_blockers", "resolve_blockers"],
  },
  infrastructure: {
    id: "infrastructure",
    name: "Infrastructure & Utility Lead",
    description: "Manage civil road reinforcements, high-voltage interconnections, and contractor sign-offs.",
    badge: "Infrastructure",
    defaultPermissions: ["edit_workflow", "add_blockers", "resolve_blockers", "escalate_liaison"],
  },
  community: {
    id: "community",
    name: "Community & Hearing Coordinator",
    description: "Schedule public hearings, coordinate parish liaison town halls, and publish water quality updates.",
    badge: "Community",
    defaultPermissions: ["edit_workflow"],
  },
  viewer: {
    id: "viewer",
    name: "Applicant / Read-Only Stakeholder",
    description: "View-only access to authorized filing records, timelines, and decision notices.",
    badge: "Stakeholder",
    defaultPermissions: [],
  },
};

Object.assign(roleDefinitions, {
  contributor: roleDefinitions.viewer,
  supervisor: roleDefinitions.reviewer,
  organization_admin: roleDefinitions.admin,
  system_admin: roleDefinitions.admin,
});

export type TeamUser = {
  id: string;
  name: string;
  email: string;
  roleId: RoleId;
  organization: string;
  agency: string;
  permissions: PermissionKey[];
  organizationId?: string;
  displayTitle?: string;
  organizationalUnit?: string;
  workEmail?: string;
  phone?: string;
  membershipRole?: "contributor" | "supervisor" | "organization_admin" | "system_admin";
};

export const initialTeamUsers: TeamUser[] = [
  {
    id: "user-maya-chen",
    name: "Maya Chen",
    email: "maya.chen@spacex.test",
    roleId: "admin",
    organization: "SpaceX Louisiana",
    agency: "Spaceport Executive Team",
    permissions: [
      "manage_roles",
      "edit_workflow",
      "submit_requests",
      "add_blockers",
      "resolve_blockers",
      "escalate_liaison",
      "reassign_agency",
    ],
    displayTitle: "SpaceX Regulatory Affairs Manager",
    organizationalUnit: "Regulatory Affairs & Permitting",
    workEmail: "maya.chen@spacex.com",
    phone: "(310) 363-6000",
  },
  {
    id: "user-alex-martin",
    name: "Alex Martin",
    email: "alex.martin@spacex.com",
    roleId: "submitter",
    organization: "SpaceX Louisiana",
    agency: "Launch Complex Operations",
    permissions: ["submit_requests", "escalate_liaison"],
    displayTitle: "SpaceX Project Manager",
    organizationalUnit: "Louisiana Launch Site Delivery",
    workEmail: "alex.martin@spacex.com",
    phone: "(310) 363-6000",
  },
  {
    id: "user-jordan-lee",
    name: "Jordan Lee",
    email: "jordan.lee@la.gov",
    roleId: "reviewer",
    organization: "Louisiana DEQ",
    agency: "Water Quality Division (State)",
    permissions: ["edit_workflow", "add_blockers", "resolve_blockers"],
    displayTitle: "Environmental Scientist 1",
    organizationalUnit: "Office of Environmental Services · Water Quality Permits",
    workEmail: "jordan.lee@la.gov",
    phone: "(225) 219-3181",
  },
  {
    id: "user-sam-rivera",
    name: "Sam Rivera",
    email: "sam.rivera@la.gov",
    roleId: "infrastructure",
    organization: "Louisiana Department of Transportation and Development",
    agency: "District 03 · Aviation and Bridge Design (State)",
    permissions: ["edit_workflow", "add_blockers", "resolve_blockers", "escalate_liaison"],
    displayTitle: "Civil Engineer 4",
    organizationalUnit: "District 03 · Aviation and Bridge Design",
    workEmail: "sam.rivera@la.gov",
    phone: "(337) 262-6100",
  },
  {
    id: "user-riley-brooks",
    name: "Riley Brooks",
    email: "riley.brooks@vermilionparish.org",
    roleId: "community",
    organization: "Vermilion Parish",
    agency: "Parish Intergovernmental Office (Local)",
    permissions: ["edit_workflow"],
    displayTitle: "Intergovernmental Affairs Coordinator",
    organizationalUnit: "Parish Administration · Community Relations",
    workEmail: "riley.brooks@vermilionparish.org",
    phone: "(337) 898-4300",
  },
  {
    id: "user-jordan-thibodaux",
    name: "Jordan Thibodaux",
    email: "applicant.happypath",
    roleId: "viewer",
    organization: "Riverdale Infrastructure LLC",
    agency: "Applicant Team",
    permissions: [],
    displayTitle: "Applicant Contact",
    workEmail: "jordan.thibodaux@example.com",
  },
  {
    id: "user-joe-skaggs",
    name: "Joe Skaggs",
    email: "joe.skaggs@la.gov",
    roleId: "admin",
    organization: "Louisiana Economic Development (LED)",
    agency: "PATH / Louisiana Project Delivery Administration",
    permissions: ["manage_roles", "edit_workflow", "submit_requests", "add_blockers", "resolve_blockers", "escalate_liaison", "reassign_agency"],
    displayTitle: "Space Czar",
    organizationalUnit: "PATH / Louisiana Project Delivery Administration",
    workEmail: "joe.skaggs@la.gov",
    phone: "(225) 342-3000",
  },
];

export const demoPersonas: DemoPersona[] = [
  {
    id: "alex-martin",
    name: "Alex Martin",
    role: "Customer / Submitter",
    roleDescription: "SpaceX Louisiana project lead submitting and monitoring permits",
    email: "alex.martin@spacex.com",
    leg…5225 tokens truncated…: "Completed · January 25, 2024", state: "done" },
      { phase: "Phase 2 · Coastal Zoning", title: "Height & Setback Variance Sign-off", meta: "Completed · March 10, 2024", state: "done" },
      { phase: "Phase 3 · Foundation Release", title: "Deep Pile Driving & Slab Release", meta: "Completed · April 30, 2024", state: "done" },
      { phase: "Phase 4 · Final Sign-off", title: "Full Industrial Construction Permit Issued", meta: "Completed · May 28, 2024", state: "done" },
    ],
    nextSteps: [
      { title: "Conduct Foundation Concrete Pours", body: "Continuous structural inspection during 1,200-yard foundation pour.", due: "June 20, 2024", responsibleParty: "SpaceX Facilities" },
    ],
    officialFilingNotice: "Parish Building Permit VP-IND-2024-041 on record at Abbeville courthouse.",
  },
  {
    id: "TASK-T005",
    title: "Gulf Airspace NOTAM & Maritime Launch Safety Corridor",
    type: "Multi-Agency Safety & Security Authorization",
    category: "public_safety",
    categoryLabel: "Public Safety",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "FAA Southwest Region, USCG District 8 & Louisiana State Police",
    leadAgencyCode: "FAA / USCG / LSP",
    agencyLevel: "Federal",
    submitted: "March 1, 2024",
    targetDate: "November 1, 2024",
    currentDay: 90,
    totalDays: 245,
    status: "in-review",
    statusLabel: "Airspace & Maritime Draft Plan In Review",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: true,
    owner: {
      name: "Maj. Ryan Falcon",
      title: "Commander, Aviation Liaison & Emergency Operations",
      agency: "Louisiana State Police / FAA Liaison",
      email: "ryan.falcon@dps.la.gov",
      phone: "(225) 925-6000",
    },
    contact: {
      name: "LSP Emergency Services Coordination",
      email: "lsp-emergency@example.invalid",
      phone: "(225) 925-6113",
    },
    escalationPath: [
      {
        level: 1,
        title: "LSP Aerospace Liaison Commander",
        contactName: "Maj. Ryan Falcon",
        contactEmail: "ryan.falcon@dps.la.gov",
        contactPhone: "(225) 925-6000",
        agency: "State Police (State)",
        status: "engaged",
      },
      {
        level: 2,
        title: "GOHSEP Operations Director",
        contactName: "Col. Jacques Trahan",
        contactEmail: "j.trahan@gohsep.la.gov",
        contactPhone: "(225) 925-7500",
        agency: "GOHSEP (State)",
        status: "idle",
      },
      {
        level: 3,
        title: "FAA Commercial Space Operations Desk",
        contactName: "Federal Space Transportation Lead",
        contactEmail: "ast-liaison@faa.gov",
        contactPhone: "(202) 267-8000",
        agency: "FAA (Federal)",
        status: "idle",
      },
    ],
    gantt: {
      startMonth: 3,
      endMonth: 11,
      progressMonth: 5.5,
      phases: [
        { name: "Azimuth Hazard Mapping", startMonth: 3, endMonth: 4, state: "done" },
        { name: "USCG Notice Protocol", startMonth: 4, endMonth: 5, state: "done" },
        { name: "FAA ATC Agreement", startMonth: 5, endMonth: 8, state: "active" },
        { name: "Multi-Agency Drill", startMonth: 8, endMonth: 9, state: "future" },
        { name: "Final Launch License Release", startMonth: 9, endMonth: 11, state: "future" },
      ],
    },
    steps: [
      { phase: "Phase 1 · Trajectory Mapping", title: "Launch Azimuth & Hazard Area Analysis", meta: "Completed · March 28, 2024", state: "done" },
      { phase: "Phase 2 · Maritime Coordination", title: "USCG Local Notice to Mariners Protocol", meta: "Completed · May 15, 2024", state: "done" },
      { phase: "Phase 3 · Airspace Protocol", title: "FAA Air Traffic Control System Command Center Letter of Agreement", meta: "In progress · Target July 30, 2024", state: "active" },
      { phase: "Phase 4 · Tabletop Simulation", title: "Multi-Agency Live Evacuation & Communications Drill", meta: "Scheduled · August 22, 2024", state: "future" },
      { phase: "Phase 5 · Final Safety Release", title: "Joint State/Federal Launch Safety Certification", meta: "Target: Day 245 (November 1, 2024)", state: "future" },
    ],
    nextSteps: [
      { title: "Finalize Houston Air Route Traffic Control Agreement", body: "Submit signed letters of agreement to FAA Southwest Regional office.", due: "July 12, 2024", responsibleParty: "FAA Liaison Team" },
      { title: "Commercial Fisherman Notice Briefing", body: "Host Delcambre & Intracoastal City shrimper advisory session.", due: "July 28, 2024", responsibleParty: "Vermilion Parish & USCG" },
    ],
    officialFilingNotice: "FAA commercial launch license filings coordinated under Title 14 CFR Part 450.",
  },
  {
    id: "TASK-T006",
    title: "Coastal Dune Reconstruction & Chenier Wetland Mitigation Bank",
    type: "Coastal Use & Wetland Mitigation Permit",
    category: "permit",
    categoryLabel: "Permits",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Coastal Protection & Restoration Authority & US Army Corps of Engineers",
    leadAgencyCode: "CPRA / USACE",
    agencyLevel: "Federal",
    submitted: "February 10, 2024",
    targetDate: "October 30, 2024",
    currentDay: 110,
    totalDays: 260,
    status: "action-needed",
    statusLabel: "Mitigation Credit Ledger Verification Required",
    ragStatus: "yellow",
    ragLabel: "Action Required",
    isCriticalPath: false,
    blocker: {
      title: "USACE Section 404 Compensatory Wetland Credit Audit",
      description: "USACE New Orleans District requested updated ledger verification for 68 bottomland hardwood and brackish marsh credits before issuing joint CUP/Section 10/404 authorization.",
      severity: "warning",
      blockedSince: "May 18, 2024",
      unblockingAction: "Transmit verified credit purchase certificates from Teche-Vermilion Coastal Mitigation Bank.",
    },
    owner: {
      name: "Dr. Monique Richard",
      title: "Senior Coastal Resources Scientist",
      agency: "CPRA Louisiana",
      email: "monique.richard@la.gov",
      phone: "(225) 342-7308",
    },
    contact: {
      name: "CPRA Permitting Division",
      email: "cpra-permits@example.invalid",
      phone: "(225) 342-7308",
    },
    escalationPath: [
      {
        level: 1,
        title: "CPRA Coastal Scientist",
        contactName: "Dr. Monique Richard",
        contactEmail: "monique.richard@la.gov",
        contactPhone: "(225) 342-7308",
        agency: "CPRA (State)",
        status: "engaged",
      },
      {
        level: 2,
        title: "USACE New Orleans Regulatory PM",
        contactName: "Darren Babin",
        contactEmail: "darren.babin@usace.army.mil",
        contactPhone: "(504) 862-2270",
        agency: "USACE (Federal)",
        status: "idle",
      },
    ],
    gantt: {
      startMonth: 2,
      endMonth: 10,
      progressMonth: 5.5,
      phases: [
        { name: "Wetland Delineation", startMonth: 2, endMonth: 3, state: "done" },
        { name: "Living Shoreline Plan", startMonth: 3, endMonth: 4, state: "done" },
        { name: "USACE 404 Credit Audit", startMonth: 4, endMonth: 6, state: "blocked" },
        { name: "Joint Public Notice", startMonth: 6, endMonth: 8, state: "future" },
        { name: "Joint CUP Issuance", startMonth: 8, endMonth: 10, state: "future" },
      ],
    },
    steps: [
      { phase: "Phase 1 · Wetland Delineation", title: "On-Site Soil & Vegetation Survey", meta: "Completed · March 5, 2024", state: "done" },
      { phase: "Phase 2 · Mitigation Plan", title: "Living Shoreline & Oyster Reef Barrier Plan", meta: "Completed · April 22, 2024", state: "done" },
      { phase: "Phase 3 · Joint Agency Review", title: "USACE 404 & CPRA Coastal Use Consistency", meta: "Action Required · Day 110 — Ledger audit requested", state: "blocked" },
      { phase: "Phase 4 · Public Notice", title: "Joint State/Federal 20-Day Public Notice", meta: "Target: Day 170 (August 1, 2024)", state: "future" },
      { phase: "Phase 5 · Joint Permit", title: "Coastal Use Permit (CUP) Issuance", meta: "Target: Day 260 (October 30, 2024)", state: "future" },
    ],
    nextSteps: [
      { title: "Upload Teche-Vermilion Bank Certificates", body: "SpaceX environmental counsel to transmit proof of credit escrow funding.", due: "June 18, 2024", responsibleParty: "SpaceX Environmental" },
    ],
    officialFilingNotice: "Statutory Coastal Use Permit filed under Joint Application P20240182.",
  },
  {
    id: "TASK-T007",
    title: "South Louisiana Aerospace Specialized Workforce Consortium",
    type: "State Workforce Pipeline & Customized Training Grant",
    category: "workforce",
    categoryLabel: "Workforce",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Louisiana Economic Development (LED) & SLCC",
    leadAgencyCode: "LED / SLCC",
    agencyLevel: "State",
    submitted: "January 20, 2024",
    targetDate: "August 1, 2024",
    currentDay: 130,
    totalDays: 190,
    status: "in-review",
    statusLabel: "Curriculum Approved · Lab Outfitting In Progress",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    owner: {
      name: "Andre Thibodeaux",
      title: "Executive Director of Aerospace Workforce Initiatives",
      agency: "LED FastStart",
      email: "andre.thibodeaux@la.gov",
      phone: "(225) 342-3000",
    },
    contact: {
      name: "LED FastStart Program Office",
      email: "faststart@la.gov",
      phone: "(225) 342-3000",
    },
    escalationPath: [
      {
        level: 1,
        title: "LED FastStart Coordinator",
        contactName: "Andre Thibodeaux",
        contactEmail: "andre.thibodeaux@la.gov",
        contactPhone: "(225) 342-3000",
        agency: "LED (State)",
        status: "engaged",
      },
    ],
    gantt: {
      startMonth: 1,
      endMonth: 8,
      progressMonth: 5.5,
      phases: [
        { name: "Skills Matrix Definition", startMonth: 1, endMonth: 2, state: "done" },
        { name: "LED FastStart $4.2M Grant", startMonth: 2, endMonth: 3, state: "done" },
        { name: "Abbeville Campus Lab Delivery", startMonth: 3, endMonth: 7, state: "active" },
        { name: "Cohort 1 Launch (60 Techs)", startMonth: 7, endMonth: 8, state: "future" },
      ],
    },
    steps: [
      { phase: "Phase 1 · Skills Matrix", title: "Aerospace TIG/Orbital Welding & NDT Competency Definition", meta: "Completed · February 15, 2024", state: "done" },
      { phase: "Phase 2 · Funding Allocation", title: "LED FastStart $4.2M Grant Authorization", meta: "Completed · March 30, 2024", state: "done" },
      { phase: "Phase 3 · Training Center Outfitting", title: "Abbeville Campus Aerospace Lab Equipment Delivery", meta: "In progress · Target July 5, 2024", state: "active" },
      { phase: "Phase 4 · Cohort 1 Launch", title: "First 60-Student Technician Cohort Starts", meta: "Target: Day 190 (August 1, 2024)", state: "future" },
    ],
    nextSteps: [
      { title: "Finalize Tooling Delivery Schedule", body: "SLCC facilities receiving vacuum test rigs and automated orbital weld heads.", due: "June 28, 2024", responsibleParty: "SLCC / LED" },
    ],
    officialFilingNotice: "Workforce cooperative endeavor agreement on file with LED Contract #LED-2024-W091.",
  },
  {
    id: "TASK-T008",
    title: "Cryogenic Fuel & High-Pressure Hazardous Storage Plan",
    type: "Industrial Fire Safety & Cryogenic Storage Approval",
    category: "public_safety",
    categoryLabel: "Public Safety",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Louisiana Office of State Fire Marshal",
    leadAgencyCode: "OSFM",
    agencyLevel: "State",
    submitted: "February 15, 2024",
    targetDate: "September 15, 2024",
    currentDay: 105,
    totalDays: 210,
    status: "in-review",
    statusLabel: "Plan Review & Piping Instrumentation Validated",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    owner: {
      name: "Capt. Travis Miller",
      title: "Senior Industrial Hazmat Specialist",
      agency: "Louisiana Office of State Fire Marshal",
      email: "travis.miller@dps.la.gov",
      phone: "(225) 925-4911",
    },
    contact: {
      name: "OSFM Plan Review Section",
      email: "osfm-reviews@example.invalid",
      phone: "(225) 925-4911",
    },
    escalationPath: [
      {
        level: 1,
        title: "OSFM Hazmat Reviewer",
        contactName: "Capt. Travis Miller",
        contactEmail: "travis.miller@dps.la.gov",
        contactPhone: "(225) 925-4911",
        agency: "OSFM (State)",
        status: "engaged",
      },
    ],
    gantt: {
      startMonth: 2,
      endMonth: 9,
      progressMonth: 5.5,
      phases: [
        { name: "LOX/LNG Separation Study", startMonth: 2, endMonth: 3, state: "done" },
        { name: "Deluge Piping Sign-off", startMonth: 3, endMonth: 5, state: "done" },
        { name: "Vapor Dispersion Verification", startMonth: 5, endMonth: 7, state: "active" },
        { name: "Field Hydrostatic Witness", startMonth: 7, endMonth: 8, state: "future" },
        { name: "OSFM Certificate of Occupancy", startMonth: 8, endMonth: 9, state: "future" },
      ],
    },
    steps: [
      { phase: "Phase 1 · Cryogenic Layout", title: "LOX / Liquid Methane Separation Distances Review", meta: "Completed · March 20, 2024", state: "done" },
      { phase: "Phase 2 · Water Deluge Review", title: "High-Pressure Water Deluge Piping Review", meta: "Completed · May 10, 2024", state: "done" },
      { phase: "Phase 3 · Vapor Cloud Dispersion", title: "Thermal Radiation & Dispersion Hazard Verification", meta: "In progress · Target July 20, 2024", state: "active" },
      { phase: "Phase 4 · Field Hydrostatic Test", title: "On-Site Tank & Header Hydrostatic Inspection", meta: "Target: Day 180 (August 15, 2024)", state: "future" },
      { phase: "Phase 5 · Operating Certificate", title: "OSFM Cryogenic Fueling Certificate of Occupancy", meta: "Target: Day 210 (September 15, 2024)", state: "future" },
    ],
    nextSteps: [
      { title: "Schedule On-Site Valve & Relief Device Audit", body: "Coordinate physical witness testing of high-pressure emergency vent valves.", due: "July 18, 2024", responsibleParty: "OSFM & SpaceX Safety" },
    ],
    officialFilingNotice: "Hazardous facility plan review application OSFM-2024-CRYO-091.",
  },
  {
    id: "TASK-T009",
    title: "Pecan Island Community Water & Coastal Baseline Monitoring",
    type: "Local Government Community Agreement & Groundwater Baseline",
    category: "community",
    categoryLabel: "Community",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Vermilion Parish Police Jury & Louisiana Department of Health",
    leadAgencyCode: "Parish / LDH",
    agencyLevel: "Local / Parish",
    submitted: "January 8, 2024",
    targetDate: "Ongoing Tracking",
    currentDay: 142,
    totalDays: 180,
    status: "approved",
    statusLabel: "Active Ongoing Monitoring & Monthly Briefing",
    ragStatus: "green",
    ragLabel: "Active",
    isCriticalPath: false,
    owner: {
      name: "Elena Sonnier",
      title: "Parish Community & Intergovernmental Liaison",
      agency: "Vermilion Parish Government",
      email: "e.sonnier@vermiliongov.invalid",
      phone: "(337) 898-4302",
    },
    contact: {
      name: "Vermilion Parish Community Office",
      email: "community@vermiliongov.invalid",
      phone: "(337) 898-4302",
    },
    escalationPath: [
      {
        level: 1,
        title: "Community Liaison",
        contactName: "Elena Sonnier",
        contactEmail: "e.sonnier@vermiliongov.invalid",
        contactPhone: "(337) 898-4302",
        agency: "Vermilion Parish (Local)",
        status: "engaged",
      },
    ],
    gantt: {
      startMonth: 1,
      endMonth: 12,
      progressMonth: 5.5,
      phases: [
        { name: "Baseline Well Installation", startMonth: 1, endMonth: 2, state: "done" },
        { name: "Monthly Town Hall Cadence", startMonth: 2, endMonth: 5, state: "done" },
        { name: "Public Water Sensor Feeds", startMonth: 5, endMonth: 12, state: "active" },
      ],
    },
    steps: [
      { phase: "Phase 1 · Well Baseline", title: "12 Shallow Aquifer Baseline Testing Wells Installed", meta: "Completed · February 10, 2024", state: "done" },
      { phase: "Phase 2 · Monthly Town Hall", title: "Pecan Island Community Center Public Q&A Series", meta: "Active · 4 sessions completed", state: "done" },
      { phase: "Phase 3 · Public Transparency Portal", title: "Real-Time Well Sounding & Salinity Sensor Feeds", meta: "Live Online · Continuous feed", state: "active" },
    ],
    nextSteps: [
      { title: "Host July Community Breakfast & Update", body: "Review traffic patterns and road repaving schedule with Pecan Island residents.", due: "July 8, 2024", responsibleParty: "Vermilion Parish Liaison" },
    ],
    officialFilingNotice: "Parish Intergovernmental Resolution 2024-R-012 on file in Abbeville.",
  },
];

const taskMap = Object.fromEntries(pecanIslandRequests.map((req) => [req.id, req]));

export const permits: Record<string, ServiceRequest> = {
  ...taskMap,
  // Backward compatibility aliases
  "REQ-PECAN-001": taskMap["TASK-T001"],
  "REQ-PECAN-002": taskMap["TASK-T002"],
  "REQ-PECAN-003": taskMap["TASK-T003"],
  "REQ-PECAN-004": taskMap["TASK-T004"],
  "REQ-PECAN-005": taskMap["TASK-T005"],
  "REQ-PECAN-006": taskMap["TASK-T006"],
  "REQ-PECAN-007": taskMap["TASK-T007"],
  "REQ-PECAN-008": taskMap["TASK-T008"],
  "REQ-PECAN-009": taskMap["TASK-T009"],
  "WQ-2024-00142": taskMap["TASK-T003"],
  "WQ-2024-00089": taskMap["TASK-T001"],
  "WQ-2024-00207": taskMap["TASK-T003"],
};

export const requests: Record<string, ServiceRequest> = permits;
