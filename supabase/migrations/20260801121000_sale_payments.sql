-- sale_payments: one row per instalment a customer hands over.
--
-- The problem with the current design
-- -----------------------------------
-- `sales.amount_paid` is a single number, so it can record *how much* has been
-- paid but nothing about *when* or *by whom it was received*. Real utang is
-- paid down in instalments — 200 today, 500 next week — and the shop owner's
-- question at the end of the day is "how much cash came in today", which a
-- running total cannot answer.
--
-- Worse, `sales_payment_status_amount_check` (20260801120200) hardcodes
-- one-payment-per-sale: PARTIAL requires 0 < amount_paid < total_amount, so a
-- second instalment that settles the balance has to flip the row to PAID in the
-- same statement or violate the constraint. That constraint is dropped in the
-- next migration, once this table exists to hold the detail.
--
-- Design notes
-- ------------
-- `shop_id` is denormalized onto this table, unlike sale_items which reaches
-- its tenant through sales. That is a deliberate difference: the daily report
-- asks "payments in this shop between these dates", which with no shop_id is a
-- join to sales on every row of the hot path. One uuid per payment buys a
-- straight index scan. The trigger below keeps it honest so it cannot disagree
-- with the parent sale.
--
-- `collected_at` is separate from `created_at` because they answer different
-- questions. created_at is when the row was typed in; collected_at is when the
-- money changed hands. They differ whenever a payment is entered the next
-- morning, and only collected_at belongs in a daily collection report.
--
-- Text and numbers only. A payment is an amount, a timestamp, and an optional
-- short note — no receipt images.

CREATE TABLE IF NOT EXISTS public.sale_payments (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id       uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    -- CASCADE: deleting a sale removes its payments with it, the same way
    -- sale_items are removed. A payment against a sale that no longer exists is
    -- not a meaningful record.
    sale_id       uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    amount        numeric NOT NULL CHECK (amount > 0),
    collected_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
    collected_at  timestamptz NOT NULL DEFAULT now(),
    note          text,
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- The report hot path: sum payments for one shop over a date range.
CREATE INDEX IF NOT EXISTS idx_sale_payments_shop_collected
    ON public.sale_payments (shop_id, collected_at);

-- The sale detail page: every instalment against one sale, oldest first.
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale_id
    ON public.sale_payments (sale_id, collected_at);

-- ---------------------------------------------------------------------------
-- shop_id cannot disagree with the parent sale
-- ---------------------------------------------------------------------------
-- Denormalizing shop_id creates the possibility of a payment filed under a
-- different shop than its sale — which would put one shop's cash in another
-- shop's report while remaining invisible to the shop that owns the sale. A
-- plain FK cannot express this; a trigger can.
--
-- BEFORE INSERT OR UPDATE, so it corrects rather than merely rejects: the
-- parent sale is the authority on which shop the money belongs to.
CREATE OR REPLACE FUNCTION public.sale_payments_set_shop_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_shop_id uuid;
BEGIN
    SELECT shop_id INTO v_shop_id
      FROM public.sales
     WHERE id = NEW.sale_id;

    IF v_shop_id IS NULL THEN
        RAISE EXCEPTION 'Sale % does not exist', NEW.sale_id;
    END IF;

    NEW.shop_id := v_shop_id;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sale_payments_shop_id ON public.sale_payments;
CREATE TRIGGER sale_payments_shop_id
    BEFORE INSERT OR UPDATE OF sale_id, shop_id ON public.sale_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.sale_payments_set_shop_id();

-- ---------------------------------------------------------------------------
-- Backfill: turn each existing amount_paid into one payment row
-- ---------------------------------------------------------------------------
-- READ THIS BEFORE RUNNING AGAINST A DATABASE WITH REAL SALES.
--
-- This step writes derived rows from live money data and there is no reverse
-- migration for it. It is guarded to be safe on re-run (the NOT EXISTS below
-- makes it idempotent), but if it runs against sales whose amount_paid is
-- already wrong, it faithfully copies that wrongness into the ledger.
--
-- Take a dump first. On the free tier there are no automatic backups and no
-- point-in-time recovery, so the dump is the only way back.
--
-- The dating is an approximation and cannot be anything else: the old schema
-- never recorded when a payment arrived, so the only timestamp available is the
-- sale's own. Every historical payment is therefore dated to its sale, which is
-- exactly right for sales that were paid in full at the till (the large
-- majority) and wrong for any historical partial payment that was actually
-- collected later. Those cannot be recovered from data that was never stored.
-- The note says so, so the row is not mistaken later for a precise record.
INSERT INTO public.sale_payments (shop_id, sale_id, amount, collected_by, collected_at, note)
SELECT s.shop_id,
       s.id,
       s.amount_paid,
       s.sold_by,
       COALESCE(s.sale_date, s.created_at, now()),
       'Backfilled from the sale record'
  FROM public.sales s
 WHERE s.amount_paid > 0
   AND NOT EXISTS (
       SELECT 1 FROM public.sale_payments p WHERE p.sale_id = s.id
   );

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- Assistants may record a collection. This is the deliberate choice, and the
-- reasoning is worth stating: the assistant at the counter is usually the person
-- the customer physically hands the money to. A policy that only lets the owner
-- enter payments does not stop the assistant from taking the cash — it stops
-- the system from knowing about it, and the shop ends up with an utang ledger
-- that disagrees with the drawer. Recording it under the assistant's own user id
-- is what makes the collection auditable.
--
-- Editing and deleting a payment is owner-only, which is where the control
-- actually belongs: an assistant can record what came in, and cannot quietly
-- remove a collection afterwards.
--
-- No is_super_admin() branch, per 20260801120400.

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shop sale payments" ON public.sale_payments;
CREATE POLICY "Users can view own shop sale payments" ON public.sale_payments
    FOR SELECT USING (shop_id = get_user_shop_id());

-- The EXISTS on sales is not redundant with the shop_id check: shop_id is set by
-- the trigger from the parent sale, and the trigger runs as definer, so this
-- policy is what confirms the caller may write against that particular sale.
DROP POLICY IF EXISTS "Owners and assistants can create sale payments" ON public.sale_payments;
CREATE POLICY "Owners and assistants can create sale payments" ON public.sale_payments
    FOR INSERT WITH CHECK (
        get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
        AND EXISTS (
            SELECT 1 FROM public.sales
            WHERE sales.id = sale_payments.sale_id
              AND sales.shop_id = get_user_shop_id()
        )
    );

DROP POLICY IF EXISTS "Owners can update sale payments" ON public.sale_payments;
CREATE POLICY "Owners can update sale payments" ON public.sale_payments
    FOR UPDATE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners can delete sale payments" ON public.sale_payments;
CREATE POLICY "Owners can delete sale payments" ON public.sale_payments
    FOR DELETE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

COMMENT ON TABLE public.sale_payments IS
    'One row per instalment received against a sale. The ledger behind sales.amount_paid.';

COMMENT ON COLUMN public.sale_payments.collected_at IS
    'When the money changed hands. Distinct from created_at, which is when the row was entered.';
