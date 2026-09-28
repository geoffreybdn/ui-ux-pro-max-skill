/** Mini-courbe de tendance d'une tuile KPI (une seule série, pas de légende). */
export function Sparkline({ data, color, label }: { data: number[]; color: string; label: string }) {
  const w = 110;
  const h = 40;
  const pad = 4;
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const id = `spark-${label.replace(/\W/g, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} preserveAspectRatio="none" role="img" aria-label={`Tendance ${label} : ${data.join(", ")}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${x(data.length - 1)},${h} L${x(0)},${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r="3" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}
