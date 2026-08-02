"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Footer buttons, right-aligned. */
  footer?: ReactNode;
};

/**
 * Dialog used for create/edit forms and confirmations.
 *
 * Uses the native <dialog> element so the browser supplies the top layer, the
 * backdrop, and Escape-to-close, and so focus is trapped inside without a
 * hand-rolled implementation. `showModal()` is called from an effect rather
 * than during render because it is a DOM side effect.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      // `cancel` fires on Escape; closing is owned by the parent's state, so
      // prevent the browser's default close and report the intent upward.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      // Clicks land on the backdrop only when the target is the dialog itself;
      // anything inside the content div stops short of here.
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onClose();
        }
      }}
      // The height cap plus inner scroll is what makes this usable on a phone:
      // a form taller than the screen scrolls inside the dialog instead of
      // running off the bottom with its footer buttons out of reach.
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-0 text-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.25)] backdrop:bg-slate-950/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-6">
        <div className="mb-5">
          <h2
            id="modal-title"
            className="text-lg font-semibold tracking-tight text-slate-950"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>

        <div className="space-y-4">{children}</div>

        {footer ? (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  );
}
