# StockFlow

StockFlow is a multi-tenant inventory, sales, payment, and profit management
system for small businesses. It is designed for shops that need reliable
batch-level stock tracking, accurate sales history, and clear daily reporting.

Each shop operates in an isolated workspace. Products, inventory, sales,
payments, customers, and reports are scoped to the authenticated shop.

## Core capabilities

- Product and category management
- Batch-based inventory receiving
- Historical batch references and pricing
- FIFO inventory deduction with explicit batch selection
- Stock adjustments with audit reasons, applied atomically with the stock change
- Sales recording with manual price adjustments and duplicate-submission protection (sales and customer payments)
- Expense change history (who edited or deleted what, with previous values)
- Credit sales and partial payments
- Consolidated customer credit balances with one item history and customer-level installments
- Payment received-date tracking
- Sale voiding with stock restoration
- Sale amendments through an auditable replacement-sale workflow
- Daily, weekly, monthly, and custom on-screen reports
- Dynamic daily, weekly, and monthly PDF report exports
- Inventory search, category filtering, stock-status filtering, and sorting
- Sold-out batch history protection
- Owner and assistant role-based access

## Technology stack

- Next.js 16 App Router
- React 19 and TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth and Row Level Security (RLS)
- Vercel-compatible server runtime
- PDFKit for dynamic in-memory PDF generation

## User roles

### SUPER_ADMIN

Manages shops and platform accounts. Business inventory, sales, and financial
records remain protected from platform-wide access unless the account is also
authorized for that shop.

### OWNER

Manages the shop, products, categories, inventory, assistants, sales, reports,
voids, and sale amendments.

### ASSISTANT

Can view inventory and reports, receive stock, record sales, choose batches,
and collect payments. Assistants cannot void or amend recorded sales or manage
shop ownership.

## Local setup

### Requirements

- Node.js compatible with the project’s Next.js version
- npm
- A Supabase project

### Environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-anon-key
```

Only the publishable/anon key belongs in this application. Never add or expose
a Supabase `service_role` key. StockFlow relies on authenticated access and RLS
for tenant isolation.

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database setup

The complete database definition and migration history are in
[`supabase/migrations/`](supabase/migrations/).

For a fresh project, apply every migration in filename order. For a live project,
back up first, verify which migrations are missing, and apply only those—do not
replay the entire chain. The current migration chain includes:

- Core schema, indexes, RLS, and helper functions
- Inventory and FIFO sale recording
- Payment ledger and derived payment status
- Explicit batch selection
- Sale voiding and stock restoration
- Sale amendment and replacement links
- Credit payment received-date validation
- Batch deletion and historical-product deletion protection
- Customer-level credit payment allocation while preserving per-sale balances

After applying migrations, run [`docs/verify-setup.sql`](docs/verify-setup.sql)
in the Supabase SQL editor. Every verification row should return `PASS`.

See [`docs/SETUP.md`](docs/SETUP.md) for the full setup and deployment
procedure.

## Important business rules

- Inventory is batch-based; old purchase prices are never overwritten.
- FIFO is the default fallback when no batch is explicitly selected.
- Sales are voided, not deleted.
- Amendments void the original sale and create a linked replacement sale.
- Sale revenue uses the original sale date.
- Collections use the actual payment received date.
- `amount_paid` and `payment_status` are derived from the payment ledger.
- Sold-out batches remain available as historical records.
- Products with stock-batch history cannot be deleted.
- Reports exclude voided sales and voided payments.
- Refunds and overpayment handling are outside the current MVP scope.

## Reports and PDF export

On-screen reports support daily, weekly, monthly, and custom date ranges.

PDF export is generated dynamically for:

- Today or a selected daily report
- The current week
- The current month

Generated PDFs are returned directly to the browser. They are not saved in
Supabase Storage, a reports table, or permanent application files.

## Verification

Run the complete project verification before committing or deploying:

```bash
npm run verify
```

This runs:

1. TypeScript type checking
2. ESLint
3. Next.js production build

StockFlow currently has no automated application test suite. Database
verification and end-to-end business workflows should also be tested manually,
especially FIFO, voiding, amendments, payment dates, RLS isolation, and PDF
export.

## Deployment

StockFlow is designed for Vercel and Supabase:

1. Apply and verify all Supabase migrations.
2. Configure the two public environment variables in Vercel.
3. Set the production Supabase authentication site URL and redirect URL.
4. Run `npm run verify` locally.
5. Test the production deployment with owner, assistant, and cross-shop flows.

Do not deploy until the database verification script passes and the critical
sales, inventory, payment, and reporting workflows have been tested.

## Project documentation

- [`docs/SRS.md`](docs/SRS.md) — functional requirements and business rules
- [`docs/DATABASE.md`](docs/DATABASE.md) — database design and data rules
- [`docs/database-migrations.md`](docs/database-migrations.md) — migration history
- [`docs/SETUP.md`](docs/SETUP.md) — Supabase setup and deployment instructions
- [`docs/verify-setup.sql`](docs/verify-setup.sql) — database verification checks
- [`AGENTS.md`](AGENTS.md) — development and architecture rules

## Known limitations

- Refund and overpayment workflows are not included.
- Custom date-range PDF export is not included.
- Inventory filtering is currently client-side after the shop inventory is loaded.
- There is no in-app password reset flow yet.
- Expense management is planned for a future release.
