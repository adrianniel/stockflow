-- Customers, so credit ("utang") can be attached to a person.
--
-- Why a table rather than a text column on sales
-- ----------------------------------------------
-- The question a shop owner actually asks is "who owes me money, and how
-- much" — which is a question about a person, not about a sale. A name typed
-- into each sale cannot answer it: "Mang Tony", "mang tony" and "Tony" become
-- three different debtors, and there is no row to attach a running balance to.
-- One row per customer makes the balance a sum over that customer's sales, and
-- makes correcting a misspelling a single edit rather than an unfindable set.
--
-- Storage
-- -------
-- Text and numbers only, deliberately. Three short text columns and two
-- timestamps per customer is on the order of a hundred bytes — a shop with a
-- thousand regulars costs well under a megabyte, which matters on a 500 MB
-- database. No photos, no attachments, no history table.
--
-- Nothing here is required except the name. A shop that tracks utang by name
-- alone is a normal shop, and forcing a phone number on them would just
-- produce fake ones.

CREATE TABLE IF NOT EXISTS public.customers (
    -- gen_random_uuid() rather than uuid_generate_v4(): it is core Postgres 13+
    -- and needs no extension, so this table does not depend on uuid-ossp being
    -- installed in a particular schema.
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name        text NOT NULL CHECK (btrim(name) <> ''),
    phone       text,
    notes       text,
    created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One "Mang Tony" per shop, case-insensitively, for the reason above. Scoped
-- per shop so two shops may both have a customer of that name. Matches the
-- pattern already used for categories_shop_name_key.
CREATE UNIQUE INDEX IF NOT EXISTS customers_shop_name_key
    ON public.customers (shop_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_customers_shop_id
    ON public.customers (shop_id);

DROP TRIGGER IF EXISTS set_customers_updated_at ON public.customers;
CREATE TRIGGER set_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- sales.customer_id
-- ---------------------------------------------------------------------------
-- Nullable, and stays nullable: a walk-in paying cash has no customer, which is
-- most sales. Only credit needs a name attached.
--
-- ON DELETE SET NULL rather than CASCADE — deleting a customer record must
-- never delete their sales. Those sales are the shop's revenue and profit
-- history; losing them to a tidy-up of the customer list would silently rewrite
-- past reports.
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- Partial: only credit sales carry a customer, so the index stays small.
CREATE INDEX IF NOT EXISTS idx_sales_customer_id
    ON public.sales (customer_id)
    WHERE customer_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- Same shape as every other business table: reachable only within one shop.
--
-- No is_super_admin() branch anywhere below. 20260801120400 removed the
-- platform operator's access to business data, and a customer list — names and
-- phone numbers of a shop's regulars — is exactly the kind of thing that
-- decision was about.
--
-- Read is open to both roles because an assistant at the counter has to be able
-- to find the customer to record credit against. Managing the list (adding,
-- renaming, deleting) is owner-only: it is bookkeeping, not counter work, and a
-- deletion here detaches sales from their debtor.

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own shop customers" ON public.customers;
CREATE POLICY "Users can view own shop customers" ON public.customers
    FOR SELECT USING (shop_id = get_user_shop_id());

-- INSERT is allowed for assistants as well: refusing it would mean an assistant
-- who is handed a new customer's utang has to stop and fetch the owner, and the
-- realistic outcome of that is the sale being recorded as cash and the debt
-- going unrecorded. Recording it is what the system is for.
DROP POLICY IF EXISTS "Owners and assistants can create customers" ON public.customers;
CREATE POLICY "Owners and assistants can create customers" ON public.customers
    FOR INSERT WITH CHECK (
        shop_id = get_user_shop_id()
        AND get_user_role() = ANY (ARRAY['OWNER'::text, 'ASSISTANT'::text])
    );

DROP POLICY IF EXISTS "Owners can update customers" ON public.customers;
CREATE POLICY "Owners can update customers" ON public.customers
    FOR UPDATE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

DROP POLICY IF EXISTS "Owners can delete customers" ON public.customers;
CREATE POLICY "Owners can delete customers" ON public.customers
    FOR DELETE USING (
        shop_id = get_user_shop_id() AND get_user_role() = 'OWNER'
    );

COMMENT ON TABLE public.customers IS
    'Named credit customers, one row per person per shop. Text only — no attachments.';

COMMENT ON COLUMN public.sales.customer_id IS
    'Who owes for this sale. NULL for walk-in cash sales, which is the common case.';
