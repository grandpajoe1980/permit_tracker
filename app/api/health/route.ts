import { NextResponse } from "next/server";
import { getSupabaseServer, isSupabaseConfigured, getSupabaseUrl } from "@/lib/supabase/client";

export async function GET() {
  const timestamp = new Date().toISOString();
  const configured = isSupabaseConfigured();

  let databaseConnected = false;
  let databaseLatencyMs = -1;
  let storageConnected = false;
  let errorDetail: string | null = null;

  if (configured) {
    const client = getSupabaseServer();
    if (client) {
      // 1. Check PostgreSQL connectivity
      const start = Date.now();
      try {
        const { error: dbError } = await client.from("permit_types").select("code").limit(1);
        databaseLatencyMs = Date.now() - start;
        databaseConnected = !dbError;
        if (dbError) {
          errorDetail = `Database check error: ${dbError.message}`;
        }
      } catch (err: unknown) {
        errorDetail = `Database connection exception: ${err instanceof Error ? err.message : String(err)}`;
      }

      // 2. Check Storage connectivity
      try {
        const { data: buckets, error: storageError } = await client.storage.listBuckets();
        storageConnected = !storageError && Boolean(buckets?.some((b) => b.name === "path-documents"));
      } catch {
        storageConnected = false;
      }
    }
  }

  const status = databaseConnected ? "healthy" : "degraded";
  const statusCode = databaseConnected ? 200 : 503;

  return NextResponse.json(
    {
      status,
      app: "PATH / Louisiana Project Delivery Command System",
      version: "0.1.0",
      commit: "4365ecc",
      environment: process.env.NODE_ENV || "production",
      timestamp,
      supabase: {
        configured,
        endpointHost: configured ? new URL(getSupabaseUrl()).hostname : null,
        databaseConnected,
        databaseLatencyMs,
        storageConnected,
        storageBucket: "path-documents",
      },
      diagnostic: errorDetail,
    },
    { status: statusCode }
  );
}
