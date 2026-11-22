-- Expense edit history: every change to an expense is recorded.
--
-- Owners and assistants can both edit and delete (soft delete) any expense.
-- The update overwrote amount, date, name and notes in place, so a past
-- report could change with no record of who changed what or what it was
-- before.
--
-- Instead of restricting who may edit, which would change the assistants'
-- workflow, this keeps the workflow exactly as it is and records history. An
-- AFTER UPDATE trigger on expenses copies the old and new values of the
-- tracked fields into expense_history, along with who made the change and
-- when.
--
-- Purely additive and safe for existing data:
--   * Creates one new table (expense_history) and one trigger function plus
--     trigger. It changes no existing table, column, policy, or function, and
--     updates no existing row. Existing expenses have no history rows; history
--     starts with the first edit after this migration.
--   * The trigger only INSERTS into expense_history. It never modifies the
--     expense row, and it runs after the update has already passed every
--     existing check.
--   * History rows can't be inserted, edited, or deleted through the API:
--     there are no write policies, and write privileges are revoked. Only the
--     trigger writes them.

CREATE TABLE IF NOT EXISTS public.expense_history (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    expense_id  uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    action      text NOT NULL CHECK (action IN ('EDIT', 'DELETE', 'RESTORE')),
    old_values  jsonb NOT NULL,
    new_values  jsonb NOT NULL,
    changed_by  uuid CONSTRAINT expense_history_changed_by_fkey
                REFERENCES public.users(id) ON DELETE SET NULL,
    changed_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.expense_history IS
    'Append-only log of changes to expenses (edits, soft deletes, restores), written only by the expenses_record_history trigger.';

CREATE INDEX IF NOT EXISTS idx_expense_history_shop_changed
    ON public.expense_history (shop_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_expense_history_expense
    ON public.expense_history (expense_id);

CREATE INDEX IF NOT EXISTS idx_expense_history_changed_by
    ON public.expense_history (changed_by);

ALTER TABLE public.expense_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members can view own expense history" ON public.expense_history;
CREATE POLICY "Shop members can view own expense history" ON public.expense_history
    FOR SELECT USING (
        shop_id = public.get_user_shop_id()
        AND public.get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
    );

-- Read-only to the API. Supabase's default privileges grant write access on
-- new tables, so remove it explicitly. RLS would refuse these writes anyway,
-- since there are no write policies.
REVOKE ALL ON public.expense_history FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.expense_history FROM authenticated;
GRANT SELECT ON public.expense_history TO authenticated;

CREATE OR REPLACE FUNCTION public.expenses_record_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_action  text;
    v_user_id uuid;
BEGIN
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        v_action := 'DELETE';
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        v_action := 'RESTORE';
    ELSE
        v_action := 'EDIT';
    END IF;

    SELECT id INTO v_user_id
      FROM public.users
     WHERE auth_id = auth.uid();

    INSERT INTO public.expense_history (
        shop_id, expense_id, action, old_values, new_values, changed_by
    )
    VALUES (
        OLD.shop_id,
        OLD.id,
        v_action,
        jsonb_build_object(
            'expense_date', OLD.expense_date,
            'name',         OLD.name,
            'amount',       OLD.amount,
            'notes',        OLD.notes,
            'deleted_at',   OLD.deleted_at
        ),
        jsonb_build_object(
            'expense_date', NEW.expense_date,
            'name',         NEW.name,
            'amount',       NEW.amount,
            'notes',        NEW.notes,
            'deleted_at',   NEW.deleted_at
        ),
        COALESCE(v_user_id, NEW.deleted_by)
    );

    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.expenses_record_history() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expenses_record_history() FROM anon;
REVOKE ALL ON FUNCTION public.expenses_record_history() FROM authenticated;

COMMENT ON FUNCTION public.expenses_record_history() IS
    'Trigger: appends the before/after values of an expense to expense_history whenever a tracked field changes.';

-- Fires only when a tracked field actually changes, so the updated_at
-- trigger and no-op saves don't create noise.
DROP TRIGGER IF EXISTS expenses_record_history ON public.expenses;
CREATE TRIGGER expenses_record_history
    AFTER UPDATE ON public.expenses
    FOR EACH ROW
    WHEN (
        OLD.expense_date IS DISTINCT FROM NEW.expense_date
        OR OLD.name       IS DISTINCT FROM NEW.name
        OR OLD.amount     IS DISTINCT FROM NEW.amount
        OR OLD.notes      IS DISTINCT FROM NEW.notes
        OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
    )
    EXECUTE FUNCTION public.expenses_record_history();
