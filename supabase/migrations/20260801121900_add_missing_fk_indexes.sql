-- Add covering indexes for foreign keys that reference users(id).
-- These FKs are used in PostgREST embed/join queries on every
-- sales-related page (seller name, voided-by, collector, adjuster).

CREATE INDEX idx_sales_sold_by ON public.sales (sold_by);
CREATE INDEX idx_sales_voided_by ON public.sales (voided_by);
CREATE INDEX idx_sale_payments_collected_by ON public.sale_payments (collected_by);
CREATE INDEX idx_stock_adjustments_adjusted_by ON public.stock_adjustments (adjusted_by);
