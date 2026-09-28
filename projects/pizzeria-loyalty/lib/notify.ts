import { getSettings, renderTemplate, type NotificationKey } from "./settings";
import { pushToCustomer, pushToCustomers } from "./push";

/** Envoie une notification automatique (si activée par l'admin) à un client. */
export async function notify(customerId: number, key: NotificationKey, vars: Record<string, string | number>, tag?: string) {
  const s = await getSettings();
  const tpl = s.notifications[key];
  if (!tpl.enabled) return 0;
  return pushToCustomer(customerId, {
    title: renderTemplate(tpl.title, vars),
    body: renderTemplate(tpl.body, vars),
    tag: tag ?? key,
  }).catch(() => 0);
}

/** Même chose pour plusieurs clients, avec des variables propres à chacun. */
export async function notifyEach(
  key: NotificationKey,
  recipients: { id: number; vars: Record<string, string | number> }[]
) {
  const s = await getSettings();
  const tpl = s.notifications[key];
  if (!tpl.enabled || recipients.length === 0) return 0;
  let sent = 0;
  for (let i = 0; i < recipients.length; i += 25) {
    const results = await Promise.all(
      recipients.slice(i, i + 25).map((r) =>
        pushToCustomers([r.id], {
          title: renderTemplate(tpl.title, r.vars),
          body: renderTemplate(tpl.body, r.vars),
          tag: key,
        }).catch(() => 0)
      )
    );
    sent += results.reduce((a, b) => a + b, 0);
  }
  return sent;
}
