"use client";

import { useCallback, useEffect, useState } from "react";

export type PushState = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Les composants qui affichent l'état des notifications (invitation + profil) restent synchronisés.
const listeners = new Set<(s: PushState) => void>();
let current: PushState = "loading";
function publish(s: PushState) {
  current = s;
  listeners.forEach((l) => l(s));
}

let detecting: Promise<void> | null = null;
function detect() {
  detecting ??= (async () => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return publish(isIOS && !standalone ? "ios-install" : "unsupported");
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    if (Notification.permission === "denied") return publish("denied");
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      // Resynchronise l'abonnement (utile si l'utilisateur a changé de compte)
      fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      publish("on");
    } else publish("off");
  })().catch(() => publish("unsupported"));
  return detecting;
}

/** État et actions des notifications push du client (abonnement Web Push). */
export function usePush() {
  const [state, setState] = useState<PushState>(current);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listeners.add(setState);
    setState(current);
    detect();
    return () => void listeners.delete(setState);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("Clé VAPID manquante");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return publish(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error();
      publish("on");
    } catch {
      alert("Impossible d'activer les notifications sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
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
      publish("off");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable };
}
