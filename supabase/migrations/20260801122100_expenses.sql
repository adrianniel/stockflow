-- Expenses are shop-owned operating costs. They are intentionally separate from
-- sales: adding this table does not rewrite any existing business data.
--
-- Deletion is represented by deleted_at/deleted_by rather than a physical DELETE
-- so a mistaken expense can stop affecting reports without destroying the
-- financial history.

CREATE TABLE IF NOT EXISTS public.expenses (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    expense_date date NOT NULL DEFAULT CURRENT_DATE,
    name        text NOT NULL CHECK (length(btrim(name)) > 0),
    amount      numeric NOT NULL CHECK (amount > 0),
    notes       text,
    created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    deleted_at  timestamptz,
    deleted_by  uuid REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_shop_date
    ON public.expenses (shop_id, expense_date);

CREATE INDEX IF NOT EXISTS idx_expenses_shop_live_date
    ON public.expenses (shop_id, expense_date)
    WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members can view own expenses" ON public.expenses;
CREATE POLICY "Shop members can view own expenses" ON public.expenses
    FOR SELECT USING (
        shop_id = public.get_user_shop_id()
        AND public.get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
    );

DROP POLICY IF EXISTS "Shop members can create expenses" ON public.expenses;
CREATE POLICY "Shop members can create expenses" ON public.expenses
    FOR INSERT WITH CHECK (
        shop_id = public.get_user_shop_id()
        AND public.get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
        AND created_by = (
            SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1
        )
    );

DROP POLICY IF EXISTS "Shop members can update expenses" ON public.expenses;
CREATE POLICY "Shop members can update expenses" ON public.expenses
    FOR UPDATE USING (
        shop_id = public.get_user_shop_id()
        AND public.get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
    ) WITH CHECK (
        shop_id = public.get_user_shop_id()
        AND public.get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
    );

COMMENT ON TABLE public.expenses IS
    'Shop operating expenses. Rows are soft-deleted so financial history remains auditable.';
