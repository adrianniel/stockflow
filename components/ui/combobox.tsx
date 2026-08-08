"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary line — quantity on hand, brand, price. Also searched. */
  hint?: string;
};

type ComboboxProps = {
  /** Must match the enclosing Field's `htmlFor` so the label focuses the input. */
  id: string;
  options: ComboboxOption[];
  /**
   * Submitted with the form as the selected option's `value`. Omit for
   * comboboxes that live outside a form and are read through `onValueChange`.
   */
  name?: string;
  /** Pre-selected value. Read once on mount — remount with `key` to reset. */
  defaultValue?: string;
  placeholder?: string;
  /**
   * Label for a "nothing selected" entry pinned to the top of the list. Omit to
   * make the field unclearable once a choice is made.
   */
  clearLabel?: string;
  /** Text shown when the search term matches no option. */
  emptyLabel?: string;
  disabled?: boolean;
  /** Marks the control invalid for assistive tech; styling stays with Field. */
  invalid?: boolean;
  onValueChange?: (value: string) => void;
};

const CONTROL =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:cursor-not-allowed disabled:bg-slate-50";

/**
 * A select you can type into.
 *
 * Replaces native <select> wherever the list grows with the shop's data —
 * products, categories, batches, customers. Short fixed lists (payment status,
 * report filters) stay native, because searching three options is slower than
 * reading them.
 *
 * The selected value reaches the server through a hidden input carrying `name`,
 * so a form using this posts exactly what the same form posted with a <select>
 * and no server action had to change. The visible text input is deliberately
 * nameless: it holds a search term, not an answer, and must never be submitted.
 *
 * Native `required` is not available on a hidden input — browsers exclude
 * non-rendered controls from constraint validation. That check belongs to the
 * server actions, which already reject a missing product or batch by name and
 * render the message through `fieldError`; callers that want to block the click
 * as well can disable their submit button off `onValueChange`.
 */
export function Combobox({
  id,
  options,
  name,
  defaultValue = "",
  placeholder = "Search...",
  clearLabel,
  emptyLabel = "No matches",
  disabled = false,
  invalid = false,
  onValueChange,
}: ComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  /**
   * The search term while typing, or null when the box should mirror the
   * selection instead.
   *
   * Two states rather than one, because a closed combobox shows the chosen
   * label while an open one shows what is being typed. Collapsing them would
   * mean either wiping the visible selection on focus or treating the label as
   * a filter, and typing one letter would then match nothing.
   */
  const [query, setQuery] = useState<string | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const matches = useMemo(() => {
    const term = (query ?? "").trim().toLowerCase();
    const found =
      term === ""
        ? options
        : options.filter(
            (option) =>
              option.label.toLowerCase().includes(term) ||
              (option.hint ?? "").toLowerCase().includes(term),
          );

    // The clear entry is pinned rather than filtered: it is an action, not one
    // of the shop's records, and hiding it behind a search term would strand
    // anyone who wanted to undo a selection.
    return clearLabel !== undefined && term === ""
      ? [{ value: "", label: clearLabel }, ...found]
      : found;
  }, [options, query, clearLabel]);

  // Keeps the highlight in range as the list shrinks under the search term.
  const activeIndex = matches.length === 0 ? -1 : Math.min(active, matches.length - 1);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Clicking outside commits the current selection and closes, matching what
    // a native select does when focus leaves it.
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }

    // The list is capped and scrolls internally, so keyboard navigation has to
    // bring the highlighted row into view itself.
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function commit(option: ComboboxOption) {
    setValue(option.value);
    setQuery(null);
    setOpen(false);
    onValueChange?.(option.value);
    inputRef.current?.focus();
  }

  function openList() {
    if (disabled) {
      return;
    }

    setOpen(true);

    // Reopening starts the highlight on the current selection rather than at
    // the top, so arrow keys move from where the user actually is.
    const index = matches.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!open) {
        openList();
        return;
      }

      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = activeIndex + step;
      setActive(
        next < 0 ? matches.length - 1 : next >= matches.length ? 0 : next,
      );
      return;
    }

    if (event.key === "Enter") {
      // Unconditional: this control is used inside forms, where a bare Enter in
      // a text input submits. Recording a half-built sale or a batch with no
      // quantity because someone confirmed a product is the failure being
      // prevented here.
      event.preventDefault();

      if (open && activeIndex >= 0) {
        commit(matches[activeIndex]);
      } else {
        openList();
      }

      return;
    }

    if (event.key === "Escape") {
      if (open) {
        // The forms live inside a native <dialog>, where Escape fires `cancel`
        // and closes the whole modal. Dismissing the suggestion list must not
        // also discard the half-filled form behind it.
        event.stopPropagation();
        event.preventDefault();
        setOpen(false);
        setQuery(null);
      }

      return;
    }

    if (event.key === "Tab" && open) {
      setOpen(false);
      setQuery(null);
    }
  }

  const text = query ?? selected?.label ?? "";

  return (
    <div ref={rootRef} className="relative">
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        aria-invalid={invalid || undefined}
        autoComplete="off"
        disabled={disabled}
        className={cn(CONTROL, "pr-10")}
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={openList}
        onClick={openList}
        onKeyDown={onKeyDown}
      />

      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-[0_20px_50px_rgba(15,23,42,0.18)]"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500">{emptyLabel}</li>
          ) : (
            matches.map((option, index) => {
              const isActive = index === activeIndex;
              const isSelected = option.value === value;

              return (
                <li
                  key={`${option.value}-${index}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  // Pointer down rather than click: the input's blur would
                  // otherwise fire first and close the list out from under the
                  // press, which reads as a dead option on touch.
                  onPointerDown={(event) => {
                    event.preventDefault();
                    commit(option);
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "cursor-pointer px-4 py-2.5 text-sm transition",
                    isActive ? "bg-slate-100" : "bg-white",
                    isSelected ? "font-medium text-slate-950" : "text-slate-700",
                  )}
                >
                  <span className="block">{option.label}</span>
                  {option.hint ? (
                    <span className="block text-xs text-slate-500">
                      {option.hint}
                    </span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
