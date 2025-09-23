-- Wipe public schema objects safely without dropping the schema itself
-- Note: We DO NOT drop schema "public" to keep exec_sql and permissions intact

DO $$
DECLARE r RECORD;
BEGIN
  -- Drop all foreign tables/views/materialized views first to reduce dependencies
  FOR r IN (
    SELECT schemaname, viewname FROM pg_views WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.viewname);
  END LOOP;

  FOR r IN (
    SELECT schemaname, matviewname FROM pg_matviews WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE', r.schemaname, r.matviewname);
  END LOOP;

  -- Drop all tables in public
  FOR r IN (
    SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', r.schemaname, r.tablename);
  END LOOP;

  -- Drop sequences (owned by dropped tables should already be removed, but ensure cleanup)
  FOR r IN (
    SELECT sequence_schema AS schemaname, sequence_name AS relname
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  ) LOOP
    EXECUTE format('DROP SEQUENCE IF EXISTS %I.%I CASCADE', r.schemaname, r.relname);
  END LOOP;

  -- Optionally drop types created in public (skip common/extension types)
  -- We only drop user-defined types in public
  FOR r IN (
    SELECT n.nspname AS schemaname, t.typname AS typename
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e','c') -- enum or composite
  ) LOOP
    EXECUTE format('DROP TYPE IF EXISTS %I.%I CASCADE', r.schemaname, r.typename);
  END LOOP;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';


