export type PermitStatus = "in-review" | "action-needed" | "hearing";
export type StepState = "done" | "active" | "blocked" | "hearing" | "future";

export type Agency = {
  id: "ldeq" | "conservation-energy";
  abbreviation: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type DemoAccount = {
  username: string;
  name: string;
  /** Legacy field retained for fixture compatibility; production accounts use the SpaceX workspace. */
  agencyId: Agency["id"] | "spaceport";
  applicationIds: string[];
  scenario: string;
};

export type PermitStep = {
  phase: string;
  title: string;
  meta: string;
  state: StepState;
  note?: string;
};

export type PermitRecord = {
  id: string;
  type: string;
  applicant: string;
  submitted: string;
  currentDay: number;
  totalDays: number;
  status: PermitStatus;
  statusLabel: string;
  alert?: {
    tone: "warning" | "info";
    title: string;
    body: string;
  };
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  steps: PermitStep[];
  nextSteps: Array<{
    title: string;
    body: string;
  }>;
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

export const permits: Record<string, PermitRecord> = {
  "WQ-2024-00142": {
    id: "WQ-2024-00142",
    type: "Individual Water Quality Permit",
    applicant: "Riverdale Infrastructure LLC",
    submitted: "February 14, 2024",
    currentDay: 87,
    totalDays: 150,
    status: "in-review",
    statusLabel: "Under review",
    contact: {
      name: "Water Quality Permits Division",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
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
  },
  "WQ-2024-00089": {
    id: "WQ-2024-00089",
    type: "Individual Water Quality Permit",
    applicant: "Bayou Crossing Development Co.",
    submitted: "January 9, 2024",
    currentDay: 112,
    totalDays: 150,
    status: "action-needed",
    statusLabel: "Action required",
    alert: {
      tone: "warning",
      title: "Example response deadline: June 28, 2024",
      body: "This illustrative application was suspended on Day 95 for insufficient information. It shows how a portal could call attention to required documentation and a response deadline.",
    },
    contact: {
      name: "Water Quality Permits Division",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
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
  },
  "WQ-2024-00207": {
    id: "WQ-2024-00207",
    type: "Individual Water Quality Permit",
    applicant: "Magnolia Pipeline Services",
    submitted: "March 3, 2024",
    currentDay: 138,
    totalDays: 210,
    status: "hearing",
    statusLabel: "Public hearing scheduled",
    alert: {
      tone: "info",
      title: "Example hearing: July 15, 2024 at 9:00 AM",
      body: "This historical scenario demonstrates how a public hearing and an extended decision timeline could be presented. It is not a current hearing notice.",
    },
    contact: {
      name: "Water Quality Permits Division",
      email: "wq-permits@example.invalid",
      phone: "(225) 555-0100",
    },
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
  },
};
