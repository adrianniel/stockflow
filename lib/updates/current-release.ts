export const CURRENT_RELEASE = {
  /** Change this for every announcement so prior browser preferences don't carry over. */
  id: "stockflow-2026-10-credit-sale-details",
  title: "New Update in StockFlow!",
  landing: {
    intro:
      "Hi, I’m Niel Adrian, creator of StockFlow. Credit tracking is now easier to review and follow up:",
    changes: [
      "Review the products, quantities, and sale date and time for each outstanding customer credit.",
      "See the original sale, payments received, and remaining balance together in one clear record.",
      "Record multiple partial payments over time, with each collection kept in the payment history.",
    ],
    closing:
      "Sign in and open Credit to review a customer’s outstanding sales. Thank you for using StockFlow!",
  },
  account: {
    intro: "What’s new?",
    changes: [
      "Outstanding credit records now show the products and quantities, sale date and time, and staff member who recorded the sale.",
      "See each sale’s total, payments received, remaining balance, and a direct link to its full details.",
      "Collect a debt in multiple partial payments; every instalment stays in the sale’s payment history with its date, time, and collector.",
    ],
    closing: "Thank you for using StockFlow!",
  },
} as const;
