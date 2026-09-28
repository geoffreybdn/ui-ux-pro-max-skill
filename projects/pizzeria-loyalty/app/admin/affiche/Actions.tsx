"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button className="btn btn-primary" onClick={() => window.print()}>
      <Printer size={18} /> Imprimer l&apos;affiche
    </button>
  );
}

export function CopyLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <span className="small" style={{ fontWeight: 700 }}>{label}</span>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input className="input" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={label} />
        <button
          className="btn btn-sm"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}
