import { useMemo, useState } from 'react';

interface ChartData {
  month: string;
  value: number;
}

interface PerformanceChartProps {
  data: ChartData[];
}

const W = 800;
const H = 300;
const PAD = { left: 56, right: 16, top: 16, bottom: 34 };

const brl = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const shortLabel = (s: string) => {
  // "dd/mm/aaaa" -> "dd/mm"
  const m = s.match(/^(\d{2}\/\d{2})/);
  return m ? m[1] : s;
};

export default function PerformanceChart({ data }: PerformanceChartProps) {
  const [hover, setHover] = useState<{ i: number } | null>(null);

  const chart = useMemo(() => {
    if (!data || data.length === 0) return null;

    const values = data.map((d) => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const getX = (i: number) =>
      data.length === 1
        ? PAD.left + plotW / 2
        : PAD.left + (i / (data.length - 1)) * plotW;
    const getY = (v: number) =>
      PAD.top + plotH - ((v - minValue) / range) * plotH;

    const linePoints = data.map((p, i) => `${getX(i)},${getY(p.value)}`).join(' ');
    const areaPoints = `${PAD.left},${PAD.top + plotH} ${linePoints} ${
      PAD.left + plotW
    },${PAD.top + plotH}`;

    const ticks = 4;
    const yLabels = Array.from({ length: ticks + 1 }, (_, i) => {
      const v = minValue + (range * i) / ticks;
      return { label: brl(v), y: PAD.top + plotH - (i / ticks) * plotH };
    });

    // no máx. ~6 rótulos no eixo X, espaçados uniformemente
    const maxLabels = 6;
    const step = Math.max(1, Math.ceil(data.length / maxLabels));
    const xLabelIdx = data
      .map((_, i) => i)
      .filter((i) => i % step === 0 || i === data.length - 1);

    return {
      minValue,
      getX,
      getY,
      linePoints,
      areaPoints,
      yLabels,
      xLabelIdx,
      plotW,
      plotH,
    };
  }, [data]);

  if (!chart || data.length === 0) return null;

  const dense = data.length > 40;
  const hoveredX = hover ? chart.getX(hover.i) : 0;
  const hoveredY = hover ? chart.getY(data[hover.i].value) : 0;

  return (
    <div className="relative h-80 w-full">
      <div className="ip-card-i relative h-full overflow-hidden p-4">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${W} ${H}`}
          className="overflow-visible"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const t = Math.min(
              1,
              Math.max(0, (px - PAD.left) / chart.plotW)
            );
            const i = Math.round(t * (data.length - 1));
            if (i >= 0 && i < data.length) setHover({ i });
          }}
        >
          <defs>
            <linearGradient id="ipPerfGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F0C040" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#F0C040" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {chart.yLabels.map((item, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={item.y}
                x2={W - PAD.right}
                y2={item.y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 8}
                y={item.y + 3}
                textAnchor="end"
                className="fill-ip-text-mute ip-selo tnum"
              >
                {item.label}
              </text>
            </g>
          ))}

          <polygon fill="url(#ipPerfGrad)" points={chart.areaPoints} />

          <polyline
            fill="none"
            stroke="#F0C040"
            strokeWidth={dense ? 1.75 : 2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={chart.linePoints}
          />

          {!dense &&
            data.map((point, i) => (
              <circle
                key={i}
                cx={chart.getX(i)}
                cy={chart.getY(point.value)}
                r="4"
                fill="#F0C040"
                stroke="#0d141f"
                strokeWidth="3"
              />
            ))}

          {chart.xLabelIdx.map((i) => (
            <text
              key={i}
              x={chart.getX(i)}
              y={H - 12}
              textAnchor="middle"
              className="fill-ip-text-mute ip-selo tnum"
            >
              {shortLabel(data[i].month)}
            </text>
          ))}

          {hover && (
            <>
              <line
                x1={hoveredX}
                y1={PAD.top}
                x2={hoveredX}
                y2={PAD.top + chart.plotH}
                stroke="rgba(240,192,64,0.35)"
                strokeWidth="1"
              />
              <circle
                cx={hoveredX}
                cy={hoveredY}
                r="4.5"
                fill="#F0C040"
                stroke="#0d141f"
                strokeWidth="3"
              />
            </>
          )}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-ip-border bg-ip-surface px-3 py-2 text-xs text-ip-text shadow-card"
            style={{
              left: `${(hoveredX / W) * 100}%`,
              top: `${(hoveredY / H) * 100}%`,
              transform: 'translate(-50%, -125%)',
            }}
          >
            <p className="mb-1 text-ip-text-mute">{data[hover.i].month}</p>
            <p className="font-semibold text-ip-gold tnum">
              {brl(data[hover.i].value)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
