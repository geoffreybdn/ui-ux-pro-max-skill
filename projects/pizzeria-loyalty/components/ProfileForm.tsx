"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/components/useApi";

export function ProfileForm({ name, phone, birthdate }: { name: string; phone: string | null; birthdate: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ kind: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/me", { method: "PATCH", body: Object.fromEntries(new FormData(e.currentTarget)) });
      setMsg({ kind: "success", text: "Profil enregistré." });
      router.refresh();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      {msg && <div className={`alert alert-${msg.kind} small`}>{msg.text}</div>}
      <label>Nom<input className="input" name="name" defaultValue={name} required /></label>
      <label>Téléphone<input className="input" name="phone" type="tel" defaultValue={phone ?? ""} /></label>
      <label>
        Date de naissance
        {birthdate ? (
          <input className="input" value={new Date(`${birthdate}T12:00:00`).toLocaleDateString("fr-FR")} disabled />
        ) : (
          <>
            <input className="input" name="birthdate" type="date" />
            <span className="hint">Ne peut être saisie qu&apos;une fois.</span>
          </>
        )}
      </label>
      <button className="btn" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}
