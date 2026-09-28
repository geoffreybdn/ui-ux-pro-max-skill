// Fonctions pures du programme de fidélité (utilisables côté serveur ET navigateur).
import type { Settings } from "./settings";

export type Tier = { name: string; min: number; multiplier: number };

export function tierFor(settings: Pick<Settings, "tiers">, lifetimePoints: number): Tier | null {
  if (!settings.tiers.enabled) return null;
  let current: Tier | null = null;
  for (const t of settings.tiers.levels) if (lifetimePoints >= t.min) current = t;
  return current;
}

export function nextTier(settings: Pick<Settings, "tiers">, lifetimePoints: number): Tier | null {
  if (!settings.tiers.enabled) return null;
  return settings.tiers.levels.find((t) => t.min > lifetimePoints) ?? null;
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

export type VisitGain = { points: number; stamps: number; cashbackCents: number };

/** Calcule le gain d'un passage selon les réglages du programme, la promo et le niveau du client. */
export function computeVisitGain(
  s: Pick<Settings, "points" | "stamps" | "cashback">,
  opts: { amountCents: number; extraPoints: number; promoMultiplier: number; tierMultiplier: number }
): VisitGain {
  const mult = opts.promoMultiplier * opts.tierMultiplier;
  const basePoints = s.points.enabled ? Math.floor((opts.amountCents / 100) * s.points.perEuro) : 0;
  const points = Math.max(0, Math.round((basePoints + opts.extraPoints) * mult));
  const stamps =
    s.stamps.enabled && opts.amountCents > 0 && opts.amountCents >= Math.round(s.stamps.minAmount * 100)
      ? Math.max(1, Math.floor(opts.promoMultiplier))
      : 0;
  const cashbackCents = s.cashback.enabled ? Math.round((opts.amountCents * s.cashback.percent * mult) / 100) : 0;
  return { points, stamps, cashbackCents };
}

export function describeGain(g: VisitGain) {
  const parts: string[] = [];
  if (g.points) parts.push(`+${g.points} point${g.points > 1 ? "s" : ""}`);
  if (g.stamps) parts.push(`+${g.stamps} tampon${g.stamps > 1 ? "s" : ""}`);
  if (g.cashbackCents) parts.push(`+${formatEuros(g.cashbackCents)} de cashback`);
  return parts.join(" · ");
}

