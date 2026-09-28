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

// ─── Codes promo ───

export type CouponKind = "bogo" | "percent" | "amount" | "free_item" | "stamps" | "custom";

export type Coupon = {
  id: number;
  code: string;
  title: string;
  kind: CouponKind;
  value: number;
  buy_qty: number;
  get_qty: number;
  item: string;
  min_amount: number;
  conditions: string | null;
  once_per_customer: boolean;
  max_uses: number | null;
  uses: number;
  valid_days: number[] | null;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  show_in_app: boolean;
};

export const COUPON_KINDS: { value: CouponKind; label: string }[] = [
  { value: "bogo", label: "X achetée(s) = Y offerte(s)" },
  { value: "percent", label: "Réduction en %" },
  { value: "amount", label: "Réduction en €" },
  { value: "free_item", label: "Produit offert" },
  { value: "stamps", label: "Tampons bonus" },
  { value: "custom", label: "Offre libre" },
];

export const WEEKDAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

const pluralWord = (n: number, w: string) => (n > 1 ? `${w}s` : w);

/** Description courte de l'avantage (ex. « 1 pizza achetée = 1 pizza offerte »). */
export function couponBenefit(c: Pick<Coupon, "kind" | "value" | "buy_qty" | "get_qty" | "item" | "title">) {
  const item = c.item || "pizza";
  switch (c.kind) {
    case "bogo":
      return `${c.buy_qty} ${pluralWord(c.buy_qty, item)} achetée${c.buy_qty > 1 ? "s" : ""} = ${c.get_qty} ${pluralWord(c.get_qty, item)} offerte${c.get_qty > 1 ? "s" : ""}`;
    case "percent":
      return `-${Number(c.value)} % ${c.item ? `sur ${c.item}` : "sur la commande"}`;
    case "amount":
      return `-${formatEuros(Number(c.value) * 100)} ${c.item ? `sur ${c.item}` : "sur la commande"}`;
    case "free_item":
      return `${c.item || "Produit"} offert(e)`;
    case "stamps":
      return `+${plural(Number(c.value), "tampon")} sur la carte`;
    default:
      return c.title;
  }
}

/** Conditions lisibles : jours, minimum de commande, dates, limite par client. */
export function couponConditions(c: Pick<Coupon, "min_amount" | "valid_days" | "ends_at" | "once_per_customer" | "conditions">) {
  const parts: string[] = [];
  if (c.valid_days?.length && c.valid_days.length < 7) parts.push(`le ${c.valid_days.map((d) => WEEKDAYS[d - 1]).join(", ")}`);
  if (Number(c.min_amount) > 0) parts.push(`dès ${formatEuros(Number(c.min_amount) * 100)} de commande`);
  if (c.ends_at) parts.push(`jusqu'au ${new Date(c.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`);
  parts.push(c.once_per_customer ? "1 fois par client" : "utilisable plusieurs fois");
  if (c.conditions) parts.push(c.conditions);
  return parts.join(" · ");
}
