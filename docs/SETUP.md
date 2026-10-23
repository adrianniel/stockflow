# StockFlow — Setup and Deployment

Everything here is a step **you** perform. The application code is complete; what
follows is the database and hosting work that cannot be done from inside the
repository.

Work through the sections in order. Section 2 is the one that is currently
blocking the app from running at all.

---

## 1. Local environment

Create `.env.local` in the project root (copy `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
```

Both come from **Supabase dashboard → Project Settings → API**. The publishable
(anon) key is the one safe to expose; Row Level Security is what protects the
data.

**Never add the `service_role` key.** It bypasses RLS entirely, and one mistake
in a server file would expose every shop's data to every other shop. The app is
built specifically to work without it.

```bash
npm install
npm run dev
```

---

## 2. Apply migrations safely

The migrations in `supabase/migrations/` are the **entire database**. The baseline
was reconstructed from the live schema, and everything since (new columns, new
functions, RLS fixes) is a migration file. There is no migration log in the repo,
and the ones you applied by hand have already proven to be an unreliable record —
`20260801120200` was skipped and the app broke with error `42703` on the OWNER
pages, while `docs/verify-setup.sql` still printed all-PASS because it did not
check that column. Use both the remote migration history and schema verification;
neither alone is enough if migrations were applied manually. Idempotent DDL does
not make data backfills harmless to repeat.

The table is a summary; a fresh project must run **every** file in
`supabase/migrations/` in filename order.

| File | What it adds |
|---|---|
| `20260801120000_baseline_schema.sql` | All 8 tables, indexes, RLS helpers, baseline policies |
| `20260801120100_pin_function_search_path.sql` | Pins `search_path` on the SECURITY DEFINER helpers |
| `20260801120200_allow_discounts_and_partial_payments.sql` | `sales.amount_paid`; negative-profit sales; payment-status checks |
| `20260801120300_integrity_constraints.sql` | Unique `users.auth_id`, FIFO indexes, quantity/tenant constraints |
| `20260801120400_super_admin_metrics_only.sql` | Stops SUPER_ADMIN reading business data (SRS 5.1) |
| `20260801120500_shop_default_interest.sql` | Per-shop markup default; interest NOT NULL |
| `20260801120600_record_sale_fifo.sql` | `record_sale()` RPC — FIFO deduction, profit, partial payment |
| `20260801120700_account_provisioning.sql` | `users.status`, `users.email`, the 2-assistant cap, tightened policies |
| `20260801120800_shop_status_is_platform_only.sql` | Stops an owner deactivating their own shop |
| `20261023000100_customer_level_credit_payments.sql` | Customer-level installment allocation; additive only, leaves existing payment rows unchanged |

`20260801120700` is the one that was previously blocking **every** dashboard page
and every login: `requireSession()` selects `users.status`, so until that column
exists nothing works at all.

### Fresh Supabase project

1. Open **Supabase dashboard → SQL Editor → New query**.
2. Open the oldest file — `supabase/migrations/20260801120000_baseline_schema.sql`
   — paste the whole file, click **Run**.
3. Repeat for each of the remaining files under `supabase/migrations/`,
   **in filename order**. Each file is a separate query; the SQL editor does
   not accept them pasted together.
4. Paste and run `docs/verify-setup.sql`.

Every row of the verification query should read `PASS`. Any `FAIL` row names the
migration that is missing and what breaks while it is.

### Existing/live Supabase project

1. Make and verify a backup before changing production.
2. Run `npx supabase migration list --linked` and
   `npx supabase db query --linked --file docs/verify-setup.sql`.
3. Compare the remote state with the intended migration. If history is missing,
   inconsistent, or older files appear pending, stop and inspect the schema;
   do not run `supabase db push` or replay the whole chain blindly.
4. Apply only the confirmed missing migration, then rerun the verification
   query. For the customer-level credit update, migration
   `20261023000100_customer_level_credit_payments.sql` is additive: it adds a
   nullable column and a function without rewriting existing payment data.

Note on `20260801120200`: if the shop has already recorded sales, the file
backfills `amount_paid` from `payment_status` before adding its constraint, so
settled sales stay settled. If you ran an **older version** of that file without
the backfill and it errored mid-way, the column may exist but the constraint is
missing — the verify query will flag it, and you can paste the file again to
finish (the column add is `IF NOT EXISTS`, so re-running is safe).

### If you are not sure which earlier migrations were applied

Run `docs/verify-setup.sql` first. It checks the schema itself rather than any
record of what was run, so it tells you the truth regardless of history. Apply
whichever files cover the failing rows, oldest first.

---

## 3. Supabase Auth settings

**Dashboard → Authentication → Providers → Email**

Decide one thing: **Confirm email**, on or off.

| | Effect |
|---|---|
| **Off** (suggested to start) | An owner creates an assistant and that person can sign in immediately with the temporary password. |
| **On** | The account is created but cannot sign in until the confirmation link is clicked. The app detects this and says so, but you must be able to receive mail at every address you register. |

Leave it **off** while testing, or you will be locked out of accounts you just
created. Turn it on before real use if the shop's staff have real mailboxes.

The app never uses the admin API to create accounts — it uses the ordinary
public sign-up endpoint on an isolated client — which is why this project-level
setting applies to account creation.

---

## 4. Create the first SUPER_ADMIN — by hand, once

This is a chicken-and-egg step: the admin console creates shops and owners, but
nothing in the app can create the first platform administrator. It has to be
done directly in Supabase, once.

1. **Dashboard → Authentication → Users → Add user → Create new user.**
   - Enter your email and a password.
   - Tick **Auto Confirm User** so it can sign in regardless of the setting above.
   - Click Create, then copy the new user's **UID**.

2. **SQL Editor**, with that UID pasted in:

```sql
INSERT INTO public.users (auth_id, shop_id, name, email, role, status)
VALUES (
    'PASTE-THE-UID-HERE',
    NULL,                      -- SUPER_ADMIN belongs to no shop
    'Your Name',
    'you@example.com',
    'SUPER_ADMIN',
    'ACTIVE'
);
```

`shop_id` must be `NULL`. A super admin with a shop would be treated as a member
of it.

3. Sign in at `/login`. You should land on `/dashboard/admin`.

From here everything else is done in the UI: **Shops → New shop**, then
**Users → New owner** to give that shop an owner. The owner signs in and creates
their own assistants.

---

## 5. Test the system end to end

Do this locally before deploying. It is the first real exercise of FIFO and the
RLS boundaries.

1. **As SUPER_ADMIN** — create a shop, then create an owner for it.
2. **As that owner** (sign out, sign in as them):
   - Create a category, then a product.
   - Record a stock arrival: 10 units at ₱500 capital. With 30% markup the
     selling price should show ₱650.
   - Record a **second** arrival for the same product: 10 units at ₱600 capital.
     You should now have two batches at different prices — the first must be
     unchanged.
   - Record a sale of **15 units**. This is the important one: it spans both
     batches. Profit should be `10 × (650 − 500) + 5 × (780 − 600)` — the older
     batch is consumed first.
   - Check **Reports**: revenue and profit should match, and today's figures
     should include the sale.
   - Record a sale with the price manually lowered below capital. Profit should
     show **negative**, in red. This is intentional (SRS 10).
   - **Assistants → New assistant.** Add two. The third should be refused with a
     message about the limit.
3. **As the assistant** — confirm there is no Categories, Adjustments, or
   Assistants item in the sidebar, and that visiting `/dashboard/assistants`
   directly redirects instead of rendering.
4. **Cross-shop check** — create a second shop with its own owner and confirm
   neither owner can see the other's products or sales.

If step 2's 15-unit sale produces the wrong profit, stop and report it. That
calculation is the core of the system.

---

## 6. Deploy to Vercel

1. Push to GitHub (already done via GitHub Desktop).
2. **vercel.com → Add New → Project → Import** the repository.
3. Framework preset: **Next.js** (auto-detected). No build settings to change.
4. **Environment Variables** — add both, for Production, Preview, and
   Development:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

   These are the *same* values as `.env.local`. There is no third variable, and
   there should be no `service_role` key here either.
5. **Deploy.**
6. In **Supabase → Authentication → URL Configuration**, set the **Site URL** to
   your Vercel domain and add it to **Redirect URLs**. Without this, email
   confirmation links point at `localhost`.

Verify the deployment by signing in on the live URL and re-running the 15-unit
sale from section 5.

---

## 7. Before every push

```bash
npm run verify
```

Runs typecheck, lint, and a production build in sequence. All three must pass —
Vercel runs the same build, so a failure here is a failed deployment.

---

## Known gaps

Honest list of what is **not** covered, so none of it is a surprise later.

- **No automated tests.** There is no test runner in the project. Everything is
  verified by typecheck, lint, build, and the manual pass in section 5. The FIFO
  calculation and the RLS boundaries in particular have no regression safety
  net.
- **Orphaned auth accounts.** Creating an account is two writes that cannot share
  a transaction (Supabase Auth, then Postgres). If the second fails, a login
  exists with no profile row. It grants no access — the route guards reject it —
  but there is no way to delete it from inside the app, because that needs the
  `service_role` key. Clean it up in **Authentication → Users** if it happens.
- **No password reset flow.** A user who forgets their password needs an owner or
  admin to deactivate the account and create a new one, or a manual reset from
  the Supabase dashboard.
- **Email changes are not supported in-app.** Sign-in credentials live in
  `auth.users`; `users.email` is a display copy and can drift if the address is
  changed in the Supabase dashboard.
- **Expense management requires migration `20260801122100_expenses.sql`.** Apply
  it only after creating a backup/export of the shared Supabase database, then
  run the verification query and test the expense and report flows.
- **Consolidated customer credit requires migration
  `20261023000100_customer_level_credit_payments.sql`.** It is additive and
  does not update/backfill historical payment rows. Back up first, apply it
  before deploying the app code, then run `docs/verify-setup.sql`.
