"use client";

import { useState } from "react";
import { Bell, Cake, Coins, Crown, Gift, Save, Settings2, Stamp, Users } from "lucide-react";
import { api } from "@/components/useApi";
import type { NotificationKey, Settings } from "@/lib/settings";

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

export function ProgramForm({ initial, info }: { initial: Settings; info: Info }) {
  const [s, setS] = useState<Settings>(initial);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Mise à jour immuable d'un chemin (ex. set("stamps", "required", 8))
  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }
  function setIn<K extends keyof Settings, F extends keyof Settings[K]>(key: K, field: F, value: Settings[K][F]) {
    setS((prev) => ({ ...prev, [key]: { ...(prev[key] as object), [field]: value } }));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ settings: Settings }>("/api/admin/settings", { method: "PUT", body: { settings: s } });
      setS(r.settings);
      setMsg({ kind: "success", text: "Programme enregistré ✔ — les changements s'appliquent immédiatement." });
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const levels = s.tiers.levels;

  return (
    <div className="stack" style={{ paddingBottom: 80 }}>
      <h1>Programme de fidélité</h1>
      <p className="muted">Choisissez comment vos clients sont récompensés. Vous pouvez combiner points, tampons et cashback.</p>

      <section className="card stack">
        <h2><Settings2 size={20} style={{ verticalAlign: "-3px" }} /> Général</h2>
        <label>Nom de la pizzeria<input className="input" value={s.pizzeriaName} onChange={(e) => set("pizzeriaName", e.target.value)} /></label>
      </section>

      <section className={`card stack ${s.points.enabled ? "" : "section-off"}`}>
        <div className="row between">
          <h2 style={{ margin: 0 }}><Gift size={20} style={{ verticalAlign: "-3px" }} /> Points</h2>
          <Switch checked={s.points.enabled} onChange={(v) => setIn("points", "enabled", v)} label="Activé" />
        </div>
        <div className="grid">
          <Num label="Points par euro" value={s.points.perEuro} step={0.5} onChange={(v) => setIn("points", "perEuro", v)} />
          <Num label="Alerte « récompense proche »" hint="(0 = désactivée)" value={s.nearRewardPoints} onChange={(v) => set("nearRewardPoints", v)} suffix="points avant" />
        </div>
        <p className="small muted" style={{ margin: 0 }}>Les récompenses échangeables se gèrent dans <a href="/admin/recompenses">Récompenses</a>.</p>
      </section>

      <section className={`card stack ${s.stamps.enabled ? "" : "section-off"}`}>
        <div className="row between">
          <h2 style={{ margin: 0 }}><Stamp size={20} style={{ verticalAlign: "-3px" }} /> Carte à tampons</h2>
          <Switch checked={s.stamps.enabled} onChange={(v) => setIn("stamps", "enabled", v)} label="Activée" />
        </div>
        <div className="grid">
          <Num label="Tampons pour la récompense" value={s.stamps.required} min={2} onChange={(v) => setIn("stamps", "required", v)} />
          <Num label="Commande minimum" value={s.stamps.minAmount} step={0.5} onChange={(v) => setIn("stamps", "minAmount", v)} suffix="€ / tampon" />
          <label>Récompense<input className="input" value={s.stamps.reward} onChange={(e) => setIn("stamps", "reward", e.target.value)} /></label>
        </div>
        <p className="small muted" style={{ margin: 0 }}>1 tampon par commande (2 pendant une promo x2).</p>
      </section>

      <section className={`card stack ${s.cashback.enabled ? "" : "section-off"}`}>
        <div className="row between">
          <h2 style={{ margin: 0 }}><Coins size={20} style={{ verticalAlign: "-3px" }} /> Cashback</h2>
          <Switch checked={s.cashback.enabled} onChange={(v) => setIn("cashback", "enabled", v)} label="Activé" />
        </div>
        <div className="grid">
          <Num label="Pourcentage reversé" value={s.cashback.percent} step={0.5} onChange={(v) => setIn("cashback", "percent", v)} suffix="%" />
          <Num label="Utilisable à partir de" value={s.cashback.minRedeem} step={0.5} onChange={(v) => setIn("cashback", "minRedeem", v)} suffix="€" />
        </div>
      </section>

      <section className={`card stack ${s.tiers.enabled ? "" : "section-off"}`}>
        <div className="row between">
          <h2 style={{ margin: 0 }}><Crown size={20} style={{ verticalAlign: "-3px" }} /> Niveaux VIP</h2>
          <Switch checked={s.tiers.enabled} onChange={(v) => setIn("tiers", "enabled", v)} label="Activés" />
        </div>
        <p className="small muted" style={{ margin: 0 }}>Basés sur le total de points cumulés. Le multiplicateur s&apos;applique aux points et au cashback.</p>
        {levels.map((t, i) => (
          <div className="grid" key={i} style={{ alignItems: "end" }}>
            <label>Niveau {i + 1}
              <input className="input" value={t.name} onChange={(e) => setIn("tiers", "levels", levels.map((l, j) => (j === i ? { ...l, name: e.target.value } : l)))} />
            </label>
            <Num label="À partir de" value={t.min} suffix="pts cumulés" onChange={(v) => setIn("tiers", "levels", levels.map((l, j) => (j === i ? { ...l, min: i === 0 ? 0 : v } : l)))} />
            <Num label="Multiplicateur" value={t.multiplier} step={0.05} min={1} onChange={(v) => setIn("tiers", "levels", levels.map((l, j) => (j === i ? { ...l, multiplier: v } : l)))} />
            <div className="row">
              {i > 0 && (
                <button type="button" className="btn btn-sm" onClick={() => setIn("tiers", "levels", levels.filter((_, j) => j !== i))}>Supprimer</button>
              )}
            </div>
          </div>
        ))}
        {levels.length < 5 && (
          <button
            type="button"
            className="btn btn-sm"
            style={{ width: "fit-content" }}
            onClick={() => setIn("tiers", "levels", [...levels, { name: "Platine", min: (levels.at(-1)?.min ?? 0) + 500, multiplier: 1.5 }])}
          >
            + Ajouter un niveau
          </button>
        )}
      </section>

      <section className="card stack">
        <h2><Cake size={20} style={{ verticalAlign: "-3px" }} /> Bonus automatiques</h2>
        <div className="grid">
          <Num label="Bienvenue (à l'inscription)" value={s.welcomeBonus} suffix="points" onChange={(v) => set("welcomeBonus", v)} />
          <Num label="Anniversaire" value={s.birthdayBonus} suffix="points" onChange={(v) => set("birthdayBonus", v)} />
          <Num label="Relance après" value={s.inactivityDays} min={7} suffix="jours sans visite" onChange={(v) => set("inactivityDays", v)} />
        </div>
      </section>

      <section className={`card stack ${s.referral.enabled ? "" : "section-off"}`}>
        <div className="row between">
          <h2 style={{ margin: 0 }}><Users size={20} style={{ verticalAlign: "-3px" }} /> Parrainage</h2>
          <Switch checked={s.referral.enabled} onChange={(v) => setIn("referral", "enabled", v)} label="Activé" />
        </div>
        <div className="grid">
          <Num label="Pour le parrain" value={s.referral.referrerBonus} suffix="points" onChange={(v) => setIn("referral", "referrerBonus", v)} />
          <Num label="Pour le filleul" value={s.referral.refereeBonus} suffix="points" onChange={(v) => setIn("referral", "refereeBonus", v)} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>Le filleul saisit le code carte de son parrain (ex. PZ-AB12CD34) à l&apos;inscription.</p>
      </section>

      <section className="card stack" id="notifications">
        <h2><Bell size={20} style={{ verticalAlign: "-3px" }} /> Notifications automatiques</h2>
        <p className="small muted" style={{ margin: 0 }}>
          Variables utilisables : {"{prenom}"} {"{solde}"} {"{gain}"} {"{recompense}"} {"{reste}"} {"{bonus}"} {"{niveau}"} {"{filleul}"}
        </p>
        {(Object.keys(info) as NotificationKey[]).map((k) => (
          <div className="stack tpl-row" key={k} style={{ gap: 8 }}>
            <div className="row between">
              <Switch
                checked={s.notifications[k].enabled}
                onChange={(v) => set("notifications", { ...s.notifications, [k]: { ...s.notifications[k], enabled: v } })}
                label={info[k].label}
              />
              <span className="small muted">{info[k].when}</span>
            </div>
            {k !== "promo" && s.notifications[k].enabled && (
              <div className="grid">
                <label>Titre <span className="hint">{info[k].vars}</span>
                  <input className="input" value={s.notifications[k].title}
                    onChange={(e) => set("notifications", { ...s.notifications, [k]: { ...s.notifications[k], title: e.target.value } })} />
                </label>
                <label>Message
                  <input className="input" value={s.notifications[k].body}
                    onChange={(e) => set("notifications", { ...s.notifications, [k]: { ...s.notifications[k], body: e.target.value } })} />
                </label>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="save-bar">
        {msg && <div className={`alert alert-${msg.kind} small`}>{msg.text}</div>}
        <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
          <Save size={18} /> {busy ? "Enregistrement…" : "Enregistrer le programme"}
        </button>
      </div>
    </div>
  );
}
