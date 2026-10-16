"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Flame, MapPin, Truck } from "lucide-react";
import { api } from "@/components/useApi";
import type { Promotion } from "@/lib/db";
import { PROMO_CHANNELS, PROMO_KINDS, channelLabel, promoBenefit, promoNotificationBody, type PromoChannel, type PromoKind } from "@/lib/program";

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function status(p: Promotion) {
  const now = Date.now();
  if (!p.active) return <span className="badge">Arrêtée</span>;
  if (new Date(p.starts_at).getTime() > now) return <span className="badge">Programmée</span>;
  if (new Date(p.ends_at).getTime() < now) return <span className="badge">Terminée</span>;
  return <span className="badge badge-hot">En cours</span>;
}

const fmt = (d: string) => new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

/** Préréglages en un clic. */
const PRESETS: { label: string; values: Partial<Form> }[] = [
  { label: "1 achetée = 1 offerte (livraison)", values: { kind: "bogo", channel: "delivery", buyQty: "1", getQty: "1", item: "pizza", title: "1 pizza achetée = 1 offerte en livraison 🛵" } },
  { label: "1 achetée = 1 offerte (sur place)", values: { kind: "bogo", channel: "onsite", buyQty: "1", getQty: "1", item: "pizza", title: "1 pizza achetée = 1 offerte sur place 🍕" } },
  { label: "2 achetées = 1 offerte", values: { kind: "bogo", channel: "all", buyQty: "2", getQty: "1", item: "pizza", title: "2 pizzas achetées = la 3e offerte 🍕" } },
  { label: "-20 % en livraison", values: { kind: "percent", channel: "delivery", value: "20", item: "", title: "-20 % sur votre commande en livraison 🛵" } },
  { label: "Tampons doublés", values: { kind: "stamps", multiplier: "2", title: "Tampons doublés ce week-end 🔥" } },
];

type Form = {
  kind: PromoKind; channel: PromoChannel; title: string; message: string; multiplier: string;
  value: string; buyQty: string; getQty: string; item: string; conditions: string; startsAt: string; endsAt: string;
};

