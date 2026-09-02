import type {
  JurisdictionLevel,
  PermitRecord,
  PermitStatus,
  PermitStep,
  RAGStatus,
  RequestCategory,
  ServiceRequest,
} from "./demo-data";
import { mutateCreateCustomerRequest, mutateCreateCustomerRequestWithDocument } from "./supabase/mutations";
import { getSupabaseBrowser, isSupabaseConfigured } from "./supabase/client";

/** The browser client intentionally accepts only publishable/anon credentials. */
export function getSupabaseBrowserClient() {
  return getSupabaseBrowser();
}

export function supabaseConfigured() {
  return isSupabaseConfigured();
}

export async function signInWithPassword(email: string, password: string) {
  const client = getSupabaseBrowserClient();
  if (!client) return { user: null, error: new Error("Supabase is not configured.") };
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  return { user: data.user, error };
}

export async function getBrowserUser() {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data } = await client.auth.getUser();
  return data.user;
}

export async function signOutBrowser() {
  const client = getSupabaseBrowserClient();
  if (client) await client.auth.signOut();
}

type RequestRow = Record<string, unknown>;

function text(row: RequestRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function status(value: string): PermitStatus {
  const normalized = value.toLowerCase();
  if (normalized.includes("hearing") || normalized.includes("comment")) return "hearing";
  if (normalized.includes("action") || normalized.includes("rfi") || normalized.includes("information") || normalized.includes("hold")) return "action-needed";
  if (normalized.includes("approved") || normalized.includes("complete")) return "approved";
  return "in-review";
}

function dateLabel(value: string) {
  if (!value) return "Not submitted";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, { dateStyle: "long" });
}

function stepsFor(row: RequestRow, currentStatus: PermitStatus, submitted: string): PermitStep[] {
  const stage = text(row, "current_stage", "stage", "status") || "In review";
  return [
    { phase: "Application intake", title: "Application received", meta: `Submitted · ${dateLabel(submitted)}`, state: "done" },
    { phase: "Current workflow", title: stage, meta: currentStatus === "action-needed" ? "Action required from applicant" : "Current application stage", state: currentStatus === "action-needed" ? "blocked" : "active" },
    { phase: "Next workflow stage", title: "Team review and decision", meta: text(row, "due_date", "target_date") ? `Target · ${dateLabel(text(row, "due_date", "target_date"))}` : "Target date will be provided by the program team", state: "future" },
  ];
}

function mapCategory(raw: string): RequestCategory {
  const lower = raw.toLowerCase();
  if (lower.includes("road") || lower.includes("transport") || lower.includes("aviation")) return "road";
  if (lower.includes("util") || lower.includes("power") || lower.includes("water")) return "utility";
  if (lower.includes("safety") || lower.includes("hazard") || lower.includes("fire")) return "public_safety";
  if (lower.includes("workforce") || lower.includes("train") || lower.includes("labor")) return "workforce";
  if (lower.includes("community") || lower.includes("parish")) return "community";
  return "permit";
}

export function requestRowToPermit(row: RequestRow): ServiceRequest {
  const rawStatus = text(row, "status", "state", "workflow_status");
  const permitStatus = status(rawStatus);
  const submitted = text(row, "submitted_at", "created_at", "received_at");
  const currentDay = Math.max(0, Number(row.current_day ?? row.elapsed_days ?? 0) || 0);
  const totalDays = Math.max(currentDay, Number(row.total_days ?? row.target_days ?? 150) || 150);
  const reqCategory = mapCategory(text(row, "category", "request_type", "type"));
  const isCrit = text(row, "priority").toLowerCase() === "critical" || totalDays > 200;
  const rag: RAGStatus = permitStatus === "action-needed" ? (isCrit ? "red" : "yellow") : permitStatus === "hearing" ? "yellow" : "green";

  const ownerName = text(row, "owner_name", "contact_name") || "Assigned State Liaison Team";
  const ownerAgency = text(row, "owning_organization_name", "lead_agency") || "Louisiana Inter-Agency Task Force";

  return {
    id: text(row, "confirmation_number", "case_number", "permit_number", "id"),
    title: text(row, "title", "request_type") || "SpaceX Louisiana Service Request",
    type: text(row, "request_type", "permit_type", "type", "title") || "Government Service Request",
    category: reqCategory,
    categoryLabel: reqCategory.replace("_", " ").toUpperCase(),
    applicant: text(row, "applicant_name", "applicant", "organization_name") || "SpaceX Louisiana Program",
    organization: "Space Exploration Technologies Corp.",
    leadAgency: ownerAgency,
    leadAgencyCode: text(row, "lead_agency_code", "org_code") || "STATE",
    agencyLevel: (text(row, "agency_level") as JurisdictionLevel) || "State",
    submitted: dateLabel(submitted),
    targetDate: dateLabel(text(row, "due_date", "target_date")),
    currentDay,
    totalDays,
    status: permitStatus,
    statusLabel: text(row, "status_label", "status", "state") || "Under review",
    ragStatus: rag,
    ragLabel: rag === "red" ? "Blocked / Escalated" : rag === "yellow" ? "Action Needed" : "On Track",
    isCriticalPath: isCrit,
    blocker: permitStatus === "action-needed" ? {
      title: "Action Required from Applicant or Agency",
      description: text(row, "next_action", "action_required", "description") || "Please review the requested item.",
      severity: isCrit ? "critical" : "warning",
      blockedSince: "Active stage",
      unblockingAction: "Upload requested documentation or attend coordination session.",
    } : undefined,
    owner: {
      name: ownerName,
      title: "State Project Lead",
      agency: ownerAgency,
      email: text(row, "owner_email", "contact_email") || "liaison@gov.la.gov",
      phone: text(row, "contact_phone", "owner_phone") || "(225) 342-7000",
    },
    contact: {
      name: ownerName,
      email: text(row, "owner_email", "contact_email") || "",
      phone: text(row, "contact_phone", "owner_phone") || "",
    },
    escalationPath: [
      {
        level: 1,
        title: "Lead Agency Reviewer",
        contactName: ownerName,
        contactEmail: text(row, "owner_email", "contact_email") || "liaison@gov.la.gov",
        contactPhone: text(row, "contact_phone", "owner_phone") || "(225) 342-7000",
        agency: ownerAgency,
        status: "engaged",
      },
      {
        level: 2,
        title: "State Inter-Agency Liaison",
        contactName: "Jean-Paul Guidry",
        contactEmail: "jp.guidry@gov.la.gov",
        contactPhone: "(225) 342-7000",
        agency: "Governor's Office",
        status: rag === "red" ? "escalated" : "idle",
      },
    ],
    steps: stepsFor(row, permitStatus, submitted),
    nextSteps: [{
      title: permitStatus === "action-needed" ? "Complete the requested action" : "Monitor your application",
      body: text(row, "next_action", "description") || "Your application status and authorized updates will appear here.",
      due: text(row, "due_date"),
      responsibleParty: "Assigned Lead",
    }],
    alert: permitStatus === "action-needed" ? {
      tone: "warning",
      title: "Action required",
      body: text(row, "next_action", "action_required", "description") || "Please review the requested action in your application.",
    } : undefined,
    officialFilingNotice: "Notice: Official filings occur with the respective statutory department portal.",
  };
}

