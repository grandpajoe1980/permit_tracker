import { NextRequest, NextResponse } from "next/server";
import { fetchCustomerRequests } from "@/lib/supabase/queries";
import { mutateCreateCustomerRequest } from "@/lib/supabase/mutations";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "PRJ-PECAN-2026";

  try {
    const requests = await fetchCustomerRequests(projectId);
    return NextResponse.json({ success: true, count: requests.length, data: requests });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to fetch customer requests" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await mutateCreateCustomerRequest(body);
    if (result.error) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: result.data }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Invalid customer request payload" },
      { status: 500 }
    );
  }
}
