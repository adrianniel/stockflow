-- Voiding a recorded sale.
--
-- What this adds
-- --------------
-- A sale can be cancelled without being deleted. The row stays, marked with
-- when it was voided, by whom, and why; the stock it consumed goes back to the
-- batches it came from; the payments taken against it are marked voided rather
-- than removed; and every report treats it as though the sale never happened.
--
-- Why not DELETE
-- --------------
-- `sale_items` and `sale_payments` both cascade from `sales`. A DELETE would
-- therefore take the line items, the batch links, the profit figures and the
-- payment history with it, leaving nothing behind that says a transaction was
-- ever recorded — and nothing to reconcile against when the day's cash does not
-- match the day's report. Stock would also have to be restored by hand, since
-- nothing would remain to say which batches were deducted.
--
-- Why payments are marked, not deleted
-- ------------------------------------
-- Three options were on the table:
--
--   1. DELETE the sale_payments rows. Simple, and the existing recompute
--      trigger drops amount_paid to 0 on its own. But it destroys the record
--      that money was ever taken — exactly the audit history a void is supposed
--      to preserve — and leaves no way to answer "the drawer was 500 over on
--      Tuesday, why?"
--
--   2. Insert a negative reversal row. Full double-entry history, and the
--      collection stays on the day it happened with the refund on the day it
--      was returned. But `sale_payments_amount_check` requires amount > 0, so
--      this needs that constraint relaxed for every code path, not just this
--      one — after which a stray negative payment can be inserted straight
--      through PostgREST by any owner or assistant. It also puts negative rows
--      into the daily collections list, which needs its own handling
--      everywhere collections are shown.
--
--   3. Mark the payment voided and exclude it. Chosen. The row survives intact
--      — amount, date, who collected it, note — so the history is fully
--      readable on the sale. `amount > 0` stays in force. No new sign
--      conventions leak into reports.
--
-- The cost of (3) is that a collection taken on an earlier day drops out of
-- that earlier day's figures when the sale is voided later. That is a real
-- trade, and it is the reason (2) exists. It is acceptable here because the
-- dominant case is a cash sale rung up wrong: record_sale() writes the payment
-- with the same timestamp as the sale, so voiding it the same day moves no
-- historical number at all. The cross-day case is a part-collected credit sale
-- that later turns out to be a mistake, which is rare and which the void reason
-- on the sale explains. If the shop starts doing genuine refunds — money handed
-- back over the counter on a later day — that is when (2) becomes the right
-- model, and it is an additive change from here.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
    ADD COLUMN IF NOT EXISTS voided_by   uuid,
    ADD COLUMN IF NOT EXISTS void_reason text;

-- Named explicitly rather than left to Postgres. `sales` now has two foreign
-- keys to `users` (sold_by and voided_by), which makes the PostgREST embed
-- `users ( name )` ambiguous — every such select has to name the relationship
-- it means. The app spells them `users!sales_sold_by_fkey` and
-- `users!sales_voided_by_fkey`, so these names are part of its contract and
-- must not be left to chance.
ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_voided_by_fkey;

