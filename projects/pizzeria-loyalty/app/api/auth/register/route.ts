import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { adminEmails, normalizeEmail } from "@/lib/config";
import { claimLegacyPoints, generateCardCode } from "@/lib/loyalty";

export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ""));
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim() || null;
  const password = String(body.password || "");
  const code = String(body.signupCode || "").trim().toUpperCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad("Adresse e-mail invalide");
  if (name.length < 2) bad("Indiquez votre prénom");
  if (password.length < 8) bad("Le mot de passe doit contenir au moins 8 caractères");

  const [existing] = await sql`select 1 from customers where email = ${email}`;
  if (existing) bad("Un compte existe déjà avec cet e-mail. Connectez-vous.", 409);

  let signupCode: { id: number; bonus_points: number } | undefined;
  if (code) {
    [signupCode] = await sql<{ id: number; bonus_points: number }>`
      select id, bonus_points from signup_codes
      where code = ${code} and active
        and (expires_at is null or expires_at > now())
        and (max_uses is null or uses < max_uses)`;
    if (!signupCode) bad("Code d'inscription invalide ou expiré");
  }

  const role = adminEmails().includes(email) ? "admin" : "customer";
  const hash = await bcrypt.hash(password, 10);

  let customer: { id: number } | undefined;
  for (let attempt = 0; attempt < 3 && !customer; attempt++) {
    try {
      [customer] = await sql<{ id: number }>`
        insert into customers (email, name, phone, password_hash, role, card_code)
        values (${email}, ${name}, ${phone}, ${hash}, ${role}, ${generateCardCode()})
        returning id`;
    } catch (err) {
      // collision (très improbable) sur card_code : on retente ; e-mail en double : on arrête
      if (String(err).includes("customers_email_key")) bad("Un compte existe déjà avec cet e-mail.", 409);
      if (attempt === 2) throw err;
    }
  }
  if (!customer) bad("Inscription impossible, réessayez", 500);

  let bonus = 0;
  if (signupCode) {
    // Incrément atomique : si le code vient d'atteindre sa limite, pas de bonus.
    const [used] = await sql<{ bonus_points: number }>`
      update signup_codes set uses = uses + 1
      where id = ${signupCode.id} and (max_uses is null or uses < max_uses)
      returning bonus_points`;
    if (used) {
      bonus = used.bonus_points;
      await sql`
        with tx as (
          insert into transactions (customer_id, type, points, note)
          values (${customer.id}, 'bonus', ${bonus}, ${"Bonus code " + code}) returning customer_id
        )
        update customers set points = points + ${bonus}, lifetime_points = lifetime_points + ${bonus},
               signup_code_id = ${signupCode.id}
        where id = ${customer.id}`;
    }
  }

  // Récupération automatique des points de l'ancienne carte (import CSV)
  const [legacy] = await claimLegacyPoints([email]);

  await createSession(customer.id);
  return NextResponse.json({ ok: true, bonus, legacyPoints: legacy?.credited ?? 0 });
});
