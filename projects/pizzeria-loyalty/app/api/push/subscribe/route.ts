import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle, bad } from "@/lib/api";
import { notify } from "@/lib/notify";
import { firstName } from "@/lib/settings";

export const POST = handle(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) bad("Non connecté", 401);
  const sub = await req.json().catch(() => null);
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) bad("Abonnement invalide");

  const [row] = await sql<{ inserted: boolean }>`
    insert into push_subscriptions (customer_id, endpoint, p256dh, auth)
    values (${user.id}, ${endpoint}, ${p256dh}, ${auth})
    on conflict (endpoint) do update set customer_id = excluded.customer_id, p256dh = excluded.p256dh, auth = excluded.auth
    returning (xmax = 0) as inserted`;

  if (row?.inserted) {
    // Premier appareil abonné : message de bienvenue (modifiable dans Admin → Programme)
    const [{ n }] = await sql<{ n: number }>`select count(*)::int as n from push_subscriptions where customer_id = ${user.id}`;
    if (n === 1) await notify(user.id, "welcome", { prenom: firstName(user.name), solde: user.points });
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) bad("Non connecté", 401);
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) await sql`delete from push_subscriptions where endpoint = ${endpoint} and customer_id = ${user.id}`;
  return NextResponse.json({ ok: true });
});
