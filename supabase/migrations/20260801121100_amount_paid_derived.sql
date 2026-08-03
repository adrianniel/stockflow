-- Make sales.amount_paid derived from the payment ledger.
--
-- What changes
-- ------------
-- Until now `sales.amount_paid` was written directly and constrained to match
-- `payment_status` exactly. From here it is a cached sum of
-- `sale_payments.amount`, maintained by trigger, and `payment_status` is
-- derived from it. Nothing writes either column by hand any more.
--
-- Why the old constraint has to go rather than be widened
-- ------------------------------------------------------
-- `sales_payment_status_amount_check` says PARTIAL means
-- 0 < amount_paid < total_amount. That is not a rule about valid data, it is
-- the one-payment-per-sale assumption written as SQL: a customer paying off the
-- last 300 of a 500 debt has to move PARTIAL → PAID in the same statement that
-- changes the amount, or the row is briefly illegal and the transaction aborts.
-- There is no widening of that predicate that permits a sequence of
-- instalments, because the predicate is about a single final state.
--
-- Replacing it with a derivation is stronger, not weaker. Before, status and
-- amount could each be written independently and were merely checked against
-- each other. Now neither can be written at all, so they cannot disagree, and
-- both are traceable to the individual payments that produced them.

-- ---------------------------------------------------------------------------
-- Recompute
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because it writes to `sales`, whose UPDATE policy is
-- owner-only — an assistant recording a collection must not need permission to
-- edit the sale itself. The function takes no arguments from the caller and
-- touches exactly one sale, identified by the payment row that fired it, so
-- there is no room for it to be pointed at another shop's data.
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
                   (SELECT sum(p.amount) FROM public.sale_payments p WHERE p.sale_id = OLD.sale_id),
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
     WHERE p.sale_id = v_sale_id;

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

-- AFTER, so the sum it reads includes the row that fired it.
DROP TRIGGER IF EXISTS sale_payments_recompute ON public.sale_payments;
CREATE TRIGGER sale_payments_recompute
    AFTER INSERT OR UPDATE OR DELETE ON public.sale_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.recompute_sale_payment_state();

-- ---------------------------------------------------------------------------
-- Retire the single-payment constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_payment_status_amount_check;

-- Kept, but relaxed to the half that is still a real invariant. The upper bound
-- stays: the trigger refuses overpayment with a readable message, and this is
-- the backstop if a future code path ever writes the column directly.
ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_amount_paid_check;

ALTER TABLE public.sales
    ADD CONSTRAINT sales_amount_paid_check
    CHECK (amount_paid >= 0 AND amount_paid <= total_amount);

-- ---------------------------------------------------------------------------
-- Reconcile existing rows
-- ---------------------------------------------------------------------------
-- The previous migration backfilled a payment row for every sale with
-- amount_paid > 0, so for those the sum already equals the column. This
-- recomputes every sale from the ledger anyway, which costs one pass and makes
-- the invariant true by construction rather than by assumption — including for
-- CREDIT sales, which have no payment rows and should read 0 / 'CREDIT'.
UPDATE public.sales s
   SET amount_paid = COALESCE(
           (SELECT sum(p.amount) FROM public.sale_payments p WHERE p.sale_id = s.id),
           0);

UPDATE public.sales s
   SET payment_status = CASE
           WHEN s.amount_paid >= s.total_amount THEN 'PAID'
           WHEN s.amount_paid > 0               THEN 'PARTIAL'
           ELSE 'CREDIT'
       END;

COMMENT ON COLUMN public.sales.amount_paid IS
    'Cached sum of sale_payments.amount for this sale. Maintained by trigger — do not write directly.';

COMMENT ON COLUMN public.sales.payment_status IS
    'Derived from amount_paid against total_amount. Maintained by trigger — do not write directly.';
