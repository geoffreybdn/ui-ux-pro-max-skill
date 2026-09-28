import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { redeemCoupon } from "@/lib/coupons";

/** Valide (consomme) un code promo en caisse. */
export const POST = handle(async (req: Request) => {
  const staff = await assertRole(["admin", "staff"]);
  const { code, customerId } = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await redeemCoupon(String(code || ""), customerId ? Number(customerId) : null, staff.id));
  } catch (err) {
    if (err instanceof Error && err.constructor === Error) bad(err.message);
    throw err;
  }
});
