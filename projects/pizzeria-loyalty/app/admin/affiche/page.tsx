import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireAdminPage } from "@/lib/auth";
import { getSettings, formatEuros } from "@/lib/settings";
import { PrintButton, CopyLink } from "./Actions";

export const metadata = { title: "QR codes d'inscription" };

export default async function Page() {
  await requireAdminPage();
  const [s, h] = await Promise.all([getSettings(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}/inscription`;
  const qrUrl = `${base}?src=qr`;
  const socialUrl = `${base}?src=social`;
  const qr = await QRCode.toDataURL(qrUrl, { margin: 1, width: 600, errorCorrectionLevel: "M" });

  const perks = [
    s.welcomeBonus > 0 && `${s.welcomeBonus} points offerts à l'inscription`,
    s.stamps.enabled && `${s.stamps.required} tampons = ${s.stamps.reward}`,
    s.points.enabled && `${s.points.perEuro} point${s.points.perEuro > 1 ? "s" : ""} par euro dépensé`,
    s.cashback.enabled && `${s.cashback.percent} % de cashback`,
    s.birthdayBonus > 0 && "Un cadeau pour votre anniversaire",
  ].filter(Boolean) as string[];

  return (
    <div className="stack">
      <div className="dash-head no-print">
        <div>
          <h1>QR codes d&apos;inscription</h1>
          <p className="muted">Affichez ce QR code en caisse : les inscriptions sont comptées dans « Origine des inscriptions ».</p>
        </div>
        <PrintButton />
      </div>

      <section className="poster" aria-label="Affiche à imprimer">
        <div className="poster-kicker">Carte de fidélité</div>
        <h2 className="poster-title">{s.pizzeriaName}</h2>
        <p className="poster-lead">Scannez, inscrivez-vous en 30 secondes et cumulez à chaque visite 🍕</p>
        <img src={qr} alt="QR code vers la page d'inscription" className="poster-qr" />
        <ul className="poster-perks">{perks.map((p) => <li key={p}>{p}</li>)}</ul>
        {s.cashback.enabled && s.cashback.minRedeem > 0 && (
          <p className="small muted">Cashback utilisable dès {formatEuros(s.cashback.minRedeem * 100)}.</p>
        )}
      </section>

      <section className="panel no-print stack">
        <h2>Liens à partager</h2>
        <CopyLink label="Réseaux sociaux (Instagram, Facebook…)" url={socialUrl} />
        <CopyLink label="QR code magasin" url={qrUrl} />
        <p className="small muted">Pour un code avec des points offerts, créez-le dans <a href="/admin/codes">Codes d&apos;inscription</a>.</p>
      </section>
    </div>
  );
}
