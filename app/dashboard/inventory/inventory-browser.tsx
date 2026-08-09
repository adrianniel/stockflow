"use client";

import { useMemo, useState } from "react";

import { ButtonLink } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { DataTable, type Column } from "@/components/ui/data-table";
import { inventoryStockStatus } from "@/lib/shop/inventory-status";
import type { InventoryLine } from "@/lib/shop/types";
import { formatCurrency } from "@/lib/utils/format";

type SortOrder = "name-asc" | "name-desc" | "stock-desc" | "stock-asc";
type StockFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";

type InventoryBrowserProps = {
  inventory: InventoryLine[];
  categories: string[];
};

export function InventoryBrowser({ inventory, categories }: InventoryBrowserProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("name-asc");

  const categoryOptions = useMemo<ComboboxOption[]>(
    () => categories.map((name) => ({ value: name, label: name })),
    [categories],
  );

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = inventory.filter((line) => {
      const matchesSearch =
        term === "" ||
        line.productName.toLowerCase().includes(term) ||
        (line.categoryName ?? "").toLowerCase().includes(term) ||
        line.batches.some((batch) => batch.batchNumber.toLowerCase().includes(term));
      const matchesCategory = category === "" || line.categoryName === category;
      const matchesStock =
        stockFilter === "all" || inventoryStockStatus(line.quantityOnHand) === stockFilter;

      return matchesSearch && matchesCategory && matchesStock;
    });

    return rows.sort((left, right) => {
      if (sortOrder === "stock-desc") {
        return right.quantityOnHand - left.quantityOnHand;
      }

      if (sortOrder === "stock-asc") {
        return left.quantityOnHand - right.quantityOnHand;
      }

      const comparison = left.productName.localeCompare(right.productName);
      return sortOrder === "name-desc" ? -comparison : comparison;
    });
  }, [category, inventory, search, sortOrder, stockFilter]);

  const columns: Array<Column<InventoryLine>> = [
    {
      header: "Product",
      cell: (line) => (
        <div>
          <ButtonLink
            href={`/dashboard/inventory/${line.productId}`}
            variant="ghost"
            className="px-0 font-medium text-slate-950 underline-offset-4 hover:underline"
          >
            {line.productName}
          </ButtonLink>
          {line.brand ? <p className="text-xs text-slate-500">{line.brand}</p> : null}
        </div>
      ),
    },
    {
      header: "Category",
      hideOnMobile: true,
      cell: (line) => line.categoryName ?? "—",
    },
    {
      header: "Batches",
      align: "right",
      hideOnMobile: true,
      cell: (line) => line.batchCount,
    },
    {
      header: "On hand",
      align: "right",
      cell: (line) => <StockLevel quantity={line.quantityOnHand} />,
    },
    {
      header: "Selling price",
      align: "right",
      hideOnMobile: true,
      cell: (line) =>
        line.currentSellingPrice === null ? "—" : formatCurrency(line.currentSellingPrice),
    },
    {
      header: "Stock value",
      align: "right",
      cell: (line) => formatCurrency(line.stockValue),
    },
  ];

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.45fr)]">
        <label className="block text-sm font-medium text-slate-700">
          Search inventory
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Product, category, or batch reference"
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
          />
        </label>

        <div className="text-sm font-medium text-slate-700">
          Category
          <div className="mt-1.5">
            <Combobox
              id="inventory-category"
              options={categoryOptions}
              defaultValue={category}
              clearLabel="All categories"
              placeholder="Search categories..."
              onValueChange={setCategory}
            />
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Stock status
          <select
            value={stockFilter}
            onChange={(event) => setStockFilter(event.target.value as StockFilter)}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 shadow-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
          >
            <option value="all">All</option>
            <option value="in-stock">In stock</option>
            <option value="low-stock">Low stock (1–5)</option>
            <option value="out-of-stock">Out of stock</option>
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Sort by
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-950 shadow-sm outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10"
          >
            <option value="name-asc">Product name A–Z</option>
            <option value="name-desc">Product name Z–A</option>
            <option value="stock-desc">Highest stock quantity</option>
            <option value="stock-asc">Lowest stock quantity</option>
          </select>
        </label>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        Showing {filteredInventory.length} of {inventory.length} product(s).
      </p>

      <div className="mt-3">
        <DataTable
          rows={filteredInventory}
          columns={columns}
          rowKey={(line) => line.productId}
          emptyTitle={inventory.length === 0 ? "No products yet" : "No matching products"}
          emptyDescription={
            inventory.length === 0
              ? "Add a product first, then record its arrival to build up your inventory."
              : "Try a different search term or clear one of the filters."
          }
          emptyAction={
            inventory.length === 0 ? (
              <ButtonLink href="/dashboard/products" variant="secondary">
                Go to products
              </ButtonLink>
            ) : undefined
          }
        />
      </div>
    </>
  );
}

function StockLevel({ quantity }: { quantity: number }) {
  const status = inventoryStockStatus(quantity);

  if (status === "out-of-stock") {
    return <span className="font-medium text-rose-600">Out of stock</span>;
  }

  if (status === "low-stock") {
    return <span className="font-medium text-amber-600">{quantity}</span>;
  }

  return <span className="font-medium text-slate-950">{quantity}</span>;
}
