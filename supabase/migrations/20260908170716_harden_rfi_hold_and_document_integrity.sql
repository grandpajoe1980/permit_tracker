-- Follow-up integrity fixes for the operational UX acceptance gates.
-- RFI holds are recalculated from all outstanding RFIs, and document
-- mutations are anchored to the canonical document/project relationship.

create or replace function public.rpc_create_rfi(
  p_id text,
  p_code text,
  p_workstream_id text,
  p_workstream_title text,
  p_requesting_org_id text,
  p_requesting_org_code text,
  p_recipient_org_id text,
  p_recipient_org_code text,
  p_title text,
  p_question_text text,
  p_technical_reason text,
  p_required_document_types jsonb,
  p_response_deadline date,
  p_clock_impact text,
  p_schedule_impact_days integer,
  p_actor_name text,
  p_actor_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_today date := current_date;
  v_workstream public.workstreams%rowtype;
  v_rfi public.rfis%rowtype;
  v_existing public.rfis%rowtype;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  if nullif(trim(p_code), '') is null then raise exception 'RFI code is required'; end if;
  if nullif(trim(p_question_text), '') is null then raise exception 'RFI question is required'; end if;
  if p_response_deadline is null then raise exception 'RFI response deadline is required'; end if;

  select * into v_workstream
  from public.workstreams
  where id = p_workstream_id or code = p_workstream_id
  for update;
  if not found then raise exception 'workstream not found: %', p_workstream_id; end if;
  if v_workstream.project_id is null
     or not (select app_private.has_project_access(v_workstream.project_id)) then
    raise exception 'authenticated user cannot access workstream project';
  end if;

  if not exists (
    select 1 from public.organizations o
    where upper(o.code) = upper(p_requesting_org_code) and o.active
  ) then
    raise exception 'requesting organization is not registered: %', p_requesting_org_code;
  end if;
  if not exists (
    select 1 from public.organizations o
    where upper(o.code) = upper(p_recipient_org_code) and o.active
  ) then
    raise exception 'recipient organization is not registered: %', p_recipient_org_code;
  end if;
  if not (select app_private.is_system_admin())
     and not exists (
       select 1
       from public.organization_memberships m
       join public.organizations o on o.id = m.organization_id
       where m.user_id = (select auth.uid())
         and m.status = 'active'
         and m.effective_from <= now()
         and (m.effective_to is null or m.effective_to > now())
         and (upper(o.code) = upper(p_requesting_org_code)
              or lower(o.id::text) = lower(coalesce(p_requesting_org_id, '')))
     ) then
    raise exception 'requesting organization membership required';
  end if;

  -- A retried request returns the durable receipt instead of creating a
  -- second hold/notification. A reused code for another workstream is an
  -- explicit conflict and must never be silently repointed.
  select * into v_existing from public.rfis where code = p_code;
  if found then
    if v_existing.workstream_id <> v_workstream.id then
      raise exception 'RFI code already belongs to another workstream: %', p_code;
    end if;
    return to_jsonb(v_existing);
  end if;

  v_actor_name := coalesce(
    (select up.full_name from public.user_profiles up
      where up.user_id = (select auth.uid()) limit 1),
    nullif(trim(p_actor_name), ''), 'Authenticated user'
  );

  insert into public.rfis (
    id, code, workstream_id, workstream_title, requesting_org_id, requesting_org_code,
    recipient_org_id, recipient_org_code, title, question_text, technical_reason,
    required_document_types, issued_date, response_deadline, clock_impact,
    schedule_impact_days, status, is_consolidated_cycle, created_at
  ) values (
    p_id, p_code, v_workstream.id,
    coalesce(nullif(trim(p_workstream_title), ''), v_workstream.title),
    p_requesting_org_id, p_requesting_org_code, p_recipient_org_id, p_recipient_org_code,
    p_title, p_question_text, p_technical_reason,
    coalesce(p_required_document_types, '[]'::jsonb), v_today, p_response_deadline,
    coalesce(p_clock_impact, 'pauses_clock'), coalesce(p_schedule_impact_days, 0),
    'issued', false, v_now
  ) returning * into v_rfi;

  update public.workstreams
  set operational_state = 'waiting_applicant',
      operational_state_label = 'Waiting on Applicant (RFI Issued)',
      waiting_reason = 'Waiting for response to ' || p_code || '.',
      waiting_on_entity = p_recipient_org_code,
      updated_at = v_now
  where id = v_workstream.id;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  ) values (
    (select auth.uid()), 'rfi_issued', 'rfi', 'rfi', p_code, v_actor_name,
    p_requesting_org_code, 'rfi_issued', 'Issued ' || p_code || ' to ' || p_recipient_org_code,
    p_question_text, v_workstream.project_id::text, v_now
  );

  return to_jsonb(v_rfi);