export function Promotions() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>(() => {
    const now = new Date();
    return {
      kind: "bogo", channel: "delivery", title: "1 pizza achetée = 1 offerte en livraison 🛵", message: "", multiplier: "2",
      value: "10", buyQty: "1", getQty: "1", item: "pizza", conditions: "",
      startsAt: toLocalInput(now), endsAt: toLocalInput(new Date(now.getTime() + 3 * 86400_000)),
    };
  });

  const load = () => api<{ promotions: Promotion[] }>("/api/admin/promotions").then((r) => setPromos(r.promotions));
  useEffect(() => { load(); }, []);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const preview = useMemo(() => {
    const p = {
      kind: form.kind, channel: form.channel, value: form.value, buy_qty: Number(form.buyQty) || 1, get_qty: Number(form.getQty) || 1,
      item: form.item, title: form.title, multiplier: form.multiplier, ends_at: form.endsAt ? new Date(form.endsAt) : new Date(),
    };
    return { benefit: promoBenefit(p), body: form.message || promoNotificationBody(p) };
  }, [form]);

  const startsNow = new Date(form.startsAt).getTime() <= Date.now() + 60_000;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ notified: number; started: boolean }>("/api/admin/promotions", {
        body: { ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() },
      });
      setMsg({
        kind: "success",
        text: r.started
          ? `Promotion lancée — notification envoyée à ${r.notified} appareil(s).`
          : `Promotion programmée : les clients seront notifiés automatiquement le ${fmt(new Date(form.startsAt).toISOString())}.`,
      });
      load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function stop(id: number) {
    if (!confirm("Arrêter cette promotion ?")) return;
    await api(`/api/admin/promotions/${id}`, { method: "DELETE" });
    load();
  }

  const isOffer = form.kind !== "stamps";

  return (
    <div className="stack">
      <h1>Promotions</h1>
      <form className="card stack" onSubmit={submit}>
        <h2><Flame size={20} style={{ verticalAlign: "-3px" }} /> Nouvelle promotion</h2>
        {msg && <div className={`alert alert-${msg.kind}`} role="status">{msg.text}</div>}

        <div className="promo-presets" aria-label="Modèles rapides">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="btn btn-sm" onClick={() => setForm((f) => ({ ...f, ...p.values }))}>{p.label}</button>
          ))}
        </div>

        <div className="grid">
          <label>Type de promotion
            <select value={form.kind} onChange={set("kind")}>
              {PROMO_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          {form.kind === "stamps" && (
            <label>Multiplicateur
              <select value={form.multiplier} onChange={set("multiplier")}>
                <option value="2">x2 — tampons doublés</option>
                <option value="3">x3 — tampons triplés</option>
              </select>
            </label>
          )}
          {form.kind === "bogo" && (
            <>
              <label>Achetée(s)<input className="input" type="number" min={1} max={20} value={form.buyQty} onChange={set("buyQty")} required /></label>
              <label>Offerte(s)<input className="input" type="number" min={1} max={20} value={form.getQty} onChange={set("getQty")} required /></label>
            </>
          )}
          {form.kind === "percent" && <label>Réduction (%)<input className="input" type="number" min={1} max={100} value={form.value} onChange={set("value")} required /></label>}
          {form.kind === "amount" && <label>Réduction (€)<input className="input" type="number" min={0.5} step={0.5} max={500} value={form.value} onChange={set("value")} required /></label>}
          {isOffer && form.kind !== "custom" && (
            <label>Produit <span className="hint">{form.kind === "percent" || form.kind === "amount" ? "(vide = toute la commande)" : ""}</span>
              <input className="input" value={form.item} onChange={set("item")} placeholder="pizza" required={form.kind === "bogo" || form.kind === "free_item"} />
            </label>
          )}
        </div>

        {isOffer && (
          <fieldset className="promo-channels">
            <legend>Où la promo est valable</legend>
            {PROMO_CHANNELS.map((c) => (
              <label key={c.value} className={`promo-channel ${form.channel === c.value ? "is-on" : ""}`}>
                <input type="radio" name="channel" value={c.value} checked={form.channel === c.value} onChange={set("channel")} />
                {c.value === "delivery" ? <Truck size={18} /> : c.value === "onsite" ? <MapPin size={18} /> : <Flame size={18} />} {c.label}
              </label>
            ))}
          </fieldset>
        )}

        <div className="grid">
          <label>Date de lancement<input className="input" type="datetime-local" value={form.startsAt} onChange={set("startsAt")} required /></label>
          <label>Date limite<input className="input" type="datetime-local" value={form.endsAt} onChange={set("endsAt")} required /></label>
        </div>

        <label>Titre (affiché aux clients et titre de la notification)<input className="input" value={form.title} onChange={set("title")} maxLength={80} required /></label>
        {isOffer && (
          <label>Conditions <span className="hint">(facultatif)</span>
            <input className="input" value={form.conditions} onChange={set("conditions")} placeholder="Hors boissons · sur la moins chère" maxLength={200} />
          </label>
        )}
        <label>
          Message de la notification <span className="hint">(facultatif — sinon le texte ci-dessous)</span>
          <textarea rows={2} value={form.message} onChange={set("message")} maxLength={200} placeholder={preview.body} />
        </label>

        <div className="notif-preview" aria-label="Aperçu de la notification">
          <img src="/app-icons/alabella-192.png" alt="" width={36} height={36} />
          <div><b>{form.title || "Titre"}</b><div className="small">{preview.body}</div></div>
        </div>

        <button className="btn btn-primary" disabled={busy}>
          <Bell size={18} /> {busy ? "Envoi…" : startsNow ? "Lancer maintenant et notifier les clients" : "Programmer la promotion"}
        </button>
        <p className="small muted" style={{ margin: 0 }}>
          {startsNow
            ? "La notification part tout de suite à tous les clients abonnés."
            : "La notification partira automatiquement à la date de lancement. La promo disparaît d'elle-même à la date limite."}
        </p>
      </form>

      <section className="card table-wrap">
        <table>
          <thead><tr><th>Promo</th><th>Où</th><th>Période</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td><b>{p.title}</b><div className="small muted">{promoBenefit(p)}</div></td>
                <td className="small">{p.kind === "stamps" ? "En caisse" : channelLabel(p.channel)}</td>
                <td className="small">{fmt(p.starts_at)} →<br />{fmt(p.ends_at)}</td>
                <td>{status(p)}{p.notified_at && <div className="small muted">🔔 notifiée</div>}</td>
                <td>{p.active && new Date(p.ends_at).getTime() > Date.now() && <button className="btn btn-sm" onClick={() => stop(p.id)}>Arrêter</button>}</td>
              </tr>
            ))}
            {promos.length === 0 && <tr><td colSpan={5} className="muted small">Aucune promotion pour l&apos;instant.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
