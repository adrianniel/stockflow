-- Amend a recorded sale by voiding it and recording a replacement.
--
-- The original row, its sale_items and its payment rows remain in place.  The
-- replacement is a new sale, so both the inventory movement and the financial
-- history stay auditable.  The operation is deliberately one SECURITY DEFINER
-- transaction: a failed replacement rolls the void back as well.

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS replaces_sale_id uuid;

ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_replaces_sale_fkey;

ALTER TABLE public.sales
    ADD CONSTRAINT sales_replaces_sale_fkey
    FOREIGN KEY (replaces_sale_id) REFERENCES public.sales(id) ON DELETE RESTRICT;

ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_replaces_sale_not_self;

ALTER TABLE public.sales
    ADD CONSTRAINT sales_replaces_sale_not_self
    CHECK (replaces_sale_id IS NULL OR replaces_sale_id <> id);

-- An original can only have one direct replacement.  A later amendment points
-- to the previous replacement and therefore forms a readable amendment chain.
CREATE UNIQUE INDEX IF NOT EXISTS sales_one_replacement_per_sale
    ON public.sales (replaces_sale_id)
    WHERE replaces_sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_replaces_sale_id
    ON public.sales (replaces_sale_id)
    WHERE replaces_sale_id IS NOT NULL;

COMMENT ON COLUMN public.sales.replaces_sale_id IS
    'The sale this row replaces. Set only by amend_sale(); the referenced sale remains as a voided audit record.';

CREATE OR REPLACE FUNCTION public.validate_sale_replacement_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_original_shop_id uuid;
    v_original_voided_at timestamptz;
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.replaces_sale_id IS NOT DISTINCT FROM NEW.replaces_sale_id THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.replaces_sale_id IS NOT NULL THEN
        RAISE EXCEPTION 'A replacement link cannot be changed';
    END IF;

    IF NEW.replaces_sale_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT shop_id, voided_at
      INTO v_original_shop_id, v_original_voided_at
      FROM public.sales
     WHERE id = NEW.replaces_sale_id;

    IF NOT FOUND OR v_original_shop_id IS DISTINCT FROM NEW.shop_id THEN
        RAISE EXCEPTION 'The replacement must point to a sale in this shop';
    END IF;

    IF v_original_voided_at IS NULL THEN
        RAISE EXCEPTION 'Only a voided sale can be replaced';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_sale_replacement_link ON public.sales;
CREATE TRIGGER validate_sale_replacement_link
    BEFORE INSERT OR UPDATE OF replaces_sale_id ON public.sales
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_sale_replacement_link();

CREATE OR REPLACE FUNCTION public.amend_sale(
    p_sale_id        uuid,
    p_reason         text,
    p_items          jsonb,
    p_payment_status text DEFAULT 'PAID',
    p_amount_paid    numeric DEFAULT NULL,
    p_customer_id    uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id          uuid;
    v_shop_id          uuid;
    v_role             text;
    v_sale_date        timestamptz;
    v_voided_at        timestamptz;
    v_existing_child   uuid;
    v_replacement_id   uuid;
BEGIN
    SELECT id, shop_id, role
      INTO v_user_id, v_shop_id, v_role
      FROM public.users
     WHERE auth_id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user profile for the current session';
    END IF;

    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Your account is not assigned to a shop';
    END IF;

    IF v_role <> 'OWNER' THEN
        RAISE EXCEPTION 'Role % may not amend sales', v_role;
    END IF;

    -- Lock and validate the original before void_sale() does any work.  The
    -- shop predicate makes another shop's sale indistinguishable from absent.
    SELECT sale_date, voided_at
      INTO v_sale_date, v_voided_at
      FROM public.sales
     WHERE id = p_sale_id
       AND shop_id = v_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale % not found in this shop', p_sale_id;
    END IF;

    IF v_voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'This sale was already voided and cannot be amended';
    END IF;

    SELECT id
      INTO v_existing_child
      FROM public.sales
     WHERE replaces_sale_id = p_sale_id
     LIMIT 1;

    IF v_existing_child IS NOT NULL THEN
        RAISE EXCEPTION 'This sale was already replaced by %', v_existing_child;
    END IF;

    -- void_sale() restores the exact batches, writes stock adjustments and
    -- marks the old payment rows voided.  Calling it inside this transaction
    -- means a failed replacement rolls all of that work back.
    PERFORM public.void_sale(p_sale_id, p_reason);

    -- record_sale() performs the replacement's locked FIFO/explicit-batch
    -- deduction and writes any new payment through the ledger.
    v_replacement_id := public.record_sale(
        p_items,
        p_payment_status,
        p_amount_paid,
        p_customer_id
    );

    -- Amendment reports should stay on the original business date.  The
    -- replacement's created_at remains the time the correction was recorded.
    UPDATE public.sales
       SET replaces_sale_id = p_sale_id,
           sale_date = v_sale_date
     WHERE id = v_replacement_id
       AND shop_id = v_shop_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Replacement sale was not created in this shop';
    END IF;

    RETURN v_replacement_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.amend_sale(uuid, text, jsonb, text, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.amend_sale(uuid, text, jsonb, text, numeric, uuid) TO authenticated;

COMMENT ON FUNCTION public.amend_sale(uuid, text, jsonb, text, numeric, uuid) IS
    'Owner-only atomic sale amendment: voids the original, records a replacement, preserves the original sale date, and links the replacement through replaces_sale_id.';
