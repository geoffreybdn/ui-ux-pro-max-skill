import { requireStaffPage } from "@/lib/auth";
import { getActiveOffers, getActivePromotion } from "@/lib/loyalty";
import { channelLabel, promoBenefit } from "@/lib/program";
import { getSettings } from "@/lib/settings";
import { Scanner } from "./Scanner";

export const metadata = { title: "Scanner" };

export default async function Page() {
  const user = await requireStaffPage();
  const [s, promo, offers] = await Promise.all([getSettings(), getActivePromotion(), getActiveOffers("onsite")]);
  return (
    <>
    {offers.length > 0 && (
      <div className="alert alert-info small" style={{ marginBottom: 12 }}>
        <b>🔥 Promos en cours en caisse :</b>
        <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
          {offers.map((o) => <li key={o.id}>{promoBenefit(o)} — {channelLabel(o.channel)}{o.conditions ? ` (${o.conditions})` : ""}</li>)}
        </ul>
      </div>
    )}
    <Scanner
      isAdmin={user.role === "admin"}
      card={s.stamps}
      promo={promo ? { title: promo.title, multiplier: Number(promo.multiplier) } : null}
    />
    </>
  );
}
