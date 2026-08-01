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
import { IDLE } from "@/lib/shop/action-result";
import {
  createAssistant,
  renameShopMember,
  setMemberStatus,
} from "@/lib/shop/team-actions";
import type { ShopMember } from "@/lib/shop/types";
import { formatDate } from "@/lib/utils/format";

/** SRS 5.3. Mirrored by the enforce_assistant_limit trigger, which is binding. */
const MAX_ASSISTANTS = 2;

/**
 * The shop's team: the owner plus up to two assistants.
 *
 * Client component for the dialogs. Rows come from the server, and every action
 * revalidates, so the list reflects the database rather than local edits.
 */
export function AssistantManager({ members }: { members: ShopMember[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ShopMember | null>(null);

  const activeAssistants = members.filter(
    (member) => member.role === "ASSISTANT" && member.status === "ACTIVE",
  ).length;

  const slotsFull = activeAssistants >= MAX_ASSISTANTS;

  const columns: Array<Column<ShopMember>> = [
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
        </div>
      ),
    },
    {
      header: "Role",
      cell: (row) => (row.role === "OWNER" ? "Owner" : "Assistant"),
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
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
            Rename
          </Button>

          {/* Owners are managed by the platform admin, and an owner switching
              off their own account would lock the shop out of its own team. */}
          {row.role === "ASSISTANT" && !row.isSelf ? (
            row.status === "ACTIVE" ? (
              <ConfirmForm
                action={setMemberStatus}
                values={{ id: row.id, status: "INACTIVE" }}
                trigger="Deactivate"
                title={`Deactivate ${row.name ?? "this assistant"}?`}
                description="They will not be able to sign in. Their recorded sales stay in your history, and the assistant slot is freed for someone else."
                confirmLabel="Deactivate"
              />
            ) : (
              <ConfirmForm
                action={setMemberStatus}
                values={{ id: row.id, status: "ACTIVE" }}
                trigger="Reactivate"
                title={`Reactivate ${row.name ?? "this assistant"}?`}
                description={
                  slotsFull
                    ? `You already have ${MAX_ASSISTANTS} active assistants. Deactivate one first, or this will be refused.`
                    : "They will be able to sign in again with their existing password."
                }
                confirmLabel="Reactivate"
              />
            )
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <PanelHeader
        title="Your team"
        description={`Assistants can record sales and receive stock. A shop can have up to ${MAX_ASSISTANTS} active assistants at a time — ${activeAssistants} of ${MAX_ASSISTANTS} in use.`}
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={slotsFull}>
            New assistant
          </Button>
        }
      />

      {slotsFull ? (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Both assistant slots are in use. Deactivate one to free a slot before
          adding someone new.
        </p>
      ) : null}

      <DataTable
        rows={members}
        columns={columns}
        rowKey={(row) => row.id}
        emptyTitle="No team members yet"
        emptyDescription="Add an assistant so someone else can record sales for your shop."
      />

      <CreateAssistantDialog
        key={createOpen ? "create-open" : "create-closed"}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <RenameDialog
        key={editing?.id ?? "rename-closed"}
        open={editing !== null}
        onClose={() => setEditing(null)}
        member={editing}
      />
    </>
  );
}

/**
 * Creates the login and the profile row in one submit.
 *
 * The owner sets the first password rather than sending an invite, because an
 * invite flow needs the admin API. The dialog says to hand it over and have it
 * changed, which is the honest instruction given that constraint.
 */
function CreateAssistantDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(createAssistant, IDLE);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New assistant"
      description="Creates a login for your shop. Give them the temporary password and have them change it under Settings after their first sign-in."
    >
      <form action={formAction} className="space-y-4">
        <Field
          label="Full name"
          htmlFor="assistant-name"
          error={fieldError(state, "name")}
        >
          <Input
            id="assistant-name"
            name="name"
            placeholder="Juan dela Cruz"
            maxLength={150}
            autoComplete="off"
            autoFocus
            required
          />
        </Field>

        <Field
          label="Email"
          htmlFor="assistant-email"
          error={fieldError(state, "email")}
          hint="This is the address they sign in with. It cannot be changed later."
        >
          <Input
            id="assistant-email"
            name="email"
            type="email"
            placeholder="assistant@shop.com"
            autoComplete="off"
            required
          />
        </Field>

        <Field
          label="Temporary password"
          htmlFor="assistant-password"
          error={fieldError(state, "password")}
          hint="At least 8 characters."
        >
          <Input
            id="assistant-password"
            name="password"
            type="password"
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

          <SubmitButton pendingLabel="Creating...">Create assistant</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function RenameDialog({
  open,
  onClose,
  member,
}: {
  open: boolean;
  onClose: () => void;
  member: ShopMember | null;
}) {
  const [state, formAction] = useActionState(renameShopMember, IDLE);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rename team member"
      description="Changes the display name only. The sign-in email stays the same."
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={member?.id ?? ""} />

        <Field
          label="Full name"
          htmlFor="member-name"
          error={fieldError(state, "name")}
        >
          <Input
            id="member-name"
            name="name"
            defaultValue={member?.name ?? ""}
            maxLength={150}
            autoFocus
            required
          />
        </Field>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <SubmitButton>Save changes</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
