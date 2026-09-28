import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle } from "@/lib/api";

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await assertRole(["admin"]);
  const id = Number((await ctx.params).id);
  const { active } = await req.json().catch(() => ({}));
  await sql`update rewards set active = ${Boolean(active)} where id = ${id}`;
  return NextResponse.json({ ok: true });
});
