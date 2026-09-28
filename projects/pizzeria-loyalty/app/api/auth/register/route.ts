import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { adminEmails, normalizeEmail } from "@/lib/config";
import { claimLegacyStamps, creditStamps, generateCardCode, parseCardCode } from "@/lib/loyalty";
import { notify } from "@/lib/notify";
import { firstName, getSettings } from "@/lib/settings";

function detectDevice(ua: string) {
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/mobile/i.test(ua)) return "autre";
  return ua ? "ordinateur" : "autre";
}

function parseBirthdate(v: unknown): string | null {
  const s = String(v || "").trim();
  if (!s) return null;
  const d = new Date(`${s}T12:00:00Z`);
  const year = d.getUTCFullYear();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(d.getTime()) || year < 1900 || d > new Date()) bad("Date de naissance invalide");
  return s;
}

export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ""));
  const name = String(body.name || "").trim();
  const phone = String(body.phone || "").trim() || null;
  const password = String(body.password || "");
  const code = String(body.signupCode || "").trim().toUpperCase();
  const birthdate = parseBirthdate(body.birthdate);
  const src = ["qr", "social"].includes(String(body.src)) ? String(body.src) : "web";
  const device = detectDevice(req.headers.get("user-agent") || "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad("Adresse e-mail invalide");
  if (name.length < 2) bad("Indiquez votre prénom");
  if (password.length < 8) bad("Le mot de passe doit contenir au moins 8 caractères");

  const [existing] = await sql`select 1 from customers where email = ${email}`;
  if (existing) bad("Un compte existe déjà avec cet e-mail. Connectez-vous.", 409);

  const settings = await getSettings();

  // Le champ « code » accepte un code d'inscription (boutique) ou le code carte d'un ami (parrainage)
  let signupCode: { id: number; bonus_points: number } | undefined;
  let referrer: { id: number; name: string } | undefined;
  if (code) {
    [signupCode] = await sql<{ id: number; bonus_points: number }>`
      select id, bonus_points from signup_codes
      where code = ${code} and active
        and (expires_at is null or expires_at > now())
        and (max_uses is null or uses < max_uses)`;
    if (!signupCode && settings.referral.enabled) {
      [referrer] = await sql<{ id: number; name: string }>`
        select id, name from customers where card_code = ${parseCardCode(code)}`;
    }
    if (!signupCode && !referrer) bad("Code invalide ou expiré");
  }

  const role = adminEmails().includes(email) ? "admin" : "customer";
  const hash = await bcrypt.hash(password, 10);

  let customer: { id: number } | undefined;
  for (let attempt = 0; attempt < 3 && !customer; attempt++) {
    try {
      [customer] = await sql<{ id: number }>`
        insert into customers (email, name, phone, password_hash, role, card_code, birthdate, referred_by, signup_source, signup_device)
        values (${email}, ${name}, ${phone}, ${hash}, ${role}, ${generateCardCode()}, ${birthdate}, ${referrer?.id ?? null},
                ${referrer ? "parrainage" : signupCode ? "code" : src}, ${device})
        returning id`;
    } catch (err) {
      // collision (très improbable) sur card_code : on retente ; e-mail en double : on arrête
      if (String(err).includes("customers_email_key")) bad("Un compte existe déjà avec cet e-mail.", 409);
      if (attempt === 2) throw err;
    }
  }
  if (!customer) bad("Inscription impossible, réessayez", 500);

  let bonus = 0;
  if (settings.welcomeStamps > 0) {
    await creditStamps(customer.id, "welcome", settings.welcomeStamps, "Cadeau de bienvenue");
    bonus += settings.welcomeStamps;
  }

  if (signupCode) {
    // Incrément atomique : si le code vient d'atteindre sa limite, pas de bonus.
    const [used] = await sql<{ bonus_points: number }>`
      update signup_codes set uses = uses + 1
      where id = ${signupCode.id} and (max_uses is null or uses < max_uses)
      returning bonus_points`;
    if (used) {
      await sql`update customers set signup_code_id = ${signupCode.id} where id = ${customer.id}`;
      if (await creditStamps(customer.id, "bonus", used.bonus_points, `Code ${code}`)) bonus += used.bonus_points;
    }
  }

  if (referrer) {
    const { refereeStamps, referrerStamps } = settings.referral;
    if (await creditStamps(customer.id, "referral", refereeStamps, `Parrainé par ${referrer.name}`)) bonus += refereeStamps;
    if (referrerStamps > 0) {
      await creditStamps(referrer.id, "referral", referrerStamps, `Parrainage de ${name}`);
      await notify(referrer.id, "referral", { prenom: firstName(referrer.name), filleul: firstName(name), bonus: referrerStamps });
    }
  }

  // Récupération automatique des tampons de l'ancienne carte (import CSV)
  const [legacy] = await claimLegacyStamps([email]);
  if (legacy && !referrer && !signupCode) await sql`update customers set signup_source = 'ancienne_carte' where id = ${customer.id}`;

  await createSession(customer.id);
  return NextResponse.json({ ok: true, bonus, legacyPoints: legacy?.credited ?? 0 });
});
