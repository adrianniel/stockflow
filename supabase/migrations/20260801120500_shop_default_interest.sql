-- Per-shop default interest percentage.
--
-- The baseline hardcodes 30% as a column default on stock_batches, which means
-- the rate is a property of the database rather than of the business. Shops set
-- their own markup, so the default belongs to the shop and each batch keeps the
-- rate it was actually priced with.
--
-- Two levels, on purpose:
--   * shops.default_interest_percentage — what the receive-stock form
--     pre-fills, editable by the owner in shop settings
--   * stock_batches.interest_percentage — the rate this batch was priced with,
--     never rewritten when the shop default changes later
--
-- That separation is what makes old batches keep their original prices, per the
-- rule that stock prices are never overwritten.

ALTER TABLE public.shops
    ADD COLUMN IF NOT EXISTS default_interest_percentage numeric NOT NULL DEFAULT 30.00;

ALTER TABLE public.shops
    DROP CONSTRAINT IF EXISTS shops_default_interest_percentage_check;

ALTER TABLE public.shops
    ADD CONSTRAINT shops_default_interest_percentage_check
    CHECK (default_interest_percentage >= 0 AND default_interest_percentage <= 1000);

COMMENT ON COLUMN public.shops.default_interest_percentage IS
    'Whole percentage points (30.00 = 30%). Pre-fills the receive-stock form; each batch stores its own rate.';

COMMENT ON COLUMN public.stock_batches.interest_percentage IS
    'Whole percentage points used to price THIS batch. Never updated when the shop default changes.';

-- The batch-level rate is now always supplied by the application from the shop
-- setting, so drop the misleading hardcoded default and require it.
ALTER TABLE public.stock_batches
    ALTER COLUMN interest_percentage DROP DEFAULT;

UPDATE public.stock_batches
   SET interest_percentage = 30.00
 WHERE interest_percentage IS NULL;

ALTER TABLE public.stock_batches
    ALTER COLUMN interest_percentage SET NOT NULL;

-- Now that the column is NOT NULL, the null-tolerant CHECK from
-- 20260801120300 can be tightened.
ALTER TABLE public.stock_batches
    DROP CONSTRAINT IF EXISTS stock_batches_interest_percentage_check;

ALTER TABLE public.stock_batches
    ADD CONSTRAINT stock_batches_interest_percentage_check
    CHECK (interest_percentage >= 0 AND interest_percentage <= 1000);

-- Owners need to change this from shop settings; the baseline only granted
-- UPDATE on shops to `id = get_user_shop_id()`, which already covers it, but
-- that policy also allowed assistants. Restrict shop edits to the owner.
DROP POLICY IF EXISTS "Admins and owners can update shops" ON public.shops;
CREATE POLICY "Admins and owners can update shops" ON public.shops
    FOR UPDATE USING (
        is_super_admin()
        OR (id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );
