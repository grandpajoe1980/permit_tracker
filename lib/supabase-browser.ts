import { createBrowserClient } from "@supabase/ssr";

import type { PermitRecord, PermitStatus, PermitStep } from "./demo-data";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

/** The browser client intentionally accepts only publishable/anon credentials. */
export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseKey) return null;
  browserClient ??= createBrowserClient(supabaseUrl, supabaseKey);
  return browserClient;
}

export function supabaseConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
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
  if (normalized.includes("action") || normalized.includes("rfi") || normalized.includes("information")) return "action-needed";
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
    { phase: "Next workflow stage", title: "Agency review and decision", meta: text(row, "due_date", "target_date") ? `Target · ${dateLabel(text(row, "due_date", "target_date"))}` : "Target date will be provided by the agency", state: "future" },
  ];
}

export function requestRowToPermit(row: RequestRow): PermitRecord {
  const rawStatus = text(row, "status", "state", "workflow_status");
  const permitStatus = status(rawStatus);
  const submitted = text(row, "submitted_at", "created_at", "received_at");
  const currentDay = Math.max(0, Number(row.current_day ?? row.elapsed_days ?? 0) || 0);
  const totalDays = Math.max(currentDay, Number(row.total_days ?? row.target_days ?? 150) || 150);
  return {
    id: text(row, "confirmation_number", "case_number", "permit_number", "id"),
    type: text(row, "request_type", "permit_type", "type", "title") || "Permit application",
    applicant: text(row, "applicant_name", "applicant", "organization_name") || "Applicant",
    submitted: dateLabel(submitted),
    currentDay,
    totalDays,
    status: permitStatus,
    statusLabel: text(row, "status_label", "status", "state") || "Under review",
    alert: permitStatus === "action-needed" ? { tone: "warning", title: "Action required", body: text(row, "next_action", "action_required", "description") || "Please review the requested action in your application." } : undefined,
    contact: { name: text(row, "owner_name", "contact_name") || "Assigned agency", email: text(row, "owner_email", "contact_email") || "", phone: text(row, "contact_phone", "owner_phone") || "" },
    steps: stepsFor(row, permitStatus, submitted),
    nextSteps: [{ title: permitStatus === "action-needed" ? "Complete the requested action" : "Monitor your application", body: text(row, "next_action", "description") || "Your application status and authorized updates will appear here." }],
  };
}

export async function loadRequestsForUser() {
  const client = getSupabaseBrowserClient();
  if (!client) return { permits: [] as PermitRecord[], error: new Error("Supabase is not configured.") };
  const { data, error } = await client.from("requests").select("*").order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as RequestRow[];
  return { permits: rows.map((row: RequestRow) => requestRowToPermit(row)), error };
}
