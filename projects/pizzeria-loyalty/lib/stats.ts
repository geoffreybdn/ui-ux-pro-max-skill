import { sql } from "./db";

export const PERIODS = { "7": "7 derniers jours", "30": "30 derniers jours", "90": "3 derniers mois", "365": "12 derniers mois" } as const;
export type PeriodKey = keyof typeof PERIODS;

export function parsePeriod(v: string | undefined): PeriodKey {
  return v && v in PERIODS ? (v as PeriodKey) : "30";
}

const REWARD_TYPES = ["stamp_reward"];

export type Kpi = { value: number; change: number | null; series: number[] };

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Indicateurs clés + tendance sur la période (points par jour, semaine ou mois selon la durée). */
export async function getKpis(period: PeriodKey) {
  const days = Number(period);
  const unit = days <= 30 ? "day" : days <= 90 ? "week" : "month";

  const [[totals], series] = await Promise.all([
    sql<{
      customers: number; new_cur: number;
      active_cur: number; active_prev: number;
      visits_cur: number; visits_prev: number;
      rewards_cur: number; rewards_prev: number;
    }>`
      with p as (select now() - make_interval(days => ${days}) as cur, now() - make_interval(days => ${2 * days}) as prev)
      select
        (select count(*)::int from customers where role = 'customer') as customers,
        (select count(*)::int from customers, p where role = 'customer' and created_at >= p.cur) as new_cur,
        (select count(distinct customer_id)::int from transactions, p where type = 'earn' and created_at >= p.cur) as active_cur,
        (select count(distinct customer_id)::int from transactions, p where type = 'earn' and created_at >= p.prev and created_at < p.cur) as active_prev,
        (select coalesce(sum(stamps), 0)::int from transactions, p where type = 'earn' and created_at >= p.cur) as visits_cur,
        (select coalesce(sum(stamps), 0)::int from transactions, p where type = 'earn' and created_at >= p.prev and created_at < p.cur) as visits_prev,
        (select count(*)::int from transactions, p where type = any(${REWARD_TYPES}) and created_at >= p.cur) as rewards_cur,
        (select count(*)::int from transactions, p where type = any(${REWARD_TYPES}) and created_at >= p.prev and created_at < p.cur) as rewards_prev`,
    sql<{ registered: number; active: number; visits: number; rewards: number }>`
      with b as (
        select generate_series(
          date_trunc(${unit}, (now() at time zone 'Europe/Paris') - make_interval(days => ${days - 1})),
          date_trunc(${unit}, now() at time zone 'Europe/Paris'),
          ('1 ' || ${unit})::interval) as t
      ), x as (
        select type, customer_id, stamps, date_trunc(${unit}, created_at at time zone 'Europe/Paris') as t
        from transactions where created_at >= now() - make_interval(days => ${days + 31})
      )
      select
        (select count(*)::int from customers c where c.role = 'customer'
           and date_trunc(${unit}, c.created_at at time zone 'Europe/Paris') <= b.t) as registered,
        (select count(distinct customer_id)::int from x where x.type = 'earn' and x.t = b.t) as active,
        (select coalesce(sum(stamps), 0)::int from x where x.type = 'earn' and x.t = b.t) as visits,
        (select count(*)::int from x where x.type = any(${REWARD_TYPES}) and x.t = b.t) as rewards
      from b order by b.t`,
  ]);

  const base = totals.customers - totals.new_cur;
  return {
    registered: {
      value: totals.customers,
      change: base > 0 ? Math.round((totals.new_cur / base) * 100) : totals.new_cur > 0 ? null : 0,
      series: series.map((r) => r.registered),
    } satisfies Kpi,
    active: { value: totals.active_cur, change: pctChange(totals.active_cur, totals.active_prev), series: series.map((r) => r.active) } satisfies Kpi,
    visits: { value: totals.visits_cur, change: pctChange(totals.visits_cur, totals.visits_prev), series: series.map((r) => r.visits) } satisfies Kpi,
    rewards: { value: totals.rewards_cur, change: pctChange(totals.rewards_cur, totals.rewards_prev), series: series.map((r) => r.rewards) } satisfies Kpi,
  };
}

/** Nouveaux clients par mois sur les 12 derniers mois. */
export async function getMonthlySignups() {
  const rows = await sql<{ month: string; count: number }>`
    with m as (
      select generate_series(
        date_trunc('month', now() at time zone 'Europe/Paris') - interval '11 months',
        date_trunc('month', now() at time zone 'Europe/Paris'),
        interval '1 month') as t
    )
    select to_char(m.t, 'YYYY-MM') as month,
      (select count(*)::int from customers c where c.role = 'customer'
         and date_trunc('month', c.created_at at time zone 'Europe/Paris') = m.t) as count
    from m order by m.t`;
  return rows;
}

/** Répartition par activité : actifs (≤ 30 j), occasionnels (31–90 j), nouveaux (inscrits ≤ 30 j sans visite), inactifs. */
export async function getSegments() {
  const [r] = await sql<{ active: number; occasional: number; fresh: number; inactive: number }>`
    select
      count(*) filter (where last_visit_at >= now() - interval '30 days')::int as active,
      count(*) filter (where last_visit_at < now() - interval '30 days' and last_visit_at >= now() - interval '90 days')::int as occasional,
      count(*) filter (where last_visit_at is null and created_at >= now() - interval '30 days')::int as fresh,
      count(*) filter (where (last_visit_at is null and created_at < now() - interval '30 days')
                          or last_visit_at < now() - interval '90 days')::int as inactive
    from customers where role = 'customer'`;
  return [
    { label: "Clients actifs", value: r.active, hint: "venus il y a moins de 30 jours" },
    { label: "Clients occasionnels", value: r.occasional, hint: "dernière visite il y a 1 à 3 mois" },
    { label: "Nouveaux clients", value: r.fresh, hint: "inscrits ce mois, pas encore venus" },
    { label: "Clients inactifs", value: r.inactive, hint: "plus de 3 mois sans visite" },
  ];
}

