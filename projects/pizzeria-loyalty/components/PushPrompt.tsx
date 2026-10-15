"use client";

import { useEffect, useState } from "react";
import { Bell, Flame, Gift, Stamp } from "lucide-react";
import { usePush } from "./usePush";

const SNOOZE_KEY = "pz-push-snooze";
const SNOOZE_DAYS = 7;

/**
 * Invitation à activer les notifications, placée juste sous la carte (là où le client regarde),
 * avec les bénéfices concrets. N'apparaît que si l'activation est possible ; « Plus tard » la masque 7 jours.
 * Le réglage permanent (activer / désactiver) est dans « Mon profil ».
 */
export function PushPrompt({ remaining, reward, force = false }: { remaining: number; reward: string; force?: boolean }) {
  const { state, busy, enable } = usePush();
  const [snoozed, setSnoozed] = useState(true);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      setSnoozed(!force && until > Date.now());
    } catch {
      setSnoozed(false);
    }
  }, [force]);

  function later() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 86400_000));
    } catch {}
    setSnoozed(true);
  }

  if (state !== "off" || snoozed) return null;

  return (
    <section className="card push-prompt" aria-label="Activer les notifications">
      <div className="push-prompt-head">
        <span className="push-prompt-icon" aria-hidden><Bell size={22} /></span>
        <div>
          <h3 style={{ margin: 0 }}>Ne ratez pas votre {reward.toLowerCase()} 🍕</h3>
          <p className="small muted" style={{ margin: "2px 0 0" }}>
            {remaining > 0 ? `Plus que ${remaining} tampon${remaining > 1 ? "s" : ""} : on vous prévient au bon moment.` : "On vous prévient dès qu'il y a du nouveau."}
          </p>
        </div>
      </div>
      <ul className="push-prompt-list small">
        <li><Stamp size={15} aria-hidden /> Chaque tampon ajouté sur votre carte</li>
        <li><Gift size={15} aria-hidden /> Quand votre cadeau est prêt</li>
        <li><Flame size={15} aria-hidden /> Les promos et tampons doublés</li>
      </ul>
      <div className="push-prompt-actions">
        <button className="btn btn-primary" onClick={enable} disabled={busy}>
          <Bell size={18} /> {busy ? "Activation…" : "Activer les notifications"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={later}>Plus tard</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>Pas de spam : seulement votre carte et nos offres. Désactivable dans « Mon profil ».</p>
    </section>
  );
}
