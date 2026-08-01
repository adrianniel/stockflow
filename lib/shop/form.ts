/**
 * Reading and validating `FormData` in server actions.
 *
 * Server actions receive whatever the client sends — the form is a hint, not a
 * guarantee, since anyone can POST to the action endpoint directly. So every
 * field is parsed and bounded here rather than passed to the database as-is,
 * and each helper returns either a value or a message suitable for the user.
 *
 * Numbers get particular care: `Number("")` is 0 and `Number("abc")` is NaN,
 * and both would otherwise reach a `numeric` column as a plausible-looking
 * zero or a crash. `requiredNumber` rejects both.
 */

export type FieldErrors = Record<string, string>;

export class FormErrors {
  private readonly errors: FieldErrors = {};

  add(field: string, message: string) {
    // First message per field wins: it names the more specific problem
    // ("required") rather than the cascade behind it ("must be a number").
    if (!this.errors[field]) {
      this.errors[field] = message;
    }
  }

  get hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  get all(): FieldErrors {
    return this.errors;
  }
}

/** Trimmed string value, or "" when absent. Never returns undefined. */
export function readString(form: FormData, field: string): string {
  const value = form.get(field);

  return typeof value === "string" ? value.trim() : "";
}

/** Trimmed string, or null when blank — for nullable text columns. */
export function readOptionalString(
  form: FormData,
  field: string,
): string | null {
  const value = readString(form, field);

  return value === "" ? null : value;
}

/**
 * A uuid, or null when blank.
 *
 * Shape-checked before it reaches the query: an invalid uuid makes Postgres
 * raise 22P02, which surfaces as a 500 rather than as a field error.
 */
export function readOptionalUuid(form: FormData, field: string): string | null {
  const value = readString(form, field);

  if (value === "") {
    return null;
  }

  return UUID_PATTERN.test(value) ? value : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

type TextOptions = {
  label: string;
  max?: number;
};

/** Required text with a length bound, so a huge paste cannot reach the column. */
export function requiredText(
  form: FormData,
  field: string,
  errors: FormErrors,
  { label, max = 200 }: TextOptions,
): string {
  const value = readString(form, field);

  if (value === "") {
    errors.add(field, `${label} is required.`);
    return "";
  }

  if (value.length > max) {
    errors.add(field, `${label} must be ${max} characters or fewer.`);
    return value.slice(0, max);
  }

  return value;
}

type NumberOptions = {
  label: string;
  min?: number;
  max?: number;
  /** Rejects non-integers — quantities are whole units. */
  integer?: boolean;
};

export function requiredNumber(
  form: FormData,
  field: string,
  errors: FormErrors,
  { label, min = 0, max = 1_000_000_000, integer = false }: NumberOptions,
): number {
  const raw = readString(form, field);

  if (raw === "") {
    errors.add(field, `${label} is required.`);
    return 0;
  }

  const value = Number(raw);

  if (!Number.isFinite(value)) {
    errors.add(field, `${label} must be a number.`);
    return 0;
  }

  if (integer && !Number.isInteger(value)) {
    errors.add(field, `${label} must be a whole number.`);
    return 0;
  }

  if (value < min) {
    errors.add(field, `${label} cannot be less than ${min}.`);
    return 0;
  }

  if (value > max) {
    errors.add(field, `${label} is too large.`);
    return 0;
  }

  return value;
}

/**
 * Rounds money to 2 decimals before storage.
 *
 * A price typed as 1040.005 would otherwise be stored at full precision and
 * then displayed rounded, so the stored total and the shown total disagree.
 */
export function money(value: number): number {
  return Math.round(value * 100) / 100;
}
