-- Trigger-only security-definer helpers must not be callable by client roles.
-- Keep their execution available to the database trigger owner while removing
-- the default PUBLIC privilege inherited by anon and authenticated callers.
DO $$
DECLARE
  function_record record;
BEGIN
  FOR function_record IN
    SELECT
      namespace.nspname AS schema_name,
      routine.proname AS function_name,
      pg_get_function_identity_arguments(routine.oid) AS identity_arguments
    FROM pg_proc routine
    JOIN pg_namespace namespace ON namespace.oid = routine.pronamespace
    WHERE routine.prosecdef
      AND namespace.nspname = 'app_private'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon',
      function_record.schema_name,
      function_record.function_name,
      function_record.identity_arguments
    );
  END LOOP;
END
$$;
