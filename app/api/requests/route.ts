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
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requested);
  const lookup = uuid
    ? await client.from("projects").select("id, number").eq("id", requested).maybeSingle()
    : await client.from("projects").select("id, number").eq("number", requested).maybeSingle();
  if (lookup.error || !lookup.data) return null;
  return String(lookup.data.id);
}

async function idempotencyId(userId: string, key: string): Promise<string> {
  const input = new TextEncoder().encode(`customer-request:${userId}:${key}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input)).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function mutationFailure(message: string): { status: number; error: string } {
  const normalized = message.toLowerCase();
  if (normalized.includes("not found")) return { status: 404, error: "The requested project or related record was not found." };
  if (normalized.includes("permission") || normalized.includes("authorized") || normalized.includes("access")) {
    return { status: 403, error: "You are not authorized to create this request." };
  }
  if (normalized.includes("duplicate") || normalized.includes("unique") || normalized.includes("already exists")) {
    return { status: 409, error: "This request conflicts with an existing submission." };
  }
  return { status: 500, error: "Request could not be persisted." };
}

export async function GET(request: NextRequest) {
  const auth = await authenticatedClient();
  if (auth.error || !auth.client) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  const projectId = await resolveProjectId(auth.client, new URL(request.url).searchParams.get("projectId") ?? undefined);
  if (!projectId) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
  const { data, error } = await auth.client.from("customer_requests").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ success: false, error: "Unable to load requests." }, { status: error.code === "42501" ? 403 : 500 });
  return NextResponse.json({ success: true, count: data?.length ?? 0, data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await authenticatedClient();
  if (auth.error || !auth.client || !auth.user) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: parsed.error.flatten() }, { status: 422 });
  const projectId = await resolveProjectId(auth.client, parsed.data.projectId);
  if (!projectId) return NextResponse.json({ success: false, error: "Project not found." }, { status: 404 });
  const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (rawIdempotencyKey && (rawIdempotencyKey.length < 8 || rawIdempotencyKey.length > 200)) {
    return NextResponse.json({ success: false, error: "Idempotency-Key must be between 8 and 200 characters." }, { status: 422 });
  }
  const requestId = rawIdempotencyKey ? await idempotencyId(auth.user.id, rawIdempotencyKey) : crypto.randomUUID();
  if (rawIdempotencyKey) {
    const existing = await auth.client.from("customer_requests").select("*").eq("id", requestId).maybeSingle();
    if (existing.error) return NextResponse.json({ success: false, error: "Unable to verify request idempotency." }, { status: existing.error.code === "42501" ? 403 : 500 });
    if (existing.data) return NextResponse.json({ success: true, data: existing.data, replayed: true }, { status: 200 });
  }
  const result = await mutateCreateCustomerRequest({
    id: requestId,
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
    submittedByName: auth.user.email ?? "Authenticated user",
    relatedWorkstreamId: parsed.data.relatedWorkstreamId,
    blocksActiveWork: parsed.data.blocksActiveWork ?? false,
    status: parsed.data.status ?? "submitted",
    attachmentDocumentVersionIds: parsed.data.attachmentDocumentVersionIds ?? [],
  }, auth.client);
  if (result.error || !result.data) {
    const message = result.error?.message ?? "Request was not persisted.";
    const failure = mutationFailure(message);
    return NextResponse.json(
      { success: false, error: failure.error },
      { status: failure.status },
    );
  }
  return NextResponse.json({ success: true, data: result.data, replayed: false }, { status: 201 });
}
