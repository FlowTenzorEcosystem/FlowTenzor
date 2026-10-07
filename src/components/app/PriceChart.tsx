"use client";

import { useEffect, useState } from "react";
import { usePrefs } from "./AppShell";

type Bar = { t: number; o: number; h: number; l: number; c: number; v: number };
type Series = { range: string; source: string; kind: "line" | "step" | "candles"; points?: { t: number; p: number }[]; bars?: Bar[] };
const RANGES = ["1D", "5D", "1M", "6M", "1Y"] as const;

function Plot({ s, overlay }: { s: Series; overlay?: { low: number; high: number; label: string } | null }) {
  const W = 760;
  const H = 320;
  const pad = { l: 6, r: 58, t: 12, b: 24 };
  const bars = s.bars ?? [];
  const pts = s.points ?? (bars.length ? bars.map((b) => ({ t: b.t, p: b.c })) : []);
  if (pts.length < 2) return <div className="grid h-[260px] place-items-center text-[13px] text-ink-3">No data for this range right now.</div>;
  const vals = s.kind === "candles" ? bars.flatMap((b) => [b.h, b.l]) : pts.map((p) => p.p);
  if (overlay) vals.push(overlay.low, overlay.high);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const span = hi - lo || hi * 0.01;
  lo -= span * 0.06;
  hi += span * 0.06;
  const volH = s.kind === "candles" ? 46 : 0;
  const plotB = H - pad.b - volH;
  const x = (i: number, n: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (plotB - pad.t);
  const last = pts[pts.length - 1].p;
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);
  const n = s.kind === "candles" ? bars.length : pts.length;
  const maxV = Math.max(1, ...bars.map((b) => b.v));
  const cw = Math.max(1.5, ((W - pad.l - pad.r) / Math.max(1, n)) * 0.6);
  let path = "";
  if (s.kind !== "candles") {
    pts.forEach((p, i) => {
      const xi = x(i, n).toFixed(1);
      const yi = y(p.p).toFixed(1);
      path += i === 0 ? `M${xi} ${yi}` : s.kind === "step" ? ` H${xi} V${yi}` : ` L${xi} ${yi}`;
    });
  }
  const fmt = (v: number) => (v >= 1000 ? v.toFixed(0) : v.toFixed(2));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Price chart, ${s.range}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" />
          <text x={W - pad.r + 6} y={y(v) + 4} fontSize="11" fill="var(--color-ink-3)" fontFamily="var(--font-mono)">
            {fmt(v)}
          </text>
        </g>
      ))}
      {overlay ? (
        <g>
          <rect x={pad.l} width={W - pad.l - pad.r} y={y(overlay.high)} height={Math.max(1, y(overlay.low) - y(overlay.high))} fill="var(--color-flow)" fillOpacity="0.1" />
          <text x={pad.l + 6} y={y(overlay.high) - 4} fontSize="11" fill="var(--color-stamp)" fontFamily="var(--font-mono)">
            {overlay.label}
          </text>
        </g>
      ) : null}
      {s.kind === "candles"
        ? bars.map((b, i) => {
            const xi = x(i, n);
            const upc = b.c >= b.o;
            const col = upc ? "var(--color-up)" : "var(--color-down)";
            return (
              <g key={b.t}>
                <line x1={xi} x2={xi} y1={y(b.h)} y2={y(b.l)} stroke={col} strokeWidth="1" />
                <rect x={xi - cw / 2} width={cw} y={y(Math.max(b.o, b.c))} height={Math.max(1, Math.abs(y(b.o) - y(b.c)))} fill={col} />
                <rect x={xi - cw / 2} width={cw} y={H - pad.b - (b.v / maxV) * (volH - 6)} height={(b.v / maxV) * (volH - 6)} fill="var(--color-ink-3)" fillOpacity="0.35" />
              </g>
            );
          })
        : <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth="1.6" strokeLinejoin="round" />}
      <line x1={pad.l} x2={W - pad.r} y1={y(last)} y2={y(last)} stroke="var(--color-accent)" strokeDasharray="3 4" />
      <rect x={W - pad.r + 2} y={y(last) - 9} width={pad.r - 4} height="18" rx="3" fill="var(--color-accent)" />
      <text x={W - pad.r + 6} y={y(last) + 4} fontSize="11" fill="#04140e" fontFamily="var(--font-mono)">
        {fmt(last)}
      </text>
    </svg>
  );
}

/** Market chart with range switch. `overlay` draws a forecast band (e.g. the 1-day baseline range). */
export function PriceChart({ symbol, overlay }: { symbol: string; overlay?: { low: number; high: number; label: string } | null }) {
  const [prefs] = usePrefs();
  const [chosen, setRange] = useState<string | null>(null);
  const range = chosen ?? prefs.chartRange;
  const key = `${symbol}:${range}`;
  const [got, setGot] = useState<{ key: string; s: Series | null; failed: boolean } | null>(null);
  useEffect(() => {
    let off = false;
    fetch(`/api/series/${symbol}?range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((v: Series) => !off && setGot({ key: `${symbol}:${range}`, s: v, failed: false }))
      .catch(() => !off && setGot({ key: `${symbol}:${range}`, s: null, failed: true }));
    return () => {
      off = true;
    };
  }, [symbol, range]);
  const s = got?.key === key ? got.s : null;
  const failed = got?.key === key ? got.failed : false;
  const pts = s?.points ?? s?.bars?.map((b) => ({ t: b.t, p: b.c })) ?? [];
  const first = pts[0]?.p;
  const last = pts[pts.length - 1]?.p;
  const high = s?.bars?.length ? Math.max(...s.bars.map((b) => b.h)) : pts.length ? Math.max(...pts.map((p) => p.p)) : null;
  const low = s?.bars?.length ? Math.min(...s.bars.map((b) => b.l)) : pts.length ? Math.min(...pts.map((p) => p.p)) : null;
  const chg = first && last ? (last / first - 1) * 100 : null;
  return (
    <section className="min-w-0 rounded-[10px] border border-line bg-card" data-testid="price-chart">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="kicker">
          Price · <span className="normal-case">{s?.source ?? "loading"}</span>
        </p>
        <div className="flex gap-0.5 rounded-[7px] border border-line-2 p-0.5" role="tablist" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => setRange(r)} className={`num cursor-pointer rounded-[5px] px-2.5 py-1 text-[12px] ${range === r ? "bg-ink text-[#050607]" : "text-ink-3 hover:text-ink"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 pt-3 text-[12.5px] text-ink-3">
        <span>
          {range} change <span className={`num ${chg == null ? "" : chg >= 0 ? "text-up" : "text-down"}`}>{chg == null ? "–" : `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%`}</span>
        </span>
        <span>
          High <span className="num text-ink">{high?.toFixed(2) ?? "–"}</span>
        </span>
        <span>
          Low <span className="num text-ink">{low?.toFixed(2) ?? "–"}</span>
        </span>
        <span>
          Points <span className="num text-ink">{s?.bars?.length ?? s?.points?.length ?? 0}</span>
        </span>
      </div>
      <div className="px-2 pt-2 pb-3">{failed ? <p className="px-2 py-16 text-center text-[13px] text-ink-3">The chart source could not be reached. Try another range.</p> : s ? <Plot s={s} overlay={overlay} /> : <div className="h-[260px] animate-pulse rounded bg-paper-2" />}</div>
    </section>
  );
}
