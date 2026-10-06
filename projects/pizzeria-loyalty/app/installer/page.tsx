import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { InstallGuide } from "./InstallGuide";

export const metadata = { title: "Installer l'app" };

export default async function Page() {
  const [user, s] = await Promise.all([getCurrentUser().catch(() => null), getSettings()]);
  return (
    <>
      <TopBar loggedIn={Boolean(user)}>
        {!user && <Link href="/connexion" className="btn btn-sm">Connexion</Link>}
      </TopBar>
      <main className="container narrow page stack">
        <div className="center">
          <img src="/app-icons/alabella-192.png" alt="" width={84} height={84} style={{ borderRadius: 20, boxShadow: "0 8px 20px rgb(0 0 0 / 15%)" }} />
          <h1 style={{ marginTop: 12 }}>Installer l&apos;app {s.pizzeriaName}</h1>
          <p className="muted">Votre carte de fidélité en un geste, comme une vraie application : icône sur l&apos;écran d&apos;accueil, ouverture en plein écran, QR code disponible même sans réseau, notifications des promos.</p>
        </div>
        <InstallGuide loggedIn={Boolean(user)} />
      </main>
    </>
  );
}
