"use client";

import { useEffect, useState } from "react";
import { Copy, Send, Ticket } from "lucide-react";
import { api } from "@/components/useApi";
import { COUPON_KINDS, WEEKDAYS, couponBenefit, couponConditions, type Coupon, type CouponKind } from "@/lib/program";

type Row = Coupon & { customers: number };

const PRESETS: Record<CouponKind, { title: string; item: string; value: string }> = {
  bogo: { title: "1 pizza achetée = 1 offerte", item: "pizza", value: "0" },
  percent: { title: "-20 % sur votre commande", item: "", value: "20" },
  amount: { title: "5 € de réduction", item: "", value: "5" },
  free_item: { title: "Boisson offerte", item: "Boisson", value: "0" },
  stamps: { title: "2 tampons offerts", item: "", value: "2" },
  custom: { title: "Offre spéciale", item: "", value: "0" },
};

const empty = () => ({
  kind: "bogo" as CouponKind,
  code: "",
  title: PRESETS.bogo.title,
  item: PRESETS.bogo.item,
  value: PRESETS.bogo.value,
  buyQty: "1",
  getQty: "1",
  minAmount: "",
  conditions: "",
  oncePerCustomer: true,
  maxUses: "",
  validDays: [] as number[],
  startsAt: "",
  endsAt: "",
  showInApp: true,
  notify: true,
});

