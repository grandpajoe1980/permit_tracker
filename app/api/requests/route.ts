import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { mutateCreateCustomerRequest } from "@/lib/supabase/mutations";

const requestSchema = z.object({
  projectId: z.string().min(1).optional(),
  requestType: z.enum(["permit_authorization", "government_help", "project_question", "blocker_coordination", "escalation", "concierge"]),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().min(1).max(10000),
  requestedOutcome: z.string().trim().max(2000).optional(),
  locationOrAffectedArea: z.string().trim().max(500).optional(),
  desiredDate: z.string().date().optional(),
  scheduleImportance: z.enum(["low", "normal", "critical"]).optional(),
  knownAgencyCode: z.string().trim().max(40).optional(),
  knownPermitTypeId: z.string().trim().max(120).optional(),
  relatedWorkstreamId: z.string().trim().max(120).optional(),
  blocksActiveWork: z.boolean().optional(),
  status: z.enum(["draft", "submitted"]).optional(),
  attachmentDocumentVersionIds: z.array(z.string().max(160)).max(20).optional(),
});

async function authenticatedClient() {
  const client = await createRequestSupabaseClient();
  if (!client) return { client: null, user: null, error: "Supabase is not configured." };
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { client: null, user: null, error: "Authentication is required." };
  return { client, user: data.user, error: null };
}

async function resolveProjectId(client: NonNullable<Awaited<ReturnType<typeof createRequestSupabaseClient>>>, projectId?: string) {
  const requested = projectId ?? "PRJ-PECAN-2026";
  const lookup = await client.from("projects").select("id, number").eq("number", requested).maybeSingle();
  if (lookup.error || !lookup.data) return null;
  return String(lookup.data.id);
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedClient();
  if (auth.error || !auth.client) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  const projectId = await resolveProjectId(auth.client, new URL(request.url).searchParams.get("projectId") ?? undefined);
  if (!projectId) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
  const { data, error } = await auth.client.from("customer_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 403 });
  return NextResponse.json({ success: true, count: data?.length ?? 0, data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authenticatedClient();
  if (auth.error || !auth.client || !auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 400 });
  const projectId = await resolveProjectId(auth.client, parsed.data.projectId);
  if (!projectId) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
  const result = await mutateCreateCustomerRequest({
    id: crypto.randomUUID(),
    confirmationNumber: `PATH-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    projectId,
    requestType: parsed.data.requestType,
    title: parsed.data.title,
    description: parsed.data.description,
    requestedOutcome: parsed.data.requestedOutcome,
    locationOrAffectedArea: parsed.data.locationOrAffectedArea,
    desiredDate: parsed.data.desiredDate,
    scheduleImportance: parsed.data.scheduleImportance ?? "normal",
    knownAgencyCode: parsed.data.knownAgencyCode,
    knownPermitTypeId: parsed.data.knownPermitTypeId,
    submittedByUserId: auth.user.id,
    submittedByName: String(auth.user.user_metadata?.full_name ?? auth.user.email ?? "Authenticated user"),
    relatedWorkstreamId: parsed.data.relatedWorkstreamId,
    blocksActiveWork: parsed.data.blocksActiveWork ?? false,
    status: parsed.data.status ?? "submitted",
    attachmentDocumentVersionIds: parsed.data.attachmentDocumentVersionIds ?? [],
  }, auth.client);
  if (result.error || !result.data) return NextResponse.json({ success: false, error: result.error?.message ?? "Request was not persisted." }, { status: 400 });
  return NextResponse.json({ success: true, data: result.data }, { status: 201 });
}
