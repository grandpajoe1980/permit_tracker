-- Keep the deployed atomic customer-request triage RPC aligned with the
-- customer-request/workstream relationship it persists.

alter table public.customer_requests
  add column if not exists triaged_at timestamptz,
  add column if not exists triaged_by_user_id uuid references auth.users(id),
  add column if not exists triage_notes text,
  add column if not exists triaged_workstream_ids jsonb not null default '[]'::jsonb;

alter table public.workstreams
  add column if not exists customer_request_id text;

create index if not exists idx_workstreams_customer_request
  on public.workstreams (customer_request_id);
