-- record_payment(), and record_sale() rewritten to write through the ledger.
--
-- Why record_sale has to change too
-- ---------------------------------
-- The previous migration made `sales.amount_paid` a cached sum of
-- `sale_payments`. record_sale() still sets that column directly, which would
-- leave every cash sale with an amount_paid but no matching payment row — so
-- the column and the ledger would disagree from the first sale, and a daily
-- collection report built on sale_payments would show none of the day's cash.
--
-- So record_sale now inserts the payment instead of writing the total, and lets
-- the trigger derive amount_paid and payment_status. One place produces those
-- two columns, for every payment, whether it arrives at the till or a week
-- later.
--
-- It also gains p_customer_id, so a credit sale can name its debtor in the same
-- transaction that creates it.

-- ---------------------------------------------------------------------------
-- record_payment()
-- ---------------------------------------------------------------------------
-- Collecting against an existing debt.
--
-- SECURITY DEFINER for the same reason as record_sale: the write it ultimately
-- causes lands on `sales`, which is owner-only for UPDATE, and assistants must
-- be able to take money at the counter. The authorization is therefore done
-- here and is load-bearing:
--   * the caller is resolved from auth.uid(), never passed in
--   * the caller must be OWNER or ASSISTANT
--   * the sale must belong to the caller's own shop, checked in the same query
--     that locks it — so a caller cannot name another shop's sale
--   * no shop_id argument exists to spoof
--
-- FOR UPDATE on the sale row is what makes concurrent collection safe. Two
-- clerks accepting the last 300 of a 300 debt at the same moment would
-- otherwise both read "300 outstanding", both insert, and the sale would end up
-- overpaid. The lock serializes them, and the second one fails the balance
-- check.
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
    v_user_id     uuid;
    v_shop_id     uuid;
    v_role        text;
    v_total       numeric;
    v_paid        numeric;
    v_outstanding numeric;
    v_payment_id  uuid;
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

    -- Shop check and lock in one statement. A sale belonging to another shop is
    -- reported as not found, so the error cannot confirm that an id exists.
    SELECT total_amount, amount_paid
      INTO v_total, v_paid
      FROM public.sales
     WHERE id = p_sale_id
       AND shop_id = v_shop_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale % not found in this shop', p_sale_id;
    END IF;

    v_outstanding := v_total - v_paid;

    IF v_outstanding <= 0 THEN
        RAISE EXCEPTION 'This sale is already fully paid';
    END IF;

    -- Rejected rather than capped. An amount larger than the balance is either
    -- a typo or change owed back to the customer, and both need a person to
    -- decide — silently storing a different number than the one entered would
    -- hide the mistake in the books.
    IF p_amount > v_outstanding THEN
        RAISE EXCEPTION
            'Payment of % exceeds the outstanding balance of %',
            p_amount, v_outstanding;
    END IF;

    -- shop_id is set by the sale_payments trigger from the parent sale; passing
    -- it here would be a second source of truth. collected_by is the caller,
    -- which is what makes the collection auditable.
    INSERT INTO public.sale_payments (shop_id, sale_id, amount, collected_by, collected_at, note)
    VALUES (v_shop_id, p_sale_id, p_amount, v_user_id, COALESCE(p_collected_at, now()), NULLIF(btrim(p_note), ''))
    RETURNING id INTO v_payment_id;

    -- amount_paid and payment_status are updated by the recompute trigger.
    RETURN v_payment_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_payment(uuid, numeric, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid, numeric, timestamptz, text) TO authenticated;

COMMENT ON FUNCTION public.record_payment(uuid, numeric, timestamptz, text) IS
    'Records one instalment against a sale under a row lock. Authorizes the caller internally; takes no shop_id.';

-- ---------------------------------------------------------------------------
-- record_sale(), with a customer and a ledger write
-- ---------------------------------------------------------------------------
-- Dropped rather than replaced: the parameter list grows by one, and
-- CREATE OR REPLACE cannot change a signature. Leaving the old three-argument
-- version in place would make a three-argument call ambiguous, so it goes.
-- Dropping also discards its grants, which are re-issued below.
DROP FUNCTION IF EXISTS public.record_sale(jsonb, text, numeric);

