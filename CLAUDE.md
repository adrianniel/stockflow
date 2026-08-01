@AGENTS.md

# StockFlow - Claude Code Project Context

## Project Overview

StockFlow is a web-based inventory and sales management system designed for small auto parts shops.

The goal of StockFlow is to help shop owners manage:

- Inventory
- Stock batches
- Product pricing
- Sales transactions
- Profit tracking
- Shop users and permissions
- Business reports

The system supports multiple shops with role-based access.

## Technology Stack

Frontend:

- Next.js 16
- React
- TypeScript
- Tailwind CSS

Backend:

- Supabase
- PostgreSQL
- Supabase Authentication
- Row Level Security (RLS)

Libraries:

- @supabase/supabase-js
- react-hook-form

## User Roles

SUPER_ADMIN:

- Manage all shops
- Manage all users
- View system-wide reports

OWNER:

- Manage own shop inventory
- Add products
- Manage stock batches
- Record sales
- View reports
- Manage assistants

ASSISTANT:

- View products
- Record sales
- Perform daily operations with limited access

## Database Tables

Main tables:

shops

- Stores businesses.

users

- Application users connected to Supabase Auth.
- Important fields:
  - auth_id
  - shop_id
  - name
  - role

categories

- Product categories.

products

- Product information.
- Pricing is NOT stored here.

stock_batches

- Stores purchase batches.
- Contains:
  - purchase_price
  - selling_price
  - quantity

sales

- Completed transactions.

sale_items

- Individual items inside sales.
- Must reference the exact stock batch used.

stock_adjustments

- Inventory corrections and changes.

## Database Security

RLS is enabled on all tables.

Never disable RLS.

Security depends on:

- Supabase Auth
- RLS policies
- User roles

Never expose service_role keys.

## Authentication Flow

Login Page
↓
Supabase Auth
↓
auth.users
↓
users table
↓
Role detection
↓
Dashboard

Authentication files:

lib/supabase/client.ts
lib/supabase/auth.ts

Available functions:

- signIn()
- signOut()
- getCurrentUser()
- getUserProfile()

## Current Progress

Completed:

- Next.js setup
- Supabase project
- Database schema
- 8 database tables
- Constraints
- Indexes
- RLS policies
- Supabase client connection
- Database testing
- Email authentication
- Auth helper
- Login page
- Dashboard routing

## Dashboard Routes

/dashboard
/dashboard/admin
/dashboard/owner
/dashboard/assistant

Dashboard UI is still being improved.

## UI Guidelines

Use:

- Tailwind CSS
- Reusable components
- Responsive layouts

Design style:

- Modern SaaS dashboard
- Professional inventory system
- Clean and simple interface

## Business Rules

Profit:

Selling Price - Purchase Price

Example:
Purchase: 500
Selling: 700
Profit: 200

When a sale happens:

1. Identify exact stock batch
2. Reduce quantity
3. Create sale record
4. Create sale_items record
5. Calculate profit

Products may have multiple batches with different prices.

## Coding Rules

Always:

- Use TypeScript
- Follow Next.js App Router
- Keep components reusable
- Avoid unnecessary rewrites

Before changing database:

- Review DATABASE.md
- Review database-migrations.md

Never:

- Remove RLS
- Store passwords manually
- Replace Supabase
- Ignore existing architecture

## Development Workflow

1. Understand requirements
2. Review documentation
3. Plan changes
4. Implement
5. Test
6. Document

## Claude Code Instructions

Before making changes:

1. Read CLAUDE.md
2. Review existing project structure
3. Preserve current architecture
4. Explain destructive changes before applying them
5. Keep solutions clean and maintainable
