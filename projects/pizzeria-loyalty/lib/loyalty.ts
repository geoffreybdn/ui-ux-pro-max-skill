import { randomInt } from "node:crypto";
import { sql, type Promotion, type Reward } from "./db";
import { broadcast, pushToCustomer } from "./push";
import { notify, notifyEach } from "./notify";
import { computeVisitGain, describeGain, firstName, formatEuros, getSettings, tierFor } from "./settings";

const CARD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour la saisie manuelle

export function generateCardCode() {
  let code = "";
  for (let i = 0; i < 8; i++) code += CARD_ALPHABET[randomInt(CARD_ALPHABET.length)];
  return `PZ-${code}`;
}

/** Normalise ce que renvoie le scanner (QR brut, URL, saisie manuelle). */
export function parseCardCode(raw: string): string {
  const match = raw.toUpperCase().match(/PZ-?([A-Z0-9]{8})/);
  return match ? `PZ-${match[1]}` : raw.trim().toUpperCase();
}

/** Promotion en cours avec le multiplicateur le plus élevé. */
export async function getActivePromotion(): Promise<Promotion | null> {
  const [promo] = await sql<Promotion>`
    select * from promotions
    where active and starts_at <= now() and ends_at > now()
    order by multiplier desc, ends_at asc limit 1`;
  return promo ?? null;
}

export async function getRewards(): Promise<Reward[]> {
  return sql<Reward>`select id, name, cost, active from rewards where active order by cost asc`;
}

/**
 * Passage en caisse : crédite points, tampons et cashback en une seule écriture,
 * puis déclenche les notifications automatiques (récompense proche/débloquée, carte tampons, niveau).
 */
export async function recordVisit(opts: { customerId: number; amountCents: number; extraPoints?: number; staffId: number }) {
  const [s, promo, rewards] = await Promise.all([getSettings(), getActivePromotion(), getRewards()]);
  const [before] = await sql<{ name: string; points: number; stamps: number; lifetime_points: number }>`
    select name, points, stamps, lifetime_points from customers where id = ${opts.customerId}`;
  if (!before) throw new Error("Client introuvable");

  const promoMultiplier = promo ? Number(promo.multiplier) : 1;
  const tier = tierFor(s, before.lifetime_points);
  const gain = computeVisitGain(s, {
    amountCents: opts.amountCents,
    extraPoints: opts.extraPoints ?? 0,
    promoMultiplier,
    tierMultiplier: tier?.multiplier ?? 1,
  });
  if (!gain.points && !gain.stamps && !gain.cashbackCents) {
    throw new Error(
      s.stamps.enabled && !s.points.enabled && !s.cashback.enabled
        ? `Montant minimum pour un tampon : ${formatEuros(s.stamps.minAmount * 100)}`
        : "Rien à créditer"
    );
  }

  const [after] = await sql<{ points: number; stamps: number; cashback_cents: number; lifetime_points: number }>`
    with tx as (
      insert into transactions (customer_id, type, points, stamps, cashback_cents, amount_cents, multiplier, promotion_id, staff_id)
      values (${opts.customerId}, 'earn', ${gain.points}, ${gain.stamps}, ${gain.cashbackCents}, ${opts.amountCents},
              ${promoMultiplier}, ${promo?.id ?? null}, ${opts.staffId})
      returning customer_id
    )
    update customers c
       set points = c.points + ${gain.points},
           lifetime_points = c.lifetime_points + ${gain.points},
           stamps = c.stamps + ${gain.stamps},
           cashback_cents = c.cashback_cents + ${gain.cashbackCents},
           last_visit_at = now()
      from tx where c.id = tx.customer_id
    returning c.points, c.stamps, c.cashback_cents, c.lifetime_points`;

  // ── Notifications automatiques ──
  const prenom = firstName(before.name);
  const jobs: Promise<unknown>[] = [
    notify(opts.customerId, "visit", {
      prenom,
      gain: describeGain(gain) + (promo ? ` (promo x${promoMultiplier})` : ""),
      solde: after.points,
    }),
  ];

  const unlocked = rewards.filter((r) => before.points < r.cost && after.points >= r.cost);
  if (unlocked.length) {
    jobs.push(notify(opts.customerId, "reward", { prenom, recompense: unlocked.map((r) => r.name).join(", "), solde: after.points }));
  } else if (s.nearRewardPoints > 0) {
    const next = rewards.find((r) => r.cost > after.points);
    if (next && next.cost - after.points <= s.nearRewardPoints && next.cost - before.points > s.nearRewardPoints) {
      jobs.push(
        notify(opts.customerId, "nearReward", { prenom, reste: next.cost - after.points, recompense: next.name, solde: after.points })
      );
    }
  }

  if (gain.stamps) {
    const req = s.stamps.required;
    if (before.stamps < req && after.stamps >= req) {
      jobs.push(notify(opts.customerId, "stampComplete", { prenom, recompense: s.stamps.reward }));
    } else if (after.stamps === req - 1) {
      jobs.push(notify(opts.customerId, "stampNear", { prenom, recompense: s.stamps.reward }));
    }
  }

  const newTier = tierFor(s, after.lifetime_points);
  if (tier && newTier && newTier.name !== tier.name) {
    jobs.push(notify(opts.customerId, "tierUp", { prenom, niveau: newTier.name }));
  }
  await Promise.allSettled(jobs);

  return {
    ...gain,
    balance: after.points,
    stampsBalance: after.stamps,
    cashbackBalance: after.cashback_cents,
    multiplier: promoMultiplier,
    tierMultiplier: tier?.multiplier ?? 1,
    promotion: promo?.title ?? null,
    summary: describeGain(gain),
  };
}

