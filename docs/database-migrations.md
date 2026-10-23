# StockFlow Database Migration History

## Project Information

**System Name:** StockFlow  
**Database Platform:** Supabase PostgreSQL  
**Database Version:** MVP v1.0  
**Development Approach:** Next.js + Supabase + GitHub Workflow

---

# Overview

This document records the database changes, improvements, and security implementations made during the development of StockFlow.

The purpose of this document is to maintain a clear development history and allow future developers to understand how the database was created, modified, and secured.

All future database changes should be documented through additional migration entries.

---

# Database Architecture Overview

StockFlow uses a multi-shop database architecture.

The system is designed to support multiple businesses using the same application while keeping each shop's data separated.

Main structure:

```
shops
 |
 +---- users
 |
 +---- categories
          |
          +---- products
                    |
                    +---- stock_batches
                              |
                              +---- sale_items
                                      |
                                      +---- sales


stock_adjustments
```

---

# Migration 001 — Enable UUID Support

## Purpose

Enable UUID generation for database records.

## Changes Implemented

Enabled PostgreSQL UUID extension:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Reason

UUIDs are used as primary identifiers throughout the database.

Benefits:

- Unique identifiers
- Better security compared to sequential IDs
- Suitable for multi-shop systems
- Compatible with Supabase architecture

---

# Migration 002 — Create Core Database Tables

## Purpose

Create the main database structure required for StockFlow inventory, sales, and reporting features.

---

# Table: shops

## Purpose

Stores registered businesses using the StockFlow system.

Example:

```
ABC Auto Parts
XYZ Hardware
Motorcycle Parts Shop
```

## Main Fields

- id
- shop_name
- owner_name
- status
- created_at
- updated_at

---

# Table: users

## Purpose

Stores StockFlow user information connected with Supabase Authentication.

Authentication credentials are handled by Supabase Auth.

This table stores application-specific user information.

## Supported Roles

```
SUPER_ADMIN
OWNER
ASSISTANT
```

## Main Fields

- id
- auth_id
- shop_id
- name
- role
- created_at
- updated_at

---

# Table: categories

## Purpose

Stores product classifications.

Examples:

```
Brake Parts
Engine Parts
Electrical
Accessories
```

## Main Fields

- id
- shop_id
- name
- created_by
- created_at
- updated_at

---

# Table: products

## Purpose

Stores product identity information.

Important design decision:

Product prices are NOT stored in this table.

Price changes are managed through stock batches.

Example:

```
Product:

Brake Pad Toyota Vios
```

Price history:

```
Batch 001
Capital: ₱800


Batch 002
Capital: ₱900
```

## Main Fields

- id
- shop_id
- category_id
- product_name
- brand
- description
- created_by
- created_at
- updated_at

---

# Table: stock_batches

## Purpose

Stores inventory arrivals and price history.

This table handles:

- New stock arrivals
- Quantity tracking
- Capital price changes
- Selling price calculation
- Batch history

Example:

```
Product:

Brake Pad Toyota Vios


Batch 001

Quantity:
20

Capital:
₱800

Selling:
₱1,040



Batch 002

Quantity:
30

Capital:
₱900

Selling:
₱1,170
```

## Main Fields

- id
- shop_id
- product_id
- batch_number (free-form arrival reference, not unique — see Migration 021)
- quantity_received
- quantity_remaining
- capital_price
- interest_percentage
- selling_price
- received_date
- created_by
- created_at
- updated_at

---

# Table: sales

## Purpose

Stores transaction summaries.

Contains:

- Total sales amount
- Total profit
- Seller information
- Transaction date

## Main Fields

- id
- shop_id
- sold_by
- total_amount
- total_profit
- payment_status
- sale_date
- created_at

---

# Table: sale_items

## Purpose

Stores individual products included in each transaction.

This table connects:

```
Sales
+
Stock Batch
+
Profit Calculation
```

It preserves historical selling information.

Example:

```
Product:
Brake Pad Toyota Vios

Capital:
₱900

Actual Selling:
₱1,100

Profit:
₱200
```

