export type ChartDatum = {
  label: string;
  value: number;
  displayValue?: string;
};

export default function LiveBarChart({
  title,
  description,
  data,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
}) {
  const maximum = Math.max(1, ...data.map(item => item.value));
  const populated = data.some(item => item.value > 0);

  return <article className="panel live-chart">
    <div className="chart-heading"><div><span className="eyebrow">LIVE ANALYTICS</span><h3>{title}</h3></div><span className="live-dot">Live</span></div>
    <p>{description}</p>
    {populated ? <div className="bar-chart" role="img" aria-label={`${title}. ${data.map(item => `${item.label}: ${item.displayValue ?? item.value}`).join(", ")}`}>
      {data.map(item => <div className="bar-row" key={item.label}>
        <span title={item.label}>{item.label}</span>
        <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(item.value > 0 ? 4 : 0, (item.value / maximum) * 100)}%` }} /></div>
        <strong>{item.displayValue ?? item.value.toLocaleString()}</strong>
      </div>)}
    </div> : <div className="chart-empty">No live records yet. This graph will populate from the database as activity occurs.</div>}
  </article>;
}