end;
$$;

create or replace function public.rpc_submit_rfi_response(
  p_id text,
  p_rfi_id text,
  p_submitted_by_user_name text,
  p_response_text text,
  p_actor_org_name text,
  p_attached_document_version_ids jsonb default '[]'::jsonb,
  p_actor_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_today date := current_date;
  v_resp public.rfi_responses%rowtype;
  v_existing public.rfi_responses%rowtype;
  v_rfi record;
  v_actor_name text;
  v_actor_org_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  select r.*, w.project_id into v_rfi
  from public.rfis r
  join public.workstreams w on w.id = r.workstream_id
  where r.id = p_rfi_id or r.code = p_rfi_id
  for update;
  if not found then raise exception 'RFI not found: %', p_rfi_id; end if;
  if v_rfi.status in ('accepted', 'closed', 'withdrawn') then
    raise exception 'RFI is already terminal: %', v_rfi.status;
  end if;
  if not (select app_private.has_project_access(v_rfi.project_id)) then
    raise exception 'authenticated user cannot access RFI project';
  end if;
  if not (select app_private.is_system_admin())
     and not exists (
       select 1
       from public.organization_memberships m
       join public.organizations o on o.id = m.organization_id
       where m.user_id = (select auth.uid())
         and m.status = 'active'
         and m.effective_from <= now()
         and (m.effective_to is null or m.effective_to > now())
         and upper(o.code) = upper(v_rfi.recipient_org_code)
     ) then
    raise exception 'recipient organization membership required';
  end if;
  if nullif(trim(p_response_text), '') is null then raise exception 'RFI response is required'; end if;
  if jsonb_typeof(coalesce(p_attached_document_version_ids, '[]'::jsonb)) <> 'array' then
    raise exception 'RFI attachments must be a JSON array';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_attached_document_version_ids, '[]'::jsonb)) a(value)
    where not exists (
      select 1
      from public.document_versions dv
      left join public.documents d on d.id = dv.document_id
      where dv.id = a.value
        and (dv.project_id = v_rfi.project_id or d.project_id = v_rfi.project_id)
    )
  ) then
    raise exception 'RFI attachment is not part of the project';
  end if;

  select * into v_existing from public.rfi_responses where id = p_id;
  if found then
    if v_existing.rfi_id <> v_rfi.id then
      raise exception 'response ID already belongs to another RFI: %', p_id;
    end if;
    return to_jsonb(v_existing);
  end if;

  v_actor_name := coalesce(
    (select up.full_name from public.user_profiles up
      where up.user_id = (select auth.uid()) limit 1),
    nullif(trim(p_submitted_by_user_name), ''), 'Authenticated user'
  );
  select o.name into v_actor_org_name
  from public.organization_memberships m
  join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid()) and m.status = 'active'
  order by case when upper(o.code) = upper(v_rfi.recipient_org_code) then 0 else 1 end
  limit 1;
  v_actor_org_name := coalesce(v_actor_org_name, nullif(trim(p_actor_org_name), ''), v_rfi.recipient_org_code);

  insert into public.rfi_responses (
    id, rfi_id, submitted_by_user_id, submitted_by_user_name, response_text,
    attached_document_version_ids, submitted_date, review_status, created_at
  ) values (
    p_id, v_rfi.id, (select auth.uid()), v_actor_name, p_response_text,
    coalesce(p_attached_document_version_ids, '[]'::jsonb), v_today, 'under_review', v_now
  ) returning * into v_resp;

  update public.rfis set status = 'submitted_by_applicant' where id = v_rfi.id;
  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, new_value, reason, project_id, created_at
  ) values (
    (select auth.uid()), 'rfi_response_submitted', 'rfi_response', 'rfi_response',
    v_rfi.code, v_actor_name, v_actor_org_name, 'rfi_response_submitted',
    'Response submitted to ' || v_rfi.requesting_org_code, p_response_text,
    v_rfi.project_id::text, v_now
  );
  return to_jsonb(v_resp);
end;
$$;

