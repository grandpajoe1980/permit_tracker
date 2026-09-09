-- Customer clarification responses are an authenticated, submitter-owned
-- transition. Keep the original submitter immutable and perform the complete
-- response/audit/notification write in one transaction instead of relying on a
-- direct client UPDATE that is intentionally denied by the normal RLS policy.
create or replace function public.rpc_respond_customer_intake_clarification(
  p_request_id text,
  p_response_text text,
  p_attachment_document_version_ids jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_request public.customer_requests%rowtype;
  v_actor_name text;
  v_now timestamptz := now();
  v_description text;
  v_attachments jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if nullif(trim(p_response_text), '') is null then
    raise exception 'clarification response cannot be empty';
  end if;

  select * into v_request
  from public.customer_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'customer request not found: %', p_request_id;
  end if;

  if v_request.submitted_by_user_id is distinct from auth.uid() then
    raise exception 'only the original submitter can respond to this clarification';
  end if;

  -- A retried request after the first committed response is harmless. The
  -- first response clears triage_notes, so it can be returned without adding
  -- a duplicate description, audit event, or notification.
  if v_request.status = 'submitted' and v_request.triage_notes is null then
    return to_jsonb(v_request);
  end if;
  if v_request.status <> 'pending_customer' then
    raise exception 'customer request is not waiting for clarification: %', v_request.status;
  end if;

  v_actor_name := coalesce((select full_name from public.profiles where id = auth.uid()), 'Authenticated customer');
  v_description := concat_ws(
    E'\n\n',
    nullif(v_request.description, ''),
    '[Clarification from ' || v_actor_name || ']: ' || trim(p_response_text)
  );
  v_attachments := coalesce((
    select jsonb_agg(distinct value order by value)
    from jsonb_array_elements_text(
      coalesce(v_request.attachment_document_version_ids, '[]'::jsonb)
      || coalesce(p_attachment_document_version_ids, '[]'::jsonb)
    ) as values(value)
    where nullif(trim(value), '') is not null
  ), '[]'::jsonb);

  update public.customer_requests set
    status = 'submitted',
    itsm_state = 'submitted',
    description = v_description,
    triage_notes = null,
    attachment_document_version_ids = v_attachments,
    updated_at = v_now
  where id = v_request.id
  returning * into v_request;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    auth.uid(), 'customer_intake_clarification_submitted', 'customer_request',
    'customer_request', v_request.id, v_actor_name,
    'customer_intake_clarification_submitted', 'pending_customer', 'submitted',
    trim(p_response_text), v_request.project_id, v_now
  );

  if v_request.triaged_by_user_id is not null then
    insert into public.notifications (
      recipient_id, recipient_user_id, user_id, title, message, body,
      event_type, type, link_url, urgency, metadata, channel,
      delivery_status, is_read, dedupe_key, created_at
    ) values (
      v_request.triaged_by_user_id, v_request.triaged_by_user_id,
      v_request.triaged_by_user_id::text,
      'Customer clarification received for ' || v_request.confirmation_number,
      v_actor_name || ' responded to the requested clarification.',
      trim(p_response_text), 'customer_intake_clarification_response',
      'action_required', '/requests/' || v_request.confirmation_number,
      'normal', jsonb_build_object('requestId', v_request.id), 'in_app',
      'pending', false,
      'customer-intake-clarification-response:' || v_request.id,
      v_now
    ) on conflict (dedupe_key) do nothing;
  end if;

  return to_jsonb(v_request);
end;
$$;

revoke execute on function public.rpc_respond_customer_intake_clarification(text, text, jsonb) from public, anon;
grant execute on function public.rpc_respond_customer_intake_clarification(text, text, jsonb) to authenticated;