export function Offers() {
  const [rows, setRows] = useState<Row[]>([]);
  const [f, setF] = useState(empty());
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ coupons: Row[] }>("/api/admin/coupons").then((r) => setRows(r.coupons));
  useEffect(() => { load(); }, []);

  const set = <K extends keyof ReturnType<typeof empty>>(k: K, v: ReturnType<typeof empty>[K]) => setF((p) => ({ ...p, [k]: v }));

  function pickKind(kind: CouponKind) {
    setF((p) => ({ ...p, kind, title: PRESETS[kind].title, item: PRESETS[kind].item, value: PRESETS[kind].value }));
  }

  const preview = {
    kind: f.kind, value: Number(f.value.replace(",", ".")) || 0, buy_qty: Number(f.buyQty) || 1, get_qty: Number(f.getQty) || 1,
    item: f.item, title: f.title, min_amount: Number(f.minAmount.replace(",", ".")) || 0,
    valid_days: f.validDays.length ? f.validDays : null, ends_at: f.endsAt ? new Date(f.endsAt).toISOString() : null,
    once_per_customer: f.oncePerCustomer, conditions: f.conditions || null,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ coupon: Row; notified: number }>("/api/admin/coupons", {
        body: {
          ...f,
          startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : undefined,
          endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
        },
      });
      setMsg({
        kind: "success",
        text: `Code ${r.coupon.code} créé.${r.notified ? ` Notification envoyée à ${r.notified} appareil(s).` : ""}`,
      });
      setF(empty());
      load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(c: Row) {
    await api(`/api/admin/coupons/${c.id}`, { method: "PATCH", body: { active: !c.active } });
    load();
  }

  const isExpired = (c: Row) => (c.ends_at && new Date(c.ends_at).getTime() < Date.now()) || (c.max_uses !== null && c.uses >= c.max_uses);

  return (
    <div className="stack">
      <h1>Codes promo</h1>
      <p className="muted">Le client présente le code en caisse (affiche, réseaux sociaux, notification…). L&apos;équipe le valide dans le scanner.</p>

      <form className="panel stack" onSubmit={submit}>
        <h2><Ticket size={20} style={{ verticalAlign: "-3px" }} /> Nouveau code promo</h2>
        {msg && <div className={`alert alert-${msg.kind}`}>{msg.text}</div>}

        <fieldset className="rule-choices">
          <legend>Type d&apos;offre</legend>
          {COUPON_KINDS.map((k) => (
            <label key={k.value} className={`rule-choice ${f.kind === k.value ? "is-selected" : ""}`}>
              <input type="radio" name="kind" checked={f.kind === k.value} onChange={() => pickKind(k.value)} />
              <span><b>{k.label}</b></span>
            </label>
          ))}
        </fieldset>

        <div className="grid">
          <label>Titre de l&apos;offre<input className="input" value={f.title} onChange={(e) => set("title", e.target.value)} required maxLength={80} /></label>
          <label>Code <span className="hint">(vide = généré)</span>
            <input className="input" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="PIZZA2X1" style={{ textTransform: "uppercase" }} />
          </label>
        </div>

        <div className="grid">
          {f.kind === "bogo" && (
            <>
              <label>Achetée(s)<input className="input" type="number" min={1} max={20} value={f.buyQty} onChange={(e) => set("buyQty", e.target.value)} /></label>
              <label>Offerte(s)<input className="input" type="number" min={1} max={20} value={f.getQty} onChange={(e) => set("getQty", e.target.value)} /></label>
              <label>Produit<input className="input" value={f.item} onChange={(e) => set("item", e.target.value)} placeholder="pizza" /></label>
            </>
          )}
          {(f.kind === "percent" || f.kind === "amount") && (
            <>
              <label>{f.kind === "percent" ? "Réduction (%)" : "Réduction (€)"}
                <input className="input" inputMode="decimal" value={f.value} onChange={(e) => set("value", e.target.value)} />
              </label>
              <label>Sur <span className="hint">(vide = toute la commande)</span>
                <input className="input" value={f.item} onChange={(e) => set("item", e.target.value)} placeholder="les pizzas" />
              </label>
            </>
          )}
          {f.kind === "free_item" && (
            <label>Produit offert<input className="input" value={f.item} onChange={(e) => set("item", e.target.value)} placeholder="Boisson" /></label>
          )}
          {f.kind === "stamps" && (
            <label>Tampons offerts <span className="hint">(crédités automatiquement)</span>
              <input className="input" type="number" min={1} max={50} value={f.value} onChange={(e) => set("value", e.target.value)} />
            </label>
          )}
          <label>Commande minimum (€) <span className="hint">(facultatif)</span>
            <input className="input" inputMode="decimal" value={f.minAmount} onChange={(e) => set("minAmount", e.target.value)} placeholder="0" />
          </label>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <span style={{ fontWeight: 700 }}>Jours de validité <span className="hint">(aucun coché = tous les jours)</span></span>
          <div className="day-picks">
            {WEEKDAYS.map((d, i) => (
              <label key={d} className={`day-pick ${f.validDays.includes(i + 1) ? "is-on" : ""}`}>
                <input
                  type="checkbox"
                  checked={f.validDays.includes(i + 1)}
                  onChange={(e) => set("validDays", e.target.checked ? [...f.validDays, i + 1] : f.validDays.filter((x) => x !== i + 1))}
                />
                {d.slice(0, 3)}
              </label>
            ))}
          </div>
        </div>

        <div className="grid">
          <label>Début <span className="hint">(vide = maintenant)</span><input className="input" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></label>
          <label>Fin <span className="hint">(vide = sans limite)</span><input className="input" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></label>
          <label>Utilisations max au total <span className="hint">(vide = illimité)</span>
            <input className="input" type="number" min={1} value={f.maxUses} onChange={(e) => set("maxUses", e.target.value)} />
          </label>
        </div>

        <label>Conditions supplémentaires <span className="hint">(facultatif, affiché au client)</span>
          <input className="input" value={f.conditions} onChange={(e) => set("conditions", e.target.value)} placeholder="Sur place ou à emporter, hors menu midi" maxLength={160} />
        </label>

        <div className="stack" style={{ gap: 10 }}>
          <label className="switch"><input type="checkbox" checked={f.oncePerCustomer} onChange={(e) => set("oncePerCustomer", e.target.checked)} /> 1 seule utilisation par client</label>
          <label className="switch"><input type="checkbox" checked={f.showInApp} onChange={(e) => set("showInApp", e.target.checked)} /> Afficher l&apos;offre dans l&apos;app des clients</label>
          {f.showInApp && (
            <label className="switch"><input type="checkbox" checked={f.notify} onChange={(e) => set("notify", e.target.checked)} /> Prévenir les clients par notification</label>
          )}
        </div>

        <div className="coupon-preview" aria-label="Aperçu">
          <div className="coupon-code">{f.code || "PROMO••••"}</div>
          <div>
            <b>{f.title}</b>
            <div className="small">{couponBenefit(preview)}</div>
            <div className="small muted">{couponConditions(preview)}</div>
          </div>
        </div>

        <button className="btn btn-primary" disabled={busy}>{busy ? "Création…" : "Créer le code promo"}</button>
      </form>

      <section className="panel table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Offre</th><th>Utilisations</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                <td>
                  <b style={{ fontFamily: "ui-monospace, monospace" }}>{c.code}</b>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(c.code)} aria-label="Copier le code"><Copy size={14} /></button>
                </td>
                <td>
                  <b>{c.title}</b>
                  <div className="small">{couponBenefit(c)}</div>
                  <div className="small muted">{couponConditions(c)}</div>
                </td>
                <td>{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}<div className="small muted">{c.customers} client(s)</div></td>
                <td>
                  {!c.active ? <span className="badge">Désactivé</span> : isExpired(c) ? <span className="badge">Terminé</span> : <span className="badge badge-ok">Actif</span>}
                  {c.show_in_app && <div className="small muted"><Send size={12} /> dans l&apos;app</div>}
                </td>
                <td><button className="btn btn-sm" onClick={() => toggle(c)}>{c.active ? "Désactiver" : "Activer"}</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted small">Aucun code promo pour l&apos;instant.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
