-- record_sale(): let a sale line name the batch it comes out of.
--
-- Why
-- ---
-- Until now the till named a product and record_sale() chose the batches,
-- oldest first. That is the right default and stays the default. But a shop
-- sometimes needs to sell from a specific arrival — the older stock is at the
-- back of the shelf, a customer is matching a part they bought before, or the
-- newer batch is the one physically in reach. There was no way to say so.
--
-- What changes
-- ------------
-- Each entry in p_items may now carry an optional `stock_batch_id`.
--
--   present  -> that batch is deducted, and only that batch. If it is short the
--               whole sale is refused rather than spilling into another batch:
--               the user picked this one, and quietly taking units from a
--               different batch would book a different capital price than the
--               one they were shown. The till adds the product a second time on
--               another batch instead, which is one more sale_items row and
--               exactly what the data model already expresses.
--   absent   -> the FIFO loop below, unchanged. Old clients, and any cart line
--               where the user did not care, behave exactly as before.
--
-- FIFO is therefore not replaced. It is the fallback, and it remains what the
-- UI pre-selects.
--
-- Signature is unchanged, so this is a CREATE OR REPLACE: no DROP, no re-issued
-- grants, and no window where two overloads could both match a call.
--
-- Nothing is migrated. No existing sale, sale_item or stock_batch row is read
-- or written by this file — it only redefines a function.
--
-- Locking
-- -------
-- The old version locked each product's batches in (received_date, created_at)
-- order as it reached them. With explicit batches the order a sale touches
-- rows in is the order the user happened to build the cart, so two tills
-- selling the same two batches in opposite orders could deadlock and Postgres
-- would abort one of them.
--
-- So every row the sale could possibly touch is locked once, up front, ordered
-- by id. Every concurrent sale therefore takes its locks in the same order and
-- the cycle cannot form. The inner statements keep their own FOR UPDATE: those
-- rows are already held by this transaction, so re-locking costs nothing and
-- the loops stay correct if read on their own.

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
    v_batch_id      uuid;
    v_qty_needed    integer;
    v_price_override numeric;
    v_batch         record;
    v_take          integer;
    v_unit_price    numeric;
    v_line_profit   numeric;
    v_total_amount  numeric := 0;
    v_total_profit  numeric := 0;
    v_amount_paid   numeric;
    v_product_ids   uuid[];
    v_batch_ids     uuid[];
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

    -- Every row this sale could touch, locked once in id order. See the header:
    -- this is what stops two tills building carts in opposite orders from
    -- deadlocking. Explicitly named batches are included even when empty, so a
    -- line naming a sold-out batch fails on its own quantity check below rather
    -- than racing another sale for it.
    SELECT COALESCE(array_agg(DISTINCT (elem->>'product_id')::uuid), '{}'::uuid[])
      INTO v_product_ids
      FROM jsonb_array_elements(p_items) AS elem
     WHERE NULLIF(elem->>'product_id', '') IS NOT NULL;

    SELECT COALESCE(array_agg(DISTINCT (elem->>'stock_batch_id')::uuid), '{}'::uuid[])
      INTO v_batch_ids
      FROM jsonb_array_elements(p_items) AS elem
     WHERE NULLIF(elem->>'stock_batch_id', '') IS NOT NULL;

    PERFORM id
       FROM public.stock_batches
      WHERE shop_id = v_shop_id
        AND (
              id = ANY(v_batch_ids)
              OR (product_id = ANY(v_product_ids) AND quantity_remaining > 0)
            )
      ORDER BY id
        FOR UPDATE;

    INSERT INTO public.sales (shop_id, sold_by, customer_id, total_amount, total_profit, payment_status, amount_paid)
    VALUES (v_shop_id, v_user_id, p_customer_id, 0, 0, 'CREDIT', 0)
    RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id     := (v_item->>'product_id')::uuid;
        v_batch_id       := NULLIF(v_item->>'stock_batch_id', '')::uuid;
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

        IF v_batch_id IS NOT NULL THEN
            -- The shop and product checks are in the same statement that locks
            -- the row, and both are load-bearing. Without shop_id a caller
            -- could name another shop's batch; without product_id they could
            -- deduct a batch that has nothing to do with the product on the
            -- line, and the sale_items row would then disagree with itself.
            SELECT id, batch_number, quantity_remaining, capital_price, selling_price
              INTO v_batch
              FROM public.stock_batches
             WHERE id         = v_batch_id
               AND shop_id    = v_shop_id
               AND product_id = v_product_id
               FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'The chosen batch does not belong to this product';
            END IF;

            -- Refused rather than topped up from another batch. See the header.
            IF v_batch.quantity_remaining < v_qty_needed THEN
                RAISE EXCEPTION
                    'Batch % has only % unit(s) left but % were requested. Add the product again on another batch for the rest.',
                    v_batch.batch_number, v_batch.quantity_remaining, v_qty_needed;
            END IF;

            v_take        := v_qty_needed;
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

            CONTINUE;
        END IF;

        -- No batch named: oldest first, exactly as before.
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

COMMENT ON FUNCTION public.record_sale(jsonb, text, numeric, uuid) IS
    'Records one sale under row locks, writing any payment through sale_payments. Each item may name a stock_batch_id to deduct from; without one the batches are taken oldest first (FIFO). Authorizes the caller internally; takes no shop_id.';