create or replace function public.rpc_accept_rfi_response(
  p_rfi_id text,
  p_actor_name text,
  p_actor_org_name text,
  p_notes text default 'Response accepted and linked review resumed.',
  p_actor_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_rfi record;
  v_resp public.rfi_responses%rowtype;
  v_workstream public.workstreams%rowtype;
  v_remaining public.rfis%rowtype;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  select r.*, w.project_id into v_rfi
  from public.rfis r join public.workstreams w on w.id = r.workstream_id
  where r.id = p_rfi_id or r.code = p_rfi_id
  for update;
  if not found then raise exception 'RFI not found: %', p_rfi_id; end if;
  if not (select app_private.has_project_access(v_rfi.project_id)) then
    raise exception 'authenticated user cannot access RFI project';
  end if;
  if not (select app_private.is_system_admin())
     and not exists (
       select 1 from public.organization_memberships m
       join public.organizations o on o.id = m.organization_id
       where m.user_id = (select auth.uid()) and m.status = 'active'
         and m.effective_from <= now() and (m.effective_to is null or m.effective_to > now())
         and upper(o.code) = upper(v_rfi.requesting_org_code)
     ) then
    raise exception 'requesting organization membership required';
  end if;

  if v_rfi.status = 'accepted' then
    return jsonb_build_object('success', true, 'rfiCode', v_rfi.code, 'alreadyAccepted', true);
  end if;

  select * into v_resp
  from public.rfi_responses
  where rfi_id = v_rfi.id and review_status = 'under_review'
  order by created_at desc, id desc
  limit 1
  for update;
  if not found then raise exception 'no pending RFI response to accept'; end if;

  update public.rfi_responses
  set review_status = 'accepted', reviewer_feedback = p_notes
  where id = v_resp.id
  returning * into v_resp;
  update public.rfis set status = 'accepted' where id = v_rfi.id;

  select * into v_workstream from public.workstreams where id = v_rfi.workstream_id for update;
  select * into v_remaining
  from public.rfis
  where workstream_id = v_rfi.workstream_id
    and status in ('issued', 'partially_answered', 'submitted_by_applicant')
  order by response_deadline nulls last, created_at, id
  limit 1;

  if found then
    -- Keep a precise next owner when another RFI remains. Do not overwrite
    -- an independent blocked/coordination state.
    if v_workstream.operational_state = 'waiting_applicant' then
      update public.workstreams
      set waiting_reason = 'Waiting for response to ' || v_remaining.code || '.',
          waiting_on_entity = v_remaining.recipient_org_code,
          updated_at = v_now
      where id = v_workstream.id;
    end if;
  elsif v_workstream.operational_state = 'waiting_applicant'
        and (v_workstream.waiting_on_entity = v_rfi.recipient_org_code
             or v_workstream.waiting_reason ilike '%' || v_rfi.code || '%') then
    update public.workstreams
    set operational_state = 'running',
        operational_state_label = 'Running (Response Accepted)',
        waiting_reason = null,
        waiting_on_entity = null,
        updated_at = v_now
    where id = v_workstream.id;
  end if;

  v_actor_name := coalesce(
    (select up.full_name from public.user_profiles up
      where up.user_id = (select auth.uid()) limit 1),
    nullif(trim(p_actor_name), ''), 'Authenticated user'
  );
  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, project_id, created_at
  ) values (
    (select auth.uid()), 'rfi_response_accepted', 'rfi', 'rfi', v_rfi.code, v_actor_name,
    coalesce(nullif(trim(p_actor_org_name), ''), v_rfi.requesting_org_code),
    'rfi_response_accepted', 'submitted_by_applicant', 'accepted', p_notes,
    v_rfi.project_id::text, v_now
  );
  return jsonb_build_object('success', true, 'rfiCode', v_rfi.code, 'responseId', v_resp.id);
end;
$$;

