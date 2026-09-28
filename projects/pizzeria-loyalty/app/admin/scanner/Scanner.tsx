"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Coins, Crown, Flame, Search, Stamp, X } from "lucide-react";
import { api } from "@/components/useApi";
import type { Customer, Reward } from "@/lib/db";
import type { Settings } from "@/lib/settings";
import { computeVisitGain, describeGain, formatEuros, tierFor } from "@/lib/program";

type Program = Pick<Settings, "points" | "stamps" | "cashback" | "tiers">;

type Props = {
  isAdmin: boolean;
  program: Program;
  promo: { title: string; multiplier: number } | null;
  rewards: Reward[];
};

type Html5Qrcode = import("html5-qrcode").Html5Qrcode;

export function Scanner({ isAdmin, program, promo, rewards }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [results, setResults] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [extra, setExtra] = useState("");
  const [cashbackAmount, setCashbackAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const promoMultiplier = promo?.multiplier ?? 1;
  const tier = customer ? tierFor(program, customer.lifetime_points) : null;
  const amountCents = Math.round((Number(amount.replace(",", ".")) || 0) * 100);
  const preview = computeVisitGain(program, {
    amountCents,
    extraPoints: Number(extra) || 0,
    promoMultiplier,
    tierMultiplier: tier?.multiplier ?? 1,
  });
  const previewText = describeGain(preview);

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
      const gained = body.action === "earn" ? Number(res.points ?? 0) : 0;
      setCustomer({
        ...customer,
        points: res.balance !== undefined ? Number(res.balance) : customer.points,
        lifetime_points: customer.lifetime_points + gained,
        stamps: res.stampsBalance !== undefined ? Number(res.stampsBalance) : customer.stamps,
        cashback_cents: res.cashbackBalance !== undefined ? Number(res.cashbackBalance) : customer.cashback_cents,
      });
      setMessage({ kind: "success", text: success(res) });
      setAmount("");
      setExtra("");
      setCashbackAmount("");
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

  const stampsOnCard = customer ? Math.min(customer.stamps, program.stamps.required) : 0;

  return (
    <div className="stack" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>Scanner une carte</h1>
      {promo && (
        <div className="promo-banner"><Flame size={20} /> {promo.title} : gains x{promo.multiplier} appliqués automatiquement</div>
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
          <div className="card stack">
            <div className="row between">
              <div>
                <h2 style={{ margin: 0 }}>{customer.name}</h2>
                <div className="small muted">{customer.email} · {customer.card_code}</div>
              </div>
              {tier && <span className="badge badge-hot"><Crown size={12} /> {tier.name}{tier.multiplier > 1 ? ` x${tier.multiplier}` : ""}</span>}
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))" }}>
              <div className="stat"><div className="value">{customer.points}</div><div className="label">points</div></div>
              {program.stamps.enabled && (
                <div className="stat"><div className="value">{stampsOnCard}/{program.stamps.required}</div><div className="label">tampons</div></div>
              )}
              {program.cashback.enabled && (
                <div className="stat"><div className="value">{formatEuros(customer.cashback_cents)}</div><div className="label">cashback</div></div>
              )}
            </div>
          </div>

          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "earn", amount, extraPoints: extra || 0 }, (r) => `${r.summary} crédité(s). Solde : ${r.balance} points.`);
            }}
          >
            <h3>Enregistrer le passage</h3>
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
            <button className="btn btn-primary btn-block" disabled={busy || !previewText}>
              {previewText ? `Créditer ${previewText}` : "Saisissez le montant"}
            </button>
            {program.stamps.enabled && program.stamps.minAmount > 0 && (
              <p className="small muted" style={{ margin: 0 }}>1 tampon dès {formatEuros(program.stamps.minAmount * 100)} de commande.</p>
            )}
          </form>

          {program.stamps.enabled && (
            <div className="card stack">
              <h3><Stamp size={18} style={{ verticalAlign: "-3px" }} /> Carte tampons</h3>
              <button
                className="btn btn-gold btn-block"
                disabled={busy || customer.stamps < program.stamps.required}
                onClick={() => {
                  if (confirm(`Offrir « ${program.stamps.reward} » et remettre la carte tampons à zéro ?`))
                    act({ action: "stamps" }, (r) => `${r.reward} validé. Nouvelle carte : ${r.stampsBalance} tampon(s).`);
                }}
              >
                {customer.stamps >= program.stamps.required
                  ? `Offrir : ${program.stamps.reward}`
                  : `${program.stamps.reward} dans ${program.stamps.required - customer.stamps} tampon(s)`}
              </button>
            </div>
          )}

          {program.cashback.enabled && (
            <form
              className="card stack"
              onSubmit={(e) => {
                e.preventDefault();
                act({ action: "cashback", amount: cashbackAmount }, (r) => `${r.used} de cashback déduit. Reste ${formatEuros(Number(r.cashbackBalance))}.`);
              }}
            >
              <h3><Coins size={18} style={{ verticalAlign: "-3px" }} /> Utiliser le cashback</h3>
              <div className="row">
                <input
                  className="input"
                  style={{ flex: 1 }}
                  inputMode="decimal"
                  value={cashbackAmount}
                  onChange={(e) => setCashbackAmount(e.target.value)}
                  placeholder={`max ${formatEuros(customer.cashback_cents)}`}
                  aria-label="Montant de cashback à utiliser"
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setCashbackAmount((customer.cashback_cents / 100).toFixed(2).replace(".", ","))}
                >
                  Tout
                </button>
              </div>
              <button className="btn btn-block" disabled={busy || !cashbackAmount || customer.cashback_cents < program.cashback.minRedeem * 100}>
                Déduire de la commande
              </button>
              {customer.cashback_cents < program.cashback.minRedeem * 100 && (
                <p className="small muted" style={{ margin: 0 }}>Utilisable dès {formatEuros(program.cashback.minRedeem * 100)} de cagnotte.</p>
              )}
            </form>
          )}

          {rewards.length > 0 && (
            <div className="card stack">
              <h3>Récompenses (points)</h3>
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
          )}

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
