import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAppDataMode } from "../data-mode";

const DEFAULT_SUPABASE_URL = "https://zomzacaxwqfwjstkxbpv.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbXphY2F4d3Fmd2pzdGt4YnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTA0OTMsImV4cCI6MjEwMzA4NjQ5M30.MO84_KXLzxK1yVpEBTyw0L2Jz550VoaEhatpyC2ric0";
const DEFAULT_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbXphY2F4d3Fmd2pzdGt4YnB2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzUxMDQ5MywiZXhwIjoyMTAzMDg2NDkzfQ.8e4oTVFk3uCB5_RolCbDw-GgVyg4IaIW7ujEVNdX5_I";

function runtimeEnv(name: string): string {
  if (typeof process !== "undefined" && process.env) {
    const processValue = process.env[name];
    if (processValue) return processValue;
  }
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const viteValue = (import.meta.env as Record<string, string | undefined>)[name];
    if (viteValue) return viteValue;
  }
  return "";
}

export function getSupabaseUrl(): string {
  const envUrl =
    (typeof process !== "undefined" && process.env && (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)) ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    runtimeEnv("SUPABASE_URL") ||
    runtimeEnv("VITE_SUPABASE_URL");
  return envUrl || DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  const envKey =
    (typeof process !== "undefined" && process.env && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.PATH_TEST_ANON_KEY)) ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    runtimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    runtimeEnv("SUPABASE_ANON_KEY") ||
    runtimeEnv("PATH_TEST_ANON_KEY") ||
    runtimeEnv("VITE_SUPABASE_ANON_KEY");
  return envKey || DEFAULT_SUPABASE_ANON_KEY;
}

export function getSupabaseServiceRoleKey(): string {
  const envServiceKey =
    (typeof process !== "undefined" && process.env && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.LEGACY_SERVICE_ROLE_KEY || process.env.legacy_service_role_key)) ||
    runtimeEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    runtimeEnv("LEGACY_SERVICE_ROLE_KEY") ||
    runtimeEnv("legacy_service_role_key");
  return envServiceKey || DEFAULT_SERVICE_ROLE_KEY;
}

let browserClientInstance: SupabaseClient | null = null;
let serverClientInstance: SupabaseClient | null = null;
let testAnonClientInstance: SupabaseClient | null = null;

/** Returns the RLS-bound client for browser code. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") {
    const privileged = getSupabaseServiceRoleClient();
    if (privileged) return privileged;
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
  const serviceKey = getSupabaseServiceRoleKey();
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