/** Valide la carte tampons complète (retire `required` tampons). */
export async function redeemStampCard(opts: { customerId: number; staffId: number }) {
  const s = await getSettings();
  const req = s.stamps.required;
  const [row] = await sql<{ stamps: number }>`
    with upd as (
      update customers set stamps = stamps - ${req}, last_visit_at = now()
      where id = ${opts.customerId} and stamps >= ${req}
      returning id, stamps
    ), tx as (
      insert into transactions (customer_id, type, points, stamps, staff_id, note)
      select id, 'stamp_reward', 0, ${-req}, ${opts.staffId}, ${s.stamps.reward} from upd
    )
    select stamps from upd`;
  if (!row) throw new Error(`Il faut ${req} tampons`);
  await pushToCustomer(opts.customerId, {
    title: `${s.stamps.reward} 🍕`,
    body: "Bon appétit ! Votre nouvelle carte tampons commence.",
    tag: "stamp",
  }).catch(() => 0);
  return { stampsBalance: row.stamps, reward: s.stamps.reward };
}

/** Utilise tout ou partie du cashback comme réduction. */
export async function useCashback(opts: { customerId: number; cents: number; staffId: number }) {
  const s = await getSettings();
  if (!s.cashback.enabled) throw new Error("Le cashback est désactivé");
  if (!(opts.cents > 0)) throw new Error("Montant invalide");
  const min = Math.round(s.cashback.minRedeem * 100);
  const [row] = await sql<{ cashback_cents: number }>`
    with upd as (
      update customers set cashback_cents = cashback_cents - ${opts.cents}
      where id = ${opts.customerId} and cashback_cents >= ${opts.cents} and cashback_cents >= ${min}
      returning id, cashback_cents
    ), tx as (
      insert into transactions (customer_id, type, points, cashback_cents, staff_id, note)
      select id, 'cashback_use', 0, ${-opts.cents}, ${opts.staffId}, 'Cashback utilisé' from upd
    )
    select cashback_cents from upd`;
  if (!row) throw new Error(`Solde insuffisant (minimum d'utilisation : ${formatEuros(min)})`);
  return { cashbackBalance: row.cashback_cents, used: formatEuros(opts.cents) };
}

