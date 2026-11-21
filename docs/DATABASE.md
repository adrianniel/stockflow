# StockFlow Database Design

## Version

Version: 1.0 (MVP)

---

# 1. Database Purpose

StockFlow uses a multi-tenant PostgreSQL database architecture powered by Supabase.

The purpose of this database is to support multiple businesses using one application while keeping each business's information isolated and secure.

The system is designed for small businesses that need:

- Product management
- Inventory tracking
- Batch-based stock management
- Sales recording
- FIFO inventory deduction
- Profit monitoring
- Business reports

---

# 2. Multi-Tenant Database Architecture

StockFlow uses one Supabase project that supports multiple businesses.

Example:

```
                    StockFlow System

                           |

        ---------------------------------------

        |                  |                  |

        ↓                  ↓                  ↓

     Shop A             Shop B             Shop C

 Auto Parts          Hardware          Motorcycle Shop

        |                  |                  |

   Products          Products          Products

   Sales             Sales             Sales

   Reports           Reports           Reports
```

Each shop must only access its own records.

---

# 3. Database Design Principles

## 3.1 Shop Data Isolation

All business-related tables must contain:

```
shop_id
```

This identifies which business owns the record.

Example:

```
products

id:
001

shop_id:
ABC Auto Parts

product_name:
Brake Pad
```

A user from another shop must never access this data.

---

## 3.2 Product and Inventory Separation

Products represent the item identity.

Stock batches represent actual purchased inventory.

Example:

Product:

```
Brake Pad Toyota Vios
```

Inventory batches:

```
Batch 001

Capital:
₱800

Quantity:
20


Batch 002

Capital:
₱900

Quantity:
30
```

The product stays the same, but inventory batches have different costs.

---

## 3.3 Price History Preservation

The system must never overwrite old inventory prices.

When supplier prices change:

A new stock batch must be created.

Example:

Old stock:

```
Capital:
₱800

Selling:
₱1,040
```

New stock:

```
Capital:
₱900

Selling:
₱1,170
```

Both records must remain.

---

# 4. Database Tables

StockFlow MVP includes:

1. shops
2. users
3. categories
4. products
5. stock_batches
6. sales
7. sale_items
8. stock_adjustments
9. expenses

---

# 5. Table Specifications

---

# 5.1 shops Table

## Purpose

Stores businesses registered in StockFlow.

Examples:

- Auto parts shop
- Hardware shop
- Motorcycle parts shop

---

## Fields

| Field      | Type      | Description         |
| ---------- | --------- | ------------------- |
| id         | uuid      | Primary key         |
| shop_name  | text      | Business name       |
| owner_name | text      | Business owner name |
| status     | text      | Active or inactive  |
| created_at | timestamp | Creation date       |
| updated_at | timestamp | Last update         |

---

# 5.2 users Table

## Purpose

Stores application users.

Authentication is handled by Supabase Auth.

This table stores user information needed by StockFlow.

---

## Fields

| Field      | Type      | Description           |
| ---------- | --------- | --------------------- |
| id         | uuid      | Primary key           |
| auth_id    | uuid      | Supabase Auth user ID |
| shop_id    | uuid      | Assigned shop         |
| name       | text      | User name             |
| role       | text      | Permission level      |
| created_at | timestamp | Creation date         |
| updated_at | timestamp | Last update           |

---

## Roles

```
SUPER_ADMIN

OWNER

ASSISTANT
```

---

## Permissions

### SUPER ADMIN

Can:

- Create shops
- Create owner accounts
- Manage platform users
- Monitor registered businesses

---

### OWNER

Can:

- Manage products
- Add inventory
- Record sales
- View reports
- Create assistant accounts
- Change password

---

### ASSISTANT

Can:

- Record stock arrivals
- Record sales
- View inventory
- View reports

Maximum assistants:

```
2 per shop
```

---

# 5.3 categories Table

## Purpose

Stores product categories.

Examples:

```
Brake Parts

Engine Parts

Electrical

Accessories
```

---

## Fields

| Field      | Type      | Description               |
| ---------- | --------- | ------------------------- |
| id         | uuid      | Primary key               |
| shop_id    | uuid      | Owner shop                |
| name       | text      | Category name             |
| created_by | uuid      | User who created category |
| created_at | timestamp | Creation date             |
| updated_at | timestamp | Last update               |

---

## Rules

- Categories belong to a specific shop.
- Users can only manage categories from their assigned shop.

---

# 5.4 products Table

## Purpose

Stores product identity.

Products do not store prices.

Prices belong to stock batches because supplier costs may change.

---

## Fields

| Field        | Type      | Description              |
| ------------ | --------- | ------------------------ |
| id           | uuid      | Primary key              |
| shop_id      | uuid      | Owner shop               |
| category_id  | uuid      | Product category         |
| product_name | text      | Product name             |
| brand        | text      | Brand                    |
| description  | text      | Optional information     |
| created_by   | uuid      | User who created product |
| created_at   | timestamp | Creation date            |
| updated_at   | timestamp | Last update              |

---

## Example

Product:

```
Brake Pad Toyota Vios
```

