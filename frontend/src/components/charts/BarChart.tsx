import { fmtMoney } from '../../format';

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
  labelLimit?: number;
  highlightColor?: string;
}

export default function BarChart({
  data,
  height = 220,
  color = 'var(--primary)',
  formatValue = (n) => fmtMoney(n),
  labelLimit = 10,
  highlightColor
}: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const topValue = max;
  return (
    <div className="bar-chart" style={{ height }}>
      {data.length === 0 && <div className="empty">Không có dữ liệu trong khoảng thời gian này.</div>}
      {data.map((d) => {
        const pct = Math.max((d.value / max) * 100, d.value > 0 ? 2 : 0);
        const label =
          d.label.length > labelLimit ? `${d.label.slice(0, labelLimit)}…` : d.label;
        const isTop = d.value === topValue && d.value > 0;
        const fill = isTop && highlightColor ? highlightColor : color;
        return (
          <div className="bar-col" key={d.label}>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  height: `${pct}%`,
                  background: `linear-gradient(180deg, ${fill} 0%, ${fill} 100%)`,
                  boxShadow: isTop ? `0 0 14px ${fill}` : undefined
                }}
              />
            </div>
            <div className="bar-label" title={`${d.label}: ${formatValue(d.value)}`}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}