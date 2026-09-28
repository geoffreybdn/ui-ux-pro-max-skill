"use client";

import { useState } from "react";
import { CheckCircle2, Ticket, XCircle } from "lucide-react";
import { api } from "@/components/useApi";

type Check = { ok: boolean; reason?: string; benefit?: string; conditions?: string; coupon?: { code: string; title: string } };

/**
 * Vérification puis validation d'un code promo en caisse.
 * Avec `customerId` : le code est rattaché au client (obligatoire pour « 1 utilisation par client »).
 */
export function CouponBox({
  customerId,
  customerName,
  onStamps,
}: {
  customerId?: number;
  customerName?: string;
  onStamps?: (balance: number) => void;
}) {
  const [code, setCode] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setDone(null);
    setError(null);
    try {
      setCheck(await api<Check>("/api/admin/coupons/check", { body: { code, customerId } }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ code: string; benefit: string; stampsBalance: number | null }>("/api/admin/coupons/redeem", {
        body: { code, customerId },
      });
      if (r.stampsBalance !== null && onStamps) onStamps(r.stampsBalance);
      setDone(`Code ${r.code} validé ✔ ${r.benefit}`);
      setCheck(null);
      setCode("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}><Ticket size={18} style={{ verticalAlign: "-3px" }} /> Code promo{customerName ? "" : " (client sans carte)"}</h3>
      <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={verify}>
        <input
          className="input"
          value={code}
          onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/\s/g, "")); setCheck(null); setDone(null); setError(null); }}
          placeholder="Ex. PIZZA2X1"
          aria-label="Code promo"
          style={{ textTransform: "uppercase", fontFamily: "ui-monospace, monospace", fontWeight: 700 }}
          autoCapitalize="characters"
        />
        <button className="btn" disabled={busy || !code}>Vérifier</button>
      </form>

      {check && (
        <div className={`coupon-check ${check.ok ? "is-ok" : "is-ko"}`} role="status">
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            {check.ok ? <CheckCircle2 size={22} color="#15803d" /> : <XCircle size={22} color="#b91c1c" />}
            <div>
              {check.coupon && <b>{check.coupon.title}</b>}
              {check.benefit && <div>{check.benefit}</div>}
              {check.conditions && <div className="small muted">{check.conditions}</div>}
              {!check.ok && <div style={{ fontWeight: 700, color: "#b91c1c", marginTop: 4 }}>{check.reason}</div>}
            </div>
          </div>
          {check.ok && (
            <button className="btn btn-block btn-lg stamp-editor-ok" onClick={redeem} disabled={busy}>
              Valider{customerName ? ` pour ${customerName.split(" ")[0]}` : ""}
            </button>
          )}
        </div>
      )}
      {done && <div className="alert alert-success">{done}</div>}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
