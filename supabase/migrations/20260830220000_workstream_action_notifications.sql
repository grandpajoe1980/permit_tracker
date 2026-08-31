-- Persist action confirmations for the workstream command transactions.
-- The recipient is the authenticated actor because the action forms carry a
-- display name/org, not a stable auth user id. Target-user routing remains a
-- separate directory concern and must not be guessed from free text.

create or replace function app_private.notify_workstream_action_audit()
returns trigger
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_title text;
  v_message text;
  v_event_type text;
  v_urgency text;
begin
  if new.action = 'workstream_blocked' then
    v_title := new.entity_id || ' blocked';
    v_message := coalesce(new.reason, 'A workstream blocker was recorded.');
    v_event_type := 'action_required';
    v_urgency := 'high';
  elsif new.action = 'workstream_escalated' then
    v_title := new.entity_id || ' escalated';
    v_message := coalesce(new.reason, 'A workstream escalation was recorded.');
    v_event_type := 'escalation';
    v_urgency := 'high';
  elsif new.action = 'workstream_transfer_requested' then
    v_title := new.entity_id || ' transfer requested';
    v_message := coalesce(new.reason, 'A workstream transfer request was recorded.');
    v_event_type := 'transfer';
    v_urgency := 'normal';
  else
    return new;
  end if;

  if new.actor_id is not null then
    insert into public.notifications (
      recipient_id, user_id, title, message, body, event_type, type, link_url,
      urgency, metadata, channel, delivery_status, is_read, created_at
    ) values (
      new.actor_id, new.actor_id::text, v_title, v_message, v_message,
      v_event_type, v_event_type, '/workstreams/' || new.entity_id, v_urgency,
      jsonb_build_object('workstreamCode', new.entity_id, 'auditEventId', new.id),
      'in_app', 'pending', false, coalesce(new.created_at, now())
    );
  end if;

  return new;
end;
$$;

drop trigger if exists audit_events_workstream_action_notification on public.audit_events;
create trigger audit_events_workstream_action_notification
after insert on public.audit_events
for each row execute function app_private.notify_workstream_action_audit();

revoke all on function app_private.notify_workstream_action_audit() from public, anon, authenticated;
