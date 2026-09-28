"use client";

import { useState } from "react";

type Slice = { label: string; value: number; hint?: string };

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

/** Anneau de répartition + légende avec valeurs (l'identité ne repose jamais sur la couleur seule). */
export function Donut({ data: raw, centerLabel }: { data: Slice[]; centerLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  // 5 teintes maximum : au-delà, les plus petites catégories sont regroupées dans « Autre »
  const data =
    raw.length <= SERIES.length
      ? raw
      : [
          ...raw.slice(0, SERIES.length - 1),
          { label: "Autre", value: raw.slice(SERIES.length - 1).reduce((a, d) => a + d.value, 0), hint: raw.slice(SERIES.length - 1).map((d) => d.label).join(", ") },
        ];
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 70;
  const stroke = 22;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && data.filter((d) => d.value > 0).length > 1 ? 2 : 0;
  let offset = 0;
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div className="donut">
      <div className="donut-figure">
        <svg viewBox="0 0 180 180" width="180" height="180" role="img"
          aria-label={data.map((d) => `${d.label} ${d.value} (${pct(d.value)} %)`).join(", ")}>
          <circle cx="90" cy="90" r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
          {total > 0 &&
            data.map((d, i) => {
              const len = (d.value / total) * c;
              const seg = (
                <circle
                  key={d.label}
                  cx="90" cy="90" r={r} fill="none"
                  stroke={SERIES[i]}
                  strokeWidth={active === i ? stroke + 6 : stroke}
                  strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                  strokeDashoffset={-offset}
                  transform="rotate(-90 90 90)"
                  style={{ transition: "stroke-width .15s", cursor: "pointer" }}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                />
              );
              offset += len;
              return d.value > 0 ? seg : null;
            })}
        </svg>
        <div className="donut-center">
          {active === null ? (
            <><b>{total}</b><span>{centerLabel}</span></>
          ) : (
            <><b>{pct(data[active].value)} %</b><span>{data[active].label}</span></>
          )}
        </div>
      </div>
      <ul className="legend">
        {data.map((d, i) => (
          <li
            key={d.label}
            className={active === i ? "is-active" : ""}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            tabIndex={0}
            title={d.hint}
          >
            <span className="swatch" style={{ background: SERIES[i] }} />
            <span className="legend-label">{d.label}</span>
            <span className="legend-value">{d.value}</span>
            <span className="legend-pct">{pct(d.value)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