/** Crédite un bonus (bienvenue, anniversaire, parrainage…) et renvoie le nouveau solde. */
export async function creditBonus(customerId: number, type: "welcome" | "birthday" | "referral" | "bonus", points: number, note: string) {
  if (points <= 0) return null;
  const [row] = await sql<{ points: number }>`
    with tx as (
      insert into transactions (customer_id, type, points, note) values (${customerId}, ${type}, ${points}, ${note})
      returning customer_id
    )
    update customers c set points = c.points + ${points}, lifetime_points = c.lifetime_points + ${points}
    from tx where c.id = tx.customer_id returning c.points`;
  return row?.points ?? null;
}


export async function redeemReward(opts: { customerId: number; rewardId: number; staffId: number }) {
  const [reward] = await sql<Reward>`select * from rewards where id = ${opts.rewardId} and active`;
  if (!reward) throw new Error("Récompense introuvable");

  const [row] = await sql<{ points: number }>`
    with upd as (
      update customers set points = points - ${reward.cost}, last_visit_at = now()
      where id = ${opts.customerId} and points >= ${reward.cost}
      returning id, points
    ), tx as (
      insert into transactions (customer_id, type, points, reward_id, staff_id, note)
      select id, 'redeem', ${-reward.cost}, ${reward.id}, ${opts.staffId}, ${reward.name} from upd
    )
    select points from upd`;
  if (!row) throw new Error("Points insuffisants");

  await pushToCustomer(opts.customerId, {
    title: `${reward.name} 🍕`,
    body: `Bon appétit ! Il vous reste ${row.points} points.`,
    tag: "redeem",
  }).catch(() => 0);
  return { balance: row.points, reward: reward.name };
}

export async function adjustPoints(opts: { customerId: number; points: number; staffId: number; note: string }) {
  const [row] = await sql<{ points: number }>`
    with tx as (
      insert into transactions (customer_id, type, points, staff_id, note)
      values (${opts.customerId}, 'adjust', ${opts.points}, ${opts.staffId}, ${opts.note})
      returning customer_id
    )
    update customers c set points = greatest(0, c.points + ${opts.points})
    from tx where c.id = tx.customer_id returning c.points`;
  if (!row) throw new Error("Client introuvable");
  return { balance: row.points };
}

/**
 * Rattache les points de l'ancienne carte (import CSV) aux comptes existants
 * ayant la même adresse e-mail. Chaque ligne importée n'est créditée qu'une fois.
 */
export async function claimLegacyPoints(emails: string[]) {
  if (emails.length === 0) return [] as { id: number; points: number; credited: number }[];
  return sql<{ id: number; points: number; credited: number }>`
    with claimed as (
      update legacy_customers l
         set claimed_by = c.id, claimed_at = now()
        from customers c
       where c.email = l.email and l.claimed_by is null and l.email = any(${emails})
      returning c.id as customer_id, l.points, l.phone
    ), tx as (
      insert into transactions (customer_id, type, points, note)
      select customer_id, 'import', points, 'Points de l''ancienne carte de fidélité'
        from claimed where points <> 0
    )
    update customers c
       set points = greatest(0, c.points + cl.points),
           lifetime_points = c.lifetime_points + greatest(cl.points, 0),
           phone = coalesce(c.phone, nullif(cl.phone, ''))
      from claimed cl where c.id = cl.customer_id
    returning c.id, c.points, cl.points as credited`;
}

export type LegacyRow = { email: string; name: string | null; phone: string | null; points: number };

