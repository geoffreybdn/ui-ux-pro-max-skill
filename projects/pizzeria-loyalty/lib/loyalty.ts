import { randomInt } from "node:crypto";
import { sql, type Promotion, type Reward } from "./db";
import { POINTS_PER_EURO } from "./config";
import { broadcast, pushToCustomer, pushToCustomers } from "./push";

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

export function computePoints(amountCents: number, extraPoints: number, multiplier: number) {
  const base = Math.floor((amountCents / 100) * POINTS_PER_EURO) + extraPoints;
  return Math.max(0, Math.round(base * multiplier));
}

/** Crédite des points après un achat (applique automatiquement la promo en cours). */
export async function earnPoints(opts: {
  customerId: number;
  amountCents: number;
  extraPoints?: number;
  staffId: number;
  note?: string;
}) {
  const promo = await getActivePromotion();
  const multiplier = promo ? Number(promo.multiplier) : 1;
  const points = computePoints(opts.amountCents, opts.extraPoints ?? 0, multiplier);
  if (points <= 0) throw new Error("Aucun point à créditer");

  const [row] = await sql<{ points: number; previous: number }>`
    with tx as (
      insert into transactions (customer_id, type, points, amount_cents, multiplier, promotion_id, staff_id, note)
      values (${opts.customerId}, 'earn', ${points}, ${opts.amountCents}, ${multiplier}, ${promo?.id ?? null},
              ${opts.staffId}, ${opts.note ?? null})
      returning customer_id
    )
    update customers c
       set points = c.points + ${points},
           lifetime_points = c.lifetime_points + ${points},
           last_visit_at = now()
      from tx where c.id = tx.customer_id
    returning c.points, c.points - ${points} as previous`;
  if (!row) throw new Error("Client introuvable");

  // Notifications automatiques (non bloquantes pour la caisse)
  const unlocked = (await getRewards()).filter((r) => row.previous < r.cost && row.points >= r.cost);
  const promoText = promo ? ` (promo x${multiplier} 🔥)` : "";
  const notifications = [
    pushToCustomer(opts.customerId, {
      title: `+${points} points${promoText}`,
      body: `Merci pour votre visite ! Vous avez maintenant ${row.points} points.`,
      tag: "points",
    }),
  ];
  if (unlocked.length) {
    notifications.push(
      pushToCustomer(opts.customerId, {
        title: "🎁 Récompense débloquée !",
        body: `Vous pouvez maintenant obtenir : ${unlocked.map((r) => r.name).join(", ")}.`,
        tag: "reward",
      })
    );
  }
  await Promise.allSettled(notifications);

  return { points, balance: row.points, multiplier, promotion: promo?.title ?? null };
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
  const promos = await sql<Promotion>`
    update promotions set notified_at = now()
    where active and notified_at is null and starts_at <= now() and ends_at > now()
    returning *`;
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

/** Relance les clients qui ne sont pas venus depuis `days` jours (au plus une fois par période). */
export async function remindInactiveCustomers(days: number) {
  const inactive = await sql<{ id: number }>`
    update customers set last_reminder_at = now()
    where role = 'customer'
      and coalesce(last_visit_at, created_at) < now() - make_interval(days => ${days})
      and (last_reminder_at is null or last_reminder_at < now() - make_interval(days => ${days}))
      and exists (select 1 from push_subscriptions s where s.customer_id = customers.id)
    returning id`;
  const promo = await getActivePromotion();
  const sent = await pushToCustomers(
    inactive.map((c) => c.id),
    {
      title: "Vous nous manquez ! 🍕",
      body: promo
        ? `${promo.title} : vos points sont multipliés par ${Number(promo.multiplier)} en ce moment.`
        : "Passez nous voir, votre carte de fidélité vous attend.",
      tag: "reminder",
    }
  );
  return { customers: inactive.length, sent };
}
