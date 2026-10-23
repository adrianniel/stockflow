export const CURRENT_RELEASE = {
  /** Change this for every announcement so prior browser preferences don't carry over. */
  id: "stockflow-2026-10-consolidated-customer-credit",
  title: "New Update in StockFlow!",
  landing: {
    intro:
      "Hi, I’m Niel Adrian, creator of StockFlow. Customer credit is now easier to review and collect:",
    changes: [
      "See all of a customer’s credited items and sale dates in one combined list.",
      "Review the total credited, amount paid, and remaining balance together.",
      "Take partial payments against the total; StockFlow applies them to the oldest outstanding sale first.",
    ],
    closing:
      "Sign in, open Credit, and choose Open beside a customer. Thank you for using StockFlow!",
  },
  account: {
    intro: "What’s new?",
    changes: [
      "Open a customer to see one combined list of credited products, quantities, sale date and time, and recording staff.",
      "The account shows total credited, paid so far, and the remaining balance in one place.",
      "Record an installment against the total balance; it is allocated oldest sale first and shown once in payment history.",
    ],
    closing: "Thank you for using StockFlow!",
  },
} as const;