export async function loadRequestsForUser() {
  const client = getSupabaseBrowserClient();
  if (!client) return { permits: [] as PermitRecord[], error: new Error("Supabase is not configured.") };
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return { permits: [] as PermitRecord[], error: userError ?? new Error("Sign in before loading requests.") };
  const { data, error } = await client.from("customer_requests").select("*").eq("submitted_by_user_id", userData.user.id).order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as RequestRow[];
  return { permits: rows.map((row: RequestRow) => requestRowToPermit(row)), error };
}

/* Retained as historical context only; production uses the RPC-backed path below.
async function createRequestForUserLegacy(input: { title: string; requestType: string; description: string }) {
  const client = getSupabaseBrowserClient();
  if (!client) return { error: new Error("Supabase is not configured.") };
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user) return { error: new Error("Sign in before submitting a request.") };
  const { data: project, error: projectError } = await client.from("projects").select("id").eq("number", "PRJ-PECAN-2026").single();
  if (projectError || !project) return { error: projectError ?? new Error("SpaceX project is not configured.") };
  const { error } = await client.from("customer_requests").insert(Object.fromEntries(Object.entries({
    project_id: project.id,
    submitted_by_user_id: user.id,
    request_type: ["permit_authorization", "government_help", "project_question", "blocker_coordination", "escalation", "concierge"].includes(input.requestType) ? input.requestType : "government_help",
    title: input.title.trim(),
    description: input.description.trim(),
    confirmation_number: `PATH-${new Date().getUTCFullYear()}-${String(Date.now()).slice(-6)}`,
    submitted_by_name: String(user.user_metadata?.full_name ?? user.email ?? "SpaceX employee"),
    blocks_active_work: false,
    schedule_importance: "normal",
    attachment_document_version_ids: [],
    id: crypto.randomUUID(),
    updated_at: new Date().toISOString(),
    status_label: "Submitted · Triage Queue",
    total_days: 180,
  }).filter(([key]) => key !== "status_label" && key !== "total_days")));
  return { error };
}
*/

export async function createRequestForUser(input: { title: string; requestType: string; description: string; file?: File }) {
  const client = getSupabaseBrowserClient();
  if (!client) return { error: new Error("Supabase is not configured.") };
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user) return { error: new Error("Sign in before submitting a request.") };
  const { data: project, error: projectError } = await client.from("projects").select("id").eq("number", "PRJ-PECAN-2026").single();
  if (projectError || !project) return { error: projectError ?? new Error("SpaceX project is not configured.") };
  const requestType = ["permit_authorization", "government_help", "project_question", "blocker_coordination", "escalation", "concierge"].includes(input.requestType)
    ? input.requestType
    : "government_help";
  const requestParams = {
    id: crypto.randomUUID(),
    confirmationNumber: `PATH-${new Date().getUTCFullYear()}-${String(Date.now()).slice(-6)}`,
    projectId: String(project.id),
    requestType: requestType as "permit_authorization" | "government_help" | "project_question" | "blocker_coordination" | "escalation" | "concierge",
    title: input.title.trim(),
    description: input.description.trim(),
    submittedByUserId: user.id,
    submittedByName: String(user.user_metadata?.full_name ?? user.email ?? "SpaceX employee"),
    blocksActiveWork: false,
    scheduleImportance: "normal" as const,
    attachmentDocumentVersionIds: [] as string[],
    status: "submitted" as const,
  };
  const result = input.file
    ? await mutateCreateCustomerRequestWithDocument({ ...requestParams, file: input.file })
    : await mutateCreateCustomerRequest(requestParams);
  return { data: result.data, error: result.error };
}
