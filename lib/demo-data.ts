export type PermitStatus = "in-review" | "action-needed" | "hearing" | "approved";
export type StepState = "done" | "active" | "blocked" | "hearing" | "future";

export type RequestCategory =
  | "permit"
  | "road"
  | "utility"
  | "public_safety"
  | "workforce"
  | "community";

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
  group: "SpaceX Louisiana Program" | "Applicant Scenarios";
};

export const demoPersonas: DemoPersona[] = [
  {
    id: "alex-martin",
    name: "Alex Martin",
    role: "Customer / Submitter",
    roleDescription: "SpaceX Louisiana project lead submitting and monitoring permits",
    email: "alex.martin@spacex.test",
    password: "SpaceX-MVP-2026!",
    badge: "Customer",
    scenario: "Customer applicant portal",
    group: "SpaceX Louisiana Program",
  },
  {
    id: "maya-chen",
    name: "Maya Chen",
    role: "Program Supervisor",
    roleDescription: "Spaceport program supervisor managing approvals and queues",
    email: "maya.chen@spacex.test",
    password: "SpaceX-MVP-2026!",
    badge: "Supervisor",
    scenario: "Program oversight & approvals",
    group: "SpaceX Louisiana Program",
  },
  {
    id: "jordan-lee",
    name: "Jordan Lee",
    role: "Environmental Reviewer",
    roleDescription: "LDEQ / environmental quality technical reviewer",
    email: "jordan.lee@spacex.test",
    password: "SpaceX-MVP-2026!",
    badge: "Reviewer",
    scenario: "Environmental review",
    group: "SpaceX Louisiana Program",
  },
  {
    id: "sam-rivera",
    name: "Sam Rivera",
    role: "Infrastructure Lead",
    roleDescription: "DOTD / civil engineering and utility coordinator",
    email: "sam.rivera@spacex.test",
    password: "SpaceX-MVP-2026!",
    badge: "Infrastructure",
    scenario: "Infrastructure coordination",
    group: "SpaceX Louisiana Program",
  },
  {
    id: "riley-brooks",
    name: "Riley Brooks",
    role: "Community Coordinator",
    roleDescription: "Public hearings, comment periods, and local government liaison",
    email: "riley.brooks@spacex.test",
    password: "SpaceX-MVP-2026!",
    badge: "Community",
    scenario: "Public hearings & liaison",
    group: "SpaceX Louisiana Program",
  },
  {
    id: "jordan-thibodaux",
    name: "Jordan Thibodaux",
    role: "Standard Review Applicant",
    roleDescription: "Applicant with active water quality permit under standard review",
    email: "applicant.happypath",
    password: DEMO_PASSWORD,
    badge: "In Review",
    scenario: "Standard review",
    group: "Applicant Scenarios",
  },
  {
    id: "marcus-fontenot",
    name: "Marcus Fontenot",
    role: "Action Required Applicant",
    roleDescription: "Applicant with suspended permit requiring documentation upload",
    email: "applicant.suspended",
    password: DEMO_PASSWORD,
    badge: "Action Needed",
    scenario: "Action required",
    group: "Applicant Scenarios",
  },
  {
    id: "celeste-broussard",
    name: "Celeste Broussard",
    role: "Public Hearing Applicant",
    roleDescription: "Applicant with permit undergoing scheduled public hearing",
    email: "applicant.hearing",
    password: DEMO_PASSWORD,
    badge: "Hearing",
    scenario: "Public hearing",
    group: "Applicant Scenarios",
  },
];

export const demoAccounts: DemoAccount[] = [
  {
    username: "applicant.happypath",
    name: "Jordan Thibodaux",
    agencyId: "ldeq",
    applicationIds: ["WQ-2024-00142"],
    scenario: "Standard review",
  },
  {
    username: "applicant.suspended",
    name: "Marcus Fontenot",
    agencyId: "ldeq",
    applicationIds: ["WQ-2024-00089"],
    scenario: "Action required",
  },
  {
    username: "applicant.hearing",
    name: "Celeste Broussard",
    agencyId: "ldeq",
    applicationIds: ["WQ-2024-00207"],
    scenario: "Public hearing",
  },
];

