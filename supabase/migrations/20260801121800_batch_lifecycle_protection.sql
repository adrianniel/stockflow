-- Batch lifecycle protection
--
-- Sold-out batches remain historical records. They must not be deleted
-- directly, and deleting a product must not cascade away its batch history.

DROP POLICY IF EXISTS "Owners and admins can delete stock batches"
ON public.stock_batches;

CREATE OR REPLACE FUNCTION public.prevent_product_delete_with_batches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.stock_batches
        WHERE product_id = OLD.id
    ) THEN
        RAISE EXCEPTION
            'Products with stock batch history cannot be deleted.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN OLD;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_product_delete_with_batches
ON public.products;

CREATE TRIGGER prevent_product_delete_with_batches
    BEFORE DELETE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_product_delete_with_batches();

COMMENT ON FUNCTION public.prevent_product_delete_with_batches() IS
    'Protects stock batch history from product deletion.';
