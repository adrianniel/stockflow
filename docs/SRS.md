# StockFlow

## Software Requirements Specification (SRS)

Version: 1.0 (MVP)

---

# 1. Introduction

## 1.1 Project Overview

StockFlow is a multi-tenant inventory and profit management system designed for small businesses.

The system allows multiple shops to manage their products, inventory batches, sales transactions, and business performance reports using a single platform.

The first target users are small auto parts businesses, but the system should be designed to support other businesses with similar inventory workflows.

---

# 2. Problem Statement

Many small businesses still manage inventory and sales using manual records.

This creates problems such as:

- Difficulty tracking available stocks
- Errors in recording sold items
- Difficulty monitoring actual profit
- Problems when supplier prices change
- Lack of organized business reports
- Difficulty monitoring business performance

StockFlow aims to provide a simple and organized solution for inventory management and financial monitoring.

---

# 3. System Objectives

The system should allow businesses to:

- Record incoming stocks
- Manage products and categories
- Track inventory quantities
- Record sold items
- Automatically deduct inventory
- Calculate actual profit
- Generate business reports
- Support multiple businesses using one platform

---

# 4. System Architecture Overview

StockFlow follows a multi-tenant SaaS architecture.

One application can serve multiple businesses.

Each business has isolated data.

Example:

Shop A:

- Products
- Inventory
- Sales
- Reports

Shop B:

- Products
- Inventory
- Sales
- Reports

A shop must never access another shop's information.

---

# 5. User Roles

## 5.1 Super Admin

The Super Admin manages the entire StockFlow platform.

Responsibilities:

- Create shop accounts
- Create owner accounts
- Manage registered businesses
- Monitor platform usage

Restrictions:

- Cannot access business data unless authorized

---

## 5.2 Shop Owner

The Shop Owner manages their own business.

Permissions:

- Manage products
- Add inventory
- Record sales
- View reports
- Create assistant accounts
- Change password

---

## 5.3 Assistant

The assistant helps operate the daily business activities.

Maximum assistants per shop:

2 accounts

Permissions:

- Add new stock arrivals
- Record sales
- View inventory
- View reports

Restrictions:

- Cannot manage shop ownership
- Cannot access other shops

---

# 6. Functional Requirements

---

# 6.1 Authentication

The system must provide:

- User login
- User logout
- Password change
- Role-based access control

---

# 6.2 Shop Management

Super Admin can:

- Create new shops
- Assign shop owners
- Manage business accounts

Each shop must have separate records.

---

# 6.3 Product Management

Users can manage products.

Product information includes:

- Product name
- Category
- Brand
- Description (optional)

Products should not store fixed prices because prices may change between stock arrivals.

---

# 6.4 Inventory Management

The system must support batch-based inventory.

Each stock arrival creates a new inventory batch.

Example:

Product:

Brake Pad Toyota Vios

Batch 001:

Capital Price:
₱800

Selling Price:
₱1,040

Quantity:
20

Batch 002:

Capital Price:
₱900

Selling Price:
₱1,170

Quantity:
30

Both batches remain separate.

---

# 7. Inventory Business Rules

## Rule 1: Batch Inventory

A single product can have multiple stock batches.

Example:

The same product can have different:

- Capital prices
- Selling prices
- Arrival dates
- Remaining quantities

---

## Rule 2: Price Changes

When supplier prices change:

The system must create a new stock batch.

The previous batch price must remain unchanged.

Example:

Old stock:

Capital:
₱800

New arrival:

Capital:
₱900

The system keeps both records.

---

## Rule 3: Selling Price Calculation

Selling price is automatically calculated based on:

Capital Price + Interest Percentage

Example:

Capital Price:
₱900

Interest:
30%

Selling Price:
₱1,170

---

# 8. Sales Management

The system must allow users to:

- Search products
- Select available inventory
- Choose which stock batch the sale is deducted from (see section 9)
- Enter quantity
- Adjust actual selling price
- Save sales transaction

---

## Voiding a Recorded Sale

Sales get rung up wrongly: the wrong item, the wrong customer, an order the
customer cancelled a minute later. The system must let the shop cancel such a
sale without deleting it.