CREATE OR REPLACE FUNCTION public.record_sale(
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
    v_user_id       uuid;
    v_shop_id       uuid;
    v_role          text;
    v_sale_id       uuid;
    v_item          jsonb;
    v_product_id    uuid;
    v_qty_needed    integer;
    v_price_override numeric;
    v_batch         record;
    v_take          integer;
    v_unit_price    numeric;
    v_line_profit   numeric;
    v_total_amount  numeric := 0;
    v_total_profit  numeric := 0;
    v_amount_paid   numeric;
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
        RAISE EXCEPTION 'Role % may not record sales', v_role;
    END IF;

    IF p_payment_status NOT IN ('PAID', 'PARTIAL', 'CREDIT') THEN
        RAISE EXCEPTION 'Unknown payment status %', p_payment_status;
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'A sale needs at least one item';
    END IF;

    -- Same rule as products and batches: the customer must be ours. Checked
    -- before anything is written so a bad id fails the whole transaction.
    IF p_customer_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.customers
         WHERE id = p_customer_id AND shop_id = v_shop_id
    ) THEN
        RAISE EXCEPTION 'Customer % not found in this shop', p_customer_id;
    END IF;

    -- A debt with nobody attached to it cannot be collected later, and the
    -- shop discovers this only when trying to work out who owes them.
    IF p_payment_status IN ('CREDIT', 'PARTIAL') AND p_customer_id IS NULL THEN
        RAISE EXCEPTION 'A credit or partial sale needs a customer';
    END IF;

    INSERT INTO public.sales (shop_id, sold_by, customer_id, total_amount, total_profit, payment_status, amount_paid)
    VALUES (v_shop_id, v_user_id, p_customer_id, 0, 0, 'CREDIT', 0)
    RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id     := (v_item->>'product_id')::uuid;
        v_qty_needed     := (v_item->>'quantity')::integer;
        v_price_override := NULLIF(v_item->>'actual_selling_price', '')::numeric;

        IF v_product_id IS NULL THEN
            RAISE EXCEPTION 'Item is missing product_id';
        END IF;

        IF v_qty_needed IS NULL OR v_qty_needed <= 0 THEN
            RAISE EXCEPTION 'Quantity for product % must be greater than zero', v_product_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.products
             WHERE id = v_product_id AND shop_id = v_shop_id
        ) THEN
            RAISE EXCEPTION 'Product % not found in this shop', v_product_id;
        END IF;

        FOR v_batch IN
            SELECT id, quantity_remaining, capital_price, selling_price
              FROM public.stock_batches
             WHERE product_id = v_product_id
               AND shop_id    = v_shop_id
               AND quantity_remaining > 0
             ORDER BY received_date, created_at
               FOR UPDATE
        LOOP
            EXIT WHEN v_qty_needed = 0;

            v_take := LEAST(v_qty_needed, v_batch.quantity_remaining);

            v_unit_price  := COALESCE(v_price_override, v_batch.selling_price);
            v_line_profit := (v_unit_price - v_batch.capital_price) * v_take;

            INSERT INTO public.sale_items (
                sale_id, stock_batch_id, quantity,
                capital_price, suggested_price, actual_selling_price, profit
            )
            VALUES (
                v_sale_id, v_batch.id, v_take,
                v_batch.capital_price, v_batch.selling_price, v_unit_price, v_line_profit
            );

            UPDATE public.stock_batches
               SET quantity_remaining = quantity_remaining - v_take
             WHERE id = v_batch.id;

            v_total_amount := v_total_amount + (v_unit_price * v_take);
            v_total_profit := v_total_profit + v_line_profit;
            v_qty_needed   := v_qty_needed - v_take;
        END LOOP;

        IF v_qty_needed > 0 THEN
            RAISE EXCEPTION 'Not enough stock for product %: % more unit(s) needed',
                v_product_id, v_qty_needed;
        END IF;
    END LOOP;

    v_amount_paid := CASE p_payment_status
        WHEN 'PAID'   THEN v_total_amount
        WHEN 'CREDIT' THEN 0
        ELSE COALESCE(p_amount_paid, 0)
    END;

    IF p_payment_status = 'PARTIAL'
       AND (v_amount_paid <= 0 OR v_amount_paid >= v_total_amount) THEN
        RAISE EXCEPTION
            'A partial payment must be greater than 0 and less than the total of %',
            v_total_amount;
    END IF;

    -- Totals first: the recompute trigger compares the ledger against
    -- total_amount, so the total has to be correct before a payment exists.
    UPDATE public.sales
       SET total_amount = v_total_amount,
           total_profit = v_total_profit
     WHERE id = v_sale_id;

    IF v_amount_paid > 0 THEN
        -- The trigger derives amount_paid and payment_status from this row, so
        -- neither is set here. A cash sale is a sale plus a payment that
        -- happens to arrive immediately, which is what puts it in the daily
        -- collection figure alongside utang payments.
        INSERT INTO public.sale_payments (shop_id, sale_id, amount, collected_by, collected_at)
        VALUES (v_shop_id, v_sale_id, v_amount_paid, v_user_id, now());
    ELSE
        -- No payment row means no trigger, so the status is set directly. The
        -- >= keeps a zero-total sale out of CREDIT: nothing is owed on it.
        UPDATE public.sales
           SET payment_status = CASE WHEN 0 >= v_total_amount THEN 'PAID' ELSE 'CREDIT' END
         WHERE id = v_sale_id;
    END IF;

    RETURN v_sale_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_sale(jsonb, text, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sale(jsonb, text, numeric, uuid) TO authenticated;

COMMENT ON FUNCTION public.record_sale(jsonb, text, numeric, uuid) IS
    'Records one sale with FIFO batch deduction under row locks, writing any payment through sale_payments. Authorizes the caller internally; takes no shop_id.';
