import { sql } from "./db";

let promoReady: Promise<void> | null = null;

/**
 * Ajoute à la volée les colonnes v6 de « promotions » si la base n'a pas encore été migrée
 * (même contenu que db/schema.sql). Une seule vérification par instance serveur.
 */
export function ensurePromoSchema() {
  promoReady ??= (async () => {
    const [r] = await sql<{ n: number }>`
      select count(*)::int as n from information_schema.columns
      where table_name = 'promotions' and column_name in ('kind', 'channel', 'value', 'buy_qty', 'get_qty', 'item', 'conditions')`;
    if (r.n === 7) return;
    await sql`alter table promotions add column if not exists kind text not null default 'stamps'`;
    await sql`alter table promotions add column if not exists channel text not null default 'all'`;
    await sql`alter table promotions add column if not exists value numeric(8, 2) not null default 0`;
    await sql`alter table promotions add column if not exists buy_qty integer not null default 1`;
    await sql`alter table promotions add column if not exists get_qty integer not null default 1`;
    await sql`alter table promotions add column if not exists item text not null default 'pizza'`;
    await sql`alter table promotions add column if not exists conditions text`;
  })().catch((err) => {
    promoReady = null;
    throw err;
  });
  return promoReady;
}
