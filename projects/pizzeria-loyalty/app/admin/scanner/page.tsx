import { requireStaffPage } from "@/lib/auth";
import { getActivePromotion } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import { Scanner } from "./Scanner";

export const metadata = { title: "Scanner" };

export default async function Page() {
  const user = await requireStaffPage();
  const [s, promo] = await Promise.all([getSettings(), getActivePromotion()]);
  return (
    <Scanner
      isAdmin={user.role === "admin"}
      card={s.stamps}
      promo={promo ? { title: promo.title, multiplier: Number(promo.multiplier) } : null}
    />
  );
}
