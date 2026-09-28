import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth";
import { handle } from "@/lib/api";
import { checkCoupon } from "@/lib/coupons";

/** Vérifie un code en caisse sans le consommer. */
export const POST = handle(async (req: Request) => {
  await assertRole(["admin", "staff"]);
  const { code, customerId } = await req.json().catch(() => ({}));
  const r = await checkCoupon(String(code || ""), customerId ? Number(customerId) : null);
  return NextResponse.json(r);
});
