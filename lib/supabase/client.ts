import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://zomzacaxwqfwjstkxbpv.supabase.co"
  );
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbXphY2F4d3Fmd2pzdGt4YnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTA0OTMsImV4cCI6MjEwMzA4NjQ5M30.MO84_KXLzxK1yVpEBTyw0L2Jz550VoaEhatpyC2ric0"
  );
}

let browserClientInstance: SupabaseClient | null = null;
let serverClientInstance: SupabaseClient | null = null;

/**
 * Returns the canonical Supabase client for browser contexts.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") {
    return getSupabaseServer();
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
 * Returns the Supabase client for server/testing environments.
 */
export function getSupabaseServer(): SupabaseClient | null {
  if (serverClientInstance) return serverClientInstance;

  const url = getSupabaseUrl();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.LEGACY_SERVICE_ROLE_KEY ||
    process.env.legacy_service_role_key ||
    getSupabaseAnonKey();

  if (!url || !serviceKey) return null;

  try {
    serverClientInstance = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return serverClientInstance;
  } catch (err) {
    console.warn("Failed to initialize Supabase server client:", err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(url && key);
}
