-- Keep the workflow and ITSM projections aligned after an atomic customer
-- request triage operation.

create or replace function public.sync_customer_triage_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.triaged_at is not null
     and (old.triaged_at is null or new.triaged_at is distinct from old.triaged_at)
     and new.itsm_state in ('submitted', 'triaged') then
    new.itsm_state := 'triaged';
  end if;
  return new;
end;
$$;

drop trigger if exists customer_request_triage_state_sync on public.customer_requests;

create trigger customer_request_triage_state_sync
before update of triaged_at on public.customer_requests
for each row execute function public.sync_customer_triage_state();
