/*
 * Server-rendered SVG charts drawn from real Chainlink rounds.
 * FanChart: the price path plus the forecast ranges for each horizon, opening
 * to the right of the last price like a fan.
 */

type Pt = { t: number; p: number };
type Range = { label: string; low: number; high: number; seconds: number };

export function FanChart({
  points,
  ranges,
  now,
  height = 300,
  title,
}: {
  points: Pt[];
  ranges: Range[];
  now: number;
  height?: number;
  title: string;
}) {
  const W = 760;
  const H = height;
  const pad = { l: 8, r: 64, t: 18, b: 26 };
  if (points.length < 2) {
    return (
      <div className="grid h-[220px] place-items-center rounded-[12px] border border-dashed border-line-2 text-[14px] text-ink-3">
        Not enough Chainlink rounds yet to draw this chart.
      </div>
    );
  }
  const first = points[0].t;
  // The future part of the chart is as wide as the longest range shown, but never more than 45 % of the width.
  const futureSpan = Math.max(...ranges.map((r) => r.seconds), 3600);
  const pastSpan = now - first;
  const pastFrac = Math.max(0.55, Math.min(0.8, pastSpan / (pastSpan + futureSpan)));
  const plotW = W - pad.l - pad.r;
  const xNow = pad.l + plotW * pastFrac;
  const x = (t: number) => (t <= now ? pad.l + ((t - first) / Math.max(1, now - first)) * (xNow - pad.l) : xNow + ((t - now) / futureSpan) * (W - pad.r - xNow));
  const values = [...points.map((p) => p.p), ...ranges.flatMap((r) => [r.low, r.high])];
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span = hi - lo || hi * 0.01;
  lo -= span * 0.08;
  hi += span * 0.08;
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const last = points[points.length - 1];
  // Step line: a feed answer holds until the next round.
  let d = `M${x(points[0].t).toFixed(1)} ${y(points[0].p).toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H${x(points[i].t).toFixed(1)} V${y(points[i].p).toFixed(1)}`;
  }
  d += ` H${xNow.toFixed(1)}`;
  const ticks = [lo + (hi - lo) * 0.15, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.85];
  const sorted = [...ranges].sort((a, b) => b.seconds - a.seconds);
  const shade = ["0.13", "0.2", "0.3"];
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-auto w-full">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="2 4" />
            <text x={W - pad.r + 6} y={y(v) + 4} fontSize="11" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">
              {v >= 1000 ? v.toFixed(0) : v.toFixed(2)}
            </text>
          </g>
        ))}
        <line x1={xNow} x2={xNow} y1={pad.t - 6} y2={H - pad.b} stroke="var(--color-line-2)" />
        <text x={xNow + 4} y={H - 8} fontSize="11" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">
          now
        </text>
        {sorted.map((r, i) => {
          const xe = x(now + r.seconds);
          return (
            <g key={r.label}>
              <path
                d={`M${xNow} ${y(last.p)} L${xe} ${y(r.high)} L${xe} ${y(r.low)} Z`}
                fill="var(--color-flow)"
                fillOpacity={shade[i] ?? "0.2"}
              />
              <line x1={xe} x2={xe} y1={y(r.high)} y2={y(r.low)} stroke="var(--color-flow)" strokeWidth="2" />
              <text x={xe} y={Math.max(11, y(r.high) - 6)} textAnchor={i === 0 ? "end" : "middle"} fontSize="11" fill="var(--color-ink-2)" fontFamily="var(--font-mono)">
                {r.label}
              </text>
            </g>
          );
        })}
        <path d={d} fill="none" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx={xNow} cy={y(last.p)} r="4.5" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="1.2" />
      </svg>
    </figure>
  );
}

/** A horizontal range bar: where low and high sit around the current price. */
export function RangeBar({ low, high, price }: { low: number; high: number; price: number }) {
  const lo = Math.min(low, price) * 0.997;
  const hi = Math.max(high, price) * 1.003;
  const pos = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  return (
    <span className="relative block h-2 w-full min-w-[90px] rounded-full bg-paper-3" aria-hidden="true">
      <span className="absolute top-0 bottom-0 rounded-full bg-flow/70" style={{ left: pos(low), right: `calc(100% - ${pos(high)})` }} />
      <span className="absolute top-[-3px] h-[14px] w-[2px] bg-ink" style={{ left: pos(price) }} />
    </span>
  );
}

/** A tiny sparkline of the price path. */
export function Spark({ points, width = 120, height = 32 }: { points: Pt[]; width?: number; height?: number }) {
  if (points.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const lo = Math.min(...points.map((p) => p.p));
  const hi = Math.max(...points.map((p) => p.p));
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${(((p.t - t0) / Math.max(1, t1 - t0)) * width).toFixed(1)} ${(height - 2 - ((p.p - lo) / (hi - lo || 1)) * (height - 4)).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1].p >= points[0].p;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block">
      <path d={d} fill="none" stroke={up ? "var(--color-up)" : "var(--color-down)"} strokeWidth="1.5" />
    </svg>
  );
}
