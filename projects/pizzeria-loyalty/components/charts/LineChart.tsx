"use client";

import { useEffect, useRef, useState } from "react";

type Point = { label: string; long: string; value: number };

/** Courbe aire mono-série avec réticule vertical + info-bulle (souris, tactile et clavier). */
export function LineChart({ data, unit, color = "var(--series-1)" }: { data: Point[]; unit: string; color?: string }) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);

  // Le repère suit la largeur réelle : les textes gardent leur taille sur mobile
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 240;
  const m = { top: 16, right: 16, bottom: 28, left: 36 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const step = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const niceMax = Math.ceil(rawMax / step) * step || 1;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(niceMax * t));
  const x = (i: number) => m.left + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => m.top + ih - (v / niceMax) * ih;
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${m.top + ih} L${x(0)},${m.top + ih} Z`;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - m.left) / iw) * (data.length - 1));
    setActive(Math.max(0, Math.min(data.length - 1, i)));
  }

  const last = data.length - 1;
  const a = active ?? null;

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`Courbe : ${data.map((d) => `${d.long} ${d.value}`).join(", ")}`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(last)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setActive((v) => Math.max(0, (v ?? last) - 1));
          if (e.key === "ArrowRight") setActive((v) => Math.min(last, (v ?? 0) + 1));
        }}
      >
        <defs>
          <linearGradient id="lc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.22" />
            <stop offset="1" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={m.left - 8} y={y(t) + 4} textAnchor="end" className="chart-axis">{t}</text>
          </g>
        ))}
        {data.map((d, i) =>
          W >= 520 || i % 2 === last % 2 ? (
            <text key={d.label + i} x={x(i)} y={H - 8} textAnchor="middle" className="chart-axis">{d.label}</text>
          ) : null
        )}
        <path d={area} fill="url(#lc-fill)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={a === i ? 6 : 4} fill={color} stroke="var(--surface)" strokeWidth="2" />
        ))}
        {/* Étiquette directe sur la dernière valeur uniquement */}
        {a === null && (
          <text x={x(last)} y={y(data[last].value) - 12} textAnchor="end" className="chart-label">{data[last].value}</text>
        )}
        {a !== null && <line x1={x(a)} x2={x(a)} y1={m.top} y2={m.top + ih} className="chart-crosshair" />}
      </svg>
      {a !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${(x(a) / W) * 100}%`, top: `${(y(data[a].value) / H) * 100}%` }}
          role="status"
        >
          <b>{data[a].value} {unit}</b>
          <span>{data[a].long}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>Données du graphique</caption>
        <tbody>{data.map((d, i) => <tr key={i}><th>{d.long}</th><td>{d.value}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
