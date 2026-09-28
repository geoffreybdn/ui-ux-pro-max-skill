import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Cake, Coins, Crown, Gift, QrCode, Flame, Stamp, Users } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, formatEuros } from "@/lib/settings";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(user.role === "customer" ? "/carte" : "/admin");
  const s = await getSettings();

  const features = [
    { icon: QrCode, title: "QR code en caisse", text: "On scanne votre carte, tout est crédité tout de suite.", show: true },
    s.points.enabled && { icon: Gift, title: "Des points à chaque euro", text: `${s.points.perEuro} point${s.points.perEuro > 1 ? "s" : ""} par euro, échangeables contre des cadeaux.`, show: true },
    s.stamps.enabled && { icon: Stamp, title: "Carte à tampons", text: `${s.stamps.required} tampons = ${s.stamps.reward}${s.stamps.minAmount ? ` (dès ${formatEuros(s.stamps.minAmount * 100)})` : ""}.`, show: true },
    s.cashback.enabled && { icon: Coins, title: `${s.cashback.percent} % de cashback`, text: "Une cagnotte en euros à utiliser sur vos prochaines commandes.", show: true },
    s.tiers.enabled && { icon: Crown, title: "Niveaux VIP", text: s.tiers.levels.map((t) => t.name).join(" → ") + " : plus vous venez, plus vous gagnez.", show: true },
    { icon: Flame, title: "Points doublés", text: "Pendant nos promos, vos gains sont multipliés automatiquement.", show: true },
    s.birthdayBonus > 0 && { icon: Cake, title: "Cadeau d'anniversaire", text: `${s.birthdayBonus} points offerts le jour de votre anniversaire.`, show: true },
    s.referral.enabled && { icon: Users, title: "Parrainage", text: `Invitez vos amis : +${s.referral.referrerBonus} points pour vous, +${s.referral.refereeBonus} pour eux.`, show: true },
    { icon: Bell, title: "Notifications", text: "Promos, récompenses, rappels : on vous prévient au bon moment.", show: true },
  ].filter(Boolean) as { icon: typeof Gift; title: string; text: string }[];

  return (
    <>
      <TopBar>
        <Link href="/connexion" className="btn btn-sm">Connexion</Link>
      </TopBar>
      <main className="container page">
        <section className="hero stack">
          <span className="badge badge-hot" style={{ width: "fit-content" }}>Carte de fidélité</span>
          <h1>Chaque pizza vous rapproche de la suivante.</h1>
          <p className="muted" style={{ fontSize: "1.15rem", maxWidth: 560 }}>
            Inscrivez-vous en 30 secondes chez {s.pizzeriaName}
            {s.welcomeBonus > 0 ? ` et recevez ${s.welcomeBonus} points de bienvenue` : ""}.
          </p>
          <div className="row">
            <Link href="/inscription" className="btn btn-primary">Créer ma carte</Link>
            <Link href="/connexion" className="btn">J&apos;ai déjà un compte</Link>
          </div>
        </section>

        <section className="grid mt">
          {features.map(({ icon: Icon, title, text }) => (
            <div className="card feature" key={title}>
              <Icon size={28} />
              <div><h3>{title}</h3><p className="muted small">{text}</p></div>
            </div>
          ))}
          <div className="card feature">
            <Gift size={28} />
            <div><h3>Ancienne carte ?</h3><p className="muted small">Inscrivez-vous avec le même e-mail : vos points sont récupérés automatiquement.</p></div>
          </div>
        </section>
      </main>
    </>
  );
}
