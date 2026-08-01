"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormAlert, SubmitButton, fieldError } from "@/components/ui/form-status";
import { Modal } from "@/components/ui/modal";
import { PanelHeader } from "@/components/ui/panel";
import { IDLE } from "@/lib/shop/action-result";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/lib/shop/actions";
import type { Category, ProductWithCategory } from "@/lib/shop/types";
import { formatNumber } from "@/lib/utils/format";

type ProductRow = ProductWithCategory & {
  quantityOnHand: number;
};

type ProductManagerProps = {
  products: ProductRow[];
  categories: Category[];
  /** Assistants can view the catalogue but not change it (SRS 5.3). */
  canManage: boolean;
};

/**
 * Product catalogue with search, and create/edit/delete for owners.
 *
 * Filtering happens in the browser over the full list rather than through a
 * round trip. A single shop's catalogue is small enough that this is instant,
 * and it keeps the search responsive while typing. If a shop ever outgrows
 * that, this becomes a server-side query with a `search` param.
 */
export function ProductManager({
  products,
  categories,
  canManage,
}: ProductManagerProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      if (categoryFilter && product.category_id !== categoryFilter) {
        return false;
      }

      if (term === "") {
        return true;
      }

      // Brand is searched too: staff often know the brand before the exact
      // product name.
      return (
        product.product_name.toLowerCase().includes(term) ||
        (product.brand ?? "").toLowerCase().includes(term)
      );
    });
  }, [products, search, categoryFilter]);

  const columns: Array<Column<ProductRow>> = [
    {
      header: "Product",
      cell: (row) => (
        <div>
          <Link
            href={`/dashboard/inventory/${row.id}`}
            className="font-medium text-slate-950 underline-offset-4 hover:underline"
          >
            {row.product_name}
          </Link>
          {row.brand ? (
            <p className="text-xs text-slate-500">{row.brand}</p>
          ) : null}
        </div>
      ),
    },
    {
      header: "Category",
      hideOnMobile: true,
      cell: (row) => row.category_name ?? "—",
    },
    {
      header: "On hand",
      align: "right",
      cell: (row) => (
        <span
          className={
            row.quantityOnHand === 0 ? "text-rose-600" : "text-slate-700"
          }
        >
          {formatNumber(row.quantityOnHand)}
        </span>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>
            Edit
          </Button>

          <ConfirmForm
            action={deleteProduct}
            values={{ id: row.id }}
            trigger="Delete"
            title={`Delete "${row.product_name}"?`}
            description={
              row.quantityOnHand > 0
                ? `This product still has ${row.quantityOnHand} unit(s) in stock. Deleting it removes all of its stock batches. Past sales stay recorded but lose their link to those batches.`
                : "This removes the product and all of its stock batches. Past sales stay recorded."
            }
            confirmLabel="Delete product"
          />
        </div>
      ),
    });
  }

  return (
    <>
      <PanelHeader
        title="Products"
        description={
          canManage
            ? "Your catalogue. Prices are not set here — they belong to each stock batch, because they change between arrivals."
            : "Your shop's catalogue. Ask the owner to add a product that is missing."
        }
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>New product</Button>
          ) : null
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <Input
            id="product-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product name or brand"
          />
        </div>

        <div className="sm:w-56">
          <label htmlFor="product-category-filter" className="sr-only">
            Filter by category
          </label>
          <Select
            id="product-category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(row) => row.id}
        emptyTitle={
          products.length === 0 ? "No products yet" : "No matching products"
        }
        emptyDescription={
          products.length === 0
            ? "Add your first product, then record a stock arrival to give it a price and quantity."
            : "Try a different search term or category."
        }
        emptyAction={
          canManage && products.length === 0 ? (
            <Button onClick={() => setCreateOpen(true)}>New product</Button>
          ) : null
        }
      />

      {canManage ? (
        <>
          <ProductDialog
            key={createOpen ? "create-open" : "create-closed"}
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            categories={categories}
            title="New product"
            description="Add the item itself. Quantity and pricing come from stock arrivals."
          />

          <ProductDialog
            key={editing?.id ?? "edit-closed"}
            open={editing !== null}
            onClose={() => setEditing(null)}
            categories={categories}
            title="Edit product"
            description="Changing these details does not affect existing stock batches or past sales."
            product={editing}
          />
        </>
      ) : null}
    </>
  );
}

type ProductDialogProps = {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  title: string;
  description: string;
  product?: ProductRow | null;
};

function ProductDialog({
  open,
  onClose,
  categories,
  title,
  description,
  product,
}: ProductDialogProps) {
  const isEdit = Boolean(product);
  const [state, formAction] = useActionState(
    isEdit ? updateProduct : createProduct,
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
        {product ? <input type="hidden" name="id" value={product.id} /> : null}

        <Field
          label="Product name"
          htmlFor="product-name"
          error={fieldError(state, "product_name")}
        >
          <Input
            id="product-name"
            name="product_name"
            defaultValue={product?.product_name ?? ""}
            placeholder="Brake Pad Toyota Vios"
            maxLength={200}
            autoFocus
            required
          />
        </Field>

        <Field label="Brand" htmlFor="product-brand" hint="Optional.">
          <Input
            id="product-brand"
            name="brand"
            defaultValue={product?.brand ?? ""}
            placeholder="Aisin"
            maxLength={200}
          />
        </Field>

        <Field
          label="Category"
          htmlFor="product-category"
          hint={
            categories.length === 0
              ? "No categories yet — you can add one later."
              : "Optional."
          }
        >
          <Select
            id="product-category"
            name="category_id"
            defaultValue={product?.category_id ?? ""}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Description"
          htmlFor="product-description"
          hint="Optional. Fitment notes, part numbers, anything worth remembering."
        >
          <Textarea
            id="product-description"
            name="description"
            defaultValue={product?.description ?? ""}
            maxLength={1000}
          />
        </Field>

        <FormAlert state={state} />

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>

          <SubmitButton>{isEdit ? "Save changes" : "Create product"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
