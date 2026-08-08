-- Batch references stop being unique per product.
--
-- What changed and why
-- --------------------
-- 20260801120300 created a unique index on (product_id, lower(batch_number)) on
-- the reasoning that "batch numbers identify a batch to the shop staff, so they
-- must be unambiguous within a product". That reasoning held only while the
-- field was assumed to be a supplier-issued batch number, one per delivery.
--
-- In practice shops use it as their own arrival reference — most often the date
-- of the arrival, written however the shop writes dates (080826). Two arrivals
-- of the same product on the same day are ordinary, and so are two deliveries
-- a shop chooses to label the same way. The unique index turned both into a
-- 23505 error at the receiving form, which is the shop being told its own
-- filing system is wrong.
--
-- So the reference becomes what it is actually used for: a human-readable note
-- about which arrival this stock came from. It is not an identifier and nothing
-- keys off it.
--
-- What still identifies a batch
-- -----------------------------
-- stock_batches.id, as it always has. Every link in the system already uses it:
--   * sale_items.stock_batch_id      — which batch each sold unit came from
--   * stock_adjustments.stock_batch_id — which batch a correction touched
--   * record_sale()'s FIFO loop        — locks and decrements rows by id, and
--                                        orders by (received_date, created_at),
--                                        never by batch_number
-- Dropping this index therefore changes no join, no deduction, no profit
-- figure, and no historical record. Existing rows are untouched: this migration
-- writes no data.
--
-- Duplicate references are now the caller's business to disambiguate on screen,
-- which the batch pickers and tables do with received date, price and quantity.

DROP INDEX IF EXISTS public.stock_batches_product_batch_number_key;

COMMENT ON COLUMN public.stock_batches.batch_number IS
    'Shop-chosen reference for the arrival this stock came from (e.g. 080826, DR-1042). Free-form, not unique, not auto-numbered — it exists so staff can tell two arrivals of the same product apart. The batch identity is id.';
