alter table public.rfi_responses
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_rfi_responses_submitter
  on public.rfi_responses (submitted_by_user_id, created_at desc);

create or replace function app_private.capture_rfi_response_actor()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if auth.uid() is not null then
    new.submitted_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists rfi_responses_capture_actor on public.rfi_responses;
create trigger rfi_responses_capture_actor
before insert on public.rfi_responses
for each row execute function app_private.capture_rfi_response_actor();

create or replace function app_private.notify_rfi_recipient_team()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct membership.user_id
    from public.assignment_groups group_record
    join public.assignment_group_memberships membership
      on membership.assignment_group_id = group_record.id
    where group_record.active
      and upper(group_record.org_code) = upper(new.recipient_org_code)
  loop
    insert into public.notifications (
      recipient_id, recipient_user_id, user_id, title, message, body,
      event_type, type, link_url, urgency, metadata, channel,
      delivery_status, is_read, dedupe_key, created_at
    ) values (
      v_user_id, v_user_id, v_user_id::text,
      new.code || ' requires information',
      new.requesting_org_code || ' requested information for ' || new.workstream_title || '.',
      new.question_text,
      'action_required', 'action_required', '/work/rfi/' || new.id, 'high',
      jsonb_build_object(
        'rfiId', new.id,
        'rfiCode', new.code,
        'recipientOrgCode', new.recipient_org_code,
        'requestingOrgCode', new.requesting_org_code,
        'workstreamId', new.workstream_id
      ),
      'in_app', 'pending', false,
      'rfi-issued:' || new.id || ':' || v_user_id::text,
      coalesce(new.created_at, now())
    ) on conflict (dedupe_key) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists rfis_notify_recipient_team on public.rfis;
create trigger rfis_notify_recipient_team
after insert on public.rfis
for each row execute function app_private.notify_rfi_recipient_team();

create or replace function app_private.notify_rfi_requesting_team()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_user_id uuid;
  v_rfi public.rfis%rowtype;
begin
  select * into v_rfi
  from public.rfis
  where id = new.rfi_id;

  if not found then
    return new;
  end if;

  for v_user_id in
    select distinct membership.user_id
    from public.assignment_groups group_record
    join public.assignment_group_memberships membership
      on membership.assignment_group_id = group_record.id
    where group_record.active
      and upper(group_record.org_code) = upper(v_rfi.requesting_org_code)
  loop
    insert into public.notifications (
      recipient_id, recipient_user_id, user_id, title, message, body,
      event_type, type, link_url, urgency, metadata, channel,
      delivery_status, is_read, dedupe_key, created_at
    ) values (
      v_user_id, v_user_id, v_user_id::text,
      v_rfi.code || ' response received',
      new.submitted_by_user_name || ' submitted a response for review.',
      new.response_text,
      'action_required', 'action_required', '/work/rfi/' || v_rfi.id, 'high',
      jsonb_build_object(
        'rfiId', v_rfi.id,
        'rfiCode', v_rfi.code,
        'responseId', new.id,
        'requestingOrgCode', v_rfi.requesting_org_code,
        'recipientOrgCode', v_rfi.recipient_org_code,
        'workstreamId', v_rfi.workstream_id
      ),
      'in_app', 'pending', false,
      'rfi-response:' || new.id || ':' || v_user_id::text,
      coalesce(new.created_at, now())
    ) on conflict (dedupe_key) do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists rfi_responses_notify_requesting_team on public.rfi_responses;
create trigger rfi_responses_notify_requesting_team
after insert on public.rfi_responses
for each row execute function app_private.notify_rfi_requesting_team();

create or replace function app_private.notify_rfi_response_submitter()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
begin
  if new.review_status = 'accepted'
     and old.review_status is distinct from new.review_status
     and new.submitted_by_user_id is not null then
    insert into public.notifications (
      recipient_id, recipient_user_id, user_id, title, message, body,
      event_type, type, link_url, urgency, metadata, channel,
      delivery_status, is_read, dedupe_key, created_at
    ) values (
      new.submitted_by_user_id, new.submitted_by_user_id,
      new.submitted_by_user_id::text,
      'RFI response accepted',
      'Your response was accepted by the reviewing agency.',
      coalesce(new.reviewer_feedback, 'The review is complete and the linked work can continue.'),
      'status_update', 'status_update', '/work/rfi/' || new.rfi_id, 'normal',
      jsonb_build_object(
        'rfiId', new.rfi_id,
        'responseId', new.id,
        'reviewStatus', new.review_status
      ),
      'in_app', 'pending', false,
      'rfi-accepted:' || new.id || ':' || new.submitted_by_user_id::text,
      now()
    ) on conflict (dedupe_key) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists rfi_responses_notify_submitter on public.rfi_responses;
create trigger rfi_responses_notify_submitter
after update of review_status on public.rfi_responses
for each row execute function app_private.notify_rfi_response_submitter();

revoke all on function app_private.capture_rfi_response_actor() from public, anon, authenticated;
revoke all on function app_private.notify_rfi_recipient_team() from public, anon, authenticated;
revoke all on function app_private.notify_rfi_requesting_team() from public, anon, authenticated;
revoke all on function app_private.notify_rfi_response_submitter() from public, anon, authenticated;
