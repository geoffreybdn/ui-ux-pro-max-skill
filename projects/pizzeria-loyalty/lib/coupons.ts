import { sql } from "./db";
import { broadcast } from "./push";
import { creditStamps } from "./loyalty";
import { couponBenefit, couponConditions, type Coupon } from "./program";

export function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9-]/g, "");
}

export type CouponCheck =
  | { ok: true; coupon: Coupon; benefit: string; conditions: string }
  | { ok: false; reason: string; coupon?: Coupon; benefit?: string; conditions?: string };

/** Vérifie qu'un code est utilisable maintenant (et par ce client) sans le consommer. */
export async function checkCoupon(rawCode: string, customerId: number | null): Promise<CouponCheck> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: "Saisissez un code" };
  const [row] = await sql<Coupon & { today: number; used_by_customer: boolean }>`
    select c.id, c.code, c.title, c.kind, c.value::float as value, c.buy_qty, c.get_qty, c.item,
           c.min_amount::float as min_amount, c.conditions, c.once_per_customer, c.max_uses, c.uses,
           c.valid_days, c.starts_at, c.ends_at, c.active, c.show_in_app,
           extract(isodow from now() at time zone 'Europe/Paris')::int as today,
           exists (select 1 from coupon_redemptions r where r.coupon_id = c.id and r.customer_id = ${customerId}) as used_by_customer
    from coupons c where c.code = ${code}`;
  if (!row) return { ok: false, reason: "Code inconnu" };
  const { today, used_by_customer, ...coupon } = row;
  const info = { coupon, benefit: couponBenefit(coupon), conditions: couponConditions(coupon) };
  const now = Date.now();
  if (!coupon.active) return { ok: false, reason: "Code désactivé", ...info };
  if (new Date(coupon.starts_at).getTime() > now) return { ok: false, reason: "Ce code n'est pas encore valable", ...info };
  if (coupon.ends_at && new Date(coupon.ends_at).getTime() <= now) return { ok: false, reason: "Code expiré", ...info };
  if (coupon.max_uses !== null && coupon.uses >= coupon.max_uses) return { ok: false, reason: "Nombre maximum d'utilisations atteint", ...info };
  if (coupon.valid_days?.length && !coupon.valid_days.includes(today)) return { ok: false, reason: "Pas valable aujourd'hui", ...info };
  if (coupon.once_per_customer && !customerId) return { ok: false, reason: "Code limité à 1 utilisation par client : scannez la carte du client", ...info };
  if (coupon.kind === "stamps" && !customerId) return { ok: false, reason: "Scannez la carte du client pour créditer les tampons", ...info };
  if (coupon.once_per_customer && used_by_customer) return { ok: false, reason: "Déjà utilisé par ce client", ...info };
  return { ok: true, ...info };
}

/** Consomme le code (atomique : compteur + unicité par client), crédite les tampons bonus éventuels. */
export async function redeemCoupon(rawCode: string, customerId: number | null, staffId: number) {
  const check = await checkCoupon(rawCode, customerId);
  if (!check.ok) throw new Error(check.reason);
  const c = check.coupon;
  try {
    const [row] = await sql<{ id: number }>`
      with upd as (
        update coupons set uses = uses + 1
        where id = ${c.id} and active and (max_uses is null or uses < max_uses)
        returning id
      )
      insert into coupon_redemptions (coupon_id, customer_id, staff_id, once_key)
      select id, ${customerId}, ${staffId}, ${c.once_per_customer ? `${c.id}:${customerId}` : null} from upd
      returning id`;
    if (!row) throw new Error("Nombre maximum d'utilisations atteint");
  } catch (err) {
    if (String(err).includes("once_key")) throw new Error("Déjà utilisé par ce client");
    throw err;
  }
  let stampsBalance: number | null = null;
  if (c.kind === "stamps" && customerId && c.value > 0) {
    stampsBalance = await creditStamps(customerId, "bonus", Math.round(c.value), `Code ${c.code}`);
  }
  return { code: c.code, title: c.title, benefit: check.benefit, stampsBalance };
}

/** Offres visibles dans l'app client, avec l'état « déjà utilisé » pour ce client. */
export async function getCustomerOffers(customerId: number) {
  return sql<Coupon & { used: boolean }>`
    select c.id, c.code, c.title, c.kind, c.value::float as value, c.buy_qty, c.get_qty, c.item,
           c.min_amount::float as min_amount, c.conditions, c.once_per_customer, c.max_uses, c.uses,
           c.valid_days, c.starts_at, c.ends_at, c.active, c.show_in_app,
           (c.once_per_customer and exists (select 1 from coupon_redemptions r where r.coupon_id = c.id and r.customer_id = ${customerId})) as used
    from coupons c
    where c.active and c.show_in_app and c.starts_at <= now() and (c.ends_at is null or c.ends_at > now())
      and (c.max_uses is null or c.uses < c.max_uses)
    order by c.created_at desc`;
}

export async function listCoupons() {
  return sql<Coupon & { customers: number }>`
    select c.id, c.code, c.title, c.kind, c.value::float as value, c.buy_qty, c.get_qty, c.item,
           c.min_amount::float as min_amount, c.conditions, c.once_per_customer, c.max_uses, c.uses,
           c.valid_days, c.starts_at, c.ends_at, c.active, c.show_in_app,
           (select count(distinct customer_id)::int from coupon_redemptions r where r.coupon_id = c.id) as customers
    from coupons c order by c.active desc, c.created_at desc`;
}

export async function announceCoupon(c: Coupon) {
  const until = c.ends_at ? ` jusqu'au ${new Date(c.ends_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : "";
  return broadcast(
    { title: `🎁 ${c.title}`, body: `${couponBenefit(c)} avec le code ${c.code}${until}. Présentez-le en caisse !`, tag: `coupon-${c.id}` },
    `coupon:${c.id}`
  );
}

