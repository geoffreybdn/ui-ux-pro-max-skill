import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { normalizePhone } from "@/lib/program";

/** Le client complète son profil (nom et téléphone obligatoires). */
export const PATCH = handle(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) bad("Non connecté", 401);
  const body = await req.json().catch(() => ({}));

  const name = body.name === undefined ? user.name : String(body.name).trim();
  if (name.length < 2) bad("Nom invalide");
  let phone = user.phone;
  if (body.phone !== undefined) {
    const input = String(body.phone).trim();
    if (!input) bad("Le numéro de téléphone est obligatoire");
    phone = normalizePhone(input);
    if (!phone) bad("Numéro de téléphone invalide (ex. 06 12 34 56 78)");
  }

  await sql`update customers set name = ${name}, phone = ${phone} where id = ${user.id}`;
  return NextResponse.json({ ok: true });
});
