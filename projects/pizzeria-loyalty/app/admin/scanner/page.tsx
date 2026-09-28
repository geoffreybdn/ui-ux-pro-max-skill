import { requireStaffPage } from "@/lib/auth";
import { getActivePromotion, getRewards } from "@/lib/loyalty";
import { POINTS_PER_EURO } from "@/lib/config";
import { Scanner } from "./Scanner";

export const metadata = { title: "Scanner" };

export default async function Page() {
  const user = await requireStaffPage();
  const [promo, rewards] = await Promise.all([getActivePromotion(), getRewards()]);
  return (
    <Scanner
      isAdmin={user.role === "admin"}
      pointsPerEuro={POINTS_PER_EURO}
      promo={promo ? { title: promo.title, multiplier: Number(promo.multiplier) } : null}
      rewards={rewards}
    />
  );
}
