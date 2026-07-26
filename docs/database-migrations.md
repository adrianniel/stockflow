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
- batch_number
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

# RLS Permission Structure

## SUPER_ADMIN

Platform administrator.

Permissions:

- Access all shops
- Manage all users
- View all inventory
- View all sales
- Manage the entire platform

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
StockFlow Database MVP v1.0
```

Status:

```
COMPLETED
```

The database is ready for:

- Next.js integration
- Supabase client setup
- Authentication development
- Frontend implementation

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
StockFlow MVP Database v1.0
```