## Main Fields

- id
- sale_id
- stock_batch_id
- quantity
- capital_price
- suggested_price
- actual_selling_price
- profit
- created_at

---

# Table: stock_adjustments

## Purpose

Stores manual inventory corrections.

Examples:

- Damaged items
- Missing stock
- Wrong encoding corrections

## Main Fields

- id
- shop_id
- stock_batch_id
- quantity_change
- reason
- adjusted_by
- created_at

---

# Migration 003 — Database Validation and Integrity Rules

## Purpose

Prevent incorrect data from entering the database.

---

## Added Inventory Validation

Implemented restrictions:

- Remaining stock cannot be negative
- Received quantity cannot be negative
- Capital price cannot be negative
- Selling price cannot be negative

---

## Added Sales Validation

Implemented restrictions:

- Sale quantity must be greater than zero
- Profit cannot be negative
- Total sales cannot be negative
- Total profit cannot be negative

---

## Added Stock Adjustment Validation

Implemented:

- Stock adjustments cannot have zero quantity changes

---

# Migration 004 — Role and Status Validation

## Purpose

Restrict important text fields to valid values.

---

# User Role Validation

Allowed roles:

```
SUPER_ADMIN
OWNER
ASSISTANT
```

---

# Shop Status Validation

Allowed statuses:

```
ACTIVE
INACTIVE
```

---

# Payment Status Validation

Allowed statuses:

```
PAID
PARTIAL
CREDIT
```

---

# Migration 005 — Database Performance Optimization

## Purpose

Improve search speed and database performance.

---

# Added Database Indexes

Indexes created for:

## Product Search

```
products.product_name
```

Used for:

- Product searching
- Sales encoding

---

## Shop Filtering

```
products.shop_id

stock_batches.shop_id

sales.shop_id
```

Used for:

- Multi-shop filtering
- Data isolation

---

## Inventory Lookup

```
stock_batches.product_id
```

Used for:

- Finding available batches
- Stock selection during sales

---

## Sales Reporting

```
sales.sale_date
```

Used for:

- Daily reports
- Weekly reports
- Monthly reports
- Yearly reports

---

## Transaction Lookup

```
sale_items.sale_id

sale_items.stock_batch_id
```

Used for:

- Viewing transaction details
- Tracking inventory source

---

# Migration 006 — Automatic Timestamp Management

## Purpose

Automatically update modification timestamps.

Created function:

```sql
update_updated_at_column()
```

Purpose:

Whenever a record is updated, automatically update:

```
updated_at
```

---

## Applied To:

```
shops

users

categories

products

stock_batches
```

---

# Migration 007 — Row Level Security Implementation

## Purpose

Secure multi-shop data separation.

Enabled Row Level Security (RLS) on:

```
shops

users

categories

products

stock_batches

sales

sale_items

stock_adjustments
```

---

# RLS Helper Functions Created

## get_user_shop_id()

Purpose:

Returns the shop associated with the logged-in user.

Used for:

- Shop data isolation
- Security policies

---

## get_user_role()

Purpose:

Returns the current user's StockFlow role.

Used for:

- Permission checking

---

## is_super_admin()

Purpose:

Checks whether the current user has administrator privileges.

Used for:

- Full system access

---

# Migrations 008-028 — Application Development Phase

Migrations 001-007 were applied through the Supabase dashboard. From 008 onward
they are version-controlled SQL files under `supabase/migrations/`, named by
timestamp so they apply in order.

