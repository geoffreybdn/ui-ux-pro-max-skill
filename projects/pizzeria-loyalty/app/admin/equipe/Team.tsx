"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, ScanLine, UserPlus } from "lucide-react";
import { api } from "@/components/useApi";

type Member = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "staff";
  scans_30d: number;
  last_scan_at: string | null;
};

export function Team({ meId }: { meId: number }) {
  const [team, setTeam] = useState<Member[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "admin" });
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<{ team: Member[] }>("/api/admin/team").then((r) => setTeam(r.team));
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ created: boolean }>("/api/admin/team", { body: form });
      setMsg({
        kind: "success",
        text: r.created
          ? `Compte créé pour ${form.email}. Transmettez-lui son mot de passe : il pourra se connecter et scanner.`
          : `${form.email} avait déjà un compte : il est maintenant ${form.role === "admin" ? "administrateur" : "employé"}.`,
      });
      setForm({ name: "", email: "", password: "", role: form.role });
      load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function setRole(m: Member, role: string) {
    if (role === "customer" && !confirm(`Retirer ${m.name} de l'équipe ? Son compte reste un compte client.`)) return;
    setMsg(null);
    try {
      await api(`/api/admin/customers/${m.id}`, { method: "PATCH", body: { role } });
      load();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <div className="stack">
      <h1>Équipe</h1>
      <div className="card small">
        <div className="row"><ShieldCheck size={18} /> <b>Administrateur</b> : scanner + promotions, codes, import, notifications, équipe.</div>
        <div className="row mt" style={{ marginTop: 8 }}><ScanLine size={18} /> <b>Employé</b> : scanner les cartes et valider les récompenses uniquement.</div>
      </div>

      <form className="card stack" onSubmit={submit}>
        <h2><UserPlus size={20} style={{ verticalAlign: "-3px" }} /> Ajouter un membre</h2>
        {msg && <div className={`alert alert-${msg.kind}`}>{msg.text}</div>}
        <div className="grid">
          <label>E-mail<input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Rôle
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="admin">Administrateur</option>
              <option value="staff">Employé (scanner)</option>
            </select>
          </label>
          <label>Nom <span className="hint">(si pas encore inscrit)</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>Mot de passe <span className="hint">(si pas encore inscrit)</span>
            <input className="input" type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          </label>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Ajout…" : "Ajouter à l'équipe"}</button>
        <p className="small muted">Si la personne a déjà un compte client avec cet e-mail, son rôle est simplement mis à jour.</p>
      </form>

      <section className="card table-wrap">
        <table>
          <thead><tr><th>Membre</th><th>Scans (30 j)</th><th>Dernier scan</th><th>Rôle</th></tr></thead>
          <tbody>
            {team.map((m) => (
              <tr key={m.id}>
                <td>{m.name}{m.id === meId && <span className="badge" style={{ marginLeft: 6 }}>vous</span>}<div className="small muted">{m.email}</div></td>
                <td>{m.scans_30d}</td>
                <td className="small">{m.last_scan_at ? new Date(m.last_scan_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}</td>
                <td>
                  {m.id === meId ? (
                    <span className="badge badge-hot">Administrateur</span>
                  ) : (
                    <select value={m.role} onChange={(e) => setRole(m, e.target.value)} aria-label={`Rôle de ${m.name}`} style={{ minWidth: 150 }}>
                      <option value="admin">Administrateur</option>
                      <option value="staff">Employé (scanner)</option>
                      <option value="customer">Retirer de l&apos;équipe</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
