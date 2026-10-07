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
    <section className="min-w-0 rounded-[10px] border border-line bg-card" data-testid="feed-board">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-3">
        <div className="flex rounded-[8px] border border-line-2 p-0.5" role="tablist" aria-label="Horizon">
          {HORIZONS.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={h === x.id}
              onClick={() => setH(x.id as HorizonId)}
              className={`num cursor-pointer rounded-[6px] px-3 py-1 text-[12.5px] ${h === x.id ? "bg-ink text-[#050607]" : "text-ink-3 hover:text-ink"}`}
            >
              {x.key}
            </button>
          ))}
        </div>
        {!compact ? (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter tokens" aria-label="Filter tokens" className="field !min-h-[34px] max-w-[220px] !py-1 text-[13.5px]" data-testid="feed-filter" />
            <div className="flex gap-1 text-[12.5px]" role="group" aria-label="Sort">
              {(
                [
                  ["forecasters", "Most forecasters"],
                  ["widest", "Widest range"],
                  ["az", "A–Z"],
                ] as [Sort, string][]
              ).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={`cursor-pointer rounded-[6px] px-2.5 py-1 ${sort === k ? "bg-paper-3 text-ink" : "text-ink-3 hover:text-ink"}`}>
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : null}
        <span className="kicker ml-auto">{shown.length} tokens · Chainlink</span>
      </div>
      <div className="scroll-x">
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
                    <Link href={`/markets/${r.symbol.toLowerCase()}`} className="font-semibold text-ink hover:text-stamp">
                      {r.symbol}
                    </Link>
                    <span className="block max-w-[150px] truncate text-[12px] text-ink-3">{r.name}</span>
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
                        {money(c.low)} – {money(c.high)} <span className="text-ink-3">±{(c.width * 100).toFixed(2)}%</span>
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="whitespace-nowrap text-ink-2">
                    {c && c.practice ? (
                      <span className="num">
                        {c.practice} live · <span className="text-up">{c.up}↑</span> <span className="text-down">{c.down}↓</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">None yet</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${cls}`}>{label}</span>
                  </td>
                  <td className="text-right">
                    <Link href={`/arena?symbol=${r.symbol}&h=${HORIZONS[h].key}`} className="text-[12.5px] whitespace-nowrap text-stamp hover:underline">
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
