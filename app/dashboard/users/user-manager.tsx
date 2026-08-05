"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input, Select } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { PasswordInput } from "@/components/ui/password-input";
import { PanelHeader } from "@/components/ui/panel";
import { createOwner, setUserStatus } from "@/lib/admin/actions";
import type { AdminUser } from "@/lib/admin/queries";
import { IDLE } from "@/lib/shop/action-result";
import { formatDate } from "@/lib/utils/format";

type ShopOption = { id: string; shop_name: string };

const ROLE_LABELS: Record<AdminUser["role"], string> = {
  SUPER_ADMIN: "Platform admin",
  OWNER: "Owner",
  ASSISTANT: "Assistant",
};

/**
 * Every account on the platform.
 *
 * Only owner accounts are created here: a new shop has nobody able to create its
 * first login, so the platform operator does it. Assistants belong to the shop
 * and are added by their owner from /dashboard/assistants.
 */
export function UserManager({
  users,
  shops,
}: {
  users: AdminUser[];
  shops: ShopOption[];
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();

    if (needle === "") {
      return users;
    }

    return users.filter((user) =>
      [user.name, user.email, user.shopName]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(needle)),
    );
  }, [users, filter]);

  const columns: Array<Column<AdminUser>> = [
    {
      header: "Name",
      cell: (row) => (
        <div>
          <span className="font-medium text-slate-950">
            {row.name ?? "Unnamed"}
          </span>
          {row.isSelf ? (
            <span className="ml-2 text-xs text-slate-500">(you)</span>
          ) : null}
          <p className="text-xs text-slate-500">{row.email ?? "—"}</p>
          {/* The Shop column is dropped on phones to leave room for Actions;
              it reappears here so a row is still attributable to a shop. */}
          <p className="text-xs text-slate-500 md:hidden">
            {row.shopName ?? "No shop"}
          </p>
        </div>
      ),
    },
    {
      header: "Role",
      cell: (row) => ROLE_LABELS[row.role],
    },
    {
      header: "Shop",
      hideOnMobile: true,
      cell: (row) => row.shopName ?? "—",
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
      header: "Added",
      hideOnMobile: true,
      cell: (row) => formatDate(row.created_at),
    },
    {
      header: "Actions",
      align: "right",
      cell: (row) =>
        row.isSelf ? (
          <span className="text-xs text-slate-400">—</span>
        ) : row.status === "ACTIVE" ? (
          <ConfirmForm
            action={setUserStatus}
            values={{ id: row.id, status: "INACTIVE" }}
            trigger="Deactivate"
            title={`Deactivate ${row.name ?? "this account"}?`}
            description="They will be refused at login. Their recorded sales stay in their shop's history."
            confirmLabel="Deactivate"
          />
        ) : (
          <ConfirmForm
            action={setUserStatus}
            values={{ id: row.id, status: "ACTIVE" }}
            trigger="Reactivate"
            title={`Reactivate ${row.name ?? "this account"}?`}
            description="They will be able to sign in again with their existing password. If this is an assistant and their shop already has two active assistants, this will be refused."
            confirmLabel="Reactivate"
          />
        ),
    },
  ];

  return (
    <>
      <PanelHeader
        title="Users"
        description="Every StockFlow account. Owners are created here; assistants are added by their own shop owner."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Search name, email, or shop"
              aria-label="Search users"
              className="w-full sm:w-64"
            />

            <Button
              onClick={() => setCreateOpen(true)}
              disabled={shops.length === 0}
            >
              New owner
            </Button>
          </div>
        }
      />

      {shops.length === 0 ? (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          There are no active shops yet. Create a shop first — an owner account
          has to belong to one.
        </p>
      ) : null}

      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(row) => row.id}
        emptyTitle={filter ? "No matches" : "No accounts yet"}
        emptyDescription={
          filter
            ? "No account matches that search."
            : "Create a shop, then add its owner account."
        }
      />

      <CreateOwnerDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        shops={shops}
      />
    </>
  );
}

function CreateOwnerDialog({
  open,
  onClose,
  shops,
}: {
  open: boolean;
  onClose: () => void;
  shops: ShopOption[];
}) {
  const [state, formAction] = useActionState(createOwner, IDLE);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New owner account"
      description="Creates the login for a shop owner. Give them the temporary password and have them change it under Settings after signing in."
    >
      <form action={formAction} className="space-y-4">
        <Field
          label="Shop"
          htmlFor="owner-shop"
          error={fieldError(state, "shop_id")}
        >
          <Select id="owner-shop" name="shop_id" defaultValue="" required>
            <option value="" disabled>
              Choose a shop
            </option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.shop_name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Full name"
          htmlFor="owner-name"
          error={fieldError(state, "name")}
        >
          <Input
            id="owner-name"
            name="name"
            placeholder="Maria Santos"
            maxLength={150}
            autoComplete="off"
            required
          />
        </Field>

        <Field
          label="Email"
          htmlFor="owner-email"
          error={fieldError(state, "email")}
          hint="This is the address they sign in with. It cannot be changed later."
        >
          <Input
            id="owner-email"
            name="email"
            type="email"
            placeholder="owner@shop.com"
            autoComplete="off"
            required
          />
        </Field>

        <Field
          label="Temporary password"
          htmlFor="owner-password"
          error={fieldError(state, "password")}
          hint="At least 8 characters."
        >
          <PasswordInput
            id="owner-password"
            name="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <SubmitButton pendingLabel="Creating...">Create owner</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
