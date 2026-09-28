import QRCode from "qrcode";
import { Flame, Gift, PartyPopper } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PushToggle } from "@/components/PushToggle";
import { InstallCard } from "@/components/InstallCard";
import { requireUser } from "@/lib/auth";
import { sql } from "@/lib/db";
import { getActivePromotion, getRewards } from "@/lib/loyalty";
import Link from "next/link";

export const metadata = { title: "Ma carte" };

const TYPE_LABEL: Record<string, string> = {
  earn: "Achat",
  redeem: "Récompense",
  bonus: "Bonus",
  import: "Ancienne carte",
  adjust: "Ajustement",
};

export default async function CardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requireUser();
  const params = await searchParams;
  const [promo, rewards, history] = await Promise.all([
    getActivePromotion(),
    getRewards(),
    sql<{ id: number; type: string; points: number; note: string | null; created_at: string }>`
      select id, type, points, note, created_at from transactions
      where customer_id = ${user.id} order by created_at desc limit 15`,
  ]);
  const qr = await QRCode.toDataURL(user.card_code, { margin: 1, width: 440, errorCorrectionLevel: "M" });
  const next = rewards.find((r) => r.cost > user.points);
  const available = rewards.filter((r) => r.cost <= user.points);

  return (
    <>
      <TopBar loggedIn>
        {user.role !== "customer" && <Link href="/admin" className="btn btn-sm">Admin</Link>}
      </TopBar>
      <main className="container narrow page stack">
        {params.bienvenue && (
          <div className="alert alert-success">
            <PartyPopper size={18} style={{ verticalAlign: "middle" }} /> Bienvenue {user.name.split(" ")[0]} !
            {params.anciens && <> {params.anciens} points de votre ancienne carte ont été récupérés.</>}
            {params.bonus && <> +{params.bonus} points offerts avec votre code.</>}
          </div>
        )}

        {promo && (
          <div className="promo-banner">
            <Flame size={22} />
            <div>
              {promo.title} — points x{Number(promo.multiplier)}
              <div className="small" style={{ fontWeight: 500 }}>
                jusqu&apos;au {new Date(promo.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </div>
            </div>
          </div>
        )}

        <section className="loyalty-card" aria-label="Carte de fidélité">
          <div className="row between">
            <div>
              <div className="small" style={{ opacity: 0.85 }}>{user.name}</div>
              <div className="points">{user.points}</div>
              <div className="small" style={{ opacity: 0.85 }}>points</div>
            </div>
          </div>
          <div className="qr-box"><img src={qr} alt={`QR code de la carte ${user.card_code}`} /></div>
          <div className="card-code">{user.card_code}</div>
          <p className="small center" style={{ opacity: 0.85, marginTop: 8 }}>Présentez ce QR code en caisse</p>
        </section>

        <InstallCard force={Boolean(params.bienvenue)} />

        <PushToggle />

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
                    <td>{TYPE_LABEL[t.type] ?? t.type}{t.note && t.type === "redeem" ? ` · ${t.note}` : ""}</td>
                    <td className={t.points >= 0 ? "plus" : "minus"} style={{ textAlign: "right" }}>
                      {t.points >= 0 ? "+" : ""}{t.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
