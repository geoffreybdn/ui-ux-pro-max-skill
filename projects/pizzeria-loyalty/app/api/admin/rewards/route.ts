import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";

export const GET = handle(async () => {
  await assertRole(["admin", "staff"]);
  const rewards = await sql`select * from rewards order by active desc, cost asc`;
  return NextResponse.json({ rewards });
});

export const POST = handle(async (req: Request) => {
  await assertRole(["admin"]);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const cost = Math.trunc(Number(body.cost));
  if (!name) bad("Nom requis");
  if (!(cost > 0)) bad("Coût en points invalide");
  const [reward] = await sql`insert into rewards (name, cost) values (${name}, ${cost}) returning *`;
  return NextResponse.json({ reward });
});
