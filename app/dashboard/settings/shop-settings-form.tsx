"use client";

import { useActionState } from "react";

import { Field, Input } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { IDLE } from "@/lib/shop/action-result";
import { updateShopSettings } from "@/lib/shop/actions";

type ShopSettingsFormProps = {
  shopName: string;
  ownerName: string | null;
  defaultInterest: number;
};

export function ShopSettingsForm({
  shopName,
  ownerName,
  defaultInterest,
}: ShopSettingsFormProps) {
  const [state, formAction] = useActionState(updateShopSettings, IDLE);

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field
        label="Shop name"
        htmlFor="shop-name"
        error={fieldError(state, "shop_name")}
      >
        <Input
          id="shop-name"
          name="shop_name"
          defaultValue={shopName}
          maxLength={150}
          required
        />
      </Field>

      <Field label="Owner name" htmlFor="owner-name" hint="Optional.">
        <Input
          id="owner-name"
          name="owner_name"
          defaultValue={ownerName ?? ""}
          maxLength={150}
        />
      </Field>

      <Field
        label="Default interest %"
        htmlFor="default-interest"
        error={fieldError(state, "default_interest_percentage")}
        hint="Your usual markup. 30 means a ₱800 part is priced at ₱1,040."
      >
        <Input
          id="default-interest"
          name="default_interest_percentage"
          type="number"
          min={0}
          max={1000}
          step="0.01"
          inputMode="decimal"
          defaultValue={defaultInterest}
          required
        />
      </Field>

      <FormAlert state={state} />

      <div className="flex justify-end pt-2">
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </form>
  );
}
