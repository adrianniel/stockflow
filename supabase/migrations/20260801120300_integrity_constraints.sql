-- Constraints and indexes the live schema is missing.
--
-- Grouped here because they are all the same kind of fix: things the
-- application currently assumes are true but the database does not enforce, so
-- one bug or one manual edit in the dashboard can create data no code path
-- expects to see.

-- ---------------------------------------------------------------------------
-- users.auth_id
-- ---------------------------------------------------------------------------
-- Every authenticated page load resolves the session by querying
-- users.auth_id, and get_user_shop_id()/get_user_role()/is_super_admin() each
-- do the same on every RLS check. It has no index, so all of that is a
-- sequential scan. It also has no unique constraint, so two profile rows could
-- share one auth account and `LIMIT 1` inside the helpers would pick between
-- them arbitrarily — meaning a user's effective shop and role would depend on
-- physical row order. Unique both fixes the ambiguity and supplies the index.
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_key ON public.users (auth_id);

-- ---------------------------------------------------------------------------
-- FIFO lookup
-- ---------------------------------------------------------------------------
-- The sales path repeatedly asks "oldest batch of this product with stock
-- left". A partial index over only the rows that still have stock keeps the
-- index small as sold-out batches accumulate, and ordering by received_date
-- inside it means the planner can walk it directly instead of sorting.
CREATE INDEX IF NOT EXISTS idx_stock_batches_fifo
    ON public.stock_batches (product_id, received_date, created_at)
    WHERE quantity_remaining > 0;

-- Owner dashboard and reports both filter batches by shop and remaining stock.
CREATE INDEX IF NOT EXISTS idx_stock_batches_shop_available
    ON public.stock_batches (shop_id)
    WHERE quantity_remaining > 0;

CREATE INDEX IF NOT EXISTS idx_categories_shop_id
    ON public.categories (shop_id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_shop_id
    ON public.stock_adjustments (shop_id);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_batch_id
    ON public.stock_adjustments (stock_batch_id);

CREATE INDEX IF NOT EXISTS idx_users_shop_id
    ON public.users (shop_id);

-- ---------------------------------------------------------------------------
-- Quantity sanity
-- ---------------------------------------------------------------------------
-- quantity_remaining is bounded below by the baseline CHECK but not above, so
-- nothing stops a batch from reporting more stock than ever arrived — which
-- would let a shop sell inventory it never received and book imaginary profit.
ALTER TABLE public.stock_batches
    DROP CONSTRAINT IF EXISTS stock_batches_remaining_within_received;

ALTER TABLE public.stock_batches
    ADD CONSTRAINT stock_batches_remaining_within_received
    CHECK (quantity_remaining <= quantity_received);

-- Interest is a percentage of capital price, so a negative value would mean
-- selling below cost by default. Discounts are a per-sale decision instead.
ALTER TABLE public.stock_batches
    DROP CONSTRAINT IF EXISTS stock_batches_interest_percentage_check;

ALTER TABLE public.stock_batches
    ADD CONSTRAINT stock_batches_interest_percentage_check
    CHECK (interest_percentage IS NULL OR interest_percentage >= 0);

-- ---------------------------------------------------------------------------
-- Tenant columns are required
-- ---------------------------------------------------------------------------
-- shop_id is nullable on every business table. A NULL shop_id matches no
-- policy, so such a row is invisible to everyone including its creator — a
-- silent write that appears to succeed and then vanishes. Requiring it makes
-- the failure loud and immediate instead.
--
-- Safe to apply as-is on the current project: shops/products/categories/
-- stock_batches/sales/stock_adjustments are all empty (0 rows), so there is
-- nothing to backfill. If any of these tables has data by the time this runs,
-- assign a shop to the orphaned rows first — the ALTER will fail otherwise,
-- which is the intended outcome rather than something to work around.

ALTER TABLE public.categories        ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.products          ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.stock_batches     ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.sales             ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.stock_adjustments ALTER COLUMN shop_id SET NOT NULL;

-- products.category_id stays nullable on purpose: the FK is ON DELETE SET NULL,
-- so deleting a category leaves its products uncategorised rather than
-- destroying them.

-- stock_batches.product_id and sales.shop_id-adjacent link columns should not
-- be optional either — a batch with no product, or a line item with no sale,
-- is not a meaningful record.
ALTER TABLE public.stock_batches ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE public.sale_items    ALTER COLUMN sale_id    SET NOT NULL;

-- ---------------------------------------------------------------------------
-- Uniqueness within a shop
-- ---------------------------------------------------------------------------
-- Two categories named "Brake Parts" in the same shop are a data-entry mistake,
-- not a feature. Case-insensitive so "brake parts" collides too. Scoped per
-- shop, so different shops are free to use the same names.
CREATE UNIQUE INDEX IF NOT EXISTS categories_shop_name_key
    ON public.categories (shop_id, lower(name));

-- Batch numbers identify a batch to the shop staff, so they must be
-- unambiguous within a product.
CREATE UNIQUE INDEX IF NOT EXISTS stock_batches_product_batch_number_key
    ON public.stock_batches (product_id, lower(batch_number));
