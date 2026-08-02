-- Post-migration verification.
--
-- Paste into the Supabase SQL editor after applying the migrations. Every row
-- returned should read PASS. Anything marked FAIL is a step that has not been
-- applied yet, and the app will misbehave in the way named in the `checks`
-- column until it is.
--
-- Safe to run at any time: this only reads catalog tables, and changes nothing.

WITH checks AS (
    SELECT
        'users.status column' AS check_name,
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name = 'status'
        ) AS ok,
        'Every login fails: requireSession() selects this column' AS breaks_if_missing

    UNION ALL SELECT
        'users.email column',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'users'
              AND column_name = 'email'
        ),
        'Assistants and Users pages error'

    UNION ALL SELECT
        'enforce_assistant_limit trigger',
        EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'enforce_assistant_limit'
              AND NOT tgisinternal
        ),
        'A shop could exceed 2 active assistants'

    UNION ALL SELECT
        'enforce_shop_status_is_platform_only trigger',
        EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'enforce_shop_status_is_platform_only'
              AND NOT tgisinternal
        ),
        'An owner could deactivate their own shop and lock out their whole team'

    UNION ALL SELECT
        'record_sale function',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'record_sale'
        ),
        'Recording a sale fails'

    UNION ALL SELECT
        'shops.default_interest_percentage column',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'shops'
              AND column_name = 'default_interest_percentage'
        ),
        'Stock arrival form cannot prefill the markup'

    -- RLS is the whole security model; a table with it switched off is a leak
    -- between shops, not a missing feature.
    UNION ALL SELECT
        'RLS enabled on all 8 tables',
        (
            SELECT count(*) = 8
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename IN (
                  'shops', 'users', 'categories', 'products',
                  'stock_batches', 'sales', 'sale_items', 'stock_adjustments'
              )
              AND rowsecurity
        ),
        'DATA LEAK between shops'
)
SELECT
    CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result,
    check_name,
    CASE WHEN ok THEN '' ELSE breaks_if_missing END AS consequence
FROM checks
ORDER BY ok, check_name;
