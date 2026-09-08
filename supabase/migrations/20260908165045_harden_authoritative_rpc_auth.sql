-- Harden authenticated RPC entry points used by the operational UI.
-- Every SECURITY DEFINER transaction derives the actor from auth.uid(),
-- checks project/organization access, and never clears an unrelated hold.

drop policy if exists document_agency_reviews_anon_all on public.document_agency_reviews;

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
  v_workstream record;
  v_rfi record;
  v_actor_name text;
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;

  select * into v_workstream
  from public.workstreams
  where id = p_workstream_id or code = p_workstream_id
  limit 1;
  if not found then
    raise exception 'workstream not found: %', p_workstream_id;
  end if;
  if not (select app_private.has_project_access(v_workstream.project_id)) then
    raise exception 'authenticated user cannot access workstream project';
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

  v_actor_name := coalesce(
    (select up.full_name from public.user_profiles up where up.user_id = (select auth.uid()) limit 1),
    nullif(trim(p_actor_name), ''),
    'Authenticated user'
  );

  insert into public.rfis (
    id, code, workstream_id, workstream_title, requesting_org_id, requesting_org_code,
    recipient_org_id, recipient_org_code, title, question_text, technical_reason,
    required_document_types, issued_date, response_deadline, clock_impact,
    schedule_impact_days, status, is_consolidated_cycle, created_at
  ) values (
    p_id, p_code, v_workstream.id, coalesce(nullif(trim(p_workstream_title), ''), v_workstream.title),
    p_requesting_org_id, p_requesting_org_code, p_recipient_org_id, p_recipient_org_code,
    p_title, p_question_text, p_technical_reason, coalesce(p_required_document_types, '[]'::jsonb),
    v_today, p_response_deadline, coalesce(p_clock_impact, 'pauses_clock'),
    coalesce(p_schedule_impact_days, 0), 'issued', false, v_now
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
    actor_org_name, action_type, new_value, reason, created_at
  ) values (
    (select auth.uid()), 'rfi_issued', 'rfi', 'rfi', p_code, v_actor_name,
    p_requesting_org_code, 'rfi_issued', 'Issued ' || p_code || ' to ' || p_recipient_org_code,
    p_question_text, v_now
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
  v_resp record;
  v_rfi record;
  v_workstream record;
  v_actor_name text;
  v_actor_org_name text;
begin
  if auth.uid() is null then
    raise exception 'authenticated user required';
  end if;
  select r.*, w.project_id into v_rfi
  from public.rfis r
  join public.workstreams w on w.id = r.workstream_id
  where r.id = p_rfi_id or r.code = p_rfi_id
  limit 1;
  if not found then raise exception 'RFI not found: %', p_rfi_id; end if;
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

  v_actor_name := coalesce(
    (select up.full_name from public.user_profiles up where up.user_id = (select auth.uid()) limit 1),
    nullif(trim(p_submitted_by_user_name), ''),
    'Authenticated user'
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
    actor_org_name, action_type, new_value, reason, created_at
  ) values (
    (select auth.uid()), 'rfi_response_submitted', 'rfi_response', 'rfi_response',
    v_rfi.code, v_actor_name, v_actor_org_name, 'rfi_response_submitted',
    'Response submitted to ' || v_rfi.requesting_org_code, p_response_text, v_now
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
  v_resp record;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  select r.*, w.project_id into v_rfi
  from public.rfis r join public.workstreams w on w.id = r.workstream_id
  where r.id = p_rfi_id or r.code = p_rfi_id limit 1;
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

  update public.rfi_responses
  set review_status = 'accepted', reviewer_feedback = p_notes
  where rfi_id = v_rfi.id and (review_status = 'under_review' or review_status is null)
  returning * into v_resp;
  if not found then raise exception 'no pending RFI response to accept'; end if;

  update public.rfis set status = 'accepted' where id = v_rfi.id;

  -- Resume only the applicant hold created for this RFI, and only when no
  -- other active RFI is holding the same workstream.
  update public.workstreams ws
  set operational_state = 'running',
      operational_state_label = 'Running (Response Accepted)',
      waiting_reason = null,
      waiting_on_entity = null,
      updated_at = v_now
  where ws.id = v_rfi.workstream_id
    and ws.operational_state = 'waiting_applicant'
    and ws.waiting_on_entity = v_rfi.recipient_org_code
    and not exists (
      select 1 from public.rfis other
      where other.workstream_id = v_rfi.workstream_id
        and other.id <> v_rfi.id
        and other.status in ('issued', 'partially_answered', 'submitted_by_applicant')
    );

  v_actor_name := coalesce(
    (select up.full_name from public.user_profiles up where up.user_id = (select auth.uid()) limit 1),
    nullif(trim(p_actor_name), ''), 'Authenticated user'
  );
  insert into public.audit_events (
    actor_id, action, resource_type, entity_type, entity_id, actor_name,
    actor_org_name, action_type, old_value, new_value, reason, created_at
  ) values (
    (select auth.uid()), 'rfi_response_accepted', 'rfi', 'rfi', v_rfi.code, v_actor_name,
    coalesce(nullif(trim(p_actor_org_name), ''), v_rfi.requesting_org_code),
    'rfi_response_accepted', 'submitted_by_applicant', 'accepted', p_notes, v_now
  );
  return jsonb_build_object('success', true, 'rfiCode', v_rfi.code);
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
  v_project_id uuid := p_project_id;
  v_actor_name text;
  v_actor_org_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  begin v_doc_uuid := p_document_id::uuid; exception when others then v_doc_uuid := null; end;
  if v_project_id is null then
    select d.project_id into v_project_id from public.documents d where d.id = v_doc_uuid or d.document_ref_id = p_document_id limit 1;
  end if;
  if v_project_id is null or not (select app_private.has_project_access(v_project_id)) then
    raise exception 'authenticated user cannot access document project';
  end if;
  v_actor_name := coalesce((select up.full_name from public.user_profiles up where up.user_id = (select auth.uid()) limit 1), nullif(trim(p_uploaded_by_name), ''), 'Authenticated user');
  select o.name into v_actor_org_name
  from public.organization_memberships m join public.organizations o on o.id = m.organization_id
  where m.user_id = (select auth.uid()) and m.status = 'active' limit 1;
  v_actor_org_name := coalesce(v_actor_org_name, nullif(trim(p_uploaded_by_org_name), ''), 'Project participant');

  insert into public.document_versions (
    id, document_id, document_ref_id, version_number, version_label, storage_path,
    file_name, mime_type, file_size_bytes, sha256_hash, uploaded_at, uploaded_by_name,
    uploaded_by_org_name, change_notes, status, project_id, created_at
  ) values (
    p_version_id, v_doc_uuid, p_document_id, p_version_number, p_version_label, p_storage_path,
    p_file_name, p_mime_type, p_file_size_bytes, p_sha256_hash, v_now, v_actor_name,
    v_actor_org_name, p_change_notes, 'under_review', v_project_id, v_now
  );

  if p_reviewing_agency_codes is not null then
    foreach v_agency_code in array p_reviewing_agency_codes loop
      v_review_id := 'rev-' || p_version_id || '-' || lower(v_agency_code);
      insert into public.document_agency_reviews (
        id, document_version_id, reviewing_org_id, reviewing_org_code, status, review_status, created_at
      ) values (
        v_review_id, p_version_id, 'org-' || lower(v_agency_code), v_agency_code, 'under_review', 'under_review', v_now
      );
      v_reviews := v_reviews || jsonb_build_object('id', v_review_id, 'documentVersionId', p_version_id, 'reviewingOrgCode', v_agency_code, 'reviewStatus', 'under_review', 'status', 'under_review');
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

  return jsonb_build_object('id', p_version_id, 'documentId', p_document_id, 'versionNumber', p_version_number, 'versionLabel', p_version_label, 'storagePath', p_storage_path, 'fileName', p_file_name, 'mimeType', p_mime_type, 'fileSizeBytes', p_file_size_bytes, 'sha256Hash', p_sha256_hash, 'uploadedAt', v_now, 'uploadedByName', v_actor_name, 'uploadedByOrgName', v_actor_org_name, 'changeNotes', p_change_notes, 'status', 'under_review', 'agencyReviews', v_reviews);
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
  v_review record;
  v_all_approved boolean;
  v_project_id uuid;
  v_actor_name text;
begin
  if auth.uid() is null then raise exception 'authenticated user required'; end if;
  if p_decision not in ('approved', 'approved_with_conditions', 'revision_requested', 'rejected') then
    raise exception 'unsupported document review decision: %', p_decision;
  end if;
  select project_id into v_project_id from public.document_versions where id = p_version_id;
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
  v_actor_name := coalesce((select up.full_name from public.user_profiles up where up.user_id = (select auth.uid()) limit 1), nullif(trim(p_actor_name), ''), 'Authenticated user');

  update public.document_agency_reviews
  set status = p_decision,
      review_status = case when p_decision = 'revision_requested' then 'revisions_requested' else p_decision end,
      reviewed_by_user_id = (select auth.uid()),
      reviewed_by_user_name = v_actor_name,
      reviewed_at = v_now,
      decision_date = v_today,
      comments = p_comments,
      review_comments = p_comments
  where document_version_id = p_version_id and upper(reviewing_org_code) = upper(p_agency_code)
  returning * into v_review;
  if not found then raise exception 'document review assignment not found for agency %', p_agency_code; end if;

  select bool_and(status in ('approved', 'approved_with_conditions')) into v_all_approved
  from public.document_agency_reviews where document_version_id = p_version_id;
  if coalesce(v_all_approved, false) then
    update public.document_versions set status = 'approved' where id = p_version_id;
  elsif p_decision = 'revision_requested' then
    update public.document_versions set status = 'superseded' where id = p_version_id;
  end if;

  insert into public.audit_events (id, correlation_id, actor_id, action, resource_type, entity_type, entity_id, actor_name, actor_org_name, action_type, new_value, reason, created_at)
  values (gen_random_uuid(), gen_random_uuid(), (select auth.uid()), 'agency_signoff', 'document_agency_review', 'document_agency_review', v_review.id, v_actor_name, p_agency_code, 'agency_signoff', p_agency_code || ' signed off as ' || p_decision, p_comments, v_now);
  return to_jsonb(v_review);
end;
$$;

-- SECURITY DEFINER functions should be callable only by authenticated clients;
-- anonymous callers must not inherit PUBLIC EXECUTE.
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
