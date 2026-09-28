import { cache } from "react";
import { sql } from "./db";
import type { StampRule } from "./program";

export type { StampRule };
export { applyPromo, cardState, stampCols, plural, ruleLabel, formatEuros, renderTemplate, firstName } from "./program";

export const NOTIFICATION_KEYS = ["welcome", "visit", "stampNear", "stampComplete", "birthday", "referral", "inactivity", "promo"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];
export type NotificationTemplate = { enabled: boolean; title: string; body: string };

export type Settings = {
  pizzeriaName: string;
  city: string;
  stamps: {
    required: number;
    reward: string;
    rule: StampRule;
    minAmount: number;
    unitLabel: string;
    maxPerVisit: number;
  };
  welcomeStamps: number;
  birthdayStamps: number;
  referral: { enabled: boolean; referrerStamps: number; refereeStamps: number };
  nearRewardStamps: number;
  inactivityDays: number;
  notifications: Record<NotificationKey, NotificationTemplate>;
};

/** Libellés + variables disponibles, affichés dans l'admin. */
export const NOTIFICATION_INFO: Record<NotificationKey, { label: string; when: string; vars: string }> = {
  welcome: { label: "Bienvenue", when: "à l'activation des notifications après l'inscription", vars: "{prenom} {tampons} {total} {recompense}" },
  visit: { label: "Tampon ajouté", when: "après chaque passage scanné", vars: "{prenom} {gain} {tampons} {total} {reste}" },
  stampNear: { label: "Récompense proche", when: "quand il reste peu de tampons", vars: "{prenom} {reste} {recompense}" },
  stampComplete: { label: "Carte complète", when: "quand la carte est pleine", vars: "{prenom} {recompense}" },
  birthday: { label: "Anniversaire", when: "le jour de l'anniversaire (cron quotidien)", vars: "{prenom} {bonus} {tampons} {total}" },
  referral: { label: "Parrainage réussi", when: "quand un filleul s'inscrit", vars: "{prenom} {filleul} {bonus}" },
  inactivity: { label: "Relance inactivité", when: "après X jours sans visite (cron quotidien)", vars: "{prenom} {tampons} {total} {reste} {recompense}" },
  promo: { label: "Promotion", when: "au démarrage d'une promo (titre/message de la promo)", vars: "—" },
};

export const DEFAULT_SETTINGS: Settings = {
  pizzeriaName: process.env.NEXT_PUBLIC_PIZZERIA_NAME || "A la Bella Pizza",
  city: "",
  stamps: { required: 10, reward: "Pizza offerte", rule: "quantity", minAmount: 0, unitLabel: "pizza", maxPerVisit: 0 },
  welcomeStamps: 1,
  birthdayStamps: 2,
  referral: { enabled: true, referrerStamps: 2, refereeStamps: 1 },
  nearRewardStamps: 2,
  inactivityDays: 30,
  notifications: {
    welcome: { enabled: true, title: "Bienvenue {prenom} ! 🍕", body: "Votre carte est prête : {tampons}/{total} tampons. {recompense} vous attend au bout !" },
    visit: { enabled: true, title: "{gain} ✅", body: "Merci {prenom} ! Votre carte : {tampons}/{total}." },
    stampNear: { enabled: true, title: "Plus que {reste} tampon(s) ! 🔥", body: "{recompense} est presque à vous, {prenom}." },
    stampComplete: { enabled: true, title: "Carte complète ! 🎉", body: "{recompense} vous attend en caisse, {prenom}." },
    birthday: { enabled: true, title: "Joyeux anniversaire {prenom} ! 🎂", body: "On vous offre {bonus} tampon(s). Votre carte : {tampons}/{total}." },
    referral: { enabled: true, title: "Merci pour le parrainage ! 🙌", body: "{filleul} s'est inscrit grâce à vous : +{bonus} tampon(s)." },
    inactivity: { enabled: true, title: "Vous nous manquez ! 🍕", body: "{prenom}, plus que {reste} tampon(s) avant : {recompense}." },
    promo: { enabled: true, title: "", body: "" },
  },
};

const num = (v: unknown, def: number, min: number, max: number) => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const int = (v: unknown, def: number, min: number, max: number) => Math.round(num(v, def, min, max));
const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
const str = (v: unknown, def: string, max = 200) => (typeof v === "string" ? v.slice(0, max) : def);

/** Fusionne une saisie (partielle, non fiable) avec les valeurs par défaut et la borne. */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = DEFAULT_SETTINGS;
  const st = r.stamps ?? {};

  const notifications = {} as Settings["notifications"];
  for (const k of NOTIFICATION_KEYS) {
    const n = r.notifications?.[k];
    notifications[k] = {
      enabled: bool(n?.enabled, d.notifications[k].enabled),
      title: str(n?.title, d.notifications[k].title, 80),
      body: str(n?.body, d.notifications[k].body, 200),
    };
  }

  return {
    pizzeriaName: str(r.pizzeriaName, d.pizzeriaName, 50).trim() || d.pizzeriaName,
    city: str(r.city, d.city, 40).trim(),
    stamps: {
      required: int(st.required, d.stamps.required, 2, 50),
      reward: str(st.reward, d.stamps.reward, 60).trim() || d.stamps.reward,
      // L'ancienne règle « par tranche d'euros » bascule sur « par pizza »
      rule: st.rule === "visit" ? "visit" : "quantity",
      minAmount: num(st.minAmount, d.stamps.minAmount, 0, 500),
      unitLabel: str(st.unitLabel, d.stamps.unitLabel, 30).trim() || d.stamps.unitLabel,
      maxPerVisit: int(st.maxPerVisit, d.stamps.maxPerVisit, 0, 50),
    },
    welcomeStamps: int(r.welcomeStamps, d.welcomeStamps, 0, 20),
    birthdayStamps: int(r.birthdayStamps, d.birthdayStamps, 0, 20),
    referral: {
      enabled: bool(r.referral?.enabled, d.referral.enabled),
      referrerStamps: int(r.referral?.referrerStamps, d.referral.referrerStamps, 0, 20),
      refereeStamps: int(r.referral?.refereeStamps, d.referral.refereeStamps, 0, 20),
    },
    nearRewardStamps: int(r.nearRewardStamps, d.nearRewardStamps, 0, 10),
    inactivityDays: int(r.inactivityDays, d.inactivityDays, 7, 365),
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
