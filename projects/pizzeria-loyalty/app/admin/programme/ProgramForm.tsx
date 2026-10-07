"use client";

import { useState } from "react";
import { Bell, Gift, Save, Settings2, Stamp, Users } from "lucide-react";
import { api } from "@/components/useApi";
import type { NotificationKey, Settings } from "@/lib/settings";
import { ruleLabel, stampCols } from "@/lib/program";

type Info = Record<NotificationKey, { label: string; when: string; vars: string }>;

function Num({ label, value, onChange, step = 1, min = 0, suffix, hint }: {
  label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; suffix?: string; hint?: string;
}) {
  return (
    <label>
      {label} {hint && <span className="hint">{hint}</span>}
      <div className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
        <input className="input" type="number" step={step} min={min} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="small muted" style={{ whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>
    </label>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

const RULES: { value: Settings["stamps"]["rule"]; title: string; text: string }[] = [
  { value: "quantity", title: "1 tampon par pizza", text: "L'équipe indique le nombre de pizzas : 3 pizzas = 3 tampons." },
  { value: "visit", title: "1 tampon par passage", text: "Un tampon par commande, quel que soit le nombre de pizzas." },
];

export function ProgramForm({ initial, info }: { initial: Settings; info: Info }) {
  const [s, setS] = useState<Settings>(initial);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  function setStamp<F extends keyof Settings["stamps"]>(field: F, value: Settings["stamps"][F]) {
    setS((prev) => ({ ...prev, stamps: { ...prev.stamps, [field]: value } }));
  }
  function setRef<F extends keyof Settings["referral"]>(field: F, value: Settings["referral"][F]) {
    setS((prev) => ({ ...prev, referral: { ...prev.referral, [field]: value } }));
  }
  function setNotif(k: NotificationKey, patch: Partial<Settings["notifications"][NotificationKey]>) {
    setS((prev) => ({ ...prev, notifications: { ...prev.notifications, [k]: { ...prev.notifications[k], ...patch } } }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ settings: Settings }>("/api/admin/settings", { method: "PUT", body: { settings: s } });
      setS(r.settings);
      setMsg({ kind: "success", text: "Carte enregistrée ✔ — les changements s'appliquent immédiatement." });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const req = Math.min(Math.max(s.stamps.required || 2, 2), 50);

  return (
    <div className="stack" style={{ paddingBottom: 80 }}>
      <h1>Carte à tampons</h1>
      <p className="muted">Paramétrez votre carte de fidélité. Aperçu en direct ci-dessous.</p>

      <section className="panel program-preview" aria-label="Aperçu de la carte">
        <div>
          <div className="small muted">Aperçu client</div>
          <h2 style={{ margin: "4px 0" }}>{req} tampons = {s.stamps.reward}</h2>
          <p className="small muted" style={{ margin: 0 }}>{ruleLabel(s.stamps)}{s.stamps.maxPerVisit > 0 ? ` · max ${s.stamps.maxPerVisit} par passage` : ""}</p>
        </div>
        <div className="stamp-grid" style={{ gridTemplateColumns: `repeat(${stampCols(req)}, 1fr)` }}>
          {Array.from({ length: req }, (_, i) => (
            <span key={i} className={`stamp ${i < Math.min(3, req - 1) ? "stamp-on" : ""} ${i === req - 1 ? "stamp-gift" : ""}`}>
              {i === req - 1 ? "🎁" : i < 3 ? "🍕" : ""}
            </span>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <h2><Settings2 size={20} style={{ verticalAlign: "-3px" }} /> Général</h2>
        <div className="grid">
          <label>Nom de la pizzeria<input className="input" value={s.pizzeriaName} onChange={(e) => set("pizzeriaName", e.target.value)} /></label>
          <label>Ville <span className="hint">(affichée sur la page d&apos;accueil)</span>
            <input className="input" value={s.city} onChange={(e) => set("city", e.target.value)} placeholder="Knutange" />
          </label>
        </div>
      </section>

      <section className="panel stack">
        <h2><Stamp size={20} style={{ verticalAlign: "-3px" }} /> La carte</h2>
        <div className="grid">
          <Num label="Tampons pour la récompense" value={s.stamps.required} min={2} onChange={(v) => setStamp("required", v)} />
          <label>Récompense<input className="input" value={s.stamps.reward} onChange={(e) => setStamp("reward", e.target.value)} placeholder="Pizza offerte" /></label>
        </div>

        <fieldset className="rule-choices">
          <legend>Comment gagner un tampon ?</legend>
          {RULES.map((r) => (
            <label key={r.value} className={`rule-choice ${s.stamps.rule === r.value ? "is-selected" : ""}`}>
              <input type="radio" name="rule" checked={s.stamps.rule === r.value} onChange={() => setStamp("rule", r.value)} />
              <span><b>{r.title}</b><span className="small muted">{r.text}</span></span>
            </label>
          ))}
        </fieldset>

        <div className="grid">
          {s.stamps.rule === "visit" && (
            <Num label="Commande minimum" hint="(0 = aucune)" value={s.stamps.minAmount} step={0.5} onChange={(v) => setStamp("minAmount", v)} suffix="€" />
          )}
          {s.stamps.rule === "quantity" && (
            <label>Produit compté <span className="hint">(au singulier)</span>
              <input className="input" value={s.stamps.unitLabel} onChange={(e) => setStamp("unitLabel", e.target.value)} placeholder="pizza" />
            </label>
          )}
          <Num label="Maximum par passage" hint="(0 = illimité)" value={s.stamps.maxPerVisit} onChange={(v) => setStamp("maxPerVisit", v)} suffix="tampons" />
        </div>
        <p className="small muted" style={{ margin: 0 }}>Pendant une promo « tampons doublés », le nombre de tampons est multiplié automatiquement.</p>
      </section>

      <section className="panel stack">
        <h2><Gift size={20} style={{ verticalAlign: "-3px" }} /> Tampons offerts</h2>
        <div className="grid">
          <Num label="À l'inscription" value={s.welcomeStamps} suffix="tampons" onChange={(v) => set("welcomeStamps", v)} />
        </div>
      </section>

      <section className={`panel stack ${s.referral.enabled ? "" : "section-off"}`}>
        <div className="row between">
          <h2 style={{ margin: 0 }}><Users size={20} style={{ verticalAlign: "-3px" }} /> Parrainage</h2>
          <Switch checked={s.referral.enabled} onChange={(v) => setRef("enabled", v)} label="Activé" />
        </div>
        <div className="grid">
          <Num label="Pour le parrain" value={s.referral.referrerStamps} suffix="tampons" onChange={(v) => setRef("referrerStamps", v)} />
          <Num label="Pour le filleul" value={s.referral.refereeStamps} suffix="tampons" onChange={(v) => setRef("refereeStamps", v)} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>Le filleul saisit le code carte de son parrain (ex. PZ-AB12CD34) à l&apos;inscription.</p>
      </section>

      <section className="panel stack" id="notifications">
        <h2><Bell size={20} style={{ verticalAlign: "-3px" }} /> Notifications automatiques</h2>
        <div className="grid">
          <Num label="Prévenir quand il reste" hint="(0 = jamais)" value={s.nearRewardStamps} suffix="tampon(s)" onChange={(v) => set("nearRewardStamps", v)} />
          <Num label="Relancer après" value={s.inactivityDays} min={7} suffix="jours sans visite" onChange={(v) => set("inactivityDays", v)} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          Variables : {"{prenom}"} {"{tampons}"} {"{total}"} {"{reste}"} {"{gain}"} {"{recompense}"} {"{bonus}"} {"{filleul}"}
        </p>
        {(Object.keys(info) as NotificationKey[]).map((k) => (
          <div className="stack tpl-row" key={k} style={{ gap: 8 }}>
            <div className="row between">
              <Switch checked={s.notifications[k].enabled} onChange={(v) => setNotif(k, { enabled: v })} label={info[k].label} />
              <span className="small muted">{info[k].when}</span>
            </div>
            {k !== "promo" && s.notifications[k].enabled && (
              <div className="grid">
                <label>Titre <span className="hint">{info[k].vars}</span>
                  <input className="input" value={s.notifications[k].title} onChange={(e) => setNotif(k, { title: e.target.value })} />
                </label>
                <label>Message
                  <input className="input" value={s.notifications[k].body} onChange={(e) => setNotif(k, { body: e.target.value })} />
                </label>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="save-bar">
        {msg && <div className={`alert alert-${msg.kind} small`}>{msg.text}</div>}
        <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
          <Save size={18} /> {busy ? "Enregistrement…" : "Enregistrer la carte"}
        </button>
      </div>
    </div>
  );
}
