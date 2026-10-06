"use client";

import { useCallback, useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export type Platform = "ios" | "android" | "desktop";

// L'invite d'installation Android/Chrome n'est émise qu'une fois par page : on la garde ici pour tous les composants.
let deferred: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function detectPlatform(ua: string): Platform {
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== "undefined" && navigator.maxTouchPoints > 1)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export function usePwaInstall() {
  const [, force] = useState(0);
  const [info, setInfo] = useState<{ ready: boolean; platform: Platform; standalone: boolean; iosOtherBrowser: boolean; samsung: boolean }>({
    ready: false,
    platform: "desktop",
    standalone: false,
    iosOtherBrowser: false,
    samsung: false,
  });

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInfo({
      ready: true,
      platform: detectPlatform(ua),
      standalone,
      iosOtherBrowser: /crios|fxios|edgios/i.test(ua),
      samsung: /samsungbrowser/i.test(ua),
    });
    // Le service worker est nécessaire pour que Chrome propose l'installation
    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);

  const prompt = useCallback(async () => {
    if (!deferred) return false;
    const ev = deferred;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred = null;
    if (outcome === "accepted") installed = true;
    emit();
    return outcome === "accepted";
  }, []);

  return { ...info, installed: installed || info.standalone, canPrompt: Boolean(deferred), prompt };
}
