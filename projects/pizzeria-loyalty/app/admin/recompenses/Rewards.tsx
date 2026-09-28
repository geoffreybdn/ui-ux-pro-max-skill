"use client";

import { useEffect, useState } from "react";
import { api } from "@/components/useApi";
import type { Reward } from "@/lib/db";

export function Rewards() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [form, setForm] = useState({ name: "", cost: "" });
  const [error, setError] = useState("");

  const load = () => api<{ rewards: Reward[] }>("/api/admin/rewards").then((r) => setRewards(r.rewards));
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api("/api/admin/rewards", { body: form });
      setForm({ name: "", cost: "" });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggle(r: Reward) {
    await api(`/api/admin/rewards/${r.id}`, { method: "PATCH", body: { active: !r.active } });
    load();
  }

  return (
    <div className="stack">
      <h1>Récompenses</h1>
      <form className="card row" onSubmit={submit}>
        {error && <div className="alert alert-error" style={{ width: "100%" }}>{error}</div>}
        <label style={{ flex: 2, minWidth: 180 }}>Récompense<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pizza offerte" required /></label>
        <label style={{ flex: 1, minWidth: 120 }}>Coût (points)<input className="input" type="number" min={1} value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} required /></label>
        <button className="btn btn-primary" style={{ alignSelf: "flex-end" }}>Ajouter</button>
      </form>
      <section className="card table-wrap">
        <table>
          <thead><tr><th>Récompense</th><th>Points</th><th /></tr></thead>
          <tbody>
            {rewards.map((r) => (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                <td>{r.name}</td>
                <td>{r.cost}</td>
                <td><button className="btn btn-sm" onClick={() => toggle(r)}>{r.active ? "Masquer" : "Réactiver"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
