import { requireStaffPage } from "@/lib/auth";
import { getActivePromotion, getRewards } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { Scanner } from "./Scanner";

export const metadata = { title: "Scanner" };

export default async function Page() {
  const user = await requireStaffPage();
  const [s, promo, rewards] = await Promise.all([getSettings(), getActivePromotion(), getRewards()]);
  return (
    <Scanner
      isAdmin={user.role === "admin"}
      program={{ points: s.points, stamps: s.stamps, cashback: s.cashback, tiers: s.tiers }}
      promo={promo ? { title: promo.title, multiplier: Number(promo.multiplier) } : null}
      rewards={rewards}
    />
  );
}
