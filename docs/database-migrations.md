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

# Migrations 008-021 — Application Development Phase

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
StockFlow Database v1.1
```

Status:

```
COMPLETED — migrations 001-021 applied
```

Supports:

- Multi-tenant shop isolation through RLS
- Batch-based inventory with FIFO deduction
- Free-form, non-unique batch references for stock arrivals
- Atomic sale recording with server-side profit calculation
- Discounts below capital price, and partial or credit payments
- Per-instalment payment ledger with derived `sales.amount_paid`
- Customers, so credit is tracked per person
- Account provisioning for owners and assistants
- Account and shop suspension

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
StockFlow Database v1.1
```