const SOURCE_LABELS: Record<string, string> = {
  qr: "QR code magasin",
  web: "Lien web",
  social: "Réseaux sociaux",
  parrainage: "Parrainage",
  code: "Code boutique",
  ancienne_carte: "Ancienne carte",
};

export async function getSignupSources() {
  const rows = await sql<{ source: string; count: number }>`
    select coalesce(signup_source,
             case when referred_by is not null then 'parrainage'
                  when signup_code_id is not null then 'code'
                  when exists (select 1 from legacy_customers l where l.claimed_by = customers.id) then 'ancienne_carte'
                  else 'web' end) as source,
           count(*)::int as count
    from customers where role = 'customer' group by 1 order by 2 desc`;
  return rows.map((r) => ({ label: SOURCE_LABELS[r.source] ?? "Autre", value: r.count }));
}

const DEVICE_LABELS: Record<string, string> = { ios: "iPhone (iOS)", android: "Android", ordinateur: "Ordinateur", autre: "Autre" };

export async function getDevices() {
  const rows = await sql<{ device: string; count: number }>`
    select coalesce(signup_device, 'autre') as device, count(*)::int as count
    from customers where role = 'customer' group by 1`;
  const order = ["ios", "android", "ordinateur", "autre"];
  return order.map((k) => ({ key: k, label: DEVICE_LABELS[k], value: rows.find((r) => r.device === k)?.count ?? 0 }));
}

export async function getTopCustomers() {
  return sql<{ id: number; name: string; total: number; rewards: number }>`
    select c.id, c.name,
           coalesce(sum(t.stamps) filter (where t.stamps > 0), 0)::int as total,
           count(*) filter (where t.type = 'stamp_reward')::int as rewards
    from customers c left join transactions t on t.customer_id = c.id
    where c.role = 'customer'
    group by c.id
    order by total desc, c.created_at asc limit 5`;
}

/** Où en sont les cartes : clients par niveau de remplissage de la carte en cours. */
export async function getCardProgress(required: number) {
  const [r] = await sql<{ full: number; q4: number; q3: number; q2: number; q1: number }>`
    select
      count(*) filter (where stamps >= ${required})::int as full,
      count(*) filter (where stamps < ${required} and stamps >= ceil(${required} * 0.75))::int as q4,
      count(*) filter (where stamps < ceil(${required} * 0.75) and stamps >= ceil(${required} * 0.5))::int as q3,
      count(*) filter (where stamps < ceil(${required} * 0.5) and stamps >= 1)::int as q2,
      count(*) filter (where stamps = 0)::int as q1
    from customers where role = 'customer'`;
  return [
    { label: "Carte complète (cadeau à offrir)", value: r.full },
    { label: "Presque pleine (≥ 75 %)", value: r.q4 },
    { label: "À moitié (50–75 %)", value: r.q3 },
    { label: "Commencée (< 50 %)", value: r.q2 },
    { label: "Aucun tampon", value: r.q1 },
  ];
}

export async function getRecentCampaigns() {
  return sql<{ id: number; title: string; body: string; audience: string; sent: number; created_at: string }>`
    select id, title, body, audience, sent, created_at from notifications_log order by created_at desc limit 4`;
}

export type ActivityItem = { key: string; name: string; label: string; kind: "new" | "earn" | "reward" | "bonus"; at: string };

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const rows = await sql<{ key: string; name: string; type: string; points: number; stamps: number; cashback_cents: number; note: string | null; at: string }>`
    (select 'c' || id as key, name, 'signup' as type, 0 as points, 0 as stamps, 0 as cashback_cents, null as note, created_at as at
       from customers where role = 'customer' order by created_at desc limit 6)
    union all
    (select 't' || t.id, c.name, t.type, t.points, t.stamps, t.cashback_cents, t.note, t.created_at
       from transactions t join customers c on c.id = t.customer_id order by t.created_at desc limit 6)
    order by at desc limit 6`;
  const LABELS: Record<string, string> = { welcome: "bienvenue", birthday: "anniversaire", referral: "parrainage", bonus: "code", import: "ancienne carte", adjust: "correction" };
  return rows.map((r) => {
    const n = Math.abs(r.stamps);
    const tampons = `${n} tampon${n > 1 ? "s" : ""}`;
    if (r.type === "signup") return { key: r.key, name: r.name, label: "Nouveau client", kind: "new" as const, at: r.at };
    if (r.type === "stamp_reward") return { key: r.key, name: r.name, label: `A reçu : ${r.note ?? "sa récompense"}`, kind: "reward" as const, at: r.at };
    if (r.type === "earn") return { key: r.key, name: r.name, label: `+${tampons}`, kind: "earn" as const, at: r.at };
    return { key: r.key, name: r.name, label: `${r.stamps < 0 ? "−" : "+"}${tampons} · ${LABELS[r.type] ?? r.type}`, kind: "bonus" as const, at: r.at };
  });
}
