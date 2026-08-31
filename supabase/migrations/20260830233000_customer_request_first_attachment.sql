-- Wave 2: create a customer's first attachment and request in one database
-- transaction. Storage is uploaded by the client first; a failed RPC causes
-- the client to remove that object, while this function prevents a request
-- from pointing at a document parent/version that was only partially saved.

create or replace function public.rpc_create_customer_request_with_document(
  p_request jsonb,
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  v_actor_id uuid := auth.uid();
  v_project_id uuid;
  v_project_ref text;
  v_document_id uuid;
  v_version_id text;
  v_storage_path text;
  v_owner_organization_id uuid;
  v_request jsonb;
begin
  if v_actor_id is null then
    raise exception 'authentication is required to create a customer request';
  end if;
  if jsonb_typeof(p_request) <> 'object' or jsonb_typeof(p_document) <> 'object' then
    raise exception 'request and document payloads must be JSON objects';
  end if;

  -- The request ID is the idempotency key for the whole combined operation.
  -- Return the canonical request before creating another document parent when
  -- a client retries after the first transaction committed successfully.
  if nullif(trim(p_request ->> 'id'), '') is not null
     and exists (select 1 from public.customer_requests where id = p_request ->> 'id') then
    v_request := public.rpc_create_customer_request(
      p_id => p_request ->> 'id',
      p_confirmation_number => p_request ->> 'confirmationNumber',
      p_project_id => p_request ->> 'projectId',
      p_request_type => p_request ->> 'requestType',
      p_title => p_request ->> 'title',
      p_description => p_request ->> 'description',
      p_requested_outcome => p_request ->> 'requestedOutcome',
      p_location_or_affected_area => p_request ->> 'locationOrAffectedArea',
      p_desired_date => nullif(p_request ->> 'desiredDate', '')::date,
      p_schedule_importance => coalesce(nullif(p_request ->> 'scheduleImportance', ''), 'normal'),
      p_known_agency_code => p_request ->> 'knownAgencyCode',
      p_known_permit_type_id => p_request ->> 'knownPermitTypeId',
      p_submitted_by_user_id => v_actor_id,
      p_submitted_by_name => p_request ->> 'submittedByName',
      p_related_workstream_id => p_request ->> 'relatedWorkstreamId',
      p_blocks_active_work => coalesce((p_request ->> 'blocksActiveWork')::boolean, false),
      p_status => coalesce(nullif(p_request ->> 'status', ''), 'submitted'),
      p_attachment_document_version_ids => '[]'::jsonb
    );
    return v_request;
  end if;

  begin
    v_document_id := (p_document ->> 'documentId')::uuid;
  exception when invalid_text_representation then
    raise exception 'documentId must be a UUID';
  end;
  v_storage_path := p_document ->> 'storagePath';
  if v_storage_path is null or left(v_storage_path, length(v_document_id::text || '/v1/')) <> v_document_id::text || '/v1/' then
    raise exception 'document storage path does not match the document and version';
  end if;
  if coalesce((p_document ->> 'sha256Hash') !~ '^[0-9a-fA-F]{64}$', true) then
    raise exception 'document SHA-256 hash is invalid';
  end if;
  if coalesce((p_document ->> 'fileSizeBytes')::bigint, -1) < 0 then
    raise exception 'document file size is invalid';
  end if;

  select p.id, p.id::text, p.lead_organization_id
    into v_project_id, v_project_ref, v_owner_organization_id
  from public.projects p
  where p.id::text = p_request ->> 'projectId' or p.number = p_request ->> 'projectId'
  limit 1;
  if v_project_id is null then
    raise exception 'project not found: %', p_request ->> 'projectId';
  end if;
  if not (select app_private.has_project_access(v_project_id)) then
    raise exception 'authenticated user cannot access project %', p_request ->> 'projectId';
  end if;

  v_version_id := coalesce(nullif(p_document ->> 'versionId', ''), 'doc-v-' || replace(v_document_id::text, '-', ''));

  insert into public.documents (
    id, project_id, owner_organization_id, storage_path, document_type,
    visibility, version, scan_status, retention_category, created_by
  )
  values (
    v_document_id, v_project_id, v_owner_organization_id, v_storage_path,
    coalesce(nullif(p_document ->> 'documentType', ''), 'customer_attachment'),
    'customer', 1, 'pending', 'project_delivery', v_actor_id
  );

  insert into public.document_versions (
    id, document_id, document_ref_id, version_number, version_label,
    storage_path, storage_uri, file_name, mime_type, file_size_bytes,
    sha256_hash, uploaded_at, uploaded_by_name, uploaded_by_org_name,
    change_notes, status, project_id, created_at
  )
  values (
    v_version_id, v_document_id, v_document_id::text, 1,
    coalesce(nullif(p_document ->> 'versionLabel', ''), 'v1.0'),
    v_storage_path, v_storage_path, p_document ->> 'fileName',
    coalesce(nullif(p_document ->> 'mimeType', ''), 'application/octet-stream'),
    (p_document ->> 'fileSizeBytes')::bigint, lower(p_document ->> 'sha256Hash'),
    now(), coalesce(nullif(p_document ->> 'uploadedByName', ''), 'Authenticated user'),
    coalesce(nullif(p_document ->> 'uploadedByOrgName', ''), 'Customer'),
    coalesce(p_document ->> 'changeNotes', ''), 'under_review', v_project_id, now()
  );

  v_request := public.rpc_create_customer_request(
    p_id => p_request ->> 'id',
    p_confirmation_number => p_request ->> 'confirmationNumber',
    p_project_id => v_project_ref,
    p_request_type => p_request ->> 'requestType',
    p_title => p_request ->> 'title',
    p_description => p_request ->> 'description',
    p_requested_outcome => p_request ->> 'requestedOutcome',
    p_location_or_affected_area => p_request ->> 'locationOrAffectedArea',
    p_desired_date => nullif(p_request ->> 'desiredDate', '')::date,
    p_schedule_importance => coalesce(nullif(p_request ->> 'scheduleImportance', ''), 'normal'),
    p_known_agency_code => p_request ->> 'knownAgencyCode',
    p_known_permit_type_id => p_request ->> 'knownPermitTypeId',
    p_submitted_by_user_id => v_actor_id,
    p_submitted_by_name => p_request ->> 'submittedByName',
    p_related_workstream_id => p_request ->> 'relatedWorkstreamId',
    p_blocks_active_work => coalesce((p_request ->> 'blocksActiveWork')::boolean, false),
    p_status => coalesce(nullif(p_request ->> 'status', ''), 'submitted'),
    p_attachment_document_version_ids => jsonb_build_array(v_version_id)
  );

  return v_request;
end;
$$;

revoke execute on function public.rpc_create_customer_request_with_document(jsonb, jsonb) from public, anon;
grant execute on function public.rpc_create_customer_request_with_document(jsonb, jsonb) to authenticated;