export const pecanIslandRequests: ServiceRequest[] = [
  {
    id: "REQ-PECAN-001",
    title: "LA-82 Heavy-Haul Access Road & Bridge Reinforcement",
    type: "Road & Bridge Infrastructure Approval",
    category: "road",
    categoryLabel: "Roads & Access",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Louisiana Department of Transportation and Development",
    leadAgencyCode: "DOTD",
    submitted: "January 15, 2024",
    targetDate: "September 1, 2024",
    currentDay: 135,
    totalDays: 230,
    status: "action-needed",
    statusLabel: "Blocked on Coastal Drainage Review",
    ragStatus: "red",
    ragLabel: "Blocked / Critical Path",
    isCriticalPath: true,
    blocker: {
      title: "Inter-Agency Blocker: CPRA Drainage Authorization Required",
      description: "Excavation and culvert expansion near milepost 14.2 requires joint hydrologic concurrence from CPRA before DOTD can issue the heavy-haul bridge reinforcement work order.",
      severity: "critical",
      blockedSince: "May 10, 2024 (28 days elapsed)",
      unblockingAction: "Submit joint hydrologic assessment data to CPRA Water Resources Engineering team.",
    },
    owner: {
      name: "Dave Broussard, P.E.",
      title: "District 03 Senior Project Engineer",
      agency: "Louisiana DOTD",
      email: "dave.broussard@dotd.la.gov",
      phone: "(337) 262-6100",
    },
    contact: {
      name: "DOTD District 03 Infrastructure Team",
      email: "dotd-dist03@example.invalid",
      phone: "(337) 555-0199",
    },
    escalationPath: [
      {
        level: 1,
        title: "DOTD District 03 Review Engineer",
        contactName: "Dave Broussard",
        contactEmail: "dave.broussard@dotd.la.gov",
        contactPhone: "(337) 262-6100",
        agency: "DOTD",
        status: "engaged",
      },
      {
        level: 2,
        title: "State Inter-Agency Infrastructure Liaison",
        contactName: "Jean-Paul Guidry",
        contactEmail: "jp.guidry@gov.la.gov",
        contactPhone: "(225) 342-7000",
        agency: "Governor's Office",
        status: "escalated",
      },
      {
        level: 3,
        title: "Governor's Major Project Task Force",
        contactName: "Secretary of Transportation & CPRA Chair",
        contactEmail: "taskforce@gov.la.gov",
        contactPhone: "(225) 342-0900",
        agency: "Executive Cabinet",
        status: "idle",
      },
    ],
    steps: [
      { phase: "Phase 1 · Project Intake", title: "Route Survey & Axle-Load Study", meta: "Completed · January 28, 2024", state: "done" },
      { phase: "Phase 2 · Engineering Review", title: "Bridge Abutment Structural Analysis", meta: "Completed · March 15, 2024", state: "done" },
      { phase: "Phase 3 · Inter-Agency Clearance", title: "Coastal Zone Drainage Concurrence", meta: "Action Required · Day 135 — Blocked pending CPRA response", state: "blocked", note: "Path clock escalated to Level 2 Inter-Agency Liaison on May 24." },
      { phase: "Phase 4 · Construction Authorization", title: "DOTD Right-of-Way Work Release", meta: "Target: Day 180 (July 15, 2024)", state: "future" },
      { phase: "Phase 5 · Completion & Sign-off", title: "Final Road Load Certification", meta: "Target: Day 230 (September 1, 2024)", state: "future" },
    ],
    nextSteps: [
      { title: "Provide CPRA Hydrologic Model Data", body: "SpaceX civil team to upload updated 100-year storm culvert runoff calculations.", due: "June 12, 2024", responsibleParty: "SpaceX Civil Engineering" },
      { title: "Joint Review Briefing", body: "DOTD and CPRA scheduled for bi-weekly command center sync on June 14.", due: "June 14, 2024", responsibleParty: "Governor's Liaison" },
    ],
    alert: {
      tone: "warning",
      title: "Critical Path Risk · Drainage Approval Needed by June 15",
      body: "Delay on LA-82 culvert sign-off will postpone heavy booster transport trailer delivery to the launch complex.",
    },
    officialFilingNotice: "Formal right-of-way permit application DOTD-ROW-2024-8891 is lodged with Louisiana DOTD District 03.",
  },
  {
    id: "REQ-PECAN-002",
    title: "230kV Dual-Feed High-Capacity Grid Interconnection",
    type: "Electric Utility Transmission Interconnection",
    category: "utility",
    categoryLabel: "Utilities",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Louisiana Public Service Commission & Entergy Louisiana",
    leadAgencyCode: "LPSC / Entergy",
    submitted: "February 1, 2024",
    targetDate: "October 15, 2024",
    currentDay: 118,
    totalDays: 250,
    status: "in-review",
    statusLabel: "Substation Engineering Under Review",
    ragStatus: "green",
    ragLabel: "On Track · Critical Path",
    isCriticalPath: true,
    owner: {
      name: "Carolyn Hebert",
      title: "Director of Large Power Project Interconnects",
      agency: "Entergy Louisiana",
      email: "c.hebert@entergy-power.invalid",
      phone: "(504) 576-4000",
    },
    contact: {
      name: "LPSC Major Projects Division",
      email: "lpsc-projects@example.invalid",
      phone: "(225) 342-4404",
    },
    escalationPath: [
      {
        level: 1,
        title: "Entergy Project Lead",
        contactName: "Carolyn Hebert",
        contactEmail: "c.hebert@entergy-power.invalid",
        contactPhone: "(504) 576-4000",
        agency: "Entergy",
        status: "engaged",
      },
      {
        level: 2,
        title: "LPSC Chief Utilities Engineer",
        contactName: "Mark Landry",
        contactEmail: "m.landry@lpsc.gov",
        contactPhone: "(225) 342-4411",
        agency: "LPSC",
        status: "idle",
      },
      {
        level: 3,
        title: "Governor's Energy Resilience Task Force",
        contactName: "Undersecretary for Energy Infrastructure",
        contactEmail: "energy-liaison@gov.la.gov",
        contactPhone: "(225) 342-7000",
        agency: "Executive Cabinet",
        status: "idle",
      },
    ],
    steps: [
      { phase: "Phase 1 · Interconnection Study", title: "Feasibility and Grid Stability Modeling", meta: "Completed · February 28, 2024", state: "done" },
      { phase: "Phase 2 · Route Survey", title: "18-Mile Transmission Corridor Right-of-Way", meta: "Completed · April 20, 2024", state: "done" },
      { phase: "Phase 3 · Substation Design", title: "Pecan Island 230kV Substation Engineering", meta: "In progress · Target sign-off July 10, 2024", state: "active" },
      { phase: "Phase 4 · Commission Approval", title: "LPSC Docket Final Order", meta: "Target: Day 190 (August 20, 2024)", state: "future" },
      { phase: "Phase 5 · Energization", title: "Dual-Feed Commercial Energization", meta: "Target: Day 250 (October 15, 2024)", state: "future" },
    ],
    nextSteps: [
      { title: "Review Substation Transformer Specifications", body: "Entergy review team completing technical validation for cryogenic chiller loads.", due: "June 25, 2024", responsibleParty: "Entergy Engineering" },
      { title: "Parish Utility Right-of-Way Agreement", body: "Vermilion Parish Police Jury final public hearing review.", due: "July 2, 2024", responsibleParty: "Vermilion Parish" },
    ],
    officialFilingNotice: "Official utility docket filed under LPSC Docket No. U-36940.",
  },
  {
    id: "REQ-PECAN-003",
    title: "Industrial Wastewater & Launch Deluge Retention Basin",
    type: "Individual LPDES Water Quality Permit",
    category: "permit",
    categoryLabel: "Permits",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Louisiana Department of Environmental Quality",
    leadAgencyCode: "LDEQ",
    submitted: "January 10, 2024",
    targetDate: "August 30, 2024",
    currentDay: 140,
    totalDays: 230,
    status: "hearing",
    statusLabel: "Public Hearing Scheduled (July 15)",
    ragStatus: "yellow",
    ragLabel: "Action / Hearing · Critical Path",
    isCriticalPath: true,
    owner: {
      name: "Jordan Lee",
      title: "Senior Environmental Scientist",
      agency: "LDEQ Water Quality Division",
      email: "jordan.lee@la.gov",
      phone: "(225) 219-3181",
    },
    contact: {
      name: "LDEQ Water Quality Permits Division",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
    escalationPath: [
      {
        level: 1,
        title: "LDEQ Permit Review Officer",
        contactName: "Jordan Lee",
        contactEmail: "jordan.lee@la.gov",
        contactPhone: "(225) 219-3181",
        agency: "LDEQ",
        status: "engaged",
      },
      {
        level: 2,
        title: "LDEQ Assistant Secretary",
        contactName: "Celeste Moreau",
        contactEmail: "celeste.moreau@la.gov",
        contactPhone: "(225) 219-3950",
        agency: "LDEQ",
        status: "idle",
      },
      {
        level: 3,
        title: "Governor's Environmental & Economic Council",
        contactName: "Deputy Chief of Staff for Environment",
        contactEmail: "env-council@gov.la.gov",
        contactPhone: "(225) 342-7000",
        agency: "Executive Cabinet",
        status: "idle",
      },
    ],
    steps: [
      { phase: "Phase 1 · Application Intake", title: "Completeness Review & Effluent Sampling Plan", meta: "Completed · January 30, 2024", state: "done" },
      { phase: "Phase 2 · Technical Review", title: "Deluge Water Treatment Modeling", meta: "Completed · April 15, 2024", state: "done" },
      { phase: "Phase 3 · Public Notice", title: "Public Comment Period & Response Matrix", meta: "Completed · Days 100–130", state: "done" },
      { phase: "Phase 4 · Public Hearing", title: "Statewide Public Hearing · Abbeville, LA", meta: "Scheduled · July 15, 2024 at 9:00 AM", state: "hearing", note: "Public hearing will be held at Vermilion Parish Library Auditorium with live virtual testimony link." },
      { phase: "Phase 5 · Permit Determination", title: "Final LPDES Permit Record of Decision", meta: "Target: Day 230 (August 30, 2024)", state: "future" },
    ],
    nextSteps: [
      { title: "Publish Hearing Briefing Packet", body: "Post technical summary and environmental mitigation response documents on public hearing docket.", due: "July 1, 2024", responsibleParty: "LDEQ Public Information" },
      { title: "Hearing Room Protocol Briefing", body: "Coordinate security and testimony transcription with parish deputies.", due: "July 10, 2024", responsibleParty: "State Police & LDEQ" },
    ],
    alert: {
      tone: "info",
      title: "Public Hearing Confirmed: July 15, 2024 at 9:00 AM",
      body: "Oral and written public comments will be incorporated into the final permit determination. Hearing instructions posted.",
    },
    officialFilingNotice: "Statutory application LPDES-LA0128913 is published in the LDEQ Electronic Document Management System (EDMS).",
  },
  {
    id: "REQ-PECAN-004",
    title: "Starship Assembly High-Bay Building Authorization",
    type: "Parish Commercial & Industrial Building Permit",
    category: "permit",
    categoryLabel: "Permits",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Vermilion Parish Development Board",
    leadAgencyCode: "Vermilion Parish",
    submitted: "January 5, 2024",
    targetDate: "June 30, 2024",
    currentDay: 145,
    totalDays: 175,
    status: "approved",
    statusLabel: "Approved · Construction Release Active",
    ragStatus: "green",
    ragLabel: "Approved",
    isCriticalPath: false,
    owner: {
      name: "Brett Landry",
      title: "Chief Building Official",
      agency: "Vermilion Parish Government",
      email: "b.landry@vermiliongov.invalid",
      phone: "(337) 898-4300",
    },
    contact: {
      name: "Vermilion Parish Permitting Office",
      email: "permits@vermiliongov.invalid",
      phone: "(337) 898-4300",
    },
    escalationPath: [
      {
        level: 1,
        title: "Parish Building Official",
        contactName: "Brett Landry",
        contactEmail: "b.landry@vermiliongov.invalid",
        contactPhone: "(337) 898-4300",
        agency: "Vermilion Parish",
        status: "idle",
      },
    ],
    steps: [
      { phase: "Phase 1 · Intake", title: "Architectural & Structural Wind-Load Review (165mph)", meta: "Completed · January 25, 2024", state: "done" },
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
    id: "REQ-PECAN-005",
    title: "Gulf Airspace & Maritime Launch Safety Corridor",
    type: "Multi-Agency Safety & Security Authorization",
    category: "public_safety",
    categoryLabel: "Public Safety",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Louisiana State Police, FAA & USCG District 8",
    leadAgencyCode: "LSP / FAA / USCG",
    submitted: "March 1, 2024",
    targetDate: "November 1, 2024",
    currentDay: 90,
    totalDays: 245,
    status: "in-review",
    statusLabel: "Airspace & Maritime Draft Plan In Review",
    ragStatus: "green",
    ragLabel: "On Track · Critical Path",
    isCriticalPath: true,
    owner: {
      name: "Maj. Ryan Falcon",
      title: "Commander, Emergency Operations & Aviation Liaison",
      agency: "Louisiana State Police",
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
        agency: "State Police",
        status: "engaged",
      },
      {
        level: 2,
        title: "GOHSEP Inter-Agency Operations Director",
        contactName: "Col. Jacques Trahan",
        contactEmail: "j.trahan@gohsep.la.gov",
        contactPhone: "(225) 925-7500",
        agency: "GOHSEP",
        status: "idle",
      },
      {
        level: 3,
        title: "Governor's Homeland Security Council",
        contactName: "Secretary of Public Safety",
        contactEmail: "dps-sec@gov.la.gov",
        contactPhone: "(225) 342-7000",
        agency: "Executive Cabinet",
        status: "idle",
      },
    ],
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
    id: "REQ-PECAN-006",
    title: "Coastal Dune Reconstruction & Chenier Wetland Mitigation Bank",
    type: "Coastal Use & Wetland Mitigation Permit",
    category: "permit",
    categoryLabel: "Permits",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Coastal Protection and Restoration Authority & USACE",
    leadAgencyCode: "CPRA / USACE",
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
        agency: "CPRA",
        status: "engaged",
      },
      {
        level: 2,
        title: "USACE New Orleans District Regulatory Project Manager",
        contactName: "Darren Babin",
        contactEmail: "darren.babin@usace.army.mil",
        contactPhone: "(504) 862-2270",
        agency: "USACE",
        status: "idle",
      },
    ],
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
    id: "REQ-PECAN-007",
    title: "South Louisiana Aerospace Specialized Workforce Consortium",
    type: "State Workforce Pipeline & Customized Training Grant",
    category: "workforce",
    categoryLabel: "Workforce",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Louisiana Economic Development (LED) & SLCC",
    leadAgencyCode: "LED / SLCC",
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
        agency: "LED",
        status: "engaged",
      },
    ],
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
    id: "REQ-PECAN-008",
    title: "Cryogenic Fuel & High-Pressure Hazardous Storage Plan",
    type: "Industrial Fire Safety & Cryogenic Storage Approval",
    category: "public_safety",
    categoryLabel: "Public Safety",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Louisiana Office of State Fire Marshal",
    leadAgencyCode: "OSFM",
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
        agency: "OSFM",
        status: "engaged",
      },
    ],
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
    id: "REQ-PECAN-009",
    title: "Pecan Island Community Water & Coastal Baseline Monitoring",
    type: "Local Government Community Agreement & Groundwater Baseline",
    category: "community",
    categoryLabel: "Community",
    applicant: "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: "Vermilion Parish Police Jury & Louisiana Department of Health",
    leadAgencyCode: "Parish / LDH",
    submitted: "January 8, 2024",
    targetDate: "Ongoing Tracking",
    currentDay: 142,
    totalDays: 180,
    status: "approved",
    statusLabel: "Active Ongoing Monitoring & Monthly Briefing",
    ragStatus: "green",
    ragLabel: "Active Monitoring",
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
        agency: "Vermilion Parish",
        status: "engaged",
      },
    ],
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

