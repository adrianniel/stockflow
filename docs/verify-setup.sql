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

        -- 20260801122100 — expenses
        ('expenses',         'id',                   '20260801122100', 'Expenses page errors; expense records cannot be stored'),
        ('expenses',         'shop_id',              '20260801122100', 'Expenses could not be isolated by shop'),
        ('expenses',         'expense_date',         '20260801122100', 'Expenses cannot be assigned to their business day'),
        ('expenses',         'name',                 '20260801122100', 'Expense name cannot be recorded'),
        ('expenses',         'amount',               '20260801122100', 'Expense amount cannot be recorded'),
        ('expenses',         'notes',                '20260801122100', 'Expense notes cannot be displayed'),
        ('expenses',         'created_by',           '20260801122100', 'Expense recorder cannot be identified'),
        ('expenses',         'created_at',           '20260801122100', 'Expense creation time is missing'),
        ('expenses',         'updated_at',           '20260801122100', 'Expense edits cannot be timestamped'),
        ('expenses',         'deleted_at',           '20260801122100', 'Expense soft deletion cannot work'),
        ('expenses',         'deleted_by',           '20260801122100', 'Expense deletion history cannot identify its actor'),

        -- 20260801120200 — discounts and partial payments
        ('sales',            'amount_paid',          '20260801120200', 'OWNER dashboard, Sales, Reports error 42703; recording a sale fails'),

        -- 20260801120500 — per-shop default interest
        ('shops',            'default_interest_percentage', '20260801120500', 'Stock arrival form cannot prefill the markup'),

        -- 20260801120700 — account provisioning
        ('users',            'status',               '20260801120700', 'Every login fails: requireSession() selects this'),
        ('users',            'email',                '20260801120700', 'Assistants and Users pages error'),

        -- 20260801120900 — customers
        ('customers',        'id',                   '20260801120900', 'Credit page errors; credit and partial sales cannot be recorded'),
        ('customers',        'shop_id',              '20260801120900', 'Credit page errors; credit and partial sales cannot be recorded'),
        ('customers',        'name',                 '20260801120900', 'Credit page errors; credit and partial sales cannot be recorded'),
        ('customers',        'phone',                '20260801120900', 'Credit page errors'),
        ('customers',        'notes',                '20260801120900', 'Credit page errors'),
        ('sales',            'customer_id',          '20260801120900', 'Sales and Credit pages error 42703; who owes what is unrecorded'),

        -- 20260801121000 — payment ledger
        ('sale_payments',    'id',                   '20260801121000', 'Recording any paid sale fails; collections cannot be logged'),
        ('sale_payments',    'shop_id',              '20260801121000', 'Recording any paid sale fails; collections cannot be logged'),
        ('sale_payments',    'sale_id',              '20260801121000', 'Recording any paid sale fails; collections cannot be logged'),
        ('sale_payments',    'amount',               '20260801121000', 'Recording any paid sale fails; collections cannot be logged'),
        ('sale_payments',    'collected_at',         '20260801121000', 'Payment dates are lost; a Day 2 collection cannot be dated'),
        ('sale_payments',    'collected_by',         '20260801121000', 'Who took the payment is unrecorded'),
        ('sale_payments',    'note',                 '20260801121000', 'Sale detail page errors'),
        ('sale_payments',    'payment_group_id',     '20261023000100', 'Customer-level installments cannot be shown as one payment'),

        -- 20260801121500 — voiding a sale
        ('sales',            'voided_at',            '20260801121500', 'Sales list, sale detail and every report error 42703'),
        ('sales',            'voided_by',            '20260801121500', 'Sales list and sale detail error 42703'),
        ('sales',            'void_reason',          '20260801121500', 'Sales list and sale detail error 42703'),
        ('sale_payments',    'voided_at',            '20260801121500', 'Sale detail errors; a voided sale''s collections keep counting as money taken')
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
        'constraint: payment_status NOT constrained to amount_paid (20260801121100)',
        NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.sales'::regclass
              AND conname = 'sales_payment_status_amount_check'
        ),
        'apply 20260801121100 — this FAIL means the OLD constraint is still present and the ledger migration has not fully applied (the recompute trigger check above will also FAIL)'

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
                  'sales', 'sale_items', 'stock_adjustments', 'expenses'
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
        'policy: stock batches cannot be deleted (20260801121800)',
        NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'stock_batches'
              AND cmd = 'DELETE'
        ),
        'apply 20260801121800 — deleting a sold-out batch removes historical inventory evidence'

    UNION ALL SELECT
        'trigger: products with batch history cannot be deleted (20260801121800)',
        EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgrelid = 'public.products'::regclass
              AND tgname = 'prevent_product_delete_with_batches'
              AND NOT tgisinternal
        ),
        'apply 20260801121800 — product deletion would cascade historical stock batches'

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

    UNION ALL SELECT
        'trigger: sales.amount_paid derived from ledger (20260801121100)',
        EXISTS (
            SELECT 1 FROM pg_trigger
            -- to_regclass, not a ::regclass cast: the cast raises when the
            -- table is absent, which would abort the whole script instead of
            -- reporting one FAIL. This returns NULL and the row just fails.
            WHERE tgrelid = to_regclass('public.sale_payments')
              AND tgname = 'sale_payments_recompute'
        ),
        'apply 20260801121100 — amount_paid and payment_status stop tracking the payments actually taken, so balances owed are wrong'

    UNION ALL SELECT
        'function: record_payment exists (20260801121200)',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'record_payment'
        ),
        'apply 20260801121200 — collecting on a credit sale fails'

    UNION ALL SELECT
        'function: record_customer_payment groups FIFO allocations (20261023000100)',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'record_customer_payment'
              AND p.prosrc LIKE '%payment_group_id%'
              AND p.prosrc LIKE '%ORDER BY s.sale_date%'
        ),
        'apply 20261023000100 before deploying the consolidated customer credit UI'

    UNION ALL SELECT
        'index: batch reference NOT unique per product (20260801121300)',
        NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = 'stock_batches'
              AND indexname = 'stock_batches_product_batch_number_key'
        ),
        'apply 20260801121300 — two arrivals of one product on the same day are refused with 23505'

    -- The one check that cannot be inferred from shape. Migration 022 keeps the
    -- signature, so record_sale() looks identical from outside — and the old
    -- body ignores an unknown JSON key rather than erroring. A till that names a
    -- batch would silently have its choice discarded and FIFO stock deducted
    -- instead: a different batch, a different capital price, a different profit,
    -- no error anywhere. So the body itself is inspected.
    UNION ALL SELECT
        'function: record_sale honours an explicit batch (20260801121400)',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'record_sale'
              -- The jsonb read specifically, not the bare column name: the old
              -- body also contains "stock_batch_id", in the sale_items INSERT,
              -- so matching that alone would pass on the unpatched function.
              AND p.prosrc LIKE '%->>''stock_batch_id''%'
        ),
        'apply 20260801121400 BEFORE deploying the app — the till''s batch choice is silently ignored and FIFO stock is deducted at the wrong capital price, with no error'

    -- Migration 023 -----------------------------------------------------------
    UNION ALL SELECT
        'function: void_sale exists (20260801121500)',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'void_sale'
        ),
        'apply 20260801121500 — voiding a sale fails with PGRST202 (function not found)'

    UNION ALL SELECT
        'column: sales.replaces_sale_id (20260801121600)',
        EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'sales'
              AND column_name = 'replaces_sale_id'
        ),
        'apply 20260801121600 — amended sales cannot link back to the original'

    UNION ALL SELECT
        'function: amend_sale exists (20260801121600)',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'amend_sale'
        ),
        'apply 20260801121600 — amending a sale fails with PGRST202 (function not found)'

    UNION ALL SELECT
        'function: record_payment preserves received timestamp (20260801121700)',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'record_payment'
              AND p.prosrc LIKE '%v_collected_at := COALESCE(p_collected_at, now())%'
              AND p.prosrc LIKE '%cannot be in the future%'
        ),
        'apply 20260801121700 — payment dates are not validated by the database'

    UNION ALL SELECT
        'trigger: payment received time cannot be future (20260801121700)',
        EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgrelid = 'public.sale_payments'::regclass
              AND tgname = 'sale_payments_validate_collected_at'
              AND NOT tgisinternal
        ),
        'apply 20260801121700 — a direct ledger write could put a payment in a future report'

    UNION ALL SELECT
        'index: one replacement per original sale (20260801121600)',
        EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'sales'
              AND indexname = 'sales_one_replacement_per_sale'
        ),
        'apply 20260801121600 — one original sale could be amended more than once'

    UNION ALL SELECT
        'trigger: replacement links stay within the shop (20260801121600)',
        EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgrelid = 'public.sales'::regclass
              AND tgname = 'validate_sale_replacement_link'
              AND NOT tgisinternal
        ),
        'apply 20260801121600 — a replacement link could point at another shop''s sale'

    -- The app spells its seller embed `users!sales_sold_by_fkey`, because
    -- sales now has two foreign keys to users and a bare `users ( name )` is
    -- ambiguous. If this constraint were ever recreated under a generated name,
    -- every sales select would fail at runtime with PGRST201 — invisible to
    -- typecheck, lint and build.
    UNION ALL SELECT
        'constraint: sales_sold_by_fkey named as the app''s embeds expect',
        EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.sales'::regclass
              AND conname = 'sales_sold_by_fkey'
              AND contype = 'f'
        ),
        'the seller name embed in lib/shop/queries.ts and lib/shop/reports.ts fails with PGRST201; rename the constraint back to sales_sold_by_fkey'

    UNION ALL SELECT
        'constraint: a void must carry a reason (20260801121500)',
        EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'public.sales'::regclass
              AND conname = 'sales_void_reason_required'
        ),
        'apply 20260801121500 — a sale could be voided with no explanation of why'

    -- Two CREATE OR REPLACE bodies with unchanged signatures. Nothing about
    -- their shape differs before and after, so — as with record_sale in 022 —
    -- the body itself is the only evidence the migration ran.
    UNION ALL SELECT
        'function: payment ledger skips voided payments (20260801121500)',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'recompute_sale_payment_state'
              AND p.prosrc LIKE '%voided_at IS NULL%'
        ),
        'apply 20260801121500 — a voided sale keeps its amount_paid, so its collections still count as money taken and customer balances are wrong'

    UNION ALL SELECT
        'function: record_payment refuses a voided sale (20260801121500)',
        EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'record_payment'
              AND p.prosrc LIKE '%v_voided_at IS NOT NULL%'
        ),
        'apply 20260801121500 — a voided credit sale still looks collectable (amount_paid 0, status CREDIT) and money can be taken against it'

    -- RLS is the whole security model; a table with it switched off is a leak
    -- between shops, not a missing feature.
    UNION ALL SELECT
        'RLS enabled on all 11 tables',
        (
            SELECT count(*) = 11
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename IN (
                  'shops', 'users', 'categories', 'products',
                   'stock_batches', 'sales', 'sale_items', 'stock_adjustments',
                   'customers', 'sale_payments', 'expenses'
              )
              AND rowsecurity
        ),
        'DATA LEAK between shops — unless a customers/sale_payments column above also FAILs, in which case the table is simply absent and that migration is the fix'
)
SELECT
    CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS result,
    check_name,
    CASE WHEN ok THEN '' ELSE breaks_if_missing END AS consequence
FROM checks
ORDER BY ok, check_name;
