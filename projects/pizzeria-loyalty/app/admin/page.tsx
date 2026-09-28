import Link from "next/link";
import {
  ArrowDownRight, ArrowUpRight, Flame, Gift, Megaphone, Monitor, Smartphone, Stamp, TabletSmartphone, UserCheck, Users, HelpCircle,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { announceStartedPromotions, getActivePromotion } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings";
import {
  PERIODS, parsePeriod, getKpis, getMonthlySignups, getSegments, getSignupSources, getDevices,
  getTopCustomers, getCardProgress, getRecentCampaigns, getRecentActivity, type Kpi,
} from "@/lib/stats";
import { Sparkline } from "@/components/charts/Sparkline";
import { LineChart } from "@/components/charts/LineChart";
import { Donut } from "@/components/charts/Donut";
import { BarList } from "@/components/charts/BarList";
import { PeriodSelect } from "@/components/PeriodSelect";

export const metadata = { title: "Tableau de bord" };

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "hier" : `il y a ${d} j`;
}

function KpiCard({ title, kpi, icon, tone, color, note }: {
  title: string; kpi: Kpi; icon: React.ReactNode; tone: string; color: string; note: string;
}) {
  const up = (kpi.change ?? 0) >= 0;
  return (
    <div className="kpi">
      <span className={`kpi-icon ${tone}`} aria-hidden>{icon}</span>
      <div className="kpi-body">
        <div className="kpi-title">{title}</div>
        <div className="kpi-line">
          <div>
            <div className="kpi-value">{kpi.value.toLocaleString("fr-FR")}</div>
            <div className={`kpi-delta ${up ? "up" : "down"}`} title={note}>
              {kpi.change === null ? "nouveau" : <>{up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}{up ? "+" : ""}{kpi.change} %</>}
              <span className="sr-only"> {note}</span>
            </div>
          </div>
          <Sparkline data={kpi.series} color={color} label={title} />
        </div>
      </div>
    </div>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requireAdminPage();
  const period = parsePeriod((await searchParams).periode);
  // Rattrapage : annonce une promo programmée qui a démarré depuis le dernier cron
  await announceStartedPromotions().catch(() => null);

  const [settings, promo, kpis, monthly, segments, sources, devices, topCustomers, campaigns, activity] =
    await Promise.all([
      getSettings(), getActivePromotion(), getKpis(period), getMonthlySignups(), getSegments(), getSignupSources(),
      getDevices(), getTopCustomers(), getRecentCampaigns(), getRecentActivity(),
    ]);

  const progress = await getCardProgress(settings.stamps.required);
  const days = Number(period);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const range = `${fmt(new Date(Date.now() - (days - 1) * 86400_000))} – ${fmt(new Date())}`;
  const vs = `vs ${days === 365 ? "12 mois" : `${days} j`} précédents`;
  const monthlyData = monthly.map((m) => {
    const [y, mo] = m.month.split("-").map(Number);
    return { label: MONTHS[mo - 1], long: `${MONTHS[mo - 1]} ${y}`, value: m.count };
  });
  const totalDevices = devices.reduce((a, d) => a + d.value, 0);
  const deviceIcon = { ios: <Smartphone size={20} />, android: <TabletSmartphone size={20} />, ordinateur: <Monitor size={20} />, autre: <HelpCircle size={20} /> };

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h1>Tableau de bord</h1>
          <p className="muted">Vue d&apos;ensemble de votre programme de fidélité</p>
        </div>
        <PeriodSelect value={period} options={PERIODS} range={range} />
      </div>

      {promo && (
        <div className="promo-banner"><Flame size={20} /> En cours : {promo.title} (tampons x{Number(promo.multiplier)})</div>
      )}

      <section className="kpi-grid" aria-label="Indicateurs clés">
        <KpiCard title="Clients enregistrés" kpi={kpis.registered} icon={<Users size={26} />} tone="tone-blue" color="var(--series-1)" note="de nouveaux inscrits sur la période" />
        <KpiCard title="Clients actifs" kpi={kpis.active} icon={<UserCheck size={26} />} tone="tone-green" color="var(--series-3)" note={vs} />
        <KpiCard title="Tampons distribués" kpi={kpis.visits} icon={<Stamp size={26} />} tone="tone-orange" color="var(--series-2)" note={vs} />
        <KpiCard title="Cadeaux offerts" kpi={kpis.rewards} icon={<Gift size={26} />} tone="tone-pink" color="var(--series-5)" note={vs} />
      </section>

      <div className="dash-row dash-row-2-1">
        <section className="panel">
          <div className="panel-head"><h2>Évolution des nouveaux clients</h2><span className="chip">12 derniers mois</span></div>
          <LineChart data={monthlyData} unit="nouveaux clients" />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Répartition des clients</h2></div>
          <Donut data={segments} centerLabel="clients" />
        </section>
      </div>

      <div className="dash-row dash-row-3">
        <section className="panel">
          <div className="panel-head"><h2>Meilleurs clients</h2><Link href="/admin/clients">Voir tout</Link></div>
          <ol className="rank-list">
            {topCustomers.map((c, i) => (
              <li key={c.id}>
                <span className="rank">{i + 1}</span>
                <div className="rank-main">
                  <div className="rank-top"><b>{c.name}</b><span className="muted small">{c.rewards} cadeau{c.rewards > 1 ? "x" : ""}</span></div>
                  <div className="barlist-track">
                    <span style={{ width: `${(c.total / Math.max(topCustomers[0]?.total ?? 1, 1)) * 100}%`, background: "var(--series-1)" }} />
                  </div>
                </div>
                <span className="rank-value">{c.total} tampon{c.total > 1 ? "s" : ""}</span>
              </li>
            ))}
            {topCustomers.length === 0 && <li className="small muted">Pas encore de clients.</li>}
          </ol>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Campagnes récentes</h2><Link href="/admin/notifications">Voir tout</Link></div>
          <ul className="feed">
            {campaigns.map((c) => (
              <li key={c.id}>
                <span className={`feed-icon ${c.audience.startsWith("promo") ? "tone-orange" : "tone-blue"}`}>
                  {c.audience.startsWith("promo") ? <Flame size={18} /> : <Megaphone size={18} />}
                </span>
                <div className="feed-main">
                  <b>{c.title}</b>
                  <span className="muted small">Push · {c.sent} appareil{c.sent > 1 ? "s" : ""}</span>
                </div>
                <div className="feed-side">
                  <span className="badge badge-ok">Envoyée</span>
                  <span className="muted small">{new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                </div>
              </li>
            ))}
            {campaigns.length === 0 && <li className="small muted">Aucune campagne envoyée. <Link href="/admin/promotions">Lancer une promo</Link></li>}
          </ul>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Dernière activité</h2><Link href="/admin/clients">Voir tout</Link></div>
          <ul className="feed">
            {activity.map((a) => (
              <li key={a.key}>
                <span className="avatar avatar-sm" aria-hidden>{a.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
                <div className="feed-main">
                  <b>{a.name}</b>
                  <span className={`small act-${a.kind}`}>{a.label}</span>
                </div>
                <span className="muted small feed-time">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="dash-row dash-row-3">
        <section className="panel">
          <div className="panel-head"><h2>Où en sont les cartes</h2><Link href="/admin/programme">Paramétrer</Link></div>
          <BarList items={progress.map((p) => ({ label: p.label, value: p.value, sub: `${p.value} client${p.value > 1 ? "s" : ""}` }))} color="var(--series-2)" />
          <p className="small muted" style={{ marginTop: 8 }}>Carte de {settings.stamps.required} tampons · {settings.stamps.reward}</p>
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Origine des inscriptions</h2><Link href="/admin/affiche">QR d&apos;inscription</Link></div>
          <Donut data={sources} centerLabel="clients" />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Appareils utilisés</h2></div>
          <ul className="barlist">
            {devices.map((d) => (
              <li key={d.key}>
                <span className="device-icon" aria-hidden>{deviceIcon[d.key as keyof typeof deviceIcon]}</span>
                <div className="barlist-main">
                  <div className="barlist-top"><span className="barlist-label">{d.label}</span><span className="barlist-sub">{d.value}</span></div>
                  <div className="barlist-track"><span style={{ width: `${totalDevices ? (d.value / totalDevices) * 100 : 0}%`, background: "var(--series-1)" }} /></div>
                </div>
                <span className="barlist-pct">{totalDevices ? Math.round((d.value / totalDevices) * 100) : 0} %</span>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ marginTop: 8 }}>Appareil utilisé lors de l&apos;inscription.</p>
        </section>
      </div>
    </div>
  );
}
