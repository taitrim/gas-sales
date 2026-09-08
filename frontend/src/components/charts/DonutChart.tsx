import { fmtMoney } from '../../format';

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

const DEFAULT_COLORS = [
  'var(--primary)',
  'var(--primary-2)',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316'
];

interface DonutChartProps {
  data: { label: string; value: number }[];
  centerText?: string;
  centerSub?: string;
  colors?: string[];
  formatValue?: (n: number) => string;
}

export default function DonutChart({
  data,
  centerText,
  centerSub,
  colors = DEFAULT_COLORS,
  formatValue = (n) => fmtMoney(n)
}: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const withColor: DonutDatum[] = data.map((d, i) => ({
    ...d,
    color: colors[i % colors.length]
  }));

  let acc = 0;
  const stops = withColor
    .filter((d) => d.value > 0)
    .map((d) => {
      const start = (acc / (total || 1)) * 100;
      acc += d.value;
      const end = (acc / (total || 1)) * 100;
      return `${d.color} ${start}% ${end}%`;
    })
    .join(', ');

  if (total <= 0) {
    return <div className="empty">Không có dữ liệu.</div>;
  }

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${stops})` }}>
        <div className="donut-hole">
          <div className="donut-center">{centerText ?? fmtMoney(total)}</div>
          {centerSub && <div className="donut-sub">{centerSub}</div>}
        </div>
      </div>
      <ul className="donut-legend">
        {withColor.map((d) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
          return (
            <li key={d.label}>
              <span className="donut-dot" style={{ background: d.color }} />
              <span className="donut-leg-label">{d.label}</span>
              <span className="donut-leg-value">
                {formatValue(d.value)} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}