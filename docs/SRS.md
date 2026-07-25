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
- Enter quantity
- Adjust actual selling price
- Save sales transaction

---

# 9. FIFO Inventory Deduction

The system follows First In First Out (FIFO).

When a product is sold:

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
- FIFO deduction
- Sales recording
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
