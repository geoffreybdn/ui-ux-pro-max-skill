// Règles pures de la carte à tampons (utilisables côté serveur ET navigateur).
import type { Settings } from "./settings";

export type StampRule = "visit" | "amount" | "quantity";
type StampConfig = Settings["stamps"];

/**
 * Tampons gagnés lors d'un passage :
 * - visit    : 1 tampon par passage (si la commande atteint le minimum)
 * - amount   : 1 tampon par tranche de X € dépensés
 * - quantity : le nombre saisi en caisse (ex. nombre de pizzas)
 * La promo en cours multiplie le résultat (x2 = tampons doublés), dans la limite du plafond par passage.
 */
export function computeStamps(
  s: StampConfig,
  opts: { amountCents: number; quantity: number; promoMultiplier: number }
): number {
  let base = 0;
  if (s.rule === "visit") base = opts.amountCents >= Math.round(s.minAmount * 100) ? 1 : 0;
  else if (s.rule === "amount") base = s.amountPerStamp > 0 ? Math.floor(opts.amountCents / Math.round(s.amountPerStamp * 100)) : 0;
  else base = Math.max(0, Math.trunc(opts.quantity));
  if (s.maxPerVisit > 0) base = Math.min(base, s.maxPerVisit);
  return base > 0 ? Math.max(base, Math.floor(base * opts.promoMultiplier)) : 0;
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
  if (s.rule === "amount") return `1 tampon par tranche de ${formatEuros(s.amountPerStamp * 100)}`;
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
