import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { announceStartedPromotions } from "@/lib/loyalty";
import { PROMO_CHANNELS, PROMO_KINDS, type PromoChannel, type PromoKind } from "@/lib/program";
import { ensurePromoSchema } from "@/lib/schema";

export const GET = handle(async () => {
  await assertRole(["admin"]);
  await ensurePromoSchema();
  const promotions = await sql`select * from promotions order by starts_at desc limit 100`;
  return NextResponse.json({ promotions });
});

export const POST = handle(async (req: Request) => {
  await assertRole(["admin"]);
  await ensurePromoSchema();
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim().slice(0, 80);
  const message = String(body.message || "").trim().slice(0, 200) || null;
  const kind = String(body.kind || "stamps") as PromoKind;
  const channel = (kind === "stamps" ? "all" : String(body.channel || "all")) as PromoChannel;
  const multiplier = kind === "stamps" ? Number(body.multiplier || 2) : 1;
  const value = Number(body.value || 0);
  const buyQty = Math.round(Number(body.buyQty || 1));
  const getQty = Math.round(Number(body.getQty || 1));
  const item = String(body.item ?? "").trim().slice(0, 60);
  const conditions = String(body.conditions || "").trim().slice(0, 200) || null;
  const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
  const endsAt = new Date(body.endsAt);

  if (!title) bad("Titre requis");
  if (!PROMO_KINDS.some((k) => k.value === kind)) bad("Type de promotion inconnu");
  if (!PROMO_CHANNELS.some((c) => c.value === channel)) bad("Canal inconnu");
  if (kind === "stamps" && !(multiplier > 1 && multiplier <= 10)) bad("Multiplicateur entre 2 et 10");
  if (kind === "bogo" && !(buyQty >= 1 && buyQty <= 20 && getQty >= 1 && getQty <= 20)) bad("Quantités entre 1 et 20");
  if (kind === "percent" && !(value > 0 && value <= 100)) bad("Pourcentage entre 1 et 100");
  if (kind === "amount" && !(value > 0 && value <= 500)) bad("Montant de la réduction invalide");
  if ((kind === "bogo" || kind === "free_item") && !item) bad("Indiquez le produit (ex. pizza)");
  if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) bad("La date limite doit être après la date de début");
  if (endsAt <= new Date()) bad("La date limite est déjà passée");

  const [promotion] = await sql`
    insert into promotions (title, message, kind, channel, multiplier, value, buy_qty, get_qty, item, conditions, starts_at, ends_at)
    values (${title}, ${message}, ${kind}, ${channel}, ${multiplier}, ${value}, ${buyQty}, ${getQty}, ${item}, ${conditions},
            ${startsAt.toISOString()}, ${endsAt.toISOString()})
    returning *`;

  // Promo qui commence maintenant : notification immédiate à tous les clients abonnés.
  // Promo programmée : annoncée automatiquement à sa date de lancement (crons + visites de l'app).
  const announced = await announceStartedPromotions();
  return NextResponse.json({ promotion, notified: announced.sent, started: startsAt <= new Date() });
});