| No. | File | Summary |
| --- | --- | --- |
| 008 | `20260801120000_baseline_schema.sql` | Baseline of everything above, re-expressed as a file |
| 009 | `20260801120100_pin_function_search_path.sql` | Pins `search_path` on the RLS helper functions |
| 010 | `20260801120200_allow_discounts_and_partial_payments.sql` | Allows losses; adds `sales.amount_paid` |
| 011 | `20260801120300_integrity_constraints.sql` | Unique `users.auth_id`, FIFO and lookup indexes |
| 012 | `20260801120400_super_admin_metrics_only.sql` | Removes SUPER_ADMIN access to business data |
| 013 | `20260801120500_shop_default_interest.sql` | Adds `shops.default_interest_percentage` |
| 014 | `20260801120600_record_sale_fifo.sql` | `record_sale()` — atomic FIFO checkout |
| 015 | `20260801120700_account_provisioning.sql` | Assistant accounts, status, privilege tightening |
| 016 | `20260801120800_shop_status_is_platform_only.sql` | Shop suspension restricted to SUPER_ADMIN |
| 017 | `20260801120900_customers.sql` | `customers` table, so credit attaches to a person |
| 018 | `20260801121000_sale_payments.sql` | `sale_payments` ledger — one row per instalment |
| 019 | `20260801121100_amount_paid_derived.sql` | `sales.amount_paid` becomes a trigger-maintained sum |
| 020 | `20260801121200_record_payment.sql` | `record_payment()`; `record_sale()` writes through the ledger |
| 021 | `20260801121300_batch_reference_not_unique.sql` | Batch reference is free-form, duplicates allowed |
| 022 | `20260801121400_record_sale_explicit_batch.sql` | A sale line may name its batch; FIFO becomes the fallback |
| 026 | `20260801121800_batch_lifecycle_protection.sql` | Protects sold-out batch history from deletion |
| 027 | `20260801122100_expenses.sql` | Adds shop expenses with soft deletion and net-profit reporting |
| 028 | `20261023000100_customer_level_credit_payments.sql` | Adds grouped customer-level payment allocation without rewriting historical payment rows |

Each file carries its own reasoning in a header comment. The entries below cover
the ones that changed security or business rules rather than schema shape.

---

# Migration 009 — Pin Function Search Path

## Purpose

The three RLS helper functions are `SECURITY DEFINER`, so they run with the
privileges of their owner. Without a pinned `search_path`, the tables they
reference resolve against the *caller's* search path, and a caller who can
create objects could shadow `public.users` with their own table and make
`is_super_admin()` return true.

## Changes Implemented

`SET search_path = ''` on `get_user_shop_id()`, `get_user_role()`, and
`is_super_admin()`, with every reference inside them schema-qualified.

---

# Migration 010 — Allow Discounts and Partial Payments

## Purpose

SRS 10 requires manual price adjustment at the point of sale. The schema
forbade the consequence of it.

## Changes Implemented

Dropped `sale_items.profit >= 0` and `sales.total_profit >= 0`. A shop that
discounts a slow-moving part below capital price has taken a real loss, and the
system must record that honestly; reports surface it rather than a CHECK
refusing the transaction.

Added `sales.amount_paid`, with a constraint keeping it consistent with
`payment_status` — so a sale cannot be PAID with nothing paid, or CREDIT with
the full amount paid.

`total_amount >= 0` was kept. A negative total would mean a refund, which is a
different transaction type and out of MVP scope.

---

# Migration 012 — Restrict SUPER_ADMIN to Platform Administration

## Purpose

SRS 5.1 states the platform administrator manages shops and accounts and cannot
access business data. The deployed policies said otherwise: every business table
carried `OR is_super_admin()`.

## Reason

These are independent businesses whose purchase prices and margins are
commercially sensitive, and nothing in the product requires the operator to see
them. Removing the access also bounds the damage a compromised admin account can
do — it can suspend a shop, but it cannot exfiltrate what every shop pays its
suppliers.

## Changes Implemented

Removed the super-admin bypass from `categories`, `products`, `stock_batches`,
`sales`, `sale_items`, and `stock_adjustments`. Access to `shops` and `users` is
unchanged, since administering those is the whole of the role.

Consequence: a person who is both the platform operator and a shop owner needs
two accounts. The roles are deliberately not additive.

---

# Migration 014 — Atomic FIFO Checkout

## Purpose

Recording a sale touches several tables and must not be interleaved with another
sale of the same stock.

## Changes Implemented

`record_sale(p_items jsonb, p_payment_status text, p_amount_paid numeric)`, a
`SECURITY DEFINER` function that walks batches oldest-first, locks each with
`SELECT ... FOR UPDATE`, deducts quantities, and writes `sales` and `sale_items`
in one transaction.

