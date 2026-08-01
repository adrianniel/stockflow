-- record_sale(): the whole sales transaction, FIFO deduction included.
--
-- Why this is a database function and not application code
-- --------------------------------------------------------
-- FIFO deduction is read-then-write: find the oldest batch with stock, then
-- reduce it. Done from the application, two clerks selling the last few units at
-- the same time both read "5 remaining", both decide their sale fits, and both
-- write — overselling stock that does not exist and recording profit against it.
-- No amount of application-side care fixes this, because the gap between the
-- read and the write is where the race lives.
--
-- Inside a function, `SELECT ... FOR UPDATE` locks each batch row as it is
-- claimed, so the second transaction waits and then re-reads the true
-- remaining quantity. The whole sale is also one transaction: either every line
-- item is deducted and the sale is written, or nothing is.
--
-- Why SECURITY DEFINER, and how tenant isolation is preserved
-- ----------------------------------------------------------
-- Recording a sale has to decrement stock_batches.quantity_remaining, but the
-- UPDATE policy on stock_batches is owner-only — assistants can sell, and must
-- not be able to edit batch prices. An invoker-rights function would therefore
-- fail for exactly the role that uses the till most.
--
-- So this runs as definer and does the authorization itself, which means the
-- checks below are load-bearing rather than defence in depth:
--   * the caller is resolved from auth.uid(), never from a parameter
--   * the caller must have role OWNER or ASSISTANT
--   * every batch touched must belong to the caller's shop, enforced in the
--     WHERE clause of the FIFO query rather than checked afterwards
--   * the sale is written with the caller's own shop_id
-- A caller cannot name another shop's batch, because shop_id is never accepted
-- as an argument.
--
-- Input shape
-- -----------
-- p_items is a JSON array. One entry per product being sold:
--   [{"product_id": "uuid", "quantity": 3, "actual_selling_price": 950.00}, ...]
-- actual_selling_price is optional and overrides the batch's selling price when
-- present, which is how manual discounts are applied. It may be below capital
-- price; that records a real loss and is allowed.
--
-- One entry may consume several batches. Each batch consumed becomes its own
-- sale_items row, so the exact batch behind every unit stays traceable and
-- profit is computed against the capital price actually paid for those units.

CREATE OR REPLACE FUNCTION public.record_sale(
    p_items          jsonb,
    p_payment_status text DEFAULT 'PAID',
    p_amount_paid    numeric DEFAULT NULL
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
    -- Caller identity comes from the session, never from an argument.
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

    INSERT INTO public.sales (shop_id, sold_by, total_amount, total_profit, payment_status, amount_paid)
    VALUES (v_shop_id, v_user_id, 0, 0, 'PAID', 0)
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

        -- Confirm the product is ours before reporting anything about its stock,
        -- so the error cannot be used to probe other shops' catalogues.
        IF NOT EXISTS (
            SELECT 1 FROM public.products
             WHERE id = v_product_id AND shop_id = v_shop_id
        ) THEN
            RAISE EXCEPTION 'Product % not found in this shop', v_product_id;
        END IF;

        -- FIFO: oldest received batch first, created_at breaking same-day ties.
        -- FOR UPDATE holds each row until this transaction ends, so a
        -- concurrent sale cannot claim the same units.
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

            -- Override applies to every unit of this line, across batches, so
            -- the customer is charged the agreed price regardless of which
            -- batches happened to fill it.
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

    -- PAID and CREDIT are fully determined by the total, so only PARTIAL needs
    -- an explicit amount from the caller.
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

    UPDATE public.sales
       SET total_amount   = v_total_amount,
           total_profit   = v_total_profit,
           payment_status = p_payment_status,
           amount_paid    = v_amount_paid
     WHERE id = v_sale_id;

    RETURN v_sale_id;
END;
$function$;

-- anon is deliberately excluded: recording a sale requires a resolved user.
REVOKE ALL ON FUNCTION public.record_sale(jsonb, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sale(jsonb, text, numeric) TO authenticated;

COMMENT ON FUNCTION public.record_sale(jsonb, text, numeric) IS
    'Records one sale with FIFO batch deduction under row locks. Authorizes the caller internally; takes no shop_id.';
