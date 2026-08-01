"use client";

import { useActionState, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { PanelHeader } from "@/components/ui/panel";
import { createShop, setShopStatus, updateShop } from "@/lib/admin/actions";
import type { AdminShop } from "@/lib/admin/queries";
import { IDLE } from "@/lib/shop/action-result";
import { formatDate, formatPercent } from "@/lib/utils/format";

/**
 * Shop registry for the platform administrator.
 *
 * Shows headcount and default markup, not sales or stock — the super admin has
 * no access to business data (SRS 5.1), so there is nothing else to show and
 * nothing here tries to.
 */
export function ShopManager({ shops }: { shops: AdminShop[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminShop | null>(null);

  const columns: Array<Column<AdminShop>> = [
    {
      header: "Shop",
      cell: (row) => (
        <div>
          <span className="font-medium text-slate-950">{row.shop_name}</span>
          <p className="text-xs text-slate-500">{row.owner_name ?? "No owner name"}</p>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (row) => (
        <Badge tone={row.status === "ACTIVE" ? "positive" : "danger"}>
          {row.status === "ACTIVE" ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Team",
      align: "right",
      cell: (row) =>
        row.ownerCount === 0 ? (
          <span className="text-amber-700">No owner yet</span>
        ) : (
          `${row.ownerCount} owner, ${row.assistantCount} assistant${
            row.assistantCount === 1 ? "" : "s"
          }`
        ),
    },
    {
      header: "Default markup",
      align: "right",
      hideOnMobile: true,
      cell: (row) => formatPercent(row.default_interest_percentage),
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

          {row.status === "ACTIVE" ? (
            <ConfirmForm
              action={setShopStatus}
              values={{ id: row.id, status: "INACTIVE" }}
              trigger="Deactivate"
              title={`Deactivate ${row.shop_name}?`}
              description="Everyone who works at this shop will be signed out and refused at login. No data is deleted, and reactivating restores access immediately."
              confirmLabel="Deactivate shop"
            />
          ) : (
            <ConfirmForm
              action={setShopStatus}
              values={{ id: row.id, status: "ACTIVE" }}
              trigger="Reactivate"
              title={`Reactivate ${row.shop_name}?`}
              description="Its team will be able to sign in again with their existing accounts."
              confirmLabel="Reactivate shop"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PanelHeader
        title="Shops"
        description="Every business using StockFlow. Create a shop here, then add its owner account from Users."
        actions={<Button onClick={() => setCreateOpen(true)}>New shop</Button>}
      />

      <DataTable
        rows={shops}
        columns={columns}
        rowKey={(row) => row.id}
        emptyTitle="No shops yet"
        emptyDescription="Create the first shop, then give it an owner account."
        emptyAction={<Button onClick={() => setCreateOpen(true)}>New shop</Button>}
      />

      <ShopDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New shop"
        description="The owner account is created separately, from the Users page."
      />

      <ShopDialog
        key={editing?.id ?? "edit-closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit shop"
        description="Changing the default markup does not reprice existing stock batches."
        shop={editing}
      />
    </>
  );
}

type ShopDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Present for edit, absent for create. */
  shop?: AdminShop | null;
};

function ShopDialog({
  open,
  onClose,
  title,
  description,
  shop,
}: ShopDialogProps) {
  const isEdit = Boolean(shop);
  const [state, formAction] = useActionState(
    isEdit ? updateShop : createShop,
    IDLE,
  );

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <form action={formAction} className="space-y-4">
        {shop ? <input type="hidden" name="id" value={shop.id} /> : null}

        <Field
          label="Shop name"
          htmlFor="shop-name"
          error={fieldError(state, "shop_name")}
        >
          <Input
            id="shop-name"
            name="shop_name"
            defaultValue={shop?.shop_name ?? ""}
            placeholder="Dela Cruz Auto Parts"
            maxLength={150}
            autoFocus
            required
          />
        </Field>

        <Field
          label="Owner name"
          htmlFor="shop-owner-name"
          error={fieldError(state, "owner_name")}
          hint="For your records. Does not create a login."
        >
          <Input
            id="shop-owner-name"
            name="owner_name"
            defaultValue={shop?.owner_name ?? ""}
            maxLength={150}
          />
        </Field>

        <Field
          label="Default markup (%)"
          htmlFor="shop-interest"
          error={fieldError(state, "default_interest_percentage")}
          hint="Pre-fills the selling price when the shop receives new stock."
        >
          <Input
            id="shop-interest"
            name="default_interest_percentage"
            type="number"
            min={0}
            max={1000}
            step="0.01"
            defaultValue={shop?.default_interest_percentage ?? "30"}
            required
          />
        </Field>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <SubmitButton>{isEdit ? "Save changes" : "Create shop"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