It takes no shop id: the shop and the acting user are resolved from `auth.uid()`
inside the function, so a caller cannot record a sale against another shop.

Prices and profit are computed server-side from the locked batch rows. The
client submits only product ids, quantities, and any manual price override —
a line spanning two batches at different capital prices has a profit the browser
cannot compute correctly.

---

# Migration 015 — Account Provisioning

## Purpose

Let an owner create assistant logins from the application, and give the shop a
way to free an assistant slot.

## Changes Implemented

Added `users.email` — a display copy of the sign-in address, so an owner's team
list can show which login each row belongs to. `auth.users` stays authoritative;
reading it requires the admin API.

Added `users.status` (ACTIVE / INACTIVE). Deactivated users keep their history
and their auth account but are refused at the route guards.

Narrowed the INSERT policy on `users`. The baseline let an OWNER insert any row
whose `shop_id` matched their own — including one with role `SUPER_ADMIN`, so an
owner could mint themselves a platform-administrator account. It now forces
`role = 'ASSISTANT'`.

Added `WITH CHECK` to the UPDATE policy on `users`. A USING-only policy tests the
row as it was, never as it becomes, so an owner could move a user into another
shop or promote an assistant to SUPER_ADMIN. Both are now checked on the
resulting row.

Added the `enforce_assistant_limit` trigger. The two-assistant cap (SRS 5.3) was
previously a UI rule only. The trigger locks the shop row first, so two
simultaneous inserts cannot both pass the count.

## Reason for Deactivation Rather Than Deletion

`DELETE` on `users` is super-admin only, and deleting a profile would blank
`sales.sold_by` (ON DELETE SET NULL), losing the record of who sold what.
Deactivation keeps the row and the history while freeing the slot.

---

# Migration 016 — Shop Suspension Is Platform-Only

## Purpose

Once the route guards began refusing every member of an INACTIVE shop,
`shops.status` became a lockout switch — and the UPDATE policy on `shops` lets an
owner write their own shop row.

## Changes Implemented

The `enforce_shop_status_is_platform_only` trigger refuses any change to
`shops.status` unless the caller is a SUPER_ADMIN. Owners keep the ability to
edit the rest of their shop row.

A trigger rather than `WITH CHECK` because the rule is "this value must not
change", which needs both the old and the new row; a `WITH CHECK` expression
only sees the new one.

## Reason

An owner who set their own shop to INACTIVE would lock their entire team out
with no way to undo it, since reactivating requires a SUPER_ADMIN. Suspension is
a platform decision (SRS 5.1).

---

# Migration 021 — Batch Reference Is Free-Form

## Purpose

`stock_batches.batch_number` was meant to be a supplier-issued batch number,
one per delivery, and migration 011 made (product, batch_number) unique on that
assumption. Real shops use the field as a reference they choose themselves —
usually the arrival date, written `080826` for 8 August 2026. Two arrivals of
the same product on the same day then collide on the unique index and the
"receive stock" action fails with a 23505 error for doing something ordinary.

## Changes Implemented

- `DROP INDEX public.stock_batches_product_batch_number_key` — the expression
  unique index from migration 011. It was an index, not a table constraint, so
  dropping it is the whole change.
- `COMMENT ON COLUMN` restating the new contract: free-form, not unique, not
  auto-numbered, exists so staff can tell two arrivals of the same product
  apart.

## Why It Is Safe

Nothing in the system keys off `batch_number`. `sale_items.stock_batch_id` and
`stock_adjustments.stock_batch_id` reference `stock_batches.id`, and the FIFO
loop in `record_sale()` orders by `(received_date, created_at)` only. No join,
no deduction, no profit figure reads the reference, and the migration writes no
data — existing rows keep their values.

Displays that show the reference (adjustment history, sale details, inventory)
now pair it with the received date so two rows sharing a reference stay
distinguishable.

---

# Migration 022 — A Sale Line May Name Its Batch

## Purpose

