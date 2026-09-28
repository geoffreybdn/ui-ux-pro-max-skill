"use client";

import { useEffect, useState } from "react";
import { MoreVertical, Plus, Share, Smartphone, X } from "lucide-react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Mode = "hidden" | "prompt" | "ios" | "ios-other" | "manual";

const DISMISS_KEY = "pz-install-dismissed";

/** Propose d'ajouter la carte sur l'écran d'accueil (Android/Chrome : bouton ; iPhone : mode d'emploi). */
export function InstallCard({ force = false }: { force?: boolean }) {
  const [mode, setMode] = useState<Mode>("hidden");
  const [promptEvent, setPromptEvent] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;
    try {
      if (!force && localStorage.getItem(DISMISS_KEY)) return;
    } catch {}

    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
    if (isIOS) {
      // Sur iPhone, seul Safari (ou iOS 16.4+ pour les autres navigateurs via Partager) permet l'ajout
      setMode(/crios|fxios|edgios/i.test(ua) ? "ios-other" : "ios");
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPrompt);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    // Navigateur sans invite automatique (Firefox, Samsung…) : instructions génériques
    const t = setTimeout(() => setMode((m) => (m === "hidden" && /android/i.test(ua) ? "manual" : m)), 2500);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, [force]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setMode("hidden");
  }

  async function install() {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") setMode("hidden");
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
    </section>
  );
}
