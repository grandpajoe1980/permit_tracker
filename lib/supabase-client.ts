import { createClient } from "@supabase/supabase-js";

let clientInstance: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  if (clientInstance) return clientInstance;

  const DEFAULT_SUPABASE_URL = "https://zomzacaxwqfwjstkxbpv.supabase.co";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvbXphY2F4d3Fmd2pzdGt4YnB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTA0OTMsImV4cCI6MjEwMzA4NjQ5M30.MO84_KXLzxK1yVpEBTyw0L2Jz550VoaEhatpyC2ric0";

  if (!url || !key) return null;

  try {
    clientInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return clientInstance;
  } catch (err) {
    console.warn("Failed to initialize Supabase client:", err);
    return null;
  }
}
