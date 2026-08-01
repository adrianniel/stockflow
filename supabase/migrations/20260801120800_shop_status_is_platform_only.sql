-- Shop status belongs to the platform administrator, not to the shop.
--
-- Background: the route guards now refuse every member of a shop whose status is
-- INACTIVE (lib/auth/guards.ts). That makes `shops.status` a lockout switch,
-- and the UPDATE policy on shops lets an owner write their own shop row:
--
--     CREATE POLICY "Admins and owners can update shops" ON public.shops
--         FOR UPDATE USING (
--             is_super_admin()
--             OR (id = get_user_shop_id() AND get_user_role() = 'OWNER')
--         );
--
-- The application never sends `status` — updateShopSettings() writes only
-- shop_name, owner_name, and default_interest_percentage. But a policy is not
-- limited to what the app happens to send: an owner with their own publishable
-- key can PATCH /rest/v1/shops directly and set status = 'INACTIVE', locking
-- their entire team out of StockFlow with no way to undo it, since reactivating
-- requires a SUPER_ADMIN. That is a self-inflicted denial of service, and the
-- database should not permit it.
--
-- Why a trigger and not WITH CHECK: the rule is "the value must not change",
-- which needs both the old and the new row. A WITH CHECK expression only sees
-- the new one. Suspension (SRS 5.1) stays a super-admin action.

CREATE OR REPLACE FUNCTION public.enforce_shop_status_is_platform_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    -- Unchanged status is the overwhelmingly common case: every ordinary
    -- settings save lands here and passes without a role lookup.
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
    END IF;

    IF public.is_super_admin() THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'Only a StockFlow administrator can activate or deactivate a shop.';
END;
$function$;

COMMENT ON FUNCTION public.enforce_shop_status_is_platform_only() IS
    'Keeps shops.status writable by SUPER_ADMIN only. Owners can update the rest of their shop row; suspension is a platform decision (SRS 5.1) and self-suspension would lock the shop out irreversibly.';

DROP TRIGGER IF EXISTS enforce_shop_status_is_platform_only ON public.shops;
CREATE TRIGGER enforce_shop_status_is_platform_only
    BEFORE UPDATE ON public.shops
    FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_status_is_platform_only();