export async function importLegacyCustomers(rows: LegacyRow[]) {
  let credited: { id: number; points: number; credited: number }[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const emails = chunk.map((r) => r.email);
    // Réimporter le même fichier met à jour les lignes non encore réclamées, sans double crédit.
    await sql`
      insert into legacy_customers (email, name, phone, points)
      select * from unnest(${emails}::text[], ${chunk.map((r) => r.name)}::text[],
                           ${chunk.map((r) => r.phone)}::text[], ${chunk.map((r) => r.points)}::int[])
      on conflict (email) do update
        set name = excluded.name, phone = excluded.phone, points = excluded.points, imported_at = now()
        where legacy_customers.claimed_by is null`;
    credited = credited.concat(await claimLegacyPoints(emails));
  }

  // Les clients déjà inscrits reçoivent une notification avec leurs points récupérés.
  await Promise.allSettled(
    credited
      .filter((c) => c.credited > 0)
      .map((c) =>
      pushToCustomer(c.id, {
        title: "Vos anciens points sont arrivés 🎉",
        body: `${c.credited} points de votre ancienne carte ont été ajoutés. Solde : ${c.points} points.`,
      })
    )
  );
  return { imported: rows.length, creditedAccounts: credited.length };
}


/** Envoie la notification des promotions qui ont démarré et n'ont pas encore été annoncées. */
export async function announceStartedPromotions() {
  const s = await getSettings();
  const promos = await sql<Promotion>`
    update promotions set notified_at = now()
    where active and notified_at is null and starts_at <= now() and ends_at > now()
    returning *`;
  if (!s.notifications.promo.enabled) return { promotions: promos.length, sent: 0 };
  let sent = 0;
  for (const p of promos) {
    const until = new Date(p.ends_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    sent += await broadcast(
      {
        title: p.title,
        body: p.message || `Points x${Number(p.multiplier)} sur toutes vos commandes jusqu'au ${until} !`,
        tag: `promo-${p.id}`,
      },
      `promo:${p.id}`
    );
  }
  return { promotions: promos.length, sent };
}

/** Relance les clients qui ne sont pas venus depuis X jours (au plus une fois par période). */
export async function remindInactiveCustomers() {
  const s = await getSettings();
  const days = s.inactivityDays;
  if (!s.notifications.inactivity.enabled) return { customers: 0, sent: 0 };
  const inactive = await sql<{ id: number; name: string; points: number }>`
    update customers set last_reminder_at = now()
    where role = 'customer'
      and coalesce(last_visit_at, created_at) < now() - make_interval(days => ${days})
      and (last_reminder_at is null or last_reminder_at < now() - make_interval(days => ${days}))
      and exists (select 1 from push_subscriptions s where s.customer_id = customers.id)
    returning id, name, points`;
  const sent = await notifyEach(
    "inactivity",
    inactive.map((c) => ({ id: c.id, vars: { prenom: firstName(c.name), solde: c.points } }))
  );
  return { customers: inactive.length, sent };
}

/**
 * Anniversaires du jour (heure de Paris) : bonus crédité une fois par an + notification.
 * Les clients nés un 29 février sont fêtés le 28 février les années non bissextiles.
 */
export async function celebrateBirthdays() {
  const s = await getSettings();
  const bonus = s.birthdayBonus;
  const rows = await sql<{ id: number; name: string; points: number }>`
    with today as (select (now() at time zone 'Europe/Paris')::date as d),
    b as (
      update customers c
         set last_birthday_year = extract(year from t.d)::int,
             points = c.points + ${bonus},
             lifetime_points = c.lifetime_points + ${bonus}
        from today t
       where c.birthdate is not null
         and coalesce(c.last_birthday_year, 0) < extract(year from t.d)
         and (
           to_char(c.birthdate, 'MM-DD') = to_char(t.d, 'MM-DD')
           or (to_char(c.birthdate, 'MM-DD') = '02-29' and to_char(t.d, 'MM-DD') = '02-28'
               and extract(day from date_trunc('year', t.d) + interval '1 month 28 days') <> 29)
         )
      returning c.id, c.name, c.points
    ), tx as (
      insert into transactions (customer_id, type, points, note)
      select id, 'birthday', ${bonus}, 'Cadeau d''anniversaire' from b where ${bonus} > 0
    )
    select * from b`;
  const sent = await notifyEach(
    "birthday",
    rows.map((c) => ({ id: c.id, vars: { prenom: firstName(c.name), bonus, solde: c.points } }))
  );
  return { customers: rows.length, sent };
}
