-- Wave 1 follow-up: close SECURITY DEFINER trust-boundary gaps left by the
-- legacy compound-write functions. The functions remain transaction owners,
-- but their actor and tenant context now comes from the authenticated JWT.

create or replace function app_private.has_project_access_text(p_project_ref text)
returns boolean
language sql stable security definer
set search_path = public, app_private
as $$
  select exists (
    select 1
    from public.projects p
    where (p.id::text = p_project_ref or p.number = p_project_ref)
      and (select app_private.has_project_access(p.id))
  );
$$;

create or replace function app_private.enforce_customer_request_actor()
returns trigger
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is not null then
    if new.submitted_by_user_id is distinct from auth.uid() then
      raise exception 'submitted_by_user_id must match the authenticated user';
    end if;
    if not (select app_private.has_project_access_text(new.project_id)) then
      raise exception 'authenticated user cannot access project %', new.project_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_requests_enforce_actor on public.customer_requests;
create trigger customer_requests_enforce_actor
before insert or update on public.customer_requests
for each row execute function app_private.enforce_customer_request_actor();

create or replace function app_private.normalize_audit_actor()
returns trigger
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is not null then
    new.actor_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists audit_events_normalize_actor on public.audit_events;
create trigger audit_events_normalize_actor
before insert on public.audit_events
for each row execute function app_private.normalize_audit_actor();

create or replace function app_private.normalize_notification_recipient()
returns trigger
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if new.recipient_id is null and new.user_id is not null then
    select u.id into new.recipient_id
    from auth.users u
    where u.id::text = new.user_id or lower(u.email) = lower(new.user_id)
    limit 1;
  end if;
  if new.recipient_id is null then
    raise exception 'notification recipient could not be resolved';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_normalize_recipient on public.notifications;
create trigger notifications_normalize_recipient
before insert on public.notifications
for each row execute function app_private.normalize_notification_recipient();

create or replace function app_private.enforce_rfi_access()
returns trigger
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is not null and not exists (
    select 1
    from public.workstreams w
    where w.id = new.workstream_id
      and w.project_id is not null
      and (select app_private.has_project_access(w.project_id))
  ) then
    raise exception 'authenticated user cannot access workstream %', new.workstream_id;
  end if;
  return new;
end;
$$;

drop trigger if exists rfis_enforce_access on public.rfis;
create trigger rfis_enforce_access
before insert or update on public.rfis
for each row execute function app_private.enforce_rfi_access();

create or replace function app_private.enforce_rfi_response_access()
returns trigger
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is not null and not exists (
    select 1
    from public.rfis r
    join public.workstreams w on w.id = r.workstream_id
    where r.id = new.rfi_id
      and w.project_id is not null
      and (select app_private.has_project_access(w.project_id))
  ) then
    raise exception 'authenticated user cannot access RFI %', new.rfi_id;
  end if;
  return new;
end;
$$;

drop trigger if exists rfi_responses_enforce_access on public.rfi_responses;
create trigger rfi_responses_enforce_access
before insert or update on public.rfi_responses
for each row execute function app_private.enforce_rfi_response_access();

create or replace function app_private.enforce_document_version_access()
returns trigger
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is not null and not exists (
    select 1
    from public.documents d
    where ((new.document_id is not null and d.id = new.document_id)
       or (new.document_id is null and d.id::text = new.document_ref_id))
      and ((d.project_id is not null and (select app_private.has_project_access(d.project_id)))
        or (d.request_id is not null and (select app_private.can_access_request(d.request_id)))
        or (select app_private.is_system_admin()))
  ) then
    raise exception 'authenticated user cannot access document %', new.document_ref_id;
  end if;
  return new;
end;
$$;

drop trigger if exists document_versions_enforce_access on public.document_versions;
create trigger document_versions_enforce_access
before insert or update on public.document_versions
for each row execute function app_private.enforce_document_version_access();

create or replace function app_private.enforce_document_review_access()
returns trigger
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is not null and not exists (
    select 1
    from public.document_versions v
    join public.documents d on d.id = v.document_id
    where v.id = new.document_version_id
      and ((d.project_id is not null and (select app_private.has_project_access(d.project_id)))
        or (d.request_id is not null and (select app_private.can_access_request(d.request_id)))
        or (select app_private.is_system_admin()))
  ) then
    raise exception 'authenticated user cannot access document version %', new.document_version_id;
  end if;
  return new;
end;
$$;

drop trigger if exists document_agency_reviews_enforce_access on public.document_agency_reviews;
create trigger document_agency_reviews_enforce_access
before insert or update on public.document_agency_reviews
for each row execute function app_private.enforce_document_review_access();

-- PostgreSQL grants EXECUTE to PUBLIC by default. RPCs that write tenant data
-- must never be callable anonymously or with an untrusted actor parameter.
revoke execute on function public.rpc_create_customer_request(
  text, text, text, text, text, text, text, text, date, text, text, text,
  uuid, text, text, boolean, text, jsonb
) from public, anon;
revoke execute on function public.rpc_create_rfi(
  text, text, text, text, text, text, text, text, text, text, text, jsonb,
  date, text, integer, text, uuid
) from public, anon;
revoke execute on function public.rpc_submit_rfi_response(
  text, text, text, text, text, jsonb, uuid
) from public, anon;
revoke execute on function public.rpc_accept_rfi_response(
  text, text, text, text, uuid
) from public, anon;
revoke execute on function public.rpc_create_document_version(
  text, text, integer, text, text, text, text, bigint, text, text, text,
  text, text[], uuid, uuid
) from public, anon;
revoke execute on function public.rpc_review_document_version(
  text, text, text, text, text, uuid
) from public, anon;

grant execute on function public.rpc_create_customer_request(
  text, text, text, text, text, text, text, text, date, text, text, text,
  uuid, text, text, boolean, text, jsonb
) to authenticated;
grant execute on function public.rpc_create_rfi(
  text, text, text, text, text, text, text, text, text, text, text, jsonb,
  date, text, integer, text, uuid
) to authenticated;
grant execute on function public.rpc_submit_rfi_response(
  text, text, text, text, text, jsonb, uuid
) to authenticated;
grant execute on function public.rpc_accept_rfi_response(
  text, text, text, text, uuid
) to authenticated;
grant execute on function public.rpc_create_document_version(
  text, text, integer, text, text, text, text, bigint, text, text, text,
  text, text[], uuid, uuid
) to authenticated;
grant execute on function public.rpc_review_document_version(
  text, text, text, text, text, uuid
) to authenticated;
