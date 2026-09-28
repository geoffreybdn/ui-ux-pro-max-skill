import QRCode from "qrcode";
import Link from "next/link";
import { Cake, Coins, Crown, Flame, Gift, PartyPopper, Stamp, Users } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PushToggle } from "@/components/PushToggle";
import { InstallCard } from "@/components/InstallCard";
import { ReferralShare } from "@/components/ReferralShare";
import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getActivePromotion, getRewards } from "@/lib/loyalty";
import { firstName, formatEuros, getSettings, nextTier, tierFor } from "@/lib/settings";

export const metadata = { title: "Ma carte" };

const TYPE_LABEL: Record<string, string> = {
  earn: "Visite",
  redeem: "Récompense",
  bonus: "Bonus",
  import: "Ancienne carte",
  adjust: "Ajustement",
  welcome: "Bienvenue",
  birthday: "Anniversaire",
  referral: "Parrainage",
  stamp_reward: "Carte tampons",
  cashback_use: "Cashback utilisé",
};

type Tx = { id: number; type: string; points: number; stamps: number; cashback_cents: number; note: string | null; created_at: string };

function txSummary(t: Tx) {
  const parts: string[] = [];
  if (t.points) parts.push(`${t.points > 0 ? "+" : ""}${t.points} pts`);
  if (t.stamps) parts.push(`${t.stamps > 0 ? "+" : ""}${t.stamps} tampon${Math.abs(t.stamps) > 1 ? "s" : ""}`);
  if (t.cashback_cents) parts.push(`${t.cashback_cents > 0 ? "+" : "−"}${formatEuros(Math.abs(t.cashback_cents))}`);
  return parts.join(" · ") || "—";
}

