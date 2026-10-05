import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { adminEmails, normalizeEmail } from "@/lib/config";

export const POST = handle(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ""));
  const [user] = await sql<{ id: number; role: string; password_hash: string; pending: boolean }>`
    select id, role, password_hash, pending from customers where email = ${email}`;
  if (user?.pending) {
    bad("Vos tampons de l'ancienne carte vous attendent : cliquez sur « S'inscrire » avec cet e-mail pour activer votre compte.", 401);
  }
  if (!user || !(await bcrypt.compare(String(body.password || ""), user.password_hash))) {
    bad("E-mail ou mot de passe incorrect", 401);
  }
  if (adminEmails().includes(email) && user.role !== "admin") {
    await sql`update customers set role = 'admin' where id = ${user.id}`;
  }
  await createSession(user.id);
  const isStaff = user.role !== "customer" || adminEmails().includes(email);
  return NextResponse.json({ ok: true, redirect: isStaff ? "/admin" : "/carte" });
});
