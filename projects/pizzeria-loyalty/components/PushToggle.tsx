"use client";

import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { usePush } from "./usePush";

/** Réglage des notifications dans « Mon profil » : état actuel + activer / désactiver. */
export function PushToggle() {
  const { state, busy, enable, disable } = usePush();
  if (state === "loading") return null;

  let status: React.ReactNode;
  let action: React.ReactNode = null;
  if (state === "on") {
    status = <>✅ Activées sur cet appareil</>;
    action = <button className="btn btn-sm" onClick={disable} disabled={busy}><BellOff size={16} /> Désactiver</button>;
  } else if (state === "off") {
    status = <>Désactivées</>;
    action = <button className="btn btn-sm btn-primary" onClick={enable} disabled={busy}><Bell size={16} /> Activer</button>;
  } else if (state === "ios-install") {
    status = <>Sur iPhone, installez d&apos;abord l&apos;app sur l&apos;écran d&apos;accueil.</>;
    action = <Link className="btn btn-sm" href="/installer">Voir comment</Link>;
  } else if (state === "denied") {
    status = <>Bloquées : autorisez-les dans les réglages du navigateur (icône 🔒 à côté de l&apos;adresse) ou du téléphone.</>;
  } else {
    status = <>Non disponibles sur ce navigateur.</>;
  }

  return (
    <div className="push-setting">
      <div>
        <b>Notifications</b>
        <div className="small muted">{status}</div>
      </div>
      {action}
    </div>
  );
}
