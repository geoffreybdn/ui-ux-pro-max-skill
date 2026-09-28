import QRCode from "qrcode";
import Link from "next/link";
import { Cake, Flame, Gift, PartyPopper, Stamp, Ticket, Users } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PushToggle } from "@/components/PushToggle";
import { InstallCard } from "@/components/InstallCard";
import { ReferralShare } from "@/components/ReferralShare";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getActivePromotion } from "@/lib/loyalty";
import { getCustomerOffers } from "@/lib/coupons";
import { couponBenefit, couponConditions } from "@/lib/program";
import { cardState, firstName, getSettings, plural, ruleLabel, stampCols } from "@/lib/settings";

export const metadata = { title: "Ma carte" };

const TYPE_LABEL: Record<string, string> = {
  earn: "Visite",
  bonus: "Code offert",
  import: "Ancienne carte",
  adjust: "Correction",
  welcome: "Bienvenue",
  birthday: "Anniversaire",
  referral: "Parrainage",
  stamp_reward: "Récompense",
};

type Tx = { id: number; type: string; stamps: number; note: string | null; created_at: string };

export default async function CardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const [s, promo, offers, history] = await Promise.all([
    getSettings(),
    getActivePromotion(),
    getCustomerOffers(user.id),
    sql<Tx>`
      select id, type, stamps, note, created_at from transactions
      where customer_id = ${user.id} and stamps <> 0 order by created_at desc limit 15`,
  ]);
  const qr = await QRCode.toDataURL(user.card_code, { margin: 1, width: 440, errorCorrectionLevel: "M" });
  const req = s.stamps.required;
  const st = cardState(user.stamps, req);
  const shown = st.available > 0 ? req : st.onCard;

  return (
    <>
      <TopBar loggedIn>
        {user.role !== "customer" && <Link href="/admin" className="btn btn-sm">Admin</Link>}
      </TopBar>
      <main className="container narrow page stack">
        {params.bienvenue && (
          <div className="alert alert-success">
            <PartyPopper size={18} style={{ verticalAlign: "middle" }} /> Bienvenue {firstName(user.name)} !
            {params.anciens && <> {plural(Number(params.anciens), "tampon")} de votre ancienne carte récupéré(s).</>}
            {params.bonus && <> +{plural(Number(params.bonus), "tampon")} offert(s).</>}
          </div>
        )}

        {promo && (
          <div className="promo-banner">
            <Flame size={22} />
            <div>
              {promo.title} — tampons x{Number(promo.multiplier)}
              <div className="small" style={{ fontWeight: 500 }}>
                jusqu&apos;au {new Date(promo.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </div>
            </div>
          </div>
        )}

        <section className="loyalty-card" aria-label="Carte de fidélité">
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="small" style={{ opacity: 0.85 }}>{user.name}</div>
              <div className="points">{shown}<span style={{ fontSize: "1.6rem", opacity: 0.8 }}>/{req}</span></div>
              <div className="small" style={{ opacity: 0.85 }}>tampons · {s.stamps.reward}</div>
            </div>
            <img src="/logo.png" alt="" className="card-logo" width={76} height={76} />
          </div>
          <div className="stamp-grid stamp-grid-card" style={{ gridTemplateColumns: `repeat(${stampCols(req)}, 1fr)` }} aria-hidden>
            {Array.from({ length: req }, (_, i) => (
              <span key={i} className={`stamp ${i < shown ? "stamp-on" : ""} ${i === req - 1 ? "stamp-gift" : ""}`}>
                {i === req - 1 ? "🎁" : i < shown ? "🍕" : ""}
              </span>
            ))}
          </div>
          <div className="qr-box"><img src={qr} alt={`QR code de la carte ${user.card_code}`} /></div>
          <div className="card-code">{user.card_code}</div>
          <p className="small center" style={{ opacity: 0.85, marginTop: 8 }}>Présentez ce QR code en caisse</p>
        </section>

        {st.available > 0 ? (
          <div className="alert alert-success">
            <Gift size={18} style={{ verticalAlign: "-3px" }} /> {st.available > 1 ? `${st.available} × ` : ""}{s.stamps.reward} vous attend : demandez-le en caisse !
          </div>
        ) : (
          <p className="center" style={{ margin: 0 }}>
            Encore <b>{plural(st.remaining, "tampon")}</b> pour : <b>{s.stamps.reward}</b>
          </p>
        )}

        {offers.length > 0 && (
          <section className="card stack" aria-label="Mes offres">
            <h2 style={{ margin: 0 }}><Ticket size={20} style={{ verticalAlign: "-3px" }} /> Mes offres</h2>
            <p className="small muted" style={{ margin: 0 }}>Montrez le code en caisse avec votre carte.</p>
            {[...offers].sort((a, b) => Number(a.used) - Number(b.used)).map((o) => (
              <div key={o.id} className={`offer ${o.used ? "is-used" : ""}`}>
                <div className="coupon-code">{o.code}</div>
                <div>
                  <b>{o.title}</b>
                  <div className="small">{couponBenefit(o)}</div>
                  <div className="small muted">{o.used ? "Déjà utilisé" : couponConditions(o)}</div>
                </div>
              </div>
            ))}
          </section>
        )}

        <InstallCard force={Boolean(params.bienvenue)} />

        <PushToggle />

        <section className="card stack">
          <h2 style={{ margin: 0 }}><Stamp size={20} style={{ verticalAlign: "-3px" }} /> Comment ça marche</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>{ruleLabel(s.stamps)}{s.stamps.maxPerVisit > 0 ? ` (max ${s.stamps.maxPerVisit} par passage)` : ""}.</li>
            <li>{req} tampons = <b>{s.stamps.reward}</b>, puis une nouvelle carte commence.</li>
            {s.birthdayStamps > 0 && <li>{plural(s.birthdayStamps, "tampon")} offert(s) le jour de votre anniversaire 🎂</li>}
            <li>Pendant nos promos, vos tampons peuvent être doublés 🔥</li>
          </ul>
        </section>

        {s.referral.enabled && (
          <section className="card stack">
            <h2 style={{ margin: 0 }}><Users size={20} style={{ verticalAlign: "-3px" }} /> Parrainage</h2>
            <p className="small" style={{ margin: 0 }}>
              Votre ami s&apos;inscrit avec votre code <b>{user.card_code}</b> : +{plural(s.referral.referrerStamps, "tampon")} pour vous,
              +{plural(s.referral.refereeStamps, "tampon")} pour lui.
            </p>
            <ReferralShare code={user.card_code} pizzeriaName={s.pizzeriaName} />
          </section>
        )}

        <section className="card">
          <h2>Historique</h2>
          {history.length === 0 ? (
            <p className="muted small">Aucun tampon pour l&apos;instant.</p>
          ) : (
            <table>
              <tbody>
                {history.map((t) => (
                  <tr key={t.id}>
                    <td className="small">{new Date(t.created_at).toLocaleDateString("fr-FR")}</td>
                    <td>{TYPE_LABEL[t.type] ?? t.type}{t.note && t.type === "stamp_reward" ? ` · ${t.note}` : ""}</td>
                    <td className={`small ${t.stamps < 0 ? "minus" : "plus"}`} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {t.stamps > 0 ? "+" : ""}{plural(t.stamps, "tampon")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            Mon profil {!user.birthdate && s.birthdayStamps > 0 && <span className="badge" style={{ marginLeft: 6 }}><Cake size={12} /> ajoutez votre anniversaire</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <ProfileForm name={user.name} phone={user.phone} birthdate={user.birthdate} />
          </div>
        </details>
      </main>
    </>
  );
}
