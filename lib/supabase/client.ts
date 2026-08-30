import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAppDataMode } from "../data-mode";

function runtimeEnv(name: string): string {
  const processValue = process.env[name];
  if (processValue) return processValue;
  const viteValue = (import.meta.env as Record<string, string | undefined>)[name];
  return viteValue ?? "";
}

export function getSupabaseUrl(): string {
  return runtimeEnv("NEXT_PUBLIC_SUPABASE_URL") || runtimeEnv("SUPABASE_URL") ||
    (getAppDataMode() === "test" ? "https://zomzacaxwqfwjstkxbpv.supabase.co" : "");
}

export function getSupabaseAnonKey(): string {
  return runtimeEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || runtimeEnv("SUPABASE_ANON_KEY") ||
    (getAppDataMode() === "test" ? runtimeEnv("PATH_TEST_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbXphY2F4d3Fmd2pzdGt4YnB2IiwiaWF0IjoxNzg3NTEwNDkzLCJleHAiOjIxMDMwODY0OTN9.MO84_KXLzxK1yVpEBTyw0L2Jz550VoaEhatpyC2ric0" : "");
}

let browserClientInstance: SupabaseClient | null = null;
let serverClientInstance: SupabaseClient | null = null;
let testAnonClientInstance: SupabaseClient | null = null;

/** Returns the RLS-bound client for browser code. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") {
    const privileged = getSupabaseServiceRoleClient();
    if (privileged) return privileged;
    if (getAppDataMode() !== "test") return null;
    if (testAnonClientInstance) return testAnonClientInstance;
    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    if (!url || !anonKey) return null;
    testAnonClientInstance = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return testAnonClientInstance;
  }
  if (browserClientInstance) return browserClientInstance;
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;
  try {
    browserClientInstance = createBrowserClient(url, anonKey);
    return browserClientInstance;
  } catch (err) {
    console.warn("Failed to initialize Supabase browser client:", err);
    return null;
  }
}

/**
 * Legacy server/testing accessor. User-facing HTTP routes must use
 * createRequestSupabaseClient() so the caller's session and RLS apply.
 */
export function getSupabaseServer(): SupabaseClient | null {
  return getSupabaseServiceRoleClient();
}

/** Privileged client reserved for trusted seed, health, and maintenance code. */
export function getSupabaseServiceRoleClient(): SupabaseClient | null {
  if (serverClientInstance) return serverClientInstance;
  const url = getSupabaseUrl();
  const serviceKey = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    runtimeEnv("LEGACY_SERVICE_ROLE_KEY") || runtimeEnv("legacy_service_role_key") || "";
  if (!url || !serviceKey) return null;
  try {
    serverClientInstance = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return serverClientInstance;
  } catch (err) {
    console.warn("Failed to initialize Supabase service-role client:", err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
