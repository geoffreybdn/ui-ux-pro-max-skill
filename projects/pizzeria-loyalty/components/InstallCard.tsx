"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MoreVertical, Plus, Share, Smartphone, X } from "lucide-react";
import { usePwaInstall } from "./usePwaInstall";

type Mode = "hidden" | "prompt" | "ios" | "ios-other" | "manual";

const DISMISS_KEY = "pz-install-dismissed";

/** Propose d'ajouter la carte sur l'écran d'accueil (Android/Chrome : bouton ; iPhone : mode d'emploi). */
export function InstallCard({ force = false }: { force?: boolean }) {
  const pwa = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (!force && localStorage.getItem(DISMISS_KEY)) setDismissed(true);
    } catch {}
  }, [force]);

  const mode: Mode =
    !pwa.ready || pwa.installed || dismissed || pwa.platform === "desktop"
      ? pwa.canPrompt && !pwa.installed && !dismissed ? "prompt" : "hidden"
      : pwa.platform === "ios"
        ? pwa.iosOtherBrowser ? "ios-other" : "ios"
        : pwa.canPrompt ? "prompt" : "manual";

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  }

  async function install() {
    await pwa.prompt();
  }

  if (mode === "hidden") return null;

  return (
    <section className="card install-card" aria-label="Ajouter la carte à l'écran d'accueil">
      <button className="btn btn-ghost btn-sm install-close" onClick={dismiss} aria-label="Masquer">
        <X size={16} />
      </button>
      <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
        <img src="/logo.png" alt="" width={52} height={52} style={{ flex: "none" }} />
        <div>
          <h3 style={{ marginBottom: 4 }}>Votre carte sur l&apos;écran d&apos;accueil</h3>
          <p className="small muted" style={{ margin: 0 }}>
            Ouvrez-la en un geste en caisse, même sans réseau, et recevez les notifications.
          </p>
        </div>
      </div>

      {mode === "prompt" && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={install}>
          <Smartphone size={18} /> Ajouter à l&apos;écran d&apos;accueil
        </button>
      )}

      {mode === "ios" && (
        <ol className="install-steps">
          <li>Touchez <Share size={16} aria-label="Partager" /> <b>Partager</b> en bas de Safari</li>
          <li>Choisissez <Plus size={16} aria-hidden /> <b>Sur l&apos;écran d&apos;accueil</b></li>
          <li>Touchez <b>Ajouter</b>, puis ouvrez la carte depuis la nouvelle icône 🍕</li>
        </ol>
      )}

      {mode === "ios-other" && (
        <p className="small" style={{ marginTop: 12 }}>
          Ouvrez cette page dans <b>Safari</b>, puis <Share size={14} /> Partager → <b>Sur l&apos;écran d&apos;accueil</b>.
        </p>
      )}

      {mode === "manual" && (
        <ol className="install-steps">
          <li>Ouvrez le menu <MoreVertical size={16} aria-label="menu" /> du navigateur</li>
          <li>Choisissez <b>Ajouter à l&apos;écran d&apos;accueil</b> ou <b>Installer l&apos;application</b></li>
        </ol>
      )}
      <Link href="/installer" className="small" style={{ display: "inline-block", marginTop: 10, fontWeight: 700 }}>
        Voir le guide détaillé (iPhone et Android) →
      </Link>
    </section>
  );
}
