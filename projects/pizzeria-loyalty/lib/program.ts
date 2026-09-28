// Règles pures de la carte à tampons (utilisables côté serveur ET navigateur).
import type { Settings } from "./settings";

export type StampRule = "quantity" | "visit";
type StampConfig = Settings["stamps"];

/** Tampons réellement crédités pour un nombre choisi en caisse : plafond par passage puis promo. */
export function applyPromo(s: StampConfig, count: number, promoMultiplier: number) {
  let base = Math.max(0, Math.trunc(count));
  if (s.maxPerVisit > 0) base = Math.min(base, s.maxPerVisit);
  return base > 0 ? Math.max(base, Math.floor(base * promoMultiplier)) : 0;
}

/** Position sur la carte : récompenses disponibles + tampons de la carte en cours. */
export function cardState(stamps: number, required: number) {
  const available = Math.floor(stamps / required);
  const onCard = stamps - available * required;
  return { available, onCard, remaining: required - onCard };
}

/** Colonnes de la grille : 6 → une ligne, 8 → 2×4, 10 → 2×5, 12 → 2×6… */
export function stampCols(required: number) {
  return required <= 6 ? required : Math.min(6, Math.ceil(required / 2));
}

export function plural(n: number, word: string) {
  return `${n} ${word}${Math.abs(n) > 1 ? "s" : ""}`;
}

export function ruleLabel(s: StampConfig) {
  if (s.rule === "quantity") return `1 tampon par ${s.unitLabel}`;
  return s.minAmount > 0 ? `1 tampon par commande dès ${formatEuros(s.minAmount * 100)}` : "1 tampon par passage";
}

export function formatEuros(cents: number) {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/** Remplace {variable} dans un modèle de notification. */
export function renderTemplate(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}
