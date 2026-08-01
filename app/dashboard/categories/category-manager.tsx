"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { PanelHeader } from "@/components/ui/panel";
import { IDLE } from "@/lib/shop/action-result";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/shop/actions";
import type { Category } from "@/lib/shop/types";
import { formatDate } from "@/lib/utils/format";

type CategoryRow = Category & { productCount: number };

/**
 * Categories list with create/edit/delete.
 *
 * Client component because the create and edit dialogs need open/closed state.
 * The rows themselves are fetched on the server and passed in, so the initial
 * render still carries data and the table is not a loading shell.
 */
export function CategoryManager({ categories }: { categories: CategoryRow[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);

  const columns: Array<Column<CategoryRow>> = [
    {
      header: "Category",
      cell: (row) => (
        <span className="font-medium text-slate-950">{row.name}</span>
      ),
    },
    {
      header: "Products",
      align: "right",
      cell: (row) => row.productCount,
    },
    {
      header: "Created",
      hideOnMobile: true,
      cell: (row) => formatDate(row.created_at),
    },
    {
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
            Edit
          </Button>

          <ConfirmForm
            action={deleteCategory}
            values={{ id: row.id }}
            trigger="Delete"
            title={`Delete "${row.name}"?`}
            description={
              row.productCount > 0
                ? `${row.productCount} product(s) use this category. They will stay in your catalogue but become uncategorised.`
                : "This category is not used by any product."
            }
            confirmLabel="Delete category"
          />
        </div>
      ),
    },
  ];

  return (
    <>
      <PanelHeader
        title="Categories"
        description="Group your products so they are easier to find when recording a sale."
        actions={
          <Button onClick={() => setCreateOpen(true)}>New category</Button>
        }
      />

      <DataTable
        rows={categories}
        columns={columns}
        rowKey={(row) => row.id}
        emptyTitle="No categories yet"
        emptyDescription="Create your first category — for example Brake Parts, Filters, or Engine Oil."
        emptyAction={
          <Button onClick={() => setCreateOpen(true)}>New category</Button>
        }
      />

      <CategoryDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New category"
        description="Categories are shared across your shop's products."
      />

      <CategoryDialog
        key={editing?.id ?? "edit-closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Rename category"
        description="Products already in this category keep their link."
        category={editing}
      />
    </>
  );
}

type CategoryDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Present for edit, absent for create. */
  category?: CategoryRow | null;
};

/**
 * One dialog for both create and edit.
 *
 * The parent remounts it via `key` whenever it opens, which resets both the
 * action state and the uncontrolled input — otherwise a previous error message
 * would still be showing the next time the dialog was opened.
 */
function CategoryDialog({
  open,
  onClose,
  title,
  description,
  category,
}: CategoryDialogProps) {
  const isEdit = Boolean(category);
  const [state, formAction] = useActionState(
    isEdit ? updateCategory : createCategory,
    IDLE,
  );

  // Closing on success is an effect rather than part of the submit handler
  // because the result only exists after the action resolves.
  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <form action={formAction} className="space-y-4">
        {category ? (
          <input type="hidden" name="id" value={category.id} />
        ) : null}

        <Field
          label="Category name"
          htmlFor="category-name"
          error={fieldError(state, "name")}
        >
          <Input
            id="category-name"
            name="name"
            defaultValue={category?.name ?? ""}
            placeholder="Brake Parts"
            maxLength={100}
            autoFocus
            required
          />
        </Field>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <SubmitButton>{isEdit ? "Save changes" : "Create category"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
