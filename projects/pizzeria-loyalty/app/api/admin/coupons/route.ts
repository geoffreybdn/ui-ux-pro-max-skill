import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { announceCoupon, listCoupons, normalizeCode } from "@/lib/coupons";
import type { Coupon, CouponKind } from "@/lib/program";

const KINDS: CouponKind[] = ["bogo", "percent", "amount", "free_item", "stamps", "custom"];

export const GET = handle(async () => {
  await assertRole(["admin"]);
  return NextResponse.json({ coupons: await listCoupons() });
});

export const POST = handle(async (req: Request) => {
  await assertRole(["admin"]);
  const b = await req.json().catch(() => ({}));
  const kind = b.kind as CouponKind;
  if (!KINDS.includes(kind)) bad("Type d'offre invalide");
  const title = String(b.title || "").trim().slice(0, 80);
  if (!title) bad("Titre requis");
  const code = normalizeCode(String(b.code || "")) || `PROMO${randomInt(1000, 9999)}`;
  if (code.length < 3 || code.length > 30) bad("Le code doit faire entre 3 et 30 caractères");

  const int = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n >= min && n <= max ? n : def;
  };
  const value = Number(String(b.value ?? 0).replace(",", "."));
  if (kind === "percent" && !(value > 0 && value <= 100)) bad("Pourcentage entre 1 et 100");
  if (kind === "amount" && !(value > 0 && value <= 500)) bad("Montant de réduction invalide");
  if (kind === "stamps" && !(value >= 1 && value <= 50)) bad("Nombre de tampons entre 1 et 50");

  const days = Array.isArray(b.validDays) ? [...new Set(b.validDays.map(Number).filter((d: number) => d >= 1 && d <= 7))].sort() : [];
  const startsAt = b.startsAt ? new Date(b.startsAt) : new Date();
  const endsAt = b.endsAt ? new Date(b.endsAt) : null;
  if (isNaN(startsAt.getTime()) || (endsAt && (isNaN(endsAt.getTime()) || endsAt <= startsAt))) bad("Dates invalides");
  const maxUses = b.maxUses ? int(b.maxUses, 1, 1_000_000, 0) || null : null;

  try {
    const [coupon] = await sql<Coupon>`
      insert into coupons (code, title, kind, value, buy_qty, get_qty, item, min_amount, conditions,
                           once_per_customer, max_uses, valid_days, starts_at, ends_at, show_in_app)
      values (${code}, ${title}, ${kind}, ${["percent", "amount", "stamps"].includes(kind) ? value : 0},
              ${int(b.buyQty, 1, 20, 1)}, ${int(b.getQty, 1, 20, 1)}, ${String(b.item ?? "").trim().slice(0, 40)},
              ${Math.max(0, Number(String(b.minAmount ?? 0).replace(",", ".")) || 0)},
              ${String(b.conditions || "").trim().slice(0, 160) || null},
              ${b.oncePerCustomer !== false}, ${maxUses}, ${days.length && days.length < 7 ? days : null},
              ${startsAt.toISOString()}, ${endsAt?.toISOString() ?? null}, ${b.showInApp !== false})
      returning id, code, title, kind, value::float as value, buy_qty, get_qty, item, min_amount::float as min_amount,
                conditions, once_per_customer, max_uses, uses, valid_days, starts_at, ends_at, active, show_in_app`;
    const notified = b.notify && coupon.show_in_app && startsAt.getTime() <= Date.now() ? await announceCoupon(coupon) : 0;
    return NextResponse.json({ coupon, notified });
  } catch (err) {
    if (String(err).includes("coupons_code_key")) bad("Ce code existe déjà", 409);
    throw err;
  }
});
