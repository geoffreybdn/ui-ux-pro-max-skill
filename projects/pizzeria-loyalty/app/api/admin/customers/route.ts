import { NextResponse } from "next/server";
import { sql, type Customer } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle } from "@/lib/api";
import { parseCardCode } from "@/lib/loyalty";

/** Recherche d'un client par code carte (scanner), e-mail, nom ou téléphone. */
export const GET = handle(async (req: Request) => {
  await assertRole(["admin", "staff"]);
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (!q) {
    const customers = await sql<Customer>`
      select id, email, name, phone, role, card_code, points, lifetime_points, stamps, cashback_cents,
      to_char(birthdate, 'YYYY-MM-DD') as birthdate, last_visit_at, created_at
      from customers order by created_at desc limit 50`;
    return NextResponse.json({ customers });
  }
  const card = parseCardCode(q);
  const like = `%${q.toLowerCase()}%`;
  const customers = await sql<Customer>`
    select id, email, name, phone, role, card_code, points, lifetime_points, stamps, cashback_cents,
      to_char(birthdate, 'YYYY-MM-DD') as birthdate, last_visit_at, created_at
    from customers
    where card_code = ${card} or lower(email) like ${like} or lower(name) like ${like}
       or regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like ${"%" + q.replace(/\D/g, "") + "%"} and length(${q.replace(/\D/g, "")}) >= 4
    order by (card_code = ${card}) desc, name asc limit 20`;
  return NextResponse.json({ customers });
});
