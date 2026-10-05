import { NextResponse } from "next/server";
import { sql, type Customer } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await assertRole(["admin", "staff"]);
  const id = Number((await ctx.params).id);
  const [customer] = await sql<Customer>`
    select id, email, name, phone, role, card_code, points, lifetime_points, stamps, cashback_cents,
      to_char(birthdate, 'YYYY-MM-DD') as birthdate, pending, last_visit_at, created_at
    from customers where id = ${id}`;
  if (!customer) bad("Client introuvable", 404);
  const history = await sql`
    select id, type, points, stamps, cashback_cents, amount_cents, multiplier, note, created_at
    from transactions where customer_id = ${id} order by created_at desc limit 10`;
  return NextResponse.json({ customer, history });
});

/** Changement de rôle (admin uniquement) : customer / staff / admin */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const me = await assertRole(["admin"]);
  const id = Number((await ctx.params).id);
  const { role } = await req.json().catch(() => ({}));
  if (!["customer", "staff", "admin"].includes(role)) bad("Rôle invalide");
  if (id === me.id) bad("Vous ne pouvez pas modifier votre propre rôle");
  const [updated] = await sql`update customers set role = ${role} where id = ${id} returning id`;
  if (!updated) bad("Client introuvable", 404);
  return NextResponse.json({ ok: true });
});
