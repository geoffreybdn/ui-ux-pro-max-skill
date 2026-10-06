import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { ArrowRight, ChevronRight, Gift, Heart, Leaf, Pizza, ScanLine, Star, User, UserPlus } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getSettings, plural, stampCols } from "@/lib/settings";

export default async function Home() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect(user.role === "customer" ? "/carte" : "/admin");

  const [s, h] = await Promise.all([getSettings(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const qr = await QRCode.toDataURL(`${proto}://${host}/inscription?src=web`, { margin: 0, width: 280, errorCorrectionLevel: "M" });

  const req = s.stamps.required;
  const welcome = s.welcomeStamps;
  const reward = s.stamps.reward.toLowerCase();
  const perUnit = s.stamps.rule === "quantity" ? `par ${s.stamps.unitLabel}` : "à chaque visite";
  const demoFilled = Math.min(4, req - 1);

  return (
    <div className="landing" id="top">
      <header className="l-nav">
        <Link href="/" className="l-nav-logo" aria-label={`${s.pizzeriaName} — accueil`}>
          <img src="/logo.png" alt={s.pizzeriaName} width={116} height={116} />
        </Link>
        <nav className="l-nav-links" aria-label="Navigation">
          <a href="#top">Accueil</a>
          <a href="#fidelite">Carte de fidélité</a>
          <a href="#comment">Comment ça marche</a>
          <a href="#apropos">À propos</a>
        </nav>
        <Link href="/connexion" className="l-btn l-btn-ghost l-login"><User size={18} /> Connexion</Link>
      </header>

      <section className="l-hero">
        <div className="l-hero-photo" aria-hidden />
        <div className="l-hero-text">
          <span className="l-kicker">Carte de fidélité</span>
          <h1>
            Chaque tampon vous rapproche d&rsquo;une <span className="l-accent">{reward}&nbsp;!</span>
          </h1>
          <p className="l-lead">
            Rejoignez la carte de fidélité {s.pizzeriaName}
            {welcome > 0 ? <> et recevez {plural(welcome, "tampon")} dès votre inscription.</> : <> : inscription gratuite en 30 secondes.</>}
          </p>

          <ul className="l-perks">
            {welcome > 0 && (
              <li><span className="l-perk-icon"><Gift size={30} /></span><b>{plural(welcome, "tampon")} offert{welcome > 1 ? "s" : ""}</b><span>dès l&apos;inscription</span></li>
            )}
            <li><span className="l-perk-icon"><Pizza size={30} /></span><b>{req} tampons = 1 {s.stamps.unitLabel}</b><span>{s.stamps.reward.replace(/^\S+\s*/, "") || "offerte"}</span></li>
            <li><span className="l-perk-icon"><ScanLine size={30} /></span><b>Simple et rapide</b><span>en caisse</span></li>
          </ul>

          <div className="l-ctas">
            <Link href="/inscription" className="l-btn l-btn-red">Créer ma carte <ChevronRight size={22} /></Link>
            <Link href="/connexion" className="l-btn l-btn-ghost">J&apos;ai déjà un compte</Link>
            <Link href="/installer" className="l-install-link">📲 Installer l&apos;app sur mon téléphone</Link>
          </div>
        </div>
      </section>

      <section className="l-digital" id="fidelite">
        <div className="l-digital-card">
          <h2>Votre carte de fidélité digitale</h2>
          <p>Scannez votre QR code en caisse à chaque visite, le tampon est ajouté automatiquement.</p>
          <p className="l-small">Pas d&apos;application à télécharger : ajoutez simplement votre carte sur l&apos;écran d&apos;accueil de votre téléphone.</p>
        </div>
        <div className="l-phone" aria-label="Aperçu de la carte sur téléphone">
          <div className="l-phone-screen">
            <div className="l-phone-top"><img src="/logo.png" alt="" width={120} height={120} /></div>
            <div className="l-phone-body">
              <img src={qr} alt="QR code d'inscription" className="l-phone-qr" />
              <div className="l-phone-stamps" style={{ gridTemplateColumns: `repeat(${stampCols(req)}, 1fr)` }}>
                {Array.from({ length: req }, (_, i) => (
                  <span key={i} className={i < demoFilled ? "on" : ""}><Pizza size={16} /></span>
                ))}
              </div>
              <div className="l-phone-banner"><Gift size={18} /> {req} tampons = {reward}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="l-steps" id="comment">
        <h2>Comment ça marche&nbsp;?</h2>
        <ol>
          <li>
            <span className="l-step-num">1</span>
            <span className="l-step-icon"><UserPlus size={40} /></span>
            <h3>Inscrivez-vous</h3>
            <p>{welcome > 0 ? `Recevez ${plural(welcome, "tampon")} tout de suite.` : "C'est gratuit et rapide."}</p>
          </li>
          <li className="l-step-arrow" aria-hidden><ArrowRight size={28} /></li>
          <li>
            <span className="l-step-num">2</span>
            <span className="l-step-icon"><ScanLine size={40} /></span>
            <h3>Scannez votre carte</h3>
            <p>À chaque visite, 1 tampon {perUnit} est ajouté automatiquement.</p>
          </li>
          <li className="l-step-arrow" aria-hidden><ArrowRight size={28} /></li>
          <li>
            <span className="l-step-num">3</span>
            <span className="l-step-icon"><Gift size={40} /></span>
            <h3>Obtenez votre {s.stamps.unitLabel}</h3>
            <p>Après {req} tampons, profitez de votre {reward}&nbsp;!</p>
          </li>
        </ol>
      </section>

      <section className="l-values" id="apropos" aria-label="Nos engagements">
        <div><Pizza size={34} /><span>Pizzas artisanales au feu de bois</span></div>
        <div><Leaf size={34} /><span>Produits frais et de qualité</span></div>
        <div><Heart size={34} /><span>Une récompense gourmande</span></div>
        <div><Star size={34} /><span>Offres exclusives réservées aux membres</span></div>
      </section>

      <footer className="l-footer">
        <div className="l-signature">{s.pizzeriaName}</div>
        <div className="l-tricolor" aria-hidden><span /><span /><span /></div>
        {s.city && <div className="l-city">{s.city}</div>}
        <div className="l-footer-links">
          <Link href="/inscription">Créer ma carte</Link>
          <Link href="/connexion">Connexion</Link>
        </div>
      </footer>
    </div>
  );
}
