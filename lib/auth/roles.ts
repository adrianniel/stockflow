/**
 * Role definitions and the single source of truth for where each role lands.
 *
 * Kept free of server-only imports so both Server Components and client
 * components (sidebar, nav) can read it.
 */

export const USER_ROLES = ["SUPER_ADMIN", "OWNER", "ASSISTANT"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export type SessionProfile = {
  id: string;
  name: string | null;
  role: UserRole;
  shop_id: string | null;
  status: UserStatus;
  /** The shop's own status. Null for SUPER_ADMIN, which has no shop. */
  shop_status: UserStatus | null;
};

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && USER_ROLES.includes(value as UserRole)
  );
}

export function isUserStatus(value: unknown): value is UserStatus {
  return (
    typeof value === "string" && USER_STATUSES.includes(value as UserStatus)
  );
}

/** The dashboard home for a role. Used for routing and for bouncing intruders. */
export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard/admin";
    case "OWNER":
      return "/dashboard/owner";
    case "ASSISTANT":
      return "/dashboard/assistant";
  }
}

/** Short human label for a role, used as the header eyebrow. */
export function roleLabel(role: UserRole): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "Platform administration";
    case "OWNER":
      return "Shop management";
    case "ASSISTANT":
      return "Daily operations";
  }
}

export type NavItem = {
  label: string;
  href: string;
};

/**
 * Sidebar navigation per role, transcribed from SRS.md sections 5.1-5.3.
 *
 * Feature pages are shared routes (/dashboard/products, /dashboard/sales, ...)
 * rather than role-prefixed copies: OWNER and ASSISTANT need most of the same
 * screens, and one guarded route per feature beats two copies that drift apart.
 * Only the role home differs.
 *
 * This list controls *visibility* only. It is not a security boundary — every
 * page still calls requireRole(), and RLS is the backstop underneath that.
 */
export function navigationForRole(role: UserRole): NavItem[] {
  switch (role) {
    // SRS 5.1: shops, owners, platform usage. Explicitly no business data.
    case "SUPER_ADMIN":
      return [
        { label: "Dashboard", href: "/dashboard/admin" },
        { label: "Shops", href: "/dashboard/shops" },
        { label: "Users", href: "/dashboard/users" },
        { label: "Settings", href: "/dashboard/settings" },
      ];

    // SRS 5.2: products, inventory, sales, reports, assistant accounts.
    case "OWNER":
      return [
        { label: "Dashboard", href: "/dashboard/owner" },
        { label: "Products", href: "/dashboard/products" },
        { label: "Categories", href: "/dashboard/categories" },
        { label: "Inventory", href: "/dashboard/inventory" },
        { label: "Sales", href: "/dashboard/sales" },
        { label: "Adjustments", href: "/dashboard/adjustments" },
        { label: "Reports", href: "/dashboard/reports" },
        { label: "Assistants", href: "/dashboard/assistants" },
        { label: "Settings", href: "/dashboard/settings" },
      ];

    // SRS 5.3: stock arrivals, sales, view inventory, view reports. No
    // ownership management, so no Categories, Assistants or Adjustments.
    case "ASSISTANT":
      return [
        { label: "Dashboard", href: "/dashboard/assistant" },
        { label: "Products", href: "/dashboard/products" },
        { label: "Inventory", href: "/dashboard/inventory" },
        { label: "Sales", href: "/dashboard/sales" },
        { label: "Reports", href: "/dashboard/reports" },
        { label: "Settings", href: "/dashboard/settings" },
      ];
  }
}
