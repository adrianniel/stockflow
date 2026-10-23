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

## Source of truth and project workflow

Before starting a repository task:

1. Read this file, `README.md`, `docs/SRS.md`, and the relevant sections of
   `docs/DATABASE.md` and `docs/SETUP.md`.
2. Inspect `supabase/migrations/`, `docs/database-migrations.md`, and
   `docs/verify-setup.sql` for database work. The migration files and live
   schema—not assumptions from old notes—determine the current database state.
3. Check `git status`, the current branch, and the remote before editing. Do not
   overwrite or discard existing user work.
4. Explain affected files and the approach before changing existing code; ask
   for confirmation when an architectural or data-handling decision is needed.
5. Keep the change scoped, update the relevant docs, verify it, and report what
   was tested and whether it was deployed.

Use TypeScript, Next.js App Router server/client boundaries, existing Supabase
helpers, reusable components, and the current visual conventions. Keep database
and business logic out of UI components. All shop queries should explicitly
scope by the authenticated shop where applicable; RLS remains the security
boundary.

## Production database safety — highest priority

StockFlow is a live system with valuable shop, inventory, sales, customer,
payment, and expense history. **Assume there is no disposable production data.**
The default is to preserve every existing row and its meaning.

- Never run `supabase db reset --linked`, `DROP`, `TRUNCATE`, destructive
  `DELETE`, or an unreviewed bulk `UPDATE` against the linked/production project.
- Do not rewrite, backfill, re-key, or delete existing financial records to fit a
  new UI. Do not change old sale prices, batch prices, collected amounts, sale
  dates, or payment dates.
- Prefer additive, backward-compatible migrations: nullable columns without
  defaults, new indexes, new functions, and new tables/policies when required.
  Avoid data backfills. If a backfill or destructive change is genuinely
  required, stop, explain the exact rows and rollback limits, and get explicit
  user approval for that data operation before proceeding.
- A database migration must preserve shop isolation, role checks, RLS, audit
  history, and existing triggers. `SECURITY DEFINER` functions must pin an empty
  `search_path`, schema-qualify objects, validate the caller's role/shop, and
  perform multi-row business updates in one transaction.
- Do not expose database passwords, access tokens, `service_role` keys, auth
  hashes, or customer data in chat, logs, source files, commits, or public
  storage. Never add a `service_role` key to the web app.

### Required workflow for any live database change

1. Confirm the target project and current branch. Inspect migration history with
   `npx supabase migration list --linked`; do not infer production state from
   filenames alone.
2. Before changing production, create and verify a logical backup outside the
   repository. On the free Supabase tier, the CLI can export roles, schema, and
   data separately. A typical PowerShell backup uses a private folder outside
   the repository:

   ```powershell
   $backupDir = Join-Path $HOME "Documents\StockFlowBackups\YYYYMMDD"
   New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
   npx supabase db dump --linked --role-only --file (Join-Path $backupDir "roles.sql")
   npx supabase db dump --linked --schema public --file (Join-Path $backupDir "schema.sql")
   npx supabase db dump --linked --schema public --data-only --use-copy --file (Join-Path $backupDir "data.sql")
   npx supabase db dump --linked --schema auth --data-only --use-copy --file (Join-Path $backupDir "auth-data.sql")
   ```

   The auth dump contains highly sensitive login data, including password
   hashes and token records. Keep the folder private, never commit/share it, and
   restrict its filesystem permissions. Do not leave backups in a shared
   temporary directory. Verify every dump is non-empty; if you create an
   archive, verify it can be opened and record its SHA-256 checksum. Do not
   print credentials to verify them.

   A logical dump is not a one-click clone of a Supabase project: managed Auth
   schema versions, provider settings, API/JWT secrets, Storage objects, and
   other project settings may need separate recovery. Never restore a dump over
   the active production database as a routine rollback. Restore only with an
   explicit recovery plan, preferably into a separate compatible project.
3. Test the SQL migration on a disposable local PostgreSQL/Supabase instance
   with representative existing rows. Test preservation of old rows, role and
   cross-shop rejection, amount limits, concurrency/locking behavior where
   relevant, and rollback/atomicity. If no staging Supabase project exists, use
   a local disposable database; do not use production as a test database.
4. Review the SQL manually for any `UPDATE`, `DELETE`, `DROP`, default that
   rewrites existing rows, or trigger side effect. Make sure old rows remain
   valid and the currently deployed app still works with the additive schema.
5. Run `npx supabase db push --linked --dry-run`. Proceed only if it lists
   exactly the intended new migration. If it lists older migrations, stop and
   resolve migration history; never push the whole chain blindly.
6. Apply only the approved migration. Then run
   `npx supabase db query --linked --file docs/verify-setup.sql` and require
   every row to return `PASS` before deploying code that depends on the change.
7. Never perform fake/test business transactions in production. Verify new
   payment or inventory behavior locally; use production only for read-only
   checks unless the user explicitly requests a real transaction.

### Financial and inventory invariants

- Inventory is batch-based. Supplier arrivals create new batches; old prices
  and historical batches are never overwritten or deleted. Stock sale deduction
  follows FIFO unless a batch is explicitly selected.
- Sale rows are voided, not deleted. Amendments retain the original and create
  a linked replacement. Voids and payments must preserve their audit history.
- `sales.amount_paid` and `payment_status` are derived from the
  `sale_payments` ledger. Do not update them directly.
- Credit is consolidated per customer in the UI: one item history, one total
  credited/paid/outstanding balance, and customer-level installment entry.
  `record_customer_payment()` allocates a new payment to the oldest outstanding
  sale first in one transaction. Its sale-level allocations share
  `sale_payments.payment_group_id`; historical rows remain NULL and must never
  be backfilled merely for display.
- Existing reports derive collections from the live payment ledger. Any change
  to allocations, voids, or payment groups must keep report totals and
  `amount_paid` consistent.

## Verification, release, and deployment

- The project currently has no automated application test suite. Run
  `npm run verify` (TypeScript, ESLint, production build) for every code change.
  For database functions, also run a disposable local SQL test covering
  successful, rejected, and cross-shop cases.
- Before committing, ensure the app runs and there are no obvious errors. Use a
  conventional, descriptive commit message. Do not commit backup files or
  credentials.
- Do not claim a change is live just because it was committed or pushed. For a
  requested production deployment, confirm the push target is `main`, migration
  prerequisites are satisfied, and Vercel reports a successful Production
  deployment. Report clearly if deployment status cannot be checked.
- Keep `README.md`, `docs/SRS.md`, `docs/DATABASE.md`, `docs/SETUP.md`,
  `docs/database-migrations.md`, and `docs/verify-setup.sql` synchronized when
  the shipped behavior or database changes.

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
- Announcements use browser `localStorage` for a shared five-local-day campaign
  window and the permanent “Don’t show this again” choice. Show the relevant
  landing or account message on every visit during that window; closing with X
  only dismisses the current display.
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
