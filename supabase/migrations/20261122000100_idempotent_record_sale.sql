-- Idempotent sale recording: one till submission is never recorded twice.
--
-- Problem: on a slow connection the sale can be committed while the "saved"
-- response never reaches the phone. The cashier sees an error or an endless
-- spinner, taps Record Sale again, and record_sale() runs a second time. The
-- stock is deducted twice, the revenue is booked twice, and a credit
-- customer's debt doubles.
--
-- Fix: the till generates one random request id per cart and sends it with
-- the sale. record_sale_once() records the sale only if that id has not been
-- seen in this shop. A retry of the same submission gets back the sale that
-- was already recorded, and nothing new is written.
--
-- Purely additive and safe for existing data:
--   * Adds ONE nullable column with no default: sales.client_request_id. In
--     Postgres this is a catalog-only change. No existing row is rewritten,
--     and every existing sale simply has NULL there.
--   * Adds a partial unique index over rows where client_request_id IS NOT
--     NULL. Every existing row is NULL, so the index starts empty and cannot
--     conflict with history.
--   * Adds one new function, record_sale_once(). record_sale() itself is NOT
--     changed: same signature, same body. The currently deployed app keeps
--     calling it exactly as before.
--   * Changes no policy, trigger, constraint, or existing function, and
--     updates no existing row.

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS client_request_id uuid;

COMMENT ON COLUMN public.sales.client_request_id IS
    'Random id the till generates per submission, so a retried request returns the existing sale instead of recording it twice. NULL for sales recorded before 20261122000100, by amend_sale(), or by older clients.';

CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_client_request_key
    ON public.sales (shop_id, client_request_id)
    WHERE client_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_sale_once(
    p_client_request_id uuid,
    p_items             jsonb,
    p_payment_status    text DEFAULT 'PAID',
    p_amount_paid       numeric DEFAULT NULL,
    p_customer_id       uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_shop_id     uuid;
    v_existing_id uuid;
    v_sale_id     uuid;
BEGIN
    IF p_client_request_id IS NULL THEN
        RAISE EXCEPTION 'The sale is missing its request id. Refresh the page and try again.';
    END IF;

    -- Same lookup record_sale() does. It only scopes the duplicate check;
    -- record_sale() still performs the full role and shop authorization.
    SELECT shop_id INTO v_shop_id
      FROM public.users
     WHERE auth_id = auth.uid();

    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Your account is not assigned to a shop';
    END IF;

    -- Serialize submissions that carry the same request id. A second copy
    -- that arrives while the first is still running waits here. It then sees
    -- the committed sale below and returns it, instead of recording again.
    -- The lock is transaction-scoped and released automatically.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(v_shop_id::text || ':' || p_client_request_id::text, 0)
    );

    SELECT id INTO v_existing_id
      FROM public.sales
     WHERE shop_id = v_shop_id
       AND client_request_id = p_client_request_id;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('sale_id', v_existing_id, 'duplicate', true);
    END IF;

    -- The unchanged sale path: FIFO or explicit batch, row locks, payments.
    v_sale_id := public.record_sale(
        p_items, p_payment_status, p_amount_paid, p_customer_id
    );

    -- Tag only the row that was just created. The partial unique index is
    -- the backstop: if two copies ever got past the lock, the second would
    -- fail here, and its whole transaction (stock deduction included) would
    -- roll back.
    UPDATE public.sales
       SET client_request_id = p_client_request_id
     WHERE id = v_sale_id
       AND shop_id = v_shop_id;

    RETURN jsonb_build_object('sale_id', v_sale_id, 'duplicate', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_sale_once(uuid, jsonb, text, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_sale_once(uuid, jsonb, text, numeric, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.record_sale_once(uuid, jsonb, text, numeric, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_sale_once(uuid, jsonb, text, numeric, uuid) IS
    'record_sale() with a per-submission request id. Returns {sale_id, duplicate}. A repeated id in the same shop returns the existing sale and writes nothing.';
