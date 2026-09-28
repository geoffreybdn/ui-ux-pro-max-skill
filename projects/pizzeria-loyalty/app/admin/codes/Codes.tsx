"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { api } from "@/components/useApi";

type Code = { id: number; code: string; bonus_points: number; max_uses: number | null; uses: number; expires_at: string | null; active: boolean };

export function Codes() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [form, setForm] = useState({ code: "", bonusPoints: "1", maxUses: "", expiresAt: "" });
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);

  const load = () => api<{ codes: Code[] }>("/api/admin/codes").then((r) => setCodes(r.codes));
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      const r = await api<{ code: Code }>("/api/admin/codes", {
        body: { ...form, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null },
      });
      setMsg({ kind: "success", text: `Code ${r.code.code} créé.` });
      setForm({ ...form, code: "" });
      load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  }

  async function toggle(c: Code) {
    await api(`/api/admin/codes/${c.id}`, { method: "PATCH", body: { active: !c.active } });
    load();
  }

  const link = (code: string) => `${window.location.origin}/inscription?code=${encodeURIComponent(code)}`;

  return (
    <div className="stack">
      <h1>Codes d&apos;inscription</h1>
      <p className="muted">Donnez un code en boutique (flyer, ticket, affiche) : le client le saisit à l&apos;inscription et reçoit des tampons offerts.</p>
      <form className="card stack" onSubmit={submit}>
        {msg && <div className={`alert alert-${msg.kind}`}>{msg.text}</div>}
        <div className="grid">
          <label>Code <span className="hint">(vide = généré)</span>
            <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BIENVENUE" />
          </label>
          <label>Tampons offerts<input className="input" type="number" min={0} value={form.bonusPoints} onChange={(e) => setForm({ ...form, bonusPoints: e.target.value })} /></label>
          <label>Utilisations max <span className="hint">(vide = illimité)</span>
            <input className="input" type="number" min={1} value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
          </label>
          <label>Expire le <span className="hint">(facultatif)</span>
            <input className="input" type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </label>
        </div>
        <button className="btn btn-primary">Créer le code</button>
      </form>

      <section className="card table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Bonus</th><th>Utilisations</th><th>Expire</th><th /></tr></thead>
          <tbody>
            {codes.map((c) => (
              <tr key={c.id} style={{ opacity: c.active ? 1 : 0.5 }}>
                <td><b>{c.code}</b></td>
                <td>+{c.bonus_points} tampon{c.bonus_points > 1 ? "s" : ""}</td>
                <td>{c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""}</td>
                <td className="small">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("fr-FR") : "—"}</td>
                <td className="row">
                  <button className="btn btn-sm" onClick={() => navigator.clipboard.writeText(link(c.code))} title="Copier le lien d'inscription">
                    <Copy size={14} /> Lien
                  </button>
                  <button className="btn btn-sm" onClick={() => toggle(c)}>{c.active ? "Désactiver" : "Activer"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
