"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/wallet/WalletProvider";
import { HORIZONS, type HorizonId } from "@/lib/forecast/scoring";
import { ChainList, ForecastDesk, PracticeList } from "./ForecastDesk";

type Range = { low: number; high: number; horizon: HorizonId; price: number | null };

/** The recent path of the listing with the forecast range opening to the right of the last price. */
function RangeFan({ symbol, range }: { symbol: string; range: Range | null }) {
  const [pts, setPts] = useState<{ t: number; p: number }[]>([]);
  useEffect(() => {
    let off = false;
    fetch(`/api/series/${symbol}?range=5D`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (off || !s) return;
        const p: { t: number; p: number }[] = s.points ?? (s.bars ?? []).map((b: { t: number; c: number }) => ({ t: b.t, p: b.c }));
        setPts(p.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 120)) === 0));
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [symbol]);
  const W = 520;
  const H = 300;
  const split = W * 0.55;
  const last = range?.price ?? pts[pts.length - 1]?.p ?? null;
  const lo = range && range.low > 0 ? range.low : null;
  const hi = range && range.high > (range?.low ?? 0) ? range.high : null;
  const vals = [...pts.map((p) => p.p), ...(lo && hi ? [lo, hi] : []), ...(last ? [last] : [])];
  if (vals.length < 2 || !last) return <div className="grid h-[300px] place-items-center text-[12.5px] text-ink-3">Reading the price path…</div>;
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const pad = (max - min || max * 0.01) * 0.12;
  min -= pad;
  max += pad;
  const y = (v: number) => 14 + (1 - (v - min) / (max - min)) * (H - 40);
  const x = (i: number) => 8 + (i / Math.max(1, pts.length - 1)) * (split - 8);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.p).toFixed(1)}`).join(" ");
  const end = W - 70;
  const ticks = Array.from({ length: 6 }, (_, i) => min + ((max - min) * (i + 0.5)) / 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${symbol} recent price and the forecast range`} data-testid="arena-fan">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={8} x2={end} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.05)" />
          <text x={end + 8} y={y(v) + 3} fontSize="9.5" fill="var(--color-faint)" fontFamily="var(--font-mono)">
            ${v.toFixed(2)}
          </text>
        </g>
      ))}
      <line x1={split} x2={split} y1={8} y2={H - 22} stroke="var(--color-line-2)" strokeDasharray="2 4" />
      <line x1={end} x2={end} y1={8} y2={H - 22} stroke="var(--color-line-2)" strokeDasharray="2 4" />
      <text x={split + 4} y={18} fontSize="9.5" fill="var(--color-faint)" fontFamily="var(--font-mono)">
        NOW
      </text>
      <text x={end - 4} y={H - 8} textAnchor="end" fontSize="9.5" fill="var(--color-faint)" fontFamily="var(--font-mono)">
        +{range ? HORIZONS[range.horizon].short : ""}
      </text>
      <path d={path} fill="none" stroke="#f4f4f4" strokeWidth="1.4" />
      <line x1={x(pts.length - 1)} x2={split} y1={y(pts[pts.length - 1]?.p ?? last)} y2={y(last)} stroke="#f4f4f4" strokeWidth="1.4" />
      {lo && hi ? (
        <>
          <path d={`M${split} ${y(last)} L${end} ${y(hi)} L${end} ${y(lo)} Z`} fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          <line x1={split} x2={end} y1={y(last)} y2={y((lo + hi) / 2)} stroke="#f4f4f4" strokeDasharray="3 3" />
          {[
            [hi, "▲"],
            [(lo + hi) / 2, "◆"],
            [lo, "▼"],
          ].map(([v, m]) => (
            <g key={String(m)}>
              <rect x={end - 3} y={y(Number(v)) - 3} width={6} height={6} fill="#f4f4f4" />
              <text x={end - 10} y={y(Number(v)) + 4} textAnchor="end" fontSize="10" fill="#f4f4f4" fontFamily="var(--font-mono)">
                {m} ${Number(v).toFixed(2)}
              </text>
            </g>
          ))}
        </>
      ) : null}
      <circle cx={split} cy={y(last)} r={4} fill="#000" stroke="#f4f4f4" strokeWidth="1.5" />
    </svg>
  );
}

