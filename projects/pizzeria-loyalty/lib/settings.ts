import { cache } from "react";
import { sql } from "./db";
import type { Tier } from "./program";

export type { Tier };
export { tierFor, nextTier, formatEuros, renderTemplate, firstName, computeVisitGain, describeGain } from "./program";

export const NOTIFICATION_KEYS = [
  "welcome",
  "visit",
  "reward",
  "nearReward",
  "stampNear",
  "stampComplete",
  "tierUp",
  "birthday",
  "referral",
  "inactivity",
  "promo",
] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
export type NotificationTemplate = { enabled: boolean; title: string; body: string };

export type Settings = {
  pizzeriaName: string;
  points: { enabled: boolean; perEuro: number };
  stamps: { enabled: boolean; required: number; minAmount: number; reward: string };
  cashback: { enabled: boolean; percent: number; minRedeem: number };
  welcomeBonus: number;
  birthdayBonus: number;
  referral: { enabled: boolean; referrerBonus: number; refereeBonus: number };
  tiers: { enabled: boolean; levels: Tier[] };
  nearRewardPoints: number;
  inactivityDays: number;
  notifications: Record<NotificationKey, NotificationTemplate>;
};

/** Libellés + variables disponibles, affichés dans l'admin. */
export const NOTIFICATION_INFO: Record<NotificationKey, { label: string; when: string; vars: string }> = {
  welcome: { label: "Bienvenue", when: "à l'activation des notifications après l'inscription", vars: "{prenom} {solde}" },
  visit: { label: "Passage en caisse", when: "après chaque passage scanné", vars: "{prenom} {gain} {solde}" },
  reward: { label: "Récompense débloquée", when: "quand le solde atteint une récompense", vars: "{prenom} {recompense} {solde}" },
  nearReward: { label: "Récompense proche", when: "quand il manque peu de points", vars: "{prenom} {reste} {recompense} {solde}" },
  stampNear: { label: "Dernier tampon", when: "quand il ne manque qu'un tampon", vars: "{prenom} {recompense}" },
  stampComplete: { label: "Carte tampons complète", when: "quand la carte tampons est pleine", vars: "{prenom} {recompense}" },
  tierUp: { label: "Nouveau niveau", when: "au passage à un niveau supérieur", vars: "{prenom} {niveau}" },
  birthday: { label: "Anniversaire", when: "le jour de l'anniversaire (cron quotidien)", vars: "{prenom} {bonus} {solde}" },
  referral: { label: "Parrainage réussi", when: "quand un filleul s'inscrit", vars: "{prenom} {filleul} {bonus}" },
  inactivity: { label: "Relance inactivité", when: "après X jours sans visite (cron quotidien)", vars: "{prenom} {solde}" },
  promo: { label: "Promotion", when: "au démarrage d'une promo (titre/message de la promo)", vars: "—" },
};

export const DEFAULT_SETTINGS: Settings = {
  pizzeriaName: process.env.NEXT_PUBLIC_PIZZERIA_NAME || "La Bella Pizza",
  points: { enabled: true, perEuro: Number(process.env.POINTS_PER_EURO || 1) },
  stamps: { enabled: true, required: 10, minAmount: 10, reward: "Pizza offerte" },
  cashback: { enabled: false, percent: 5, minRedeem: 5 },
  welcomeBonus: 10,
  birthdayBonus: 50,
  referral: { enabled: true, referrerBonus: 30, refereeBonus: 20 },
  tiers: {
    enabled: true,
    levels: [
      { name: "Bronze", min: 0, multiplier: 1 },
      { name: "Argent", min: 300, multiplier: 1.1 },
      { name: "Or", min: 800, multiplier: 1.25 },
    ],
  },
  nearRewardPoints: 15,
  inactivityDays: Number(process.env.INACTIVITY_REMINDER_DAYS || 30),
  notifications: {
    welcome: { enabled: true, title: "Bienvenue {prenom} ! 🍕", body: "Votre carte est prête : vous avez déjà {solde} points." },
    visit: { enabled: true, title: "Merci pour votre visite !", body: "{gain} — solde : {solde} points." },
    reward: { enabled: true, title: "🎁 Récompense débloquée !", body: "{prenom}, vous pouvez obtenir : {recompense}." },
    nearReward: { enabled: true, title: "Plus que {reste} points ! 🔥", body: "{recompense} est presque à vous, {prenom}." },
    stampNear: { enabled: true, title: "Plus qu'un tampon !", body: "À votre prochaine visite : {recompense} 🎉" },
    stampComplete: { enabled: true, title: "Carte tampons complète ! 🎉", body: "{recompense} vous attend en caisse." },
    tierUp: { enabled: true, title: "Niveau {niveau} atteint ⭐", body: "Bravo {prenom} ! Vous gagnez désormais plus de points à chaque visite." },
    birthday: { enabled: true, title: "Joyeux anniversaire {prenom} ! 🎂", body: "On vous offre {bonus} points. Venez fêter ça !" },
    referral: { enabled: true, title: "Merci pour le parrainage ! 🙌", body: "{filleul} s'est inscrit grâce à vous : +{bonus} points." },
    inactivity: { enabled: true, title: "Vous nous manquez ! 🍕", body: "{prenom}, vos {solde} points vous attendent." },
    promo: { enabled: true, title: "", body: "" },
  },
};

