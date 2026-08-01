"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/guards";
import {
  databaseFailure,
  failure,
  success,
  type ActionState,
} from "@/lib/shop/action-result";
import {
  FormErrors,
  isUuid,
  readOptionalString,
  readString,
  requiredNumber,
  requiredText,
} from "@/lib/shop/form";
import {
  AccountCreationError,
  AccountExistsError,
  createAuthAccount,
} from "@/lib/shop/provisioning";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Platform administration writes (SRS 5.1, 6.2).
 *
 * Every action starts with requireRole("SUPER_ADMIN"). RLS enforces the same
 * thing underneath — `shops` INSERT is `is_super_admin()` only — so the check
 * here exists to produce a readable error rather than an empty result.
 *
 * Nothing in this file touches business data. Migration 20260801120400 removed
 * the super-admin bypass from products, stock, and sales, so an attempt would
 * fail anyway; the point is that the platform operator administers accounts and
 * does not read what shops pay their suppliers.
 */

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates a shop. Its owner account is created separately, from Users. */
export async function createShop(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole("SUPER_ADMIN");

  const supabase = await createSupabaseServerClient();
  const errors = new FormErrors();

  const shopName = requiredText(form, "shop_name", errors, {
    label: "Shop name",
    max: 150,
  });
  const ownerName = readOptionalString(form, "owner_name");
  const interest = requiredNumber(form, "default_interest_percentage", errors, {
    label: "Default interest",
    min: 0,
    max: 1000,
  });

  if (errors.hasErrors) {
    return failure("Check the highlighted fields.", errors.all);
  }

  const { error } = await supabase.from("shops").insert({
    shop_name: shopName,
    owner_name: ownerName,
    status: "ACTIVE",
    default_interest_percentage: interest,
  });

  if (error) {
    return databaseFailure(error, "Could not create the shop.");
  }

  revalidatePath("/dashboard/shops");
  revalidatePath("/dashboard/admin");

  return success(`"${shopName}" created. Add its owner account next.`);
}

/** Renames a shop and adjusts its default markup. Status is changed separately. */
export async function updateShop(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole("SUPER_ADMIN");

  const supabase = await createSupabaseServerClient();
  const errors = new FormErrors();

  const id = readString(form, "id");
  const shopName = requiredText(form, "shop_name", errors, {
    label: "Shop name",
    max: 150,
  });
  const ownerName = readOptionalString(form, "owner_name");
  const interest = requiredNumber(form, "default_interest_percentage", errors, {
    label: "Default interest",
    min: 0,
    max: 1000,
  });

  if (!isUuid(id)) {
    return failure("That shop could not be found.");
  }

  if (errors.hasErrors) {
    return failure("Check the highlighted fields.", errors.all);
  }

  const { error } = await supabase
    .from("shops")
    .update({
      shop_name: shopName,
      owner_name: ownerName,
      default_interest_percentage: interest,
    })
    .eq("id", id);

  if (error) {
    return databaseFailure(error, "Could not save that shop.");
  }

  revalidatePath("/dashboard/shops");

  return success("Shop updated.");
}

/**
 * Suspends or restores a shop.
 *
 * Deactivating locks out everyone who works there: requireSession() refuses any
 * profile whose shop is INACTIVE. Nothing is deleted, and reactivating restores
 * access with no further steps. This is a platform-only switch, enforced by the
 * enforce_shop_status_is_platform_only trigger as well as by the role check
 * here — an owner must not be able to suspend their own shop.
 */
export async function setShopStatus(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole("SUPER_ADMIN");

  const supabase = await createSupabaseServerClient();

  const id = readString(form, "id");
  const status = readString(form, "status");

  if (!isUuid(id)) {
    return failure("That shop could not be found.");
  }

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    return failure("Unknown status.");
  }

  const { error } = await supabase
    .from("shops")
    .update({ status })
    .eq("id", id);

  if (error) {
    return databaseFailure(error, "Could not change that shop.");
  }

  revalidatePath("/dashboard/shops");
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/admin");

  return success(
    status === "ACTIVE"
      ? "Shop reactivated. Its team can sign in again."
      : "Shop deactivated. Its team can no longer sign in.",
  );
}

