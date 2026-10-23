@AGENTS.md

# Claude Code project entry point

`AGENTS.md` is the canonical, cross-harness guide for StockFlow's architecture,
workflow, business rules, and production database safety requirements. Follow it
for every repository task; do not keep a separate copy of those rules here.

For current product requirements and implementation details, read:

- `README.md` for the project overview, commands, and current capabilities.
- `docs/SRS.md` for functional requirements and business rules.
- `docs/DATABASE.md` and `docs/database-migrations.md` for data design and
  migration history.
- `docs/SETUP.md` and `docs/verify-setup.sql` before any Supabase setup or
  database change.

When documentation and implementation appear to disagree, inspect the live
code and migration state, explain the discrepancy, and update the relevant
source-of-truth docs as part of an approved change. Never infer that production
data is disposable.
