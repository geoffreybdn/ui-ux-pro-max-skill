"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Flame, Gift, Minus, Plus, Search, Stamp, X } from "lucide-react";
import { api } from "@/components/useApi";
import { CouponBox } from "@/components/CouponBox";
import type { Customer } from "@/lib/db";
import type { Settings } from "@/lib/settings";
import { applyPromo, cardState, plural, ruleLabel, stampCols } from "@/lib/program";

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
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const MAX = 50;
  const promoMultiplier = promo?.multiplier ?? 1;
  const n = Math.max(0, Math.min(MAX, Math.trunc(Number(count)) || 0));
  const credited = mode === "add" ? applyPromo(card, n, promoMultiplier) : n;
  const QUICK = [1, 2, 3, 4, 5];
  // Règle « par pizza » : en ajout, on compte des pizzas (1 pizza = 1 tampon)
  const perItem = mode === "add" && card.rule === "quantity";
  const unit = (k: number) => (perItem ? plural(k, card.unitLabel).replace(/^\d+ /, "") : k > 1 ? "tampons" : "tampon");

  const step = (d: number) => setCount(String(Math.max(1, Math.min(MAX, (n || 0) + d))));

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
      setCount("1");
      setMode("add");
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
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

          {results.length === 0 && <CouponBox />}

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
                {customer.pending && <div className="small" style={{ color: "#b45309", fontWeight: 700 }}>Ancienne carte · pas encore inscrit dans l&apos;app</div>}
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
            className={`card stack stamp-editor ${mode === "remove" ? "is-remove" : ""}`}
            onSubmit={(e) => {
              e.preventDefault();
              if (n < 1) return;
              if (mode === "remove") {
                if (n > (customer?.stamps ?? 0)) {
                  setMessage({ kind: "error", text: `Le client n'a que ${plural(customer?.stamps ?? 0, "tampon")}.` });
                  return;
                }
                const note = prompt(`Retirer ${plural(n, "tampon")} à ${customer?.name} ?\nMotif (facultatif) :`, "Erreur de saisie");
                if (note === null) return;
                act({ action: "remove", count: n, note }, (r) => `${r.summary} retiré(s) ✔`);
              } else {
                act({ action: "add", count: n }, (r) => `${r.summary} ✔`);
              }
            }}
          >
            <div className="segmented" role="radiogroup" aria-label="Action">
              <button type="button" role="radio" aria-checked={mode === "add"} className={mode === "add" ? "is-on" : ""} onClick={() => { setMode("add"); setCount("1"); }}>
                <Plus size={18} /> Ajouter
              </button>
              <button type="button" role="radio" aria-checked={mode === "remove"} className={mode === "remove" ? "is-on is-danger" : ""} onClick={() => { setMode("remove"); setCount("1"); }}>
                <Minus size={18} /> Retirer
              </button>
            </div>

            {mode === "add" && (
              <p className="small muted" style={{ margin: 0 }}>
                <Stamp size={14} style={{ verticalAlign: "-2px" }} /> Règle : {ruleLabel(card)}
                {card.maxPerVisit > 0 ? ` · max ${card.maxPerVisit} par passage` : ""}
              </p>
            )}


            {perItem && <div className="small" style={{ fontWeight: 700 }}>Nombre de {card.unitLabel}s</div>}
            <div className="quick-picks" role="group" aria-label="Nombre rapide">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`quick-pick ${n === q ? "is-on" : ""}`}
                  disabled={mode === "remove" && q > (customer?.stamps ?? 0)}
                  onClick={() => setCount(String(q))}
                  aria-pressed={n === q}
                >
                  {mode === "add" ? "+" : "−"}{q}
                </button>
              ))}
            </div>

            <div className="stepper">
              <button type="button" className="btn" onClick={() => step(-1)} disabled={n <= 1} aria-label="Un de moins"><Minus size={20} /></button>
              <label className="stepper-field">
                <span className="sr-only">{perItem ? `Nombre de ${card.unitLabel}s` : `Nombre de tampons à ${mode === "add" ? "ajouter" : "retirer"}`}</span>
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX}
                  value={count}
                  onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, "").slice(0, 2))}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <span className="small muted">{unit(n)}</span>
              </label>
              <button type="button" className="btn" onClick={() => step(1)} disabled={n >= MAX} aria-label="Un de plus"><Plus size={20} /></button>
            </div>

            {mode === "add" && credited !== n && n > 0 && (
              <p className="small" style={{ margin: 0 }}>
                {card.maxPerVisit > 0 && n > card.maxPerVisit ? `Plafond de ${card.maxPerVisit} par passage` : ""}
                {card.maxPerVisit > 0 && n > card.maxPerVisit && promoMultiplier > 1 ? " · " : ""}
                {promoMultiplier > 1 ? `Promo x${promoMultiplier}` : ""} → <b>{plural(credited, "tampon")} crédité{credited > 1 ? "s" : ""}</b>
              </p>
            )}

            <button className={`btn btn-block btn-lg ${mode === "add" ? "btn-primary" : "btn-danger"}`} disabled={busy || n < 1}>
              {n < 1
                ? "Choisissez un nombre"
                : mode === "add"
                  ? `Ajouter ${plural(credited, "tampon")}${perItem ? ` (${plural(n, card.unitLabel)})` : ""}`
                  : `Retirer ${plural(n, "tampon")}`}
            </button>
          </form>

          <CouponBox
            key={customer.id}
            customerId={customer.id}
            customerName={customer.name}
            onStamps={(balance) => setCustomer((c) => (c ? { ...c, stamps: balance } : c))}
          />

          <div className="row between">
            <button className="btn" onClick={() => { setCustomer(null); setMessage(null); setQuery(""); }}>
              <X size={18} /> Client suivant
            </button>
          </div>
        </>
      )}
    </div>
  );
}
