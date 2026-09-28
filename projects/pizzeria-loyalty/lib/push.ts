import webpush from "web-push";
import { sql } from "./db";

let configured = false;

function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@example.com", pub, priv);
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string; tag?: string };

type Sub = { id: number; endpoint: string; p256dh: string; auth: string };

async function deliver(subs: Sub[], payload: PushPayload): Promise<number> {
  if (!configure() || subs.length === 0) return 0;
  const data = JSON.stringify({ url: "/carte", ...payload });
  const expired: number[] = [];
  let sent = 0;

  // Envoi par paquets pour rester sous les limites d'une fonction serverless
  for (let i = 0; i < subs.length; i += 50) {
    const batch = subs.slice(i, i + 50);
    const results = await Promise.allSettled(
      batch.map((s) =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data, {
          TTL: 60 * 60 * 24,
        })
      )
    );
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") sent++;
      else {
        const code = (r.reason as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) expired.push(batch[idx].id);
        else console.error("push error", code, (r.reason as Error)?.message);
      }
    });
  }

  if (expired.length) await sql`delete from push_subscriptions where id = any(${expired})`;
  return sent;
}

export async function pushToCustomer(customerId: number, payload: PushPayload) {
  const subs = await sql<Sub>`select id, endpoint, p256dh, auth from push_subscriptions where customer_id = ${customerId}`;
  return deliver(subs, payload);
}

export async function pushToCustomers(customerIds: number[], payload: PushPayload) {
  if (customerIds.length === 0) return 0;
  const subs = await sql<Sub>`
    select id, endpoint, p256dh, auth from push_subscriptions where customer_id = any(${customerIds})`;
  return deliver(subs, payload);
}

export async function broadcast(payload: PushPayload, audience = "all") {
  const subs = await sql<Sub>`select id, endpoint, p256dh, auth from push_subscriptions`;
  const sent = await deliver(subs, payload);
  await sql`insert into notifications_log (title, body, audience, sent) values (${payload.title}, ${payload.body}, ${audience}, ${sent})`;
  return sent;
}