`record_sale()` chose the batches itself, oldest first. That is the right
default, but a shop sometimes needs to sell from a specific arrival: the older
stock is at the back of the shelf, the customer is matching a part they bought
before, or the newer batch is the one physically in reach. There was no way to
say so.

## Changes Implemented

Each entry in `p_items` may now carry an optional `stock_batch_id`.

- **Present** — that batch is deducted, and only that batch. If it is short the
  whole sale is refused rather than spilling into another batch. The other batch
  has a different capital price, so quietly taking units from it would book a
  profit other than the one the user was shown. The till adds the product again
  on another batch for the rest, which is one more `sale_items` row.
- **Absent** — the FIFO loop, unchanged. Old clients and any line where the
  user did not care behave exactly as before.

FIFO is therefore not replaced. It is the fallback, and it is what the UI
pre-selects.

The batch is validated in the same statement that locks it, on `id`, `shop_id`
*and* `product_id`. Without `shop_id` a caller could name another shop's batch;
without `product_id` they could deduct a batch unrelated to the product on the
line, and the `sale_items` row would then disagree with itself.

## Why the Signature Is Unchanged

The new field rides inside the existing `jsonb` argument, so this is a
`CREATE OR REPLACE`: no `DROP FUNCTION`, no re-issued grants, and no window
where two overloads could both match a call.

## Locking

The old version locked each product's batches in `(received_date, created_at)`
order as it reached them. With explicit batches the order a sale touches rows in
is the order the user happened to build the cart, so two tills selling the same
two batches in opposite orders could deadlock and Postgres would abort one.

Every row the sale could possibly touch is now locked once, up front, `ORDER BY
id`. Every concurrent sale takes its locks in the same order, so the cycle
cannot form. Explicitly named batches are included even when empty, so a line
naming a sold-out batch fails its own quantity check rather than racing another
sale for it.

## Why It Is Safe

No schema change. `sale_items.stock_batch_id` already recorded the exact batch
and profit was already computed per batch, so reports, the credit and payment
path, and every existing row are untouched. The migration writes no data — it
redefines one function.

## Deployment Order

This migration must be applied **before** the application is deployed. A new
client sending `stock_batch_id` to the old function would have the key silently
ignored, and stock would be deducted FIFO — a different batch and a different
profit than the user was shown, with no error.

---

# Migration 023 — Voiding a Recorded Sale

File: `20260801121500_void_sales.sql`

## Purpose

A sale rung up wrongly had no way out. The row was permanent, its stock stayed
deducted, and the only remedy was a manual stock adjustment that left the wrong
sale counting in every report forever.

## Why Not DELETE

`sale_items` and `sale_payments` both cascade from `sales`. Deleting a sale
would take the line items, the batch links, the profit figures and the payment
history with it — leaving nothing to reconcile against when the day's cash does
not match the day's report, and nothing to say which batches to credit the
stock back to.

So a void is a mark, not a removal. The sale stays visible, labelled, and
excluded from every total.

## Schema Changes

On `sales`:

| Column        | Type          | Notes                                     |
| ------------- | ------------- | ----------------------------------------- |
| `voided_at`   | `timestamptz` | NULL for a live sale                      |
| `voided_by`   | `uuid`        | FK to `users`, `ON DELETE SET NULL`       |
| `void_reason` | `text`        | Required whenever `voided_at` is set      |

On `sale_payments`:

| Column      | Type          | Notes                                       |
| ----------- | ------------- | ------------------------------------------- |
| `voided_at` | `timestamptz` | Set when the parent sale is voided          |

Constraint `sales_void_reason_required` keeps the three columns coherent: either
the sale is live and there is no reason, or it is voided and the reason is
non-blank. `voided_by` is deliberately outside that predicate — it is
`ON DELETE SET NULL`, so removing the staff account that voided a sale must not
retroactively invalidate the row.

Two partial indexes, `idx_sales_shop_live` and
`idx_sale_payments_shop_collected_live`, both `WHERE voided_at IS NULL`. Every
reporting query now carries that predicate and voided rows are a rounding error
in the row count, so indexing only the live rows keeps them smaller than the
full-table equivalents.

