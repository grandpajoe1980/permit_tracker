-- Serialize document version creation so two concurrent uploads cannot claim
-- the same version number after observing the same previous max.

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
  limit 1
  for update;
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

revoke execute on function public.rpc_create_document_version(text,text,integer,text,text,text,text,bigint,text,text,text,text,text[],uuid,uuid) from public, anon;
grant execute on function public.rpc_create_document_version(text,text,integer,text,text,text,text,bigint,text,text,text,text,text[],uuid,uuid) to authenticated, service_role;
