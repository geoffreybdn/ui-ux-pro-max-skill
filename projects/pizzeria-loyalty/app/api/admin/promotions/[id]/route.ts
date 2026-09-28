import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle } from "@/lib/api";

/** Arrête une promotion en cours (ou prévue). */
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await assertRole(["admin"]);
  const id = Number((await ctx.params).id);
  await sql`update promotions set active = false where id = ${id}`;
  return NextResponse.json({ ok: true });
});
