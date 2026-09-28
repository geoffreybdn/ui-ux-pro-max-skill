"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Flame, Gift, Minus, Plus, Search, Stamp, X } from "lucide-react";
import { api } from "@/components/useApi";
import type { Customer } from "@/lib/db";
import type { Settings } from "@/lib/settings";
import { cardState, computeStamps, plural, ruleLabel, stampCols } from "@/lib/program";

type Props = {
  isAdmin: boolean;
  card: Settings["stamps"];
  promo: { title: string; multiplier: number } | null;
};

type Html5Qrcode = import("html5-qrcode").Html5Qrcode;

export function Scanner({ isAdmin, card, promo }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [results, setResults] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const promoMultiplier = promo?.multiplier ?? 1;
  const amountCents = Math.round((Number(amount.replace(",", ".")) || 0) * 100);
  const needsAmount = (card.rule === "visit" && card.minAmount > 0) || card.rule === "amount";
  const preview = computeStamps(card, { amountCents, quantity, promoMultiplier });

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
      setCustomer({ ...customer, stamps: Number(res.stampsBalance ?? customer.stamps) });
      setMessage({ kind: "success", text: success(res) });
      setAmount("");
      setQuantity(1);
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function adjust() {
    const value = prompt("Tampons à ajouter (négatif pour retirer) :");
    if (!value) return;
    const note = prompt("Motif :", "Geste commercial") || "Correction manuelle";
    act({ action: "adjust", stamps: Number(value), note }, (r) => `Carte corrigée : ${plural(Number(r.stampsBalance), "tampon")}.`);
  }

  const state = customer ? cardState(customer.stamps, card.required) : null;
  // Carte pleine : on l'affiche complète tant que le cadeau n'est pas offert
  const shown = state ? (state.available > 0 ? card.required : state.onCard) : 0;

  return (
    <div className="stack" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>Scanner une carte</h1>
      {promo && (
        <div className="promo-banner"><Flame size={20} /> {promo.title} : tampons x{promo.multiplier} appliqués automatiquement</div>
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
                  <span className="badge">{c.stamps} tampon{c.stamps > 1 ? "s" : ""}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {message && <div className={`alert alert-${message.kind}`} role="status">{message.text}</div>}

      {customer && state && (
        <>
          <div className="card stack">
            <div className="row between">
              <div>
                <h2 style={{ margin: 0 }}>{customer.name}</h2>
                <div className="small muted">{customer.email} · {customer.card_code}</div>
              </div>
              <span className="badge badge-hot">{shown}/{card.required}</span>
            </div>
            <div className="stamp-grid" style={{ gridTemplateColumns: `repeat(${stampCols(card.required)}, 1fr)` }} aria-label={`${shown} tampons sur ${card.required}`}>
              {Array.from({ length: card.required }, (_, i) => (
                <span key={i} className={`stamp ${i < shown ? "stamp-on" : ""} ${i === card.required - 1 ? "stamp-gift" : ""}`}>
                  {i === card.required - 1 ? "🎁" : i < shown ? "🍕" : ""}
                </span>
              ))}
            </div>
            {state.available > 0 && (
              <div className="alert alert-success">
                <Gift size={18} style={{ verticalAlign: "-3px" }} /> {state.available > 1 ? `${state.available} × ` : ""}{card.reward} disponible !
              </div>
            )}
          </div>

          {state.available > 0 && (
            <button
              className="btn btn-gold btn-block"
              disabled={busy}
              onClick={() => {
                if (confirm(`Offrir « ${card.reward} » ? La carte redémarre.`))
                  act({ action: "reward" }, (r) => `${r.reward} offert(e) ✔ Nouvelle carte : ${plural(cardState(Number(r.stampsBalance), card.required).onCard, "tampon")}.`);
              }}
            >
              <Gift size={18} /> Offrir : {card.reward}
            </button>
          )}

          <form
            className="card stack"
            onSubmit={(e) => {
              e.preventDefault();
              act({ action: "earn", amount: needsAmount ? amount : undefined, quantity }, (r) => `${r.summary} ✔`);
            }}
          >
            <h3><Stamp size={18} style={{ verticalAlign: "-3px" }} /> Ajouter des tampons</h3>
            <p className="small muted" style={{ margin: 0 }}>{ruleLabel(card)}{card.maxPerVisit > 0 ? ` · max ${card.maxPerVisit} par passage` : ""}</p>
            {needsAmount && (
              <label>
                Montant de la commande (€)
                <input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="24,50" autoFocus />
              </label>
            )}
            {card.rule === "quantity" && (
              <div className="qty">
                <span style={{ fontWeight: 700 }}>Nombre de {card.unitLabel}s</span>
                <div className="row" style={{ flexWrap: "nowrap" }}>
                  <button type="button" className="btn" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Moins"><Minus size={18} /></button>
                  <span className="qty-value" aria-live="polite">{quantity}</span>
                  <button type="button" className="btn" onClick={() => setQuantity((q) => Math.min(50, q + 1))} aria-label="Plus"><Plus size={18} /></button>
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-block btn-lg" disabled={busy || preview <= 0}>
              {preview > 0 ? `+ ${plural(preview, "tampon")}${promoMultiplier > 1 ? ` (x${promoMultiplier})` : ""}` : needsAmount ? "Saisissez le montant" : "Aucun tampon"}
            </button>
          </form>

          <div className="row between">
            <button className="btn" onClick={() => { setCustomer(null); setMessage(null); setQuery(""); }}>
              <X size={18} /> Client suivant
            </button>
            {isAdmin && <button className="btn btn-ghost btn-sm" onClick={adjust}>Corriger la carte</button>}
          </div>
        </>
      )}
    </div>
  );
}
