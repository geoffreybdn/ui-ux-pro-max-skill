"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";

export function ReferralShare({ code, pizzeriaName }: { code: string; pizzeriaName: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/inscription?code=${encodeURIComponent(code)}`;
    const text = `Rejoins la carte fidélité ${pizzeriaName} avec mon code ${code} et gagne des tampons offerts 🍕`;
    if (navigator.share) {
      await navigator.share({ title: pizzeriaName, text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button className="btn btn-block" onClick={share}>
      {copied ? <Check size={18} /> : typeof navigator !== "undefined" && "share" in navigator ? <Share2 size={18} /> : <Copy size={18} />}
      {copied ? "Lien copié !" : "Inviter un ami"}
    </button>
  );
}
