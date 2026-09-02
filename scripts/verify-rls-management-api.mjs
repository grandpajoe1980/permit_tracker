import fs from "node:fs";

function readEnvFile(path = ".env") {
  if (!fs.existsSync(path)) return {};
  return Object.fromEntries(
    fs.readFileSync(path, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        if (separator < 0) return [line.trim(), ""];
        return [
          line.slice(0, separator).trim(),
          line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2"),
        ];
      }),
  );
}

const env = { ...readEnvFile(), ...process.env };
const token = env.token || env.SUPABASE_ACCESS_TOKEN;
const rawUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
if (!token || !rawUrl) throw new Error("A Supabase management token and project URL are required.");

const projectRef = new URL(rawUrl).host.split(".")[0];
const requiredTables = [
  "organizations", "projects", "permit_types", "requirement_resources",
  "workflow_definitions", "workflow_stages", "workflow_versions",
  "workflow_version_stages", "workstreams", "tasks", "task_dependencies",
  "coordination_requests", "rfis", "rfi_responses", "documents",
  "document_versions", "document_agency_reviews", "commitments", "decisions",
  "meetings", "external_filings", "project_participants",
];
const tableSql = requiredTables.map((table) => `('${table}')`).join(", ");
const query = `
WITH required(table_name) AS (VALUES ${tableSql})
SELECT json_build_object(
  'migrationApplied', EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE name = '20260902211835_reconcile_read_policies'
  ),
  'securityDefinerPrivilegeMigrationApplied', EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE name = '20260902212857_revoke_public_security_definer_execution'
  ),
  'migrationVersions', COALESCE((
    SELECT json_agg(json_build_object('version', version, 'name', name) ORDER BY version)
    FROM supabase_migrations.schema_migrations
    WHERE name IN (
      '20260902211835_reconcile_read_policies',
      '20260902212857_revoke_public_security_definer_execution'
    )
  ), '[]'::json),
  'rlsMissing', COALESCE((
    SELECT json_agg(required.table_name ORDER BY required.table_name)
    FROM required
    LEFT JOIN pg_class relation
      ON relation.relname = required.table_name
      AND relation.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    WHERE relation.oid IS NULL OR relation.relrowsecurity IS NOT TRUE
  ), '[]'::json),
  'anonymousPublicGrants', COALESCE((
    SELECT json_agg(json_build_object('table', table_name, 'privilege', privilege_type) ORDER BY table_name, privilege_type)
    FROM information_schema.role_table_grants
    WHERE grantee = 'anon' AND table_schema = 'public' AND table_name IN (SELECT table_name FROM required)
  ), '[]'::json),
  'authenticatedReadPolicies', (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE '%read_authenticated'
  ),
  'storageAnonymousGrants', COALESCE((
    SELECT json_agg(json_build_object('privilege', privilege_type) ORDER BY privilege_type)
    FROM information_schema.role_table_grants
    WHERE grantee = 'anon' AND table_schema = 'storage' AND table_name = 'objects'
  ), '[]'::json),
  'storageUpdatePolicy', EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'path_documents_update_authenticated'
  ),
  'securityDefinerPublicOrAnonymousExecute', COALESCE((
    SELECT json_agg(json_build_object(
      'schema', namespace.nspname,
      'function', routine.proname,
      'identityArguments', pg_get_function_identity_arguments(routine.oid),
      'publicExecute', has_function_privilege('public', routine.oid, 'EXECUTE'),
      'anonymousExecute', has_function_privilege('anon', routine.oid, 'EXECUTE')
    ) ORDER BY namespace.nspname, routine.proname)
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE routine.prosecdef
      AND namespace.nspname IN ('public', 'app_private')
      AND (has_function_privilege('public', routine.oid, 'EXECUTE')
        OR has_function_privilege('anon', routine.oid, 'EXECUTE'))
  ), '[]'::json
  )
) AS verification;
`;

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "PATH-rls-verification/1.0",
  },
  body: JSON.stringify({ query, read_only: true }),
});
const responseText = await response.text();
if (!response.ok) throw new Error(`Supabase management query failed (${response.status}): ${responseText.slice(0, 500)}`);

console.log(JSON.stringify({ projectRef, verification: JSON.parse(responseText) }));
