import { NextRequest, NextResponse } from "next/server";
import { createRequestSupabaseClient } from "@/lib/supabase/server";
import { isAdminResource } from "@/lib/admin-resources";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource") ?? "projects";
  const page = Number(request.nextUrl.searchParams.get("page") ?? 0);
  if (!isAdminResource(resource) || !Number.isSafeInteger(page) || page < 0 || page > 100000) {
    return NextResponse.json({ error: "Invalid resource or page." }, { status: 400, headers });
  }
  const client = await createRequestSupabaseClient();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503, headers });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "Sign in required." }, { status: 401, headers });
  const { data: memberships, error: membershipError } = await client.from("organization_memberships")
    .select("role").eq("user_id", auth.user.id).eq("status", "active")
    .in("role", ["system_admin", "organization_admin"]);
  if (membershipError || !memberships?.length) return NextResponse.json({ error: "Administrator access required." }, { status: 403, headers });
  // Always use the caller's RLS-bound client, including for organization admins.
  // This endpoint grants no additional data access and performs no mutations.
  const { data, count, error } = await client.from(resource).select("*", { count: "exact" })
    .order("id", { ascending: true }).range(page * 50, page * 50 + 49);
  if (error) return NextResponse.json({ error: "Unable to load these records. Check database access or try again." }, { status: 502, headers });
  return NextResponse.json({ records: data ?? [], total: count ?? 0, page, scope: memberships.some(m => m.role === "system_admin") ? "System administrator" : "Organization administrator · permitted records only" }, { headers });
}
