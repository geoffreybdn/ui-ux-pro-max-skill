import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, bad } from "@/lib/api";

/** Le client complète son profil. La date de naissance ne peut être saisie qu'une fois (anti-abus du cadeau). */
export const PATCH = handle(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) bad("Non connecté", 401);
  const body = await req.json().catch(() => ({}));

  const name = body.name === undefined ? user.name : String(body.name).trim();
  const phone = body.phone === undefined ? user.phone : String(body.phone).trim() || null;
  if (name.length < 2) bad("Nom invalide");

  let birthdate = user.birthdate;
  if (body.birthdate && !user.birthdate) {
    const s = String(body.birthdate);
    const d = new Date(`${s}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(d.getTime()) || d.getUTCFullYear() < 1900 || d > new Date()) {
      bad("Date de naissance invalide");
    }
    birthdate = s;
  }

  await sql`update customers set name = ${name}, phone = ${phone}, birthdate = ${birthdate} where id = ${user.id}`;
  return NextResponse.json({ ok: true });
});