export default async function CardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const [s, promo, rewards, history] = await Promise.all([
    getSettings(),
    getActivePromotion(),
    getRewards(),
    sql<Tx>`
      select id, type, points, stamps, cashback_cents, note, created_at from transactions
      where customer_id = ${user.id} order by created_at desc limit 15`,
  ]);
  const qr = await QRCode.toDataURL(user.card_code, { margin: 1, width: 440, errorCorrectionLevel: "M" });
  const next = rewards.find((r) => r.cost > user.points);
  const available = rewards.filter((r) => r.cost <= user.points);
  const tier = tierFor(s, user.lifetime_points);
  const upcomingTier = nextTier(s, user.lifetime_points);
  const stampsOnCard = Math.min(user.stamps, s.stamps.required);
  const stampCardFull = user.stamps >= s.stamps.required;
  const canUseCashback = user.cashback_cents >= s.cashback.minRedeem * 100;

  return (
    <>
      <TopBar loggedIn>
        {user.role !== "customer" && <Link href="/admin" className="btn btn-sm">Admin</Link>}
      </TopBar>
      <main className="container narrow page stack">
        {params.bienvenue && (
          <div className="alert alert-success">
            <PartyPopper size={18} style={{ verticalAlign: "middle" }} /> Bienvenue {firstName(user.name)} !
            {params.anciens && <> {params.anciens} points de votre ancienne carte ont été récupérés.</>}
            {params.bonus && <> +{params.bonus} points offerts.</>}
          </div>
        )}

        {promo && (
          <div className="promo-banner">
            <Flame size={22} />
            <div>
              {promo.title} — gains x{Number(promo.multiplier)}
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
              {s.points.enabled || user.points > 0 ? (
                <>
                  <div className="points">{user.points}</div>
                  <div className="small" style={{ opacity: 0.85 }}>points</div>
                </>
              ) : (
                <div className="points">{stampsOnCard}/{s.stamps.required}</div>
              )}
            </div>
            <div className="stack" style={{ gap: 6, alignItems: "flex-end", position: "relative", zIndex: 1 }}>
              {tier && <span className="badge tier-badge"><Crown size={12} /> {tier.name}</span>}
              {s.cashback.enabled && <span className="badge tier-badge"><Coins size={12} /> {formatEuros(user.cashback_cents)}</span>}
            </div>
          </div>
          <div className="qr-box"><img src={qr} alt={`QR code de la carte ${user.card_code}`} /></div>
          <div className="card-code">{user.card_code}</div>
          <p className="small center" style={{ opacity: 0.85, marginTop: 8 }}>Présentez ce QR code en caisse</p>
        </section>

        <InstallCard force={Boolean(params.bienvenue)} />

        <PushToggle />

        {s.stamps.enabled && (
          <section className="card stack">
            <div className="row between">
              <h2 style={{ margin: 0 }}><Stamp size={20} style={{ verticalAlign: "-3px" }} /> Carte tampons</h2>
              <span className="badge">{stampsOnCard} / {s.stamps.required}</span>
            </div>
            <div className="stamp-grid" role="img" aria-label={`${stampsOnCard} tampons sur ${s.stamps.required}`}>
              {Array.from({ length: s.stamps.required }, (_, i) => (
                <span key={i} className={`stamp ${i < stampsOnCard ? "stamp-on" : ""} ${i === s.stamps.required - 1 ? "stamp-gift" : ""}`}>
                  {i === s.stamps.required - 1 ? "🎁" : i < stampsOnCard ? "🍕" : ""}
                </span>
              ))}
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {stampCardFull
                ? <b>Carte complète : {s.stamps.reward} vous attend en caisse !</b>
                : <>Encore {s.stamps.required - stampsOnCard} tampon{s.stamps.required - stampsOnCard > 1 ? "s" : ""} pour : <b>{s.stamps.reward}</b>.</>}
              {s.stamps.minAmount > 0 && <> 1 tampon par commande dès {formatEuros(s.stamps.minAmount * 100)}.</>}
            </p>
          </section>
        )}

        {(s.points.enabled || rewards.length > 0) && (
          <section className="card stack">
            <h2><Gift size={20} style={{ verticalAlign: "-3px" }} /> Récompenses</h2>
            {available.length > 0 && (
              <div className="alert alert-success small">
                Disponible maintenant : {available.map((r) => r.name).join(", ")} — demandez-le en caisse !
              </div>
            )}
            {next && (
              <div>
                <div className="row between small">
                  <span>Prochaine : <b>{next.name}</b></span>
                  <span>{user.points} / {next.cost}</span>
                </div>
                <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={next.cost} aria-valuenow={user.points}>
                  <span style={{ width: `${Math.min(100, (user.points / next.cost) * 100)}%` }} />
                </div>
              </div>
            )}
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {rewards.map((r) => <li key={r.id}>{r.name} — {r.cost} points</li>)}
            </ul>
          </section>
        )}

        {s.cashback.enabled && (
          <section className="card stack">
            <h2><Coins size={20} style={{ verticalAlign: "-3px" }} /> Cashback</h2>
            <div className="stat"><div className="value">{formatEuros(user.cashback_cents)}</div><div className="label">dans votre cagnotte</div></div>
            <p className="small muted" style={{ margin: 0 }}>
              {s.cashback.percent} % de chaque commande reversés.{" "}
              {canUseCashback
                ? "Utilisable dès maintenant en caisse."
                : `Utilisable dès ${formatEuros(s.cashback.minRedeem * 100)} de cagnotte.`}
            </p>
          </section>
        )}

        {tier && (
          <section className="card stack">
            <h2><Crown size={20} style={{ verticalAlign: "-3px" }} /> Niveau {tier.name}</h2>
            {tier.multiplier > 1 && <p className="small" style={{ margin: 0 }}>Vos gains sont multipliés par {tier.multiplier.toLocaleString("fr-FR")}.</p>}
            {upcomingTier ? (
              <div>
                <div className="row between small">
                  <span>Prochain niveau : <b>{upcomingTier.name}</b> (x{upcomingTier.multiplier.toLocaleString("fr-FR")})</span>
                  <span>{user.lifetime_points} / {upcomingTier.min}</span>
                </div>
                <div className="progress"><span style={{ width: `${Math.min(100, (user.lifetime_points / upcomingTier.min) * 100)}%` }} /></div>
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>Vous êtes au niveau maximum. Merci pour votre fidélité ⭐</p>
            )}
          </section>
        )}

        {s.referral.enabled && (
          <section className="card stack">
            <h2><Users size={20} style={{ verticalAlign: "-3px" }} /> Parrainage</h2>
            <p className="small" style={{ margin: 0 }}>
              Votre ami s&apos;inscrit avec votre code <b>{user.card_code}</b> : +{s.referral.referrerBonus} points pour vous,
              +{s.referral.refereeBonus} pour lui.
            </p>
            <ReferralShare code={user.card_code} pizzeriaName={s.pizzeriaName} />
          </section>
        )}

        <section className="card">
          <h2>Historique</h2>
          {history.length === 0 ? (
            <p className="muted small">Aucun mouvement pour l&apos;instant.</p>
          ) : (
            <table>
              <tbody>
                {history.map((t) => (
                  <tr key={t.id}>
                    <td className="small">{new Date(t.created_at).toLocaleDateString("fr-FR")}</td>
                    <td>{TYPE_LABEL[t.type] ?? t.type}{t.note && ["redeem", "stamp_reward"].includes(t.type) ? ` · ${t.note}` : ""}</td>
                    <td className={`small ${t.points < 0 || t.stamps < 0 || t.cashback_cents < 0 ? "minus" : "plus"}`} style={{ textAlign: "right" }}>
                      {txSummary(t)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <details className="card">
          <summary style={{ cursor: "pointer", fontWeight: 700 }}>
            Mon profil {!user.birthdate && s.birthdayBonus > 0 && <span className="badge" style={{ marginLeft: 6 }}><Cake size={12} /> ajoutez votre anniversaire</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <ProfileForm name={user.name} phone={user.phone} birthdate={user.birthdate} />
          </div>
        </details>
      </main>
    </>
  );
}
