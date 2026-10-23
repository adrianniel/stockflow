-- Customer-level credit collections.
--
-- This migration is additive by design:
--   * existing sale_payments rows are not updated or backfilled;
--   * the nullable group id remains NULL on all historical rows;
--   * no sales, customers, payment amounts, or payment statuses are rewritten.
--
-- A single collection may need several sale_payments rows to preserve each
-- sale's existing amount_paid/payment_status ledger. All allocation rows from
-- one collection share payment_group_id so the customer UI can show one event.

ALTER TABLE public.sale_payments
    ADD COLUMN IF NOT EXISTS payment_group_id uuid;

COMMENT ON COLUMN public.sale_payments.payment_group_id IS
    'Shared id for the sale-level allocations created by one customer-level payment. NULL on historical and legacy single-sale payment rows.';

CREATE INDEX IF NOT EXISTS idx_sale_payments_payment_group_id
    ON public.sale_payments (payment_group_id)
    WHERE payment_group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.record_customer_payment(
    p_customer_id uuid,
    p_amount numeric,
    p_collected_at timestamptz DEFAULT NULL,
    p_note text DEFAULT NULL
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
    v_customer_id      uuid;
    v_sale             record;
    v_sale_ids         uuid[] := ARRAY[]::uuid[];
    v_sale_balances    numeric[] := ARRAY[]::numeric[];
    v_sale_count       integer := 0;
    v_total_outstanding numeric := 0;
    v_remaining        numeric;
    v_allocation       numeric;
    v_collected_at     timestamptz;
    v_payment_group_id uuid := gen_random_uuid();
    v_index            integer;
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

    IF p_customer_id IS NULL THEN
        RAISE EXCEPTION 'A customer is required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'A payment must be greater than zero';
    END IF;

    IF length(btrim(COALESCE(p_note, ''))) > 200 THEN
        RAISE EXCEPTION 'Payment note must be 200 characters or fewer';
    END IF;

    v_collected_at := COALESCE(p_collected_at, now());

    IF v_collected_at > now() + interval '1 minute' THEN
        RAISE EXCEPTION 'The received date and time cannot be in the future';
    END IF;

    -- Serialize customer-level collections for this customer. This row is
    -- shop-checked before any sale is locked or any ledger row is inserted.
    SELECT c.id
      INTO v_customer_id
      FROM public.customers AS c
     WHERE c.id = p_customer_id
       AND c.shop_id = v_shop_id
     FOR UPDATE;

    IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer % not found in this shop', p_customer_id;
    END IF;

    -- Lock every live debt in a stable oldest-first order before calculating
    -- the aggregate. Concurrent payment actions must wait and then re-check the
    -- current amount_paid values, preventing double collection.
    FOR v_sale IN
        SELECT s.id, s.total_amount, s.amount_paid
          FROM public.sales AS s
         WHERE s.shop_id = v_shop_id
           AND s.customer_id = v_customer_id
           AND s.voided_at IS NULL
           AND s.amount_paid < s.total_amount
         ORDER BY s.sale_date ASC NULLS FIRST, s.created_at ASC, s.id ASC
         FOR UPDATE OF s
    LOOP
        v_allocation := v_sale.total_amount - v_sale.amount_paid;
        IF v_allocation > 0 THEN
            v_sale_ids := array_append(v_sale_ids, v_sale.id);
            v_sale_balances := array_append(v_sale_balances, v_allocation);
            v_sale_count := v_sale_count + 1;
            v_total_outstanding := v_total_outstanding + v_allocation;
        END IF;
    END LOOP;

    IF v_total_outstanding <= 0 THEN
        RAISE EXCEPTION 'This customer has no outstanding credit';
    END IF;

    IF p_amount > v_total_outstanding THEN
        RAISE EXCEPTION
            'Payment of % exceeds the customer''s outstanding balance of %',
            p_amount, v_total_outstanding;
    END IF;

    -- Apply the one customer payment to the oldest debt first. All rows share
    -- one group id and are committed atomically with the trigger-maintained
    -- amount_paid/payment_status updates.
    v_remaining := p_amount;

    FOR v_index IN 1..v_sale_count LOOP
        EXIT WHEN v_remaining <= 0;

        v_allocation := LEAST(v_remaining, v_sale_balances[v_index]);

        INSERT INTO public.sale_payments (
            shop_id,
            sale_id,
            amount,
            collected_by,
            collected_at,
            note,
            payment_group_id
        )
        VALUES (
            v_shop_id,
            v_sale_ids[v_index],
            v_allocation,
            v_user_id,
            v_collected_at,
            NULLIF(btrim(p_note), ''),
            v_payment_group_id
        );

        v_remaining := v_remaining - v_allocation;
    END LOOP;

    RETURN v_payment_group_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_customer_payment(uuid, numeric, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(uuid, numeric, timestamptz, text) TO authenticated;

COMMENT ON FUNCTION public.record_customer_payment(uuid, numeric, timestamptz, text) IS
    'Records one customer-level collection and allocates it oldest outstanding sale first in one transaction. Existing payment rows are not modified.';
