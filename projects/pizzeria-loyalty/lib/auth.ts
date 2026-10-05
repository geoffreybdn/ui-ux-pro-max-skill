import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { sql, type Customer } from "./db";

const COOKIE = "pz_session";
const MAX_AGE = 60 * 60 * 24 * 180; // 6 mois : le client garde sa carte ouverte

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET n'est pas défini");
  return new TextEncoder().encode(s);
}

export async function createSession(customerId: number) {
  const token = await new SignJWT({ sub: String(customerId) })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Utilisateur connecté (relu en base pour que les changements de rôle s'appliquent tout de suite). */
export async function getCurrentUser(): Promise<Customer | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = Number(payload.sub);
    if (!id) return null;
    const [user] = await sql<Customer>`
      select id, email, name, phone, role, card_code, points, lifetime_points, stamps, cashback_cents,
      to_char(birthdate, 'YYYY-MM-DD') as birthdate, pending, last_visit_at, created_at
      from customers where id = ${id}`;
    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

export async function requireStaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?next=/admin");
  if (user.role === "customer") redirect("/carte");
  return user;
}

export async function requireAdminPage() {
  const user = await requireStaffPage();
  if (user.role !== "admin") redirect("/admin/scanner");
  return user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Pour les route handlers : lève une HttpError si le rôle est insuffisant. */
export async function assertRole(roles: Array<Customer["role"]>) {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Non connecté");
  if (!roles.includes(user.role)) throw new HttpError(403, "Accès refusé");
  return user;
}