/** Token list, the range chart and the forecast form side by side; the forecast lists below. */
export function ArenaBoard({ tokens, initialSymbol, initialHorizon }: { tokens: { symbol: string; price: number | null }[]; initialSymbol: string; initialHorizon: HorizonId }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [n, setN] = useState(0);
  const [tab, setTab] = useState<"mine" | "all">("mine");
  const [q, setQ] = useState("");
  const [range, setRange] = useState<Range | null>(null);
  const onRange = useCallback((r: Range) => setRange(r), []);
  const wallet = useWallet();
  const list = useMemo(() => tokens.filter((t) => !q || t.symbol.includes(q.trim().toUpperCase())), [tokens, q]);
  const head = "flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5";
  const cur = tokens.find((t) => t.symbol === symbol);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)_330px]">
        <section className="panel overflow-hidden" aria-label="Pick a token">
          <div className={head}>
            <h2 className="label !text-ink/85">Stock tokens</h2>
            <span className="label">{tokens.length} feeds</span>
          </div>
          <div className="border-b border-line p-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" aria-label="Filter tokens" className="field !min-h-[28px] !py-0.5 !text-[12.5px]" />
          </div>
          <ul className="max-h-[420px] overflow-y-auto max-lg:grid max-lg:max-h-[220px] max-lg:grid-cols-3" data-testid="arena-tokens">
            {list.map((t) => (
              <li key={t.symbol}>
                <button
                  type="button"
                  aria-pressed={symbol === t.symbol}
                  onClick={() => setSymbol(t.symbol)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 border-b border-line px-3 py-2 text-left text-[12.5px] ${symbol === t.symbol ? "bg-white/[0.05] shadow-[inset_2px_0_0_#fff]" : "hover:bg-white/[0.02]"}`}
                >
                  <span className="num font-medium text-ink">{t.symbol}</span>
                  <span className="num text-ink-2">{t.price != null ? `$${t.price >= 1000 ? t.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : t.price.toFixed(2)}` : "–"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel min-w-0 overflow-hidden">
          <div className={head}>
            <h2 className="label !text-ink/85">{symbol} / USD · Chainlink feed</h2>
            <span className="label max-sm:hidden">listing path, last 5 sessions</span>
          </div>
          <div className="p-3">
            <p className="label">Feed price</p>
            <p className="mt-1 flex items-baseline gap-3">
              <span className="num text-[24px] leading-none text-ink">{cur?.price != null ? `$${cur.price.toFixed(2)}` : "–"}</span>
              {range && range.low > 0 && range.high > range.low && range.price ? (
                <span className="num text-[11.5px] text-ink-3">range ±{(((range.high - range.low) / 2 / range.price) * 100).toFixed(2)}%</span>
              ) : null}
            </p>
            <p className="mt-2 text-[12px] text-faint">Shape the range with the form: Tighter, Wider, Lean up, Lean down. The cone redraws as you go.</p>
            <div className="mt-2">
              <RangeFan symbol={symbol} range={range} />
            </div>
          </div>
        </section>
        <div className="min-w-0 lg:col-span-2 xl:col-span-1">
          <ForecastDesk key={symbol} initialSymbol={symbol} initialHorizon={initialHorizon} onSaved={() => setN((x) => x + 1)} onRange={onRange} hideSymbol />
        </div>
      </div>
      <div className="min-w-0 space-y-3">
        <div className="seg" role="tablist">
          {(
            [
              ["mine", "My forecasts"],
              ["all", `Everyone, ${symbol}`],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className="!font-sans">
              {l}
            </button>
          ))}
        </div>
        {tab === "mine" ? (
          wallet.address ? (
            <PracticeList wallet={wallet.address} refresh={n} title="My practice forecasts" />
          ) : (
            <p className="rounded-[8px] border border-dashed border-line-2 p-6 text-center text-[13px] text-ink-3">Your forecasts belong to the wallet that signed them. Connect it to list them; signing costs nothing.</p>
          )
        ) : (
          <PracticeList symbol={symbol} refresh={n} title={`Practice forecasts on ${symbol}`} />
        )}
        <ChainList symbol={tab === "all" ? symbol : undefined} refresh={n} />
      </div>
    </div>
  );
}
