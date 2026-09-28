import Link from "next/link";
import { Flame, ScanLine } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { sql } from "@/lib/db";
import { announceStartedPromotions, getActivePromotion } from "@/lib/loyalty";

export const metadata = { title: "Admin" };

export default async function Dashboard() {
  await requireAdminPage();
  // Rattrapage : annonce une promo programmée qui a démarré depuis le dernier cron
  await announceStartedPromotions().catch(() => null);

  const [[stats], promo, recent] = await Promise.all([
    sql<{ customers: number; subscribers: number; points: number; visits_week: number; legacy_pending: number }>`
      select
        (select count(*)::int from customers where role = 'customer') as customers,
        (select count(distinct customer_id)::int from push_subscriptions) as subscribers,
        (select coalesce(sum(points), 0)::int from customers) as points,
        (select count(*)::int from transactions where type = 'earn' and created_at > now() - interval '7 days') as visits_week,
        (select count(*)::int from legacy_customers where claimed_by is null) as legacy_pending`,
    getActivePromotion(),
    sql<{ id: number; name: string; type: string; points: number; created_at: string; staff: string | null }>`
      select t.id, c.name, t.type, t.points, t.created_at, s.name as staff
      from transactions t join customers c on c.id = t.customer_id
      left join customers s on s.id = t.staff_id
      order by t.created_at desc limit 12`,
  ]);

  return (
    <div className="stack">
      <div className="row between">
        <h1>Tableau de bord</h1>
        <Link href="/admin/scanner" className="btn btn-primary"><ScanLine size={18} /> Scanner une carte</Link>
      </div>

      {promo ? (
        <div className="promo-banner"><Flame size={20} /> En cours : {promo.title} (x{Number(promo.multiplier)})</div>
      ) : (
        <div className="card row between">
          <span>Aucune promotion en cours.</span>
          <Link href="/admin/promotions" className="btn btn-sm">Lancer une double points</Link>
        </div>
      )}

      <div className="grid">
        <div className="card stat"><div className="value">{stats.customers}</div><div className="label">Clients inscrits</div></div>
        <div className="card stat"><div className="value">{stats.subscribers}</div><div className="label">Abonnés aux notifications</div></div>
        <div className="card stat"><div className="value">{stats.visits_week}</div><div className="label">Passages (7 jours)</div></div>
        <div className="card stat"><div className="value">{stats.points}</div><div className="label">Points en circulation</div></div>
        <div className="card stat"><div className="value">{stats.legacy_pending}</div><div className="label">Anciens clients pas encore inscrits</div></div>
      </div>

      <section className="card">
        <h2>Derniers mouvements</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Par</th><th style={{ textAlign: "right" }}>Points</th></tr></thead>
            <tbody>
              {recent.map((t) => (
                <tr key={t.id}>
                  <td className="small">{new Date(t.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{t.name}</td>
                  <td><span className="badge">{t.type}</span></td>
                  <td className="small">{t.staff ?? "—"}</td>
                  <td className={t.points >= 0 ? "plus" : "minus"} style={{ textAlign: "right" }}>{t.points > 0 ? "+" : ""}{t.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
