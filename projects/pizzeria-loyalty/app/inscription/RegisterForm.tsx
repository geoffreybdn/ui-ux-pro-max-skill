"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/components/useApi";

export function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await api<{ bonus: number; legacyPoints: number }>("/api/auth/register", { body: form });
      const q = new URLSearchParams({ bienvenue: "1" });
      if (res.bonus) q.set("bonus", String(res.bonus));
      if (res.legacyPoints) q.set("anciens", String(res.legacyPoints));
      router.push(`/carte?${q}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <label>Prénom et nom<input className="input" name="name" required autoComplete="name" /></label>
      <label>E-mail<input className="input" name="email" type="email" required autoComplete="email" /></label>
      <label>
        Téléphone <span className="hint">(facultatif)</span>
        <input className="input" name="phone" type="tel" autoComplete="tel" />
      </label>
      <label>
        Mot de passe <span className="hint">8 caractères minimum</span>
        <input className="input" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </label>
      <label>
        Code d&apos;inscription <span className="hint">(facultatif — donné en boutique, points offerts)</span>
        <input className="input" name="signupCode" defaultValue={params.get("code") ?? ""} style={{ textTransform: "uppercase" }} />
      </label>
      <button className="btn btn-primary btn-block" disabled={loading}>
        {loading ? "Création…" : "Créer ma carte de fidélité"}
      </button>
      <p className="small center">Déjà inscrit ? <Link href="/connexion">Se connecter</Link></p>
    </form>
  );
}