ALTER TABLE public.sales
    ADD CONSTRAINT sales_voided_by_fkey
    FOREIGN KEY (voided_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- A void is a timestamp and a reason together. `voided_by` is deliberately not
-- in the predicate: it is ON DELETE SET NULL, so removing the staff account
-- that voided a sale must not retroactively invalidate the row.
ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_void_reason_required;

ALTER TABLE public.sales
    ADD CONSTRAINT sales_void_reason_required
    CHECK (
        (voided_at IS NULL     AND void_reason IS NULL)
     OR (voided_at IS NOT NULL AND btrim(coalesce(void_reason, '')) <> '')
    );

ALTER TABLE public.sale_payments
    ADD COLUMN IF NOT EXISTS voided_at timestamptz;

COMMENT ON COLUMN public.sales.voided_at IS
    'Set when the sale is cancelled. A non-NULL value means every report must skip this row.';

COMMENT ON COLUMN public.sales.voided_by IS
    'Owner who voided the sale. NULL only if that account was later removed.';

COMMENT ON COLUMN public.sales.void_reason IS
    'Why the sale was cancelled. Required whenever voided_at is set.';

COMMENT ON COLUMN public.sale_payments.voided_at IS
    'Set when the parent sale is voided. The row is kept for history but is excluded from amount_paid and from collection reports.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- Partial, because every reporting query now carries `voided_at IS NULL` and
-- voided rows are a rounding error in the row count. Indexing only the live
-- rows keeps these smaller than the full-table equivalents and lets the planner
-- use them without re-checking the predicate.
CREATE INDEX IF NOT EXISTS idx_sales_shop_live
    ON public.sales (shop_id, sale_date)
    WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sale_payments_shop_collected_live
    ON public.sale_payments (shop_id, collected_at)
    WHERE voided_at IS NULL;

-- ---------------------------------------------------------------------------
-- The ledger sum skips voided payments
-- ---------------------------------------------------------------------------
-- One clause changes in each of the three sums: `AND p.voided_at IS NULL`.
-- That is what makes marking a payment voided equivalent to removing it as far
-- as `amount_paid` and `payment_status` are concerned, while the row itself
-- stays readable.
--
-- CREATE OR REPLACE, so nothing about the trigger changes and no grants are
-- re-issued. Because the shape is identical before and after, the only way to
-- tell whether this ran is to read the body — docs/verify-setup.sql does.
CREATE OR REPLACE FUNCTION public.recompute_sale_payment_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_sale_id uuid;
    v_total   numeric;
    v_paid    numeric;
    v_status  text;
BEGIN
    -- On DELETE the surviving row is OLD; on INSERT/UPDATE it is NEW. An UPDATE
    -- that moves a payment between sales has to fix both, so it recurses once
    -- through the OLD sale before handling the new one.
    v_sale_id := COALESCE(NEW.sale_id, OLD.sale_id);

    IF TG_OP = 'UPDATE' AND OLD.sale_id IS DISTINCT FROM NEW.sale_id THEN
        UPDATE public.sales s
           SET amount_paid = COALESCE(
                   (SELECT sum(p.amount) FROM public.sale_payments p
                     WHERE p.sale_id = OLD.sale_id AND p.voided_at IS NULL),
                   0)
         WHERE s.id = OLD.sale_id;

        UPDATE public.sales s
           SET payment_status = CASE
                   WHEN s.amount_paid >= s.total_amount THEN 'PAID'
                   WHEN s.amount_paid > 0               THEN 'PARTIAL'
                   ELSE 'CREDIT'
               END
         WHERE s.id = OLD.sale_id;
    END IF;

    SELECT s.total_amount INTO v_total
      FROM public.sales s
     WHERE s.id = v_sale_id
       FOR UPDATE;

    SELECT COALESCE(sum(p.amount), 0) INTO v_paid
      FROM public.sale_payments p
     WHERE p.sale_id = v_sale_id
       AND p.voided_at IS NULL;

    -- Overpayment is refused here rather than silently capped, because the two
    -- realistic causes — a typo, and change owed to the customer — both need a
    -- human decision, and quietly storing the wrong number hides both.
    IF v_paid > v_total THEN
        RAISE EXCEPTION
            'Payments of % exceed the sale total of %. Collect at most the outstanding balance.',
            v_paid, v_total;
    END IF;

    -- A zero-total sale is settled by definition, so the >= test has to come
    -- first: 0 >= 0 is PAID, not CREDIT.
    v_status := CASE
        WHEN v_paid >= v_total THEN 'PAID'
        WHEN v_paid > 0        THEN 'PARTIAL'
        ELSE 'CREDIT'
    END;

    UPDATE public.sales
       SET amount_paid    = v_paid,
           payment_status = v_status
     WHERE id = v_sale_id;

    RETURN NULL;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Collecting against a voided sale is refused
-- ---------------------------------------------------------------------------
-- Without this, a voided credit sale still looks collectable to record_payment:
-- voiding its payments leaves amount_paid at 0 and payment_status at 'CREDIT',
-- which is exactly the state an uncollected debt is in. The check goes after
-- the row lock so the answer cannot change underneath it.
--
-- Signature unchanged, so this is a replace and the existing grants stand.
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
    v_voided_at   timestamptz;
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

-- ---------------------------------------------------------------------------
-- void_sale()
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER for the same reason as record_sale and record_payment: this
-- writes to `sales`, `stock_batches`, `sale_payments` and `stock_adjustments`
-- in one transaction, and PostgREST cannot express a transaction. The
-- authorization is done here and is load-bearing:
--   * the caller is resolved from auth.uid(), never passed in
--   * the caller must be OWNER — an assistant may take money but may not undo
--     a recorded transaction, which matches the sale_payments UPDATE/DELETE
--     policies already in place
--   * the sale must belong to the caller's own shop, checked in the statement
--     that locks it, so another shop's id reads as not found
--   * no shop_id argument exists to spoof
--
-- Lock order is sale first, then batches by id ascending — the same order
-- record_sale() takes (it holds the row lock on the sale it just inserted
-- before it touches any batch). Two functions that acquire the same locks in
-- the same order cannot deadlock against each other, and voiding two different
-- sales that share a batch serializes on the batch.
CREATE OR REPLACE FUNCTION public.void_sale(
    p_sale_id uuid,
    p_reason  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id          uuid;
    v_shop_id          uuid;
    v_role             text;
    v_reason           text;
    v_voided_at        timestamptz;
    v_over             record;
    v_batch            record;
    v_restored_units   integer := 0;
    v_restored_batches integer := 0;
    v_orphan_lines     integer := 0;
    v_voided_payments  integer := 0;
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
        RAISE EXCEPTION 'Role % may not void sales', v_role;
    END IF;

    v_reason := NULLIF(btrim(p_reason), '');

    IF v_reason IS NULL THEN
        RAISE EXCEPTION 'A void needs a reason';
    END IF;

    IF length(v_reason) > 300 THEN
        RAISE EXCEPTION 'Keep the void reason under 300 characters';
    END IF;

    SELECT voided_at INTO v_voided_at
      FROM public.sales
     WHERE id = p_sale_id
       AND shop_id = v_shop_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sale % not found in this shop', p_sale_id;
    END IF;

    IF v_voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'This sale was already voided';
    END IF;

    -- Every batch the sale touched, locked once, in id order, before anything
    -- is read for the capacity check below. Reading first and locking later
    -- would let a concurrent sale take the stock in between.
    PERFORM b.id
       FROM public.stock_batches b
      WHERE b.shop_id = v_shop_id
        AND b.id IN (
            SELECT si.stock_batch_id
              FROM public.sale_items si
             WHERE si.sale_id = p_sale_id
               AND si.stock_batch_id IS NOT NULL
        )
      ORDER BY b.id
        FOR UPDATE;

    -- Refuse rather than partially restore. `quantity_received` is fixed at
    -- arrival and `stock_batches_remaining_within_received` enforces the
    -- ceiling, so a batch that cannot take its units back has already had them
    -- put back another way — most likely a manual adjustment made to paper over
    -- this very sale. Restoring the rest and silently dropping this batch would
    -- leave inventory wrong with nothing on screen to say so; stopping here
    -- names the batch and leaves the owner in control.
    SELECT b.batch_number, b.quantity_received, b.quantity_remaining, r.units
      INTO v_over
      FROM (
          SELECT si.stock_batch_id AS batch_id, sum(si.quantity)::integer AS units
            FROM public.sale_items si
           WHERE si.sale_id = p_sale_id
             AND si.stock_batch_id IS NOT NULL
           GROUP BY si.stock_batch_id
      ) r
      JOIN public.stock_batches b ON b.id = r.batch_id
     WHERE b.quantity_remaining + r.units > b.quantity_received
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION
            'Returning % unit(s) to batch % would leave it holding % of the % that ever arrived. Correct that batch with a stock adjustment first, then void.',
            v_over.units, v_over.batch_number,
            v_over.quantity_remaining + v_over.units, v_over.quantity_received;
    END IF;

    -- Grouped by batch, not by line: a sale that hit one batch twice produces
    -- one adjustment row saying how much came back, which is what the stock
    -- history should read like.
    FOR v_batch IN
        SELECT si.stock_batch_id AS batch_id, sum(si.quantity)::integer AS units
          FROM public.sale_items si
         WHERE si.sale_id = p_sale_id
           AND si.stock_batch_id IS NOT NULL
         GROUP BY si.stock_batch_id
         ORDER BY si.stock_batch_id
    LOOP
        UPDATE public.stock_batches
           SET quantity_remaining = quantity_remaining + v_batch.units
         WHERE id = v_batch.batch_id;

        -- The audit trail for the stock half of the void. stock_adjustments is
        -- already where every non-sale inventory movement is recorded, and a
        -- restore is exactly that, so it shows up in the existing adjustments
        -- log without any new place to look.
        INSERT INTO public.stock_adjustments (
            shop_id, stock_batch_id, quantity_change, reason, adjusted_by
        )
        VALUES (
            v_shop_id, v_batch.batch_id, v_batch.units,
            'Sale voided: ' || v_reason, v_user_id
        );

        v_restored_units   := v_restored_units + v_batch.units;
        v_restored_batches := v_restored_batches + 1;
    END LOOP;

    -- Lines whose batch was deleted afterwards. `sale_items.stock_batch_id` is
    -- ON DELETE SET NULL, so there is no batch left to credit. Counted and
    -- reported rather than ignored, because the difference between "stock came
    -- back" and "stock could not come back" is the shop's to know.
    SELECT count(*) INTO v_orphan_lines
      FROM public.sale_items si
     WHERE si.sale_id = p_sale_id
       AND si.stock_batch_id IS NULL;

    -- Fires recompute_sale_payment_state() once per row, which now sums only
    -- live payments — so amount_paid falls to 0 and payment_status becomes
    -- CREDIT. That reads oddly on its own, which is why the UI shows a voided
    -- sale as voided instead of showing its payment status at all.
    UPDATE public.sale_payments
       SET voided_at = now()
     WHERE sale_id = p_sale_id
       AND voided_at IS NULL;

    GET DIAGNOSTICS v_voided_payments = ROW_COUNT;

    UPDATE public.sales
       SET voided_at   = now(),
           voided_by   = v_user_id,
           void_reason = v_reason
     WHERE id = p_sale_id;

    RETURN jsonb_build_object(
        'restored_units',   v_restored_units,
        'restored_batches', v_restored_batches,
        'orphan_lines',     v_orphan_lines,
        'voided_payments',  v_voided_payments
    );
END;
$function$;

-- A new function, so unlike the two replaces above this one needs its grants
-- issued: CREATE FUNCTION starts with EXECUTE granted to PUBLIC.
REVOKE ALL ON FUNCTION public.void_sale(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.void_sale(uuid, text) IS
    'Cancels a sale without deleting it: restores its stock to the original batches, marks its payments voided, and records the reason. Owner-only, authorizes the caller internally; takes no shop_id.';

COMMENT ON FUNCTION public.record_payment(uuid, numeric, timestamptz, text) IS
    'Records one instalment against a live sale under a row lock. Refuses voided sales. Authorizes the caller internally; takes no shop_id.';