create or replace function public.rpc_create_document_version(
  p_version_id text,
  p_document_id text,
  p_version_number integer,
  p_version_label text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sha256_hash text,
  p_uploaded_by_name text,
  p_uploaded_by_org_name text,
  p_change_notes text,
  p_reviewing_agency_codes text[],
  p_project_id uuid default null,
  p_actor_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_agency_code text;
  v_review_id text;
  v_reviews jsonb := '[]'::jsonb;
  v_doc_uuid uuid;
  v_project_id uuid;
  v_document public.documents%rowtype;
  v_existing public.document_versions%rowtype;
  v_max_version integer;
  v_actor_name text;
  v_actor_org_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  begin v_doc_uuid := p_document_id::uuid; exception when others then v_doc_uuid := null; end;
  select * into v_document
  from public.documents d
  where (v_doc_uuid is not null and d.id = v_doc_uuid)
     or d.document_ref_id = p_document_id
  limit 1;
  if not found then raise exception 'document not found: %', p_document_id; end if;

  select * into v_existing from public.document_versions where id = p_version_id;
  if found then return to_jsonb(v_existing); end if;

  v_project_id := v_document.project_id;
  if v_project_id is null and v_document.request_id is not null then
    select r.project_id into v_project_id from public.requests r where r.id = v_document.request_id;
  end if;
  if p_project_id is not null and v_project_id is not null and p_project_id <> v_project_id then
    raise exception 'document does not belong to supplied project';
  end if;
  v_project_id := coalesce(v_project_id, p_project_id);
  if v_project_id is null or not (select app_private.has_project_access(v_project_id)) then
    raise exception 'authenticated user cannot access document project';
  end if;
  if p_version_number is null or p_version_number < 1 then raise exception 'document version number is invalid'; end if;
  select max(version_number) into v_max_version
  from public.document_versions
  where document_id = v_document.id or document_ref_id = coalesce(v_document.document_ref_id, p_document_id);
  if coalesce(v_max_version, 0) >= p_version_number then
    raise exception 'document version number must increase beyond %', v_max_version;
  end if;
  if p_reviewing_agency_codes is not null and exists (
    select 1 from unnest(p_reviewing_agency_codes) code
    where not exists (
      select 1 from public.organizations o
      where upper(o.code) = upper(code) and o.active
    )
  ) then
    raise exception 'document review agency is not registered';
  end if;

  v_actor_name := coalesce((select up.full_name from public.user_profiles up
    where up.user_id = (select auth.uid()) limit 1), nullif(trim(p_uploaded_by_name), ''), 'Authenticated user');
  select o.name into v_actor_org_name
  from public.organization_memberships m join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid()) and m.status = 'active' limit 1;
  v_actor_org_name := coalesce(v_actor_org_name, nullif(trim(p_uploaded_by_org_name), ''), 'Project participant');

  insert into public.document_versions (
    id, document_id, document_ref_id, version_number, version_label, storage_path,
    file_name, mime_type, file_size_bytes, sha256_hash, uploaded_at, uploaded_by_name,
    uploaded_by_org_name, change_notes, status, project_id, created_at
  ) values (
    p_version_id, v_document.id,
    coalesce(v_document.document_ref_id, p_document_id), p_version_number, p_version_label,
    p_storage_path, p_file_name, p_mime_type, p_file_size_bytes, p_sha256_hash, v_now,
    v_actor_name, v_actor_org_name, p_change_notes, 'under_review', v_project_id, v_now
  );

  if p_reviewing_agency_codes is not null then
    foreach v_agency_code in array p_reviewing_agency_codes loop
      v_review_id := 'rev-' || p_version_id || '-' || lower(v_agency_code);
      insert into public.document_agency_reviews (
        id, document_version_id, reviewing_org_id, reviewing_org_code, status, review_status, created_at
      ) values (
        v_review_id, p_version_id, 'org-' || lower(v_agency_code), v_agency_code, 'under_review', 'under_review', v_now
      );
      v_reviews := v_reviews || jsonb_build_object('id', v_review_id, 'documentVersionId', p_version_id,
        'reviewingOrgCode', v_agency_code, 'reviewStatus', 'under_review', 'status', 'under_review');
    end loop;
  end if;

  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name, actor_org_name,
    action_type, new_value, reason, project_id, created_at
  ) values (
    (select auth.uid()), 'version_upload', 'document_version', 'document_version', p_version_id,
    v_actor_name, v_actor_org_name, 'version_upload', 'Uploaded ' || p_document_id || ' ' || p_version_label,
    p_change_notes, v_project_id::text, v_now
  );
  return jsonb_build_object('id', p_version_id, 'documentId', p_document_id,
    'versionNumber', p_version_number, 'versionLabel', p_version_label, 'storagePath', p_storage_path,
    'fileName', p_file_name, 'mimeType', p_mime_type, 'fileSizeBytes', p_file_size_bytes,
    'sha256Hash', p_sha256_hash, 'uploadedAt', v_now, 'uploadedByName', v_actor_name,
    'uploadedByOrgName', v_actor_org_name, 'changeNotes', p_change_notes, 'status', 'under_review',
    'agencyReviews', v_reviews);
end;
$$;

