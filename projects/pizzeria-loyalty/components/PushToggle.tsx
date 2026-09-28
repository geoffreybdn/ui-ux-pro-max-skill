"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Share } from "lucide-react";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState(isIOS && !standalone ? "ios-install" : "unsupported");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Resynchronise l'abonnement (utile si l'utilisateur a changé de compte)
        fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
        setState("on");
      } else setState("off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Clé VAPID manquante");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error();
      setState("on");
    } catch {
      alert("Impossible d'activer les notifications sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setState("off");
    setBusy(false);
  }

  if (state === "loading") return null;
  if (state === "ios-install")
    return (
      <div className="alert alert-info small">
        <Share size={16} style={{ verticalAlign: "middle" }} /> Sur iPhone : touchez <b>Partager</b> puis{" "}
        <b>Sur l&apos;écran d&apos;accueil</b>, ouvrez l&apos;app depuis l&apos;icône, puis activez les notifications.
      </div>
    );
  if (state === "unsupported")
    return <p className="small muted">Les notifications ne sont pas disponibles sur ce navigateur.</p>;
  if (state === "denied")
    return <p className="small muted">Notifications bloquées : autorisez-les dans les réglages du navigateur.</p>;

  return state === "on" ? (
    <button className="btn btn-sm" onClick={disable} disabled={busy}>
      <BellOff size={16} /> Désactiver les notifications
    </button>
  ) : (
    <button className="btn btn-gold btn-block" onClick={enable} disabled={busy}>
      <Bell size={18} /> Activer les notifications (promos & tampons)
    </button>
  );
}
