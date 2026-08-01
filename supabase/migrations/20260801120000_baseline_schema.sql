-- Baseline: the schema exactly as it exists in the live Supabase project.
--
-- This file was reconstructed from a catalog introspection of the running
-- database (see docs/schema-introspection.sql), not hand-written from the
-- design docs — so it reflects what is actually deployed, including the
-- problems that later migrations in this directory fix.
--
-- It is written to be safe to run against the existing database: every object
-- uses IF NOT EXISTS or is dropped first. Running it changes nothing on the
-- current project; it exists so a fresh environment can be built from scratch.
--
-- Known issues NOT fixed here, on purpose (each has its own migration):
--   * `profit >= 0` CHECKs forbid the discounts SRS 10 requires
--   * no way to record a partial payment amount
--   * SECURITY DEFINER helpers have no pinned search_path
--   * SUPER_ADMIN can read every shop's business data
--   * no FIFO index, no record_sale(), no assistant limit

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shops (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_name   text NOT NULL,
    owner_name  text,
    status      text DEFAULT 'ACTIVE'
                CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text])),
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- `auth_id` points at auth.users(id) but carries no foreign key in the live
-- database, and no unique constraint either. Both are added in
-- 20260801120500_integrity_constraints.sql.
CREATE TABLE IF NOT EXISTS public.users (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id     uuid NOT NULL,
    shop_id     uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    name        text NOT NULL,
    role        text NOT NULL DEFAULT 'ASSISTANT'
                CHECK (role = ANY (ARRAY['SUPER_ADMIN'::text, 'OWNER'::text, 'ASSISTANT'::text])),
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id     uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    name        text NOT NULL,
    created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now(),
    updated_at  timestamptz DEFAULT now()
);