## Why the FK Constraint Is Named Explicitly

`sales` now has two foreign keys to `users` — `sold_by` and `voided_by`. That
makes the PostgREST embed `users ( name )` ambiguous, and PostgREST answers such
a request with PGRST201 rather than picking one. Every select that embeds the
seller must now name the relationship: `users!sales_sold_by_fkey ( name )` and
`voided_by_user:users!sales_voided_by_fkey ( name )`.

Those constraint names are therefore part of the application's contract, which
is why the migration names them rather than letting Postgres generate them.

## Payments: Marked, Not Deleted

Three options were on the table.

1. **Delete the `sale_payments` rows.** Simplest, and the existing recompute
   trigger drops `amount_paid` to 0 on its own. But it destroys the record that
   money was ever taken — exactly the audit history a void is meant to preserve
   — and leaves no way to answer "the drawer was 500 over on Tuesday, why?"

2. **Insert a negative reversal row.** True double-entry history: the collection
   stays on the day it happened and the refund lands on the day it was returned.
   But `sale_payments_amount_check` requires `amount > 0`, so this means
   relaxing that constraint for every code path, not just this one — after which
   any owner or assistant can insert a stray negative payment straight through
   PostgREST. It also puts negative rows into the daily collections list, which
   then needs handling everywhere collections are displayed.

3. **Mark the payment voided and exclude it.** Chosen. The row survives intact —
   amount, date, who collected it, note — so the history is fully readable on
   the sale. `amount > 0` stays in force. No new sign conventions leak into
   reports.

The cost of (3) is that a collection taken on an earlier day drops out of that
earlier day's figures when the sale is voided later. That is a real trade, and
it is the reason (2) exists. It is acceptable here because the dominant case is
a cash sale rung up wrong: `record_sale()` writes the payment with the same
timestamp as the sale, so voiding it the same day moves no historical number at
all. The cross-day case is a part-collected credit sale that later turns out to
be a mistake — rare, and explained by the void reason on the sale. If the shop
starts doing genuine refunds, money handed back over the counter on a later day,
that is when (2) becomes the right model, and it is an additive change from
here.

## Functions

**`void_sale(p_sale_id uuid, p_reason text) → jsonb`** — new.
`SECURITY DEFINER`, `SET search_path = ''`, for the same reason as
`record_sale()`: it writes to `sales`, `stock_batches`, `sale_payments` and
`stock_adjustments` in one transaction, and PostgREST cannot express a
transaction.

Authorization is done inside and is load-bearing: the caller is resolved from
`auth.uid()` and never passed in, the caller must be `OWNER`, the sale must
belong to the caller's own shop (checked in the statement that locks it, so
another shop's id reads as not found), and there is no `shop_id` argument to
spoof. An assistant may take money but may not undo a recorded transaction,
which matches the `sale_payments` UPDATE/DELETE policies already in place.

What it does, in order:

1. Locks the sale row; refuses a sale that is already voided.
2. Locks every batch the sale touched, once, `ORDER BY id`.
3. Refuses the whole void if any batch would end up holding more than
   `quantity_received` — see below.
4. Adds the units back to each batch and writes one `stock_adjustments` row per
   batch, reason `Sale voided: <reason>`.
5. Marks the sale's live payments voided.
6. Stamps `voided_at`, `voided_by`, `void_reason` on the sale.
7. Returns `{restored_units, restored_batches, orphan_lines, voided_payments}`.

Being a new function it needs its grants issued — `CREATE FUNCTION` starts with
EXECUTE granted to PUBLIC — so the migration ends with `REVOKE ALL … FROM
PUBLIC` and `GRANT EXECUTE … TO authenticated`.

**`recompute_sale_payment_state()`** — replaced. One clause added to each of the
three payment sums: `AND p.voided_at IS NULL`. That is what makes marking a
payment voided equivalent to removing it as far as `amount_paid` and
`payment_status` are concerned, while the row itself stays readable.

