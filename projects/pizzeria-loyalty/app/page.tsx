import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Cake, Gift, QrCode, Flame, Stamp, Users } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, plural, ruleLabel } from "@/lib/settings";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(user.role === "customer" ? "/carte" : "/admin");
  const s = await getSettings();

  const features = [
    { icon: QrCode, title: "QR code en caisse", text: "On scanne votre carte, le tampon est ajouté tout de suite." },
    { icon: Stamp, title: `${s.stamps.required} tampons = ${s.stamps.reward}`, text: `${ruleLabel(s.stamps)}.` },
    { icon: Flame, title: "Tampons doublés", text: "Pendant nos promos, vos tampons sont multipliés automatiquement." },
    s.birthdayStamps > 0 && { icon: Cake, title: "Cadeau d'anniversaire", text: `${plural(s.birthdayStamps, "tampon")} offert(s) le jour de votre anniversaire.` },
    s.referral.enabled && { icon: Users, title: "Parrainage", text: `Invitez vos amis : +${plural(s.referral.referrerStamps, "tampon")} pour vous, +${plural(s.referral.refereeStamps, "tampon")} pour eux.` },
    { icon: Bell, title: "Notifications", text: "Promos, carte presque pleine, cadeau à récupérer : on vous prévient." },
  ].filter(Boolean) as { icon: typeof Stamp; title: string; text: string }[];

  return (
    <>
      <TopBar>
        <Link href="/connexion" className="btn btn-sm">Connexion</Link>
      </TopBar>
      <main className="container page">
        <section className="hero stack">
          <span className="badge badge-hot" style={{ width: "fit-content" }}>Carte de fidélité</span>
          <h1>Chaque tampon vous rapproche d\u2019une pizza offerte.</h1>
          <p className="muted" style={{ fontSize: "1.15rem", maxWidth: 560 }}>
            La carte à tampons de {s.pizzeriaName} : {s.stamps.required} tampons = {s.stamps.reward}.
            {s.welcomeStamps > 0 ? ` Inscrivez-vous et recevez ${plural(s.welcomeStamps, "tampon")} tout de suite.` : " Inscription en 30 secondes."}
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
            <div><h3>Ancienne carte ?</h3><p className="muted small">Inscrivez-vous avec le même e-mail : vos tampons sont récupérés automatiquement.</p></div>
          </div>
        </section>
      </main>
    </>
  );
}
