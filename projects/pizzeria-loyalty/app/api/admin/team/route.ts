import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { normalizeEmail } from "@/lib/config";
import { generateCardCode } from "@/lib/loyalty";

/** Membres de l'équipe (admins + employés) avec leur activité au scanner. */
export const GET = handle(async () => {
  await assertRole(["admin"]);
  const team = await sql`
    select c.id, c.name, c.email, c.role, c.created_at,
           count(t.id) filter (where t.created_at > now() - interval '30 days')::int as scans_30d,
           max(t.created_at) as last_scan_at
      from customers c
      left join transactions t on t.staff_id = c.id
     where c.role in ('admin', 'staff')
     group by c.id
     order by c.role, c.name`;
  return NextResponse.json({ team });
});

/**
 * Ajoute un admin ou un employé.
 * - e-mail déjà inscrit : on change simplement son rôle ;
 * - sinon : on crée le compte avec le mot de passe fourni (à transmettre à la personne).
 */
export const POST = handle(async (req: Request) => {
  await assertRole(["admin"]);
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ""));
  const name = String(body.name || "").trim();
  const password = String(body.password || "");
  const role = body.role === "admin" ? "admin" : "staff";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad("Adresse e-mail invalide");

  const [existing] = await sql<{ id: number }>`
    update customers set role = ${role} where email = ${email} returning id`;
  if (existing) return NextResponse.json({ ok: true, created: false });

  if (name.length < 2) bad("Nom requis pour créer le compte");
  if (password.length < 8) bad("Mot de passe de 8 caractères minimum");
  const hash = await bcrypt.hash(password, 10);
  await sql`
    insert into customers (email, name, password_hash, role, card_code)
    values (${email}, ${name}, ${hash}, ${role}, ${generateCardCode()})`;
  return NextResponse.json({ ok: true, created: true });
});
