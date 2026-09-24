-- The original history migration granted table SELECT to authenticated users,
-- but Supabase/Postgres may also provide TRUNCATE through broader table grants.
-- RLS does not apply to TRUNCATE; leave only the intended read privilege.
revoke all on table public.external_filing_status_checks from public, anon, authenticated;
grant select on table public.external_filing_status_checks to authenticated;
