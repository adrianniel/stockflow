-- Harden SECURITY DEFINER RLS helpers.
--
-- These three functions default to EXECUTE FOR PUBLIC because no REVOKE was
-- issued when they were created. They are safe to call from any role (no
-- parameters, pinned search_path, always resolves against auth.uid()), but
-- restricting EXECUTE to authenticated follows the principle of least
-- privilege and satisfies stricter security audits.

REVOKE ALL ON FUNCTION public.get_user_shop_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_shop_id() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
