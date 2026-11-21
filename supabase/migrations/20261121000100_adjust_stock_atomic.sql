-- Atomic stock adjustment.
--
-- The Adjust Stock form used to make three separate PostgREST calls:
--   1. read the batch's quantity_remaining,
--   2. insert the stock_adjustments row,
--   3. write back an absolute quantity_remaining computed in the app.
-- Nothing locked the batch between those steps, so two problems appeared in
-- live data:
--   * A sale between steps 1 and 3 was overwritten. The app wrote "old +
--     change" over the till's deduction, and units that had been sold showed
--     up as stock again.
--   * When step 3 failed (for example when an addition would push
--     quantity_remaining above quantity_received), the audit row from step 2
--     stayed, but the stock did not change.
--
-- adjust_stock() does the same work in one transaction. It locks the batch row
-- (the same FOR UPDATE lock record_sale() and void_sale() take), applies the
-- change relatively (quantity_remaining = quantity_remaining + change), and
-- inserts the audit row. Either both writes happen, or neither does.
--
-- Purely additive and safe for existing data:
--   * Creates one new function. It changes no table, column, constraint,
--     policy, trigger, or existing function.
--   * Touches no existing row. It only acts when someone submits a new
--     adjustment, and does exactly what the form already intended.
--   * The rules match today's app and schema: OWNER only, a non-zero whole
--     number, a reason of 300 characters or fewer, never below zero, never
--     above quantity_received (the existing CHECK
--     stock_batches_remaining_within_received).
--   * The currently deployed app keeps working with or without it.

CREATE OR REPLACE FUNCTION public.adjust_stock(
    p_stock_batch_id  uuid,
    p_quantity_change integer,
    p_reason          text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id        uuid;
    v_shop_id        uuid;
    v_role           text;
    v_status         text;
    v_reason         text;
    v_remaining      integer;
    v_received       integer;
    v_next           integer;
    v_adjustment_id  uuid;
BEGIN
    SELECT id, shop_id, role, status
      INTO v_user_id, v_shop_id, v_role, v_status
      FROM public.users
     WHERE auth_id = auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user profile for the current session';
    END IF;

    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Your account is not assigned to a shop';
    END IF;

    IF v_status IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION 'This account is inactive';
    END IF;

    IF v_role <> 'OWNER' THEN
        RAISE EXCEPTION 'Only the shop owner can adjust stock';
    END IF;

    IF p_stock_batch_id IS NULL THEN
        RAISE EXCEPTION 'Choose a batch.';
    END IF;

    IF p_quantity_change IS NULL OR p_quantity_change = 0 THEN
        RAISE EXCEPTION 'Enter how many units to add or remove, not zero.';
    END IF;

    v_reason := NULLIF(btrim(p_reason), '');

    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'An adjustment needs a reason.';
    END IF;

    IF length(v_reason) > 300 THEN
        RAISE EXCEPTION 'Keep the reason under 300 characters.';
    END IF;

    -- The lock is what fixes the race: a concurrent sale or void on this
    -- batch waits here (or this waits for it), so the change below always
    -- applies to the latest quantity.
    SELECT quantity_remaining, quantity_received
      INTO v_remaining, v_received
      FROM public.stock_batches
     WHERE id = p_stock_batch_id
       AND shop_id = v_shop_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'That batch could not be found in your shop.';
    END IF;

    v_next := v_remaining + p_quantity_change;

    IF v_next < 0 THEN
        RAISE EXCEPTION
            'That would leave % units. The batch only has % on hand.',
            v_next, v_remaining;
    END IF;

    IF v_next > v_received THEN
        RAISE EXCEPTION
            'That would leave % units, but only % ever arrived in this batch. Receive new stock as a new batch instead.',
            v_next, v_received;
    END IF;

    INSERT INTO public.stock_adjustments (
        shop_id, stock_batch_id, quantity_change, reason, adjusted_by
    )
    VALUES (
        v_shop_id, p_stock_batch_id, p_quantity_change, v_reason, v_user_id
    )
    RETURNING id INTO v_adjustment_id;

    UPDATE public.stock_batches
       SET quantity_remaining = quantity_remaining + p_quantity_change
     WHERE id = p_stock_batch_id
       AND shop_id = v_shop_id;

    RETURN jsonb_build_object(
        'adjustment_id',      v_adjustment_id,
        'quantity_remaining', v_next
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.adjust_stock(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_stock(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer, text) TO authenticated;

COMMENT ON FUNCTION public.adjust_stock(uuid, integer, text) IS
    'Owner-only stock correction. Locks the batch, applies the change relatively, and writes the stock_adjustments audit row in the same transaction. Takes no shop_id; authorizes the caller internally.';