Related batches:

```
Batch 001

Capital:
₱800


Batch 002

Capital:
₱900
```

---

# 5.5 stock_batches Table

## Purpose

Stores every inventory arrival.

Each supplier purchase creates a new batch.

This table controls inventory quantity and pricing history.

---

## Fields

| Field               | Type      | Description                |
| ------------------- | --------- | -------------------------- |
| id                  | uuid      | Primary key                |
| shop_id             | uuid      | Owner shop                 |
| product_id          | uuid      | Related product            |
| batch_number        | text      | Free-form arrival reference (not unique) |
| quantity_received   | integer   | Original quantity          |
| quantity_remaining  | integer   | Current available quantity |
| capital_price       | decimal   | Purchase price per item    |
| interest_percentage | decimal   | Profit percentage          |
| selling_price       | decimal   | Suggested selling price    |
| received_date       | date      | Arrival date               |
| created_by          | uuid      | User who added stock       |
| created_at          | timestamp | Creation date              |
| updated_at          | timestamp | Last update                |

---

## Batch reference

`batch_number` is a shop-chosen reference for the arrival, not a supplier
serial and not a sequence the system generates. Shops typically use the arrival
date (`080826` for 8 August 2026), a delivery receipt number (`DR-1042`), or
whatever they already write on the box.

It is deliberately **not unique**: two arrivals of the same product on the same
day are ordinary, and the shop should not have to invent a distinct label for
each. A batch is identified by `id` — that is what `sale_items.stock_batch_id`,
`stock_adjustments.stock_batch_id` and the FIFO loop in `record_sale()` use.
FIFO orders by `(received_date, created_at)` and never reads `batch_number`.

Because references may repeat, anywhere the UI shows one it also shows the
received date, price or remaining quantity so two arrivals stay tellable apart.

---

## Example

Reference 080126:

```
Product:
Brake Pad Toyota Vios

Quantity:
20

Capital:
₱800

Interest:
30%

Selling:
₱1,040
```

---

Reference 080826:

```
Product:
Brake Pad Toyota Vios

Quantity:
30

Capital:
₱900

Interest:
30%

Selling:
₱1,170
```

---

# 5.6 sales Table

## Purpose

Stores completed customer transactions.

A single sale can contain multiple products and multiple stock batches.

---

## Fields

| Field          | Type      | Description            |
| -------------- | --------- | ---------------------- |
| id             | uuid      | Primary key            |
| shop_id        | uuid      | Owner shop             |
| sold_by        | uuid      | User who recorded sale |
| total_amount   | decimal   | Total customer payment |
| total_profit   | decimal   | Total earned profit    |
| payment_status | text      | Paid, partial, credit  |
| sale_date      | timestamp | Transaction date       |
| voided_at      | timestamp | Set when cancelled     |
| voided_by      | uuid      | Owner who cancelled it |
| void_reason    | text      | Why it was cancelled   |
| replaces_sale_id | uuid    | Original sale replaced by this amendment |
| created_at     | timestamp | Creation date          |

A live sale has `voided_at IS NULL`. That predicate is what every report filters
on, so it is the single fact that decides whether a sale counts.

An amended sale is a new row. Its `replaces_sale_id` points to the voided row it
replaces; later amendments point to the preceding replacement, forming an
auditable chain. The replacement preserves the original `sale_date`, while its
`created_at` records when the correction was entered. Original payment rows are
kept and marked voided; the replacement receives new ledger rows. Refunds and
overpayment handling are not part of MVP.

---

## Payment Status

Possible values:

```
PAID

PARTIAL

CREDIT
```

---

# 5.7 sale_items Table

## Purpose

Stores individual products inside a sale transaction.

A single sale may use multiple stock batches — either because FIFO spanned them,
or because the staff added the same product twice and picked a different batch
each time.

---

## Fields

| Field                | Type      | Description            |
| -------------------- | --------- | ---------------------- |
| id                   | uuid      | Primary key            |
| sale_id              | uuid      | Related sale           |
| stock_batch_id       | uuid      | Inventory batch used   |
| quantity             | integer   | Quantity sold          |
| capital_price        | decimal   | Cost per item          |
| suggested_price      | decimal   | Original selling price |
| actual_selling_price | decimal   | Actual customer price  |
| profit               | decimal   | Earned profit          |
| created_at           | timestamp | Creation date          |

---

## FIFO Example

Customer buys:

```
10 Brake Pads
```

Available:

```
Batch 001:
5 pieces

Batch 002:
20 pieces
```

System creates:

```
Sale Item 1

Batch:
001

Quantity:
5
```

and:

```
Sale Item 2

Batch:
002

Quantity:
5
```

---

# 5.8 stock_adjustments Table

## Purpose

Tracks manual inventory changes.

Examples:

- Damaged products
- Lost products
- Inventory correction

---

## Fields

| Field           | Type      | Description               |
| --------------- | --------- | ------------------------- |
| id              | uuid      | Primary key               |
| shop_id         | uuid      | Owner shop                |
| stock_batch_id  | uuid      | Related batch             |
| quantity_change | integer   | Added or removed quantity |
| reason          | text      | Explanation               |
| adjusted_by     | uuid      | User responsible          |
| created_at      | timestamp | Creation date             |

