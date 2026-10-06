"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Apple, Bell, CheckCircle2, MoreVertical, Plus, Share, Smartphone, SquarePlus } from "lucide-react";
import { usePwaInstall, type Platform } from "@/components/usePwaInstall";

type Tab = "ios" | "android";

function Step({ n, title, children, visual }: { n: number; title: React.ReactNode; children?: React.ReactNode; visual?: React.ReactNode }) {
  return (
    <li className="ig-step">
      <span className="ig-num">{n}</span>
      <div className="ig-text">
        <b>{title}</b>
        {children && <div className="small muted">{children}</div>}
      </div>
      {visual && <div className="ig-visual" aria-hidden>{visual}</div>}
    </li>
  );
}

/* Petites illustrations d'écran : la zone où appuyer est entourée en rouge. */
const SafariBar = () => (
  <div className="mock mock-phone">
    <div className="mock-page" />
    <div className="mock-bar">
      <span>‹</span><span>›</span><span className="mock-hit"><Share size={16} /></span><span>▢</span><span>⧉</span>
    </div>
  </div>
);
const IosSheet = () => (
  <div className="mock mock-phone">
    <div className="mock-sheet">
      <div className="mock-row">Copier</div>
      <div className="mock-row">Ajouter aux favoris</div>
      <div className="mock-row mock-hit">Sur l&apos;écran d&apos;accueil <SquarePlus size={14} /></div>
      <div className="mock-row">Imprimer</div>
    </div>
  </div>
);
const IosAdd = () => (
  <div className="mock mock-phone">
    <div className="mock-top"><span>Annuler</span><span className="mock-hit">Ajouter</span></div>
    <div className="mock-app"><img src="/app-icons/alabella-192.png" alt="" /><span>A la Bella</span></div>
  </div>
);
const ChromeBar = () => (
  <div className="mock mock-phone">
    <div className="mock-top mock-url"><span className="mock-urlbox">pizzeria-fidelite…</span><span className="mock-hit"><MoreVertical size={16} /></span></div>
    <div className="mock-page" />
  </div>
);
const ChromeMenu = () => (
  <div className="mock mock-phone">
    <div className="mock-menu">
      <div className="mock-row">Nouvel onglet</div>
      <div className="mock-row">Historique</div>
      <div className="mock-row mock-hit"><Smartphone size={14} /> Installer l&apos;application</div>
      <div className="mock-row">Paramètres</div>
    </div>
  </div>
);
const HomeIcon = () => (
  <div className="mock mock-phone mock-home">
    {Array.from({ length: 7 }, (_, i) => <span key={i} className="mock-icon" />)}
    <span className="mock-icon mock-icon-app"><img src="/app-icons/alabella-192.png" alt="" /></span>
  </div>
);

