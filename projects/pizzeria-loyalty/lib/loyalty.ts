import { randomInt } from "node:crypto";
import { sql, type Promotion } from "./db";
import { broadcast, pushToCustomer } from "./push";
import { notify, notifyEach } from "./notify";
import { applyPromo, cardState, firstName, getSettings, plural } from "./settings";

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

/** Notifications « récompense proche » / « carte complète » après un gain de tampons. */
async function notifyProgress(customerId: number, name: string, before: number, after: number) {
  const s = await getSettings();
  const req = s.stamps.required;
  const prenom = firstName(name);
  const b = cardState(before, req);
  const a = cardState(after, req);
  if (a.available > b.available) {
    await notify(customerId, "stampComplete", { prenom, recompense: s.stamps.reward });
  } else if (s.nearRewardStamps > 0 && a.remaining <= s.nearRewardStamps && b.remaining > s.nearRewardStamps) {
    await notify(customerId, "stampNear", { prenom, reste: a.remaining, recompense: s.stamps.reward });
  }
}

/**
 * Passage en caisse : crédite le nombre de tampons choisi par l'équipe
 * (plafond par passage et promo en cours appliqués automatiquement).
 */
export async function recordVisit(opts: { customerId: number; count: number; amountCents?: number; staffId: number }) {
  const [s, promo] = await Promise.all([getSettings(), getActivePromotion()]);
  const [before] = await sql<{ name: string; stamps: number }>`select name, stamps from customers where id = ${opts.customerId}`;
  if (!before) throw new Error("Client introuvable");

  const promoMultiplier = promo ? Number(promo.multiplier) : 1;
  const gained = applyPromo(s.stamps, opts.count, promoMultiplier);
  if (gained <= 0) throw new Error("Choisissez au moins 1 tampon");

  const [after] = await sql<{ stamps: number }>`
    with tx as (
      insert into transactions (customer_id, type, points, stamps, amount_cents, multiplier, promotion_id, staff_id)
      values (${opts.customerId}, 'earn', 0, ${gained}, ${opts.amountCents || null}, ${promoMultiplier}, ${promo?.id ?? null}, ${opts.staffId})
      returning customer_id
    )
    update customers c set stamps = c.stamps + ${gained}, last_visit_at = now()
    from tx where c.id = tx.customer_id
    returning c.stamps`;

  const st = cardState(after.stamps, s.stamps.required);
  const capped = s.stamps.maxPerVisit > 0 && opts.count > s.stamps.maxPerVisit;
  const gain = `+${plural(gained, "tampon")}${promo ? ` (promo x${promoMultiplier})` : ""}`;
  await Promise.allSettled([
    notify(opts.customerId, "visit", {
      prenom: firstName(before.name), gain, tampons: st.available ? s.stamps.required : st.onCard, total: s.stamps.required, reste: st.remaining,
    }),
    notifyProgress(opts.customerId, before.name, before.stamps, after.stamps),
  ]);

  return {
    stamps: gained,
    stampsBalance: after.stamps,
    multiplier: promoMultiplier,
    promotion: promo?.title ?? null,
    summary: gain + (capped ? ` — plafond de ${s.stamps.maxPerVisit} par passage appliqué` : ""),
  };
}

/** Retire des tampons (erreur de saisie, annulation…). Jamais en dessous de zéro. */
export async function removeStamps(opts: { customerId: number; count: number; staffId: number; note: string }) {
  const count = Math.trunc(opts.count);
  if (count <= 0) throw new Error("Choisissez au moins 1 tampon à retirer");
  const [row] = await sql<{ stamps: number }>`
    with upd as (
      update customers set stamps = stamps - ${count}
      where id = ${opts.customerId} and stamps >= ${count}
      returning id, stamps
    ), tx as (
      insert into transactions (customer_id, type, points, stamps, staff_id, note)
      select id, 'adjust', 0, ${-count}, ${opts.staffId}, ${opts.note} from upd
    )
    select stamps from upd`;
  if (!row) {
    const [c] = await sql<{ stamps: number }>`select stamps from customers where id = ${opts.customerId}`;
    throw new Error(c ? `Impossible : le client n'a que ${plural(c.stamps, "tampon")}` : "Client introuvable");
  }
  return { stampsBalance: row.stamps, summary: `−${plural(count, "tampon")}` };
}

/** Offre la récompense d'une carte complète (retire `required` tampons). */
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
    body: "Bon appétit ! Votre nouvelle carte commence.",
    tag: "stamp",
  }).catch(() => 0);
  return { stampsBalance: row.stamps, reward: s.stamps.reward };
}