export const legacyPermits: Record<string, ServiceRequest> = {
  "WQ-2024-00142": {
    id: "WQ-2024-00142",
    title: "Individual Water Quality Permit · Riverdale Infrastructure",
    type: "Individual Water Quality Permit",
    category: "permit",
    categoryLabel: "Permits",
    applicant: "Riverdale Infrastructure LLC",
    organization: "Riverdale Infrastructure LLC",
    leadAgency: "Louisiana Department of Environmental Quality",
    leadAgencyCode: "LDEQ",
    submitted: "February 14, 2024",
    targetDate: "July 15, 2024",
    currentDay: 87,
    totalDays: 150,
    status: "in-review",
    statusLabel: "Under review",
    ragStatus: "green",
    ragLabel: "On Track",
    isCriticalPath: false,
    owner: {
      name: "Jordan Lee",
      title: "Review Officer",
      agency: "LDEQ",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
    contact: {
      name: "Water Quality Permits Division",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
    escalationPath: [
      {
        level: 1,
        title: "LDEQ Permit Reviewer",
        contactName: "Jordan Lee",
        contactEmail: "wq-permits@example.invalid",
        contactPhone: "(225) 555-0100",
        agency: "LDEQ",
        status: "engaged",
      },
    ],
    steps: [
      { phase: "Phase 1 · Application review", title: "Application received", meta: "Completed · February 14, 2024", state: "done" },
      { phase: "Phase 1 · Application review", title: "Completeness check", meta: "Completed · Day 12 — Application deemed complete", state: "done" },
      { phase: "Phase 1 · Application review", title: "Technical review", meta: "Completed · Day 30", state: "done" },
      {
        phase: "Phase 2 · Agency coordination",
        title: "Agency coordination",
        meta: "In progress — Responses due by Day 90",
        state: "active",
        note: "Your application is currently being reviewed by coordinating agencies. No action is required from you in this demo scenario.",
      },
      { phase: "Phase 3 · Permit decision", title: "Technical review of coordination responses", meta: "Estimated to begin Day 90", state: "future" },
      { phase: "Phase 3 · Permit decision", title: "Draft permit prepared", meta: "Estimated Day 105", state: "future" },
      { phase: "Phase 3 · Permit decision", title: "Public comment period", meta: "Estimated Day 120 — 30-day window", state: "future" },
      { phase: "Phase 3 · Permit decision", title: "Final permit decision", meta: "Target: Day 150", state: "future" },
    ],
    nextSteps: [
      { title: "Watch the contact channel on file", body: "The applicant would be notified if additional information is needed or when a draft permit is ready for review." },
      { title: "Public comment period ahead", body: "This example shows a 30-day public comment period opening around Day 120." },
    ],
    officialFilingNotice: "Statutory application lodged in LDEQ EDMS system.",
  },
  "WQ-2024-00089": {
    id: "WQ-2024-00089",
    title: "Individual Water Quality Permit · Bayou Crossing",
    type: "Individual Water Quality Permit",
    category: "permit",
    categoryLabel: "Permits",
    applicant: "Bayou Crossing Development Co.",
    organization: "Bayou Crossing Development Co.",
    leadAgency: "Louisiana Department of Environmental Quality",
    leadAgencyCode: "LDEQ",
    submitted: "January 9, 2024",
    targetDate: "June 28, 2024",
    currentDay: 112,
    totalDays: 150,
    status: "action-needed",
    statusLabel: "Action required",
    ragStatus: "yellow",
    ragLabel: "Action Required",
    isCriticalPath: false,
    blocker: {
      title: "Suspended for Insufficient Information",
      description: "Application clock paused pending applicant response with updated outfall discharge modeling.",
      severity: "warning",
      blockedSince: "Day 95",
      unblockingAction: "Upload requested technical documentation through the agency portal.",
    },
    owner: {
      name: "Marcus Fontenot",
      title: "Case Officer",
      agency: "LDEQ",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
    contact: {
      name: "Water Quality Permits Division",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
    escalationPath: [
      {
        level: 1,
        title: "LDEQ Case Officer",
        contactName: "Marcus Fontenot",
        contactEmail: "wq-permits@example.invalid",
        contactPhone: "(225) 555-0100",
        agency: "LDEQ",
        status: "engaged",
      },
    ],
    steps: [
      { phase: "Phase 1 · Application review", title: "Application received", meta: "Completed · January 9, 2024", state: "done" },
      { phase: "Phase 1 · Application review", title: "Completeness check", meta: "Completed · Day 18 — Application deemed complete", state: "done" },
      { phase: "Phase 1 · Application review", title: "Technical review", meta: "Completed · Day 30", state: "done" },
      { phase: "Phase 2 · Agency coordination", title: "Agency coordination", meta: "Completed · Day 75", state: "done" },
      { phase: "Phase 3 · Permit decision", title: "Additional information requested", meta: "Completed · Day 82 — Request for information issued", state: "done" },
      {
        phase: "Application suspended",
        title: "Application suspended",
        meta: "Day 95 — Pending applicant response",
        state: "blocked",
        note: "This demo application clock is paused until the requested material is received.",
      },
      { phase: "Permit decision · Pending reactivation", title: "Review of applicant response", meta: "Would begin after reactivation", state: "future" },
      { phase: "Permit decision · Pending reactivation", title: "Final permit decision", meta: "Example target: Day 150 from reactivation", state: "future" },
    ],
    nextSteps: [
      { title: "Submit the requested documentation", body: "In a live portal, the notice would identify the official submission channel and required reference number." },
      { title: "Confirm receipt with the case manager", body: "The applicant could contact the listed division to confirm receipt and ask about reactivation." },
      { title: "Review the response deadline", body: "The past date shown here is retained only to demonstrate an urgent deadline state." },
    ],
    alert: {
      tone: "warning",
      title: "Example response deadline: June 28, 2024",
      body: "This illustrative application was suspended on Day 95 for insufficient information. It shows how a portal could call attention to required documentation and a response deadline.",
    },
    officialFilingNotice: "Statutory application lodged in LDEQ EDMS system.",
  },
  "WQ-2024-00207": {
    id: "WQ-2024-00207",
    title: "Individual Water Quality Permit · Magnolia Pipeline",
    type: "Individual Water Quality Permit",
    category: "permit",
    categoryLabel: "Permits",
    applicant: "Magnolia Pipeline Services",
    organization: "Magnolia Pipeline Services",
    leadAgency: "Louisiana Department of Environmental Quality",
    leadAgencyCode: "LDEQ",
    submitted: "March 3, 2024",
    targetDate: "October 1, 2024",
    currentDay: 138,
    totalDays: 210,
    status: "hearing",
    statusLabel: "Public hearing scheduled",
    ragStatus: "yellow",
    ragLabel: "Hearing Scheduled",
    isCriticalPath: false,
    owner: {
      name: "Celeste Broussard",
      title: "Hearing Officer",
      agency: "LDEQ",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
    contact: {
      name: "Water Quality Permits Division",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
    escalationPath: [
      {
        level: 1,
        title: "LDEQ Hearing Officer",
        contactName: "Celeste Broussard",
        contactEmail: "wq-permits@example.invalid",
        contactPhone: "(225) 555-0100",
        agency: "LDEQ",
        status: "engaged",
      },
    ],
    steps: [
      { phase: "Phase 1 · Application review", title: "Application received", meta: "Completed · March 3, 2024", state: "done" },
      { phase: "Phase 1 · Application review", title: "Completeness check and technical review", meta: "Completed · Day 30", state: "done" },
      { phase: "Phase 2 · Agency coordination", title: "Agency coordination", meta: "Completed · Day 75", state: "done" },
      { phase: "Phase 3 · Permit decision", title: "Technical review", meta: "Completed · Day 105", state: "done" },
      { phase: "Phase 3 · Permit decision", title: "Draft permit issued", meta: "Completed · Day 110", state: "done" },
      { phase: "Phase 3 · Permit decision", title: "Public comment period", meta: "Completed · Days 110–140 — Substantive comments received", state: "done", note: "This example comment period is closed." },
      { phase: "Public hearing process", title: "Public hearing — July 15, 2024", meta: "Historical demo event · State Office Building, Room 4B, 9:00 AM", state: "hearing", note: "Illustrative event retained to show how hearing instructions would appear." },
      { phase: "Public hearing process", title: "Agency review of hearing record", meta: "Example start: July 22, 2024", state: "future" },
      { phase: "Phase 3 · Final decision", title: "Final permit decision", meta: "Example revised target: Day 210", state: "future" },
    ],
    nextSteps: [
      { title: "Review hearing instructions", body: "A live notice would provide verified attendance and testimony instructions." },
      { title: "Submit written testimony", body: "This example demonstrates how a submission deadline and official channel could be displayed." },
      { title: "See the updated decision timeline", body: "This scenario extends the illustrative final-decision target to Day 210." },
    ],
    alert: {
      tone: "info",
      title: "Example hearing: July 15, 2024 at 9:00 AM",
      body: "This historical scenario demonstrates how a public hearing and an extended decision timeline could be presented. It is not a current hearing notice.",
    },
    officialFilingNotice: "Statutory application lodged in LDEQ EDMS system.",
  },
};

export const permits: Record<string, ServiceRequest> = {
  ...legacyPermits,
  ...Object.fromEntries(pecanIslandRequests.map((req) => [req.id, req])),
};

export const requests: Record<string, ServiceRequest> = permits;
