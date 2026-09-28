"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Flame, Search, X } from "lucide-react";
import { api } from "@/components/useApi";
import type { Customer, Reward } from "@/lib/db";

type Props = {
  isAdmin: boolean;
  pointsPerEuro: number;
  promo: { title: string; multiplier: number } | null;
  rewards: Reward[];
};

type Html5Qrcode = import("html5-qrcode").Html5Qrcode;

export function Scanner({ isAdmin, pointsPerEuro, promo, rewards }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [results, setResults] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const multiplier = promo?.multiplier ?? 1;
  const amountNum = Number(amount.replace(",", ".")) || 0;
  const preview = Math.max(0, Math.round((Math.floor(amountNum * pointsPerEuro) + (Number(extra) || 0)) * multiplier));

  const lookup = useCallback(async (q: string) => {
    setMessage(null);
    try {
      const { customers } = await api<{ customers: Customer[] }>(`/api/admin/customers?q=${encodeURIComponent(q)}`);
      if (customers.length === 1) {
        setCustomer(customers[0]);
        setResults([]);
      } else if (customers.length === 0) {
        setMessage({ kind: "error", text: "Aucun client trouvé" });
      } else setResults(customers);
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    }
  }, []);

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setCamera(false);
    if (s) await s.stop().catch(() => {});
  }, []);

  async function startCamera() {
    setMessage(null);
    setCustomer(null);
    setCamera(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("qr-reader", { verbose: false });
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (text) => {
          if (navigator.vibrate) navigator.vibrate(80);
          await stopCamera();
          await lookup(text);
        },
        () => {}
      );
    } catch {
      setMessage({ kind: "error", text: "Caméra inaccessible : autorisez l'accès ou saisissez le code." });
      setCamera(false);
      scannerRef.current = null;
    }
  }

  useEffect(() => () => void stopCamera(), [stopCamera]);

  async function act(body: Record<string, unknown>, success: (r: Record<string, unknown>) => string) {
    if (!customer) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<Record<string, unknown>>("/api/admin/transactions", {
        body: { customerId: customer.id, ...body },
      });
      setCustomer({ ...customer, points: Number(res.balance) });
      setMessage({ kind: "success", text: success(res) });
      setAmount("");
      setExtra("");
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function adjust() {
    const value = prompt("Points à ajouter (négatif pour retirer) :");
    if (!value) return;
    const note = prompt("Motif :", "Geste commercial") || "Ajustement manuel";
    act({ action: "adjust", points: Number(value), note }, (r) => `Solde corrigé : ${r.balance} points`);
  }

  return (
    <div className="stack" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>Scanner une carte</h1>
      {promo && (
        <div className="promo-banner"><Flame size={20} /> {promo.title} : points x{promo.multiplier} appliqués automatiquement</div>
      )}

      {!customer && (
        <>
          <div className="card stack">
            <div id="qr-reader" className="scanner-box" style={{ display: camera ? "block" : "none" }} />
            {camera ? (
              <button className="btn" onClick={stopCamera}><CameraOff size={18} /> Arrêter la caméra</button>
            ) : (
              <button className="btn btn-primary btn-block" onClick={startCamera}><Camera size={18} /> Scanner le QR code</button>
            )}
          </div>

          <form
            className="card row"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim()) lookup(query.trim());
            }}
          >
            <input
              className="input"
              style={{ flex: 1, minWidth: 180 }}
              placeholder="Code carte, e-mail, nom ou téléphone"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Recherche client"
            />
            <button className="btn"><Search size={18} /> Chercher</button>
          </form>

          {results.length > 0 && (
            <div className="card stack">
              {results.map((c) => (
                <button key={c.id} className="btn" style={{ justifyContent: "space-between" }} onClick={() => { setCustomer(c); setResults([]); }}>
                  <span>{c.name} <span className="small muted">{c.email}</span></span>
                  <span className="badge">{c.points} pts</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {message && <div className={`alert alert-${message.kind}`} role="status">{message.text}</div>}

      {customer && (
        <>
          <div className="card row between">
            <div>
              <h2 style={{ margin: 0 }}>{customer.name}</h2>
              <div className="small muted">{customer.email} · {customer.card_code}</div>
            </div>
            <div className="center">
              <div className="stat"><div className="value">{customer.points}</div><div className="label">points</div></div>
            </div>
          </div>

          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "earn", amount, extraPoints: extra || 0 }, (r) =>
                `+${r.points} points crédités${Number(r.multiplier) > 1 ? ` (x${r.multiplier})` : ""}. Nouveau solde : ${r.balance}`
              );
            }}
          >
            <h3>Ajouter des points</h3>
            <div className="row">
              <label style={{ flex: 1 }}>
                Montant de la commande (€)
                <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="24,50" autoFocus />
              </label>
              <label style={{ width: 120 }}>
                Bonus pts
                <input className="input" inputMode="numeric" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0" />
              </label>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy || preview <= 0}>
              Créditer {preview} point{preview > 1 ? "s" : ""}{multiplier > 1 ? ` (x${multiplier})` : ""}
            </button>
          </form>

          <div className="card stack">
            <h3>Utiliser une récompense</h3>
            {rewards.map((r) => (
              <button
                key={r.id}
                className="btn"
                style={{ justifyContent: "space-between" }}
                disabled={busy || customer.points < r.cost}
                onClick={() => {
                  if (confirm(`Offrir « ${r.name} » (${r.cost} points) ?`))
                    act({ action: "redeem", rewardId: r.id }, (res) => `${res.reward} validé. Reste ${res.balance} points.`);
                }}
              >
                <span>{r.name}</span><span className="badge">{r.cost} pts</span>
              </button>
            ))}
          </div>

          <div className="row between">
            <button className="btn" onClick={() => { setCustomer(null); setMessage(null); setQuery(""); }}>
              <X size={18} /> Client suivant
            </button>
            {isAdmin && <button className="btn btn-ghost btn-sm" onClick={adjust}>Corriger le solde</button>}
          </div>
        </>
      )}
    </div>
  );
}