create or replace function public.rpc_review_document_version(
  p_version_id text,
  p_agency_code text,
  p_decision text,
  p_actor_name text,
  p_comments text,
  p_actor_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_now timestamptz := now();
  v_today date := current_date;
  v_review public.document_agency_reviews%rowtype;
  v_all_approved boolean;
  v_project_id uuid;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  if p_decision not in ('approved', 'approved_with_conditions', 'revision_requested', 'rejected') then
    raise exception 'unsupported document review decision: %', p_decision;
  end if;
  select v.project_id into v_project_id from public.document_versions v where v.id = p_version_id;
  if v_project_id is null then
    select d.project_id into v_project_id
    from public.document_versions v join public.documents d on d.id = v.document_id
    where v.id = p_version_id;
  end if;
  if v_project_id is null or not (select app_private.has_project_access(v_project_id)) then
    raise exception 'authenticated user cannot access document project';
  end if;
  if not (select app_private.is_system_admin())
     and not exists (
       select 1 from public.organization_memberships m join public.organizations o on o.id = m.organization_id
       where m.user_id = (select auth.uid()) and m.status = 'active'
         and m.effective_from <= now() and (m.effective_to is null or m.effective_to > now())
         and upper(o.code) = upper(p_agency_code)
     ) then
    raise exception 'reviewing organization membership required';
  end if;

  select * into v_review
  from public.document_agency_reviews
  where document_version_id = p_version_id and upper(reviewing_org_code) = upper(p_agency_code)
  for update;
  if not found then raise exception 'document review assignment not found for agency %', p_agency_code; end if;
  if v_review.status not in ('under_review', 'revisions_requested')
     and v_review.review_status not in ('under_review', 'revisions_requested') then
    raise exception 'document review is already terminal: %', v_review.status;
  end if;

  v_actor_name := coalesce((select up.full_name from public.user_profiles up
    where up.user_id = (select auth.uid()) limit 1), nullif(trim(p_actor_name), ''), 'Authenticated user');
  update public.document_agency_reviews
  set status = p_decision,
      review_status = case when p_decision = 'revision_requested' then 'revisions_requested' else p_decision end,
      reviewed_by_user_id = (select auth.uid()), reviewed_by_user_name = v_actor_name,
      reviewed_at = v_now, decision_date = v_today, comments = p_comments, review_comments = p_comments
  where id = v_review.id returning * into v_review;

  select bool_and(status in ('approved', 'approved_with_conditions')) into v_all_approved
  from public.document_agency_reviews where document_version_id = p_version_id;
  if coalesce(v_all_approved, false) then
    update public.document_versions set status = 'approved' where id = p_version_id;
  elsif p_decision = 'revision_requested' then
    update public.document_versions set status = 'superseded' where id = p_version_id;
  end if;

  insert into public.audit_events (
    id, correlation_id, actor_id, action, resource_type, entity_type, entity_id,
    actor_name, actor_org_name, action_type, new_value, reason, project_id, created_at
  ) values (
    gen_random_uuid(), gen_random_uuid(), (select auth.uid()), 'agency_signoff',
    'document_agency_review', 'document_agency_review', v_review.id, v_actor_name,
    p_agency_code, 'agency_signoff', p_agency_code || ' signed off as ' || p_decision,
    p_comments, v_project_id::text, v_now
  );
  return to_jsonb(v_review);
end;
$$;

revoke execute on function public.rpc_create_rfi(text,text,text,text,text,text,text,text,text,text,text,jsonb,date,text,integer,text,uuid) from public, anon;
grant execute on function public.rpc_create_rfi(text,text,text,text,text,text,text,text,text,text,text,jsonb,date,text,integer,text,uuid) to authenticated, service_role;
revoke execute on function public.rpc_submit_rfi_response(text,text,text,text,text,jsonb,uuid) from public, anon;
grant execute on function public.rpc_submit_rfi_response(text,text,text,text,text,jsonb,uuid) to authenticated, service_role;
revoke execute on function public.rpc_accept_rfi_response(text,text,text,text,uuid) from public, anon;
grant execute on function public.rpc_accept_rfi_response(text,text,text,text,uuid) to authenticated, service_role;
revoke execute on function public.rpc_create_document_version(text,text,integer,text,text,text,text,bigint,text,text,text,text,text[],uuid,uuid) from public, anon;
grant execute on function public.rpc_create_document_version(text,text,integer,text,text,text,text,bigint,text,text,text,text,text[],uuid,uuid) to authenticated, service_role;
revoke execute on function public.rpc_review_document_version(text,text,text,text,text,uuid) from public, anon;
grant execute on function public.rpc_review_document_version(text,text,text,text,text,uuid) to authenticated, service_role;
