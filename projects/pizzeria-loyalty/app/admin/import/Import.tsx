"use client";

import { useState } from "react";
import { FileUp } from "lucide-react";
import { api } from "@/components/useApi";

type Preview = { preview: { email: string; name: string | null; stamps: number }[]; total: number; errors: string[] };
type Result = { imported: number; createdAccounts: number; creditedAccounts: number; errors: string[] };

const SAMPLE = "email;nom;telephone;tampons\nmarie.dupont@example.com;Marie Dupont;0612345678;7\njean@example.com;Jean Martin;;3\n";

export function Import() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError("");
    // Les exports Excel français sont souvent en Windows-1252 : on tente l'UTF-8 puis on retombe dessus
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf);
    setCsv(text);
    try {
      setPreview(await api<Preview>("/api/admin/import", { body: { csv: text, dryRun: true } }));
    } catch (err) {
      setPreview(null);
      setError((err as Error).message);
    }
  }

  async function run() {
    setBusy(true);
    setError("");
    try {
      setResult(await api<Result>("/api/admin/import", { body: { csv } }));
      setPreview(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>Importer les anciens clients</h1>
      <div className="card stack">
        <p>
          Importez le fichier CSV de votre ancienne carte de fidélité. Colonnes requises : <b>email</b> et <b>tampons</b> (ou un export CRM avec « Progress : 7 / 11 stamps »){" "}
          (facultatif : <b>nom</b>, <b>telephone</b>). Séparateur <code>;</code> ou <code>,</code>.
        </p>
        <ul className="small" style={{ margin: 0 }}>
          <li>Client <b>déjà inscrit</b> avec cet e-mail : les tampons sont ajoutés immédiatement (+ notification).</li>
          <li>Client <b>pas encore inscrit</b> : son compte est créé avec ses tampons (visible dans Clients et au scanner) ; il l&apos;active en s&apos;inscrivant avec le même e-mail.</li>
          <li>Réimporter le même fichier ne crédite jamais deux fois.</li>
        </ul>
        <div className="row">
          <label className="btn btn-primary" style={{ flexDirection: "row" }}>
            <FileUp size={18} /> {fileName || "Choisir un fichier CSV"}
            <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
          </label>
          <a
            className="btn btn-sm"
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
            download="modele-import-fidelite.csv"
          >
            Télécharger un modèle
          </a>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {preview && (
        <div className="card stack">
          <h2>Aperçu — {preview.total} client(s)</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>E-mail</th><th>Nom</th><th>Tampons</th></tr></thead>
              <tbody>
                {preview.preview.map((r) => (
                  <tr key={r.email}><td>{r.email}</td><td>{r.name ?? "—"}</td><td>{r.stamps}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.total > preview.preview.length && <p className="small muted">… et {preview.total - preview.preview.length} autres.</p>}
          {preview.errors.length > 0 && (
            <div className="alert alert-info small">
              {preview.errors.length} ligne(s) ignorée(s) :<br />{preview.errors.slice(0, 5).join(" · ")}
            </div>
          )}
          <button className="btn btn-primary" onClick={run} disabled={busy || preview.total === 0}>
            {busy ? "Import en cours…" : `Importer ${preview.total} client(s)`}
          </button>
        </div>
      )}

      {result && (
        <div className="alert alert-success">
          {result.imported} client(s) importé(s) : {result.createdAccounts} nouveau(x) compte(s) en attente d&apos;inscription
          (visibles dans Clients et au scanner), {result.creditedAccounts} compte(s) existant(s) crédité(s).
        </div>
      )}
    </div>
  );
}
