import { MapPin, ShoppingBag, Truck } from "lucide-react";
import type { Promotion } from "@/lib/db";
import { channelLabel, promoBenefit } from "@/lib/program";

const until = (d: string) =>
  new Date(d).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** Promos d'offres en cours, côté client (carte). */
export function PromoOffers({ promos, orderUrl }: { promos: Promotion[]; orderUrl: string }) {
  if (promos.length === 0) return null;
  return (
    <section className="card stack" id="promos" aria-label="Promos du moment">
      <h2 style={{ margin: 0 }}>🔥 Promos du moment</h2>
      {promos.map((p) => (
        <div key={p.id} className="promo-offer">
          <div className="promo-offer-top">
            <b>{p.title}</b>
            <span className={`promo-tag ${p.channel === "onsite" ? "is-onsite" : ""}`}>
              {p.channel === "delivery" ? <Truck size={13} /> : <MapPin size={13} />} {channelLabel(p.channel)}
            </span>
          </div>
          <div className="small">{promoBenefit(p)}{p.conditions ? ` · ${p.conditions}` : ""}</div>
          <div className="small muted">Jusqu&apos;au {until(p.ends_at)}</div>
          {p.channel !== "onsite" && orderUrl ? (
            <a href="/commander" target="_blank" rel="noopener" className="btn btn-order btn-sm" style={{ alignSelf: "flex-start" }}>
              <ShoppingBag size={16} /> {p.channel === "delivery" ? "En profiter : commander en ligne" : "Commander en ligne"}
            </a>
          ) : (
            <div className="small">📍 Sur place : présentez votre carte en caisse.</div>
          )}
        </div>
      ))}
    </section>
  );
}
