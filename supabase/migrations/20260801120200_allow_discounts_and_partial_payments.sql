-- Allow below-cost sales, and record how much was actually paid.
--
-- Two related problems, both in the sales path:
--
-- 1. `sale_items.profit >= 0` and `sales.total_profit >= 0` make a loss
--    impossible to store. SRS 10 requires manual price adjustment, and a shop
--    that discounts a slow-moving part below capital price has taken a real
--    loss — the system has to be able to record that honestly rather than
--    refuse the transaction. Reports are the place to surface it, not a CHECK.
--
-- 2. `payment_status` can be 'PARTIAL', but there is nowhere to put the partial
--    amount, so a partial payment is indistinguishable from an unpaid one.
--    `amount_paid` fills that gap.
--
-- `total_amount >= 0` is kept: a sale's gross value is a sum of quantities
-- times prices, and a negative total would mean a refund, which is a different
-- transaction type and out of MVP scope.

ALTER TABLE public.sale_items
    DROP CONSTRAINT IF EXISTS sale_items_profit_check;

ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_total_profit_check;

-- Defaults to 0 rather than total_amount: a column default cannot reference
-- another column, and 0 is the safer wrong answer (an unpaid sale that looks
-- unpaid) than a full amount (an unpaid sale that looks settled). record_sale()
-- sets this explicitly.
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0;

-- Backfill existing rows before adding the check below. Without this, any sale
-- already recorded as PAID (amount_paid would default to 0) would violate
-- sales_payment_status_amount_check and abort the migration. A sale that was
-- settled when it was made stays settled.
UPDATE public.sales
   SET amount_paid = total_amount
 WHERE payment_status = 'PAID';

UPDATE public.sales
   SET amount_paid = 0
 WHERE payment_status = 'CREDIT';

ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_amount_paid_check;

ALTER TABLE public.sales
    ADD CONSTRAINT sales_amount_paid_check
    CHECK (amount_paid >= 0 AND amount_paid <= total_amount);

-- Keeps payment_status honest against amount_paid, so the two cannot drift into
-- states like "PAID but nothing paid" or "CREDIT with the full amount paid".
ALTER TABLE public.sales
    DROP CONSTRAINT IF EXISTS sales_payment_status_amount_check;

ALTER TABLE public.sales
    ADD CONSTRAINT sales_payment_status_amount_check
    CHECK (
        (payment_status = 'PAID'    AND amount_paid = total_amount)
     OR (payment_status = 'CREDIT'  AND amount_paid = 0)
     OR (payment_status = 'PARTIAL' AND amount_paid > 0 AND amount_paid < total_amount)
    );

COMMENT ON COLUMN public.sales.amount_paid IS
    'Cash actually received. Equals total_amount when PAID, 0 when CREDIT, strictly between for PARTIAL.';

COMMENT ON COLUMN public.sales.total_profit IS
    'Sum of sale_items.profit. May be negative when items were discounted below capital price.';