Manual adjustments are written by `adjust_stock()` (migration
`20261121000100`). In one transaction it locks the batch, inserts this row, and
applies `quantity_remaining = quantity_remaining + quantity_change`, refusing
results below zero or above `quantity_received`. Voids still write their own
restore rows through `void_sale()`. For every batch, `quantity_remaining`
should equal `quantity_received` minus all `sale_items.quantity` plus all
`stock_adjustments.quantity_change`.

---

# 5.9 expenses Table

## Purpose

Stores operating expenses recorded by a shop. Expenses use a calendar date so
a past cost can be entered without changing the date of a sale.

## Fields

| Field        | Type      | Description           |
| ------------ | --------- | --------------------- |
| id           | uuid      | Primary key           |
| shop_id      | uuid      | Owner shop            |
| expense_date | date      | Day the cost occurred |
| name         | text      | Expense description   |
| amount       | decimal   | Positive amount       |
| notes        | text      | Optional details      |
| created_by   | uuid      | User who recorded it  |
| created_at   | timestamp | Creation date         |
| updated_at   | timestamp | Last update           |
| deleted_at   | timestamp | Soft-delete timestamp |
| deleted_by   | uuid      | User who deleted it   |

Only active expenses (`deleted_at IS NULL`) reduce net profit. Both OWNER and
ASSISTANT users may record, edit, and soft-delete expenses in their own shop.

```
Net profit = Sales profit - Active expenses
```

---

# 6. Inventory Rules

## Rule 1: Product and Batch Separation

A product can have multiple stock batches.

---

## Rule 2: New Supplier Prices Create New Batches

Old batches remain unchanged.

---

## Rule 3: Stock Updates Automatically

When sales occur:

```
quantity_remaining
```

must automatically decrease.

---

## Rule 4: FIFO Deduction

The oldest available inventory must be deducted first, unless the sale names the
batch it comes out of.

A sale line may carry a `stock_batch_id`. When it does, that batch is deducted on
its own and the sale is refused if it is short — the staff chose that batch and
its capital price, and another batch would give a different profit. When it does
not, the batches are taken oldest first as above. See Migration 022.

---

# 7. Sales Rules

Sales must support:

- Product searching
- Selecting available stock
- Selecting correct batch
- Quantity input
- Actual selling price input
- Discount handling

---

## Voiding a Sale

A recorded sale is never deleted. It is voided, which means the row stays and
stops counting.

Rules:

- Only an OWNER may void, and only a sale in their own shop.
- A reason is required. `sales_void_reason_required` enforces it in the database,
  not just in the form.
- The stock goes back to the exact batches it was deducted from, and each batch
  credited gets a `stock_adjustments` row so the movement is in the inventory
  history like any other correction.
- If a batch cannot take its units back without exceeding `quantity_received`,
  the whole void is refused. That batch has already been corrected another way,
  and restoring the rest would leave inventory silently wrong.
- Payments already collected are marked `sale_payments.voided_at` rather than
  deleted. The amount, date, collector and note stay readable on the sale;
  `amount_paid` and `payment_status` are recomputed from live payments only.
- No further payment can be collected against a voided sale.
- Every report — daily totals, profit, collections, top products, customer
  balances — excludes voided sales. The sales list and the sale detail page still
  show them, labelled as voided.

All of this happens inside `void_sale()`, in one transaction. See Migration 023
in `database-migrations.md`.

Payment collections are ledger rows, not edits to the sale. `collected_at` is
when the customer handed over the money and `created_at` is when staff entered
the row. Revenue reports use `sales.sale_date`; daily and monthly collection
reports use `sale_payments.collected_at`. A later payment therefore changes the
collection day without changing the original sale date. `amount_paid` and
`payment_status` remain trigger-derived.

On the Credit page, all non-voided credit sales for a customer are presented as
one account: credited items are listed together and total credited, paid, and
outstanding amounts are shown separately. A customer-level payment is not
assigned to a product in the UI. `record_customer_payment()` locks that
customer's outstanding sales oldest-first, validates against their combined
balance, and allocates the payment in one transaction. Each sale allocation is
still written to `sale_payments`, so existing sale balances, voiding, and
reports continue to use the same ledger. The new nullable
`sale_payments.payment_group_id` groups those allocation rows for the single
payment shown in customer history. Existing rows remain NULL and are not
backfilled or otherwise changed.

---

# 8. Profit Calculation

Formula:

```
Profit = Actual Selling Price - Capital Price
```

Example:

```
Capital Price:
₱900

Actual Selling Price:
₱1,100

Profit:
₱200
```

---

# 9. Future Database Improvements

Not included in MVP:

## expenses

For:

- Rent
- Electricity
- Transportation
- Other costs

## suppliers

For:

- Supplier information
- Purchase history

## branches

For multiple business locations.

## subscriptions

For SaaS monetization.

## audit_logs

For detailed activity history.

---

# End of Database Design
