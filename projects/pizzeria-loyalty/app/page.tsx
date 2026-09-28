import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Gift, QrCode, Flame } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { PIZZERIA_NAME, POINTS_PER_EURO } from "@/lib/config";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(user.role === "customer" ? "/carte" : "/admin");

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
            Inscrivez-vous en 30 secondes, présentez votre QR code en caisse et cumulez {POINTS_PER_EURO} point
            {POINTS_PER_EURO > 1 ? "s" : ""} par euro chez {PIZZERIA_NAME}.
          </p>
          <div className="row">
            <Link href="/inscription" className="btn btn-primary">Créer ma carte</Link>
            <Link href="/connexion" className="btn">J&apos;ai déjà un compte</Link>
          </div>
        </section>

        <section className="grid mt">
          <div className="card feature">
            <QrCode size={28} />
            <div><h3>QR code en caisse</h3><p className="muted small">On scanne votre carte, les points tombent tout de suite.</p></div>
          </div>
          <div className="card feature">
            <Flame size={28} />
            <div><h3>Points doublés</h3><p className="muted small">Pendant nos promos, vos points sont multipliés automatiquement.</p></div>
          </div>
          <div className="card feature">
            <Bell size={28} />
            <div><h3>Notifications</h3><p className="muted small">Soyez prévenu des promos et de vos récompenses débloquées.</p></div>
          </div>
          <div className="card feature">
            <Gift size={28} />
            <div><h3>Ancienne carte ?</h3><p className="muted small">Inscrivez-vous avec le même e-mail : vos points sont récupérés automatiquement.</p></div>
          </div>
        </section>
      </main>
    </>
  );
}
