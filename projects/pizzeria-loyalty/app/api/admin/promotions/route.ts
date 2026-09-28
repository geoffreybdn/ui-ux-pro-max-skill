import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { announceStartedPromotions } from "@/lib/loyalty";

export const GET = handle(async () => {
  await assertRole(["admin"]);
  const promotions = await sql`select * from promotions order by starts_at desc limit 100`;
  return NextResponse.json({ promotions });
});

export const POST = handle(async (req: Request) => {
  await assertRole(["admin"]);
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim() || null;
  const multiplier = Number(body.multiplier || 2);
  const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
  const endsAt = new Date(body.endsAt);

  if (!title) bad("Titre requis");
  if (!(multiplier > 1 && multiplier <= 10)) bad("Multiplicateur entre 1 et 10");
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) bad("Dates invalides");

  const [promotion] = await sql`
    insert into promotions (title, message, multiplier, starts_at, ends_at)
    values (${title}, ${message}, ${multiplier}, ${startsAt.toISOString()}, ${endsAt.toISOString()})
    returning *`;

  // Si la promo commence maintenant, tous les clients abonnés sont notifiés immédiatement.
  // Sinon, le cron quotidien (et chaque ouverture de l'admin) l'annoncera au démarrage.
  const announced = await announceStartedPromotions();
  return NextResponse.json({ promotion, notified: announced.sent });
});