/**
 * Creates an owner account for a shop.
 *
 * Owners are created here rather than by the shop itself, since a shop's first
 * account has nobody to create it. Assistants are the owner's own business and
 * are added from /dashboard/assistants.
 *
 * The auth account and the profile row are two writes that cannot share a
 * transaction — see the same note on createAssistant. A failure between them
 * leaves a login with no profile, which grants no access because
 * requireSession() rejects it.
 */
export async function createOwner(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireRole("SUPER_ADMIN");

  const supabase = await createSupabaseServerClient();
  const errors = new FormErrors();

  const name = requiredText(form, "name", errors, {
    label: "Full name",
    max: 150,
  });

  const shopId = readString(form, "shop_id");
  const email = readString(form, "email").toLowerCase();
  const password = readString(form, "password");

  if (!isUuid(shopId)) {
    errors.add("shop_id", "Choose a shop.");
  }

  if (email === "") {
    errors.add("email", "Email is required.");
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.add("email", "Enter a valid email address.");
  }

  if (password === "") {
    errors.add("password", "A temporary password is required.");
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.add("password", `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  if (errors.hasErrors) {
    return failure("Check the highlighted fields.", errors.all);
  }

  // A shop is meant to have one owner. This is a warning rather than a
  // constraint — a handover period with two owners is legitimate — so it only
  // reports, and the insert proceeds.
  const { data: existingOwners, error: ownerError } = await supabase
    .from("users")
    .select("id")
    .eq("shop_id", shopId)
    .eq("role", "OWNER")
    .eq("status", "ACTIVE");

  if (ownerError) {
    return databaseFailure(ownerError, "Could not check that shop's accounts.");
  }

  let authId: string;
  let requiresConfirmation: boolean;

  try {
    const account = await createAuthAccount(email, password);
    authId = account.authId;
    requiresConfirmation = account.requiresConfirmation;
  } catch (error) {
    if (error instanceof AccountExistsError) {
      return failure(error.message, {
        email: "This email is already registered.",
      });
    }

    if (error instanceof AccountCreationError) {
      return failure(error.message);
    }

    throw error;
  }

  const { error } = await supabase.from("users").insert({
    auth_id: authId,
    shop_id: shopId,
    name,
    email,
    role: "OWNER",
    status: "ACTIVE",
  });

  if (error) {
    return databaseFailure(
      error,
      "The login was created but could not be linked to the shop. Try again with the same email — if it reports the email as taken, the auth account already exists and only the profile row is missing.",
    );
  }

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/shops");
  revalidatePath("/dashboard/admin");

  const notes = [
    requiresConfirmation
      ? "They must confirm the email before their first sign-in."
      : "They can sign in now.",
    (existingOwners?.length ?? 0) > 0
      ? "Note: this shop already had an active owner."
      : null,
  ].filter(Boolean);

  return success(`${name} was added as owner. ${notes.join(" ")}`);
}

/**
 * Activates or deactivates any account on the platform.
 *
 * Unlike the shop-level version this can act on owners, which is the point:
 * when a shop changes hands the platform operator is who turns the old owner
 * off. The caller's own row is refused — an administrator who deactivated
 * themselves would leave nobody able to undo it.
 */
export async function setUserStatus(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const profile = await requireRole("SUPER_ADMIN");

  const supabase = await createSupabaseServerClient();

  const id = readString(form, "id");
  const status = readString(form, "status");

  if (!isUuid(id)) {
    return failure("That account could not be found.");
  }

  if (status !== "ACTIVE" && status !== "INACTIVE") {
    return failure("Unknown status.");
  }

  if (id === profile.id) {
    return failure("You cannot deactivate your own account.");
  }

  const { error } = await supabase
    .from("users")
    .update({ status })
    .eq("id", id);

  if (error) {
    // The two-assistant cap is a trigger, so reactivating into a full shop
    // arrives here as P0001 with a message already written for the user.
    return databaseFailure(error, "Could not change that account.");
  }

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/admin");

  return success(
    status === "ACTIVE" ? "Account reactivated." : "Account deactivated.",
  );
}
