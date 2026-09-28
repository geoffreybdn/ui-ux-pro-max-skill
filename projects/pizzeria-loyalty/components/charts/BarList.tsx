/** Liste classée avec barre horizontale proportionnelle (valeur et % toujours écrits). */
export function BarList({
  items,
  color = "var(--series-1)",
  unit,
}: {
  items: { label: string; value: number; sub?: string; icon?: React.ReactNode }[];
  color?: string;
  unit?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((a, i) => a + i.value, 0);
  if (items.length === 0) return <p className="small muted">Pas encore de données.</p>;
  return (
    <ul className="barlist">
      {items.map((it) => (
        <li key={it.label}>
          {it.icon}
          <div className="barlist-main">
            <div className="barlist-top">
              <span className="barlist-label">{it.label}</span>
              <span className="barlist-sub">{it.sub ?? `${it.value}${unit ? ` ${unit}` : ""}`}</span>
            </div>
            <div className="barlist-track" title={`${it.label} : ${it.value}${unit ? ` ${unit}` : ""}`}>
              <span style={{ width: `${(it.value / max) * 100}%`, background: color }} />
            </div>
          </div>
          <span className="barlist-pct">{total ? Math.round((it.value / total) * 100) : 0} %</span>
        </li>
      ))}
    </ul>
  );
}
