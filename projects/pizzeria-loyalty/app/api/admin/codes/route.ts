import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";

export const GET = handle(async () => {
  await assertRole(["admin"]);
  const codes = await sql`select * from signup_codes order by created_at desc`;
  return NextResponse.json({ codes });
});

export const POST = handle(async (req: Request) => {
  await assertRole(["admin"]);
  const body = await req.json().catch(() => ({}));
  let code = String(body.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!code) code = "PIZZA" + randomInt(1000, 9999);
  const bonus = Math.trunc(Number(body.bonusPoints || 0));
  const maxUses = body.maxUses ? Math.trunc(Number(body.maxUses)) : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : null;
  if (bonus < 0 || bonus > 10_000) bad("Bonus invalide");
  if (maxUses !== null && maxUses < 1) bad("Nombre d'utilisations invalide");

  try {
    const [created] = await sql`
      insert into signup_codes (code, bonus_points, max_uses, expires_at)
      values (${code}, ${bonus}, ${maxUses}, ${expiresAt}) returning *`;
    return NextResponse.json({ code: created });
  } catch (err) {
    if (String(err).includes("signup_codes_code_key")) bad("Ce code existe déjà", 409);
    throw err;
  }
});
