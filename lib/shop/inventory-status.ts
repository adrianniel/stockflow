/** The shared quantity boundary used by inventory warnings and filters. */
export const LOW_STOCK_THRESHOLD = 5;

export type InventoryStockStatus = "in-stock" | "low-stock" | "out-of-stock";

export function inventoryStockStatus(quantity: number): InventoryStockStatus {
  if (quantity === 0) {
    return "out-of-stock";
  }

  return quantity <= LOW_STOCK_THRESHOLD ? "low-stock" : "in-stock";
}
