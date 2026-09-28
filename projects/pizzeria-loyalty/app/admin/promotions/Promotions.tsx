"use client";

import { useEffect, useState } from "react";
import { Flame } from "lucide-react";
import { api } from "@/components/useApi";
import type { Promotion } from "@/lib/db";

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

export function Promotions() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({
    title: "Tampons doublés ce week-end 🍕",
    message: "",
    multiplier: "2",
    startsAt: toLocalInput(now),
    endsAt: toLocalInput(new Date(now.getTime() + 2 * 86400_000)),
  });

  const load = () => api<{ promotions: Promotion[] }>("/api/admin/promotions").then((r) => setPromos(r.promotions));
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ notified: number }>("/api/admin/promotions", {
        body: { ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() },
      });
      setMsg({
        kind: "success",
        text: r.notified
          ? `Promotion lancée — ${r.notified} notification(s) envoyée(s).`
          : "Promotion enregistrée. Les clients seront notifiés à son démarrage.",
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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="stack">
      <h1>Promotions</h1>
      <form className="card stack" onSubmit={submit}>
        <h2><Flame size={20} style={{ verticalAlign: "-3px" }} /> Nouvelle promo tampons multipliés</h2>
        {msg && <div className={`alert alert-${msg.kind}`}>{msg.text}</div>}
        <label>Titre (aussi utilisé comme titre de la notification)<input className="input" value={form.title} onChange={set("title")} required /></label>
        <label>
          Message de la notification <span className="hint">(facultatif)</span>
          <textarea rows={2} value={form.message} onChange={set("message")} placeholder="Vos tampons sont doublés tout le week-end !" />
        </label>
        <div className="grid">
          <label>Multiplicateur
            <select value={form.multiplier} onChange={set("multiplier")}>
              <option value="2">x2 — tampons doublés</option>
              <option value="3">x3 — tampons triplés</option>
            </select>
          </label>
          <label>Début<input className="input" type="datetime-local" value={form.startsAt} onChange={set("startsAt")} required /></label>
          <label>Fin<input className="input" type="datetime-local" value={form.endsAt} onChange={set("endsAt")} required /></label>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Envoi…" : "Lancer la promotion et notifier"}</button>
        <p className="small muted">Une promo qui démarre maintenant est notifiée immédiatement ; une promo programmée est notifiée automatiquement à son démarrage.</p>
      </form>

      <section className="card table-wrap">
        <table>
          <thead><tr><th>Promo</th><th>Période</th><th>x</th><th>Statut</th><th /></tr></thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td className="small">
                  {new Date(p.starts_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} →{" "}
                  {new Date(p.ends_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td>x{Number(p.multiplier)}</td>
                <td>{status(p)}</td>
                <td>{p.active && new Date(p.ends_at).getTime() > Date.now() && <button className="btn btn-sm" onClick={() => stop(p.id)}>Arrêter</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
