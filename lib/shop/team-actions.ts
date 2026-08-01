"use server";

import { revalidatePath } from "next/cache";

import {
  databaseFailure,
  failure,
  success,
  type ActionState,
} from "./action-result";
import { getShopContext, NoShopError } from "./context";
import { FormErrors, isUuid, readString, requiredText } from "./form";
import {
  AccountExistsError,
  AccountCreationError,
  createAuthAccount,
} from "./provisioning";

/**
 * Assistant account management (SRS 5.2, 6.2).
 *
 * Kept apart from lib/shop/actions.ts because these writes touch identity
 * rather than inventory: they create Supabase auth accounts, and the rules that
 * govern them (the two-assistant cap, deactivation instead of deletion) live in
 * migration 20260801120700 rather than in the shop schema.
 *
 * Three layers have to agree for any of this to be safe, and all three are
 * deliberate:
 *
 *   1. getShopContext("OWNER") — refuses anyone who is not an owner, with a
 *      readable message.
 *   2. RLS — the INSERT policy on `users` forces role = 'ASSISTANT' and the
 *      owner's own shop_id, so even a bug here cannot mint a SUPER_ADMIN or
 *      write into another shop.
 *   3. The enforce_assistant_limit trigger — caps active assistants at 2 under a
 *      row lock, so two simultaneous submissions cannot both slip through.
 */

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function withShop(run: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof NoShopError) {
      return failure(error.message);
    }

    throw error;
  }
}

/**
 * Creates an assistant login and its profile row.
 *
 * Two writes that cannot be one transaction: the auth account is created
 * through the Supabase auth API, the profile through Postgres. If the profile
 * insert fails the auth account is left orphaned — it can sign in but has no
 * `users` row, and requireSession() bounces it straight back to /login, so it
 * grants no access. That is recoverable (the owner retries with the same email,
 * which is then reported as already taken) and the alternative — deleting the
 * orphan — needs the admin API and the service_role key this project refuses to
 * hold. The message says as much so the owner is not left guessing.
 */
export async function createAssistant(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const name = requiredText(form, "name", errors, {
      label: "Full name",
      max: 150,
    });

    const email = readString(form, "email").toLowerCase();
    const password = readString(form, "password");

    if (email === "") {
      errors.add("email", "Email is required.");
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.add("email", "Enter a valid email address.");
    }

    if (password === "") {
      errors.add("password", "A temporary password is required.");
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.add(
        "password",
        `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted fields.", errors.all);
    }

    // Checked before the account is created so the common mistake — reusing an
    // address already on the team — fails without leaving an orphaned login.
    // Not a substitute for the unique constraint on auth.users, which is what
    // actually prevents duplicates; this only improves the message.
    const { data: existing, error: existingError } = await supabase
      .from("users")
      .select("id")
      .eq("shop_id", shopId)
      .eq("email", email)
      .maybeSingle();

    if (existingError) {
      return databaseFailure(existingError, "Could not check your team list.");
    }

    if (existing) {
      return failure("Someone on your team already uses that email.", {
        email: "This email is already on your team.",
      });
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
      role: "ASSISTANT",
      status: "ACTIVE",
    });

    if (error) {
      return databaseFailure(
        error,
        "The login was created but could not be added to your team. Try again with the same email — if it says the email is taken, ask support to finish linking the account.",
      );
    }

    revalidatePath("/dashboard/assistants");

    return success(
      requiresConfirmation
        ? `${name} was added. They must confirm the email before their first sign-in.`
        : `${name} was added and can sign in now.`,
    );
  });
}

/**
 * Renames a member of the shop.
 *
 * Names only. Changing an email means changing sign-in credentials in
 * auth.users, which needs the admin API; the owner deactivates the account and
 * creates a new one instead.
 */
export async function renameShopMember(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId } = await getShopContext("OWNER");
    const errors = new FormErrors();

    const id = readString(form, "id");
    const name = requiredText(form, "name", errors, {
      label: "Full name",
      max: 150,
    });

    if (!isUuid(id)) {
      return failure("That team member could not be found.");
    }

    if (errors.hasErrors) {
      return failure("Check the highlighted field.", errors.all);
    }

    const { error } = await supabase
      .from("users")
      .update({ name })
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      return databaseFailure(error, "Could not save that name.");
    }

    revalidatePath("/dashboard/assistants");

    return success("Name updated.");
  });
}

/**
 * Activates or deactivates an assistant.
 *
 * Deactivation is how a shop frees one of its two slots: the row and its sales
 * history stay, the login stops working at the route guards. Reactivation goes
 * through the same trigger as a create, so it fails if both slots are taken.
 *
 * The owner's own row is refused here as well as being hidden in the UI —
 * an owner who deactivated themselves would be locked out of the shop with
 * nobody left holding the permission to undo it.
 */
export async function setMemberStatus(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withShop(async () => {
    const { supabase, shopId, userId } = await getShopContext("OWNER");

    const id = readString(form, "id");
    const status = readString(form, "status");

    if (!isUuid(id)) {
      return failure("That team member could not be found.");
    }

    if (status !== "ACTIVE" && status !== "INACTIVE") {
      return failure("Unknown status.");
    }

    if (id === userId) {
      return failure("You cannot deactivate your own account.");
    }

    const { data: target, error: targetError } = await supabase
      .from("users")
      .select("id, name, role")
      .eq("id", id)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (targetError) {
      return databaseFailure(targetError, "Could not load that team member.");
    }

    if (!target) {
      return failure("That team member could not be found.");
    }

    // Owners are not assistants and are not the shop's to switch off; only the
    // platform admin manages owner accounts (SRS 5.1).
    if (target.role !== "ASSISTANT") {
      return failure("Only assistant accounts can be activated or deactivated.");
    }

    const { error } = await supabase
      .from("users")
      .update({ status })
      .eq("id", id)
      .eq("shop_id", shopId);

    if (error) {
      // The assistant cap is a trigger, so exceeding it arrives as P0001 with a
      // message already written for the user.
      return databaseFailure(error, "Could not change that account.");
    }

    revalidatePath("/dashboard/assistants");

    return success(
      status === "ACTIVE"
        ? `${target.name ?? "That assistant"} can sign in again.`
        : `${target.name ?? "That assistant"} can no longer sign in.`,
    );
  });
}
