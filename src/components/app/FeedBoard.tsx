"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FeedRow } from "@/lib/forecast/feed";
import { HORIZONS, type HorizonId } from "@/lib/forecast/scoring";

const SIGNAL: Record<string, [string, string]> = {
  "consensus-up": ["Consensus up", "chip-live"],
  "consensus-down": ["Consensus down", "chip-down"],
  divergent: ["Divergence", "chip-practice"],
  mixed: ["Mixed", ""],
  thin: ["Thin", "chip-target"],
};
const money = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: v >= 1000 ? 0 : 2, maximumFractionDigits: v >= 1000 ? 0 : 2 })}`;

function Spark({ points }: { points: { t: number; p: number }[] }) {
  if (points.length < 2) return <span className="inline-block h-6 w-20" />;
  const lo = Math.min(...points.map((p) => p.p));
  const hi = Math.max(...points.map((p) => p.p));
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const d = points.map((p, i) => `${i ? "L" : "M"}${(((p.t - t0) / Math.max(1, t1 - t0)) * 80).toFixed(1)} ${(22 - ((p.p - lo) / (hi - lo || 1)) * 20).toFixed(1)}`).join(" ");
  return (
    <svg width="80" height="24" viewBox="0 0 80 24" aria-hidden="true">
      <path d={d} fill="none" stroke={points[points.length - 1].p >= points[0].p ? "var(--color-up)" : "var(--color-down)"} strokeWidth="1.4" />
    </svg>
  );
}

type Sort = "forecasters" | "widest" | "az";

/** The forecast feed: filter, sort and switch horizon in the browser; every row links to its market. */
export function FeedBoard({ rows, initialHorizon = 0, compact = false, limit }: { rows: FeedRow[]; initialHorizon?: HorizonId; compact?: boolean; limit?: number }) {
  const [h, setH] = useState<HorizonId>(initialHorizon);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("forecasters");
  const shown = useMemo(() => {
    const n = q.trim().toUpperCase();
    const list = rows.filter((r) => !n || r.symbol.includes(n) || r.name.toUpperCase().includes(n));
    const key = (r: FeedRow) => r.cells[h];
    list.sort((a, b) =>
      sort === "az"
        ? a.symbol.localeCompare(b.symbol)
        : sort === "widest"
          ? (key(b)?.width ?? -1) - (key(a)?.width ?? -1)
          : (key(b)?.practice ?? 0) - (key(a)?.practice ?? 0) || a.symbol.localeCompare(b.symbol),
    );
    return limit ? list.slice(0, limit) : list;
  }, [rows, q, sort, h, limit]);
  return (
    <section className="min-w-0 panel overflow-hidden" data-testid="feed-board">
      <div className="flex min-h-9 items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-3 py-1.5">
        <h2 className="label !text-ink/85">Forecast feed</h2>
        <span className="label max-sm:hidden">{HORIZONS[h].key} horizon</span>
        <span className="label ml-auto max-sm:hidden">{shown.length} tokens · Chainlink</span>
        <div className="seg max-sm:ml-auto" role="tablist" aria-label="Horizon">
          {HORIZONS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={h === x.id} onClick={() => setH(x.id as HorizonId)}>
              {x.key}
            </button>
          ))}
        </div>
      </div>
      {!compact ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
          <label className="relative w-[260px] max-w-full">
            <span className="sr-only">Filter tokens</span>
            <svg className="absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tokens" aria-label="Filter tokens" className="field !pl-8" data-testid="feed-filter" />
          </label>
          <div className="seg" role="group" aria-label="Sort">
            {(
              [
                ["forecasters", "Most forecasters"],
                ["widest", "Widest range"],
                ["az", "A–Z"],
              ] as [Sort, string][]
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className="min-w-[96px] text-left">
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <ul className="divide-y divide-line sm:hidden" data-testid="feed-cards">
        {shown.map((r) => {
          const c = r.cells[h];
          const [label] = SIGNAL[c?.signal ?? "thin"];
          return (
            <li key={r.symbol}>
              <Link href={`/markets/${r.symbol.toLowerCase()}`} className="block px-3 py-3">
                <p className="flex items-baseline justify-between gap-2">
                  <span className="num text-[13px] font-medium text-ink">{r.symbol}</span>
                  <span className="num text-[13px] text-ink">{r.price != null ? money(r.price) : "–"}</span>
                </p>
                <p className="num mt-1 text-[11.5px] text-ink-3">
                  Baseline {c ? `${money(c.low)} – ${money(c.high)}` : "–"} {c ? <span className="text-faint">±{(c.width * 100).toFixed(2)}%</span> : null}
                </p>
                <p className="mt-1 flex justify-between text-[11.5px] text-faint">
                  <span>{c && c.practice ? `${c.practice} live forecasts` : "No practice forecasts yet"}</span>
                  <span className="label">{label}</span>
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="scroll-x max-sm:hidden">
        <table className="tbl min-w-[780px] text-[13px]">
          <thead>
            <tr>
              <th>Token</th>
              <th className="text-right">Feed price</th>
              <th className="text-right">24h</th>
              <th>5 days</th>
              <th>Baseline 80 % range</th>
              <th>Practice view</th>
              <th>Signal</th>
              <th className="text-right" aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const c = r.cells[h];
              const [label, cls] = SIGNAL[c?.signal ?? "thin"];
              return (
                <tr key={r.symbol}>
                  <td>
                    <Link href={`/markets/${r.symbol.toLowerCase()}`} title={r.name} className="font-medium text-ink hover:underline">
                      {r.symbol}
                    </Link>
                  </td>
                  <td className="num text-right text-ink">{r.price != null ? money(r.price) : "–"}</td>
                  <td className={`num text-right ${r.change24h == null ? "text-ink-3" : r.change24h >= 0 ? "text-up" : "text-down"}`}>
                    {r.change24h == null ? "–" : `${r.change24h >= 0 ? "+" : ""}${(r.change24h * 100).toFixed(2)}%`}
                  </td>
                  <td>
                    <Spark points={r.spark} />
                  </td>
                  <td className="num whitespace-nowrap">
                    {c ? (
                      <>
                        {money(c.low)} – {money(c.high)} <span className="text-faint">±{(c.width * 100).toFixed(2)}%</span>
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="font-sans whitespace-nowrap text-ink-2">
                    {c && c.practice ? (
                      <span className="num">
                        {c.practice} live · <span className="text-up">{c.up}↑</span> <span className="text-down">{c.down}↓</span>
                      </span>
                    ) : (
                      <span className="text-faint">None yet</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${cls}`}>{label}</span>
                  </td>
                  <td className="text-right">
                    <Link href={`/arena?symbol=${r.symbol}&h=${HORIZONS[h].key}`} className="font-sans text-[12.5px] whitespace-nowrap text-ink-3 hover:text-ink">
                      Forecast →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
