-- Run after applying 20260902211835_reconcile_read_policies.sql in staging.
-- These statements are read-only and should return no rows for the failure
-- checks. The policy inventory is intentionally returned for review.

-- 1. Migration ledger: exactly one row should exist for this version.
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE name IN (
  '20260902211835_reconcile_read_policies',
  '20260902212857_revoke_public_security_definer_execution'
)
ORDER BY version;

-- 2. All reconciled public tables must have RLS enabled.
WITH required(table_name) AS (
  VALUES
    ('organizations'), ('projects'), ('permit_types'),
    ('requirement_resources'), ('workflow_definitions'), ('workflow_stages'),
    ('workflow_versions'), ('workflow_version_stages'), ('workstreams'),
    ('tasks'), ('task_dependencies'), ('coordination_requests'), ('rfis'),
    ('rfi_responses'), ('documents'), ('document_versions'),
    ('document_agency_reviews'), ('commitments'), ('decisions'), ('meetings'),
    ('external_filings'), ('project_participants')
)
SELECT required.table_name
FROM required
LEFT JOIN pg_class relation ON relation.relname = required.table_name
  AND relation.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
WHERE relation.oid IS NULL OR relation.relrowsecurity IS NOT TRUE;

-- 3. Anonymous users must have no direct table grants on the reconciled set.
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
  AND table_name IN (
    'organizations', 'projects', 'permit_types', 'requirement_resources',
    'workflow_definitions', 'workflow_stages', 'workflow_versions',
    'workflow_version_stages', 'workstreams', 'tasks', 'task_dependencies',
    'coordination_requests', 'rfis', 'rfi_responses', 'documents',
    'document_versions', 'document_agency_reviews', 'commitments', 'decisions',
    'meetings', 'external_filings', 'project_participants'
  );

-- 4. Review the effective authenticated read policies.
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE '%read_authenticated'
ORDER BY tablename, policyname;

-- 5. Storage grants and effective reconciliation policy.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'storage'
  AND table_name = 'objects'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY policyname;

-- 6. Functions in the private schema must not be executable by PUBLIC.
SELECT routine_schema, routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'app_private'
  AND grantee IN ('PUBLIC', 'anon')
ORDER BY routine_name, grantee;
