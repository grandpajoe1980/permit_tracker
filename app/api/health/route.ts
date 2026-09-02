import { NextResponse } from "next/server";
import { BUILD_INFO } from "@/lib/version";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Public liveness/readiness endpoint.
 *
 * Liveness never uses privileged credentials. Readiness checks only whether
 * the required public runtime configuration exists; database diagnostics
 * belong in authenticated operator tooling.
 */
export async function GET(request: Request) {
  const readinessRequested = new URL(request.url).searchParams.get("ready") === "1";
  const configured = isSupabaseConfigured();
  const ready = !readinessRequested || configured;

  return NextResponse.json(
    {
      status: ready ? "ok" : "not_ready",
      app: "PATH / Louisiana Project Delivery Command System",
      version: BUILD_INFO.version,
      commit: BUILD_INFO.commitShort,
      environment: BUILD_INFO.environment,
      checks: {
        application: "ok",
        configuration: readinessRequested ? (configured ? "ok" : "missing") : "not_checked",
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
