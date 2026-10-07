"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/components/useApi";
import type { Customer } from "@/lib/db";

const ROLE_LABEL = { customer: "Client", staff: "Équipe (scanner)", admin: "Admin" } as const;

export function Clients({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState("");

  const load = (query = "") =>
    api<{ customers: Customer[] }>(`/api/admin/customers?q=${encodeURIComponent(query)}`)
      .then((r) => setCustomers(r.customers))
      .catch((e) => setError(e.message));
  useEffect(() => { load(initialQuery); }, [initialQuery]);

  async function setRole(c: Customer, role: string) {
    setError("");
    try {
      await api(`/api/admin/customers/${c.id}`, { method: "PATCH", body: { role } });
      load(q);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="stack">
      <h1>Clients</h1>
      <form className="card row" onSubmit={(e) => { e.preventDefault(); load(q); }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, e-mail, téléphone ou code carte" aria-label="Recherche" />
        <button className="btn"><Search size={18} /> Chercher</button>
      </form>
      {error && <div className="alert alert-error">{error}</div>}
      <section className="card table-wrap">
        <table>
          <thead><tr><th>Client</th><th>Carte</th><th>Tampons</th><th>Dernière visite</th><th>Rôle</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}{c.pending && <span className="badge" style={{ marginLeft: 6 }} title="Ancien client importé, pas encore inscrit dans l'app">pas encore inscrit</span>}<div className="small muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div></td>
                <td className="small" style={{ fontFamily: "monospace" }}>{c.card_code}</td>
                <td>
                  <b>{c.stamps}</b> tampon{c.stamps > 1 ? "s" : ""}
                </td>
                <td className="small">{c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString("fr-FR") : "—"}</td>
                <td>
                  <select value={c.role} onChange={(e) => setRole(c, e.target.value)} aria-label={`Rôle de ${c.name}`} style={{ minWidth: 150 }}>
                    {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
