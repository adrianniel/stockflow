-- Pin search_path on the SECURITY DEFINER helpers.
--
-- Why this matters: these three functions run with the definer's privileges and
-- are called by every RLS policy in the database. Without a pinned
-- search_path, a caller who can create objects in a schema that appears earlier
-- in their own search_path can shadow the unqualified `users` reference and
-- make the function read a table they control — which decides what every policy
-- lets them see. Pinning search_path to empty forces fully-qualified names and
-- removes the ambiguity.
--
-- The bodies are otherwise unchanged; only the reference to `users` becomes
-- `public.users` and `auth.uid()` stays explicit.

CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    RETURN (
        SELECT shop_id
        FROM public.users
        WHERE auth_id = auth.uid()
        LIMIT 1
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    RETURN (
        SELECT role
        FROM public.users
        WHERE auth_id = auth.uid()
        LIMIT 1
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    RETURN (
        SELECT EXISTS (
            SELECT 1
            FROM public.users
            WHERE auth_id = auth.uid()
              AND role = 'SUPER_ADMIN'
        )
    );
END;
$function$;

-- The updated_at trigger is not SECURITY DEFINER, but it also gains nothing
-- from a mutable search_path and touches no tables, so pin it too.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;