export function InstallGuide({ loggedIn }: { loggedIn: boolean }) {
  const pwa = usePwaInstall();
  const [tab, setTab] = useState<Tab>("ios");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (pwa.ready && pwa.platform !== "desktop") setTab(pwa.platform as Exclude<Platform, "desktop">);
    else if (pwa.ready && pwa.canPrompt) setTab("android");
  }, [pwa.ready, pwa.platform, pwa.canPrompt]);

  if (pwa.ready && pwa.installed) {
    return (
      <div className="alert alert-success center">
        <CheckCircle2 size={20} style={{ verticalAlign: "-4px" }} /> L&apos;app est déjà installée sur cet appareil 🎉
        <div style={{ marginTop: 10 }}><Link href="/carte" className="btn btn-primary">Ouvrir ma carte</Link></div>
      </div>
    );
  }

  return (
    <div className="stack">
      {pwa.canPrompt && (
        <div className="card stack center">
          <b>Votre téléphone permet l&apos;installation en un clic :</b>
          <button
            className="btn btn-primary btn-block btn-lg"
            onClick={async () => setDone(await pwa.prompt())}
          >
            <Smartphone size={20} /> Installer maintenant
          </button>
          {done && <div className="alert alert-success small">C&apos;est fait ! Retrouvez l&apos;icône sur votre écran d&apos;accueil.</div>}
        </div>
      )}

      <div className="segmented ig-tabs" role="tablist" aria-label="Type de téléphone">
        <button role="tab" aria-selected={tab === "ios"} className={tab === "ios" ? "is-on" : ""} onClick={() => setTab("ios")}>
          <Apple size={18} /> iPhone
        </button>
        <button role="tab" aria-selected={tab === "android"} className={tab === "android" ? "is-on" : ""} onClick={() => setTab("android")}>
          <Smartphone size={18} /> Android
        </button>
      </div>

      {tab === "ios" ? (
        <section className="card stack" aria-label="Installation sur iPhone">
          {pwa.iosOtherBrowser && (
            <div className="alert alert-info small">
              Vous utilisez Chrome ou un autre navigateur : touchez <Share size={14} style={{ verticalAlign: "-2px" }} /> <b>Partager</b>
              (en haut à droite) puis <b>Sur l&apos;écran d&apos;accueil</b>. Si l&apos;option n&apos;apparaît pas, ouvrez cette page dans <b>Safari</b>.
            </div>
          )}
          <ol className="ig-steps">
            <Step n={1} title={<>Ouvrez ce site dans <span className="ig-chip">Safari</span></>} visual={<SafariBar />}>
              Puis touchez le bouton <Share size={14} style={{ verticalAlign: "-2px" }} /> <b>Partager</b> en bas de l&apos;écran (en haut sur iPad).
            </Step>
            <Step n={2} title={<>Choisissez <span className="ig-chip"><Plus size={13} /> Sur l&apos;écran d&apos;accueil</span></>} visual={<IosSheet />}>
              Faites défiler la liste vers le bas si vous ne le voyez pas.
            </Step>
            <Step n={3} title={<>Touchez <span className="ig-chip">Ajouter</span> en haut à droite</>} visual={<IosAdd />} />
            <Step n={4} title="Ouvrez l'app depuis la nouvelle icône 🍕" visual={<HomeIcon />}>
              Connectez-vous une fois : votre carte s&apos;ouvre ensuite directement.
            </Step>
          </ol>
          <p className="small" style={{ margin: 0 }}>
            <Bell size={14} style={{ verticalAlign: "-2px" }} /> Sur iPhone, les <b>notifications</b> (promos, tampons) ne fonctionnent qu&apos;une fois l&apos;app
            installée : ouvrez-la depuis l&apos;icône puis touchez « Activer les notifications » sur votre carte (iOS 16.4 ou plus récent).
          </p>
        </section>
      ) : (
        <section className="card stack" aria-label="Installation sur Android">
          {pwa.samsung && (
            <div className="alert alert-info small">
              Samsung Internet : touchez le menu <b>≡</b> en bas à droite, puis <b>Ajouter page à</b> → <b>Écran d&apos;accueil</b>.
            </div>
          )}
          <ol className="ig-steps">
            <Step n={1} title={<>Ouvrez ce site dans <span className="ig-chip">Chrome</span></>} visual={<ChromeBar />}>
              Touchez les 3 points <MoreVertical size={14} style={{ verticalAlign: "-2px" }} /> en haut à droite.
            </Step>
            <Step n={2} title={<>Choisissez <span className="ig-chip">Installer l&apos;application</span></>} visual={<ChromeMenu />}>
              Selon le téléphone, l&apos;option s&apos;appelle aussi « Ajouter à l&apos;écran d&apos;accueil ».
            </Step>
            <Step n={3} title={<>Confirmez avec <span className="ig-chip">Installer</span></>} visual={<HomeIcon />}>
              L&apos;icône A la Bella apparaît sur votre écran d&apos;accueil (ou dans la liste des applis).
            </Step>
          </ol>
          <p className="small" style={{ margin: 0 }}>
            <Bell size={14} style={{ verticalAlign: "-2px" }} /> Pensez à <b>activer les notifications</b> sur votre carte pour être prévenu des promos et de vos récompenses.
          </p>
        </section>
      )}

      <div className="row" style={{ justifyContent: "center" }}>
        {loggedIn ? (
          <Link href="/carte" className="btn">Retour à ma carte</Link>
        ) : (
          <>
            <Link href="/inscription" className="btn btn-primary">Créer ma carte</Link>
            <Link href="/connexion" className="btn">J&apos;ai déjà un compte</Link>
          </>
        )}
      </div>
    </div>
  );
}
