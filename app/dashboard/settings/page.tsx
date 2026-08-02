import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { requireSession } from "@/lib/auth/guards";
import { getDashboardIdentity } from "@/lib/dashboard/identity";
import { shopContextFor } from "@/lib/shop/context";
import { getShopSettings } from "@/lib/shop/queries";
import { toNumber } from "@/lib/utils/format";

import { ChangePasswordForm } from "./change-password-form";
import { ShopSettingsForm } from "./shop-settings-form";

export const metadata = { title: "Settings" };

/**
 * Settings (SRS 6.1).
 *
 * Open to every signed-in role, but the contents differ: password change is
 * universal, while shop details are owner-only. SUPER_ADMIN has no shop, so it
 * sees only the password section — the shop panel is skipped rather than shown
 * empty.
 */
export default async function SettingsPage() {
  const profile = await requireSession();
  const { displayName, displayEmail } = await getDashboardIdentity(profile);

  const isOwner = profile.role === "OWNER";
  const shop =
    isOwner && profile.shop_id
      ? await getShopSettings(await shopContextFor(profile))
      : null;

  return (
    <>
      <DashboardHeader
        title="Settings"
        subtitle="Your account, and how your shop prices stock."
        userName={displayName}
        userEmail={displayEmail}
        role={profile.role}
        shopName={profile.shop_name}
      />

      {shop ? (
        <Panel>
          <PanelHeader
            title="Shop details"
            description="The default markup pre-fills the receive-stock form. Changing it never re-prices stock you already have."
          />

          <ShopSettingsForm
            shopName={shop.shop_name}
            ownerName={shop.owner_name}
            defaultInterest={toNumber(shop.default_interest_percentage)}
          />
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Password"
          description="Change the password you use to sign in."
        />

        <ChangePasswordForm />
      </Panel>
    </>
  );
}
