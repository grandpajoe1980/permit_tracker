import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve only browser-safe Supabase configuration.
 *
 * This module is imported by client components, so it must never contain or
 * resolve a service-role credential. Server request handlers should use
 * createRequestSupabaseClient() from ./server instead.
 */
function runtimeEnv(name: string): string {
  if (typeof process !== "undefined" && process.env?.[name]) {
    return process.env[name] ?? "";
  }
  return "";
}

// Vite's `define` replacement is intentionally static. Do not route these
// names through runtimeEnv(): dynamic property access is not replaced in the
// browser bundle, which leaves production clients unconfigured even though
// server-side readiness checks succeed.
const buildTimePublicSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

const buildTimePublicSupabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

export function getSupabaseUrl(): string {
  return buildTimePublicSupabaseUrl || runtimeEnv("VITE_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return (
    buildTimePublicSupabaseKey ||
    runtimeEnv("PATH_TEST_ANON_KEY") ||
    runtimeEnv("VITE_SUPABASE_ANON_KEY")
  );
}

let browserClientInstance: SupabaseClient | null = null;
let serverAnonClientInstance: SupabaseClient | null = null;

function createAnonClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;

  try {
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch (error) {
    console.warn("Failed to initialize Supabase anonymous client:", error);
    return null;
  }
}

/** Returns the publishable-key client for browser and test code. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === "undefined") {
    serverAnonClientInstance ??= createAnonClient();
    return serverAnonClientInstance;
  }

  if (browserClientInstance) return browserClientInstance;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;

  try {
    browserClientInstance = createBrowserClient(url, anonKey);
    return browserClientInstance;
  } catch (error) {
    console.warn("Failed to initialize Supabase browser client:", error);
    return null;
  }
}

/**
 * @deprecated Use createRequestSupabaseClient() for HTTP requests. This
 * accessor intentionally returns an anonymous-key client and never bypasses
 * RLS.
 */
export function getSupabaseServer(): SupabaseClient | null {
  return getSupabaseBrowser();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}