-- Deliberately carries no price columns: prices belong to stock batches,
-- because they change between arrivals (SRS 6.3).
CREATE TABLE IF NOT EXISTS public.products (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id       uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    category_id   uuid REFERENCES public.categories(id) ON DELETE SET NULL,
    product_name  text NOT NULL,
    brand         text,
    description   text,
    created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

-- `interest_percentage` stores whole percentage points (30.00 means 30%), so
-- selling_price = capital_price * (1 + interest_percentage / 100).
CREATE TABLE IF NOT EXISTS public.stock_batches (
    id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id              uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id           uuid REFERENCES public.products(id) ON DELETE CASCADE,
    batch_number         text NOT NULL,
    quantity_received    integer NOT NULL CHECK (quantity_received >= 0),
    quantity_remaining   integer NOT NULL CHECK (quantity_remaining >= 0),
    capital_price        numeric NOT NULL CHECK (capital_price >= 0),
    interest_percentage  numeric DEFAULT 30.00,
    selling_price        numeric NOT NULL CHECK (selling_price >= 0),
    received_date        date DEFAULT CURRENT_DATE,
    created_by           uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id         uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    sold_by         uuid REFERENCES public.users(id) ON DELETE SET NULL,
    total_amount    numeric NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    total_profit    numeric NOT NULL DEFAULT 0 CHECK (total_profit >= 0),
    payment_status  text DEFAULT 'PAID'
                    CHECK (payment_status = ANY (ARRAY['PAID'::text, 'PARTIAL'::text, 'CREDIT'::text])),
    sale_date       timestamptz DEFAULT now(),
    created_at      timestamptz DEFAULT now()
);

-- Has no shop_id of its own; tenant isolation runs through sales.shop_id, which
-- is what the RLS policies below join on.
CREATE TABLE IF NOT EXISTS public.sale_items (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id               uuid REFERENCES public.sales(id) ON DELETE CASCADE,
    stock_batch_id        uuid REFERENCES public.stock_batches(id) ON DELETE SET NULL,
    quantity              integer NOT NULL CHECK (quantity > 0),
    capital_price         numeric NOT NULL,
    suggested_price       numeric NOT NULL,
    actual_selling_price  numeric NOT NULL,
    profit                numeric NOT NULL CHECK (profit >= 0),
    created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
    id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id          uuid REFERENCES public.shops(id) ON DELETE CASCADE,
    stock_batch_id   uuid REFERENCES public.stock_batches(id) ON DELETE CASCADE,
    quantity_change  integer NOT NULL CHECK (quantity_change <> 0),
    reason           text NOT NULL,
    adjusted_by      uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at       timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_products_shop_id      ON public.products (shop_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id  ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_product_name ON public.products (product_name);

CREATE INDEX IF NOT EXISTS idx_stock_batches_shop_id    ON public.stock_batches (shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_product_id ON public.stock_batches (product_id);

CREATE INDEX IF NOT EXISTS idx_sales_shop_id   ON public.sales (shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales (sale_date);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id  ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_batch_id ON public.sale_items (stock_batch_id);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- These three are read by every RLS policy. They must be SECURITY DEFINER:
-- they select from `users`, which itself has RLS, so an invoker-rights version
-- would recurse into the policy that called it.
CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN (
        SELECT shop_id
        FROM users
        WHERE auth_id = auth.uid()
        LIMIT 1
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN (
        SELECT role
        FROM users
        WHERE auth_id = auth.uid()
        LIMIT 1
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    RETURN (
        SELECT EXISTS (
            SELECT 1
            FROM users
            WHERE auth_id = auth.uid()
            AND role = 'SUPER_ADMIN'
        )
    );
END;
$function$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS update_shops_updated_at ON public.shops;
CREATE TRIGGER update_shops_updated_at
    BEFORE UPDATE ON public.shops
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_stock_batches_updated_at ON public.stock_batches;
CREATE TRIGGER update_stock_batches_updated_at
    BEFORE UPDATE ON public.stock_batches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.shops             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- shops -------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop" ON public.shops;
CREATE POLICY "Users can view own shop" ON public.shops
    FOR SELECT USING (id = get_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS "Super admins can create shops" ON public.shops;
CREATE POLICY "Super admins can create shops" ON public.shops
    FOR INSERT WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Admins and owners can update shops" ON public.shops;
CREATE POLICY "Admins and owners can update shops" ON public.shops
    FOR UPDATE USING (is_super_admin() OR id = get_user_shop_id());

-- users -------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop users" ON public.users;
CREATE POLICY "Users can view own shop users" ON public.users
    FOR SELECT USING (shop_id = get_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS "Admins and owners can create users" ON public.users;
CREATE POLICY "Admins and owners can create users" ON public.users
    FOR INSERT WITH CHECK (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Admins and owners can update users" ON public.users;
CREATE POLICY "Admins and owners can update users" ON public.users
    FOR UPDATE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;
CREATE POLICY "Only admins can delete users" ON public.users
    FOR DELETE USING (is_super_admin());

-- categories --------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop categories" ON public.categories;
CREATE POLICY "Users can view own shop categories" ON public.categories
    FOR SELECT USING (shop_id = get_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS "Owners and admins can create categories" ON public.categories;
CREATE POLICY "Owners and admins can create categories" ON public.categories
    FOR INSERT WITH CHECK (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Owners and admins can update categories" ON public.categories;
CREATE POLICY "Owners and admins can update categories" ON public.categories
    FOR UPDATE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Owners and admins can delete categories" ON public.categories;
CREATE POLICY "Owners and admins can delete categories" ON public.categories
    FOR DELETE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

-- products ----------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop products" ON public.products;
CREATE POLICY "Users can view own shop products" ON public.products
    FOR SELECT USING (shop_id = get_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS "Owners and admins can create products" ON public.products;
CREATE POLICY "Owners and admins can create products" ON public.products
    FOR INSERT WITH CHECK (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Owners and admins can update products" ON public.products;
CREATE POLICY "Owners and admins can update products" ON public.products
    FOR UPDATE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Owners and admins can delete products" ON public.products;
CREATE POLICY "Owners and admins can delete products" ON public.products
    FOR DELETE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

-- stock_batches -----------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop stock batches" ON public.stock_batches;
CREATE POLICY "Users can view own shop stock batches" ON public.stock_batches
    FOR SELECT USING (shop_id = get_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS "Owners and assistants can create stock batches" ON public.stock_batches;
CREATE POLICY "Owners and assistants can create stock batches" ON public.stock_batches
    FOR INSERT WITH CHECK (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text]))
    );

DROP POLICY IF EXISTS "Owners and admins can update stock batches" ON public.stock_batches;
CREATE POLICY "Owners and admins can update stock batches" ON public.stock_batches
    FOR UPDATE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Owners and admins can delete stock batches" ON public.stock_batches;
CREATE POLICY "Owners and admins can delete stock batches" ON public.stock_batches
    FOR DELETE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

-- sales -------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop sales" ON public.sales;
CREATE POLICY "Users can view own shop sales" ON public.sales
    FOR SELECT USING (shop_id = get_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS "Owners and assistants can create sales" ON public.sales;
CREATE POLICY "Owners and assistants can create sales" ON public.sales
    FOR INSERT WITH CHECK (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text]))
    );

DROP POLICY IF EXISTS "Owners and admins can update sales" ON public.sales;
CREATE POLICY "Owners and admins can update sales" ON public.sales
    FOR UPDATE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Owners and admins can delete sales" ON public.sales;
CREATE POLICY "Owners and admins can delete sales" ON public.sales
    FOR DELETE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

-- sale_items --------------------------------------------------------------
-- No shop_id column, so every policy reaches the tenant through sales.

DROP POLICY IF EXISTS "Users can view own shop sale items" ON public.sale_items;
CREATE POLICY "Users can view own shop sale items" ON public.sale_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM sales
            WHERE sales.id = sale_items.sale_id
              AND (sales.shop_id = get_user_shop_id() OR is_super_admin())
        )
    );

DROP POLICY IF EXISTS "Owners and assistants can create sale items" ON public.sale_items;
CREATE POLICY "Owners and assistants can create sale items" ON public.sale_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM sales
            WHERE sales.id = sale_items.sale_id
              AND (
                is_super_admin()
                OR (sales.shop_id = get_user_shop_id()
                    AND get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text]))
              )
        )
    );

DROP POLICY IF EXISTS "Owners and admins can update sale items" ON public.sale_items;
CREATE POLICY "Owners and admins can update sale items" ON public.sale_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM sales
            WHERE sales.id = sale_items.sale_id
              AND (
                is_super_admin()
                OR (sales.shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
              )
        )
    );

DROP POLICY IF EXISTS "Owners and admins can delete sale items" ON public.sale_items;
CREATE POLICY "Owners and admins can delete sale items" ON public.sale_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM sales
            WHERE sales.id = sale_items.sale_id
              AND (
                is_super_admin()
                OR (sales.shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
              )
        )
    );

-- stock_adjustments -------------------------------------------------------

DROP POLICY IF EXISTS "Users can view own shop adjustments" ON public.stock_adjustments;
CREATE POLICY "Users can view own shop adjustments" ON public.stock_adjustments
    FOR SELECT USING (shop_id = get_user_shop_id() OR is_super_admin());

DROP POLICY IF EXISTS "Owners and admins can create adjustments" ON public.stock_adjustments;
CREATE POLICY "Owners and admins can create adjustments" ON public.stock_adjustments
    FOR INSERT WITH CHECK (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Owners and admins can update adjustments" ON public.stock_adjustments;
CREATE POLICY "Owners and admins can update adjustments" ON public.stock_adjustments
    FOR UPDATE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );

DROP POLICY IF EXISTS "Owners and admins can delete adjustments" ON public.stock_adjustments;
CREATE POLICY "Owners and admins can delete adjustments" ON public.stock_adjustments
    FOR DELETE USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    );
