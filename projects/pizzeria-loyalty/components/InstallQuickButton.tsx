"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Smartphone } from "lucide-react";
import { usePwaInstall } from "./usePwaInstall";

/** Bouton flottant « Installer l'app » : installation directe sur Android, sinon guide pas à pas. */
export function InstallQuickButton() {
  const { ready, installed, canPrompt, prompt } = usePwaInstall();
  const path = usePathname();
  if (!ready || installed || path.startsWith("/installer") || path.startsWith("/admin")) return null;

  // Espace réservé en bas de page pour que le bouton flottant ne masque pas le contenu.
  const spacer = <div className="install-fab-spacer" aria-hidden />;
  if (canPrompt) {
    return (
      <>{spacer}<button className="install-fab" onClick={() => prompt()} aria-label="Installer l'application sur mon téléphone">
        <img src="/logo.png" alt="" width={34} height={34} /> <span>Installer l&apos;app</span>
      </button></>
    );
  }
  return (
    <>{spacer}<Link href="/installer" className="install-fab" aria-label="Comment installer l'application sur mon téléphone">
      <img src="/logo.png" alt="" width={34} height={34} /> <span>Installer l&apos;app</span>
      <Smartphone size={16} aria-hidden />
    </Link></>
  );
}
