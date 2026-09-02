import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only privileged client factory.
 *
 * Keep imports of this module out of app components, shared repositories, and
 * browser bundles. Seed and maintenance scripts should prefer their own
 * short-lived clients, but this factory exists for explicitly trusted server
 * jobs that genuinely require bypassing RLS.
 */
export function getSupabaseServiceRoleClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function requireSupabaseServiceRoleClient(): SupabaseClient {
  const client = getSupabaseServiceRoleClient();
  if (!client) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required for this operation.");
  }
  return client;
}
