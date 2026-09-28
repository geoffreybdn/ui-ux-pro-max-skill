import { headers } from "next/headers";
import QRCode from "qrcode";
import { ArrowRight, Gift, Heart, Leaf, Pizza, ScanLine, Smartphone, Star, UserPlus } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { getSettings, plural, stampCols } from "@/lib/settings";
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
  const qr = await QRCode.toDataURL(qrUrl, { margin: 0, width: 700, errorCorrectionLevel: "M" });

  const req = s.stamps.required;
  const welcome = s.welcomeStamps;
  const unit = s.stamps.unitLabel;
  const reward = s.stamps.reward.toLowerCase();
  const perVisit = s.stamps.rule === "quantity" ? `À chaque ${unit}, le tampon est ajouté automatiquement.` : "À chaque visite, le tampon est ajouté automatiquement.";

  return (
    <div className="stack">
      <div className="dash-head no-print">
        <div>
          <h1>Affiche QR d&apos;inscription</h1>
          <p className="muted">Format A4, prête à imprimer. Les inscriptions via ce QR code sont comptées dans « Origine des inscriptions ».</p>
        </div>
        <PrintButton />
      </div>

      <div className="poster-frame">
        <article className="poster-a4" aria-label="Affiche à imprimer">
          {/* ── Partie haute : photo + accroche ── */}
          <div className="pa-top">
            <div className="pa-photo" aria-hidden />
            <div className="pa-script pa-script-top">Pizzas artisanales<br />au feu de bois</div>

            <div className="pa-brand">
              <img src="/logo.png" alt={s.pizzeriaName} className="pa-logo" />
              {s.city && <div className="pa-city">{s.city}</div>}
            </div>

            <span className="pa-kicker">Carte de fidélité</span>
            <h2 className="pa-title">
              Chaque tampon vous rapproche d&rsquo;une <span>{reward}&nbsp;!</span>
            </h2>

            <ul className="pa-perks">
              {welcome > 0 && (
                <li><span className="pa-perk-icon"><Gift /></span><b>{plural(welcome, "tampon")} offert{welcome > 1 ? "s" : ""}</b><small>dès l&apos;inscription</small></li>
              )}
              <li><span className="pa-perk-icon"><Pizza /></span><b>{req} tampons = 1 {unit}</b><small>offerte</small></li>
              <li><span className="pa-perk-icon"><ScanLine /></span><b>Simple et rapide</b><small>en caisse</small></li>
            </ul>

          </div>

          {/* ── Partie basse : étapes + engagements ── */}
          <div className="pa-bottom">
            <h3 className="pa-h3">Comment ça marche&nbsp;?</h3>
            <div className="pa-steps">
              <div className="pa-step">
                <span className="pa-num">1</span>
                <span className="pa-step-icon"><UserPlus /></span>
                <b>Inscrivez-vous</b>
                <small>{welcome > 0 ? `Recevez ${plural(welcome, "tampon")} tout de suite.` : "C'est gratuit et rapide."}</small>
              </div>
              <ArrowRight className="pa-arrow" />
              <div className="pa-step">
                <span className="pa-num">2</span>
                <span className="pa-step-icon"><ScanLine /></span>
                <b>Scannez votre carte</b>
                <small>{perVisit}</small>
              </div>
              <ArrowRight className="pa-arrow" />
              <div className="pa-step">
                <span className="pa-num">3</span>
                <span className="pa-step-icon"><Gift /></span>
                <b>Obtenez votre {unit}</b>
                <small>Après {req} tampons, profitez de votre {reward}&nbsp;!</small>
              </div>
              <div className="pa-script pa-script-side">Plus qu&apos;une pizza…<br />une passion&nbsp;!<Heart className="pa-heart" /></div>
            </div>

            <div className="pa-values">
              <div><Pizza /><span>Pizzas artisanales au feu de bois</span></div>
              <div><Leaf /><span>Produits frais et de qualité</span></div>
              <div><Heart /><span>Une récompense gourmande</span></div>
              <div><Star /><span>Offres exclusives réservées aux membres</span></div>
            </div>

            <footer className="pa-footer">
              <span className="pa-flag pa-flag-left" aria-hidden />
              <span className="pa-flag pa-flag-right" aria-hidden />
              <div className="pa-footer-name">{s.pizzeriaName}</div>
              {s.city && <div className="pa-footer-city">{s.city}</div>}
            </footer>
          </div>

          <div className="pa-qr-card">
            <div className="pa-qr-title">Inscrivez-vous<br /><span>maintenant&nbsp;!</span></div>
            <img src={qr} alt="QR code d'inscription" className="pa-qr" />
            <div className="pa-qr-pill"><Smartphone /> Scannez ce QR code</div>
          </div>

          <div className="pa-phone" aria-hidden>
            <div className="pa-phone-screen">
              <div className="pa-phone-top"><img src="/logo.png" alt="" /></div>
              <div className="pa-phone-body">
                <img src={qr} alt="" className="pa-phone-qr" />
                <div className="pa-phone-stamps" style={{ gridTemplateColumns: `repeat(${stampCols(req)}, 1fr)` }}>
                  {Array.from({ length: req }, (_, i) => (
                    <span key={i} className={i < Math.min(3, req - 1) ? "on" : ""}><Pizza /></span>
                  ))}
                </div>
                <div className="pa-phone-banner"><Gift /> {req} tampons = {reward}</div>
              </div>
            </div>
          </div>
        </article>
      </div>

      <section className="panel no-print stack">
        <h2>Liens à partager</h2>
        <CopyLink label="Réseaux sociaux (Instagram, Facebook…)" url={socialUrl} />
        <CopyLink label="QR code magasin" url={qrUrl} />
        <p className="small muted">Pour un code avec des tampons offerts, créez-le dans <a href="/admin/codes">Codes d&apos;inscription</a>.</p>
      </section>
    </div>
  );
}
