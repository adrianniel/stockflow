-- Idempotent customer payments: one Record Payment submission is never
-- recorded twice.
--
-- Same problem as sales (20261122000100). On a slow connection a customer's
-- installment can commit while the response never arrives. The cashier
-- submits again, and the customer is credited twice for money paid once.
--
-- record_customer_payment_once() wraps the unchanged
-- record_customer_payment(). It takes the request id the form generated, and
-- if a payment with that id already exists in the shop, it returns that
-- payment group instead of recording again.
--
-- Purely additive and safe for existing data:
--   * Adds ONE nullable column with no default:
--     sale_payments.client_request_id. This is a catalog-only change; no
--     existing row is rewritten, and every existing payment stays NULL.
--   * Adds a partial, non-unique index (one customer payment is several
--     allocation rows sharing the id). It starts empty.
--   * Adds one new function. record_customer_payment() and record_payment()
--     are NOT changed. No policy, trigger, or constraint changes, and no
--     existing row is updated.
--   * The only rows this function ever updates are the allocation rows it
--     has just inserted in the same transaction, to tag them with the id.

ALTER TABLE public.sale_payments
    ADD COLUMN IF NOT EXISTS client_request_id uuid;

COMMENT ON COLUMN public.sale_payments.client_request_id IS
    'Random id the payment form generates per submission, shared by all allocation rows of one customer payment, so a retried request returns the existing payment instead of recording it twice. NULL for payments recorded before 20261122000200.';

CREATE INDEX IF NOT EXISTS idx_sale_payments_shop_client_request
    ON public.sale_payments (shop_id, client_request_id)
    WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_customer_payment_once(
    p_client_request_id uuid,
    p_customer_id       uuid,
    p_amount            numeric,
    p_collected_at      timestamptz DEFAULT NULL,
    p_note              text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_shop_id        uuid;
    v_existing_group uuid;
    v_group_id       uuid;
BEGIN
    IF p_client_request_id IS NULL THEN
        RAISE EXCEPTION 'The payment is missing its request id. Refresh the page and try again.';
    END IF;

    -- Only scopes the duplicate check; record_customer_payment() performs the
    -- full role, shop and customer authorization.
    SELECT shop_id INTO v_shop_id
      FROM public.users
     WHERE auth_id = auth.uid();

    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Your account is not assigned to a shop';
    END IF;

    -- A second copy of the same submission waits here, then finds the first
    -- one's committed rows below. The lock is released at transaction end.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('payment:' || v_shop_id::text || ':' || p_client_request_id::text, 0)
    );

    SELECT payment_group_id INTO v_existing_group
      FROM public.sale_payments
     WHERE shop_id = v_shop_id
       AND client_request_id = p_client_request_id
     LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object('payment_group_id', v_existing_group, 'duplicate', true);
    END IF;

    v_group_id := public.record_customer_payment(
        p_customer_id, p_amount, p_collected_at, p_note
    );

    -- Tag the allocation rows created a moment ago in this transaction.
    -- payment_group_id is a fresh gen_random_uuid() from
    -- record_customer_payment(), so it matches only those rows.
    UPDATE public.sale_payments
       SET client_request_id = p_client_request_id
     WHERE shop_id = v_shop_id
       AND payment_group_id = v_group_id;

    RETURN jsonb_build_object('payment_group_id', v_group_id, 'duplicate', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_customer_payment_once(uuid, uuid, numeric, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_customer_payment_once(uuid, uuid, numeric, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_customer_payment_once(uuid, uuid, numeric, timestamptz, text) TO authenticated;

COMMENT ON FUNCTION public.record_customer_payment_once(uuid, uuid, numeric, timestamptz, text) IS
    'record_customer_payment() with a per-submission request id. Returns {payment_group_id, duplicate}. A repeated id in the same shop returns the existing payment and writes nothing.';
