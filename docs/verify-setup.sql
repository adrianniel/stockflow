-- Post-migration verification.
--
-- Paste into the Supabase SQL editor after applying the migrations. Every row
-- returned should read PASS. Anything marked FAIL is a step that has not been
-- applied yet, and the app will misbehave in the way named in the `consequence`
-- column until it is.
--
-- Unlike a migration log, this checks the schema itself, so it tells the truth
-- regardless of which files were applied, in what order, or how many times.
--
-- Safe to run at any time: this only reads catalog tables, and changes nothing.

WITH
-- Every column the application reads or writes (lib/shop/queries.ts,
-- lib/shop/reports.ts, lib/shop/actions.ts, lib/shop/team-actions.ts,
-- lib/admin/queries.ts, lib/admin/actions.ts, lib/supabase/auth.server.ts).
--
-- A missing column fails at PostgREST plan time with HTTP 400 / SQLSTATE 42703,
-- which is exactly the "Something went wrong" the OWNER dashboard, Sales, and
-- Reports pages showed when sales.amount_paid was absent. One check per column
-- means that class of failure can no longer slip past verification.
required_columns(table_name, column_name, migration, consequence) AS (
    VALUES
        -- Baseline schema (20260801120000)
        ('shops',            'id',                   'baseline',     'apply 20260801120000 (baseline)'),
        ('shops',            'shop_name',            'baseline',     'apply 20260801120000 (baseline)'),
        ('shops',            'owner_name',           'baseline',     'apply 20260801120000 (baseline)'),
        ('shops',            'status',               'baseline',     'apply 20260801120000 (baseline)'),
        ('shops',            'created_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('shops',            'updated_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('users',            'id',                   'baseline',     'apply 20260801120000 (baseline)'),
        ('users',            'auth_id',              'baseline',     'apply 20260801120000 (baseline)'),
        ('users',            'shop_id',              'baseline',     'apply 20260801120000 (baseline)'),
        ('users',            'name',                 'baseline',     'apply 20260801120000 (baseline)'),
        ('users',            'role',                 'baseline',     'apply 20260801120000 (baseline)'),
        ('users',            'created_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('users',            'updated_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('categories',       'id',                   'baseline',     'apply 20260801120000 (baseline)'),
        ('categories',       'shop_id',              'baseline',     'apply 20260801120000 (baseline)'),
        ('categories',       'name',                 'baseline',     'apply 20260801120000 (baseline)'),
        ('categories',       'created_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('products',         'id',                   'baseline',     'apply 20260801120000 (baseline)'),
        ('products',         'shop_id',              'baseline',     'apply 20260801120000 (baseline)'),
        ('products',         'category_id',          'baseline',     'apply 20260801120000 (baseline)'),
        ('products',         'product_name',         'baseline',     'apply 20260801120000 (baseline)'),
        ('products',         'brand',                'baseline',     'apply 20260801120000 (baseline)'),
        ('products',         'description',          'baseline',     'apply 20260801120000 (baseline)'),
        ('products',         'created_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'id',                   'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'product_id',           'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'batch_number',         'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'quantity_received',    'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'quantity_remaining',   'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'capital_price',        'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'interest_percentage',  'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'selling_price',        'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'received_date',        'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_batches',    'created_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('sales',            'id',                   'baseline',     'apply 20260801120000 (baseline)'),
        ('sales',            'shop_id',              'baseline',     'apply 20260801120000 (baseline)'),
        ('sales',            'sold_by',              'baseline',     'apply 20260801120000 (baseline)'),
        ('sales',            'total_amount',         'baseline',     'apply 20260801120000 (baseline)'),
        ('sales',            'total_profit',         'baseline',     'apply 20260801120000 (baseline)'),
        ('sales',            'payment_status',       'baseline',     'apply 20260801120000 (baseline)'),
        ('sales',            'sale_date',            'baseline',     'apply 20260801120000 (baseline)'),
        ('sales',            'created_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'id',                   'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'sale_id',              'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'stock_batch_id',       'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'quantity',             'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'capital_price',        'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'suggested_price',      'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'actual_selling_price', 'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'profit',               'baseline',     'apply 20260801120000 (baseline)'),
        ('sale_items',       'created_at',           'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_adjustments','id',                   'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_adjustments','shop_id',              'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_adjustments','stock_batch_id',       'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_adjustments','quantity_change',      'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_adjustments','reason',               'baseline',     'apply 20260801120000 (baseline)'),
        ('stock_adjustments','created_at',           'baseline',     'apply 20260801120000 (baseline)'),

        -- 20260801120200 — discounts and partial payments
        ('sales',            'amount_paid',          '20260801120200', 'OWNER dashboard, Sales, Reports error 42703; recording a sale fails'),

        -- 20260801120500 — per-shop default interest
        ('shops',            'default_interest_percentage', '20260801120500', 'Stock arrival form cannot prefill the markup'),

        -- 20260801120700 — account provisioning
        ('users',            'status',               '20260801120700', 'Every login fails: requireSession() selects this'),
        ('users',            'email',                '20260801120700', 'Assistants and Users pages error')
),

checks AS (
    -- One row per column the app reads --------------------------------------
    SELECT
        'column: ' || rc.table_name || '.' || rc.column_name AS check_name,
        EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = rc.table_name
              AND c.column_name = rc.column_name
        ) AS ok,
        rc.migration || ' — ' || rc.consequence AS breaks_if_missing
    FROM required_columns rc

    UNION ALL SELECT
        'function: record_sale exists',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'record_sale'
        ),
        '20260801120600 — recording a sale fails (a missing column inside the body is NOT caught at CREATE time, so existence alone is not proof it works — check sales.amount_paid above)'

    UNION ALL SELECT
        'function: get_user_shop_id / get_user_role / is_super_admin exist',
        (
            SELECT count(*) = 3
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN ('get_user_shop_id', 'get_user_role', 'is_super_admin')
        ),
        'apply 20260801120000 (baseline) — every RLS policy calls these'

    UNION ALL SELECT
        'security: helpers pin search_path (20260801120100)',
        (
            SELECT count(*) = 3
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            CROSS JOIN LATERAL unnest(p.proconfig) cfg
            WHERE n.nspname = 'public'
              AND p.proname IN ('get_user_shop_id', 'get_user_role', 'is_super_admin')
              AND cfg LIKE 'search_path=%'
        ),
        'apply 20260801120100 — unpinned SECURITY DEFINER helpers can be shadowed'

    UNION ALL SELECT
        'constraint: sales.amount_paid within total (20260801120200)',
        EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.sales'::regclass
              AND conname = 'sales_amount_paid_check'
        ),
        'apply 20260801120200 — partial payments can exceed the total'

    UNION ALL SELECT
        'constraint: payment_status matches amount_paid (20260801120200)',
        EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.sales'::regclass
              AND conname = 'sales_payment_status_amount_check'
        ),
        'apply 20260801120200 — PAID/CREDIT/PARTIAL can drift out of sync with amount_paid'

    UNION ALL SELECT
        'constraint: sale_items.profit may be negative (20260801120200)',
        NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.sale_items'::regclass
              AND conname = 'sale_items_profit_check'
        ),
        'apply 20260801120200 — a discount below capital price is refused by the database (SRS 10)'

    UNION ALL SELECT
        'constraint: stock_batches.remaining <= received (20260801120300)',
        EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.stock_batches'::regclass
              AND conname = 'stock_batches_remaining_within_received'
        ),
        'apply 20260801120300 — a batch can report more stock than ever arrived'

    UNION ALL SELECT
        'index: users.auth_id unique (20260801120300)',
        EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'users'
              AND indexname = 'users_auth_id_key'
        ),
        'apply 20260801120300 — duplicate profiles for one account make the effective role depend on row order'

    UNION ALL SELECT
        'not null: sales.shop_id required (20260801120300)',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'sales'
              AND column_name = 'shop_id' AND is_nullable = 'NO'
        ),
        'apply 20260801120300 — a NULL shop_id row is invisible to everyone, a silent write'

    UNION ALL SELECT
        'not null: stock_batches.interest_percentage required (20260801120500)',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'stock_batches'
              AND column_name = 'interest_percentage' AND is_nullable = 'NO'
        ),
        'apply 20260801120500 — batches can be priced without a markup rate'

    UNION ALL SELECT
        'policy: business tables not readable by SUPER_ADMIN (20260801120400)',
        NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename IN (
                  'categories', 'products', 'stock_batches',
                  'sales', 'sale_items', 'stock_adjustments'
              )
              AND (qual ILIKE '%is_super_admin%' OR with_check ILIKE '%is_super_admin%')
        ),
        'apply 20260801120400 — SUPER_ADMIN can read every shop''s capital prices and profit margins'

    UNION ALL SELECT
        'policy: shop edits restricted to owner or admin (20260801120500)',
        EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'shops'
              AND policyname = 'Admins and owners can update shops'
        ),
        'apply 20260801120500 — assistants can edit shop settings'

    UNION ALL SELECT
        'trigger: 2-assistant cap (20260801120700)',
        EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'enforce_assistant_limit'
              AND NOT tgisinternal
        ),
        'apply 20260801120700 — a shop could exceed 2 active assistants'

    UNION ALL SELECT
        'trigger: shop status is platform-only (20260801120800)',
        EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'enforce_shop_status_is_platform_only'
              AND NOT tgisinternal
        ),
        'apply 20260801120800 — an owner could deactivate their own shop and lock out their whole team'

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