**`record_payment(uuid, numeric, timestamptz, text)`** — replaced. Now reads
`voided_at` under the same row lock and refuses a voided sale. Without this a
voided credit sale still looks collectable: voiding its payments leaves
`amount_paid` at 0 and `payment_status` at `CREDIT`, which is exactly the state
an uncollected debt is in.

Both replacements keep their signature, so grants and the trigger binding stand.
Both are also invisible to any structural check — the only way to tell whether
they ran is to read `pg_proc.prosrc`, which `docs/verify-setup.sql` does.

## Why an Over-Capacity Restore Is Refused

`quantity_received` is fixed at arrival and
`stock_batches_remaining_within_received` enforces the ceiling. A batch that
cannot take its units back has already had them put back another way — most
likely a manual adjustment made to paper over this very sale. Restoring the rest
and silently dropping that batch would leave inventory wrong with nothing on
screen to say so, so the function stops, names the batch, and leaves the owner
in control.

Lines whose batch was deleted afterwards are a different case:
`sale_items.stock_batch_id` is `ON DELETE SET NULL`, so there is no batch left
to credit. Those are counted as `orphan_lines` and reported back, because the
difference between "stock came back" and "stock could not come back" is the
shop's to know.

## Locking

Sale row first, then batches by id ascending. That is the same order
`record_sale()` takes — it holds the row lock on the sale it just inserted
before it touches any batch — so the two cannot deadlock against each other, and
two voids sharing a batch serialize on that batch.

## Read Paths That Changed

Reports and balances exclude voided rows; history does not.

Excluded: `loadSales`, `loadPayments`, both `getDayDetail` queries,
`getTopProducts` (through `sales!inner`), `listCustomersWithBalances`,
`listCustomerUnpaidSales`, and the outstanding-balance check in
`deleteCustomer`.

Not excluded, on purpose: `listSales` and `getSale`. A voided sale that
disappeared from the list would be indistinguishable from one that was deleted,
which is the outcome this migration exists to avoid.

## Why It Is Safe

Additive. Three nullable columns, one nullable column, two partial indexes, one
new function, two function bodies. No existing row is rewritten — every sale
recorded before this migration has `voided_at IS NULL` and behaves exactly as it
did.

## Deployment Order

Apply **before** deploying the application. The app's selects name
`sales_sold_by_fkey` explicitly; against the old schema, where that constraint
exists but `voided_at` does not, the selects fail on the missing columns and the
sales pages error.

---

# RLS Permission Structure

Note: this section describes the structure as of Migration 012, which narrowed
SUPER_ADMIN considerably. See that entry for the reasoning.

## SUPER_ADMIN

Platform administrator.

Permissions:

- Access all shops
- Manage all users
- Suspend and restore shops
- View platform-wide counts of shops and accounts

Restrictions:

- Cannot read or write any business data — products, inventory, sales,
  purchase prices, or profit — in any shop
- Cannot operate a shop; that requires a separate OWNER account

---

## OWNER

Business owner.

Permissions:

- Access own shop data
- Manage assistants
- Manage products
- Add inventory
- Correct records
- View reports

Restrictions:

- Cannot access other shops

---

## ASSISTANT

Daily operational user.

Permissions:

- View products
- View inventory
- Add stock batches
- Record sales

Restrictions:

- Cannot modify protected records
- Cannot access other shops
- Cannot change financial history

---

# Current Database Version

```
StockFlow Database v1.3
```

Status:

```
COMPLETED — migrations 001-027 applied
```

Supports:

- Multi-tenant shop isolation through RLS
- Batch-based inventory with FIFO deduction
- Free-form, non-unique batch references for stock arrivals
- Atomic sale recording with server-side profit calculation
- Manual batch selection at the till, with FIFO as the default and fallback
- Discounts below capital price, and partial or credit payments
- Per-instalment payment ledger with derived `sales.amount_paid`
- Customers, so credit is tracked per person
- Account provisioning for owners and assistants
- Account and shop suspension
- Voiding a recorded sale, with the stock returned to its original batches and
  the sale kept in the history
