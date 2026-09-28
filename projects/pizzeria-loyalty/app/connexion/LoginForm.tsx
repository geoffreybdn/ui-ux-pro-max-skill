"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/components/useApi";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api<{ redirect: string }>("/api/auth/login", {
        body: Object.fromEntries(new FormData(e.currentTarget)),
      });
      const next = params.get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : res.redirect);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <label>E-mail<input className="input" name="email" type="email" required autoComplete="email" /></label>
      <label>Mot de passe<input className="input" name="password" type="password" required autoComplete="current-password" /></label>
      <button className="btn btn-primary btn-block" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
      <p className="small center">Pas encore de carte ? <Link href="/inscription">S&apos;inscrire</Link></p>
    </form>
  );
}
