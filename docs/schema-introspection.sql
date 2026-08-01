-- StockFlow — live schema snapshot (READ-ONLY)
--
-- Paste this whole file into the Supabase SQL Editor and run it.
-- It returns ONE row / ONE column of pretty-printed JSON. Click the cell,
-- copy it, and paste it back into the conversation.
--
-- This only reads catalog metadata. It changes nothing and touches no
-- business data. Safe to re-run any time you want a schema snapshot.

SELECT jsonb_pretty(jsonb_build_object(

  -- Which UUID generator is available (uuid-ossp vs pgcrypto/native).
  'extensions', (
    SELECT jsonb_agg(jsonb_build_object('name', e.extname, 'schema', n.nspname) ORDER BY e.extname)
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
  ),

  -- Confirms RLS is actually ON for all 8 tables, not just documented.
  'tables_rls', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity
    ) ORDER BY c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),

  -- NOT NULL + DEFAULT for every column (findings #7, #14).
  'columns', (
    SELECT jsonb_agg(jsonb_build_object(
      't', table_name,
      'col', column_name,
      'type', data_type,
      'nullable', is_nullable,
      'default', column_default
    ) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public'
  ),

  -- PK / FK / UNIQUE / CHECK with full definitions, including ON DELETE
  -- behaviour (findings #1, #6, #7, #10). contype: p=pk f=fk u=unique c=check
  'constraints', (
    SELECT jsonb_agg(jsonb_build_object(
      't', rel.relname,
      'name', con.conname,
      'kind', con.contype,
      'def', pg_get_constraintdef(con.oid)
    ) ORDER BY rel.relname, con.conname)
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public'
  ),

  -- Every index (findings #9: FIFO composite, users.auth_id).
  'indexes', (
    SELECT jsonb_agg(jsonb_build_object(
      't', tablename,
      'name', indexname,
      'def', indexdef
    ) ORDER BY tablename, indexname)
    FROM pg_indexes
    WHERE schemaname = 'public'
  ),

  -- The actual RLS policy bodies. This is the critical one: it shows whether
  -- sale_items is isolated by joining through sales (finding #3) and what
  -- SUPER_ADMIN is currently allowed to read on business tables.
  'policies', (
    SELECT jsonb_agg(jsonb_build_object(
      't', tablename,
      'name', policyname,
      'cmd', cmd,
      'permissive', permissive,
      'roles', roles,
      'using', qual,
      'with_check', with_check
    ) ORDER BY tablename, policyname)
    FROM pg_policies
    WHERE schemaname = 'public'
  ),

  -- Functions with security context (finding #2): prosecdef = true means
  -- SECURITY DEFINER; proconfig should contain search_path=.
  'functions', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'returns', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef,
      'config', p.proconfig,
      'volatility', p.provolatile,
      'source', pg_get_functiondef(p.oid)
    ) ORDER BY p.proname)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ),

  -- Triggers (finding #12: is the 2-assistant limit enforced anywhere?).
  'triggers', (
    SELECT jsonb_agg(jsonb_build_object(
      't', rel.relname,
      'name', tg.tgname,
      'def', pg_get_triggerdef(tg.oid)
    ) ORDER BY rel.relname, tg.tgname)
    FROM pg_trigger tg
    JOIN pg_class rel ON rel.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE n.nspname = 'public' AND NOT tg.tgisinternal
  ),

  -- Row counts, so I know whether any migration has to preserve real data.
  'row_counts', (
    SELECT jsonb_object_agg(relname, n_live_tup)
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  ),

  -- Custom enum types, if roles/status are enums rather than text + CHECK.
  'enums', (
    SELECT jsonb_object_agg(t.typname, labels)
    FROM (
      SELECT t.typname, jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
    ) t
  )

)) AS schema_snapshot;
