/**
 * Turning unknown throwables into something showable.
 *
 * `catch (error)` is typed `unknown`, and the values that actually arrive here
 * are a mix: `Error` from the runtime, `AuthError`/`PostgrestError` from
 * supabase-js (Error subclasses carrying a `message`), and occasionally a plain
 * string. Narrowing in one place keeps `any` out of every catch block and
 * guarantees the UI always has a string to render.
 *
 * The fallback matters for security as much as for tidiness: an unrecognised
 * value is replaced rather than stringified, so an object that happens to hold
 * internal detail is never printed into the page.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }

  return fallback;
}