Requirements:

- Recorded sales are never permanently deleted.
- Only the shop owner may void a sale. An assistant may record sales and collect
  payments but may not undo a recorded transaction.
- A void requires a written reason, and the reason is kept with the sale.
- The void is confirmed in a dialog that shows which sale is about to be
  cancelled, so the wrong one cannot be voided by a stray click.
- The stock is returned to the exact batches it was deducted from, so capital
  prices and FIFO order stay correct. Each batch credited also appears in the
  stock adjustment history (section 13).
- If a batch cannot take its stock back — it was already corrected by hand — the
  void is refused and the batch is named, rather than restoring part of the sale.
- The sale remains visible in the sales list and on its own page, clearly marked
  as voided, with the reason, the time, and who voided it.
- Payments already collected against the sale are kept for history but stop
  counting as money collected. No further payment can be collected against a
  voided sale.
- Every report excludes voided sales: daily and monthly totals, profit,
  collections, top products, and customer credit balances.

Editing a recorded sale is not part of this: a correction is a void followed by
recording the sale again, which keeps both the original and the replacement in
the history.

---

# 9. FIFO Inventory Deduction

The system follows First In First Out (FIFO) by default.

When a product is sold without naming a batch:

The oldest available stock batch is deducted first.

Example:

Customer buys:

10 pieces

Available:

Batch 001:
5 pieces

Batch 002:
20 pieces

System automatically deducts:

Batch 001:
5 pieces

Batch 002:
5 pieces

## Manual Batch Selection

FIFO is the default, not the only option. The staff recording the sale may name
the batch a line comes out of, because the oldest stock is not always the stock
they can reach — the newer arrival may be at the front of the shelf, or the
customer may be matching a part they bought before.

Rules:

- If a product has one available batch, that batch is used with no extra step.
- If it has several, the batches are shown with reference, received date,
  available quantity and selling price, pre-selected on the oldest. Accepting
  the default deducts exactly what FIFO would have deducted.
- A named batch is deducted on its own. If it does not hold the full quantity
  the sale is refused rather than topped up from another batch, since the other
  batch has a different capital price and therefore a different profit than the
  one shown. The product is added again on the next batch instead, which is a
  second line on the same sale.
- A line that names no batch still follows FIFO across batches, exactly as
  above.

---

# 10. Discount Handling

The system must allow the actual selling price to be different from the suggested selling price.

Example:

Suggested Selling Price:

₱1,170

Customer discount:

Actual Selling Price:

₱1,100

Profit calculation must use the actual selling price.

---

# 11. Profit Calculation

Profit is calculated using:

Actual Selling Price - Capital Price

Example:

Capital Price:

₱900

Actual Selling Price:

₱1,100

Profit:

₱200

---

# 12. Reports (MVP)

The system must provide:

## Dashboard

Displays:

- Today's sales
- Today's profit
- Total products
- Current inventory status

## Sales Reports

Displays:

- Sales history
- Sold products
- Quantity sold
- Total amount

## Profit Reports

Displays:

- Daily profit
- Weekly profit
- Monthly profit

---

# 13. Stock Adjustment

The system must allow manual inventory adjustments.

Examples:

- Damaged items
- Missing items
- Incorrect inventory count
- Stock returned to a batch because its sale was voided (section 8)

Each adjustment must store:

- Quantity change
- Reason
- Date
- User who made the adjustment

---

# 14. MVP Scope

Version 1 includes:

YES:

- Authentication
- Multi-shop architecture
- User roles
- Product management
- Category management
- Batch inventory
- FIFO deduction, with manual batch selection
- Sales recording
- Sale voiding, with stock restored to the original batches
- Profit calculation
- Basic reports

NOT INCLUDED YET:

- Expense management
- Subscription system
- Payment processing
- Advanced analytics
- Business comparison dashboard

---

# 15. Future Enhancements

Possible future features:

- Expense tracking
- Advanced financial reports
- Subscription plans
- Mobile application
- Barcode scanning
- Inventory alerts
- Sales analytics
- Multiple branches

---

# End of Document
