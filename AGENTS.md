# StockFlow AI Development Guidelines

## Project Overview

StockFlow is a multi-tenant inventory and profit management system for small businesses.

The system allows multiple businesses (shops) to manage:

- Products
- Categories
- Stock batches
- Sales
- Inventory adjustments
- Expenses
- Profit reports

The architecture must support multiple shops using one application.

---

# Core Development Rules

## General Rules

- Always read the project documentation before implementing features.
- Follow the requirements written in docs/SRS.md.
- Follow database decisions written in docs/DATABASE.md.
- Do not create features that are not aligned with the system requirements.
- Explain important architectural decisions before implementing them.

---

# Technology Stack

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS

Backend:

- Next.js server functionality

Database:

- Supabase PostgreSQL

Authentication:

- Supabase Auth

Deployment:

- Vercel

---

# Coding Standards

- Use TypeScript.
- Write clean and maintainable code.
- Use reusable components.
- Avoid duplicated logic.
- Keep business logic separate from UI components.
- Use meaningful variable and function names.

---

# Database Rules

StockFlow is a multi-tenant system.

Every business-related table must be connected to a shop.

Never create tables that allow data leakage between shops.

Important concepts:

- A shop owns products.
- Products can have multiple stock batches.
- Stock batches contain capital price and selling price.
- Sales must track actual sold price.
- Profit calculations must use actual transactions.

---

# Inventory Rules

The inventory system follows batch-based inventory.

Important:

- Never overwrite old stock prices.
- New arrivals create new stock batches.
- The same product can have multiple batches.
- FIFO (First In, First Out) must be followed when deducting stock.

---

# Sales Rules

Sales must support:

- Searching products
- Selecting available inventory
- Automatic FIFO deduction
- Multiple batches in one transaction
- Manual selling price adjustment
- Actual profit calculation

---

# Before Making Changes

Before modifying existing code:

1. Explain what files will change.
2. Explain why the changes are needed.
3. Confirm the approach.

---

# Release Announcements

- Keep the current landing-page and authenticated-account update copy in
  `lib/updates/current-release.ts`.
- When publishing a new update announcement, change its `id` so browsers can
  recognize the new release, then update the landing and account bullet lists.
- Announcements use browser `localStorage` for once-per-local-day reminders,
  the five-day display limit, and the permanent “Don’t show this again” choice.
- Do not add announcement preferences or display bookkeeping to Supabase or
  change business records for announcement UI.
- Keep the public landing and signed-in account messages distinct; keep copy
  short, mobile-readable, and synchronized with what actually ships.

---

# Git Rules

Before suggesting a commit:

- Ensure the application runs.
- Ensure there are no obvious errors.
- Suggest a clear commit message.

Example:

Good:
"Implement product management module"

Bad:
"Changes"