/** Crédite des tampons offerts (bienvenue, parrainage, code…) et renvoie le nouveau solde. */
export async function creditStamps(
  customerId: number,
  type: "welcome" | "referral" | "bonus",
  stamps: number,
  note: string
) {
  if (stamps <= 0) return null;
  const [row] = await sql<{ name: string; stamps: number }>`
    with tx as (
      insert into transactions (customer_id, type, points, stamps, note) values (${customerId}, ${type}, 0, ${stamps}, ${note})
      returning customer_id
    )
    update customers c set stamps = c.stamps + ${stamps}
    from tx where c.id = tx.customer_id returning c.name, c.stamps`;
  if (row) await notifyProgress(customerId, row.name, row.stamps - stamps, row.stamps).catch(() => 0);
  return row?.stamps ?? null;
}

/**
 * Rattache les tampons de l'ancienne carte (import CSV) aux comptes existants
 * ayant la même adresse e-mail. Chaque ligne importée n'est créditée qu'une fois.
 */
export async function claimLegacyStamps(emails: string[]) {
  if (emails.length === 0) return [] as { id: number; stamps: number; credited: number }[];
  return sql<{ id: number; stamps: number; credited: number }>`
    with claimed as (
      update legacy_customers l
         set claimed_by = c.id, claimed_at = now()
        from customers c
       where c.email = l.email and l.claimed_by is null and l.email = any(${emails})
      returning c.id as customer_id, l.points as stamps, l.phone
    ), tx as (
      insert into transactions (customer_id, type, points, stamps, note)
      select customer_id, 'import', 0, stamps, 'Tampons de l''ancienne carte'
        from claimed where stamps <> 0
    )
    update customers c
       set stamps = greatest(0, c.stamps + cl.stamps),
           phone = coalesce(c.phone, nullif(cl.phone, ''))
      from claimed cl where c.id = cl.customer_id
    returning c.id, c.stamps, cl.stamps as credited`;
}

export type LegacyRow = { email: string; name: string | null; phone: string | null; stamps: number };

export async function importLegacyCustomers(rows: LegacyRow[]) {
  let credited: { id: number; stamps: number; credited: number }[] = [];
  let created = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const emails = chunk.map((r) => r.email);
    // Réimporter le même fichier met à jour les lignes non encore réclamées, sans double crédit.
    await sql`
      insert into legacy_customers (email, name, phone, points)
      select * from unnest(${emails}::text[], ${chunk.map((r) => r.name)}::text[],
                           ${chunk.map((r) => r.phone)}::text[], ${chunk.map((r) => r.stamps)}::int[])
      on conflict (email) do update
        set name = excluded.name, phone = excluded.phone, points = excluded.points, imported_at = now()
        where legacy_customers.claimed_by is null`;
    // Les clients pas encore inscrits deviennent des comptes « en attente » : visibles dans l'admin et au scanner.
    const inserted = await sql<{ id: number }>`
      insert into customers (email, name, phone, password_hash, card_code, pending, signup_source)
      select l.email, coalesce(nullif(trim(l.name), ''), split_part(l.email, '@', 1)), nullif(l.phone, ''), '',
             'PZ-' || (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
                       from generate_series(1, 8 + 0 * length(l.email))),
             true, 'ancienne_carte'
        from legacy_customers l
       where l.email = any(${emails}) and l.claimed_by is null
         and not exists (select 1 from customers c where c.email = l.email)
      on conflict do nothing
      returning id`;
    created += inserted.length;
    credited = credited.concat(await claimLegacyStamps(emails));
  }

  // Les clients déjà inscrits sont prévenus que leurs tampons sont arrivés.
  await Promise.allSettled(
    credited
      .filter((c) => c.credited > 0)
      .map((c) =>
        pushToCustomer(c.id, {
          title: "Vos anciens tampons sont arrivés 🎉",
          body: `${plural(c.credited, "tampon")} de votre ancienne carte ont été ajoutés.`,
        })
      )
  );
  return { imported: rows.length, createdAccounts: created, creditedAccounts: credited.length - created };
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
        body: p.message || `Tampons x${Number(p.multiplier)} sur toutes vos commandes jusqu'au ${until} !`,
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
  const inactive = await sql<{ id: number; name: string; stamps: number }>`
    update customers set last_reminder_at = now()
    where role = 'customer'
      and coalesce(last_visit_at, created_at) < now() - make_interval(days => ${days})
      and (last_reminder_at is null or last_reminder_at < now() - make_interval(days => ${days}))
      and exists (select 1 from push_subscriptions s where s.customer_id = customers.id)
    returning id, name, stamps`;
  const sent = await notifyEach(
    "inactivity",
    inactive.map((c) => {
      const st = cardState(c.stamps, s.stamps.required);
      return {
        id: c.id,
        vars: { prenom: firstName(c.name), tampons: st.onCard, total: s.stamps.required, reste: st.remaining, recompense: s.stamps.reward },
      };
    })
  );
  return { customers: inactive.length, sent };
}
