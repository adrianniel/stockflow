export const CURRENT_RELEASE = {
  /** Change this for every announcement so prior browser preferences don't carry over. */
  id: "stockflow-2026-09-landing-dashboard-refresh",
  title: "New Update in StockFlow!",
  landing: {
    intro:
      "Hi, I’m Niel Adrian, creator of StockFlow. I’ve made some new updates to make it easier to explore what StockFlow can do for your shop:",
    changes: [
      "A refreshed landing page with a smoother way to explore the product.",
      "An interactive guide to the complete shop workflow, from setup to reports.",
      "A new About section with more about the project and its creator.",
    ],
    closing:
      "There are updates inside your account too. Sign in to check them out. Thank you for using StockFlow!",
  },
  account: {
    intro: "What’s new?",
    changes: [
      "The dashboard has a fixed shop-and-role header, a hamburger menu, and a refreshed navy, beige, white, and light-blue design.",
      "Inventory summaries are more compact, with Receive Stock easier to reach. Sales and Credit summaries and actions are easier to scan.",
      "Record expenses for today or a past date, edit them, or soft-delete mistakes. Active expenses reduce net profit in reports.",
      "Reports now use Philippine local dates and times, so sales appear on the correct business day.",
      "The landing page now includes a responsive product overview and interactive shop workflow guide.",
    ],
    closing: "Thank you for using StockFlow!",
  },
} as const;