const num = (v: unknown, def: number, min: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
const str = (v: unknown, def: string, max = 200) => (typeof v === "string" ? v.slice(0, max) : def);

/** Fusionne une saisie (partielle, non fiable) avec les valeurs par défaut et la borne. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = DEFAULT_SETTINGS;
  const levels: Tier[] = Array.isArray(r.tiers?.levels) && r.tiers.levels.length
    ? r.tiers.levels.slice(0, 5).map((l: Record<string, unknown>, i: number) => ({
        name: str(l?.name, `Niveau ${i + 1}`, 30) || `Niveau ${i + 1}`,
        min: i === 0 ? 0 : Math.round(num(l?.min, 0, 0, 1_000_000)),
        multiplier: num(l?.multiplier, 1, 1, 5),
      }))
    : d.tiers.levels;
  levels.sort((a, b) => a.min - b.min);

  const notifications = {} as Settings["notifications"];
  for (const k of Object.keys(d.notifications) as NotificationKey[]) {
    const n = r.notifications?.[k];
    notifications[k] = {
      enabled: bool(n?.enabled, d.notifications[k].enabled),
      title: str(n?.title, d.notifications[k].title, 80),
      body: str(n?.body, d.notifications[k].body, 200),
    };
  }

  return {
    pizzeriaName: str(r.pizzeriaName, d.pizzeriaName, 50).trim() || d.pizzeriaName,
    points: { enabled: bool(r.points?.enabled, d.points.enabled), perEuro: num(r.points?.perEuro, d.points.perEuro, 0, 100) },
    stamps: {
      enabled: bool(r.stamps?.enabled, d.stamps.enabled),
      required: Math.round(num(r.stamps?.required, d.stamps.required, 2, 50)),
      minAmount: num(r.stamps?.minAmount, d.stamps.minAmount, 0, 500),
      reward: str(r.stamps?.reward, d.stamps.reward, 60).trim() || d.stamps.reward,
    },
    cashback: {
      enabled: bool(r.cashback?.enabled, d.cashback.enabled),
      percent: num(r.cashback?.percent, d.cashback.percent, 0, 50),
      minRedeem: num(r.cashback?.minRedeem, d.cashback.minRedeem, 0, 500),
    },
    welcomeBonus: Math.round(num(r.welcomeBonus, d.welcomeBonus, 0, 10_000)),
    birthdayBonus: Math.round(num(r.birthdayBonus, d.birthdayBonus, 0, 10_000)),
    referral: {
      enabled: bool(r.referral?.enabled, d.referral.enabled),
      referrerBonus: Math.round(num(r.referral?.referrerBonus, d.referral.referrerBonus, 0, 10_000)),
      refereeBonus: Math.round(num(r.referral?.refereeBonus, d.referral.refereeBonus, 0, 10_000)),
    },
    tiers: { enabled: bool(r.tiers?.enabled, d.tiers.enabled), levels },
    nearRewardPoints: Math.round(num(r.nearRewardPoints, d.nearRewardPoints, 0, 10_000)),
    inactivityDays: Math.round(num(r.inactivityDays, d.inactivityDays, 7, 365)),
    notifications,
  };
}

/** Réglages du programme (une lecture par requête). Retombe sur les valeurs par défaut si la base est indisponible. */
export const getSettings = cache(async (): Promise<Settings> => {
  try {
    const [row] = await sql<{ data: unknown }>`select data from program_settings where id = 1`;
    return normalizeSettings(row?.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
});

export async function saveSettings(input: unknown) {
  const settings = normalizeSettings(input);
  await sql`
    insert into program_settings (id, data, updated_at) values (1, ${JSON.stringify(settings)}::jsonb, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()`;
  return settings;
}

