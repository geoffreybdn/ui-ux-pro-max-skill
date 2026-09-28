"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { api } from "@/components/useApi";

export function Notifications() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("Envoyer cette notification à tous les clients abonnés ?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ sent: number }>("/api/admin/notify", { body: { title, body } });
      setMsg({ kind: "success", text: `Notification envoyée à ${r.sent} appareil(s).` });
      setTitle("");
      setBody("");
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>Notifications</h1>
      <div className="card small">
        <b>Envoyées automatiquement :</b>
        <ul style={{ margin: "8px 0 0" }}>
          <li>Points crédités après chaque passage en caisse</li>
          <li>Récompense débloquée</li>
          <li>Démarrage d&apos;une promotion (double points…)</li>
          <li>Anciens points récupérés après l&apos;import CSV</li>
          <li>Relance des clients inactifs (une fois par jour, via le cron Vercel)</li>
        </ul>
      </div>
      <form className="card stack" onSubmit={submit}>
        <h2>Message manuel</h2>
        {msg && <div className={`alert alert-${msg.kind}`}>{msg.text}</div>}
        <label>Titre<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required placeholder="Nouvelle pizza du mois 🍕" /></label>
        <label>Message<textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={180} required placeholder="Venez goûter la Tartufata, disponible jusqu'à dimanche !" /></label>
        <button className="btn btn-primary" disabled={busy}><Send size={18} /> {busy ? "Envoi…" : "Envoyer à tous"}</button>
      </form>
    </div>
  );
}
