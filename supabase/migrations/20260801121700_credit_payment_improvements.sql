-- Credit and partial payment improvements.
--
-- `sale_payments.collected_at` already stores when money changed hands and
-- `created_at` stores when the row was entered.  This migration keeps that
-- schema and hardens the existing record_payment() RPC so an explicitly
-- supplied collection timestamp cannot be in the future.

CREATE OR REPLACE FUNCTION public.record_payment(
    p_sale_id      uuid,
    p_amount       numeric,
    p_collected_at timestamptz DEFAULT NULL,
    p_note         text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id       uuid;
    v_shop_id       uuid;
    v_role          text;
    v_total         numeric;
    v_paid          numeric;
    v_voided_at     timestamptz;
    v_outstanding   numeric;
    v_payment_id    uuid;
    v_collected_at  timestamptz;
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

    IF v_role NOT IN ('OWNER', 'ASSISTANT') THEN
        RAISE EXCEPTION 'Role % may not record payments', v_role;
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'A payment must be greater than zero';
    END IF;

    v_collected_at := COALESCE(p_collected_at, now());

    IF v_collected_at > now() + interval '1 minute' THEN
        RAISE EXCEPTION 'The received date and time cannot be in the future';
    END IF;

    SELECT total_amount, amount_paid, voided_at
      INTO v_total, v_paid, v_voided_at
      FROM public.sales
     WHERE id = p_sale_id
       AND shop_id = v_shop_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale % not found in this shop', p_sale_id;
    END IF;

    IF v_voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'This sale was voided. Nothing is owed on it.';
    END IF;

    v_outstanding := v_total - v_paid;

    IF v_outstanding <= 0 THEN
        RAISE EXCEPTION 'This sale is already fully paid';
    END IF;

    IF p_amount > v_outstanding THEN
        RAISE EXCEPTION
            'Payment of % exceeds the outstanding balance of %',
            p_amount, v_outstanding;
    END IF;

    INSERT INTO public.sale_payments (
        shop_id, sale_id, amount, collected_by, collected_at, note
    )
    VALUES (
        v_shop_id, p_sale_id, p_amount, v_user_id, v_collected_at,
        NULLIF(btrim(p_note), '')
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_payment(uuid, numeric, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, numeric, timestamptz, text) TO authenticated;

COMMENT ON FUNCTION public.record_payment(uuid, numeric, timestamptz, text) IS
    'Records one payment against a live sale. collected_at is when money was received; created_at records when the ledger row was entered. Future collection times are refused.';

-- Keep the same invariant for any authenticated path that might attempt a
-- direct ledger insert. The application uses record_payment(), but the table
-- remains protected if a future client bypasses that action.
CREATE OR REPLACE FUNCTION public.validate_sale_payment_collected_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF NEW.collected_at > now() + interval '1 minute' THEN
        RAISE EXCEPTION 'The received date and time cannot be in the future';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sale_payments_validate_collected_at ON public.sale_payments;
CREATE TRIGGER sale_payments_validate_collected_at
    BEFORE INSERT OR UPDATE OF collected_at ON public.sale_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_sale_payment_collected_at();
