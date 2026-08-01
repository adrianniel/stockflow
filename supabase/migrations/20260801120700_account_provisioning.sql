-- Account provisioning: assistant limit, deactivation, and privilege tightening.
--
-- Three separate problems, grouped because they all concern `public.users` and
-- the owner's new ability to create accounts from the app.
--
-- 1. Privilege escalation through the INSERT policy
--
--    The baseline lets an OWNER insert any row whose shop_id matches their own
--    shop — including one with role 'SUPER_ADMIN'. An owner could therefore mint
--    a platform-administrator account for themselves. SRS 5.2 gives owners the
--    right to "create assistant accounts" and nothing more, so the policy is
--    narrowed to exactly that.
--
--    The UPDATE policy had the same shape plus a second gap: no WITH CHECK. A
--    USING-only policy tests the row as it was, never as it becomes, so an owner
--    could move one of their users into another shop, or promote an assistant to
--    SUPER_ADMIN. Both are now checked on the resulting row.
--
-- 2. No way to free an assistant slot
--
--    SRS 5.3 caps a shop at 2 assistants. DELETE on users is super-admin only,
--    and deleting a profile would blank `sales.sold_by` (ON DELETE SET NULL) and
--    lose the record of who sold what. So departure is modelled as deactivation
--    instead: the row stays, the history stays, the slot is freed.
--
-- 3. The cap was only ever a UI rule
--
--    Enforced here as a trigger so it holds against concurrent requests and
--    against anything that writes outside the app. The shop row is locked first,
--    which serialises simultaneous inserts for the same shop — two requests
--    counting "1 existing assistant" at the same time would otherwise both pass.
--
-- Deactivated users keep their auth account. Revoking the auth login itself
-- needs the admin API and therefore the service_role key, which this project
-- deliberately does not hold; `status` is enforced in the application guards
-- (lib/auth/guards.ts) on every request instead.

-- ---------------------------------------------------------------------------
-- users.email
-- ---------------------------------------------------------------------------
-- A display copy of the address the account signs in with. Sign-in credentials
-- stay in auth.users; this column exists because reading auth.users needs the
-- admin API, so without it an owner looking at their assistant list would see
-- names and no way to tell which login each row belongs to.
--
-- Nullable because accounts created before this migration have no copy to
-- backfill from, and drift is possible if an address is later changed in the
-- Supabase dashboard. auth.users remains the source of truth.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.users.email IS
    'Display copy of the auth email, captured when the account was created here. auth.users is authoritative; this may drift if the address is changed in the Supabase dashboard.';

-- ---------------------------------------------------------------------------
-- users.status
-- ---------------------------------------------------------------------------

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE public.users
    ADD CONSTRAINT users_status_check
    CHECK (status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text]));

COMMENT ON COLUMN public.users.status IS
    'ACTIVE or INACTIVE. INACTIVE users keep their history and their auth account but are refused at the route guards and do not occupy an assistant slot.';

-- ---------------------------------------------------------------------------
-- Policy tightening
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins and owners can create users" ON public.users;
CREATE POLICY "Admins and owners can create users" ON public.users
    FOR INSERT WITH CHECK (
        is_super_admin()
        OR (
            shop_id = get_user_shop_id()
            AND get_user_role() = 'OWNER'
            AND role = 'ASSISTANT'
        )
    );

-- An owner may still edit themselves (rename), which is why the check allows
-- role 'OWNER' on the resulting row rather than forcing 'ASSISTANT'. What it
-- refuses is SUPER_ADMIN, and any shop_id other than their own.
DROP POLICY IF EXISTS "Admins and owners can update users" ON public.users;
CREATE POLICY "Admins and owners can update users" ON public.users
    FOR UPDATE
    USING (
        is_super_admin()
        OR (shop_id = get_user_shop_id() AND get_user_role() = 'OWNER')
    )
    WITH CHECK (
        is_super_admin()
        OR (
            shop_id = get_user_shop_id()
            AND get_user_role() = 'OWNER'
            AND role <> 'SUPER_ADMIN'
        )
    );

-- ---------------------------------------------------------------------------
-- Assistant limit (SRS 5.3)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_assistant_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    existing_assistants integer;
BEGIN
    -- Only an active assistant occupies a slot. Owners, super admins, and
    -- deactivated rows are irrelevant to the cap.
    IF NEW.role <> 'ASSISTANT'
       OR NEW.status <> 'ACTIVE'
       OR NEW.shop_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Serialise concurrent writes for this shop. Without the lock, two
    -- simultaneous inserts each see one existing assistant and both succeed,
    -- leaving three.
    PERFORM 1 FROM public.shops WHERE id = NEW.shop_id FOR UPDATE;

    SELECT count(*)
      INTO existing_assistants
      FROM public.users
     WHERE shop_id = NEW.shop_id
       AND role = 'ASSISTANT'
       AND status = 'ACTIVE'
       AND id <> NEW.id;

    IF existing_assistants >= 2 THEN
        RAISE EXCEPTION
            'This shop already has 2 active assistants. Deactivate one before adding another.';
    END IF;

    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.enforce_assistant_limit() IS
    'Caps a shop at 2 active assistants (SRS 5.3). SECURITY DEFINER so the count is not filtered by the caller''s RLS view of users.';

DROP TRIGGER IF EXISTS enforce_assistant_limit ON public.users;
CREATE TRIGGER enforce_assistant_limit
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.enforce_assistant_limit();
