-- Keep user deletion and future actor-history lookups efficient.
create index if not exists idx_external_filing_status_checks_verified_by_user_id
  on public.external_filing_status_checks(verified_by_user_id);
