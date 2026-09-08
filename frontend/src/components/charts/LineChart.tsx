import { useState } from 'react';

export interface LineDatum {
  label: string;
  value: number;
}

interface LineChartProps {
  data: LineDatum[];
  height?: number;
  color?: string;
  formatValue?: (n: number) => string;
}

// Biểu đồ đường SVG — rõ xu hướng, có tooltip khi chạm/hover
export default function LineChart({
  data,
  height = 220,
  color = 'var(--primary)',
  formatValue = (n) => new Intl.NumberFormat('vi-VN').format(n)
}: LineChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const W = 600;
  const H = 220;
  const padX = 12;
  const padTop = 16;
  const padBottom = 26;

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const x = (i: number) => padX + (i / Math.max(data.length - 1, 1)) * (W - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / range) * (H - padTop - padBottom);

  if (data.length === 0) {
    return <div className="empty">Không có dữ liệu trong khoảng thời gian này.</div>;
  }

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const areaPath =
    `M ${x(0)},${H - padBottom} ` +
    data.map((d, i) => `L ${x(i)},${y(d.value)}`).join(' ') +
    ` L ${x(data.length - 1)},${H - padBottom} Z`;

  return (
    <div className="line-chart" style={{ height, position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padX}
            x2={W - padX}
            y1={padTop + f * (H - padTop - padBottom)}
            y2={padTop + f * (H - padTop - padBottom)}
            stroke="var(--border-soft)"
            strokeWidth="1"
            strokeDasharray="4 5"
          />
        ))}
        <path d={areaPath} fill="url(#lc-fill)" />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <circle
            key={d.label}
            cx={x(i)}
            cy={y(d.value)}
            r={active === i ? 6 : 3.5}
            fill={active === i ? '#fff' : color}
            stroke={color}
            strokeWidth="2"
            style={{ transition: 'r 0.15s' }}
          />
        ))}
        {data.map((d, i) => (
          <rect
            key={`hit-${d.label}`}
            x={x(i) - (W / data.length) / 2}
            y={padTop}
            width={W / data.length}
            height={H - padTop - padBottom}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onTouchStart={() => setActive(i)}
            onTouchEnd={() => setActive(null)}
          />
        ))}
      </svg>
      {/* Trục nhãn */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'space-between', padding: '0 2px', overflow: 'hidden' }}>
        {data.map((d, i) => {
          const show = data.length <= 8 || i % Math.ceil(data.length / 8) === 0;
          return (
            <span
              key={d.label}
              style={{
                fontSize: 10.5,
                color: 'var(--text-faint)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                flex: '1 1 0',
                textAlign: 'center',
                pointerEvents: 'none',
                opacity: show ? 1 : 0
              }}
            >
              {d.label}
            </span>
          );
        })}
      </div>
      {active !== null && data[active] && (
        <div
          className="chart-tooltip"
          style={{
            left: `${(x(active) / W) * 100}%`,
            top: 4,
            transform: 'translateX(-50%)'
          }}
        >
          {data[active].label}: {formatValue(data[active].value)}
        </div>
      )}
    </div>
  );
}