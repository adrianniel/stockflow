-- Restrict SUPER_ADMIN to platform administration only.
--
-- SRS 5.1 is explicit that the platform administrator manages shops and user
-- accounts and "cannot access business data". The deployed policies contradict
-- that: every business table carries `OR is_super_admin()` on SELECT, and an
-- `is_super_admin() OR ...` bypass on INSERT/UPDATE/DELETE. As deployed, the
-- platform operator can read and edit every shop's purchase prices, margins,
-- and sales history.
--
-- That is a privacy problem rather than a bug in the ordinary sense. These are
-- independent businesses whose capital prices and profit margins are
-- commercially sensitive, and nothing in the product requires the operator to
-- see them. Removing the access also shrinks the damage a compromised admin
-- account can do: it can disable a shop, but it cannot exfiltrate what every
-- shop pays its suppliers.
--
-- What SUPER_ADMIN keeps:
--   * full read/write on `shops` and `users` — that is the actual job
--   * aggregate counts, because COUNT(*) over zero visible rows is still 0 and
--     the admin dashboard only counts shops and users
--
-- What it loses: every row of categories, products, stock_batches, sales,
-- sale_items, stock_adjustments.
--
-- Consequence to be aware of: a SUPER_ADMIN who is also meant to operate a shop
-- needs a second account with role OWNER. The roles are deliberately not
-- additive.

-- categories --------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop categories" ON public.categories;
CREATE POLICY "Users can view own shop categories" ON public.categories
    FOR SELECT USING (shop_id = get_user_shop_id());

DROP POLICY IF EXISTS "Owners and admins can create categories" ON public.categories;
CREATE POLICY "Owners can create categories" ON public.categories
    FOR INSERT WITH CHECK (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners and admins can update categories" ON public.categories;
CREATE POLICY "Owners can update categories" ON public.categories
    FOR UPDATE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners and admins can delete categories" ON public.categories;
CREATE POLICY "Owners can delete categories" ON public.categories
    FOR DELETE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

-- products ----------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop products" ON public.products;
CREATE POLICY "Users can view own shop products" ON public.products
    FOR SELECT USING (shop_id = get_user_shop_id());

DROP POLICY IF EXISTS "Owners and admins can create products" ON public.products;
CREATE POLICY "Owners can create products" ON public.products
    FOR INSERT WITH CHECK (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners and admins can update products" ON public.products;
CREATE POLICY "Owners can update products" ON public.products
    FOR UPDATE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners and admins can delete products" ON public.products;
CREATE POLICY "Owners can delete products" ON public.products
    FOR DELETE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

-- stock_batches -----------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop stock batches" ON public.stock_batches;
CREATE POLICY "Users can view own shop stock batches" ON public.stock_batches
    FOR SELECT USING (shop_id = get_user_shop_id());

DROP POLICY IF EXISTS "Owners and assistants can create stock batches" ON public.stock_batches;
CREATE POLICY "Owners and assistants can create stock batches" ON public.stock_batches
    FOR INSERT WITH CHECK (
        shop_id = get_user_shop_id()
        AND get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
    );

DROP POLICY IF EXISTS "Owners and admins can update stock batches" ON public.stock_batches;
CREATE POLICY "Owners can update stock batches" ON public.stock_batches
    FOR UPDATE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners and admins can delete stock batches" ON public.stock_batches;
CREATE POLICY "Owners can delete stock batches" ON public.stock_batches
    FOR DELETE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

-- sales -------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop sales" ON public.sales;
CREATE POLICY "Users can view own shop sales" ON public.sales
    FOR SELECT USING (shop_id = get_user_shop_id());

DROP POLICY IF EXISTS "Owners and assistants can create sales" ON public.sales;
CREATE POLICY "Owners and assistants can create sales" ON public.sales
    FOR INSERT WITH CHECK (
        shop_id = get_user_shop_id()
        AND get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
    );

DROP POLICY IF EXISTS "Owners and admins can update sales" ON public.sales;
CREATE POLICY "Owners can update sales" ON public.sales
    FOR UPDATE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners and admins can delete sales" ON public.sales;
CREATE POLICY "Owners can delete sales" ON public.sales
    FOR DELETE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

-- sale_items --------------------------------------------------------------
-- Reached through sales because the table has no shop_id of its own. This is
-- the most sensitive table in the schema — it holds per-item capital price and
-- profit — so the join must be exact.

DROP POLICY IF EXISTS "Users can view own shop sale items" ON public.sale_items;
CREATE POLICY "Users can view own shop sale items" ON public.sale_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sales
            WHERE sales.id = sale_items.sale_id
              AND sales.shop_id = get_user_shop_id()
        )
    );

DROP POLICY IF EXISTS "Owners and assistants can create sale items" ON public.sale_items;
CREATE POLICY "Owners and assistants can create sale items" ON public.sale_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sales
            WHERE sales.id = sale_items.sale_id
              AND sales.shop_id = get_user_shop_id()
              AND get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
        )
    );

DROP POLICY IF EXISTS "Owners and admins can update sale items" ON public.sale_items;
CREATE POLICY "Owners can update sale items" ON public.sale_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.sales
            WHERE sales.id = sale_items.sale_id
              AND sales.shop_id = get_user_shop_id()
              AND get_user_role() = 'OWNER'
        )
    );

DROP POLICY IF EXISTS "Owners and admins can delete sale items" ON public.sale_items;
CREATE POLICY "Owners can delete sale items" ON public.sale_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.sales
            WHERE sales.id = sale_items.sale_id
              AND sales.shop_id = get_user_shop_id()
              AND get_user_role() = 'OWNER'
        )
    );

-- stock_adjustments -------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop adjustments" ON public.stock_adjustments;
CREATE POLICY "Users can view own shop adjustments" ON public.stock_adjustments
    FOR SELECT USING (shop_id = get_user_shop_id());

DROP POLICY IF EXISTS "Owners and admins can create adjustments" ON public.stock_adjustments;
CREATE POLICY "Owners can create adjustments" ON public.stock_adjustments
    FOR INSERT WITH CHECK (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners and admins can update adjustments" ON public.stock_adjustments;
CREATE POLICY "Owners can update adjustments" ON public.stock_adjustments
    FOR UPDATE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners and admins can delete adjustments" ON public.stock_adjustments;
CREATE POLICY "Owners can delete adjustments" ON public.stock_adjustments
    FOR DELETE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

-- shops / users -----------------------------------------------------------
-- Unchanged from the baseline. SUPER_ADMIN keeps full access here because
-- managing shops and accounts is the whole of the role.
