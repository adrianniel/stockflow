/**
 * The contract between server actions and the forms that call them.
 *
 * Every action in lib/shop/actions returns an `ActionState`, and every form
 * drives it with React's `useActionState`. Keeping one shape means the forms
 * share their error rendering instead of each inventing a response format.
 *
 * Failures are returned, not thrown. A thrown error in a server action reaches
 * the client as a generic "an error occurred" with the real message stripped in
 * production, which is right for a crash but useless for "that category name is
 * already taken". Anything the user can fix comes back as `error`.
 */

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | {
      status: "error";
      message: string;
      /** Keyed by form field name, for messages rendered next to the input. */
      fieldErrors?: Record<string, string>;
    };

export const IDLE: ActionState = { status: "idle" };

export function success(message: string): ActionState {
  return { status: "success", message };
}

export function failure(
  message: string,
  fieldErrors?: Record<string, string>,
): ActionState {
  return { status: "error", message, fieldErrors };
}

/**
 * Maps a Postgres error onto a message worth showing.
 *
 * Constraint names are matched rather than message text because the text varies
 * between Postgres versions while the names are ours. Anything unrecognised
 * falls back to the caller's wording: raw database errors can name columns and
 * constraints, which is detail the end user cannot act on.
 */
export function databaseFailure(
  error: { code?: string; message?: string } | null,
  fallback: string,
): ActionState {
  if (!error) {
    return failure(fallback);
  }

  // 23505 unique_violation — the only constraint a user routinely trips.
  if (error.code === "23505") {
    return failure("That name is already used in your shop.");
  }

  // 23503 foreign_key_violation — deleting something still referenced.
  if (error.code === "23503") {
    return failure(
      "This record is still referenced by other data and cannot be removed.",
    );
  }

  // 42501 insufficient_privilege, and the empty result RLS returns on a blocked
  // write, both mean the same thing to the user: not yours to change.
  if (error.code === "42501") {
    return failure("You do not have permission to make this change.");
  }

  // RAISE EXCEPTION from record_sale() and friends arrives as P0001. Those
  // messages are written for the user ("Not enough stock for product ..."), so
  // they pass through.
  if (error.code === "P0001" && error.message) {
    return failure(error.message);
  }

  return failure(fallback);
}