- Credit and partial payment ledger entries dated by actual collection time,
  with entry timestamps preserved separately
- Dynamic daily, weekly and monthly PDF report export without persisted files
- Sold-out batches retained as historical records; deletion is blocked

---

# Migration 024 — Amend Recorded Sales

File: `20260801121600_amend_sales.sql`

## Purpose

A correction must not overwrite a recorded sale. It preserves the original row
and creates a linked replacement.

## Changes Implemented

- Added `sales.replaces_sale_id`, with one direct replacement per original.
- Added a trigger that validates same-shop, voided-original links and keeps
  established links immutable.
- Added owner-only `amend_sale()` as a single transaction.
- The function voids the original, restores its exact batches, writes the
  existing stock-adjustment history, voids its payment rows, records the new
  sale, and links it to the original.
- The replacement keeps the original `sale_date`.

The original and replacement are both retained. Reports filter on
`voided_at IS NULL`, so only the active replacement contributes to totals.
Refunds and overpayment handling remain outside MVP; old payment rows are
voided and replacement payments are new ledger rows.

---

# Migration 025 — Credit and Partial Payment Improvements

File: `20260801121700_credit_payment_improvements.sql`

## Purpose

Keep the date a customer hands over money separate from the date the payment is
entered. The existing ledger already has both `collected_at` and `created_at`;
this migration hardens the payment RPC that writes them.

## Changes Implemented

- `record_payment()` continues to lock the live sale and insert one payment row.
- An explicit `p_collected_at` is preserved as the actual received timestamp.
- Future collection timestamps are refused by the database.
- A payment trigger applies the same future-date guard to direct ledger writes.
- `created_at` remains the automatic ledger-entry timestamp.
- `amount_paid` and `payment_status` remain trigger-derived.

Reports continue to use `sales.sale_date` for revenue and
`sale_payments.collected_at` for collections, so a later payment against an
older sale appears on the day it was received. Customer payments remain
allocated to one sale at a time.

Refunds and overpayments are outside this feature. Existing amendment and void
behavior is unchanged.

---

# Migration 026 — Batch Lifecycle Protection

File: `20260801121800_batch_lifecycle_protection.sql`

Sold-out batches remain in `stock_batches` with `quantity_remaining = 0` so
their original prices, dates, sale links, and adjustment history remain
auditable. The migration removes direct batch deletion and prevents deleting a
product that has any stock-batch history, including batches that are already
sold out. No existing rows are changed.

---

# Migration 027 — Shop Expenses

File: `20260801122100_expenses.sql`

This additive migration creates the shop-owned `expenses` table, indexes it for
shop/date reporting, and adds RLS for owners and assistants. It does not rewrite
or delete existing products, inventory, sales, payments, customers, or stock
adjustments.

Expense deletion is implemented as a soft delete using `deleted_at` and
`deleted_by`. Active expenses are subtracted from sales profit in dashboard,
report, daily-detail, and PDF calculations to produce net profit.

---

# Migration 028 — Customer-Level Credit Payments

File: `20261023000100_customer_level_credit_payments.sql`

This migration only adds a nullable `sale_payments.payment_group_id`, an index,
and the `record_customer_payment()` function. It does not update, backfill, or
delete existing sales, customers, or payment rows; historical payment rows keep
`payment_group_id = NULL`.

The function validates the authenticated shop and role, locks all of the
customer's live outstanding sales in a stable oldest-first order, refuses
payments larger than the combined balance, and writes sale-level allocations
under one group id in a single transaction. Existing payment triggers continue
to derive each sale's `amount_paid` and `payment_status`, and reports continue to
sum the same `sale_payments` ledger.

Take a verified backup before applying this migration to production. Apply the
single migration before deploying the application code that reads the new
column or calls the new function. Verify the added column and function with
`docs/verify-setup.sql`.

---

# Future Migration Guidelines

All future database changes must:

1. Have a documented purpose
2. Be tested before production use
3. Be recorded in this migration file
4. Be committed to GitHub
5. Maintain database security rules

---

# End of Migration History

Current Version:

```
StockFlow Database v1.4
```
