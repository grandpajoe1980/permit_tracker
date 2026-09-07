-- This helper is invoked only by the customer-request trigger, never through
-- the Supabase RPC surface.

revoke execute on function public.sync_customer_triage_state()
  from public, anon, authenticated;
